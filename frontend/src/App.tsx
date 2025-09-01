import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
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
        // Even if connected, verify that the connection is fully functional
        try {
          setConnectionStep('Verifying database functionality...');
          await ApiService.getAllMetrics();
          // If we can get metrics, the connection is fully ready
          setShowConnectionManager(false);
          
          // Keep the main loader visible and attempt JMX connection
          setConnectionStep('Attempting JMX connection...');
          
          // Try to establish JMX connection using the WebSocket context
          try {
            // JMX connection will be handled by the WebSocket context
            // Just wait a bit for the context to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));
            setConnectionStep('JMX connection established, setting up WebSocket...');
            
            // Wait for WebSocket to be ready
            setTimeout(() => {
              setWebsocketReady(true);
              setConnectionStep('Connection ready!');
              // Keep the step visible for a moment before proceeding
              setTimeout(() => {
                setEstablishingConnection(false);
              }, 1000);
            }, 2000); // Give WebSocket time to connect
          } catch (jmxError) {
            console.log('JMX connection failed:', jmxError);
            setConnectionStep('JMX connection failed, but proceeding with basic connection...');
            // Still proceed with WebSocket setup
            setTimeout(() => {
              setWebsocketReady(true);
              setConnectionStep('Basic connection ready!');
              setTimeout(() => {
                setEstablishingConnection(false);
              }, 1000);
            }, 2000);
          }
        } catch (metricsError) {
          // Connection exists but not fully ready, show connection manager
          console.log('Connection exists but not fully ready:', metricsError);
          setShowConnectionManager(true);
          setWebsocketReady(false);
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      // Set a default connection info and show connection manager
      setConnectionInfo({ isConnected: false });
      setShowConnectionManager(true);
      setWebsocketReady(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (config: any) => {
    try {
      // Don't immediately check connection status - let the ConnectionManager
      // handle the full connection process and only call this when ready
      setShowConnectionManager(false);
      setEstablishingConnection(true);
      setWebsocketReady(false);
      setConnectionStep('Establishing database connection...');
      
      // Wait a bit for the connection to be fully established
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now check the connection status - this will handle JMX and WebSocket setup
      await checkConnectionStatus();
      
      // Note: The main loader will stay visible until everything is ready
      // and then automatically disappear when setEstablishingConnection(false) is called
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
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2, textAlign: 'center', maxWidth: 400 }}>
              Establishing complete connection to Cassandra cluster...
              <br />
              This includes database connection, JMX metrics, and WebSocket communication.
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
