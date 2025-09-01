const express = require('express');
const router = express.Router();
const db = require('../config/database');
const websocketService = require('../services/websocketService');

// Test connection to a cluster
router.post('/test', async (req, res) => {
    try {
        const { hosts, port, datacenter, username, password } = req.body;
        
        if (!hosts || hosts.length === 0) {
            return res.status(400).json({
                error: 'At least one host is required'
            });
        }

        const config = {
            hosts: Array.isArray(hosts) ? hosts : [hosts],
            port: parseInt(port) || 9042,
            datacenter: datacenter || 'datacenter1',
            username: username || '',
            password: password || ''
        };

        const result = await db.testConnection(config);
        res.json(result);
    } catch (error) {
        console.error('Error testing connection:', error);
        res.status(500).json({
            error: 'Failed to test connection',
            message: error.message
        });
    }
});

// Connect to a cluster
router.post('/connect', async (req, res) => {
    try {
        const { hosts, port, datacenter, username, password } = req.body;
        
        if (!hosts || hosts.length === 0) {
            return res.status(400).json({
                error: 'At least one host is required'
            });
        }

        const config = {
            hosts: Array.isArray(hosts) ? hosts : [hosts],
            port: parseInt(port) || 9042,
            datacenter: datacenter || 'datacenter1',
            username: username || '',
            password: password || ''
        };

        const result = await db.connect(config);
        
        // Send initial data to any connected WebSocket clients after successful connection
        if (result.success) {
            setTimeout(() => {
                websocketService.broadcastInitialDataToAll();
            }, 1000); // Give the connection a moment to stabilize
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error connecting to cluster:', error);
        res.status(500).json({
            error: 'Failed to connect to cluster',
            message: error.message
        });
    }
});

// Disconnect from current cluster
router.post('/disconnect', async (req, res) => {
    try {
        await db.disconnect();
        res.json({
            success: true,
            message: 'Disconnected from cluster'
        });
    } catch (error) {
        console.error('Error disconnecting:', error);
        res.status(500).json({
            error: 'Failed to disconnect',
            message: error.message
        });
    }
});

// Get current connection info
router.get('/info', async (req, res) => {
    try {
        const info = db.getConnectionInfo();
        res.json(info);
    } catch (error) {
        console.error('Error getting connection info:', error);
        res.status(500).json({
            error: 'Failed to get connection info',
            message: error.message
        });
    }
});

module.exports = router;
