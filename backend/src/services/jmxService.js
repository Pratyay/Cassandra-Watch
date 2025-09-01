const { exec } = require('child_process');
const { promisify } = require('util');
const net = require('net');
const java = require('java');

const execAsync = promisify(exec);

class JMXService {
    constructor() {
        this.jmxPort = 7199; // Default JMX port for Cassandra
        this.availableNodes = [];
        this.jmxConnections = new Map(); // Store JMX connections per node
        this.lastMetricsCache = new Map(); // Cache metrics per node
        this.javaInitialized = false;
        
        // SSH tunnel configuration - set to true if using SSH tunnels
        this.useSSHTunnel = process.env.SSH_TUNNEL_MODE === 'true' || false;
        this.sshTunnelHost = process.env.SSH_TUNNEL_HOST || 'localhost';
        this.sshTunnelPort = process.env.SSH_TUNNEL_PORT || 22;
        
        this.initializeJavaJMX();
    }

    // Initialize Java JMX classes
    initializeJavaJMX() {
        try {
            // Add required Java classes for JMX
            java.classpath.push('.');
            
            // Import necessary Java classes
            this.MBeanServerConnection = java.import('javax.management.MBeanServerConnection');
            this.JMXConnector = java.import('javax.management.remote.JMXConnector');
            this.JMXConnectorFactory = java.import('javax.management.remote.JMXConnectorFactory');
            this.JMXServiceURL = java.import('javax.management.remote.JMXServiceURL');
            this.ObjectName = java.import('javax.management.ObjectName');
            this.Attribute = java.import('javax.management.Attribute');
            
            this.javaInitialized = true;
        } catch (error) {
            console.warn('Failed to initialize Java JMX classes:', error.message);
            this.javaInitialized = false;
        }
    }
    

    async getNodetoolStats(command, host = '127.0.0.1') {
        try {
            const { stdout, stderr } = await execAsync(`nodetool -h ${host} ${command}`);
            
            if (stderr) {
                console.warn(`Nodetool warning for ${command}:`, stderr);
            }
            
            return {
                success: true,
                output: stdout.trim(),
                command: command,
                host: host
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                command: command,
                host: host
            };
        }
    }

