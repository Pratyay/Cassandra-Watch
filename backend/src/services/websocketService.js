const WebSocket = require('ws');
const metricsService = require('./metricsService');
const operationsService = require('./operationsService');
const jmxService = require('./jmxService');

class WebSocketService {
    constructor() {
        this.wss = null;
        this.clients = new Set();
        this.updateInterval = null;
    }

    initialize(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws'
        });

        this.wss.on('connection', (ws, request) => {
            console.log('WebSocket client connected');
            
            this.clients.add(ws);
            
            // Send initial data
            this.sendInitialData(ws);
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format'
                    }));
                }
            });
            
            ws.on('close', () => {
                console.log('WebSocket client disconnected');
                this.clients.delete(ws);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });

        // Start periodic updates
        this.startPeriodicUpdates();
        
        console.log('WebSocket service initialized');
    }

    async sendInitialData(ws) {
        try {
            // Check if database is connected before trying to fetch data
            const dbConfig = require('../config/database');
            if (!dbConfig.isConnected) {
                // Send a message indicating connection is pending
                ws.send(JSON.stringify({
                    type: 'connection_pending',
                    message: 'Waiting for database connection...'
                }));
                return;
            }
            
            // Initialize JMX connection during startup
            let jmxMetrics = null;
            try {
                // Get actual discovered node addresses instead of connection config hosts
                const metricsService = require('./metricsService');
                const nodesInfo = await metricsService.getNodesInfo();
                const hosts = nodesInfo.map(node => node.address);
                
                console.log('WebSocket JMX init - Discovered nodes:', {
                    nodesInfo: nodesInfo,
                    hosts: hosts,
                    hostCount: hosts.length
                });
                
                if (hosts.length > 0) {
                    console.log('Initializing JMX connection during startup...');
                    jmxMetrics = await jmxService.getAggregatedMetrics(hosts);
                    console.log('JMX connection initialized:', {
                        success: jmxMetrics?.success,
                        error: jmxMetrics?.error,
                        hasAggregated: !!jmxMetrics?.aggregated
                    });
                } else {
                    console.log('No hosts available for JMX initialization');
                }
            } catch (jmxError) {
                console.log('JMX initialization failed during startup:', jmxError.message);
                console.error('JMX error details:', jmxError);
            }
            
            const metrics = await metricsService.getBasicMetrics();
            const operations = await operationsService.getActiveOperations();
            
            ws.send(JSON.stringify({
                type: 'initial',
                data: {
                    metrics,
                    operations,
                    jmxInitialized: jmxMetrics?.success || false
                }
            }));
        } catch (error) {
            console.error('Error sending initial data:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to fetch initial data'
            }));
        }
    }

    async handleMessage(ws, data) {
        switch (data.type) {
            case 'subscribe':
                await this.handleSubscription(ws, data);
                break;
            case 'unsubscribe':
                await this.handleUnsubscription(ws, data);
                break;
            case 'request_metrics':
                await this.sendMetricsUpdate(ws);
                break;
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Unknown message type'
                }));
        }
    }

    async handleSubscription(ws, data) {
        const { channels } = data;
        
        if (!ws.subscriptions) {
            ws.subscriptions = new Set();
        }
        
        channels.forEach(channel => {
            ws.subscriptions.add(channel);
        });
        
        ws.send(JSON.stringify({
            type: 'subscribed',
            channels
        }));
    }

    async handleUnsubscription(ws, data) {
        const { channels } = data;
        
        if (ws.subscriptions) {
            channels.forEach(channel => {
                ws.subscriptions.delete(channel);
            });
        }
        
        ws.send(JSON.stringify({
            type: 'unsubscribed',
            channels
        }));
    }

    startPeriodicUpdates() {
        // Update every 5 seconds
        this.updateInterval = setInterval(async () => {
            try {
                await this.sendMetricsToSubscribers();
                await this.sendOperationsToSubscribers();
                await this.sendJMXToSubscribers();
            } catch (error) {
                console.error('Error in periodic updates:', error);
            }
        }, parseInt(process.env.REFRESH_INTERVAL) || 5000);
    }

    async sendMetricsToSubscribers() {
        if (this.clients.size === 0) return;
        
        try {
            // Check if database is connected before trying to fetch data
            const dbConfig = require('../config/database');
            if (!dbConfig.isConnected) {
                return; // Skip this update if not connected
            }
            
            // Get basic metrics without JMX (since frontend Dashboard fetches JMX directly)
            const basicMetrics = await metricsService.getBasicMetrics();
            
            this.broadcast({
                type: 'metrics_update',
                data: basicMetrics
            }, 'metrics');
        } catch (error) {
            console.error('Error broadcasting metrics:', error);
        }
    }

    async sendOperationsToSubscribers() {
        if (this.clients.size === 0) return;
        
        try {
            // Check if database is connected before trying to fetch data
            const dbConfig = require('../config/database');
            if (!dbConfig.isConnected) {
                return; // Skip this update if not connected
            }
            
            const operations = await operationsService.getActiveOperations();
            
            this.broadcast({
                type: 'operations_update',
                data: operations
            }, 'operations');
        } catch (error) {
            console.error('Error broadcasting operations:', error);
        }
    }

    async sendJMXToSubscribers() {
        // Disabled JMX broadcasting since frontend Dashboard fetches JMX data directly
        // This prevents JMX connection errors in WebSocket service
        console.log('JMX broadcasting disabled - frontend fetches JMX data directly');
        return;
    }

    async sendMetricsUpdate(ws) {
        try {
            // Check if database is connected before trying to fetch data
            const dbConfig = require('../config/database');
            if (!dbConfig.isConnected) {
                ws.send(JSON.stringify({
                    type: 'connection_pending',
                    message: 'Database connection not available'
                }));
                return;
            }
            
            // Use basic metrics without JMX to prevent connection errors
            const metrics = await metricsService.getBasicMetrics();
            ws.send(JSON.stringify({
                type: 'metrics_update',
                data: metrics
            }));
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to fetch metrics'
            }));
        }
    }

    broadcast(message, channel = null) {
        const messageStr = JSON.stringify(message);
        
        this.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                // If channel is specified, only send to subscribed clients
                if (channel && ws.subscriptions && !ws.subscriptions.has(channel)) {
                    return;
                }
                
                try {
                    ws.send(messageStr);
                } catch (error) {
                    console.error('Error sending message to client:', error);
                    this.clients.delete(ws);
                }
            }
        });
    }

    broadcastOperationUpdate(operationId, operation) {
        this.broadcast({
            type: 'operation_update',
            data: {
                operationId,
                operation
            }
        }, 'operations');
    }

    broadcastAlert(alert) {
        this.broadcast({
            type: 'alert',
            data: alert
        }, 'alerts');
    }

    // Method to send initial data to all connected clients (useful after DB reconnection)
    async broadcastInitialDataToAll() {
        if (this.clients.size === 0) return;
        
        try {
            const dbConfig = require('../config/database');
            if (!dbConfig.isConnected) {
                return; // Skip if not connected
            }
            
            const metrics = await metricsService.getAllMetrics();
            const operations = await operationsService.getActiveOperations();
            
            this.broadcast({
                type: 'initial',
                data: {
                    metrics,
                    operations
                }
            });
        } catch (error) {
            console.error('Error broadcasting initial data to all clients:', error);
        }
    }

    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.wss) {
            this.wss.close();
        }
        
        this.clients.clear();
        console.log('WebSocket service stopped');
    }
}

module.exports = new WebSocketService();
