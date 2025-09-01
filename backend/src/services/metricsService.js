const db = require('../config/database');
const jmxService = require('./jmxService');
const net = require('net');

class MetricsService {
    constructor() {
        this.metricsCache = {
            cluster: {},
            nodes: {},
            keyspaces: {},
            tables: {},
            lastUpdate: null
        };
        // Track all discovered nodes to handle SSH tunnel connecting to different nodes
        this.discoveredNodes = new Map();
    }

    async testNodeConnectivity(host, port = 9042, timeout = 3000) {
        return new Promise((resolve) => {
            const socket = net.createConnection({ host, port }, () => {
                socket.end();
                resolve(true);
            });
            
            socket.setTimeout(timeout);
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.on('error', () => {
                resolve(false);
            });
        });
    }

    async getClusterInfo() {
        try {
            if (!db.isConnected) {
                return {
                    error: 'Not connected to any cluster',
                    connected: false
                };
            }

            const client = db.getClient();
            
            // Update discovered nodes from current connection
            await this.updateDiscoveredNodes(client);
            
            const localResult = await client.execute('SELECT * FROM system.local');
            const local = localResult.rows[0];
            
            // Get unique datacenters from all discovered nodes
            const uniqueDatacenters = [...new Set(Array.from(this.discoveredNodes.values()).map(node => node.datacenter).filter(dc => dc))];
            
            // Total nodes = all discovered unique nodes
            const totalNodes = this.discoveredNodes.size;
            
            const clusterInfo = {
                name: local.cluster_name || 'Unknown',
                totalNodes: totalNodes,
                upNodes: totalNodes, // Assume all are up if we discovered them
                datacenters: uniqueDatacenters,
                cassandraVersion: local.release_version || 'Unknown',
                partitioner: local.partitioner || 'Unknown',
                connected: true,
                source: 'system_tables_remote',
                lastUpdate: new Date().toISOString()
            };

            this.metricsCache.cluster = clusterInfo;
            return clusterInfo;
        } catch (error) {
            console.error('Error getting cluster info:', error);
            return {
                error: error.message,
                connected: false
            };
        }
    }

