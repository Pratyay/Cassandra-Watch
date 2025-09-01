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

const Performance: React.FC = () => {
  const { metrics, isConnected, jmxConnected, jmxData, jmxLoading, jmxError, getJMXData, resetJMXConnection } = useWebSocket();

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper function to create aggregated metrics from nodes
  const createAggregatedMetrics = (nodes: any[]) => {
    const validNodes = nodes.filter((node: any) => node.success && node.metrics);
    
    if (validNodes.length === 0) return null;
    
    return {
      readLatency: {
        mean: validNodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.readLatency?.mean || 0), 0) / validNodes.length,
        p50: validNodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.readLatency?.p50 || 0), 0) / validNodes.length,
        p95: Math.max(...validNodes.map((node: any) => node.metrics.performance?.readLatency?.p95 || 0)),
        p99: Math.max(...validNodes.map((node: any) => node.metrics.performance?.readLatency?.p99 || 0))
      },
      writeLatency: {
        mean: validNodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.writeLatency?.mean || 0), 0) / validNodes.length,
        p50: validNodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.writeLatency?.p50 || 0), 0) / validNodes.length,
        p95: Math.max(...validNodes.map((node: any) => node.metrics.performance?.writeLatency?.p95 || 0)),
        p99: Math.max(...validNodes.map((node: any) => node.metrics.performance?.writeLatency?.p99 || 0))
      },
      requestRate: {
        reads: validNodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.requestRate?.reads || 0), 0),
        writes: validNodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.requestRate?.writes || 0), 0),
        total: validNodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.requestRate?.total || 0), 0)
      },
      errorRate: validNodes.reduce((sum: number, node: any) => sum + (node.metrics.performance?.errorRate || 0), 0) / validNodes.length
    };
  };

  // Helper function to create aggregated error data from nodes
  const createAggregatedErrorData = (nodes: any[]) => {
    const validNodes = nodes.filter((node: any) => node.success && node.metrics);
    
    if (validNodes.length === 0) return { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 };
    
    return {
      readTimeouts: validNodes.reduce((sum: number, node: any) => sum + (node.metrics.errors?.timeouts?.read || 0), 0),
      writeTimeouts: validNodes.reduce((sum: number, node: any) => sum + (node.metrics.errors?.timeouts?.write || 0), 0),
      unavailableExceptions: validNodes.reduce((sum: number, node: any) => sum + (node.metrics.errors?.unavailables?.total || 0), 0)
    };
  };

  // Use shared JMX data instead of local state
  const performanceData = jmxData?.nodes ? createAggregatedMetrics(jmxData.nodes) : metrics?.performance;
  const errorData = jmxData?.nodes ? createAggregatedErrorData(jmxData.nodes) : { readTimeouts: 0, writeTimeouts: 0, unavailableExceptions: 0 };

  // Auto-refresh logic - only refresh if JMX is connected
  useEffect(() => {
    if (autoRefresh && jmxConnected) {
      const interval = setInterval(() => {
        // Refresh the shared JMX data
        setIsRefreshing(true);
        getJMXData(true).finally(() => {
          setIsRefreshing(false);
        });
        setLastRefresh(new Date());
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
  }, [autoRefresh, jmxConnected, getJMXData]);

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

  if (!performanceData) {
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

  // Debug logging to understand data structure
  // Removed console.log statements for production

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Connection Status */}
      {jmxError && (
        <Alert 
          severity="error" 
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => {
                resetJMXConnection();
              }}
            >
              Retry
            </Button>
          }
          sx={{ mb: 3 }}
        >
          <Typography variant="body2">
            {jmxError}
          </Typography>
        </Alert>
      )}
      
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
            onClick={() => {
              // Refresh the shared JMX data
              setIsRefreshing(true);
              getJMXData(true).finally(() => {
                setIsRefreshing(false);
              });
              setLastRefresh(new Date());
            }}
            disabled={jmxLoading || isRefreshing}
            size="small"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
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
                  {performanceData && 'requestRate' in performanceData && performanceData.requestRate?.total 
                    ? performanceData.requestRate.total.toFixed(1)
                    : (performanceData && 'requestRate' in performanceData && performanceData.requestRate?.reads || 0) + (performanceData && 'requestRate' in performanceData && performanceData.requestRate?.writes || 0)
                  }
                </Typography>
                <Typography variant="h6" color="textSecondary">
                  Operations/sec
                </Typography>
                
                {/* Breakdown of reads vs writes */}
                {performanceData && 'requestRate' in performanceData && (
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-around', fontSize: '0.875rem' }}>
                    <Typography variant="body2" color="primary.main">
                      Reads: {performanceData.requestRate?.reads || 0}
                    </Typography>
                    <Typography variant="body2" color="secondary.main">
                      Writes: {performanceData.requestRate?.writes || 0}
                    </Typography>
                  </Box>
                )}
                
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(
                    (performanceData && 'requestRate' in performanceData && performanceData.requestRate?.total 
                      ? performanceData.requestRate.total 
                      : (performanceData && 'requestRate' in performanceData && performanceData.requestRate?.reads || 0) + (performanceData && 'requestRate' in performanceData && performanceData.requestRate?.writes || 0)) / 10, 
                    100
                  )}
                  sx={{ mt: 1, height: 8 }}
                  color="primary"
                />
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
                  {performanceData && 'errorRate' in performanceData && typeof performanceData.errorRate === 'number'
                    ? performanceData.errorRate.toFixed(1)
                    : '0.0'
                  }%
                </Typography>
                <Typography variant="h6" color="textSecondary">
                  Error Rate
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Percentage of operations that failed
                </Typography>
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
                  {errorData?.readTimeouts || 0}
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
                  {errorData?.writeTimeouts || 0}
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
                  {errorData?.unavailableExceptions || 0}
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
