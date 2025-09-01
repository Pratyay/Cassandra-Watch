import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Typography, Button, CircularProgress, Chip, LinearProgress } from '@mui/material';
import { WebSocketProvider } from './contexts/WebSocketContext';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import ClusterTopology from './pages/ClusterTopology';
import Performance from './pages/Performance';
import JMXDashboard from './pages/JMXDashboard';
import Operations from './pages/Operations';
import DataExplorer from './pages/DataExplorer';
import Settings from './pages/Settings';
import ConnectionManager from './components/ConnectionManager/ConnectionManager';
import Logo from './components/Logo/Logo';
import ApiService from './services/api';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  const [showConnectionManager, setShowConnectionManager] = useState(true);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [establishingConnection, setEstablishingConnection] = useState(false);
  const [websocketReady, setWebsocketReady] = useState(false);
  const [connectionStep, setConnectionStep] = useState<string>('Initializing...');
  const [discoveredNodes, setDiscoveredNodes] = useState<string[]>([]);
  const [connectedNodes, setConnectedNodes] = useState<string[]>([]);
  const [nodeConnectionErrors, setNodeConnectionErrors] = useState<{[key: string]: string}>({});
  
  // Estimate remaining time based on connection progress
  const getEstimatedTimeRemaining = () => {
    if (!discoveredNodes || discoveredNodes.length === 0) return null;
    if (!connectedNodes) return null;
    
    const progress = connectedNodes.length / discoveredNodes.length;
    if (progress === 0) return '2-3 minutes';
    if (progress < 0.3) return '1-2 minutes';
    if (progress < 0.7) return '30-60 seconds';
    if (progress < 1) return '10-30 seconds';
    return 'Almost done!';
  };

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setConnectionStep('Checking database connection...');
      const info = await ApiService.getConnectionInfo();
      setConnectionInfo(info);
      
      // Show connection manager if not connected
      if (!info.isConnected) {
        setShowConnectionManager(true);
        setWebsocketReady(false);
      } else {
        // Connection exists, verify it's fully functional
        try {
          setConnectionStep('Verifying database functionality...');
          await ApiService.getAllMetrics();
          
          // Discover nodes in the cluster
          setConnectionStep('Discovering cluster nodes...');
          try {
            // For remote clusters, use the basic metrics endpoint which should have cluster info
            const basicMetrics = await ApiService.getAllMetrics();
            let nodeAddresses: string[] = [];
            
            if (basicMetrics && basicMetrics.cluster && basicMetrics.nodes && Array.isArray(basicMetrics.nodes)) {
              // Extract node addresses from the nodes array
              nodeAddresses = basicMetrics.nodes
                .map((node: any) => node.address || node.host || node.ip)
                .filter(Boolean);
            }
            
            // Fallback to nodes info if basic metrics doesn't have node addresses
            if (nodeAddresses.length === 0) {
              const nodesInfo = await ApiService.getNodesInfo();
              if (nodesInfo && Array.isArray(nodesInfo)) {
                nodeAddresses = nodesInfo
                  .map((node: any) => node.address || node.host || node.ip)
                  .filter(Boolean);
              }
            }
            
            // If still no nodes, try to get from cluster info
            if (nodeAddresses.length === 0) {
              const clusterInfo = await ApiService.getClusterMetrics();
              if (clusterInfo && clusterInfo.nodes && Array.isArray(clusterInfo.nodes)) {
                nodeAddresses = clusterInfo.nodes
                  .map((node: any) => node.address || node.host || node.ip)
                  .filter(Boolean);
              }
            }
            
            if (nodeAddresses.length > 0) {
              setDiscoveredNodes(nodeAddresses);
              setConnectionStep(`Discovered ${nodeAddresses.length} nodes, establishing JMX connections...`);
            } else {
              // Final fallback - use the current connection host
              const currentHost = window.location.hostname || 'localhost';
              setDiscoveredNodes([currentHost]);
              setConnectionStep(`Using ${currentHost}, establishing JMX connections...`);
            }
          } catch (error) {
            console.warn('Could not discover nodes:', error);
            // Fallback to current host
            const currentHost = window.location.hostname || 'localhost';
            setDiscoveredNodes([currentHost]);
            setConnectionStep(`Using ${currentHost}, establishing JMX connections...`);
          }
          
          // Now attempt JMX connection as part of the main loader
          setConnectionStep('Establishing JMX connections...');
          
          // Wait for JMX to be ready by checking the WebSocket context
          let attempts = 0;
          const maxAttempts = 30; // 30 seconds timeout
          
          while (attempts < maxAttempts) {
            try {
              // Check if JMX data is available
              const jmxData = await ApiService.getAllNodesJMXMetrics();
              if (jmxData?.success && jmxData?.nodes?.length > 0) {
                // Track successfully connected nodes
                const successfulNodes = jmxData.nodes
                  .filter((node: any) => node.success)
                  .map((node: any) => node.host || node.address);
                setConnectedNodes(successfulNodes);
                
                // Track failed nodes
                if (jmxData.errors && jmxData.errors.length > 0) {
                  const errorMap: {[key: string]: string} = {};
                  jmxData.errors.forEach((error: any) => {
                    errorMap[error.host] = error.error;
                  });
                  setNodeConnectionErrors(errorMap);
                }
                
                setConnectionStep('Connection ready!');
                
                // Wait a moment for the step to be visible, then proceed
                setTimeout(() => {
                  setWebsocketReady(true);
                  setEstablishingConnection(false);
                }, 1000);
                return;
              }
            } catch (error) {
              // JMX not ready yet, continue waiting
            }
            
            // Wait 1 second before checking again
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
            
            // Update step message to show progress
            setConnectionStep(`Establishing JMX connections... (${attempts}/${maxAttempts})`);
          }
          
          // If we reach here, JMX took too long but basic connection is ready
          setConnectionStep('Basic connection ready (JMX timeout)');
          setTimeout(() => {
            setWebsocketReady(true);
            setEstablishingConnection(false);
          }, 1000);
          
        } catch (metricsError) {
          // Connection exists but not fully ready, show connection manager
          setShowConnectionManager(true);
          setWebsocketReady(false);
        }
      }
    } catch (error) {
      // Connection exists but not fully ready, show connection manager
      setShowConnectionManager(true);
      setWebsocketReady(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (config: any) => {
    try {
      setShowConnectionManager(false);
      setEstablishingConnection(true);
      setWebsocketReady(false);
      setConnectionStep('Establishing database connection...');
      
      // Reset node tracking for new connection
      setDiscoveredNodes([]);
      setConnectedNodes([]);
      setNodeConnectionErrors({});
      
      // Wait for the connection to be fully established
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update step to show JMX connection progress
      setConnectionStep('Database connected, establishing JMX connections...');
      
      // Now check the connection status - this will handle the final setup including JMX
      await checkConnectionStatus();
      
    } catch (error) {
      console.error('Error after connection:', error);
      // If there was an error, show the connection manager again
      setShowConnectionManager(true);
      setEstablishingConnection(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await ApiService.disconnect();
      setConnectionInfo({ isConnected: false });
      setShowConnectionManager(true);
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  if (loading) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            flexDirection: 'column',
            gap: 2
          }}
        >
          <Logo size="large" />
          <Typography>Loading...</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // Show connection establishing screen
  if (establishingConnection) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            flexDirection: 'column',
            gap: 2
          }}
        >
          <Logo size="large" />
          <Typography variant="h6" color="primary">
            {connectionStep}
          </Typography>
          <CircularProgress size={60} />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2, textAlign: 'center', maxWidth: 400 }}>
            Establishing complete connection to Cassandra cluster...
            <br />
            This includes database connection, JMX metrics, and WebSocket communication.
            <br />
            <strong>Please wait - this may take a few moments.</strong>
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // Show connection screen if not connected
  if (!connectionInfo?.isConnected || !websocketReady) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            flexDirection: 'column',
            gap: 2
          }}
        >
          <Logo size="large" />
          <Typography>
            {!connectionInfo?.isConnected 
              ? 'Please connect to a Cassandra cluster'
              : 'Establishing WebSocket connection...'
            }
          </Typography>
          {!connectionInfo?.isConnected && (
            <Button 
              variant="contained" 
              onClick={() => setShowConnectionManager(true)}
              sx={{ mt: 2 }}
            >
              Connect
            </Button>
          )}
          {connectionInfo?.isConnected && !websocketReady && (
            <CircularProgress sx={{ mt: 2 }} />
          )}
        </Box>
        
        <ConnectionManager
          open={showConnectionManager}
          onClose={() => setShowConnectionManager(false)}
          onConnect={handleConnect}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <WebSocketProvider>
        {!establishingConnection && connectionInfo?.isConnected && websocketReady ? (
          <Router>
            <Layout 
              connectionInfo={connectionInfo}
              onDisconnect={handleDisconnect}
              onShowConnectionManager={() => setShowConnectionManager(true)}
            >
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/topology" element={<ClusterTopology />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/jmx" element={<JMXDashboard />} />
                <Route path="/operations" element={<Operations />} />
                <Route path="/data" element={<DataExplorer />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </Router>
        ) : (
          // Show main loader when connection is not ready
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100vh',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Logo size="large" />
            <Typography variant="h6" color="primary">
              {connectionStep}
            </Typography>
            <CircularProgress size={60} />
            
            {/* Node Connection Status */}
            {(discoveredNodes || []).length > 0 && (
              <Box sx={{ mt: 2, textAlign: 'center', maxWidth: 600 }}>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  <strong>Cluster Nodes:</strong>
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  {(discoveredNodes || []).map((node, index) => {
                    const isConnected = (connectedNodes || []).includes(node);
                    const hasError = (nodeConnectionErrors || {})[node];
                    
                    return (
                      <Chip
                        key={index}
                        label={node}
                        size="small"
                        color={hasError ? 'error' : isConnected ? 'success' : 'default'}
                        variant={isConnected ? 'filled' : 'outlined'}
                        icon={hasError ? <ErrorIcon /> : isConnected ? <CheckCircleIcon /> : <PendingIcon />}
                        sx={{ 
                          minWidth: 'fit-content',
                          '& .MuiChip-icon': { fontSize: 16 }
                        }}
                      />
                    );
                  })}
                </Box>
                
                {/* Current Connection Status */}
                {discoveredNodes.length > 0 && connectedNodes.length < discoveredNodes.length && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="textSecondary">
                      🔄 Currently connecting to: {
                        (discoveredNodes || [])
                          .filter(node => !(connectedNodes || []).includes(node) && !(nodeConnectionErrors || {})[node])
                          .slice(0, 3)
                          .join(', ')
                      }
                      {(discoveredNodes || []).filter(node => !(connectedNodes || []).includes(node) && !(nodeConnectionErrors || {})[node]).length > 3 && '...'}
                    </Typography>
                  </Box>
                )}
                
                {/* Connection Progress */}
                {(discoveredNodes || []).length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="textSecondary">
                      Connected: {(connectedNodes || []).length}/{(discoveredNodes || []).length} nodes
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={((connectedNodes || []).length / (discoveredNodes || []).length) * 100}
                      sx={{ mt: 1, height: 6, borderRadius: 3 }}
                    />
                    
                    {/* Estimated Time */}
                    {getEstimatedTimeRemaining() && (
                      <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                        ⏱️ Estimated time remaining: {getEstimatedTimeRemaining()}
                      </Typography>
                    )}
                  </Box>
                )}
                
                {/* Error Summary */}
                {Object.keys(nodeConnectionErrors || {}).length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="error">
                      {Object.keys(nodeConnectionErrors || {}).length} node(s) failed to connect
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
            
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2, textAlign: 'center', maxWidth: 400 }}>
              Establishing complete connection to Cassandra cluster...
              <br />
              This includes database connection, JMX metrics, and WebSocket communication.
              <br />
              <strong>Please wait - this may take a few moments.</strong>
              <br />
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                Step: {connectionStep}
              </Typography>
            </Typography>
          </Box>
        )}
        
        <ConnectionManager
          open={showConnectionManager}
          onClose={() => setShowConnectionManager(false)}
          onConnect={handleConnect}
        />
      </WebSocketProvider>
    </ThemeProvider>
  );
}

export default App;
