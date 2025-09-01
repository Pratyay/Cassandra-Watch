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
    
    try {
      const result = await ApiService.connect({
        hosts: config.hosts,
        port: config.port,
        datacenter: config.datacenter,
        username: config.username,
        password: config.password
      });
      
      if (result.success) {
        onConnect(config);
        onClose();
      } else {
        setTestResult({
          success: false,
          error: result.error || 'Connection failed'
        });
      }
    } catch (error) {
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
