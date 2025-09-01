import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  LinearProgress,
  Chip,
  Button,
  Switch,
  FormControlLabel,
  Stack,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';
import { useWebSocket } from '../contexts/WebSocketContext';
import ApiService from '../services/api';

const Dashboard: React.FC = () => {
  const { metrics, isConnected, isWebSocketConnected } = useWebSocket();
  const [jmxLoading, setJmxLoading] = useState(true);
  const [jmxData, setJmxData] = useState<any>(null);
  const [jmxError, setJmxError] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch JMX data function
  const fetchJMXData = useCallback(async (isAutoRefresh = false) => {
    try {
      if (isAutoRefresh) {
        setIsRefreshing(true);
      } else {
        setJmxLoading(true);
      }
      setJmxError('');
      
      console.log('Dashboard: Fetching JMX data directly...');
      const allNodesData = await ApiService.getAllNodesJMXMetrics();
      
      console.log('Dashboard: JMX data received:', { 
        nodesCount: allNodesData?.nodes?.length || 0, 
        success: allNodesData?.success,
        hasNodes: !!allNodesData?.nodes
      });
      
      // Create aggregated metrics from all nodes data
      let aggregatedMetrics = null;
      if (allNodesData?.success && allNodesData?.nodes?.length > 0) {
        // Calculate aggregated metrics from individual nodes
        const nodes = allNodesData.nodes.filter((node: any) => node.success && node.metrics);
        
        if (nodes.length > 0) {
          aggregatedMetrics = {
            performance: {
              readLatency: {
                mean: nodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.readLatency?.mean || 0), 0) / nodes.length,
                p95: Math.max(...nodes.map((node: any) => node.metrics.performance?.readLatency?.p95 || 0)),
                p99: Math.max(...nodes.map((node: any) => node.metrics.performance?.readLatency?.p99 || 0))
              },
              writeLatency: {
                mean: nodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.writeLatency?.mean || 0), 0) / nodes.length,
                p95: Math.max(...nodes.map((node: any) => node.metrics.performance?.writeLatency?.p95 || 0)),
                p99: Math.max(...nodes.map((node: any) => node.metrics.performance?.writeLatency?.p99 || 0))
              },
              requestRate: {
                reads: nodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.requestRate?.reads || 0), 0),
                writes: nodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.requestRate?.writes || 0), 0),
                total: nodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.requestRate?.total || 0), 0)
              }
            },
            resources: {
              memory: {
                heap: {
                  used: nodes.reduce((sum: number, node: any) => sum + (node.metrics.resources?.memory?.heap?.used || 0), 0),
                  max: nodes.reduce((sum: number, node: any) => sum + (node.metrics.resources?.memory?.heap?.max || 0), 0),
                  usagePercent: nodes.reduce((sum: number, node: any) => sum + (node.metrics.resources?.memory?.heap?.usagePercent || 0), 0) / nodes.length
                }
              },
              storage: {
                totalLoad: nodes.reduce((sum: number, node: any) => sum + (node.metrics.resources?.storage?.load || 0), 0)
              }
            },
            cache: {
              keyCache: {
                hitRate: nodes.reduce((sum: number, node: any) => sum + (node.metrics.cache?.keyCache?.hitRate || 0), 0) / nodes.length,
                requests: nodes.reduce((sum: number, node: any) => sum + (node.metrics.cache?.keyCache?.requests || 0), 0),
                hits: nodes.reduce((sum: number, node: any) => sum + (node.metrics.cache?.keyCache?.hits || 0), 0)
              }
            },
            errors: {
              timeouts: {
                total: nodes.reduce((sum: number, node: any) => sum + (node.metrics.errors?.timeouts?.total || 0), 0)
              },
              unavailables: {
                total: nodes.reduce((sum: number, node: any) => sum + (node.metrics.errors?.unavailables?.total || 0), 0)
              },
              errorRate: 0 // Initialize errorRate property
            }
          };
          
          // Calculate error rate based on total errors vs total requests
          if (aggregatedMetrics) {
            const totalErrors = aggregatedMetrics.errors.timeouts.total + aggregatedMetrics.errors.unavailables.total;
            const totalRequests = aggregatedMetrics.performance.requestRate.total;
            aggregatedMetrics.errors.errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
          }
        }
      }
      
      const clusterData = {
        success: !!aggregatedMetrics,
        aggregated: aggregatedMetrics,
        error: aggregatedMetrics ? null : 'No JMX data available from nodes'
      };
      
      setJmxData({ allNodesData, clusterData });
      setLastRefresh(new Date());
    } catch (error: any) {
      console.error('Dashboard: Error fetching JMX data:', error);
      setJmxError(error.message || 'Failed to fetch JMX data');
    } finally {
      if (isAutoRefresh) {
        setIsRefreshing(false);
      } else {
        setJmxLoading(false);
      }
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchJMXData();
  }, [fetchJMXData]);

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchJMXData(true); // Pass true for auto-refresh
      }, 2000); // Refresh every 2 seconds
      
      setRefreshInterval(interval);
      
      return () => {
        clearInterval(interval);
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [autoRefresh, fetchJMXData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  if (!isConnected) {
    return (
      <Alert severity="error">
        Not connected to Cassandra cluster. Please check your connection.
      </Alert>
    );
  }

  if (!metrics) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading cluster metrics...
        </Typography>
      </Box>
    );
  }

  if (jmxLoading && !jmxData) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Connecting to JMX and loading cluster metrics...
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Establishing JMX connections to cluster nodes...
        </Typography>
      </Box>
    );
  }

  const { cluster, keyspaces, performance, storage } = metrics;
  
  // Check if we have JMX data from direct API calls
  const hasJmxMetrics = jmxData?.clusterData?.success && jmxData?.clusterData?.aggregated;
  const jmxMetrics = jmxData?.clusterData?.aggregated;

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatLatency = (latency: number) => {
    if (latency < 1) return `${(latency * 1000).toFixed(1)}µs`;
    return `${latency.toFixed(1)}ms`;
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Cluster Dashboard
          </Typography>
          
          <Typography variant="body1" color="textSecondary">
            Real-time overview of your Cassandra cluster using JMX and system table metrics
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'right' }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </Typography>
            {isRefreshing && (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'primary.main',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1, transform: 'scale(1)' },
                    '50%': { opacity: 0.5, transform: 'scale(1.2)' },
                    '100%': { opacity: 1, transform: 'scale(1)' }
                  }
                }}
              />
            )}
          </Box>
          
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchJMXData(false)}
            disabled={jmxLoading}
            size="small"
          >
            Refresh Now
          </Button>
          
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                {autoRefresh ? <PlayIcon color="primary" /> : <PauseIcon />}
                <Typography variant="body2">
                  Auto-refresh every 2s
                </Typography>
              </Stack>
            }
          />
        </Stack>
      </Box>

      {/* JMX Connection Status */}
      {jmxLoading && !jmxData && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Connecting to JMX...</strong> Loading performance metrics from JMX ports.
          </Typography>
        </Alert>
      )}

      {!jmxLoading && hasJmxMetrics && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>JMX Connected Successfully!</strong> Real-time performance metrics loaded from JMX ports.
          </Typography>
        </Alert>
      )}

      {!jmxLoading && jmxError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>JMX Error:</strong> {jmxError}
          </Typography>
        </Alert>
      )}

      {!jmxLoading && !hasJmxMetrics && !jmxError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>JMX Not Available:</strong> Performance metrics limited. Check JMX connectivity or visit JMX Dashboard for detailed metrics.
          </Typography>
        </Alert>
      )}

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, 
        gap: 3,
        mb: 3
      }}>
        {/* Cluster Health Overview */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Cluster Health
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {cluster.upNodes === cluster.totalNodes ? (
                <CheckIcon color="success" sx={{ mr: 1 }} />
              ) : cluster.upNodes > 0 ? (
                <WarningIcon color="warning" sx={{ mr: 1 }} />
              ) : (
                <ErrorIcon color="error" sx={{ mr: 1 }} />
              )}
              <Typography variant="h4">
                {cluster.upNodes}/{cluster.totalNodes}
              </Typography>
            </Box>
            
            <Typography variant="body2" color="textSecondary">
              Nodes Online
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Cluster:</strong> {cluster.name}
              </Typography>
              <Typography variant="body2">
                <strong>Version:</strong> {cluster.cassandraVersion}
              </Typography>
              <Typography variant="body2">
                <strong>Datacenters:</strong> {cluster.datacenters.join(', ')}
              </Typography>
            </Box>
            
            {/* Node Status Details */}
            {metrics?.nodes && (
              <Box sx={{ mt: 3 }}>
                {/* Available Nodes */}
                {metrics.nodes.filter((node: any) => node.isUp).length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="success.main" sx={{ mb: 1, fontWeight: 'bold' }}>
                      ✅ Available Nodes ({metrics.nodes.filter((node: any) => node.isUp).length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {metrics.nodes.filter((node: any) => node.isUp).map((node: any, index: number) => (
                        <Chip
                          key={index}
                          label={`${node.address}`}
                          color="success"
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                
                {/* Unavailable Nodes */}
                {metrics.nodes.filter((node: any) => !node.isUp).length > 0 && (
                  <Box>
                    <Typography variant="body2" color="error.main" sx={{ mb: 1, fontWeight: 'bold' }}>
                      ❌ Unavailable Nodes ({metrics.nodes.filter((node: any) => !node.isUp).length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {metrics.nodes.filter((node: any) => !node.isUp).map((node: any, index: number) => (
                        <Chip
                          key={index}
                          label={`${node.address}`}
                          color="error"
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Performance Overview */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Performance {hasJmxMetrics && <Chip label="JMX" size="small" color="success" sx={{ ml: 1 }} />}
            </Typography>
            
            {hasJmxMetrics ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SpeedIcon color="primary" sx={{ mr: 1 }} />
                  <Typography 
                    variant="h4"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                    }}
                  >
                    {formatLatency(jmxMetrics.performance.readLatency.mean)}
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="textSecondary">
                  Avg Read Latency
                </Typography>
                
                <Box sx={{ mt: 2 }}>
                  <Typography 
                    variant="body2"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.02)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.05)' : 'brightness(1)'
                    }}
                  >
                    <strong>Read P95:</strong> {formatLatency(jmxMetrics.performance.readLatency.p95)}
                  </Typography>
                  <Typography 
                    variant="body2"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.02)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.05)' : 'brightness(1)'
                    }}
                  >
                    <strong>Write P95:</strong> {formatLatency(jmxMetrics.performance.writeLatency.p95)}
                  </Typography>
                  <Typography 
                    variant="body2"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.02)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.05)' : 'brightness(1)'
                    }}
                  >
                    <strong>Throughput:</strong> {jmxMetrics.performance.requestRate.reads + jmxMetrics.performance.requestRate.writes} ops/s
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <WarningIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6" color="warning.main">
                    JMX Required
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Performance metrics not available
                </Typography>
                
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Visit the <strong>JMX Dashboard</strong> for real-time performance metrics.
                  </Typography>
                </Alert>
              </>
            )}
          </CardContent>
        </Card>

        {/* Storage Overview */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Storage
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <StorageIcon color="secondary" sx={{ mr: 1 }} />
              <Typography variant="h4">
                {formatBytes(storage.totalSize)}
              </Typography>
            </Box>
            
            <Typography variant="body2" color="textSecondary">
              Total Data Size
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Keyspaces:</strong> {keyspaces.filter(ks => !ks.isSystemKeyspace).length} user
              </Typography>
              <Typography variant="body2">
                <strong>System:</strong> {keyspaces.filter(ks => ks.isSystemKeyspace).length} system
              </Typography>
              <Typography variant="body2">
                <strong>Total Tables:</strong> {keyspaces.reduce((sum, ks) => sum + ks.tableCount, 0)}
              </Typography>
            </Box>
          </CardContent>
        </Card>

      </Box>

      {/* JMX Metrics Section */}
      {hasJmxMetrics && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            JMX Performance Metrics
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
            {/* Memory Metrics */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <MemoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Memory Usage
                </Typography>
                
                {jmxMetrics?.resources?.memory && (
                  <Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        Heap Memory Usage
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={(jmxMetrics.resources.memory.heap.used / jmxMetrics.resources.memory.heap.max) * 100} 
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="body2" color="textSecondary">
                        {formatBytes(jmxMetrics.resources.memory.heap.used)} / {formatBytes(jmxMetrics.resources.memory.heap.max)}
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2">
                      <strong>Usage:</strong> {jmxMetrics.resources.memory.heap.usagePercent.toFixed(1)}%
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>



            {/* Cache Metrics */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Cache Performance
                </Typography>
                
                {jmxMetrics?.cache?.keyCache && (
                  <Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        Key Cache Hit Rate
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={(jmxMetrics.cache.keyCache.hitRate || 0) * 100} 
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="body2" color="textSecondary">
                        {((jmxMetrics.cache.keyCache.hitRate || 0) * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2">
                      <strong>Requests:</strong> {jmxMetrics.cache.keyCache.requests.toLocaleString()}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Hits:</strong> {jmxMetrics.cache.keyCache.hits.toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

          </Box>
        </Box>
      )}

      {/* Error Tracking */}
      {hasJmxMetrics && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            <ErrorIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Error Tracking
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Timeouts
                </Typography>
                <Typography variant="h3" color="error.main">
                  {jmxMetrics?.errors?.timeouts?.total || 0}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total timeout errors
                </Typography>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Unavailable Exceptions
                </Typography>
                <Typography variant="h3" color="warning.main">
                  {jmxMetrics?.errors?.unavailables?.total || 0}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Insufficient replica errors
                </Typography>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Error Rate
                </Typography>
                <Typography variant="h3" color="error.main">
                  {jmxMetrics?.errors?.errorRate?.toFixed(2) || '0'}%
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Percentage of failed requests
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}





        
        
    </Box>
  );
};

export default Dashboard;
