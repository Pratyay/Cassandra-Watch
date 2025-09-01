const operationsService = require('./operationsService');

class NodetoolMetricsService {
    constructor() {
        this.metricsCache = {
            cluster: {},
            nodes: {},
            performance: {},
            storage: {},
            lastUpdate: null
        };
    }

    async executeNodetoolCommand(command) {
        try {
            // Use the operations service to execute nodetool commands on remote cluster
            switch (command) {
                case 'status':
                    return await operationsService.getClusterStatus();
                case 'info':
                    return await operationsService.getClusterInfo();
                case 'compactionstats':
                    return await operationsService.getCompactionStats();
                case 'tpstats':
                    return await operationsService.getThreadPoolStats();
                case 'gcstats':
                    return await operationsService.getGCStats();
                default:
                    return {
                        success: false,
                        output: null,
                        error: `Unsupported nodetool command: ${command}`
                    };
            }
        } catch (error) {
            console.error('Nodetool command error:', error.message);
            return {
                success: false,
                output: null,
                error: error.message
            };
        }
    }

    async getClusterStatus() {
        try {
            const result = await this.executeNodetoolCommand('status');
            if (!result.success) {
                throw new Error(result.error);
            }
            
            return this.parseNodetoolStatus(result.output);
        } catch (error) {
            console.error('Error getting cluster status:', error);
            throw error;
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
                    // Parse node line: UN  localhost  125.51 KiB  256          38.1%            abc123...
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
                upNodes: nodes.filter(n => n.status === 'U').length,
                downNodes: nodes.filter(n => n.status === 'D').length
            };
        } catch (error) {
            console.error('Error parsing nodetool status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getClusterInfo() {
        try {
            const result = await this.executeNodetoolCommand('info');
            if (!result.success) {
                throw new Error(result.error);
            }
            
            return this.parseNodetoolInfo(result.output);
        } catch (error) {
            console.error('Error getting cluster info:', error);
            throw error;
        }
    }

    parseNodetoolInfo(output) {
        try {
            const lines = output.split('\n').filter(line => line.trim());
            const info = {};
            
            for (const line of lines) {
                if (line.includes(':')) {
                    const [key, value] = line.split(':', 2);
                    info[key.trim()] = value.trim();
                }
            }

            return {
                success: true,
                info: info
            };
        } catch (error) {
            console.error('Error parsing nodetool info:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getCompactionStats() {
        try {
            const result = await this.executeNodetoolCommand('compactionstats');
            if (!result.success) {
                throw new Error(result.error);
            }
            
            return this.parseCompactionStats(result.output);
        } catch (error) {
            console.error('Error getting compaction stats:', error);
            throw error;
        }
    }

    parseCompactionStats(output) {
        try {
            const lines = output.split('\n').filter(line => line.trim());
            const stats = {
                pendingTasks: 0,
                activeCompactions: 0,
                completedCompactions: 0,
                bytesProcessed: 0
            };
            
            for (const line of lines) {
                if (line.includes('pending tasks:')) {
                    stats.pendingTasks = parseInt(line.match(/\d+/)?.[0] || '0');
                } else if (line.includes('Active compactions:')) {
                    stats.activeCompactions = parseInt(line.match(/\d+/)?.[0] || '0');
                } else if (line.includes('Completed compactions:')) {
                    stats.completedCompactions = parseInt(line.match(/\d+/)?.[0] || '0');
                } else if (line.includes('Total bytes compacted:')) {
                    stats.bytesProcessed = parseInt(line.match(/\d+/)?.[0] || '0');
                }
            }

            return {
                success: true,
                stats: stats
            };
        } catch (error) {
            console.error('Error parsing compaction stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getThreadPoolStats() {
        try {
            const result = await this.executeNodetoolCommand('tpstats');
            if (!result.success) {
                throw new Error(result.error);
            }
            
            return this.parseThreadPoolStats(result.output);
        } catch (error) {
            console.error('Error getting thread pool stats:', error);
            throw error;
        }
    }

    parseThreadPoolStats(output) {
        try {
            const lines = output.split('\n').filter(line => line.trim());
            const pools = {};
            let currentPool = null;
            
            for (const line of lines) {
                if (line.includes('Pool Name')) {
                    // Skip header
                    continue;
                } else if (line.includes('Active') && line.includes('Pending') && line.includes('Completed')) {
                    // Skip sub-header
                    continue;
                } else if (line.match(/^[A-Za-z]+\s+/)) {
                    // Pool line: ReadStage         0         0      12345
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 4) {
                        currentPool = parts[0];
                        pools[currentPool] = {
                            active: parseInt(parts[1]) || 0,
                            pending: parseInt(parts[2]) || 0,
                            completed: parseInt(parts[3]) || 0
                        };
                    }
                }
            }

            return {
                success: true,
                pools: pools
            };
        } catch (error) {
            console.error('Error parsing thread pool stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getGCStats() {
        try {
            const result = await this.executeNodetoolCommand('gcstats');
            if (!result.success) {
                throw new Error(result.error);
            }
            
            return this.parseGCStats(result.output);
        } catch (error) {
            console.error('Error getting GC stats:', error);
            throw error;
        }
    }

    parseGCStats(output) {
        try {
            const lines = output.split('\n').filter(line => line.trim());
            const stats = {
                interval: 0,
                collections: 0,
                maxGcTime: 0,
                totalGcTime: 0,
                averageGcTime: 0
            };
            
            for (const line of lines) {
                if (line.includes('Interval (ms):')) {
                    stats.interval = parseInt(line.match(/\d+/)?.[0] || '0');
                } else if (line.includes('Collections:')) {
                    stats.collections = parseInt(line.match(/\d+/)?.[0] || '0');
                } else if (line.includes('Max GC time (ms):')) {
                    stats.maxGcTime = parseInt(line.match(/\d+/)?.[0] || '0');
                } else if (line.includes('Total GC time (ms):')) {
                    stats.totalGcTime = parseInt(line.match(/\d+/)?.[0] || '0');
                } else if (line.includes('Average GC time (ms):')) {
                    stats.averageGcTime = parseInt(line.match(/\d+/)?.[0] || '0');
                }
            }

            return {
                success: true,
                stats: stats
            };
        } catch (error) {
            console.error('Error parsing GC stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getProxyHistograms() {
        try {
            // Since proxyhistograms might not be available in all operations, 
            // we'll return a placeholder or try to get it from operations if available
            return {
                success: true,
                histograms: {
                    read: {},
                    write: {},
                    range: {}
                },
                message: 'Proxy histograms not available via remote operations'
            };
        } catch (error) {
            console.error('Error getting proxy histograms:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getAllNodetoolMetrics() {
        try {
            const [clusterStatus, clusterInfo, compactionStats, threadPoolStats, gcStats, proxyHistograms] = await Promise.all([
                this.getClusterStatus(),
                this.getClusterInfo(),
                this.getCompactionStats(),
                this.getThreadPoolStats(),
                this.getGCStats(),
                this.getProxyHistograms()
            ]);

            const allMetrics = {
                cluster: clusterStatus,
                info: clusterInfo,
                compaction: compactionStats,
                threadPools: threadPoolStats,
                gc: gcStats,
                histograms: proxyHistograms,
                lastUpdate: new Date().toISOString()
            };

            this.metricsCache = allMetrics;
            return allMetrics;
        } catch (error) {
            console.error('Error getting all nodetool metrics:', error);
            throw error;
        }
    }

    getCache() {
        return this.metricsCache;
    }
}

module.exports = new NodetoolMetricsService(); 