import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
  Button,
  Chip,
  LinearProgress,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  CircularProgress,
  Backdrop,
  Fade
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Build as BuildIcon,
  Timeline as TimelineIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Cloud as CloudIcon,
  Settings as SettingsIcon,
  Wifi as WifiIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import ApiService from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import JMXAlertsPanel from '../components/JMXMonitor/JMXAlertsPanel';

interface JMXMetrics {
  host: string;
  port: number;
  timestamp: string;
  source?: string; // 'jmx', 'nodetool-fallback', etc.
  lastUpdate?: string;
  warning?: string;
  jmxError?: string;
  metrics: {
    // New JMX structure
    health?: {
      status: string;
      issues: string[];
      score: number;
    };
    performance?: {
      readLatency: { mean: number; p95: number; p99: number; count: number };
      writeLatency: { mean: number; p95: number; p99: number; count: number };
      rangeQueryLatency: { mean: number; p95: number; count: number };
      requestRate: { reads: number; writes: number; total: number; readsOneMinuteRate?: number; writesOneMinuteRate?: number; totalOneMinuteRate?: number };
    };
    errors?: {
      timeouts: { read: number; write: number; total: number };
      unavailables: { read: number; write: number; total: number };
      failures: { read: number; write: number; total: number };
      exceptions: { storage: number };
      errorRate: number;
    };
    resources?: {
      storage: { load: number; loadFormatted: string; exceptions: number };
      memory: {
        heap: { used: number; max: number; usagePercent: number; usedFormatted: string; maxFormatted: string };
        nonHeap: { used: number; usedFormatted: string };
      };
      gc: {
        youngGen: { collections: number; time: number };
        oldGen: { collections: number; time: number };
        totalTime: number;
      };
      cache: {
        keyCache: { hitRate: number; requests: number; hits: number; efficiency: string };
        rowCache: { hitRate: number; requests: number; hits: number; efficiency: string };
      };
    };
    cache?: {
      keyCache: { hitRate: number; requests: number; hits: number; efficiency: string };
      rowCache: { hitRate: number; requests: number; hits: number; efficiency: string };
    };
    threadPools?: {
      mutation: { active: number; pending: number; completed: number; status: string };
      read: { active: number; pending: number; completed: number; status: string };
      compaction: { active: number; pending: number; completed: number; status: string };
      nativeTransport: { active: number; pending: number; status: string };
    };
    compaction?: {
      pendingTasks: number;
      completedTasks: number;
      status: string;
    };
    hints?: {
      totalHints: number;
      status: string;
    };
    
    // Legacy structure for backwards compatibility (from nodetool fallback)
    storage?: any;
    clientRequest?: any;
    gc?: any;
    memory?: any;
  };
}

interface NodeJMXData {
  success: boolean;
  nodes: JMXMetrics[];
  errors: any[];
  totalNodes: number;
  successfulNodes: number;
}