    async updateDiscoveredNodes(client) {
        try {
            const localResult = await client.execute('SELECT * FROM system.local');
            const peersResult = await client.execute('SELECT * FROM system.peers');
            const local = localResult.rows[0];
            
            // Add local node (current connected node) to discovered nodes
            const localAddress = local.broadcast_address?.toString() || local.listen_address?.toString();
            this.discoveredNodes.set(localAddress, {
                address: localAddress,
                datacenter: local.data_center || 'Unknown',
                rack: local.rack || 'Unknown',
                isUp: true,
                version: local.release_version || 'Unknown',
                tokens: local.tokens ? local.tokens.length : 0,
                hostId: local.host_id?.toString() || 'Unknown',
                schemaVersion: local.schema_version?.toString() || 'Unknown',
                isLocal: false  // This is actually a remote cluster node
            });
            
            // Test connectivity and add only reachable peer nodes
            console.log('Checking peer connectivity...');
            for (const peer of peersResult.rows) {
                const peerAddress = peer.peer?.toString();
                if (peerAddress) {
                    const isReachable = await this.testNodeConnectivity(peerAddress);
                    
                    if (isReachable) {
                        this.discoveredNodes.set(peerAddress, {
                            address: peerAddress,
                            datacenter: peer.data_center || 'Unknown',
                            rack: peer.rack || 'Unknown',
                            isUp: true,
                            version: peer.release_version || 'Unknown',
                            tokens: peer.tokens ? peer.tokens.length : 0,
                            hostId: peer.host_id?.toString() || 'Unknown',
                            schemaVersion: peer.schema_version?.toString() || 'Unknown',
                            isLocal: false
                        });
                        console.log(`  ✅ ${peerAddress} added to cluster`);
                    } else {
                        console.log(`  ❌ ${peerAddress} unreachable, skipping (stale peer entry)`);
                        // Remove from discovered nodes if it was previously added
                        this.discoveredNodes.delete(peerAddress);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating discovered nodes:', error);
        }
    }

    async getNodesInfo() {
        try {
            const client = db.getClient();
            
            // Update discovered nodes from current connection
            await this.updateDiscoveredNodes(client);
            
            // Return all discovered nodes (deduplicated across tunnel connections)
            const nodesInfo = Array.from(this.discoveredNodes.values());
            this.metricsCache.nodes = nodesInfo;
            return nodesInfo;
        } catch (error) {
            console.error('Error getting nodes info:', error);
            throw error;
        }
    }

    async getKeyspacesInfo() {
        try {
            const client = db.getClient();
            const result = await client.execute(
                "SELECT keyspace_name, replication FROM system_schema.keyspaces"
            );

            const keyspaces = result.rows.map(row => ({
                name: row.keyspace_name,
                replication: row.replication,
                isSystemKeyspace: row.keyspace_name.startsWith('system')
            }));

            // Get table counts for each keyspace
            const keyspacesWithTables = await Promise.all(
                keyspaces.map(async (ks) => {
                    try {
                        const tableResult = await client.execute(
                            "SELECT COUNT(*) as table_count FROM system_schema.tables WHERE keyspace_name = ?",
                            [ks.name]
                        );
                        return {
                            ...ks,
                            tableCount: parseInt(tableResult.rows[0].table_count)
                        };
                    } catch (error) {
                        return { ...ks, tableCount: 0 };
                    }
                })
            );

            this.metricsCache.keyspaces = keyspacesWithTables;
            return keyspacesWithTables;
        } catch (error) {
            console.error('Error getting keyspaces info:', error);
            throw error;
        }
    }

    async getTableInfo(keyspace) {
        try {
            const client = db.getClient();
            const result = await client.execute(
                "SELECT table_name, bloom_filter_fp_chance, caching, comment, compaction, compression, gc_grace_seconds FROM system_schema.tables WHERE keyspace_name = ?",
                [keyspace]
            );

            const tables = result.rows.map(row => ({
                name: row.table_name,
                keyspace: keyspace,
                bloomFilterFpChance: row.bloom_filter_fp_chance,
                caching: row.caching,
                comment: row.comment,
                compaction: row.compaction,
                compression: row.compression,
                gcGraceSeconds: row.gc_grace_seconds
            }));

            return tables;
        } catch (error) {
            console.error('Error getting table info:', error);
            throw error;
        }
    }

    async getSystemMetrics() {
        try {
            const client = db.getClient();
            
            // Get compaction stats
            const compactionResult = await client.execute(
                "SELECT * FROM system.compaction_history LIMIT 10"
            );

            // Get pending tasks (approximation using system tables)
            const pendingTasks = {
                compaction: 0,
                repair: 0,
                antiEntropy: 0
            };

            // Get current operations from system.peers and system.local
            const peersResult = await client.execute("SELECT * FROM system.peers");
            const localResult = await client.execute("SELECT * FROM system.local");

            const systemMetrics = {
                compactionHistory: compactionResult.rows.slice(0, 10),
                pendingTasks,
                peers: peersResult.rows,
                local: localResult.rows[0],
                lastUpdate: new Date().toISOString()
            };

            return systemMetrics;
        } catch (error) {
            console.error('Error getting system metrics:', error);
            throw error;
        }
    }

    async getPerformanceMetrics() {
        try {
            if (!db.isConnected) {
                return {
                    readLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    writeLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    throughput: { reads: 0, writes: 0 },
                    errors: { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 },
                    cacheHitRates: { keyCache: 0, rowCache: 0 },
                    error: 'Not connected to any cluster',
                    connected: false,
                    lastUpdate: new Date().toISOString()
                };
            }

            // Try to get JMX metrics first for real performance data
            try {
                const connectionInfo = db.getConnectionInfo();
                const hosts = connectionInfo.config ? connectionInfo.config.hosts : [];
                
                console.log('MetricsService JMX fetch - Connection info:', {
                    hasConfig: !!connectionInfo.config,
                    hosts: hosts,
                    hostCount: hosts.length
                });
                
                if (hosts.length > 0) {
                    console.log('Fetching JMX metrics for main dashboard...');
                    const jmxData = await jmxService.getAggregatedMetrics(hosts);
                    
                    console.log('JMX data received:', {
                        success: jmxData?.success,
                        error: jmxData?.error,
                        hasAggregated: !!jmxData?.aggregated,
                        aggregatedKeys: jmxData?.aggregated ? Object.keys(jmxData.aggregated) : []
                    });
                    
                    if (jmxData.success && jmxData.aggregated) {
                        const jmxMetrics = jmxData.aggregated;
                        
                        // Map JMX metrics to the expected performance format
                        return {
                            readLatency: { 
                                p50: jmxMetrics.performance?.avgReadLatency || 0,
                                p95: jmxMetrics.performance?.p95ReadLatency || 0,
                                p99: jmxMetrics.performance?.p99ReadLatency || 0,
                                mean: jmxMetrics.performance?.avgReadLatency || 0
                            },
                            writeLatency: { 
                                p50: jmxMetrics.performance?.avgWriteLatency || 0,
                                p95: jmxMetrics.performance?.p95WriteLatency || 0,
                                p99: jmxMetrics.performance?.p95WriteLatency || 0,
                                mean: jmxMetrics.performance?.avgWriteLatency || 0
                            },
                            throughput: { 
                                reads: jmxMetrics.performance?.totalReadRate || jmxMetrics.performance?.readLatency?.totalRate || 0,
                                writes: jmxMetrics.performance?.totalWriteRate || jmxMetrics.performance?.writeLatency?.totalRate || 0,
                                readsOneMinuteRate: jmxMetrics.performance?.totalReadRate || jmxMetrics.performance?.readLatency?.totalRate || 0,
                                writesOneMinuteRate: jmxMetrics.performance?.totalWriteRate || jmxMetrics.performance?.writeLatency?.totalRate || 0
                            },
                            errors: { 
                                readTimeouts: jmxMetrics.performance?.totalTimeouts || 0,
                                writeTimeouts: 0,
                                unavailableExceptions: jmxMetrics.performance?.totalUnavailables || 0
                            },
                            cacheHitRates: { 
                                keyCache: jmxMetrics.cache?.keyCache?.hitRate || 0,
                                rowCache: jmxMetrics.cache?.rowCache?.hitRate || 0
                            },
                            // Include JMX-specific metrics for the main dashboard
                            jmxMetrics: {
                                memory: jmxMetrics.memory,
                                threadPools: jmxMetrics.threadPools,
                                gc: jmxMetrics.gc,
                                cache: jmxMetrics.cache
                            },
                            source: 'jmx_aggregated',
                            lastUpdate: new Date().toISOString()
                        };
                    } else {
                        console.log('JMX data not successful or missing aggregated data');
                    }
                } else {
                    console.log('No hosts available for JMX metrics in main dashboard');
                }
            } catch (jmxError) {
                console.log('JMX metrics not available for main dashboard:', jmxError.message);
                console.error('JMX error details:', jmxError);
            }

            // Fallback to system table metrics if JMX not available
            const client = db.getClient();
            
            try {
                // Get compaction activity from system tables
                const compactionResult = await client.execute(`
                    SELECT keyspace_name, columnfamily_name, compacted_at, bytes_in, bytes_out
                    FROM system.compaction_history 
                    LIMIT 20
                `);
                
                let totalCompactions = compactionResult.rows.length;
                let totalBytesProcessed = compactionResult.rows.reduce((sum, row) => {
                    const bytesIn = row.bytes_in && typeof row.bytes_in.toNumber === 'function' 
                        ? row.bytes_in.toNumber() : 0;
                    return sum + bytesIn;
                }, 0);
                
                return {
                    readLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    writeLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    throughput: { reads: 0, writes: 0 },
                    errors: { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 },
                    cacheHitRates: { keyCache: 0, rowCache: 0 },
                    compactionActivity: {
                        last24h: totalCompactions,
                        bytesProcessed: totalBytesProcessed
                    },
                    message: 'JMX metrics not available. Using system table data only.',
                    source: 'system_tables_fallback',
                    lastUpdate: new Date().toISOString()
                };
            } catch (systemError) {
                console.warn('Could not derive performance metrics from system tables:', systemError.message);
                return {
                    readLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    writeLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    throughput: { reads: 0, writes: 0 },
                    errors: { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 },
                    cacheHitRates: { keyCache: 0, rowCache: 0 },
                    error: 'Performance metrics not available',
                    source: 'unavailable',
                    lastUpdate: new Date().toISOString()
                };
            }
        } catch (error) {
            console.error('Error getting performance metrics:', error);
            return {
                readLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                writeLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                throughput: { reads: 0, writes: 0 },
                errors: { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 },
                cacheHitRates: { keyCache: 0, rowCache: 0 },
                error: error.message,
                connected: false,
                lastUpdate: new Date().toISOString()
            };
        }
    }

    async getBasicPerformanceMetrics() {
        try {
            if (!db.isConnected) {
                return {
                    readLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    writeLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    throughput: { reads: 0, writes: 0 },
                    errors: { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 },
                    cacheHitRates: { keyCache: 0, rowCache: 0 },
                    error: 'Not connected to any cluster',
                    connected: false,
                    lastUpdate: new Date().toISOString()
                };
            }

            // Only get basic system table metrics, no JMX
            const client = db.getClient();
            
            try {
                // Get compaction activity from system tables
                const compactionResult = await client.execute(`
                    SELECT keyspace_name, columnfamily_name, compacted_at, bytes_in, bytes_out
                    FROM system.compaction_history 
                    LIMIT 20
                `);
                
                let totalCompactions = compactionResult.rows.length;
                let totalBytesProcessed = compactionResult.rows.reduce((sum, row) => {
                    const bytesIn = row.bytes_in && typeof row.bytes_in.toNumber === 'function' 
                        ? row.bytes_in.toNumber() : 0;
                    return sum + bytesIn;
                }, 0);
                
                return {
                    readLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    writeLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    throughput: { reads: 0, writes: 0 },
                    errors: { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 },
                    cacheHitRates: { keyCache: 0, rowCache: 0 },
                    compactionActivity: {
                        last24h: totalCompactions,
                        bytesProcessed: totalBytesProcessed
                    },
                    message: 'Basic metrics only. JMX data fetched separately by frontend.',
                    source: 'basic_system_tables',
                    lastUpdate: new Date().toISOString()
                };
            } catch (systemError) {
                console.warn('Could not derive basic performance metrics from system tables:', systemError.message);
                return {
                    readLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    writeLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                    throughput: { reads: 0, writes: 0 },
                    errors: { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 },
                    cacheHitRates: { keyCache: 0, rowCache: 0 },
                    error: 'Basic performance metrics not available',
                    source: 'unavailable',
                    lastUpdate: new Date().toISOString()
                };
            }
        } catch (error) {
            console.error('Error getting basic performance metrics:', error);
            return {
                readLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                writeLatency: { p50: 0, p95: 0, p99: 0, mean: 0 },
                throughput: { reads: 0, writes: 0 },
                errors: { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 },
                cacheHitRates: { keyCache: 0, rowCache: 0 },
                error: error.message,
                connected: false,
                lastUpdate: new Date().toISOString()
            };
        }
    }

    async getStorageMetrics() {
        try {
            if (!db.isConnected) {
                return {
                    totalSize: 0,
                    keyspacesSizes: [],
                    error: 'Not connected to any cluster',
                    connected: false,
                    lastUpdate: new Date().toISOString()
                };
            }

            const client = db.getClient();
            
            // Get storage information from system tables using correct column names
            try {
                const sizeResult = await client.execute(`
                    SELECT keyspace_name, 
                           SUM(mean_partition_size * partitions_count) as total_size 
                    FROM system.size_estimates 
                    GROUP BY keyspace_name
                `);

                // Convert Long objects to regular numbers and handle null values
                const totalSize = sizeResult.rows.reduce((sum, row) => {
                    const size = row.total_size;
                    if (size && typeof size.toNumber === 'function') {
                        return sum + size.toNumber();
                    } else if (typeof size === 'number') {
                        return sum + size;
                    }
                    return sum;
                }, 0);

                const keyspacesSizes = sizeResult.rows.map(row => {
                    const size = row.total_size;
                    let sizeValue = 0;
                    if (size && typeof size.toNumber === 'function') {
                        sizeValue = size.toNumber();
                    } else if (typeof size === 'number') {
                        sizeValue = size;
                    }
                    return {
                        keyspace: row.keyspace_name,
                        size: sizeValue
                    };
                });

                const storageMetrics = {
                    totalSize: totalSize,
                    keyspacesSizes: keyspacesSizes,
                    source: 'system_tables',
                    lastUpdate: new Date().toISOString()
                };

                return storageMetrics;
            } catch (systemError) {
                console.warn('system.size_estimates not available:', systemError.message);
                // Return zero storage metrics with proper structure
                return {
                    totalSize: 0,
                    keyspacesSizes: [],
                    error: 'Storage metrics not available from system.size_estimates table',
                    message: 'Storage metrics require system.size_estimates or JMX access',
                    source: 'unavailable',
                    lastUpdate: new Date().toISOString()
                };
            }
        } catch (error) {
            console.error('Error getting storage metrics:', error);
            return {
                totalSize: 0,
                keyspacesSizes: [],
                error: error.message,
                connected: false,
                lastUpdate: new Date().toISOString()
            };
        }
    }

    async getBasicMetrics() {
        try {
            if (!db.isConnected) {
                return {
                    cluster: { upNodes: 0, totalNodes: 0, name: 'Not Connected', cassandraVersion: 'N/A', datacenters: [] },
                    nodes: [],
                    keyspaces: [],
                    performance: { readLatency: { p50: 0, p95: 0, p99: 0, mean: 0 }, writeLatency: { p50: 0, p95: 0, p99: 0, mean: 0 }, throughput: { reads: 0, writes: 0 }, errors: { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 }, cacheHitRates: { keyCache: 0, rowCache: 0 }, error: 'Not connected to any cluster', connected: false, lastUpdate: new Date().toISOString() },
                    storage: { totalSize: 0, keyspacesSizes: [], error: 'Not connected to any cluster', connected: false, lastUpdate: new Date().toISOString() },
                    system: { compactionHistory: [], pendingTasks: { compaction: 0, repair: 0, antiEntropy: 0 }, peers: [], local: null, lastUpdate: new Date().toISOString() },
                    lastUpdate: new Date().toISOString()
                };
            }

            // Get basic metrics without JMX (performance metrics will be basic fallback)
            const [cluster, nodes, keyspaces, storage, system] = await Promise.all([
                this.getClusterInfo(),
                this.getNodesInfo(),
                this.getKeyspacesInfo(),
                this.getStorageMetrics(),
                this.getSystemMetrics()
            ]);

            // Get basic performance metrics without JMX
            const basicPerformance = await this.getBasicPerformanceMetrics();

            return {
                cluster,
                nodes,
                keyspaces,
                performance: basicPerformance,
                storage,
                system,
                lastUpdate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting basic metrics:', error);
            return {
                cluster: { upNodes: 0, totalNodes: 0, name: 'Error', cassandraVersion: 'N/A', datacenters: [] },
                nodes: [],
                keyspaces: [],
                performance: { readLatency: { p50: 0, p95: 0, p99: 0, mean: 0 }, writeLatency: { p50: 0, p95: 0, p99: 0, mean: 0 }, throughput: { reads: 0, writes: 0 }, errors: { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 }, cacheHitRates: { keyCache: 0, rowCache: 0 }, error: error.message, connected: false, lastUpdate: new Date().toISOString() },
                storage: { totalSize: 0, keyspacesSizes: [], error: error.message, connected: false, lastUpdate: new Date().toISOString() },
                system: { compactionHistory: [], pendingTasks: { compaction: 0, repair: 0, antiEntropy: 0 }, peers: [], local: null, lastUpdate: new Date().toISOString() },
                lastUpdate: new Date().toISOString()
            };
        }
    }

    async getAllMetrics() {
        try {
            const [cluster, nodes, keyspaces, systemMetrics, performance, storage] = await Promise.all([
                this.getClusterInfo(),
                this.getNodesInfo(),
                this.getKeyspacesInfo(),
                this.getSystemMetrics(),
                this.getPerformanceMetrics(),
                this.getStorageMetrics()
            ]);

            const allMetrics = {
                cluster,
                nodes,
                keyspaces,
                system: systemMetrics,
                performance,
                storage,
                lastUpdate: new Date().toISOString()
            };

            this.metricsCache = { ...this.metricsCache, ...allMetrics };
            return allMetrics;
        } catch (error) {
            console.error('Error getting all metrics:', error);
            throw error;
        }
    }

    getCache() {
        return this.metricsCache;
    }
}

module.exports = new MetricsService();
