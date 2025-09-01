import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Code as CodeIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useWebSocket } from '../contexts/WebSocketContext';
import ApiService from '../services/api';

interface KeyspaceInfo {
  name: string;
  replication: Record<string, any>;
  isSystemKeyspace: boolean;
  tableCount: number;
}

interface QueryResult {
  success: boolean;
  rows?: any[];
  rowCount?: number;
  columns?: Array<{ name: string; type: string }>;
  error?: string;
  keyspace?: string;
  table?: string;
}

// Helper function to safely render cell values
const renderCellValue = (value: any): string => {
  if (value === null || value === undefined) {
    return 'null';
  }
  
  if (typeof value === 'object') {
    // Handle Cassandra-specific object types like {code: "uuid-value", type: "uuid"}
    if (value && 'code' in value) {
      return String(value.code);
    }
    // For other objects, stringify them
    return JSON.stringify(value);
  }
  
  // For primitive values
  return String(value);
};

const DataExplorer: React.FC = () => {
  const [keyspaces, setKeyspaces] = useState<KeyspaceInfo[]>([]);
  const [selectedKeyspace, setSelectedKeyspace] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tables, setTables] = useState<any[]>([]);
  const [tableSchema, setTableSchema] = useState<any>(null);
  const [query, setQuery] = useState<string>('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Modal state for viewing full cell content
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ columnName: string; content: string; rowIndex: number }>({ columnName: '', content: '', rowIndex: 0 });
  
  const handleViewFullContent = (columnName: string, content: string, rowIndex: number) => {
    setModalContent({ columnName, content, rowIndex });
    setModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setModalOpen(false);
    setModalContent({ columnName: '', content: '', rowIndex: 0 });
  };

  // Function to check connection and load keyspaces
  const checkConnectionAndLoadKeyspaces = async () => {
    try {
      setLoading(true);
      // Check if backend is connected to Cassandra
      const connectionResponse = await fetch('/api/api/connections/info');
      const connectionInfo = await connectionResponse.json();
      
      setIsConnected(connectionInfo.isConnected);
      
      if (connectionInfo.isConnected) {
        // Load keyspaces if connected
        const keyspacesResponse = await fetch('/api/api/metrics/keyspaces');
        if (keyspacesResponse.ok) {
          const keyspacesData = await keyspacesResponse.json();
          setKeyspaces(keyspacesData);
        }
      } else {
        setKeyspaces([]);
      }
    } catch (err) {
      console.error('Error checking connection or loading keyspaces:', err);
      setIsConnected(false);
      setKeyspaces([]);
    } finally {
      setLoading(false);
    }
  };

  // Check connection status and load keyspaces on component mount
  useEffect(() => {
    checkConnectionAndLoadKeyspaces();
  }, []);

  // Load tables when keyspace changes
  useEffect(() => {
    const fetchTables = async (keyspace: string) => {
      if (!isConnected) {
        // Removed console.log for production
        return;
      }

      try {
        // Removed console.log for production
        const response = await ApiService.getTablesInfo(keyspace);
        
        // Removed console.log for production
        
        if (response && Array.isArray(response)) {
          // Removed console.log for production
          setTables(response);
          // Removed console.log for production
        } else {
          setTables([]);
        }
      } catch (error) {
        console.error('Error fetching tables:', error);
        setTables([]);
      }
    };

    if (selectedKeyspace) {
      fetchTables(selectedKeyspace);
    } else {
      setTables([]);
    }
  }, [selectedKeyspace, isConnected]);

  const handleKeyspaceChange = (event: SelectChangeEvent) => {
    setSelectedKeyspace(event.target.value);
    setSelectedTable('');
    setQueryResult(null);
  };

  const handleTableChange = async (event: SelectChangeEvent) => {
    const tableName = event.target.value;
    setSelectedTable(tableName);
    setTableSchema(null);
    
    // Auto-generate a query when table is selected
    if (tableName) {
      setQuery(`SELECT * FROM ${selectedKeyspace}.${tableName} LIMIT 100`);
      
      // Load table schema
      try {
        const schemaResponse = await fetch(`/api/api/operations/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            query: `DESCRIBE TABLE ${selectedKeyspace}.${tableName}` 
          })
        });
        
        if (schemaResponse.ok) {
          const schemaData = await schemaResponse.json();
          setTableSchema(schemaData);
        }
      } catch (err) {
        console.error('Error loading table schema:', err);
      }
    } else {
      setQuery('');
    }
  };

  const handleBrowseTable = async () => {
    if (!selectedKeyspace || !selectedTable) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/api/operations/browse/${selectedKeyspace}/${selectedTable}?limit=100`);
      const data = await response.json();
      
      if (response.ok) {
        setQueryResult(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to browse table');
        setQueryResult(null);
      }
    } catch (err) {
      console.error('Browse table error:', err);
      setError('Failed to connect to backend');
      setQueryResult(null);
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async () => {
    if (!query) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/api/operations/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setQueryResult(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to execute query');
        setQueryResult(null);
      }
    } catch (err) {
      console.error('Execute query error:', err);
      setError('Failed to connect to backend');
      setQueryResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Remove the connection check since we're controlling when this component renders
  // The App component ensures this only renders when connection is ready

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          Data Explorer
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={checkConnectionAndLoadKeyspaces}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>
      
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Browse keyspaces, tables, and execute CQL queries against your Cassandra cluster.
      </Typography>

      <Box sx={{ mt: 1, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        {/* Keyspace & Table Selection */}
        <Box sx={{ flex: { xs: '1', md: '0 0 33%' } }}>
          <Card>
            <CardContent>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="keyspace-select-label">Keyspace</InputLabel>
                <Select
                  labelId="keyspace-select-label"
                  value={selectedKeyspace}
                  label="Keyspace"
                  onChange={handleKeyspaceChange}
                >
                  <MenuItem value=""><em>Select a keyspace</em></MenuItem>
                  {keyspaces.map((keyspace) => (
                    <MenuItem key={keyspace.name} value={keyspace.name}>
                      {keyspace.name} ({keyspace.tableCount} tables)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {selectedKeyspace && (
                <FormControl fullWidth>
                  <InputLabel id="table-select-label">Table</InputLabel>
                  <Select
                    labelId="table-select-label"
                    value={selectedTable}
                    label="Table"
                    onChange={handleTableChange}
                  >
                    <MenuItem value=""><em>Select a table</em></MenuItem>
                    {tables.map((table) => (
                      <MenuItem key={table.name} value={table.name}>
                        {table.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              
              {selectedKeyspace && selectedTable && (
                <>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth 
                    sx={{ mt: 2 }}
                    onClick={handleBrowseTable}
                    disabled={loading}
                  >
                    Browse Table Data
                  </Button>
                  
                  {/* Table Schema */}
                  {tableSchema && tableSchema.success && tableSchema.rows && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Table Schema:
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflow: 'auto' }}>
                        <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                          {tableSchema.rows.map((row: any) => {
                            const statement = row.create_statement || row.cql || JSON.stringify(row);
                            return renderCellValue(statement);
                          }).join('\n')}
                        </Typography>
                      </Paper>
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Box>
        
        {/* Query Editor */}
        <Box sx={{ flex: { xs: '1', md: '0 0 67%' } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                CQL Query
              </Typography>
              
              <TextField
                label="Enter CQL Query"
                variant="outlined"
                fullWidth
                multiline
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                sx={{ mb: 2 }}
              />
              
              <Button 
                variant="contained" 
                color="primary"
                onClick={executeQuery}
                disabled={!query || loading}
                startIcon={<CodeIcon />}
              >
                Execute Query
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
      
      {/* Query Results */}
      <Box sx={{ mt: 3 }}>
        <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Query Results
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : !queryResult ? (
                <Alert severity="info">Select a table or write a query to see results</Alert>
              ) : !queryResult.success ? (
                <Alert severity="error">{queryResult.error}</Alert>
              ) : (
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {queryResult.rowCount === 0 
                      ? 'No rows found' 
                      : `Found ${queryResult.rowCount} row${queryResult.rowCount !== 1 ? 's' : ''}`}
                  </Typography>
                  
                  {queryResult.rows && queryResult.rows.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {queryResult.columns?.map((column) => (
                              <TableCell key={column.name}>
                                <Typography variant="body2">
                                  <strong>{column.name}</strong>
                                  <Typography variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                                    ({renderCellValue(column.type)})
                                  </Typography>
                                </Typography>
                              </TableCell>
                            )) ||
                            Object.keys(queryResult.rows[0]).map((key) => (
                              <TableCell key={key}>
                                <Typography variant="body2">
                                  <strong>{key}</strong>
                                </Typography>
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {queryResult.rows.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {Object.entries(row).map(([key, value], cellIndex) => {
                                // Always convert to string first
                                let displayText: string;
                                
                                if (value === null || value === undefined) {
                                  displayText = 'null';
                                } else if (typeof value === 'object') {
                                  // Handle Cassandra objects with code property
                                  if (value && typeof value === 'object' && 'code' in value) {
                                    displayText = String(value.code);
                                  } else {
                                    displayText = JSON.stringify(value);
                                  }
                                } else {
                                  displayText = String(value);
                                }
                                
                                // Truncate if too long
                                const truncatedText = displayText.length > 50 
                                  ? displayText.substring(0, 50) + '...' 
                                  : displayText;
                                
                                return (
                                  <TableCell key={`${rowIndex}-${cellIndex}`}>
                                    {value === null || value === undefined ? (
                                      <em style={{ color: '#999' }}>null</em>
                                    ) : (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <span style={{ flex: 1 }}>{truncatedText}</span>
                                        {displayText.length > 50 && (
                                          <Tooltip title="View full content">
                                            <IconButton 
                                              size="small" 
                                              onClick={() => handleViewFullContent(key, displayText, rowIndex)}
                                              sx={{ minWidth: 'auto', p: 0.5 }}
                                            >
                                              <VisibilityIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        )}
                                      </Box>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Query executed successfully, but no rows returned.
                    </Alert>
                  )}
                </Box>
              )}
            </CardContent>
        </Card>
      </Box>
      
      {/* Modal for viewing full cell content */}
      <Dialog 
        open={modalOpen} 
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {modalContent.columnName} (Row {modalContent.rowIndex + 1})
            </Typography>
            <IconButton 
              edge="end" 
              color="inherit" 
              onClick={handleCloseModal}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Paper variant="outlined" sx={{ p: 2, maxHeight: '60vh', overflow: 'auto', bgcolor: '#ffffff' }}>
            <Typography 
              variant="body2" 
              component="pre" 
              sx={{ 
                fontFamily: 'monospace', 
                fontSize: '0.875rem', 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                color: '#000000',
                margin: 0
              }}
            >
              {modalContent.content}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal} color="primary">
            Close
          </Button>
          <Button 
            onClick={() => navigator.clipboard.writeText(modalContent.content)}
            color="primary" 
            variant="contained"
          >
            Copy to Clipboard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataExplorer;
