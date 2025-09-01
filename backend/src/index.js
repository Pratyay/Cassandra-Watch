const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./config/database');
const metricsRoutes = require('./routes/metrics');
const nodetoolMetricsRoutes = require('./routes/nodetoolMetrics');
const operationsRoutes = require('./routes/operations');
const connectionRoutes = require('./routes/connections');
const jmxRoutes = require('./routes/jmx');
const websocketService = require('./services/websocketService');

const app = express();
const port = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});
app.use(limiter);

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        cassandraConnected: db.isConnected,
        uptime: process.uptime()
    });
});

// API routes
app.use('/api/metrics', metricsRoutes);
app.use('/api/nodetool', nodetoolMetricsRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/jmx', jmxRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(isDevelopment && { stack: err.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket service
websocketService.initialize(server);

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    
    // Stop WebSocket service
    websocketService.stop();
    
    // Close HTTP server
    server.close(() => {
        console.log('HTTP server closed');
    });
    
    // Disconnect from Cassandra
    try {
        await db.disconnect();
    } catch (error) {
        console.error('Error disconnecting from Cassandra:', error);
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    
    // Stop WebSocket service
    websocketService.stop();
    
    // Close HTTP server
    server.close(() => {
        console.log('HTTP server closed');
    });
    
    // Disconnect from Cassandra
    try {
        await db.disconnect();
    } catch (error) {
        console.error('Error disconnecting from Cassandra:', error);
    }
    
    process.exit(0);
});

// Start server
async function startServer() {
    try {
        // Start HTTP server without requiring initial Cassandra connection
        server.listen(port, () => {
            console.log(`🚀 Cassandra UI Backend running on http://localhost:${port}`);
            console.log(`📊 WebSocket endpoint available at ws://localhost:${port}/ws`);
            console.log(`🩺 Health check at http://localhost:${port}/health`);
            console.log(`🔗 Connect to your cluster via the UI at http://localhost:3000`);
        });
        
        console.log('ℹ️  Ready for manual Cassandra connection via the UI.');
        console.log('🔗 Use the connection form at http://localhost:3000 to connect to your cluster.');
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