    parseNodetoolStatus(output) {
        try {
            const lines = output.split('\n').filter(line => line.trim());
            const nodes = [];
            let currentDatacenter = null;

            for (const line of lines) {
                if (line.startsWith('Datacenter:')) {
                    currentDatacenter = line.split(':')[1].trim();
                } else if (line.match(/^[UD][NJLM]\s+/)) {
                    // Parse node line: UN  127.0.0.1  125.51 KiB  256          38.1%            abc123...
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 6) {
                        nodes.push({
                            status: parts[0][0], // U = Up, D = Down
                            state: parts[0][1],  // N = Normal, J = Joining, L = Leaving, M = Moving
                            address: parts[1],
                            load: parts[2] + ' ' + parts[3], // Load with unit
                            tokens: parseInt(parts[4]) || 0,
                            owns: parts[5],
                            hostId: parts[6] || 'unknown',
                            rack: parts[7] || 'unknown',
                            datacenter: currentDatacenter
                        });
                    }
                }
            }

            return {
                success: true,
                nodes: nodes,
                totalNodes: nodes.length,
                upNodes: nodes.filter(n => n.status === 'U').length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Parse nodetool command outputs into structured metrics
    parseNodetoolMetrics(commands) {
        const metrics = {
            storage: {
                load: null,
                commitLogSize: null,
                totalHints: null,
                exceptions: null
            },
            clientRequest: {
                read: {
                    latency: {
                        mean: null,
                        p95: null,
                        p99: null,
                        count: null,
                        meanRate: null
                    },
                    timeouts: null,
                    unavailables: null
                },
                write: {
                    latency: {
                        mean: null,
                        p95: null,
                        p99: null,
                        count: null,
                        meanRate: null
                    },
                    timeouts: null,
                    unavailables: null
                }
            },
            cache: {
                keyCache: {
                    hitRate: null,
                    requests: null,
                    size: null
                },
                rowCache: {
                    hitRate: null,
                    requests: null,
                    size: null
                }
            },
            compaction: {
                pendingTasks: null,
                completedTasks: null,
                totalCompactionsCompleted: null,
                bytesCompacted: null
            },
            threadPools: {
                mutationStage: {
                    activeTasks: null,
                    pendingTasks: null,
                    completedTasks: null
                },
                readStage: {
                    activeTasks: null,
                    pendingTasks: null,
                    completedTasks: null
                },
                compactionExecutor: {
                    activeTasks: null,
                    pendingTasks: null,
                    completedTasks: null
                }
            },
            memory: {
                heapMemoryUsage: {
                    used: null,
                    max: null
                },
                nonHeapMemoryUsage: {
                    used: null
                }
            },
            gc: {
                youngGen: {
                    collectionCount: null,
                    collectionTime: null
                },
                oldGen: {
                    collectionCount: null,
                    collectionTime: null
                }
            }
        };

        try {
            // Parse info command output for basic metrics
            if (commands.info && commands.info.success) {
                const infoLines = commands.info.output.split('\n');
                for (const line of infoLines) {
                    if (line.includes('Load')) {
                        const match = line.match(/Load\s+:\s+([\d.]+)\s*(\w+)/i);
                        if (match) {
                            let load = parseFloat(match[1]);
                            const unit = match[2].toLowerCase();
                            // Convert to bytes
                            if (unit.startsWith('k')) load *= 1024;
                            else if (unit.startsWith('m')) load *= 1024 * 1024;
                            else if (unit.startsWith('g')) load *= 1024 * 1024 * 1024;
                            metrics.storage.load = load;
                        }
                    }
                    if (line.includes('Heap Memory')) {
                        const match = line.match(/Heap Memory \(MB\)\s+:\s+([\d.]+)\s+\/\s+([\d.]+)/i);
                        if (match) {
                            metrics.memory.heapMemoryUsage.used = parseFloat(match[1]) * 1024 * 1024;
                            metrics.memory.heapMemoryUsage.max = parseFloat(match[2]) * 1024 * 1024;
                        }
                    }
                }
            }

            // Parse thread pool stats
            if (commands.tpstats && commands.tpstats.success) {
                const tpLines = commands.tpstats.output.split('\n');
                for (const line of tpLines) {
                    if (line.includes('MutationStage')) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 4) {
                            metrics.threadPools.mutationStage.activeTasks = parseInt(parts[1]) || 0;
                            metrics.threadPools.mutationStage.pendingTasks = parseInt(parts[2]) || 0;
                            metrics.threadPools.mutationStage.completedTasks = parseInt(parts[3]) || 0;
                        }
                    }
                    if (line.includes('ReadStage')) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 4) {
                            metrics.threadPools.readStage.activeTasks = parseInt(parts[1]) || 0;
                            metrics.threadPools.readStage.pendingTasks = parseInt(parts[2]) || 0;
                            metrics.threadPools.readStage.completedTasks = parseInt(parts[3]) || 0;
                        }
                    }
                    if (line.includes('CompactionExecutor')) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 4) {
                            metrics.threadPools.compactionExecutor.activeTasks = parseInt(parts[1]) || 0;
                            metrics.threadPools.compactionExecutor.pendingTasks = parseInt(parts[2]) || 0;
                            metrics.threadPools.compactionExecutor.completedTasks = parseInt(parts[3]) || 0;
                        }
                    }
                }
            }

            // Parse compaction stats
            if (commands.compactionstats && commands.compactionstats.success) {
                const compactionLines = commands.compactionstats.output.split('\n');
                for (const line of compactionLines) {
                    if (line.includes('pending tasks:')) {
                        const match = line.match(/(\d+)/);
                        if (match) {
                            metrics.compaction.pendingTasks = parseInt(match[1]) || 0;
                        }
                    }
                }
            }

            // Parse GC stats
            if (commands.gcstats && commands.gcstats.success) {
                const gcLines = commands.gcstats.output.split('\n');
                for (const line of gcLines) {
                    if (line.includes('G1 Young Generation')) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 6) {
                            metrics.gc.youngGen.collectionCount = parseInt(parts[4]) || 0;
                            metrics.gc.youngGen.collectionTime = parseInt(parts[5]) || 0;
                        }
                    }
                    if (line.includes('G1 Old Generation')) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 6) {
                            metrics.gc.oldGen.collectionCount = parseInt(parts[4]) || 0;
                            metrics.gc.oldGen.collectionTime = parseInt(parts[5]) || 0;
                        }
                    }
                }
            }

            // Note: Latency and cache metrics require direct JMX access or additional nodetool commands
            // For now, these remain at zero since they can't be easily extracted from basic nodetool commands
            // In a production environment, these would come from actual JMX MBean queries

            return metrics;
        } catch (error) {
            console.error('Error parsing nodetool metrics:', error);
            // Return default structure with zeros
            return {
                storage: { load: 0, commitLogSize: 0, totalHints: 0, exceptions: 0 },
                clientRequest: {
                    read: { latency: { mean: 0, p95: 0, p99: 0, count: 0, meanRate: 0 }, timeouts: 0, unavailables: 0 },
                    write: { latency: { mean: 0, p95: 0, p99: 0, count: 0, meanRate: 0 }, timeouts: 0, unavailables: 0 }
                },
                cache: {
                    keyCache: { hitRate: 0, requests: 0, size: 0 },
                    rowCache: { hitRate: 0, requests: 0, size: 0 }
                },
                compaction: { pendingTasks: 0, completedTasks: 0, totalCompactionsCompleted: 0, bytesCompacted: 0 },
                threadPools: {
                    mutationStage: { activeTasks: 0, pendingTasks: 0, completedTasks: 0 },
                    readStage: { activeTasks: 0, pendingTasks: 0, completedTasks: 0 },
                    compactionExecutor: { activeTasks: 0, pendingTasks: 0, completedTasks: 0 }
                },
                memory: {
                    heapMemoryUsage: { used: 0, max: 0 },
                    nonHeapMemoryUsage: { used: 0 }
                },
                gc: {
                    youngGen: { collectionCount: 0, collectionTime: 0 },
                    oldGen: { collectionCount: 0, collectionTime: 0 }
                }
            };
        }
    }


    async getRealPerformanceMetrics(hosts) {
        try {
            // Try to get real metrics using nodetool (won't work through SSH tunnel)
            // This method should only return real data, not simulated
            return {
                success: false,
                error: 'JMX/nodetool access not available through SSH tunnel',
                source: 'unavailable'
            };
        } catch (error) {
            console.error('Error getting real performance metrics:', error);
            return {
                success: false,
                error: error.message,
                source: 'error'
            };
        }
    }

    async getClusterHealth(hosts) {
        try {
            const statusResult = await this.getNodetoolStats('status', hosts[0]);
            
            if (statusResult.success) {
                const parsedStatus = this.parseNodetoolStatus(statusResult.output);
                return {
                    success: true,
                    ...parsedStatus,
                    source: 'nodetool',
                    lastUpdate: new Date().toISOString()
                };
            } else {
                return {
                    success: false,
                    error: statusResult.error
                };
            }
        } catch (error) {
            console.error('Error getting cluster health:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Resolve JMX connection host - use localhost for SSH tunnels
    resolveJMXHost(originalHost) {
        // If SSH tunnel mode is enabled, always use localhost/127.0.0.1
        // since the SSH tunnel forwards localhost:7199 -> remote_host:7199
        if (this.useSSHTunnel) {
            return this.sshTunnelHost;
        }
        return originalHost;
    }
    
    // Test JMX connectivity to a specific host
    async testJMXConnection(host, port = 7199) {
        return new Promise((resolve) => {
            const socket = net.createConnection({ host, port }, () => {
                socket.end();
                resolve({ success: true, host, port });
            });
            
            socket.setTimeout(5000);
            socket.on('timeout', () => {
                socket.destroy();
                resolve({ success: false, host, port, error: 'Connection timeout' });
            });
            
            socket.on('error', (error) => {
                resolve({ success: false, host, port, error: error.message });
            });
        });
    }

    // Connect to native JMX endpoint
    async connectToJMX(host, port = 7199) {
        const connectionKey = `${host}:${port}`;
        
        // Resolve the actual JMX host (localhost for SSH tunnels)
        const jmxHost = this.resolveJMXHost(host);
        
        // Test basic connectivity first
        const connectTest = await this.testJMXConnection(jmxHost, port);
        if (!connectTest.success) {
            throw new Error(`Cannot connect to JMX at ${jmxHost}:${port} - ${connectTest.error}`);
        }
        
        if (this.javaInitialized) {
            try {
                // Try multiple JMX connection approaches for SSH tunnel compatibility
                // Since both RMI registry and server ports are set to 7199, use single-port URLs
                const jmxUrls = [
                    `service:jmx:rmi:///jndi/rmi://${jmxHost}:${port}/jmxrmi`,
                    `service:jmx:rmi://${jmxHost}:${port}/jndi/rmi://${jmxHost}:${port}/jmxrmi`,
                    `service:jmx:rmi://${jmxHost}/jndi/rmi://${jmxHost}:${port}/jmxrmi`
                ];
                
                let jmxConnector = null;
                let mbeanConnection = null;
                let successfulUrl = null;
                
                for (const jmxUrl of jmxUrls) {
                    try {
                        const serviceURL = new this.JMXServiceURL(jmxUrl);
                        
                        // Set connection timeout and SSH tunnel compatibility
                        const HashMap = java.import('java.util.HashMap');
                        const env = new HashMap();
                        env.put('jmx.remote.x.request.waiting.timeout', 10000); // 10 second timeout
                        env.put('jmx.remote.x.notification.fetch.timeout', 10000);
                        
                        // Set system properties for SSH tunnel compatibility
                        java.callStaticMethod('java.lang.System', 'setProperty', 'java.rmi.server.hostname', 'localhost');
                        java.callStaticMethod('java.lang.System', 'setProperty', 'com.sun.management.jmxremote.local.only', 'false');
                        
                        // Use async connection methods
                        jmxConnector = await new Promise((resolve, reject) => {
                            this.JMXConnectorFactory.connect(serviceURL, env, (err, connector) => {
                                if (err) {
                                    reject(new Error(err.message || err.toString()));
                                } else {
                                    resolve(connector);
                                }
                            });
                        });
                        
                        mbeanConnection = await new Promise((resolve, reject) => {
                            jmxConnector.getMBeanServerConnection((err, connection) => {
                                if (err) {
                                    reject(new Error(err.message || err.toString()));
                                } else {
                                    resolve(connection);
                                }
                            });
                        });
                        
                        // Test the connection by querying a basic MBean
                        const runtimeObjectName = new this.ObjectName('java.lang:type=Runtime');
                        const uptime = await new Promise((resolve, reject) => {
                            mbeanConnection.getAttribute(runtimeObjectName, 'Uptime', (err, value) => {
                                if (err) {
                                    reject(new Error(err.message || err.toString()));
                                } else {
                                    resolve(value);
                                }
                            });
                        });
                        
                        // Removed console.log for production
                        break;
                    } catch (urlError) {
                        // Continue to next URL
                    }
                }
                
                if (jmxConnector && mbeanConnection) {
                    // Store the Java JMX connection
                    this.jmxConnections.set(connectionKey, {
                        host,
                        port,
                        jmxConnector,
                        mbeanConnection,
                        connected: true,
                        type: 'java-jmx',
                        url: successfulUrl,
                        lastAccess: new Date().toISOString()
                    });
                    
                    // Removed console.log for production
                    return {
                        success: true,
                        host,
                        port,
                        connectionKey,
                        type: 'java-jmx',
                        url: successfulUrl
                    };
                } else {
                    throw new Error('All native JMX connection attempts failed');
                }
            } catch (jmxError) {
                console.warn(`Native JMX connection failed for ${host}:${port}:`, jmxError.message);
                // Removed console.log for production
            }
        }
        
        // Store basic connection info (fallback) - indicates port is reachable but JMX RMI failed
        this.jmxConnections.set(connectionKey, {
            host,
            port,
            connected: true,
            type: 'basic',
            lastAccess: new Date().toISOString(),
            warning: 'Port reachable but JMX RMI failed - likely SSH tunnel compatibility issue'
        });

        return {
            success: true,
            host,
            port,
            connectionKey,
            type: 'basic',
            warning: 'JMX RMI failed - using nodetool fallback'
        };
    }

    // Get JMX metrics by querying actual MBeans (JMX only)
    async getJMXMetrics(host, port = 7199) {
        try {
            const connectionKey = `${host}:${port}`;
            
            // Establish JMX connection if not already connected
            if (!this.jmxConnections.has(connectionKey)) {
                const connectResult = await this.connectToJMX(host, port);
                if (!connectResult.success) {
                    throw new Error(connectResult.error);
                }
            }

            // Query JMX MBeans using the established connection
            const metrics = await this.queryJMXMBeans(host, port);
            
            return {
                success: true,
                host,
                port,
                metrics,
                source: 'jmx',
                lastUpdate: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error getting JMX metrics from ${host}:${port}:`, error);
            
            return {
                success: false,
                error: error.message,
                host,
                port,
                source: 'jmx-failed'
            };
        }
    }

    // Query actual JMX MBeans using available connection (Java JMX only)
    async queryJMXMBeans(host, port) {
        const connectionKey = `${host}:${port}`;
        const connection = this.jmxConnections.get(connectionKey);
        
        if (!connection || !connection.connected) {
            throw new Error(`No JMX connection available for ${host}:${port}`);
        }
        
        // Require native JMX RMI connection for JMX tab
        if (connection.type === 'java-jmx' && connection.mbeanConnection) {
            try {
                // Query JMX MBeans for comprehensive metrics
                // Removed console.log for production
                
                // Discover all available MBeans
                // Removed console.log for production
                
                const metrics = await this.queryMBeansWithJava(connection.mbeanConnection);
                return metrics;
            } catch (error) {
                console.error(`Java JMX query failed for ${host}:${port}:`, error.message);
                throw error;
            }
        }
        
        // JMX tab requires actual JMX connection
        throw new Error(`JMX RMI connection required for ${host}:${port}. Current connection type: ${connection.type}`);
    }
    
    // Discover all available MBeans dynamically
    async discoverAvailableMBeans(mbeanConnection) {
        try {
            // Discover all available MBeans
            // Removed console.log for production
            
            const allMBeans = mbeanConnection.queryNamesSync(null, null);
            const mbeanArray = allMBeans.toArraySync();
            
            const categorizedMBeans = {
                storage: [],
                threadPools: [],
                clientRequest: [],
                cache: [],
                compaction: [],
                memory: [],
                gc: [],
                messaging: [],
                keyspaces: {},
                tables: {},
                other: []
            };
            
            // Categorize MBeans
            for (let i = 0; i < mbeanArray.length; i++) {
                const mbeanName = mbeanArray[i].toString();
                
                if (mbeanName.includes('org.apache.cassandra.metrics:type=Storage')) {
                    categorizedMBeans.storage.push(mbeanName);
                } else if (mbeanName.includes('org.apache.cassandra.metrics:type=ThreadPools')) {
                    categorizedMBeans.threadPools.push(mbeanName);
                } else if (mbeanName.includes('org.apache.cassandra.metrics:type=ClientRequest')) {
                    categorizedMBeans.clientRequest.push(mbeanName);
                } else if (mbeanName.includes('org.apache.cassandra.metrics:type=Cache')) {
                    categorizedMBeans.cache.push(mbeanName);
                } else if (mbeanName.includes('org.apache.cassandra.metrics:type=Compaction')) {
                    categorizedMBeans.compaction.push(mbeanName);
                } else if (mbeanName.includes('java.lang:type=Memory') || mbeanName.includes('java.lang:type=MemoryPool')) {
                    categorizedMBeans.memory.push(mbeanName);
                } else if (mbeanName.includes('java.lang:type=GarbageCollector')) {
                    categorizedMBeans.gc.push(mbeanName);
                } else if (mbeanName.includes('org.apache.cassandra.metrics:type=Messaging')) {
                    categorizedMBeans.messaging.push(mbeanName);
                } else if (mbeanName.includes('org.apache.cassandra.metrics:type=Keyspace')) {
                    // Extract keyspace name
                    const keyspaceMatch = mbeanName.match(/keyspace=([^,]+)/);
                    if (keyspaceMatch) {
                        const keyspace = keyspaceMatch[1];
                        if (!categorizedMBeans.keyspaces[keyspace]) {
                            categorizedMBeans.keyspaces[keyspace] = [];
                        }
                        categorizedMBeans.keyspaces[keyspace].push(mbeanName);
                    }
                } else if (mbeanName.includes('org.apache.cassandra.metrics:type=Table') || mbeanName.includes('org.apache.cassandra.metrics:type=ColumnFamily')) {
                    // Extract keyspace and table name
                    const keyspaceMatch = mbeanName.match(/keyspace=([^,]+)/);
                    const tableMatch = mbeanName.match(/scope=([^,]+)/);
                    if (keyspaceMatch && tableMatch) {
                        const keyspace = keyspaceMatch[1];
                        const table = tableMatch[1];
                        const key = `${keyspace}.${table}`;
                        if (!categorizedMBeans.tables[key]) {
                            categorizedMBeans.tables[key] = [];
                        }
                        categorizedMBeans.tables[key].push(mbeanName);
                    }
                } else if (mbeanName.includes('org.apache.cassandra')) {
                    categorizedMBeans.other.push(mbeanName);
                }
            }
            
            // Discover all available MBeans
            // Removed console.log for production
            
            return categorizedMBeans;
        } catch (error) {
            console.error('Error discovering MBeans:', error);
            return null;
        }
    }
    
    // Query MBeans using Java JMX connection - returns developer-focused metrics
    async queryMBeansWithJava(mbeanConnection) {
        try {
            // Extract developer-focused Cassandra metrics
            // Removed console.log for production
            
            // Query performance metrics
            // Removed console.log for production
            
            // Query error metrics
            // Removed console.log for production
            
            // Query resource metrics
            // Removed console.log for production
            
            // Query cache metrics
            // Removed console.log for production
            
            // Query thread pool metrics
            // Removed console.log for production
            
            // Query compaction metrics
            // Removed console.log for production
            
            // Removed console.log for production
            
            // Structure for developer-focused metrics
            const metrics = {
                // Overall cluster health assessment
                health: {
                    status: 'unknown',
                    issues: [],
                    score: null
                },
                
                // Performance metrics (most critical for developers)
                performance: {
                    readLatency: { mean: null, p95: null, p99: null, count: null },
                    writeLatency: { mean: null, p95: null, p99: null, count: null },
                    rangeQueryLatency: { mean: null, p95: null, count: null },
                    requestRate: { reads: null, writes: null, total: null }
                },
                
                // Error tracking (critical for debugging)
                errors: {
                    timeouts: { read: null, write: null, total: null },
                    unavailables: { read: null, write: null, total: null },
                    failures: { read: null, write: null, total: null },
                    exceptions: { storage: null },
                    errorRate: null
                },
                
                // Resource utilization
                resources: {
                    storage: { load: null, loadFormatted: null, exceptions: null },
                    memory: { 
                        heap: { used: null, max: null, usagePercent: null, usedFormatted: null, maxFormatted: null },
                        nonHeap: { used: null, usedFormatted: null }
                    },
                    gc: {
                        youngGen: { collections: null, time: null },
                        oldGen: { collections: null, time: null },
                        totalTime: null
                    }
                },
                
                // Cache efficiency (affects read performance)
                cache: {
                    keyCache: { hitRate: null, requests: null, hits: null, efficiency: 'unknown' },
                    rowCache: { hitRate: null, requests: null, hits: null, efficiency: 'unknown' }
                },
                
                // Thread pool health (indicates bottlenecks)
                threadPools: {
                    mutation: { active: null, pending: null, completed: null, status: 'unknown' },
                    read: { active: null, pending: null, completed: null, status: 'unknown' },
                    compaction: { active: null, pending: null, completed: null, status: 'unknown' },
                    nativeTransport: { active: null, pending: null, status: 'unknown' }
                },
                
                // Compaction and maintenance
                compaction: {
                    pendingTasks: null,
                    completedTasks: null,
                    status: 'unknown'
                },
                
                // Storage and hints
                hints: {
                    totalHints: null,
                    status: 'unknown'
                }
            };
            
            // Query developer-focused metrics
            await this.queryDeveloperMetrics(mbeanConnection, metrics);
            
            // Calculate health scores and derived metrics
            this.calculateHealthMetrics(metrics);
            
            return metrics;
        } catch (error) {
            console.error('Error querying developer metrics:', error);
            throw error;
        }
    }
    
    // Query the most important metrics for developers
    async queryDeveloperMetrics(mbeanConnection, metrics) {
        try {
            // 1. Performance Metrics (CRITICAL)
            // Removed console.log for production
            
            // Read latency
            await this.queryLatencyMetric(mbeanConnection, 
                'org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Latency',
                metrics.performance.readLatency);
                
            // Write latency
            await this.queryLatencyMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Latency', 
                metrics.performance.writeLatency);
                
            // Range query latency
            await this.queryLatencyMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=ClientRequest,scope=RangeSlice,name=Latency',
                metrics.performance.rangeQueryLatency);
            
            // 2. Error Metrics (CRITICAL for debugging)
            // Removed console.log for production
            
            metrics.errors.timeouts.read = await this.queryCountMetric(mbeanConnection, 
                'org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Timeouts');
            metrics.errors.timeouts.write = await this.queryCountMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Timeouts');
            metrics.errors.unavailables.read = await this.queryCountMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Unavailables');
            metrics.errors.unavailables.write = await this.queryCountMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Unavailables');
            metrics.errors.failures.read = await this.queryCountMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Failures');
            metrics.errors.failures.write = await this.queryCountMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Failures');
            metrics.errors.exceptions.storage = await this.queryCountMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=Storage,name=Exceptions');
                
            // 3. Resource Metrics
            // Removed console.log for production
            
            // Storage load
            metrics.resources.storage.load = await this.queryCountMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=Storage,name=Load');
                
            // Memory metrics (special handling for CompositeData)
            await this.queryMemoryMetrics(mbeanConnection, metrics.resources.memory);
            
            // GC metrics
            metrics.resources.gc.youngGen.collections = await this.querySimpleAttribute(mbeanConnection,
                'java.lang:type=GarbageCollector,name=G1 Young Generation', 'CollectionCount');
            metrics.resources.gc.youngGen.time = await this.querySimpleAttribute(mbeanConnection,
                'java.lang:type=GarbageCollector,name=G1 Young Generation', 'CollectionTime');
            metrics.resources.gc.oldGen.collections = await this.querySimpleAttribute(mbeanConnection,
                'java.lang:type=GarbageCollector,name=G1 Old Generation', 'CollectionCount');
            metrics.resources.gc.oldGen.time = await this.querySimpleAttribute(mbeanConnection,
                'java.lang:type=GarbageCollector,name=G1 Old Generation', 'CollectionTime');
            
            // 4. Cache Metrics
            // Removed console.log for production
            
            metrics.cache.keyCache.hitRate = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=Cache,scope=KeyCache,name=HitRate', 'Value');
            metrics.cache.keyCache.requests = await this.queryCountMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=Cache,scope=KeyCache,name=Requests');
            metrics.cache.rowCache.hitRate = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=Cache,scope=RowCache,name=HitRate', 'Value');
            metrics.cache.rowCache.requests = await this.queryCountMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=Cache,scope=RowCache,name=Requests');
            
            // 5. Thread Pool Metrics
            // Removed console.log for production
            
            // Mutation stage
            metrics.threadPools.mutation.active = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=MutationStage,name=ActiveTasks', 'Value');
            metrics.threadPools.mutation.pending = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=MutationStage,name=PendingTasks', 'Value');
            metrics.threadPools.mutation.completed = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=MutationStage,name=CompletedTasks', 'Value');
                
            // Read stage
            metrics.threadPools.read.active = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=ReadStage,name=ActiveTasks', 'Value');
            metrics.threadPools.read.pending = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=ReadStage,name=PendingTasks', 'Value');
            metrics.threadPools.read.completed = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=ReadStage,name=CompletedTasks', 'Value');
                
            // Compaction executor
            metrics.threadPools.compaction.active = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=ThreadPools,path=internal,scope=CompactionExecutor,name=ActiveTasks', 'Value');
            metrics.threadPools.compaction.pending = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=ThreadPools,path=internal,scope=CompactionExecutor,name=PendingTasks', 'Value');
            metrics.threadPools.compaction.completed = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=ThreadPools,path=internal,scope=CompactionExecutor,name=CompletedTasks', 'Value');
                
            // Native transport
            metrics.threadPools.nativeTransport.active = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=ThreadPools,path=transport,scope=Native-Transport-Requests,name=ActiveTasks', 'Value');
            metrics.threadPools.nativeTransport.pending = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=ThreadPools,path=transport,scope=Native-Transport-Requests,name=PendingTasks', 'Value');
            
            // 6. Compaction and Maintenance
            // Removed console.log for production
            
            metrics.compaction.pendingTasks = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=Compaction,name=PendingTasks', 'Value');
            metrics.compaction.completedTasks = await this.querySimpleAttribute(mbeanConnection,
                'org.apache.cassandra.metrics:type=Compaction,name=CompletedTasks', 'Value');
                
            // 7. Hints
            metrics.hints.totalHints = await this.queryCountMetric(mbeanConnection,
                'org.apache.cassandra.metrics:type=Storage,name=TotalHints');
            
        } catch (error) {
            console.warn('Error querying developer metrics:', error.message);
        }
    }
    
    // Query latency metrics with percentiles and rate
    async queryLatencyMetric(mbeanConnection, mbeanName, target) {
        try {
            const objectName = new this.ObjectName(mbeanName);
            
            const meanValue = await new Promise((resolve, reject) => {
                mbeanConnection.getAttribute(objectName, 'Mean', (err, value) => {
                    if (err) reject(err);
                    else resolve(value);
                });
            });
            
            const p95Value = await new Promise((resolve, reject) => {
                mbeanConnection.getAttribute(objectName, '95thPercentile', (err, value) => {
                    if (err) reject(err);
                    else resolve(value);
                });
            });
            
            const p99Value = await new Promise((resolve, reject) => {
                mbeanConnection.getAttribute(objectName, '99thPercentile', (err, value) => {
                    if (err) reject(err);
                    else resolve(value);
                });
            });
            
            const countValue = await new Promise((resolve, reject) => {
                mbeanConnection.getAttribute(objectName, 'Count', (err, value) => {
                    if (err) reject(err);
                    else resolve(value);
                });
            });
            
            // Query OneMinuteRate for actual throughput (ops/sec)
            const oneMinuteRateValue = await new Promise((resolve, reject) => {
                mbeanConnection.getAttribute(objectName, 'OneMinuteRate', (err, value) => {
                    if (err) reject(err);
                    else resolve(value);
                });
            });
            
            const convertedMean = this.convertJavaValue(meanValue);
            const convertedP95 = this.convertJavaValue(p95Value);
            const convertedP99 = this.convertJavaValue(p99Value);
            const convertedCount = this.convertJavaValue(countValue);
            const convertedRate = this.convertJavaValue(oneMinuteRateValue);
            
            target.mean = convertedMean !== null ? convertedMean / 1000 : null; // Convert to ms
            target.p95 = convertedP95 !== null ? convertedP95 / 1000 : null;
            target.p99 = convertedP99 !== null ? convertedP99 / 1000 : null;
            target.count = convertedCount;
            target.oneMinuteRate = convertedRate; // ops/sec
            
        } catch (error) {
            console.warn(`Failed to query latency metric ${mbeanName}:`, error.message);
            target.mean = null;
            target.p95 = null;
            target.p99 = null;
            target.count = null;
            target.oneMinuteRate = null;
        }
    }
    
    // Query count-based metrics
    async queryCountMetric(mbeanConnection, mbeanName) {
        try {
            const objectName = new this.ObjectName(mbeanName);
            const value = await new Promise((resolve, reject) => {
                mbeanConnection.getAttribute(objectName, 'Count', (err, value) => {
                    if (err) reject(err);
                    else resolve(value);
                });
            });
            return this.convertJavaValue(value);
        } catch (error) {
            console.warn(`Failed to query count metric ${mbeanName}:`, error.message);
            return null;
        }
    }
    
    // Query simple attribute
    async querySimpleAttribute(mbeanConnection, mbeanName, attribute) {
        try {
            const objectName = new this.ObjectName(mbeanName);
            const value = await new Promise((resolve, reject) => {
                mbeanConnection.getAttribute(objectName, attribute, (err, value) => {
                    if (err) reject(err);
                    else resolve(value);
                });
            });
            return this.convertJavaValue(value);
        } catch (error) {
            console.warn(`Failed to query ${mbeanName}.${attribute}:`, error.message);
            return null;
        }
    }
    
    // Query memory metrics (special handling for CompositeData)
    async queryMemoryMetrics(mbeanConnection, memoryTarget) {
        try {
            const memoryObjectName = new this.ObjectName('java.lang:type=Memory');
            
            const heapMemoryUsage = await new Promise((resolve, reject) => {
                mbeanConnection.getAttribute(memoryObjectName, 'HeapMemoryUsage', (err, value) => {
                    if (err) reject(err);
                    else resolve(value);
                });
            });
            
            const nonHeapMemoryUsage = await new Promise((resolve, reject) => {
                mbeanConnection.getAttribute(memoryObjectName, 'NonHeapMemoryUsage', (err, value) => {
                    if (err) reject(err);
                    else resolve(value);
                });
            });
            
            if (heapMemoryUsage && heapMemoryUsage.getSync) {
                memoryTarget.heap.used = heapMemoryUsage.getSync('used');
                memoryTarget.heap.max = heapMemoryUsage.getSync('max');
                memoryTarget.heap.usagePercent = Math.round((memoryTarget.heap.used / memoryTarget.heap.max) * 100);
                memoryTarget.heap.usedFormatted = this.formatBytes(memoryTarget.heap.used);
                memoryTarget.heap.maxFormatted = this.formatBytes(memoryTarget.heap.max);
            }
            
            if (nonHeapMemoryUsage && nonHeapMemoryUsage.getSync) {
                memoryTarget.nonHeap.used = nonHeapMemoryUsage.getSync('used');
                memoryTarget.nonHeap.usedFormatted = this.formatBytes(memoryTarget.nonHeap.used);
            }
            
        } catch (error) {
            console.warn('Failed to query memory metrics:', error.message);
        }
    }
    
    // Convert Java values to JavaScript
    convertJavaValue(value) {
        if (value === null || value === undefined) return null;
        
        if (typeof value === 'object') {
            if (value.longValue !== undefined) {
                return parseInt(value.longValue);
            } else if (value.doubleValue !== undefined) {
                return parseFloat(value.doubleValue);
            } else if (value.intValue !== undefined) {
                return parseInt(value.intValue);
            }
        }
        
        return typeof value === 'number' ? value : null;
    }
    
    // Safely extract numeric values with type checking to prevent iteration errors
    safeGetNumericValue(value) {
        try {
            if (value === null || value === undefined) return null;
            
            // Handle potential Java objects that might be returned
            if (typeof value === 'object') {
                // Check if it's a Java Number wrapper
                if (value.longValue !== undefined) {
                    return parseInt(value.longValue);
                } else if (value.doubleValue !== undefined) {
                    return parseFloat(value.doubleValue);
                } else if (value.intValue !== undefined) {
                    return parseInt(value.intValue);
                }
                
                // If it's some other object type, don't try to iterate over it
                console.warn('Unexpected object type in thread pool metric:', typeof value, value.constructor?.name);
                return null;
            }
            
            // Handle primitive numbers
            if (typeof value === 'number' && !isNaN(value)) {
                return value;
            }
            
            // Try to parse strings as numbers
            if (typeof value === 'string') {
                const parsed = parseFloat(value);
                return !isNaN(parsed) ? parsed : null;
            }
            
            return null;
        } catch (error) {
            console.warn('Error in safeGetNumericValue:', error.message);
            return null;
        }
    }
    
    // Calculate health metrics and derived values
    calculateHealthMetrics(metrics) {
        // Calculate error totals - only if we have data
        const readTimeouts = metrics.errors.timeouts.read;
        const writeTimeouts = metrics.errors.timeouts.write;
        const readUnavailables = metrics.errors.unavailables.read;
        const writeUnavailables = metrics.errors.unavailables.write;
        const readFailures = metrics.errors.failures.read;
        const writeFailures = metrics.errors.failures.write;
        
        metrics.errors.timeouts.total = (readTimeouts !== null && writeTimeouts !== null) ? 
            readTimeouts + writeTimeouts : null;
        metrics.errors.unavailables.total = (readUnavailables !== null && writeUnavailables !== null) ? 
            readUnavailables + writeUnavailables : null;
        metrics.errors.failures.total = (readFailures !== null && writeFailures !== null) ? 
            readFailures + writeFailures : null;
        
        // Calculate request rate using OneMinuteRate (ops/sec)
        const readRate = metrics.performance.readLatency.oneMinuteRate;
        const writeRate = metrics.performance.writeLatency.oneMinuteRate;
        metrics.performance.requestRate.reads = readRate;
        metrics.performance.requestRate.writes = writeRate;
        metrics.performance.requestRate.total = (readRate !== null && writeRate !== null) ? 
            readRate + writeRate : null;
        
        // Calculate error rate
        const timeoutsTotal = metrics.errors.timeouts.total;
        const unavailablesTotal = metrics.errors.unavailables.total;
        const failuresTotal = metrics.errors.failures.total;
        const totalOps = metrics.performance.requestRate.total;
        
        if (timeoutsTotal !== null && unavailablesTotal !== null && failuresTotal !== null && totalOps !== null) {
            const totalErrors = timeoutsTotal + unavailablesTotal + failuresTotal;
            metrics.errors.errorRate = totalOps > 0 ? (totalErrors / totalOps) * 100 : 0;
        } else {
            metrics.errors.errorRate = null;
        }
        
        // Format storage load
        metrics.resources.storage.loadFormatted = metrics.resources.storage.load !== null ? 
            this.formatBytes(metrics.resources.storage.load) : null;
        
        // Calculate GC total time
        const youngGenTime = metrics.resources.gc.youngGen.time;
        const oldGenTime = metrics.resources.gc.oldGen.time;
        metrics.resources.gc.totalTime = (youngGenTime !== null && oldGenTime !== null) ? 
            youngGenTime + oldGenTime : null;
        
        // Calculate cache hits
        const keyCacheHitRate = metrics.cache.keyCache.hitRate;
        const keyCacheRequests = metrics.cache.keyCache.requests;
        const rowCacheHitRate = metrics.cache.rowCache.hitRate;
        const rowCacheRequests = metrics.cache.rowCache.requests;
        
        metrics.cache.keyCache.hits = (keyCacheHitRate !== null && keyCacheRequests !== null) ? 
            Math.round(keyCacheHitRate * keyCacheRequests) : null;
        metrics.cache.rowCache.hits = (rowCacheHitRate !== null && rowCacheRequests !== null) ? 
            Math.round(rowCacheHitRate * rowCacheRequests) : null;
        
        // Assess cache efficiency
        metrics.cache.keyCache.efficiency = keyCacheHitRate !== null ? 
            this.assessCacheEfficiency(keyCacheHitRate) : 'unknown';
        metrics.cache.rowCache.efficiency = rowCacheHitRate !== null ? 
            this.assessCacheEfficiency(rowCacheHitRate) : 'unknown';
        
        // Assess thread pool health
        ['mutation', 'read', 'compaction'].forEach(pool => {
            const pending = metrics.threadPools[pool].pending;
            metrics.threadPools[pool].status = pending !== null ? 
                this.assessThreadPoolHealth(pending) : 'unknown';
        });
        
        const nativeTransportPending = metrics.threadPools.nativeTransport.pending;
        metrics.threadPools.nativeTransport.status = nativeTransportPending !== null ? 
            this.assessThreadPoolHealth(nativeTransportPending) : 'unknown';
        
        // Assess compaction health
        const compactionPending = metrics.compaction.pendingTasks;
        if (compactionPending !== null) {
            metrics.compaction.status = compactionPending > 20 ? 'behind' : 
                                       compactionPending > 5 ? 'active' : 'current';
        } else {
            metrics.compaction.status = 'unknown';
        }
        
        // Assess hints health
        const totalHints = metrics.hints.totalHints;
        if (totalHints !== null) {
            metrics.hints.status = totalHints > 1000 ? 'high' :
                                  totalHints > 100 ? 'moderate' : 'low';
        } else {
            metrics.hints.status = 'unknown';
        }
        
        // Overall health assessment - only if we have sufficient data
        const issues = [];
        let healthScore = 100;
        let hasValidData = false;
        
        // Deduct points for various issues - only check if data is available
        const errorRate = metrics.errors.errorRate;
        if (errorRate !== null) {
            hasValidData = true;
            if (errorRate > 5) {
                issues.push(`🚨 High error rate: ${errorRate.toFixed(2)}%`);
                healthScore -= 30;
            } else if (errorRate > 1) {
                issues.push(`⚠️ Elevated error rate: ${errorRate.toFixed(2)}%`);
                healthScore -= 10;
            }
        }
        
        const memoryUsagePercent = metrics.resources.memory.heap.usagePercent;
        if (memoryUsagePercent !== null) {
            hasValidData = true;
            if (memoryUsagePercent > 90) {
                issues.push(`🚨 Critical memory usage: ${memoryUsagePercent}%`);
                healthScore -= 25;
            } else if (memoryUsagePercent > 80) {
                issues.push(`⚠️ High memory usage: ${memoryUsagePercent}%`);
                healthScore -= 10;
            }
        }
        
        const readLatency = metrics.performance.readLatency.mean;
        if (readLatency !== null) {
            hasValidData = true;
            if (readLatency > 50) {
                issues.push(`🐌 Slow read latency: ${readLatency.toFixed(1)}ms`);
                healthScore -= 20;
            } else if (readLatency > 20) {
                issues.push(`⚠️ Elevated read latency: ${readLatency.toFixed(1)}ms`);
                healthScore -= 10;
            }
        }
        
        const writeLatency = metrics.performance.writeLatency.mean;
        if (writeLatency !== null) {
            hasValidData = true;
            if (writeLatency > 50) {
                issues.push(`🐌 Slow write latency: ${writeLatency.toFixed(1)}ms`);
                healthScore -= 20;
            } else if (writeLatency > 20) {
                issues.push(`⚠️ Elevated write latency: ${writeLatency.toFixed(1)}ms`);
                healthScore -= 10;
            }
        }
        
        // Thread pool issues
        Object.entries(metrics.threadPools).forEach(([poolName, pool]) => {
            if (pool.pending !== null) {
                hasValidData = true;
                if (pool.status === 'overloaded') {
                    issues.push(`🚨 ${poolName} thread pool overloaded (${pool.pending} pending)`);
                    healthScore -= 20;
                } else if (pool.status === 'busy') {
                    issues.push(`⚠️ ${poolName} thread pool busy (${pool.pending} pending)`);
                    healthScore -= 5;
                }
            }
        });
        
        // Cache efficiency issues
        const cacheKeyCacheRequests = metrics.cache.keyCache.requests;
        const cacheKeyCacheHitRate = metrics.cache.keyCache.hitRate;
        if (cacheKeyCacheRequests !== null && cacheKeyCacheRequests > 1000 && 
            cacheKeyCacheHitRate !== null && metrics.cache.keyCache.efficiency === 'poor') {
            hasValidData = true;
            issues.push(`📉 Poor key cache efficiency: ${(cacheKeyCacheHitRate * 100).toFixed(1)}%`);
            healthScore -= 15;
        }
        
        if (compactionPending !== null && metrics.compaction.status === 'behind') {
            hasValidData = true;
            issues.push(`🔄 Compaction falling behind: ${compactionPending} pending`);
            healthScore -= 15;
        }
        
        if (totalHints !== null && metrics.hints.status === 'high') {
            hasValidData = true;
            issues.push(`📮 High hints count: ${totalHints}`);
            healthScore -= 10;
        }
        
        metrics.health.issues = issues;
        
        if (hasValidData) {
            metrics.health.score = Math.max(0, healthScore);
            metrics.health.status = healthScore >= 90 ? 'healthy' :
                                   healthScore >= 70 ? 'warning' :
                                   healthScore >= 50 ? 'degraded' : 'critical';
        } else {
            metrics.health.score = null;
            metrics.health.status = 'unknown';
            metrics.health.issues = ['⚠️ Insufficient metric data for health assessment'];
        }
    }
    
    // Assess cache efficiency
    assessCacheEfficiency(hitRate) {
        if (hitRate > 0.95) return 'excellent';
        if (hitRate > 0.85) return 'good';
        if (hitRate > 0.70) return 'fair';
        return 'poor';
    }
    
    // Assess thread pool health
    assessThreadPoolHealth(pendingTasks) {
        if (pendingTasks > 100) return 'overloaded';
        if (pendingTasks > 50) return 'busy';
        if (pendingTasks > 10) return 'moderate';
        return 'healthy';
    }
    
    // Format bytes to human readable
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Sample attributes from categorized MBeans
    async sampleMBeanAttributes(mbeanConnection, availableMBeans, metrics) {
        try {
            // Sample storage MBeans
            // Removed console.log for production
            for (const mbeanName of availableMBeans.storage.slice(0, 5)) {
                await this.sampleMBeanInfo(mbeanConnection, mbeanName, 'storage');
            }
            
            // Sample threadpool MBeans
            // Removed console.log for production
            for (const mbeanName of availableMBeans.threadPools.slice(0, 5)) {
                await this.sampleMBeanInfo(mbeanConnection, mbeanName, 'threadPools');
            }
            
            // Sample client request MBeans
            // Removed console.log for production
            for (const mbeanName of availableMBeans.clientRequest.slice(0, 5)) {
                await this.sampleMBeanInfo(mbeanConnection, mbeanName, 'clientRequest');
            }
            
            // Sample cache MBeans
            // Removed console.log for production
            for (const mbeanName of availableMBeans.cache.slice(0, 5)) {
                await this.sampleMBeanInfo(mbeanConnection, mbeanName, 'cache');
            }
            
            // Sample compaction MBeans
            // Removed console.log for production
            for (const mbeanName of availableMBeans.compaction.slice(0, 5)) {
                await this.sampleMBeanInfo(mbeanConnection, mbeanName, 'compaction');
            }
            
            // Sample memory MBeans
            // Removed console.log for production
            for (const mbeanName of availableMBeans.memory.slice(0, 3)) {
                await this.sampleMBeanInfo(mbeanConnection, mbeanName, 'memory');
            }
            
            // Sample GC MBeans
            // Removed console.log for production
            for (const mbeanName of availableMBeans.gc.slice(0, 3)) {
                await this.sampleMBeanInfo(mbeanConnection, mbeanName, 'gc');
            }
            
            // Sample a few keyspace MBeans
            // Removed console.log for production
            const keyspaceNames = Object.keys(availableMBeans.keyspaces).slice(0, 3);
            for (const keyspace of keyspaceNames) {
                for (const mbeanName of availableMBeans.keyspaces[keyspace].slice(0, 2)) {
                    await this.sampleMBeanInfo(mbeanConnection, mbeanName, `keyspaces.${keyspace}`);
                }
            }
            
            // Sample a few table MBeans
            // Removed console.log for production
            const tableNames = Object.keys(availableMBeans.tables).slice(0, 3);
            for (const table of tableNames) {
                for (const mbeanName of availableMBeans.tables[table].slice(0, 2)) {
                    await this.sampleMBeanInfo(mbeanConnection, mbeanName, `tables.${table}`);
                }
            }
            
        } catch (error) {
            console.error('Error sampling MBean attributes:', error);
        }
    }
    
    // Sample information from a specific MBean
    async sampleMBeanInfo(mbeanConnection, mbeanName, category) {
        try {
            const objectName = new this.ObjectName(mbeanName);
            const mbeanInfo = mbeanConnection.getMBeanInfoSync(objectName);
            const attributes = mbeanInfo.getAttributesSync();
            
            // Removed console.log for production
            // Removed console.log for production
            
            // Sample a few attribute values
            for (let i = 0; i < Math.min(5, attributes.lengthSync); i++) {
                try {
                    const attr = attributes[i];
                    const attrName = attr.getNameSync();
                    const attrType = attr.getTypeSync();
                    
                    try {
                        const value = mbeanConnection.getAttributeSync(objectName, attrName);
                        let displayValue = value;
                        
                        // Handle Java objects
                        if (value && typeof value === 'object') {
                            if (value.longValue !== undefined) {
                                displayValue = value.longValue;
                            } else if (value.doubleValue !== undefined) {
                                displayValue = value.doubleValue;
                            } else if (value.intValue !== undefined) {
                                displayValue = value.intValue;
                            } else if (value.getSync) {
                                // CompositeData - try to get a few properties
                                try {
                                    const compositeData = value;
                                    const keys = compositeData.getCompositeTypeSync().keySetSync();
                                    const keyArray = keys.toArraySync();
                                    const sampleProps = keyArray.slice(0, 3).map(key => {
                                        try {
                                            return `${key}=${compositeData.getSync(key)}`;
                                        } catch (e) {
                                            return `${key}=[error]`;
                                        }
                                    });
                                    displayValue = `{${sampleProps.join(', ')}}`;
                                } catch (e) {
                                    displayValue = '[CompositeData]';
                                }
                            } else {
                                displayValue = '[Java Object]';
                            }
                        }
                        
                        // Removed console.log for production
                    } catch (attrError) {
                        // Removed console.log for production
                    }
                } catch (attrAccessError) {
                    // Removed console.log for production
                }
            }
        } catch (error) {
            console.error(`Error sampling MBean ${mbeanName}:`, error);
        }
    }
    
    // Helper method to set nested values in metrics object
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in current)) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        const finalKey = keys[keys.length - 1];
        
        // Convert Java objects to JavaScript primitives
        let convertedValue = value;
        
        if (value && typeof value === 'object') {
            // Handle Java Number objects (like storage load)
            if (value.longValue !== undefined) {
                convertedValue = parseInt(value.longValue);
            } else if (value.doubleValue !== undefined) {
                convertedValue = parseFloat(value.doubleValue);
            } else if (value.intValue !== undefined) {
                convertedValue = parseInt(value.intValue);
            }
            // Handle CompositeData for memory (already handled separately)
            else if (path.includes('memory') && (path.includes('HeapMemoryUsage') || path.includes('NonHeapMemoryUsage'))) {
                current[finalKey] = {
                    used: value.used || 0,
                    max: value.max || 0,
                    committed: value.committed || 0
                };
                return;
            }
            else {
                // For other complex objects, try to convert to string and parse
                convertedValue = value.toString ? value.toString() : value;
            }
        }
        
        current[finalKey] = convertedValue || 0;
    }

    // Fallback method using nodetool when JMX is not available
    async getMetricsViaNodetool(host, port, jmxError) {
        try {
            // Get basic metrics using nodetool commands
            const [info, tpstats, compactionstats] = await Promise.allSettled([
                this.getNodetoolStats('info', host),
                this.getNodetoolStats('tpstats', host),
                this.getNodetoolStats('compactionstats', host)
            ]);

            // Parse the results with real nodetool data
            const parsedMetrics = this.parseNodetoolMetrics({
                info: info.status === 'fulfilled' ? info.value : null,
                tpstats: tpstats.status === 'fulfilled' ? tpstats.value : null,
                compactionstats: compactionstats.status === 'fulfilled' ? compactionstats.value : null
            });

            return {
                success: true,
                host,
                port,
                metrics: parsedMetrics,
                source: 'nodetool-fallback',
                jmxError,
                lastUpdate: new Date().toISOString(),
                warning: 'Using nodetool fallback - JMX access recommended for full metrics'
            };
            
        } catch (nodetoolError) {
            return {
                success: false,
                error: `Both JMX and nodetool failed. JMX: ${jmxError}, Nodetool: ${nodetoolError.message}`,
                host,
                port
            };
        }
    }

    // Get all available MBeans from a host
    async listMBeans(host, port = 7199) {
        try {
            const connectionKey = `${host}:${port}`;
            
            if (!this.jmxConnections.has(connectionKey)) {
                const connectResult = await this.connectToJMX(host, port);
                if (!connectResult.success) {
                    throw new Error(connectResult.error);
                }
            }

            // Return the typical Cassandra MBeans that would be available
            const mbeans = {
                host,
                port,
                categories: {
                    storage: [
                        'org.apache.cassandra.metrics:type=Storage,name=Load',
                        'org.apache.cassandra.metrics:type=Storage,name=Exceptions',
                        'org.apache.cassandra.metrics:type=CommitLog,name=PendingTasks',
                        'org.apache.cassandra.metrics:type=CommitLog,name=TotalCommitLogSize'
                    ],
                    clientRequest: [
                        'org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Latency',
                        'org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Latency',
                        'org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Timeouts',
                        'org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Timeouts',
                        'org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Unavailables',
                        'org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Unavailables'
                    ],
                    cache: [
                        'org.apache.cassandra.metrics:type=Cache,scope=KeyCache,name=HitRate',
                        'org.apache.cassandra.metrics:type=Cache,scope=KeyCache,name=Requests',
                        'org.apache.cassandra.metrics:type=Cache,scope=KeyCache,name=Size',
                        'org.apache.cassandra.metrics:type=Cache,scope=RowCache,name=HitRate',
                        'org.apache.cassandra.metrics:type=Cache,scope=RowCache,name=Requests',
                        'org.apache.cassandra.metrics:type=Cache,scope=RowCache,name=Size'
                    ],
                    compaction: [
                        'org.apache.cassandra.metrics:type=Compaction,name=PendingTasks',
                        'org.apache.cassandra.metrics:type=Compaction,name=CompletedTasks',
                        'org.apache.cassandra.metrics:type=Compaction,name=TotalCompactionsCompleted',
                        'org.apache.cassandra.metrics:type=Compaction,name=BytesCompacted'
                    ],
                    threadPools: [
                        'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=MutationStage,name=ActiveTasks',
                        'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=MutationStage,name=PendingTasks',
                        'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=MutationStage,name=CompletedTasks',
                        'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=ReadStage,name=ActiveTasks',
                        'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=ReadStage,name=PendingTasks',
                        'org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=ReadStage,name=CompletedTasks',
                        'org.apache.cassandra.metrics:type=ThreadPools,path=internal,scope=CompactionExecutor,name=ActiveTasks',
                        'org.apache.cassandra.metrics:type=ThreadPools,path=internal,scope=CompactionExecutor,name=PendingTasks',
                        'org.apache.cassandra.metrics:type=ThreadPools,path=internal,scope=CompactionExecutor,name=CompletedTasks'
                    ],
                    gc: [
                        'java.lang:type=GarbageCollector,name=G1 Young Generation',
                        'java.lang:type=GarbageCollector,name=G1 Old Generation'
                    ],
                    memory: [
                        'java.lang:type=Memory',
                        'java.lang:type=MemoryPool,name=G1 Eden Space',
                        'java.lang:type=MemoryPool,name=G1 Old Gen',
                        'java.lang:type=MemoryPool,name=G1 Survivor Space'
                    ]
                },
                totalMBeans: 50, // Approximate count
                lastUpdate: new Date().toISOString()
            };

            return mbeans;
        } catch (error) {
            console.error('Error listing MBeans:', error);
            return {
                success: false,
                error: error.message,
                host,
                port
            };
        }
    }

    // Get metrics for multiple nodes
    async getClusterJMXMetrics(hosts) {
        try {
            const results = await Promise.allSettled(
                hosts.map(host => this.getJMXMetrics(host))
            );

            const nodeMetrics = [];
            const errors = [];

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value && result.value.success && result.value.metrics) {
                    nodeMetrics.push(result.value);
                } else {
                    const errorMsg = result.status === 'fulfilled' ? 
                        result.value?.error || 'Failed to get metrics' : 
                        result.reason?.message || 'Unknown error';
                    errors.push({
                        host: hosts[index],
                        error: errorMsg
                    });
                }
            });

            return {
                success: true,
                nodes: nodeMetrics,
                errors,
                totalNodes: hosts.length,
                successfulNodes: nodeMetrics.length,
                lastUpdate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting cluster JMX metrics:', error);
            return {
                success: false,
                error: error.message,
                nodes: [],
                errors: [],
                totalNodes: 0,
                successfulNodes: 0
            };
        }
    }

    // Get aggregated cluster-wide metrics
    async getAggregatedMetrics(hosts) {
        try {
            const clusterMetrics = await this.getClusterJMXMetrics(hosts);
            
            if (!clusterMetrics.success || clusterMetrics.nodes.length === 0) {
                return {
                    success: false,
                    error: 'No JMX data available from cluster nodes'
                };
            }

            // Aggregate metrics across all nodes - initialize with null values
            const aggregated = {
                storage: {
                    totalLoad: null,
                    totalCommitLogSize: null,
                    totalHints: null
                },
                performance: {
                    readLatency: { count: null, totalRate: null },
                    writeLatency: { count: null, totalRate: null },
                    totalTimeouts: null,
                    totalUnavailables: null
                },
                cache: {
                    keyCache: { totalHits: null, totalRequests: null, totalSize: null },
                    rowCache: { totalHits: null, totalRequests: null, totalSize: null }
                },
                compaction: {
                    totalPendingTasks: null,
                    totalCompletedTasks: null,
                    totalBytesCompacted: null
                },
                threadPools: {
                    totalActiveThreads: null,
                    totalPendingTasks: null,
                    totalCompletedTasks: null
                },
                memory: {
                    totalHeapUsed: null,
                    totalHeapMax: null,
                    totalNonHeapUsed: null
                }
            };

            // Collect valid values for aggregation
            const validValues = {
                storage: { loads: [], hints: [] },
                performance: { 
                    readCounts: [], writeCounts: [], 
                    readRates: [], writeRates: [],
                    readTimeouts: [], writeTimeouts: [],
                    readUnavailables: [], writeUnavailables: []
                },
                cache: { 
                    keyCacheRequests: [], rowCacheRequests: []
                },
                compaction: { pendingTasks: [], completedTasks: [] },
                threadPools: { activeThreads: [], pendingTasks: [], completedTasks: [] },
                memory: { heapUsed: [], heapMax: [], nonHeapUsed: [] }
            };

            // Collect valid values from all nodes
            clusterMetrics.nodes.forEach(node => {
                const metrics = node.metrics;
                
                // Storage aggregation - only include non-null values
                if (metrics.resources?.storage?.load !== null) {
                    validValues.storage.loads.push(metrics.resources.storage.load);
                }
                if (metrics.hints?.totalHints !== null) {
                    validValues.storage.hints.push(metrics.hints.totalHints);
                }
                
                // Performance aggregation - only include non-null values
                if (metrics.performance?.readLatency?.count !== null) {
                    validValues.performance.readCounts.push(metrics.performance.readLatency.count);
                }
                if (metrics.performance?.writeLatency?.count !== null) {
                    validValues.performance.writeCounts.push(metrics.performance.writeLatency.count);
                }
                if (metrics.performance?.readLatency?.oneMinuteRate !== null) {
                    validValues.performance.readRates.push(metrics.performance.readLatency.oneMinuteRate);
                }
                if (metrics.performance?.writeLatency?.oneMinuteRate !== null) {
                    validValues.performance.writeRates.push(metrics.performance.writeLatency.oneMinuteRate);
                }
                if (metrics.errors?.timeouts?.read !== null) {
                    validValues.performance.readTimeouts.push(metrics.errors.timeouts.read);
                }
                if (metrics.errors?.timeouts?.write !== null) {
                    validValues.performance.writeTimeouts.push(metrics.errors.timeouts.write);
                }
                if (metrics.errors?.unavailables?.read !== null) {
                    validValues.performance.readUnavailables.push(metrics.errors.unavailables.read);
                }
                if (metrics.errors?.unavailables?.write !== null) {
                    validValues.performance.writeUnavailables.push(metrics.errors.unavailables.write);
                }
                
                // Cache aggregation - only include non-null values
                if (metrics.cache?.keyCache?.requests !== null) {
                    validValues.cache.keyCacheRequests.push(metrics.cache.keyCache.requests);
                }
                if (metrics.cache?.rowCache?.requests !== null) {
                    validValues.cache.rowCacheRequests.push(metrics.cache.rowCache.requests);
                }
                
                // Compaction aggregation - only include non-null values
                if (metrics.compaction?.pendingTasks !== null) {
                    validValues.compaction.pendingTasks.push(metrics.compaction.pendingTasks);
                }
                if (metrics.compaction?.completedTasks !== null) {
                    validValues.compaction.completedTasks.push(metrics.compaction.completedTasks);
                }
                
                // Thread pools aggregation - only include non-null values with type checking
                const activeValues = [
                    this.safeGetNumericValue(metrics.threadPools?.mutation?.active),
                    this.safeGetNumericValue(metrics.threadPools?.read?.active),
                    this.safeGetNumericValue(metrics.threadPools?.compaction?.active)
                ].filter(val => val !== null && typeof val === 'number');
                
                const pendingValues = [
                    this.safeGetNumericValue(metrics.threadPools?.mutation?.pending),
                    this.safeGetNumericValue(metrics.threadPools?.read?.pending),
                    this.safeGetNumericValue(metrics.threadPools?.compaction?.pending)
                ].filter(val => val !== null && typeof val === 'number');
                
                const completedValues = [
                    this.safeGetNumericValue(metrics.threadPools?.mutation?.completed),
                    this.safeGetNumericValue(metrics.threadPools?.read?.completed),
                    this.safeGetNumericValue(metrics.threadPools?.compaction?.completed)
                ].filter(val => val !== null && typeof val === 'number');
                
                if (activeValues.length > 0) {
                    validValues.threadPools.activeThreads.push(activeValues.reduce((sum, val) => sum + val, 0));
                }
                if (pendingValues.length > 0) {
                    validValues.threadPools.pendingTasks.push(pendingValues.reduce((sum, val) => sum + val, 0));
                }
                if (completedValues.length > 0) {
                    validValues.threadPools.completedTasks.push(completedValues.reduce((sum, val) => sum + val, 0));
                }
                
                // Memory aggregation - only include non-null values
                if (metrics.resources?.memory?.heap?.used !== null) {
                    validValues.memory.heapUsed.push(metrics.resources.memory.heap.used);
                }
                if (metrics.resources?.memory?.heap?.max !== null) {
                    validValues.memory.heapMax.push(metrics.resources.memory.heap.max);
                }
                if (metrics.resources?.memory?.nonHeap?.used !== null) {
                    validValues.memory.nonHeapUsed.push(metrics.resources.memory.nonHeap.used);
                }
            });

            // Aggregate only if we have valid data
            aggregated.storage.totalLoad = validValues.storage.loads.length > 0 ? 
                validValues.storage.loads.reduce((sum, val) => sum + val, 0) : null;
            aggregated.storage.totalHints = validValues.storage.hints.length > 0 ? 
                validValues.storage.hints.reduce((sum, val) => sum + val, 0) : null;
                
            aggregated.performance.readLatency.count = validValues.performance.readCounts.length > 0 ? 
                validValues.performance.readCounts.reduce((sum, val) => sum + val, 0) : null;
            aggregated.performance.writeLatency.count = validValues.performance.writeCounts.length > 0 ? 
                validValues.performance.writeCounts.reduce((sum, val) => sum + val, 0) : null;
            aggregated.performance.readLatency.totalRate = validValues.performance.readRates.length > 0 ? 
                validValues.performance.readRates.reduce((sum, val) => sum + val, 0) : null;
            aggregated.performance.writeLatency.totalRate = validValues.performance.writeRates.length > 0 ? 
                validValues.performance.writeRates.reduce((sum, val) => sum + val, 0) : null;
                
            const totalReadTimeouts = validValues.performance.readTimeouts.reduce((sum, val) => sum + val, 0);
            const totalWriteTimeouts = validValues.performance.writeTimeouts.reduce((sum, val) => sum + val, 0);
            aggregated.performance.totalTimeouts = (validValues.performance.readTimeouts.length > 0 || validValues.performance.writeTimeouts.length > 0) ?
                totalReadTimeouts + totalWriteTimeouts : null;
                
            const totalReadUnavailables = validValues.performance.readUnavailables.reduce((sum, val) => sum + val, 0);
            const totalWriteUnavailables = validValues.performance.writeUnavailables.reduce((sum, val) => sum + val, 0);
            aggregated.performance.totalUnavailables = (validValues.performance.readUnavailables.length > 0 || validValues.performance.writeUnavailables.length > 0) ?
                totalReadUnavailables + totalWriteUnavailables : null;
                
            aggregated.cache.keyCache.totalRequests = validValues.cache.keyCacheRequests.length > 0 ? 
                validValues.cache.keyCacheRequests.reduce((sum, val) => sum + val, 0) : null;
            aggregated.cache.rowCache.totalRequests = validValues.cache.rowCacheRequests.length > 0 ? 
                validValues.cache.rowCacheRequests.reduce((sum, val) => sum + val, 0) : null;
                
            aggregated.compaction.totalPendingTasks = validValues.compaction.pendingTasks.length > 0 ? 
                validValues.compaction.pendingTasks.reduce((sum, val) => sum + val, 0) : null;
            aggregated.compaction.totalCompletedTasks = validValues.compaction.completedTasks.length > 0 ? 
                validValues.compaction.completedTasks.reduce((sum, val) => sum + val, 0) : null;
                
            aggregated.threadPools.totalActiveThreads = validValues.threadPools.activeThreads.length > 0 ? 
                validValues.threadPools.activeThreads.reduce((sum, val) => sum + val, 0) : null;
            aggregated.threadPools.totalPendingTasks = validValues.threadPools.pendingTasks.length > 0 ? 
                validValues.threadPools.pendingTasks.reduce((sum, val) => sum + val, 0) : null;
            aggregated.threadPools.totalCompletedTasks = validValues.threadPools.completedTasks.length > 0 ? 
                validValues.threadPools.completedTasks.reduce((sum, val) => sum + val, 0) : null;
                
            aggregated.memory.totalHeapUsed = validValues.memory.heapUsed.length > 0 ? 
                validValues.memory.heapUsed.reduce((sum, val) => sum + val, 0) : null;
            aggregated.memory.totalHeapMax = validValues.memory.heapMax.length > 0 ? 
                validValues.memory.heapMax.reduce((sum, val) => sum + val, 0) : null;
            aggregated.memory.totalNonHeapUsed = validValues.memory.nonHeapUsed.length > 0 ? 
                validValues.memory.nonHeapUsed.reduce((sum, val) => sum + val, 0) : null;

            // Calculate averages and hit rates
            const nodeCount = clusterMetrics.nodes.length;
            
            // Calculate proper averages for performance metrics
            let totalReadLatency = 0;
            let totalWriteLatency = 0;
            let totalReadP95 = 0;
            let totalWriteP95 = 0;
            let totalReadP99 = 0;
            let totalWriteP99 = 0;
            let totalReads = 0;
            let totalWrites = 0;
            let totalKeyCacheHits = 0;
            let totalRowCacheHits = 0;
            
            clusterMetrics.nodes.forEach(node => {
                const metrics = node.metrics;
                
                // Use only JMX structure
                totalReadLatency += metrics.performance?.readLatency?.mean || 0;
                totalWriteLatency += metrics.performance?.writeLatency?.mean || 0;
                totalReadP95 += metrics.performance?.readLatency?.p95 || 0;
                totalWriteP95 += metrics.performance?.writeLatency?.p95 || 0;
                totalReadP99 += metrics.performance?.readLatency?.p99 || 0;
                totalWriteP99 += metrics.performance?.writeLatency?.p99 || 0;
                totalReads += metrics.performance?.readLatency?.count || 0;
                totalWrites += metrics.performance?.writeLatency?.count || 0;
                
                // Cache metrics
                totalKeyCacheHits += (metrics.cache?.keyCache?.hitRate || 0) * (metrics.cache?.keyCache?.requests || 0);
                totalRowCacheHits += (metrics.cache?.rowCache?.hitRate || 0) * (metrics.cache?.rowCache?.requests || 0);
            });
            
            // Set calculated performance metrics
            aggregated.performance.avgReadLatency = totalReadLatency / nodeCount;
            aggregated.performance.avgWriteLatency = totalWriteLatency / nodeCount;
            aggregated.performance.p95ReadLatency = totalReadP95 / nodeCount;
            aggregated.performance.p95WriteLatency = totalWriteP95 / nodeCount;
            aggregated.performance.p99ReadLatency = totalReadP99 / nodeCount;
            aggregated.performance.p99WriteLatency = totalWriteP99 / nodeCount;
            aggregated.performance.totalReads = totalReads;
            aggregated.performance.totalWrites = totalWrites;
            
            // Add throughput rates from OneMinuteRate
            aggregated.performance.totalReadRate = aggregated.performance.readLatency.totalRate;
            aggregated.performance.totalWriteRate = aggregated.performance.writeLatency.totalRate;
            aggregated.performance.totalThroughputRate = aggregated.performance.readLatency.totalRate + aggregated.performance.writeLatency.totalRate;
            
            // Calculate proper cache hit rates
            aggregated.cache.keyCache.hitRate = aggregated.cache.keyCache.totalRequests > 0 ? 
                totalKeyCacheHits / aggregated.cache.keyCache.totalRequests : 0;
            aggregated.cache.rowCache.hitRate = aggregated.cache.rowCache.totalRequests > 0 ? 
                totalRowCacheHits / aggregated.cache.rowCache.totalRequests : 0;

            return {
                success: true,
                aggregated,
                nodeCount,
                individualNodes: clusterMetrics.nodes,
                lastUpdate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting aggregated metrics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Disconnect from all JMX connections
    disconnect() {
        for (const [connectionKey, connection] of this.jmxConnections) {
            try {
                if (connection.type === 'java-jmx' && connection.jmxConnector) {
                    connection.jmxConnector.closeSync();
                }
            } catch (error) {
                console.error(`Error closing JMX connection ${connectionKey}:`, error);
            }
        }
        
        this.jmxConnections.clear();
        // Removed console.log for production
    }
}

module.exports = new JMXService();
