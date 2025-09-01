const express = require('express');
const router = express.Router();
const jmxService = require('../services/jmxService');
const db = require('../config/database');

// Test JMX connectivity for a specific host
router.post('/test', async (req, res) => {
    try {
        const { host, port } = req.body;
        
        if (!host) {
            return res.status(400).json({
                error: 'Host is required'
            });
        }

        const jmxPort = parseInt(port) || 7199;
        const result = await jmxService.testJMXConnection(host, jmxPort);
        res.json(result);
    } catch (error) {
        console.error('Error testing JMX connection:', error);
        res.status(500).json({
            error: 'Failed to test JMX connection',
            message: error.message
        });
    }
});

// Get available MBeans for a host
router.get('/mbeans/:host', async (req, res) => {
    try {
        const { host } = req.params;
        const { port } = req.query;
        
        const jmxPort = parseInt(port) || 7199;
        const mbeans = await jmxService.listMBeans(host, jmxPort);
        res.json(mbeans);
    } catch (error) {
        console.error('Error listing MBeans:', error);
        res.status(500).json({
            error: 'Failed to list MBeans',
            message: error.message
        });
    }
});

// Get JMX metrics for a specific host
router.get('/metrics/:host', async (req, res) => {
    try {
        const { host } = req.params;
        const { port } = req.query;
        
        const jmxPort = parseInt(port) || 7199;
        const metrics = await jmxService.getJMXMetrics(host, jmxPort);
        res.json(metrics);
    } catch (error) {
        console.error('Error getting JMX metrics:', error);
        res.status(500).json({
            error: 'Failed to get JMX metrics',
            message: error.message
        });
    }
});

// Discover all available MBeans dynamically (new endpoint)
router.get('/discover/:host', async (req, res) => {
    try {
        const { host } = req.params;
        const port = parseInt(req.query.port) || 7199;
        
        // Get metrics with dynamic discovery
        const result = await jmxService.getJMXMetrics(host, port);
        
        if (result.success) {
            res.json({
                success: true,
                data: {
                    host: result.host,
                    port: result.port,
                    source: result.source,
                    discoveredMetrics: result.metrics,
                    lastUpdate: result.lastUpdate
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                host: result.host,
                port: result.port
            });
        }
    } catch (error) {
        console.error('Error discovering MBeans:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get aggregated JMX metrics for all cluster nodes
router.get('/cluster-metrics', async (req, res) => {
    try {
        if (!db.isConnected) {
            return res.status(400).json({
                error: 'Not connected to any Cassandra cluster'
            });
        }

        // Get cluster nodes from the current connection
        const connectionInfo = db.getConnectionInfo();
        const hosts = connectionInfo.config ? connectionInfo.config.hosts : [];
        
        if (hosts.length === 0) {
            return res.status(400).json({
                error: 'No hosts available in current connection'
            });
        }

        const metrics = await jmxService.getAggregatedMetrics(hosts);
        
        res.json(metrics);
    } catch (error) {
        console.error('Error getting cluster JMX metrics:', error);
        res.status(500).json({
            error: 'Failed to get cluster JMX metrics',
            message: error.message
        });
    }
});

// Get specific MBean value
router.get('/mbean/:host/:mbean', async (req, res) => {
    try {
        const { host, mbean } = req.params;
        const { port, attribute } = req.query;
        
        const jmxPort = parseInt(port) || 7199;
        
        // For demo purposes, return simulated MBean data
        // In production, this would query the actual MBean
        const mbeanData = {
            host,
            port: jmxPort,
            mbean: decodeURIComponent(mbean),
            attribute: attribute || 'Value',
            value: Math.random() * 1000,
            timestamp: new Date().toISOString(),
            success: true
        };

        res.json(mbeanData);
    } catch (error) {
        console.error('Error getting MBean value:', error);
        res.status(500).json({
            error: 'Failed to get MBean value',
            message: error.message
        });
    }
});

// Get aggregated JMX metrics for the cluster
router.get('/cluster-metrics', async (req, res) => {
    try {
        if (!db.isConnected) {
            return res.status(400).json({
                error: 'Not connected to any Cassandra cluster'
            });
        }

        // Get all discovered nodes
        const metricsService = require('../services/metricsService');
        const nodesInfo = await metricsService.getNodesInfo();
        
        const hosts = nodesInfo.map(node => node.address);
        
        const aggregatedMetrics = await jmxService.getAggregatedMetrics(hosts);
        
        res.json(aggregatedMetrics);
    } catch (error) {
        console.error('Error getting cluster JMX metrics:', error);
        res.status(500).json({
            error: 'Failed to get cluster JMX metrics',
            message: error.message
        });
    }
});

// Get JMX metrics for all discovered nodes
router.get('/all-nodes', async (req, res) => {
    try {
        if (!db.isConnected) {
            return res.status(400).json({
                error: 'Not connected to any Cassandra cluster'
            });
        }

        // Get all discovered nodes
        const metricsService = require('../services/metricsService');
        const nodesInfo = await metricsService.getNodesInfo();
        
        const hosts = nodesInfo.map(node => node.address);
        
        const allNodeMetrics = await jmxService.getClusterJMXMetrics(hosts);
        
        res.json(allNodeMetrics);
    } catch (error) {
        console.error('Error getting all nodes JMX metrics:', error);
        res.status(500).json({
            error: 'Failed to get all nodes JMX metrics',
            message: error.message
        });
    }
});


// Disconnect from all JMX connections
router.post('/disconnect', async (req, res) => {
    try {
        const result = await jmxService.disconnectAllJMX();
        res.json(result);
    } catch (error) {
        console.error('Error disconnecting from JMX:', error);
        res.status(500).json({
            error: 'Failed to disconnect from JMX',
            message: error.message
        });
    }
});

// Force disconnect and clear all JMX connections (for recovery)
router.post('/force-disconnect', async (req, res) => {
    try {
        const result = await jmxService.forceDisconnectAllJMX();
        res.json(result);
    } catch (error) {
        console.error('Error force disconnecting from JMX:', error);
        res.status(500).json({
            error: 'Failed to force disconnect from JMX',
            message: error.message
        });
    }
});

// Check JMX connection health
router.get('/health/:host', async (req, res) => {
    try {
        const { host } = req.params;
        const { port } = req.query;
        
        const jmxPort = parseInt(port) || 7199;
        const health = await jmxService.checkJMXConnectionHealth(host, jmxPort);
        
        res.json(health);
    } catch (error) {
        console.error('Error checking JMX connection health:', error);
        res.status(500).json({
            error: 'Failed to check JMX connection health',
            message: error.message
        });
    }
});

module.exports = router;
