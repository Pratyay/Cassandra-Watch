import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Science as TestIcon,
  Close as CloseIcon,
  CheckCircle as ConnectedIcon,
} from '@mui/icons-material';
import ApiService from '../../services/api';

interface ConnectionConfig {
  name: string;
  hosts: string[];
  port: number;
  datacenter: string;
  username?: string;
  password?: string;
}

interface ConnectionManagerProps {
  open: boolean;
  onClose: () => void;
  onConnect: (config: ConnectionConfig) => void;
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({ open, onClose, onConnect }) => {
  const [config, setConfig] = useState<ConnectionConfig>({
    name: '',
    hosts: [''],
    port: 9042,
    datacenter: 'datacenter1',
    username: '',
    password: ''
  });
  
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('');

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await ApiService.testConnection({
        hosts: config.hosts,
        port: config.port,
        datacenter: config.datacenter,
        username: config.username,
        password: config.password
      });
      
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: (error as Error).message
      });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setConnectionStatus('Establishing connection...');
    
    try {
      const result = await ApiService.connect({
        hosts: config.hosts,
        port: config.port,
        datacenter: config.datacenter,
        username: config.username,
        password: config.password
      });
      
      if (result.success) {
        setConnectionStatus('Connection established, waiting for services to be ready...');
        
        // Wait for the connection to be fully established
        // Poll the connection status until it's ready
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout
        
        while (attempts < maxAttempts) {
          try {
            // Check if connection is established and basic metrics are available
            const status = await ApiService.getConnectionInfo();
            if (status.isConnected) {
              setConnectionStatus('Testing connection functionality...');
              
              // Try to get basic metrics to ensure the connection is fully functional
              try {
                await ApiService.getAllMetrics();
                // If we can get metrics, the connection is fully ready
                setConnectionStatus('Connection ready!');
                onConnect(config);
                onClose();
                return;
              } catch (metricsError) {
                // Metrics not ready yet, continue waiting
                setConnectionStatus(`Waiting for services... (${attempts + 1}/${maxAttempts})`);
              }
            }
          } catch (error) {
            setConnectionStatus(`Checking connection status... (${attempts + 1}/${maxAttempts})`);
          }
          
          // Wait 1 second before checking again
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
        
        // If we reach here, connection took too long
        setConnectionStatus('');
        setTestResult({
          success: false,
          error: 'Connection established but took too long to be ready. Please try again.'
        });
      } else {
        setConnectionStatus('');
        setTestResult({
          success: false,
          error: result.error || 'Connection failed'
        });
      }
    } catch (error) {
      setConnectionStatus('');
      setTestResult({
        success: false,
        error: (error as Error).message
      });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown
      slotProps={{
        backdrop: {
          onClick: (e: React.MouseEvent) => e.stopPropagation()
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Connect to Cassandra Cluster
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="h6" gutterBottom>
          Connection Details
        </Typography>
        
        <TextField
          label="Hosts (comma-separated)"
          value={config.hosts.join(', ')}
          onChange={(e) => setConfig(prev => ({ 
            ...prev, 
            hosts: e.target.value.split(',').map(h => h.trim()).filter(h => h)
          }))}
          fullWidth
          margin="normal"
          helperText="e.g. 127.0.0.1, 192.168.1.100"
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Port"
            type="number"
            value={config.port}
            onChange={(e) => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 9042 }))}
            margin="normal"
            sx={{ width: '50%' }}
          />
          
          <TextField
            label="Datacenter"
            value={config.datacenter}
            onChange={(e) => setConfig(prev => ({ ...prev, datacenter: e.target.value }))}
            margin="normal"
            sx={{ width: '50%' }}
          />
        </Box>

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          Authentication (Optional)
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Username"
            value={config.username}
            onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
            margin="normal"
            sx={{ width: '50%' }}
          />
          
          <TextField
            label="Password"
            type="password"
            value={config.password}
            onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
            margin="normal"
            sx={{ width: '50%' }}
          />
        </Box>

        {testResult && (
          <Alert 
            severity={testResult.success ? 'success' : 'error'}
            sx={{ mt: 2 }}
          >
            {testResult.success ? (
              <div>
                <Typography variant="body2">
                  <strong>Connection Successful!</strong>
                </Typography>
                <Typography variant="body2">
                  Cluster: {testResult.cluster}
                </Typography>
                <Typography variant="body2">
                  Nodes: {testResult.upNodes}/{testResult.nodes} online
                </Typography>
              </div>
            ) : (
              <Typography variant="body2">
                {testResult.error || 'Connection failed'}
              </Typography>
            )}
          </Alert>
        )}
        
        {connectionStatus && (
          <Alert 
            severity="info"
            sx={{ mt: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2">
                {connectionStatus}
              </Typography>
            </Box>
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={testConnection}
          disabled={config.hosts.length === 0 || config.hosts[0] === '' || testing}
          startIcon={testing ? <CircularProgress size={16} /> : <TestIcon />}
        >
          Test Connection
        </Button>
        <Button
          onClick={handleConnect}
          variant="contained"
          disabled={config.hosts.length === 0 || config.hosts[0] === '' || connecting}
          startIcon={connecting ? <CircularProgress size={16} /> : <ConnectedIcon />}
        >
          Connect
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConnectionManager;
