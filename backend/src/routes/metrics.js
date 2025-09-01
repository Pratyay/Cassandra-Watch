const express = require('express');
const router = express.Router();
const metricsService = require('../services/metricsService');

// Get all metrics
router.get('/', async (req, res) => {
    try {
        const metrics = await metricsService.getAllMetrics();
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ 
            error: 'Failed to fetch metrics', 
            message: error.message 
        });
    }
});

// Get cluster information
router.get('/cluster', async (req, res) => {
    try {
        const clusterInfo = await metricsService.getClusterInfo();
        res.json(clusterInfo);
    } catch (error) {
        console.error('Error fetching cluster info:', error);
        res.status(500).json({ 
            error: 'Failed to fetch cluster information', 
            message: error.message 
        });
    }
});

// Get nodes information
router.get('/nodes', async (req, res) => {
    try {
        const nodesInfo = await metricsService.getNodesInfo();
        res.json(nodesInfo);
    } catch (error) {
        console.error('Error fetching nodes info:', error);
        res.status(500).json({ 
            error: 'Failed to fetch nodes information', 
            message: error.message 
        });
    }
});

// Get keyspaces information
router.get('/keyspaces', async (req, res) => {
    try {
        const keyspaces = await metricsService.getKeyspacesInfo();
        res.json(keyspaces);
    } catch (error) {
        console.error('Error fetching keyspaces info:', error);
        res.status(500).json({ 
            error: 'Failed to fetch keyspaces information', 
            message: error.message 
        });
    }
});

// Get tables for a specific keyspace
router.get('/keyspaces/:keyspace/tables', async (req, res) => {
    try {
        const { keyspace } = req.params;
        const tables = await metricsService.getTableInfo(keyspace);
        res.json(tables);
    } catch (error) {
        console.error('Error fetching table info:', error);
        res.status(500).json({ 
            error: 'Failed to fetch table information', 
            message: error.message 
        });
    }
});

// Get performance metrics
router.get('/performance', async (req, res) => {
    try {
        const performance = await metricsService.getPerformanceMetrics();
        res.json(performance);
    } catch (error) {
        console.error('Error fetching performance metrics:', error);
        res.status(500).json({ 
            error: 'Failed to fetch performance metrics', 
            message: error.message 
        });
    }
});

// Get system metrics
router.get('/system', async (req, res) => {
    try {
        const systemMetrics = await metricsService.getSystemMetrics();
        res.json(systemMetrics);
    } catch (error) {
        console.error('Error fetching system metrics:', error);
        res.status(500).json({ 
            error: 'Failed to fetch system metrics', 
            message: error.message 
        });
    }
});

// Get storage metrics
router.get('/storage', async (req, res) => {
    try {
        const storage = await metricsService.getStorageMetrics();
        res.json(storage);
    } catch (error) {
        console.error('Error fetching storage metrics:', error);
        res.status(500).json({ 
            error: 'Failed to fetch storage metrics', 
            message: error.message 
        });
    }
});

// Get cached metrics (faster response)
router.get('/cache', async (req, res) => {
    try {
        const cache = metricsService.getCache();
        res.json(cache);
    } catch (error) {
        console.error('Error fetching cached metrics:', error);
        res.status(500).json({ 
            error: 'Failed to fetch cached metrics', 
            message: error.message 
        });
    }
});

module.exports = router;
