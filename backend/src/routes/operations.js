const express = require('express');
const router = express.Router();
const operationsService = require('../services/operationsService');

// Get cluster status
router.get('/cluster/status', async (req, res) => {
    try {
        const result = await operationsService.getClusterStatus();
        res.json(result);
    } catch (error) {
        console.error('Error getting cluster status:', error);
        res.status(500).json({ 
            error: 'Failed to get cluster status', 
            message: error.message 
        });
    }
});

// Get cluster info
router.get('/cluster/info', async (req, res) => {
    try {
        const result = await operationsService.getClusterInfo();
        res.json(result);
    } catch (error) {
        console.error('Error getting cluster info:', error);
        res.status(500).json({ 
            error: 'Failed to get cluster info', 
            message: error.message 
        });
    }
});

// Repair operations
router.post('/repair/:keyspace?', async (req, res) => {
    try {
        const keyspace = req.params.keyspace || 'all';
        const options = req.body || {};
        
        const result = await operationsService.repairKeyspace(keyspace, options);
        res.json(result);
    } catch (error) {
        console.error('Error starting repair:', error);
        res.status(500).json({ 
            error: 'Failed to start repair', 
            message: error.message 
        });
    }
});

// Compact operations
router.post('/compact/:keyspace?', async (req, res) => {
    try {
        const keyspace = req.params.keyspace || 'all';
        
        const result = await operationsService.compactKeyspace(keyspace);
        res.json(result);
    } catch (error) {
        console.error('Error starting compaction:', error);
        res.status(500).json({ 
            error: 'Failed to start compaction', 
            message: error.message 
        });
    }
});

// Flush operations
router.post('/flush/:keyspace?', async (req, res) => {
    try {
        const keyspace = req.params.keyspace || 'all';
        
        const result = await operationsService.flushKeyspace(keyspace);
        res.json(result);
    } catch (error) {
        console.error('Error flushing keyspace:', error);
        res.status(500).json({ 
            error: 'Failed to flush keyspace', 
            message: error.message 
        });
    }
});

// Cleanup operations
router.post('/cleanup/:keyspace?', async (req, res) => {
    try {
        const keyspace = req.params.keyspace || 'all';
        
        const result = await operationsService.cleanup(keyspace);
        res.json(result);
    } catch (error) {
        console.error('Error starting cleanup:', error);
        res.status(500).json({ 
            error: 'Failed to start cleanup', 
            message: error.message 
        });
    }
});

// Scrub operations
router.post('/scrub/:keyspace?', async (req, res) => {
    try {
        const keyspace = req.params.keyspace || 'all';
        
        const result = await operationsService.scrubKeyspace(keyspace);
        res.json(result);
    } catch (error) {
        console.error('Error starting scrub:', error);
        res.status(500).json({ 
            error: 'Failed to start scrub', 
            message: error.message 
        });
    }
});

// Drain node
router.post('/drain', async (req, res) => {
    try {
        const result = await operationsService.drainNode();
        res.json(result);
    } catch (error) {
        console.error('Error draining node:', error);
        res.status(500).json({ 
            error: 'Failed to drain node', 
            message: error.message 
        });
    }
});

// Create keyspace
router.post('/keyspace', async (req, res) => {
    try {
        const { name, replicationStrategy } = req.body;
        
        if (!name || !replicationStrategy) {
            return res.status(400).json({
                error: 'Missing required fields: name and replicationStrategy'
            });
        }
        
        const result = await operationsService.createKeyspace(name, replicationStrategy);
        res.json(result);
    } catch (error) {
        console.error('Error creating keyspace:', error);
        res.status(500).json({ 
            error: 'Failed to create keyspace', 
            message: error.message 
        });
    }
});

// Drop keyspace
router.delete('/keyspace/:name', async (req, res) => {
    try {
        const { name } = req.params;
        
        const result = await operationsService.dropKeyspace(name);
        res.json(result);
    } catch (error) {
        console.error('Error dropping keyspace:', error);
        res.status(500).json({ 
            error: 'Failed to drop keyspace', 
            message: error.message 
        });
    }
});

// Execute CQL query
router.post('/query', async (req, res) => {
    try {
        const { query, consistency } = req.body;
        
        if (!query) {
            return res.status(400).json({
                error: 'Missing required field: query'
            });
        }
        
        const result = await operationsService.executeQuery(query, consistency);
        res.json(result);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ 
            error: 'Failed to execute query', 
            message: error.message 
        });
    }
});

// Get active operations
router.get('/active', async (req, res) => {
    try {
        const operations = await operationsService.getActiveOperations();
        res.json(operations);
    } catch (error) {
        console.error('Error getting active operations:', error);
        res.status(500).json({ 
            error: 'Failed to get active operations', 
            message: error.message 
        });
    }
});

// Get operation status
router.get('/status/:operationId', async (req, res) => {
    try {
        const { operationId } = req.params;
        const operation = operationsService.getOperationStatus(operationId);
        
        if (!operation) {
            return res.status(404).json({
                error: 'Operation not found'
            });
        }
        
        res.json(operation);
    } catch (error) {
        console.error('Error getting operation status:', error);
        res.status(500).json({ 
            error: 'Failed to get operation status', 
            message: error.message 
        });
    }
});

// Get compaction stats
router.get('/stats/compaction', async (req, res) => {
    try {
        const result = await operationsService.getCompactionStats();
        res.json(result);
    } catch (error) {
        console.error('Error getting compaction stats:', error);
        res.status(500).json({ 
            error: 'Failed to get compaction stats', 
            message: error.message 
        });
    }
});

// Get thread pool stats
router.get('/stats/threadpool', async (req, res) => {
    try {
        const result = await operationsService.getThreadPoolStats();
        res.json(result);
    } catch (error) {
        console.error('Error getting thread pool stats:', error);
        res.status(500).json({ 
            error: 'Failed to get thread pool stats', 
            message: error.message 
        });
    }
});

// Get GC stats
router.get('/stats/gc', async (req, res) => {
    try {
        const result = await operationsService.getGCStats();
        res.json(result);
    } catch (error) {
        console.error('Error getting GC stats:', error);
        res.status(500).json({ 
            error: 'Failed to get GC stats', 
            message: error.message 
        });
    }
});

// Browse table data
router.get('/browse/:keyspace/:table', async (req, res) => {
    try {
        const { keyspace, table } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        
        const query = `SELECT * FROM ${keyspace}.${table} LIMIT ${limit}`;
        const result = await operationsService.executeQuery(query);
        
        res.json({
            ...result,
            keyspace,
            table,
            limit
        });
    } catch (error) {
        console.error('Error browsing table data:', error);
        res.status(500).json({ 
            error: 'Failed to browse table data', 
            message: error.message 
        });
    }
});

// Get table schema
router.get('/schema/:keyspace/:table', async (req, res) => {
    try {
        const { keyspace, table } = req.params;
        
        const query = `SELECT column_name, type, kind FROM system_schema.columns WHERE keyspace_name = '${keyspace}' AND table_name = '${table}'`;
        const result = await operationsService.executeQuery(query);
        
        res.json({
            ...result,
            keyspace,
            table
        });
    } catch (error) {
        console.error('Error getting table schema:', error);
        res.status(500).json({ 
            error: 'Failed to get table schema', 
            message: error.message 
        });
    }
});

module.exports = router;
