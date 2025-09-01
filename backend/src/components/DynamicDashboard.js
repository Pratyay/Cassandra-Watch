import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CassandraDeveloperDashboard = () => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedHost, setSelectedHost] = useState('127.0.0.1');
    const [selectedPort, setSelectedPort] = useState('7199');
    const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
    const [lastUpdate, setLastUpdate] = useState(null);

    // Fetch curated metrics that developers need
    const fetchMetrics = async () => {
        try {
            setLoading(true);
            setError(null);
            
            console.log(`Fetching developer metrics for ${selectedHost}:${selectedPort}`);
            const response = await axios.get(`/api/jmx/metrics/${selectedHost}?port=${selectedPort}`);
            
            if (response.data.success) {
                setMetrics(response.data.metrics);
                setLastUpdate(new Date().toLocaleString());
                console.log('Developer metrics loaded:', response.data.metrics);
            } else {
                setError(response.data.error || 'Failed to fetch metrics');
            }
        } catch (err) {
            console.error('Error fetching metrics:', err);
            setError(err.response?.data?.error || err.message || 'Failed to fetch metrics');
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch and setup refresh interval
    useEffect(() => {
        fetchMetrics();
        
        const interval = setInterval(fetchMetrics, refreshInterval);
        return () => clearInterval(interval);
    }, [selectedHost, selectedPort, refreshInterval]);

    // Get status color based on health
    const getHealthColor = (status) => {
        switch (status) {
            case 'healthy': return '#4CAF50';
            case 'warning': return '#FF9800';
            case 'degraded': return '#FF5722';
            case 'critical': return '#F44336';
            default: return '#9E9E9E';
        }
    };

    // Get efficiency color
    const getEfficiencyColor = (efficiency) => {
        switch (efficiency) {
            case 'excellent': return '#4CAF50';
            case 'good': return '#8BC34A';
            case 'fair': return '#FF9800';
            case 'poor': return '#F44336';
            default: return '#9E9E9E';
        }
    };

    // Render overall health status
    const renderHealthStatus = () => {
        if (!metrics?.health) return null;
        
        const { status, score, issues } = metrics.health;
        
        return (
            <div className="health-overview">
                <div className="health-card">
                    <div className="health-header">
                        <div className="health-score">
                            <div className="score-circle" style={{ borderColor: getHealthColor(status) }}>
                                <span className="score-value">{score}</span>
                                <span className="score-label">Health</span>
                            </div>
                        </div>
                        <div className="health-status">
                            <h2 style={{ color: getHealthColor(status) }}>
                                {status.toUpperCase()}
                            </h2>
                            <p className="status-description">
                                {status === 'healthy' && 'Your Cassandra cluster is performing well 🎉'}
                                {status === 'warning' && 'Some issues detected - monitoring recommended ⚠️'}
                                {status === 'degraded' && 'Performance issues detected - action needed 🔧'}
                                {status === 'critical' && 'Critical issues - immediate attention required 🚨'}
                            </p>
                        </div>
                    </div>
                    
                    {issues.length > 0 && (
                        <div className="health-issues">
                            <h4>🔍 Issues Detected:</h4>
                            <ul>
                                {issues.map((issue, index) => (
                                    <li key={index}>{issue}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Render performance metrics
    const renderPerformanceMetrics = () => {
        if (!metrics?.performance) return null;
        
        const { readLatency, writeLatency, rangeQueryLatency, requestRate } = metrics.performance;
        
        return (
            <div className="metric-card performance-card">
                <h3>🚀 Performance Metrics</h3>
                <div className="performance-grid">
                    <div className="latency-section">
                        <h4>📈 Latency (milliseconds)</h4>
                        <div className="latency-metrics">
                            <div className="latency-item">
                                <span className="metric-name">Read</span>
                                <div className="latency-values">
                                    <span className="latency-mean">{readLatency.mean.toFixed(2)}ms</span>
                                    <span className="latency-percentile">P95: {readLatency.p95.toFixed(2)}ms</span>
                                    <span className="latency-percentile">P99: {readLatency.p99.toFixed(2)}ms</span>
                                </div>
                            </div>
                            <div className="latency-item">
                                <span className="metric-name">Write</span>
                                <div className="latency-values">
                                    <span className="latency-mean">{writeLatency.mean.toFixed(2)}ms</span>
                                    <span className="latency-percentile">P95: {writeLatency.p95.toFixed(2)}ms</span>
                                    <span className="latency-percentile">P99: {writeLatency.p99.toFixed(2)}ms</span>
                                </div>
                            </div>
                            <div className="latency-item">
                                <span className="metric-name">Range Query</span>
                                <div className="latency-values">
                                    <span className="latency-mean">{rangeQueryLatency.mean.toFixed(2)}ms</span>
                                    <span className="latency-percentile">P95: {rangeQueryLatency.p95.toFixed(2)}ms</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="throughput-section">
                        <h4>📊 Request Volume</h4>
                        <div className="throughput-metrics">
                            <div className="throughput-item">
                                <span className="metric-label">Reads:</span>
                                <span className="metric-value">{requestRate.reads.toLocaleString()}</span>
                            </div>
                            <div className="throughput-item">
                                <span className="metric-label">Writes:</span>
                                <span className="metric-value">{requestRate.writes.toLocaleString()}</span>
                            </div>
                            <div className="throughput-item total">
                                <span className="metric-label">Total:</span>
                                <span className="metric-value">{requestRate.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Render error tracking
    const renderErrorMetrics = () => {
        if (!metrics?.errors) return null;
        
        const { timeouts, unavailables, failures, exceptions, errorRate } = metrics.errors;
        
        return (
            <div className="metric-card error-card">
                <h3>🚨 Error Tracking</h3>
                <div className="error-summary">
                    <div className="error-rate" style={{ color: errorRate > 5 ? '#F44336' : errorRate > 1 ? '#FF9800' : '#4CAF50' }}>
                        <span className="rate-value">{errorRate.toFixed(3)}%</span>
                        <span className="rate-label">Error Rate</span>
                    </div>
                </div>
                
                <div className="error-breakdown">
                    <div className="error-category">
                        <h4>⏱️ Timeouts</h4>
                        <div className="error-metrics">
                            <span>Read: {timeouts.read}</span>
                            <span>Write: {timeouts.write}</span>
                            <span className="total">Total: {timeouts.total}</span>
                        </div>
                    </div>
                    
                    <div className="error-category">
                        <h4>📡 Unavailables</h4>
                        <div className="error-metrics">
                            <span>Read: {unavailables.read}</span>
                            <span>Write: {unavailables.write}</span>
                            <span className="total">Total: {unavailables.total}</span>
                        </div>
                    </div>
                    
                    <div className="error-category">
                        <h4>❌ Failures</h4>
                        <div className="error-metrics">
                            <span>Read: {failures.read}</span>
                            <span>Write: {failures.write}</span>
                            <span className="total">Total: {failures.total}</span>
                        </div>
                    </div>
                    
                    <div className="error-category">
                        <h4>💥 Storage Exceptions</h4>
                        <div className="error-metrics">
                            <span className="total">{exceptions.storage}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Render resource utilization
    const renderResourceMetrics = () => {
        if (!metrics?.resources) return null;
        
        const { storage, memory, gc } = metrics.resources;
        
        return (
            <div className="metric-card resource-card">
                <h3>💾 Resource Utilization</h3>
                
                <div className="resource-section">
                    <h4>🗄️ Storage</h4>
                    <div className="storage-metrics">
                        <div className="metric-item">
                            <span className="metric-label">Load:</span>
                            <span className="metric-value">{storage.loadFormatted}</span>
                        </div>
                    </div>
                </div>
                
                <div className="resource-section">
                    <h4>🧠 Memory</h4>
                    <div className="memory-metrics">
                        <div className="memory-bar">
                            <div className="memory-progress">
                                <div 
                                    className="memory-fill" 
                                    style={{ 
                                        width: `${memory.heap.usagePercent}%`,
                                        backgroundColor: memory.heap.usagePercent > 90 ? '#F44336' : 
                                                        memory.heap.usagePercent > 80 ? '#FF9800' : '#4CAF50'
                                    }}
                                ></div>
                            </div>
                            <div className="memory-text">
                                <span>{memory.heap.usedFormatted} / {memory.heap.maxFormatted}</span>
                                <span className="percentage">({memory.heap.usagePercent}%)</span>
                            </div>
                        </div>
                        <div className="non-heap-memory">
                            <span className="metric-label">Non-Heap:</span>
                            <span className="metric-value">{memory.nonHeap.usedFormatted}</span>
                        </div>
                    </div>
                </div>
                
                <div className="resource-section">
                    <h4>🗑️ Garbage Collection</h4>
                    <div className="gc-metrics">
                        <div className="gc-item">
                            <span className="gc-label">Young Gen:</span>
                            <span className="gc-value">{gc.youngGen.collections} collections ({gc.youngGen.time}ms)</span>
                        </div>
                        <div className="gc-item">
                            <span className="gc-label">Old Gen:</span>
                            <span className="gc-value">{gc.oldGen.collections} collections ({gc.oldGen.time}ms)</span>
                        </div>
                        <div className="gc-item total">
                            <span className="gc-label">Total GC Time:</span>
                            <span className="gc-value">{gc.totalTime}ms</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Render cache efficiency
    const renderCacheMetrics = () => {
        if (!metrics?.cache) return null;
        
        const { keyCache, rowCache } = metrics.cache;
        
        return (
            <div className="metric-card cache-card">
                <h3>🗄️ Cache Efficiency</h3>
                
                <div className="cache-section">
                    <h4>🔑 Key Cache</h4>
                    <div className="cache-metrics">
                        <div className="cache-efficiency">
                            <span 
                                className="efficiency-badge" 
                                style={{ backgroundColor: getEfficiencyColor(keyCache.efficiency) }}
                            >
                                {keyCache.efficiency}
                            </span>
                            <span className="hit-rate">{(keyCache.hitRate * 100).toFixed(2)}% hit rate</span>
                        </div>
                        <div className="cache-stats">
                            <span>Requests: {keyCache.requests.toLocaleString()}</span>
                            <span>Hits: {keyCache.hits.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                
                <div className="cache-section">
                    <h4>📋 Row Cache</h4>
                    <div className="cache-metrics">
                        <div className="cache-efficiency">
                            <span 
                                className="efficiency-badge" 
                                style={{ backgroundColor: getEfficiencyColor(rowCache.efficiency) }}
                            >
                                {rowCache.efficiency}
                            </span>
                            <span className="hit-rate">{(rowCache.hitRate * 100).toFixed(2)}% hit rate</span>
                        </div>
                        <div className="cache-stats">
                            <span>Requests: {rowCache.requests.toLocaleString()}</span>
                            <span>Hits: {rowCache.hits.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Render thread pool health
    const renderThreadPoolMetrics = () => {
        if (!metrics?.threadPools) return null;
        
        const { mutation, read, compaction, nativeTransport } = metrics.threadPools;
        
        return (
            <div className="metric-card threadpool-card">
                <h3>🧵 Thread Pool Health</h3>
                
                <div className="threadpool-grid">
                    <div className="threadpool-item">
                        <h4>✏️ Mutation</h4>
                        <div className="threadpool-status" style={{ color: getHealthColor(mutation.status) }}>
                            {mutation.status}
                        </div>
                        <div className="threadpool-stats">
                            <span>Active: {mutation.active}</span>
                            <span>Pending: {mutation.pending}</span>
                            <span>Completed: {mutation.completed.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div className="threadpool-item">
                        <h4>📖 Read</h4>
                        <div className="threadpool-status" style={{ color: getHealthColor(read.status) }}>
                            {read.status}
                        </div>
                        <div className="threadpool-stats">
                            <span>Active: {read.active}</span>
                            <span>Pending: {read.pending}</span>
                            <span>Completed: {read.completed.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div className="threadpool-item">
                        <h4>🔄 Compaction</h4>
                        <div className="threadpool-status" style={{ color: getHealthColor(compaction.status) }}>
                            {compaction.status}
                        </div>
                        <div className="threadpool-stats">
                            <span>Active: {compaction.active}</span>
                            <span>Pending: {compaction.pending}</span>
                            <span>Completed: {compaction.completed.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div className="threadpool-item">
                        <h4>🌐 Transport</h4>
                        <div className="threadpool-status" style={{ color: getHealthColor(nativeTransport.status) }}>
                            {nativeTransport.status}
                        </div>
                        <div className="threadpool-stats">
                            <span>Active: {nativeTransport.active}</span>
                            <span>Pending: {nativeTransport.pending}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Render maintenance metrics
    const renderMaintenanceMetrics = () => {
        if (!metrics?.compaction || !metrics?.hints) return null;
        
        const { compaction, hints } = metrics;
        
        return (
            <div className="metric-card maintenance-card">
                <h3>🔧 Maintenance & Housekeeping</h3>
                
                <div className="maintenance-grid">
                    <div className="maintenance-section">
                        <h4>🔄 Compaction</h4>
                        <div className="compaction-status" style={{ color: getHealthColor(compaction.status === 'current' ? 'healthy' : compaction.status === 'active' ? 'warning' : 'critical') }}>
                            {compaction.status}
                        </div>
                        <div className="maintenance-stats">
                            <span>Pending: {compaction.pendingTasks}</span>
                            <span>Completed: {compaction.completedTasks.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div className="maintenance-section">
                        <h4>📮 Hints</h4>
                        <div className="hints-status" style={{ color: getHealthColor(hints.status === 'low' ? 'healthy' : hints.status === 'moderate' ? 'warning' : 'critical') }}>
                            {hints.status}
                        </div>
                        <div className="maintenance-stats">
                            <span>Total Hints: {hints.totalHints.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Render connection controls
    const renderControls = () => (
        <div className="dashboard-controls">
            <div className="connection-controls">
                <div className="control-group">
                    <label>Host:</label>
                    <input
                        type="text"
                        value={selectedHost}
                        onChange={(e) => setSelectedHost(e.target.value)}
                        placeholder="127.0.0.1"
                    />
                </div>
                <div className="control-group">
                    <label>Port:</label>
                    <input
                        type="number"
                        value={selectedPort}
                        onChange={(e) => setSelectedPort(e.target.value)}
                        placeholder="7199"
                    />
                </div>
                <div className="control-group">
                    <label>Refresh:</label>
                    <select
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                    >
                        <option value={10000}>10 seconds</option>
                        <option value={30000}>30 seconds</option>
                        <option value={60000}>1 minute</option>
                        <option value={300000}>5 minutes</option>
                    </select>
                </div>
                <button onClick={fetchMetrics} disabled={loading}>
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
            </div>
            {lastUpdate && (
                <div className="last-update-info">
                    Last updated: {lastUpdate}
                </div>
            )}
        </div>
    );

    return (
        <div className="cassandra-developer-dashboard">
            <div className="dashboard-header">
                <h1>📊 Cassandra Developer Dashboard</h1>
                <p>Monitor the metrics that matter most for your application development</p>
            </div>

            {renderControls()}

            {loading && (
                <div className="loading-indicator">
                    <div className="spinner"></div>
                    <p>Loading Cassandra metrics...</p>
                </div>
            )}

            {error && (
                <div className="error-message">
                    <h3>❌ Connection Error</h3>
                    <p>{error}</p>
                    <button onClick={fetchMetrics}>Retry Connection</button>
                </div>
            )}

            {!loading && !error && metrics && (
                <div className="dashboard-content">
                    {renderHealthStatus()}
                    
                    <div className="metrics-grid">
                        {renderPerformanceMetrics()}
                        {renderErrorMetrics()}
                        {renderResourceMetrics()}
                        {renderCacheMetrics()}
                        {renderThreadPoolMetrics()}
                        {renderMaintenanceMetrics()}
                    </div>
                </div>
            )}

            <style jsx>{`
                .cassandra-developer-dashboard {
                    padding: 20px;
                    max-width: 1400px;
                    margin: 0 auto;
                    background: #f8f9fa;
                    min-height: 100vh;
                }

                .dashboard-header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding: 30px;
                    background: linear-gradient(135deg, #2E3440 0%, #4C566A 100%);
                    color: white;
                    border-radius: 15px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                }

                .dashboard-header h1 {
                    margin: 0 0 10px 0;
                    font-size: 2.8em;
                    font-weight: 700;
                }

                .dashboard-header p {
                    margin: 0;
                    opacity: 0.9;
                    font-size: 1.1em;
                }

                .dashboard-controls {
                    background: white;
                    padding: 25px;
                    border-radius: 15px;
                    margin-bottom: 30px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
                    border: 1px solid #e9ecef;
                }

                .connection-controls {
                    display: flex;
                    gap: 20px;
                    align-items: end;
                    flex-wrap: wrap;
                    justify-content: center;
                }

                .control-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .control-group label {
                    font-weight: 600;
                    font-size: 0.9em;
                    color: #495057;
                }

                .control-group input,
                .control-group select {
                    padding: 12px 16px;
                    border: 2px solid #dee2e6;
                    border-radius: 8px;
                    font-size: 0.95em;
                    transition: border-color 0.3s, box-shadow 0.3s;
                }

                .control-group input:focus,
                .control-group select:focus {
                    outline: none;
                    border-color: #4CAF50;
                    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
                }

                .dashboard-controls button {
                    padding: 12px 24px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.95em;
                    transition: all 0.3s;
                    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.2);
                }

                .dashboard-controls button:hover:not(:disabled) {
                    background: #45a049;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
                }

                .dashboard-controls button:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .last-update-info {
                    text-align: center;
                    margin-top: 15px;
                    color: #6c757d;
                    font-size: 0.9em;
                }

                .loading-indicator {
                    text-align: center;
                    padding: 60px;
                }

                .spinner {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #4CAF50;
                    border-radius: 50%;
                    width: 60px;
                    height: 60px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 25px;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .error-message {
                    background: #fff5f5;
                    border: 2px solid #f56565;
                    border-radius: 15px;
                    padding: 30px;
                    text-align: center;
                    color: #c53030;
                    box-shadow: 0 4px 16px rgba(245, 101, 101, 0.1);
                }

                .error-message h3 {
                    margin: 0 0 15px 0;
                    font-size: 1.3em;
                }

                .error-message button {
                    background: #f56565;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-top: 20px;
                    font-weight: 600;
                    transition: background 0.3s;
                }

                .error-message button:hover {
                    background: #e53e3e;
                }

                .health-overview {
                    margin-bottom: 30px;
                }

                .health-card {
                    background: white;
                    border-radius: 15px;
                    padding: 30px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
                    border: 1px solid #e9ecef;
                }

                .health-header {
                    display: flex;
                    align-items: center;
                    gap: 30px;
                    margin-bottom: 20px;
                }

                .health-score {
                    display: flex;
                    align-items: center;
                }

                .score-circle {
                    width: 120px;
                    height: 120px;
                    border: 6px solid;
                    border-radius: 50%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    background: white;
                }

                .score-value {
                    font-size: 2.5em;
                    font-weight: 700;
                    color: #2d3748;
                }

                .score-label {
                    font-size: 0.9em;
                    color: #718096;
                    margin-top: -5px;
                }

                .health-status h2 {
                    margin: 0 0 10px 0;
                    font-size: 2.2em;
                    font-weight: 700;
                }

                .status-description {
                    margin: 0;
                    font-size: 1.1em;
                    color: #4a5568;
                    line-height: 1.5;
                }

                .health-issues {
                    background: #fff5f5;
                    border: 1px solid #fed7d7;
                    border-radius: 10px;
                    padding: 20px;
                    margin-top: 20px;
                }

                .health-issues h4 {
                    margin: 0 0 15px 0;
                    color: #c53030;
                }

                .health-issues ul {
                    margin: 0;
                    padding-left: 20px;
                }

                .health-issues li {
                    margin-bottom: 8px;
                    color: #744210;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 25px;
                }

                .metric-card {
                    background: white;
                    border-radius: 15px;
                    padding: 25px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
                    border: 1px solid #e9ecef;
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .metric-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
                }

                .metric-card h3 {
                    margin: 0 0 20px 0;
                    color: #2d3748;
                    font-size: 1.3em;
                    font-weight: 600;
                    border-bottom: 3px solid #e2e8f0;
                    padding-bottom: 12px;
                }

                .performance-grid {
                    display: grid;
                    gap: 25px;
                }

                .latency-section h4,
                .throughput-section h4 {
                    margin: 0 0 15px 0;
                    color: #4a5568;
                    font-size: 1.1em;
                }

                .latency-metrics {
                    display: grid;
                    gap: 15px;
                }

                .latency-item {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 10px;
                    border-left: 4px solid #4CAF50;
                }

                .metric-name {
                    font-weight: 600;
                    color: #2d3748;
                    display: block;
                    margin-bottom: 8px;
                }

                .latency-values {
                    display: flex;
                    gap: 15px;
                    flex-wrap: wrap;
                }

                .latency-mean {
                    font-weight: 700;
                    color: #2d3748;
                    font-size: 1.1em;
                }

                .latency-percentile {
                    color: #718096;
                    font-size: 0.95em;
                }

                .throughput-metrics {
                    display: grid;
                    gap: 12px;
                }

                .throughput-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }

                .throughput-item.total {
                    background: #e6fffa;
                    border-left: 4px solid #38b2ac;
                    font-weight: 600;
                }

                .error-summary {
                    text-align: center;
                    margin-bottom: 25px;
                }

                .error-rate {
                    display: inline-flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 15px;
                    border: 2px solid #e9ecef;
                }

                .rate-value {
                    font-size: 2.5em;
                    font-weight: 700;
                    margin-bottom: 5px;
                }

                .rate-label {
                    font-size: 0.9em;
                    color: #718096;
                    text-transform: uppercase;
                    font-weight: 600;
                }

                .error-breakdown {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                }

                .error-category {
                    background: #f8f9fa;
                    padding: 18px;
                    border-radius: 12px;
                    border-left: 4px solid #f56565;
                }

                .error-category h4 {
                    margin: 0 0 12px 0;
                    color: #2d3748;
                    font-size: 1em;
                }

                .error-metrics {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .error-metrics span {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.9em;
                    color: #4a5568;
                }

                .error-metrics .total {
                    font-weight: 600;
                    color: #2d3748;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 8px;
                    margin-top: 4px;
                }

                .resource-section {
                    margin-bottom: 25px;
                }

                .resource-section:last-child {
                    margin-bottom: 0;
                }

                .resource-section h4 {
                    margin: 0 0 15px 0;
                    color: #4a5568;
                    font-size: 1.1em;
                    border-left: 4px solid #4CAF50;
                    padding-left: 12px;
                }

                .storage-metrics,
                .memory-metrics,
                .gc-metrics {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 10px;
                }

                .memory-bar {
                    margin-bottom: 15px;
                }

                .memory-progress {
                    width: 100%;
                    height: 20px;
                    background: #e9ecef;
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }

                .memory-fill {
                    height: 100%;
                    transition: width 0.3s, background-color 0.3s;
                    border-radius: 10px;
                }

                .memory-text {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.9em;
                    color: #4a5568;
                }

                .percentage {
                    font-weight: 600;
                }

                .non-heap-memory {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 0;
                    border-top: 1px solid #e2e8f0;
                    margin-top: 10px;
                }

                .gc-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid #e2e8f0;
                }

                .gc-item:last-child {
                    border-bottom: none;
                }

                .gc-item.total {
                    font-weight: 600;
                    color: #2d3748;
                    border-top: 2px solid #e2e8f0;
                    margin-top: 8px;
                    padding-top: 12px;
                }

                .cache-section {
                    margin-bottom: 25px;
                }

                .cache-section:last-child {
                    margin-bottom: 0;
                }

                .cache-section h4 {
                    margin: 0 0 15px 0;
                    color: #4a5568;
                    font-size: 1.1em;
                    border-left: 4px solid #38b2ac;
                    padding-left: 12px;
                }

                .cache-metrics {
                    background: #f8f9fa;
                    padding: 18px;
                    border-radius: 10px;
                }

                .cache-efficiency {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }

                .efficiency-badge {
                    padding: 8px 16px;
                    border-radius: 20px;
                    color: white;
                    font-weight: 600;
                    font-size: 0.9em;
                    text-transform: uppercase;
                }

                .hit-rate {
                    font-size: 1.1em;
                    font-weight: 600;
                    color: #2d3748;
                }

                .cache-stats {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.95em;
                    color: #4a5568;
                }

                .threadpool-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                }

                .threadpool-item {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 12px;
                    border-left: 4px solid #667eea;
                }

                .threadpool-item h4 {
                    margin: 0 0 12px 0;
                    color: #2d3748;
                    font-size: 1em;
                }

                .threadpool-status {
                    font-weight: 600;
                    font-size: 1.1em;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                }

                .threadpool-stats {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    font-size: 0.9em;
                    color: #4a5568;
                }

                .maintenance-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 25px;
                }

                .maintenance-section {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 12px;
                    border-left: 4px solid #ed8936;
                }

                .maintenance-section h4 {
                    margin: 0 0 15px 0;
                    color: #2d3748;
                    font-size: 1.1em;
                }

                .compaction-status,
                .hints-status {
                    font-weight: 600;
                    font-size: 1.2em;
                    margin-bottom: 15px;
                    text-transform: capitalize;
                }

                .maintenance-stats {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    font-size: 0.95em;
                    color: #4a5568;
                }

                @media (max-width: 768px) {
                    .cassandra-developer-dashboard {
                        padding: 15px;
                    }
                    
                    .connection-controls {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    
                    .health-header {
                        flex-direction: column;
                        text-align: center;
                    }
                    
                    .metrics-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .performance-grid,
                    .error-breakdown,
                    .threadpool-grid,
                    .maintenance-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .latency-values {
                        flex-direction: column;
                        gap: 8px;
                    }
                }

                @media (max-width: 480px) {
                    .dashboard-header h1 {
                        font-size: 2.2em;
                    }
                    
                    .score-circle {
                        width: 100px;
                        height: 100px;
                    }
                    
                    .score-value {
                        font-size: 2em;
                    }
                }
            `}</style>
        </div>
    );
};

export default CassandraDeveloperDashboard;
