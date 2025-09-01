import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle as OnlineIcon,
  Cancel as OfflineIcon,
} from '@mui/icons-material';
import { useWebSocket } from '../contexts/WebSocketContext';

const ClusterTopology: React.FC = () => {
  const { metrics } = useWebSocket();

  // Remove the connection check since we're controlling when this component renders
  // The App component ensures this only renders when connection is ready

  if (!metrics) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading cluster topology...
        </Typography>
      </Box>
    );
  }

  const { cluster, nodes } = metrics;

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" gutterBottom>
        Cluster Topology
      </Typography>
      
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Visualize your Cassandra cluster's physical and logical topology
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Cluster Overview */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Cluster Overview
            </Typography>
            
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, 
              gap: 2 
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="primary">
                  {cluster.totalNodes}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Nodes
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="success.main">
                  {cluster.upNodes}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Online Nodes
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="secondary.main">
                  {cluster.datacenters.length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Datacenters
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h3">
                  {nodes.reduce((sum, node) => sum + node.tokens, 0)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Tokens
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Node List */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Cluster Nodes
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {nodes.map((node) => (
                <Box 
                  key={node.address}
                  sx={{ 
                    p: 2, 
                    border: 1, 
                    borderColor: 'divider', 
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body1" fontWeight="bold">
                      {node.address}
                    </Typography>
                    <Chip
                      icon={node.isUp ? <OnlineIcon /> : <OfflineIcon />}
                      label={node.isUp ? 'Online' : 'Offline'}
                      color={node.isUp ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <Typography variant="body2">
                      DC: {node.datacenter}
                    </Typography>
                    <Typography variant="body2">
                      Rack: {node.rack}
                    </Typography>
                    <Typography variant="body2">
                      Tokens: {node.tokens}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ClusterTopology;
