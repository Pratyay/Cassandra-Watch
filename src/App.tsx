import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Typography, Button, Alert } from '@mui/material';
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
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const info = await ApiService.getConnectionInfo();
      setConnectionInfo(info);
      
      // Show connection manager if not connected
      if (!info.isConnected) {
        setShowConnectionManager(true);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setShowConnectionManager(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (config: any) => {
    try {
      await checkConnectionStatus();
    } catch (error) {
      console.error('Error after connection:', error);
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
          <Typography variant="h4">🔍 Cassandra UI</Typography>
          <Typography>Loading...</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // Show connection screen if not connected
  if (!connectionInfo?.isConnected) {
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
            gap: 3,
            textAlign: 'center',
            p: 3
          }}
        >
          <Typography variant="h3">🔍 Cassandra UI</Typography>
          <Typography variant="h5" color="textSecondary">
            Comprehensive Cluster Monitoring & Management
          </Typography>
          
          <Alert severity="info" sx={{ maxWidth: 600 }}>
            <Typography variant="body1" gutterBottom>
              <strong>Welcome to Cassandra UI!</strong>
            </Typography>
            <Typography variant="body2">
              Connect to your Cassandra cluster to start monitoring performance, operations, and data.
              Enter your cluster connection details to get started.
            </Typography>
          </Alert>
          
          <Button 
            variant="contained" 
            size="large"
            onClick={() => setShowConnectionManager(true)}
            sx={{ px: 4, py: 1.5 }}
          >
            Connect to Cluster
          </Button>
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