const JMXDashboard: React.FC = () => {
  const { metrics: wsMetrics, jmxConnected, jmxData, jmxLoading, jmxError, getJMXData } = useWebSocket();
  const [tabValue, setTabValue] = useState(0);
  
  // Ensure tabValue is always valid
  useEffect(() => {
    if (tabValue > 3) {
      console.warn('Invalid tabValue detected:', tabValue, 'resetting to 0');
      setTabValue(0);
    }
  }, [tabValue]);
  
  const [aggregatedData, setAggregatedData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false); // State for auto-refresh operations
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [lastDataFetch, setLastDataFetch] = useState<string>('');
  const [isInitialLoad, setIsInitialLoad] = useState(false); // Start as false since JMX is initialized during startup
  
  // Check if JMX is already initialized from main dashboard
  const isJmxAlreadyInitialized = wsMetrics?.performance?.source === 'jmx_aggregated';

  useEffect(() => {
    // If JMX is already initialized from main dashboard, skip initial load
    if (isJmxAlreadyInitialized && jmxConnected) {
      console.log('JMX already initialized from main dashboard, using existing connection');
      return;
    }
    
    // Only fetch if not already connected
    if (!jmxConnected) {
      getJMXData();
    }
    
    if (autoRefresh && jmxConnected) {
      const interval = setInterval(() => {
        // Refresh the shared JMX data
        setIsRefreshing(true);
        getJMXData(true).finally(() => {
          setIsRefreshing(false);
        });
        setLastDataFetch(new Date().toLocaleTimeString());
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, isJmxAlreadyInitialized, jmxConnected, jmxData]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  const formatThroughput = (rate: number) => {
    if (rate === 0) return '0 ops/min';
    if (rate < 1) return `${(rate * 60).toFixed(2)} ops/min`;
    return `${rate.toFixed(2)} ops/sec`;
  };

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value > thresholds.critical) return 'error';
    if (value > thresholds.warning) return 'warning';
    return 'success';
  };

  // Create aggregated data from individual node metrics
  const createAggregatedDataFromNodes = (nodes: any[]) => {
    const validNodes = nodes.filter((n: any) => n.success && n.metrics);
    
    if (validNodes.length === 0) {
      return {
        performance: { readLatency: { mean: 0, p50: 0, p95: 0, p99: 0 }, writeLatency: { mean: 0, p50: 0, p95: 0, p99: 0 }, requestRate: 0, errorRate: 0 },
        resources: { memory: { heap: { used: 0, max: 0 }, nonHeap: { used: 0 } }, cpu: { usage: 0 } },
        threadPools: { totalActiveThreads: 0, totalBlockedThreads: 0, totalCompletedTasks: 0 },
        cache: { keyCache: { hitRate: 0, size: 0 }, rowCache: { hitRate: 0, size: 0 } },
        compaction: { pendingTasks: 0, completedTasks: 0, totalCompactions: 0 }
      };
    }
    
    const aggregated = {
      memory: {
        totalHeapUsed: validNodes.reduce((sum, node) => sum + (node.metrics.resources?.memory?.heap?.used || 0), 0),
        totalHeapMax: validNodes.reduce((sum, node) => sum + (node.metrics.resources?.memory?.heap?.max || 0), 0),
        totalNonHeapUsed: validNodes.reduce((sum, node) => sum + (node.metrics.resources?.memory?.nonHeap?.used || 0), 0)
      },
      threadPools: {
        totalActiveThreads: validNodes.reduce((sum, node) => {
          const threadPools = node.metrics.threadPools || {};
          return sum + ((threadPools as any).mutation?.active || 0) + ((threadPools as any).read?.active || 0) + ((threadPools as any).compaction?.active || 0);
        }, 0)
      },
      compaction: {
        totalPendingTasks: validNodes.reduce((sum, node) => sum + (node.metrics.compaction?.pendingTasks || 0), 0),
        totalCompletedTasks: validNodes.reduce((sum, node) => sum + (node.metrics.compaction?.completedTasks || 0), 0)
      },
      performance: {
        totalReadRate: validNodes.reduce((sum, node) => sum + (node.metrics.performance?.requestRate?.reads || 0), 0),
        totalWriteRate: validNodes.reduce((sum, node) => sum + (node.metrics.performance?.requestRate?.writes || 0), 0),
        totalReads: validNodes.reduce((sum, node) => sum + (node.metrics.performance?.requestRate?.reads || 0), 0),
        totalWrites: validNodes.reduce((sum, node) => sum + (node.metrics.performance?.requestRate?.writes || 0), 0)
      },
      cache: {
        keyCache: {
          hitRate: validNodes.reduce((sum, node) => sum + (node.metrics.cache?.keyCache?.hitRate || 0), 0) / validNodes.length,
          requests: validNodes.reduce((sum, node) => sum + (node.metrics.cache?.keyCache?.requests || 0), 0)
        },
        rowCache: {
          hitRate: validNodes.reduce((sum, node) => sum + (node.metrics.cache?.rowCache?.hitRate || 0), 0) / validNodes.length,
          requests: validNodes.reduce((sum, node) => sum + (node.metrics.cache?.rowCache?.requests || 0), 0)
        }
      }
    };
    
    return aggregated;
  };

  // Update aggregated data when jmxData changes
  useEffect(() => {
    if (jmxData?.nodes) {
      const aggregated = createAggregatedDataFromNodes(jmxData.nodes);
      setAggregatedData({ aggregated, nodes: jmxData.nodes });
    }
  }, [jmxData]);

  const renderOverviewTab = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      
      
      {/* Data Source Alert */}
      {jmxData && jmxData.nodes && jmxData.nodes.length > 0 ? (
        <Alert severity={jmxData.nodes.some((n: any) => n.source === 'jmx') ? 'success' : 'info'} sx={{ mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            <strong>Data Source: JMX (Native RMI)</strong>
          </Typography>
          {jmxData.nodes.some((n: any) => n.source === 'jmx') ? (
            <Typography variant="body2">
              ✅ JMX connections established via native RMI. Full metrics available from MBeans.
            </Typography>
          ) : (
            <Typography variant="body2">
              ⚠️ JMX connections not established. Check JMX connectivity (port 7199).
            </Typography>
          )}
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            <strong>No JMX Data Available</strong>
          </Typography>
          <Typography variant="body2">
            Waiting for JMX data to load. If this persists, check your JMX connections and refresh the page.
          </Typography>
        </Alert>
      )}
      
      {/* Cluster Summary */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📊 Cluster JMX Overview
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {jmxData?.successfulNodes || jmxData?.nodes?.filter((n: any) => n.source === 'jmx').length || 0}
              </Typography>
              <Typography variant="body2">JMX Connected Nodes</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="secondary">
                {formatBytes(aggregatedData?.aggregated?.memory?.totalHeapUsed || 0)}
              </Typography>
              <Typography variant="body2">Total Heap Used</Typography>
              {process.env.NODE_ENV === 'development' && (
                <Typography variant="caption" color="text.secondary">
                  Raw: {aggregatedData?.aggregated?.memory?.totalHeapUsed || 0}
                </Typography>
              )}
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {aggregatedData?.aggregated?.threadPools?.totalActiveThreads || 0}
              </Typography>
              <Typography variant="body2">Active Threads</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {aggregatedData?.aggregated?.compaction?.totalPendingTasks || 0}
              </Typography>
              <Typography variant="body2">Pending Tasks</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Throughput Metrics */}
      {aggregatedData?.aggregated ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🚀 Request Throughput (cluster-wide)
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {formatThroughput(aggregatedData.aggregated.performance?.totalReadRate || 
                                    aggregatedData.aggregated.performance?.readLatency?.totalRate || 
                                    (aggregatedData.aggregated.performance?.totalReads || 0) / 60)}
                </Typography>
                <Typography variant="body2">Read Throughput</Typography>
                <Typography variant="caption">
                  {(aggregatedData.aggregated.performance?.totalReadRate || aggregatedData.aggregated.performance?.readLatency?.totalRate) ? '1-min rate (JMX)' : 'estimated from total'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {formatThroughput(aggregatedData.aggregated.performance?.totalWriteRate || 
                                    aggregatedData.aggregated.performance?.writeLatency?.totalRate || 
                                    (aggregatedData.aggregated.performance?.totalWrites || 0) / 60)}
                </Typography>
                <Typography variant="body2">Write Throughput</Typography>
                <Typography variant="caption">
                  {(aggregatedData.aggregated.performance?.totalWriteRate || aggregatedData.aggregated.performance?.writeLatency?.totalRate) ? '1-min rate (JMX)' : 'estimated from total'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {formatThroughput((aggregatedData.aggregated.performance?.totalReadRate || aggregatedData.aggregated.performance?.readLatency?.totalRate || (aggregatedData.aggregated.performance?.totalReads || 0) / 60) + 
                                    (aggregatedData.aggregated.performance?.totalWriteRate || aggregatedData.aggregated.performance?.writeLatency?.totalRate || (aggregatedData.aggregated.performance?.totalWrites || 0) / 60))}
                </Typography>
                <Typography variant="body2">Total Throughput</Typography>
                <Typography variant="caption">
                  {((aggregatedData.aggregated.performance?.totalReadRate || aggregatedData.aggregated.performance?.readLatency?.totalRate) || 
                    (aggregatedData.aggregated.performance?.totalWriteRate || aggregatedData.aggregated.performance?.writeLatency?.totalRate)) ? '1-min rate (JMX)' : 'estimated from total'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="secondary">
                  {(((aggregatedData.aggregated.performance?.totalWriteRate || aggregatedData.aggregated.performance?.writeLatency?.totalRate || (aggregatedData.aggregated.performance?.totalWrites || 0) / 60) / 
                    Math.max(((aggregatedData.aggregated.performance?.totalReadRate || aggregatedData.aggregated.performance?.readLatency?.totalRate || (aggregatedData.aggregated.performance?.totalReads || 0) / 60) + 
                              (aggregatedData.aggregated.performance?.totalWriteRate || aggregatedData.aggregated.performance?.writeLatency?.totalRate || (aggregatedData.aggregated.performance?.totalWrites || 0) / 60)), 1)) * 100).toFixed(1)}%
                </Typography>
                <Typography variant="body2">Write Ratio</Typography>
                <Typography variant="caption">of total requests</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🚀 Request Throughput (cluster-wide)
            </Typography>
            <Alert severity="info">
              <Typography variant="body2">
                Throughput metrics will appear here once JMX data is loaded and aggregated.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Real-time Metrics Charts */}
      {metricsHistory.length > 0 ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Memory Usage Trend
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metricsHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis tickFormatter={(value) => formatBytes(value)} />
                  <RechartsTooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: number) => [formatBytes(value), 'Heap Used']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="memory.totalHeapUsed" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Thread Pool Activity
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metricsHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis />
                  <RechartsTooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="threadPools.totalActiveThreads" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    name="Active"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="threadPools.totalPendingTasks" 
                    stroke="#ffc658" 
                    strokeWidth={2}
                    name="Pending"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📊 Real-time Metrics Charts
            </Typography>
            <Alert severity="info">
              <Typography variant="body2">
                Charts will appear here once metrics history is populated from JMX data.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      )}
    </Box>
  );

  const renderNodeDetailsTab = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        📡 Node-Level JMX Metrics
      </Typography>
      
      {!jmxData || !jmxData.success ? (
        <Alert severity="warning">
                  <Typography variant="body2" paragraph>
                    JMX data not available. {jmxData?.errors?.[0]?.error || 'No JMX connection established.'}
                  </Typography>
                  <Typography variant="body2">
                    Note: This dashboard requires direct JMX access to Cassandra nodes (port 7199) for real-time metrics.
                    Please ensure JMX ports are accessible and firewall rules allow connections.
                  </Typography>
        </Alert>
      ) : jmxData && jmxData.nodes && Array.isArray(jmxData.nodes) && jmxData.nodes.length > 0 ? (
        jmxData.nodes.map((node: any) => (
          <Accordion key={node.host} sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <CheckCircleIcon color="success" />
                <Typography variant="h6">{node.host}:{node.port}</Typography>
                
                {/* Data source indicator */}
                <Chip 
                  label={node.source === 'jmx' ? 'JMX' : 'Unknown'}
                  size="small"
                  color={node.source === 'jmx' ? 'success' : 'default'}
                  variant="outlined"
                />
                
                <Chip 
                  label={`Heap: ${formatBytes(node.metrics.resources?.memory?.heap?.used || 0)}`}
                  size="small"
                  color="primary"
                />
                <Chip 
                  label={`Load: ${formatBytes(node.metrics.resources?.storage?.load || 0)}`}
                  size="small"
                  color="secondary"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                {/* Memory Details */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    <MemoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Memory Usage
                  </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2">Heap Memory</Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={((node.metrics.resources?.memory?.heap?.used || 0) / (node.metrics.resources?.memory?.heap?.max || 1)) * 100}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                      <Typography variant="caption">
                        {formatBytes(node.metrics.resources?.memory?.heap?.used || 0)} / {formatBytes(node.metrics.resources?.memory?.heap?.max || 0)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">Non-Heap Memory</Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min((node.metrics.resources?.memory?.nonHeap?.used || 0) / 1000000000 * 100, 100)}
                        color="secondary"
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                      <Typography variant="caption">
                        {formatBytes(node.metrics.resources?.memory?.nonHeap?.used || 0)}
                      </Typography>
                    </Box>
                  </Paper>

                {/* Thread Pools */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    <BuildIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Thread Pools
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                    <Box>
                      <Typography variant="caption">Mutation</Typography>
                      <Typography variant="h6">{node.metrics.threadPools?.mutation?.active || 0}</Typography>
                      <Typography variant="caption">Active</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption">Read</Typography>
                      <Typography variant="h6">{node.metrics.threadPools?.read?.active || 0}</Typography>
                      <Typography variant="caption">Active</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption">Compaction</Typography>
                      <Typography variant="h6">{node.metrics.threadPools?.compaction?.active || 0}</Typography>
                      <Typography variant="caption">Active</Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* Cache Metrics - from JMX */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Cache Performance (JMX)
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                    <Box>
                      <Typography variant="body2">Key Cache Hit Rate</Typography>
                      <Typography variant="h5" color="primary">
                        {((node.metrics.cache?.keyCache?.hitRate ?? node.metrics.resources?.cache?.keyCache?.hitRate ?? 0) * 100).toFixed(1)}%
                      </Typography>
                      <Typography variant="caption">
                        Requests: {node.metrics.cache?.keyCache?.requests ?? node.metrics.resources?.cache?.keyCache?.requests ?? 0}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">Row Cache Hit Rate</Typography>
                      <Typography variant="h5" color="secondary">
                        {((node.metrics.cache?.rowCache?.hitRate ?? node.metrics.resources?.cache?.rowCache?.hitRate ?? 0) * 100).toFixed(1)}%
                      </Typography>
                      <Typography variant="caption">
                        Requests: {node.metrics.cache?.rowCache?.requests ?? node.metrics.resources?.cache?.rowCache?.requests ?? 0}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* Performance Metrics */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Request Performance
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                    <Box>
                      <Typography variant="body2">Read Throughput</Typography>
                      <Typography variant="h6">
                        {formatThroughput(node.metrics.performance?.requestRate?.readsOneMinuteRate || node.metrics.performance?.requestRate?.reads || 0)}
                      </Typography>
                      <Typography variant="caption">
                        {node.metrics.performance?.requestRate?.readsOneMinuteRate ? '1-min rate' : 'total'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">Write Throughput</Typography>
                      <Typography variant="h6">
                        {formatThroughput(node.metrics.performance?.requestRate?.writesOneMinuteRate || node.metrics.performance?.requestRate?.writes || 0)}
                      </Typography>
                      <Typography variant="caption">
                        {node.metrics.performance?.requestRate?.writesOneMinuteRate ? '1-min rate' : 'total'}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mt: 1 }}>
                    <Box>
                      <Typography variant="body2">Read Latency (avg)</Typography>
                      <Typography variant="h6">{(node.metrics.performance?.readLatency?.mean || 0).toFixed(2)}ms</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">Write Latency (avg)</Typography>
                      <Typography variant="h6">{(node.metrics.performance?.writeLatency?.mean || 0).toFixed(2)}ms</Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* GC Metrics */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Garbage Collection
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                    <Box>
                      <Typography variant="body2">Young Gen Collections</Typography>
                      <Typography variant="h6">{formatNumber(node.metrics.resources?.gc?.youngGen?.collections || 0)}</Typography>
                      <Typography variant="caption">{node.metrics.resources?.gc?.youngGen?.time || 0}ms total</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">Old Gen Collections</Typography>
                      <Typography variant="h6">{formatNumber(node.metrics.resources?.gc?.oldGen?.collections || 0)}</Typography>
                      <Typography variant="caption">{node.metrics.resources?.gc?.oldGen?.time || 0}ms total</Typography>
                    </Box>
                  </Box>
                </Paper>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))
      ) : (
        <Alert severity="info">
          <Typography variant="body2">
            No node metrics available. Ensure JMX connections are established.
          </Typography>
        </Alert>
      )}
    </Box>
  );





  const renderMBeansTab = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        🔧 Available MBeans by Category
      </Typography>
        
        {/* MBean Categories */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Storage Metrics
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Monitor storage-related metrics including data load, commit log size, and hint delivery.
            </Typography>
            <Box sx={{ pl: 2 }}>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=Storage,name=Load</Typography>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=Storage,name=Exceptions</Typography>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=CommitLog,name=PendingTasks</Typography>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=CommitLog,name=TotalCommitLogSize</Typography>
            </Box>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Client Request Metrics
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Track read/write latencies, timeouts, and unavailable exceptions.
            </Typography>
            <Box sx={{ pl: 2 }}>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Latency</Typography>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Latency</Typography>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=ClientRequest,scope=Read,name=Timeouts</Typography>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=ClientRequest,scope=Write,name=Timeouts</Typography>
            </Box>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              <MemoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Cache Metrics
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Monitor key cache and row cache performance.
            </Typography>
            <Box sx={{ pl: 2 }}>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=Cache,scope=KeyCache,name=HitRate</Typography>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=Cache,scope=RowCache,name=HitRate</Typography>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=Cache,scope=KeyCache,name=Size</Typography>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=Cache,scope=RowCache,name=Size</Typography>
            </Box>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              <BuildIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Thread Pool Metrics
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Monitor thread pool activity for different operation types.
            </Typography>
            <Box sx={{ pl: 2 }}>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=MutationStage</Typography>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=ReadStage</Typography>
              <Typography variant="body2">• org.apache.cassandra.metrics:type=ThreadPools,path=internal,scope=CompactionExecutor</Typography>
            </Box>
          </AccordionDetails>
        </Accordion>
    </Box>
  );

  const renderTroubleshootingTab = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6" gutterBottom>
        🔍 Cassandra Troubleshooting Guide
      </Typography>

      {/* JMX Alerts Panel */}
      <JMXAlertsPanel jmxData={jmxData} aggregatedData={aggregatedData} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
        {/* Health Checks */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Health Indicators
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="body2">JMX Connectivity: Connected</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(aggregatedData?.aggregated?.memory?.totalHeapUsed / aggregatedData?.aggregated?.memory?.totalHeapMax) > 0.8 ? 
                  <WarningIcon color="warning" fontSize="small" /> : 
                  <CheckCircleIcon color="success" fontSize="small" />
                }
                <Typography variant="body2">
                  Memory Usage: {((aggregatedData?.aggregated?.memory?.totalHeapUsed / aggregatedData?.aggregated?.memory?.totalHeapMax) * 100).toFixed(1)}%
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(aggregatedData?.aggregated?.performance?.totalTimeouts > 0) ? 
                  <ErrorIcon color="error" fontSize="small" /> : 
                  <CheckCircleIcon color="success" fontSize="small" />
                }
                <Typography variant="body2">Request Timeouts: {aggregatedData?.aggregated?.performance?.totalTimeouts || 0}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Common Issues */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <ErrorIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Common Issues
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>High Memory Usage:</strong> Monitor heap usage {'>'}80%. Consider tuning JVM settings or adding nodes.
                </Typography>
              </Alert>
              <Alert severity="warning">
                <Typography variant="body2">
                  <strong>Pending Compactions:</strong> High pending tasks may indicate I/O bottlenecks.
                </Typography>
              </Alert>
              <Alert severity="error">
                <Typography variant="body2">
                  <strong>Request Timeouts:</strong> Check network latency and cluster load distribution.
                </Typography>
              </Alert>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Debug Actions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🛠️ Debug Actions
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />}
              onClick={() => {
                // Refresh the shared JMX data
                setIsRefreshing(true);
                getJMXData(true).finally(() => {
                  setIsRefreshing(false);
                });
                setLastDataFetch(new Date().toLocaleTimeString());
              }}
              disabled={jmxLoading || isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh All Metrics'}
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<MemoryIcon />}
              onClick={() => {
                // Force GC via JMX (would need implementation)
                console.log('Force GC triggered');
              }}
            >
              Trigger GC
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<BuildIcon />}
              onClick={() => {
                // Trigger compaction via JMX
                console.log('Compaction triggered');
              }}
            >
              Force Compaction
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );


    

    // Show loader while JMX data is loading
  if (!jmxData && jmxLoading) {
    return (
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Connecting to JMX and loading cluster metrics...
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Establishing JMX connections to cluster nodes...
        </Typography>
      </Box>
    );
  }

  // If no JMX data but we're connected, show a message
  if (!jmxData && jmxConnected) {
    return (
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            JMX Connected but No Data
          </Typography>
          <Typography variant="body2">
            JMX connection is established but no metrics data is available yet. 
            This might happen if the cluster is still starting up or if there are no active operations.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            📊 JMX Monitoring Dashboard
          </Typography>
          {lastDataFetch && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Last updated: {new Date(lastDataFetch).toLocaleTimeString()} • Data persisted across tabs
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
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto Refresh"
          />
          <Button
            variant="outlined"
            startIcon={isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => {
              // Refresh the shared JMX data
              setIsRefreshing(true);
              getJMXData(true).finally(() => {
                setIsRefreshing(false);
              });
              setLastDataFetch(new Date().toLocaleTimeString());
            }}
            disabled={jmxLoading || isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>
      </Box>

      {/* Dashboard Purpose Note */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Note:</strong> This dashboard shows JMX-based metrics including latencies, throughput, cache hit rates, and detailed performance data. 
          For cluster health and operational metrics, visit the main <strong>Cluster Dashboard</strong>.
        </Typography>
      </Alert>



      {/* Error Alert */}
      {jmxError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => {}}>
          {jmxError}
        </Alert>
      )}

      {/* Connection Status and Data Source */}
      {jmxData && (
        <Box sx={{ mb: 3 }}>
          <Alert 
            severity={jmxData.successfulNodes > 0 ? 'success' : 'warning'} 
            sx={{ mb: 2 }}
          >
            JMX Status: {jmxData.successfulNodes}/{jmxData.totalNodes} nodes connected
            {jmxData.errors.length > 0 && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Errors: {jmxData.errors.map((e: any) => `${e.host}: ${e.error}`).join(', ')}
              </Typography>
            )}
          </Alert>
          
          {/* Data Source Indicator */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {jmxData.nodes?.map((node: any, index: any) => {
              const isJMX = node.source === 'jmx';
              const isNodetool = node.source === 'nodetool-fallback';
              const isJolokia = node.source === 'jolokia' || node.source === 'jolokia-http';
              
              let displaySource = 'unknown';
              let color: 'success' | 'warning' | 'default' = 'default';
              let icon = <ErrorIcon />;
              
              if (isJMX || isJolokia) {
                displaySource = isJolokia ? 'Jolokia' : 'JMX';
                color = 'success';
                icon = <CheckCircleIcon />;
              } else if (isNodetool) {
                displaySource = 'nodetool';
                color = 'warning';
                icon = <WarningIcon />;
              } else {
                displaySource = node.source || 'unknown';
              }
              
              return (
                <Chip 
                  key={`${node.host}-${index}`}
                  label={`${node.host}: ${displaySource}`}
                  color={color}
                  variant={isJMX || isJolokia ? 'filled' : 'outlined'}
                  size="small"
                  icon={icon}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {/* Main Content Tabs */}
      <Paper sx={{ width: '100%' }}>

        <Tabs
          value={tabValue}
          onChange={(_, newValue) => {
            console.log('Tab change requested:', newValue, 'current:', tabValue);
            if (newValue >= 0 && newValue <= 3) {
              setTabValue(newValue);
            } else {
              console.warn('Invalid tab value requested:', newValue, 'ignoring');
            }
          }}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Overview" />
          <Tab label="Node Details" />
          <Tab label="MBeans" />
          <Tab label="Troubleshooting" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tabValue === 0 && renderOverviewTab()}
          {tabValue === 1 && renderNodeDetailsTab()}
          {tabValue === 2 && renderMBeansTab()}
          {tabValue === 3 && renderTroubleshootingTab()}
        </Box>
      </Paper>
    </Box>
  );
};

export default JMXDashboard;
