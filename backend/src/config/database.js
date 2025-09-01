const cassandra = require('cassandra-driver');
require('dotenv').config();

class DatabaseConfig {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.connectionConfig = null;
    }

    async connect(config) {
        try {
            // Require config to be provided - no automatic connection
            if (!config) {
                throw new Error('Connection configuration is required');
            }
            
            const connectionConfig = config;

            // Disconnect existing connection if any
            if (this.client) {
                await this.disconnect();
            }
            
            const authProvider = connectionConfig.username ? 
                new cassandra.auth.PlainTextAuthProvider(
                    connectionConfig.username, 
                    connectionConfig.password
                ) : null;

            this.client = new cassandra.Client({
                contactPoints: connectionConfig.hosts,
                localDataCenter: connectionConfig.datacenter,
                authProvider,
                protocolOptions: {
                    port: connectionConfig.port
                },
                socketOptions: {
                    connectTimeout: 30000,
                    readTimeout: 30000,
                    keepAlive: true,
                    keepAliveDelay: 0
                },
                pooling: {
                    coreConnectionsPerHost: {
                        [cassandra.types.distance.local]: 1,
                        [cassandra.types.distance.remote]: 1
                    },
                    maxConnectionsPerHost: {
                        [cassandra.types.distance.local]: 2,
                        [cassandra.types.distance.remote]: 1
                    },
                    heartBeatInterval: 30000
                },
                policies: {
                    reconnection: new cassandra.policies.reconnection.ExponentialReconnectionPolicy(1000, 10 * 60 * 1000, false),
                    retry: new cassandra.policies.retry.RetryPolicy(),
                    loadBalancing: new cassandra.policies.loadBalancing.DCAwareRoundRobinPolicy()
                },
                queryOptions: {
                    consistency: cassandra.types.consistencies.localQuorum,
                    fetchSize: 1000
                }
            });

            await this.client.connect();
            
            // Wait a moment for metadata to populate after connection
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.isConnected = true;
            this.connectionConfig = connectionConfig;
            console.log('✅ Connected to Cassandra cluster');
            
            // Get cluster metadata with safe access
            const metadata = this.client.metadata;
            let clusterName = metadata?.clusterName;
            let hostsCount = metadata?.hosts ? Object.keys(metadata.hosts).length : 0;
            
            // If metadata isn't populated, get info from system tables
            if (!clusterName || hostsCount === 0) {
                console.log('Metadata not fully populated, querying system tables...');
                try {
                    const localResult = await this.client.execute('SELECT * FROM system.local');
                    const peersResult = await this.client.execute('SELECT * FROM system.peers');
                    
                    clusterName = localResult.rows[0]?.cluster_name || 'Unknown';
                    hostsCount = 1 + peersResult.rows.length; // local + peers
                    
                    console.log('Got cluster info from system tables');
                } catch (queryError) {
                    console.warn('Could not query system tables:', queryError.message);
                }
            }
            
            console.log(`Cluster: ${clusterName}`);
            console.log(`Hosts: ${hostsCount} nodes`);

            return {
                success: true,
                cluster: clusterName,
                nodes: hostsCount,
                config: connectionConfig
            };

        } catch (error) {
            console.error('❌ Failed to connect to Cassandra:', error.message);
            this.isConnected = false;
            this.connectionConfig = null;
            throw error;
        }
    }

    getClient() {
        if (!this.isConnected || !this.client) {
            throw new Error('Database client is not connected');
        }
        return this.client;
    }

    async disconnect() {
        if (this.client) {
            await this.client.shutdown();
            this.isConnected = false;
            this.connectionConfig = null;
            console.log('Disconnected from Cassandra');
        }
    }

    getConnectionInfo() {
        return {
            isConnected: this.isConnected,
            config: this.connectionConfig,
            cluster: this.client?.metadata?.clusterName || null
        };
    }

    async testConnection(config) {
        try {
            const authProvider = config.username ? 
                new cassandra.auth.PlainTextAuthProvider(
                    config.username, 
                    config.password
                ) : null;

            const testClient = new cassandra.Client({
                contactPoints: config.hosts,
                localDataCenter: config.datacenter,
                authProvider,
                protocolOptions: {
                    port: config.port
                },
                socketOptions: {
                    connectTimeout: 5000
                }
            });

            await testClient.connect();
            const metadata = testClient.metadata;
            
            // Safe access to hosts metadata
            const hosts = metadata.hosts ? Array.from(metadata.hosts.values()) : [];
            const clusterName = metadata.clusterName || 'Unknown';
            const version = metadata.cassandraVersion || 'Unknown';
            
            const result = {
                success: true,
                cluster: clusterName,
                nodes: hosts.length,
                upNodes: hosts.filter(host => host && typeof host.isUp === 'function' && host.isUp()).length,
                datacenters: [...new Set(hosts.map(host => host?.datacenter).filter(dc => dc))],
                version: version
            };
            
            await testClient.shutdown();
            return result;
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new DatabaseConfig();
