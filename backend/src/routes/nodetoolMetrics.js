const express = require('express');
const router = express.Router();
const nodetoolMetricsService = require('../services/nodetoolMetricsService');

// Get all nodetool metrics
router.get('/', async (req, res) => {
    try {
        const metrics = await nodetoolMetricsService.getAllNodetoolMetrics();
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching nodetool metrics:', error);
        res.status(500).json({ 
            error: 'Failed to fetch nodetool metrics', 
            message: error.message 
        });
    }
});

// Get cluster status via nodetool
router.get('/cluster/status', async (req, res) => {
    try {
        const status = await nodetoolMetricsService.getClusterStatus();
        res.json(status);
    } catch (error) {
        console.error('Error fetching cluster status:', error);
        res.status(500).json({ 
            error: 'Failed to fetch cluster status', 
            message: error.message 
        });
    }
});

// Get cluster info via nodetool
router.get('/cluster/info', async (req, res) => {
    try {
        const info = await nodetoolMetricsService.getClusterInfo();
        res.json(info);
    } catch (error) {
        console.error('Error fetching cluster info:', error);
        res.status(500).json({ 
            error: 'Failed to fetch cluster info', 
            message: error.message 
        });
    }
});

// Get compaction stats via nodetool
router.get('/compaction', async (req, res) => {
    try {
        const stats = await nodetoolMetricsService.getCompactionStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching compaction stats:', error);
        res.status(500).json({ 
            error: 'Failed to fetch compaction stats', 
            message: error.message 
        });
    }
});

// Get thread pool stats via nodetool
router.get('/threadpools', async (req, res) => {
    try {
        const stats = await nodetoolMetricsService.getThreadPoolStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching thread pool stats:', error);
        res.status(500).json({ 
            error: 'Failed to fetch thread pool stats', 
            message: error.message 
        });
    }
});

// Get GC stats via nodetool
router.get('/gc', async (req, res) => {
    try {
        const stats = await nodetoolMetricsService.getGCStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching GC stats:', error);
        res.status(500).json({ 
            error: 'Failed to fetch GC stats', 
            message: error.message 
        });
    }
});

// Get proxy histograms via nodetool
router.get('/histograms', async (req, res) => {
    try {
        const histograms = await nodetoolMetricsService.getProxyHistograms();
        res.json(histograms);
    } catch (error) {
        console.error('Error fetching proxy histograms:', error);
        res.status(500).json({ 
            error: 'Failed to fetch proxy histograms', 
            message: error.message 
        });
    }
});

// Get cached nodetool metrics (faster response)
router.get('/cache', async (req, res) => {
    try {
        const cache = nodetoolMetricsService.getCache();
        res.json(cache);
    } catch (error) {
        console.error('Error fetching cached nodetool metrics:', error);
        res.status(500).json({ 
            error: 'Failed to fetch cached nodetool metrics', 
            message: error.message 
        });
    }
});

module.exports = router; 