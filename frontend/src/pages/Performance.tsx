import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  LinearProgress,
  Button,
  Switch,
  FormControlLabel,
  Stack,
} from '@mui/material';
import { Refresh as RefreshIcon, PlayArrow as PlayIcon, Pause as PauseIcon } from '@mui/icons-material';
import { useWebSocket } from '../contexts/WebSocketContext';
import ApiService from '../services/api';

const Performance: React.FC = () => {
  const { metrics, isConnected } = useWebSocket();
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
      
      const allNodesData = await ApiService.getAllNodesJMXMetrics();
      
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
                p50: nodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.readLatency?.p50 || 0), 0) / nodes.length,
                p95: Math.max(...nodes.map((node: any) => node.metrics.performance?.readLatency?.p95 || 0)),
                p99: Math.max(...nodes.map((node: any) => node.metrics.performance?.readLatency?.p99 || 0))
              },
              writeLatency: {
                mean: nodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.writeLatency?.mean || 0), 0) / nodes.length,
                p50: nodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.writeLatency?.p50 || 0), 0) / nodes.length,
                p95: Math.max(...nodes.map((node: any) => node.metrics.performance?.readLatency?.p95 || 0)),
                p99: Math.max(...nodes.map((node: any) => node.metrics.performance?.readLatency?.p99 || 0))
              },
              requestRate: {
                reads: nodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.requestRate?.reads || 0), 0),
                writes: nodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.requestRate?.writes || 0), 0),
                total: nodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.requestRate?.total || 0), 0)
              }
            },
            errors: {
              readTimeouts: nodes.reduce((sum: number, node: any) => sum + (node.metrics.errors?.timeouts?.read || 0), 0),
              writeTimeouts: nodes.reduce((sum: number, node: any) => sum + (node.metrics.errors?.timeouts?.write || 0), 0),
              unavailableExceptions: nodes.reduce((sum: number, node: any) => sum + (node.metrics.errors?.unavailables?.total || 0), 0)
            }
          };
        }
      }
      
      setJmxData(aggregatedMetrics);
      setLastRefresh(new Date());
    } catch (error: any) {
      console.error('Performance: Error fetching JMX data:', error);
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

  // Remove the connection check since we're controlling when this component renders
  // The App component ensures this only renders when connection is ready

  if (!jmxData) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading performance metrics...
        </Typography>
      </Box>
    );
  }

  // Ensure metrics is available before destructuring
  if (!metrics) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading basic metrics...
        </Typography>
      </Box>
    );
  }

  const { performance } = metrics;
  
  // Use JMX data when available, fallback to basic metrics
  const performanceData = jmxData?.performance || performance;
  const errorData = jmxData?.errors || performance.errors;

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Performance Monitoring
          </Typography>
          
          <Typography variant="body1" color="textSecondary">
            Real-time performance metrics and trends for your Cassandra cluster
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

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Latency Overview */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Read Latency Distribution
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h4" 
                    color="primary"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                    }}
                  >
                    {performanceData.readLatency.p50.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    P50 (ms)
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h4" 
                    color="warning.main"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                    }}
                  >
                    {performanceData.readLatency.p95.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    P95 (ms)
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h4" 
                    color="error.main"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                    }}
                  >
                    {performanceData.readLatency.p99.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    P99 (ms)
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h4"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                    }}
                  >
                    {performanceData.readLatency.mean.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Mean (ms)
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Write Latency Distribution
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h4" 
                    color="primary"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                    }}
                  >
                    {performanceData.writeLatency.p50.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    P50 (ms)
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h4" 
                    color="warning.main"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                    }}
                  >
                    {performanceData.writeLatency.p95.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    P95 (ms)
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h4" 
                    color="error.main"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                    }}
                  >
                    {performanceData.writeLatency.p99.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    P99 (ms)
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h4"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                      filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                    }}
                  >
                    {performanceData.writeLatency.mean.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Mean (ms)
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Throughput */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Current Throughput
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h2" 
                  color="primary.main"
                  sx={{
                    transition: 'all 0.3s ease-in-out',
                    transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                    filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                  }}
                >
                  {performanceData.requestRate.reads.toFixed(1)}
                </Typography>
                <Typography variant="h6" color="textSecondary">
                  Read Operations/sec
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(performanceData.requestRate.reads / 10, 100)}
                  sx={{ mt: 1, height: 8 }}
                  color="primary"
                />
              </Box>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h2" 
                  color="secondary.main"
                  sx={{
                    transition: 'all 0.3s ease-in-out',
                    transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                    filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                  }}
                >
                  {performanceData.requestRate.writes.toFixed(1)}
                </Typography>
                <Typography variant="h6" color="textSecondary">
                  Write Operations/sec
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(performanceData.requestRate.writes / 10, 100)}
                  sx={{ mt: 1, height: 8 }}
                  color="secondary"
                />
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Error Metrics */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Error Metrics
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h2" 
                  color="error.main"
                  sx={{
                    transition: 'all 0.3s ease-in-out',
                    transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                    filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                  }}
                >
                  {errorData.readTimeouts}
                </Typography>
                <Typography variant="h6" color="textSecondary">
                  Read Timeouts
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Operations that timed out during read
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h2" 
                  color="error.main"
                  sx={{
                    transition: 'all 0.3s ease-in-out',
                    transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                    filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                  }}
                >
                  {errorData.writeTimeouts}
                </Typography>
                <Typography variant="h6" color="textSecondary">
                  Write Timeouts
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Operations that timed out during write
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h2" 
                  color="error.main"
                  sx={{
                    transition: 'all 0.3s ease-in-out',
                    transform: isRefreshing ? 'scale(1.05)' : 'scale(1)',
                    filter: isRefreshing ? 'brightness(1.1)' : 'brightness(1)'
                  }}
                >
                  {errorData.unavailableExceptions}
                </Typography>
                <Typography variant="h6" color="textSecondary">
                  Unavailable Exceptions
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Operations failed due to insufficient replicas
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Performance;
