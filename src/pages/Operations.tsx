import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Operation } from '../types';

const Operations: React.FC = () => {
  const { isConnected, operations: wsOperations } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected && wsOperations) {
      setLoading(false);
      setError(null);
    } else if (!isConnected) {
      setLoading(false);
    }
  }, [isConnected, wsOperations]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'primary';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  if (!isConnected) {
    return (
      <Alert severity="error">
        Not connected to Cassandra cluster. Please check your connection.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading operations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading operations: {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Cluster Operations
      </Typography>
      
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Recent cluster operations including compactions, repairs, and maintenance tasks.
      </Typography>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Operations ({wsOperations?.length || 0})
          </Typography>
          
          {(!wsOperations || wsOperations.length === 0) ? (
            <Alert severity="info">
              No recent operations found.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Keyspace</TableCell>
                    <TableCell>Table</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {wsOperations.map((operation, index) => (
                    <TableRow key={operation.id || index}>
                      <TableCell>
                        <Chip
                          label={operation.type}
                          variant={operation.isSystemOperation ? 'outlined' : 'filled'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{operation.keyspace}</TableCell>
                      <TableCell>{operation.table || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={operation.status}
                          color={getStatusColor(operation.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(operation.startTime).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {operation.result && operation.result.bytesIn && (
                          <Typography variant="body2">
                            {formatBytes(operation.result.bytesIn)} → {formatBytes(operation.result.bytesOut)}
                            {operation.result.compressionRatio && ` (${operation.result.compressionRatio})`}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Operations;
