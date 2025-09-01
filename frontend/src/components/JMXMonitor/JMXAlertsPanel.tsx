import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Button,
  IconButton,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Tune as TuneIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';

interface JMXAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
  node?: string;
}

interface AlertThresholds {
  memoryUsageWarning: number;
  memoryUsageCritical: number;
  pendingTasksWarning: number;
  pendingTasksCritical: number;
  timeoutsWarning: number;
  timeoutsCritical: number;
  gcTimeWarning: number;
  gcTimeCritical: number;
}

interface JMXAlertsPanelProps {
  jmxData: any;
  aggregatedData: any;
}

const defaultThresholds: AlertThresholds = {
  memoryUsageWarning: 75,
  memoryUsageCritical: 85,
  pendingTasksWarning: 50,
  pendingTasksCritical: 100,
  timeoutsWarning: 10,
  timeoutsCritical: 50,
  gcTimeWarning: 1000,
  gcTimeCritical: 5000
};

const JMXAlertsPanel: React.FC<JMXAlertsPanelProps> = ({ jmxData, aggregatedData }) => {
  const [alerts, setAlerts] = useState<JMXAlert[]>([]);
  const [thresholds, setThresholds] = useState<AlertThresholds>(defaultThresholds);
  const [expandedAlert, setExpandedAlert] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [tempThresholds, setTempThresholds] = useState<AlertThresholds>(defaultThresholds);

  useEffect(() => {
    if (jmxData && aggregatedData) {
      generateAlerts();
    }
  }, [jmxData, aggregatedData, thresholds]);

  const generateAlerts = () => {
    const newAlerts: JMXAlert[] = [];

    // Check aggregated cluster-wide metrics
    if (aggregatedData?.aggregated) {
      const agg = aggregatedData.aggregated;

      // Memory usage alerts
      if (agg.memory?.totalHeapUsed && agg.memory?.totalHeapMax) {
        const memoryUsage = (agg.memory.totalHeapUsed / agg.memory.totalHeapMax) * 100;
        if (memoryUsage > thresholds.memoryUsageCritical) {
          newAlerts.push({
            id: `memory-critical-${Date.now()}`,
            type: 'error',
            title: 'Critical Memory Usage',
            message: `Cluster memory usage is at ${memoryUsage.toFixed(1)}% - immediate action required`,
            metric: 'memory.heapUsage',
            value: memoryUsage,
            threshold: thresholds.memoryUsageCritical,
            timestamp: new Date().toISOString(),
            acknowledged: false
          });
        } else if (memoryUsage > thresholds.memoryUsageWarning) {
          newAlerts.push({
            id: `memory-warning-${Date.now()}`,
            type: 'warning',
            title: 'High Memory Usage',
            message: `Cluster memory usage is at ${memoryUsage.toFixed(1)}% - consider scaling`,
            metric: 'memory.heapUsage',
            value: memoryUsage,
            threshold: thresholds.memoryUsageWarning,
            timestamp: new Date().toISOString(),
            acknowledged: false
          });
        }
      }

      // Pending tasks alerts
      if (agg.threadPools?.totalPendingTasks) {
        if (agg.threadPools.totalPendingTasks > thresholds.pendingTasksCritical) {
          newAlerts.push({
            id: `pending-critical-${Date.now()}`,
            type: 'error',
            title: 'Critical Pending Tasks',
            message: `${agg.threadPools.totalPendingTasks} pending tasks - cluster may be overloaded`,
            metric: 'threadPools.pendingTasks',
            value: agg.threadPools.totalPendingTasks,
            threshold: thresholds.pendingTasksCritical,
            timestamp: new Date().toISOString(),
            acknowledged: false
          });
        } else if (agg.threadPools.totalPendingTasks > thresholds.pendingTasksWarning) {
          newAlerts.push({
            id: `pending-warning-${Date.now()}`,
            type: 'warning',
            title: 'High Pending Tasks',
            message: `${agg.threadPools.totalPendingTasks} pending tasks - monitor cluster load`,
            metric: 'threadPools.pendingTasks',
            value: agg.threadPools.totalPendingTasks,
            threshold: thresholds.pendingTasksWarning,
            timestamp: new Date().toISOString(),
            acknowledged: false
          });
        }
      }

      // Timeout alerts
      if (agg.performance?.totalTimeouts) {
        if (agg.performance.totalTimeouts > thresholds.timeoutsCritical) {
          newAlerts.push({
            id: `timeouts-critical-${Date.now()}`,
            type: 'error',
            title: 'Critical Request Timeouts',
            message: `${agg.performance.totalTimeouts} request timeouts detected - check network and cluster health`,
            metric: 'performance.timeouts',
            value: agg.performance.totalTimeouts,
            threshold: thresholds.timeoutsCritical,
            timestamp: new Date().toISOString(),
            acknowledged: false
          });
        } else if (agg.performance.totalTimeouts > thresholds.timeoutsWarning) {
          newAlerts.push({
            id: `timeouts-warning-${Date.now()}`,
            type: 'warning',
            title: 'Request Timeouts',
            message: `${agg.performance.totalTimeouts} request timeouts - monitor cluster performance`,
            metric: 'performance.timeouts',
            value: agg.performance.totalTimeouts,
            threshold: thresholds.timeoutsWarning,
            timestamp: new Date().toISOString(),
            acknowledged: false
          });
        }
      }
    }

    // Check individual node metrics
    if (jmxData?.nodes) {
      jmxData.nodes.forEach((node: any) => {
        // Use JMX resources structure for memory metrics
        const heapUsed = node.metrics.resources?.memory?.heap?.used || 0;
        const heapMax = node.metrics.resources?.memory?.heap?.max || 1;
        const nodeMemoryUsage = (heapUsed / heapMax) * 100;
        
        if (nodeMemoryUsage > thresholds.memoryUsageCritical) {
          newAlerts.push({
            id: `node-memory-critical-${node.host}-${Date.now()}`,
            type: 'error',
            title: `Critical Memory on ${node.host}`,
            message: `Node memory usage is at ${nodeMemoryUsage.toFixed(1)}%`,
            metric: 'node.memory.heapUsage',
            value: nodeMemoryUsage,
            threshold: thresholds.memoryUsageCritical,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            node: node.host
          });
        }

        // Check for excessive GC time using JMX resources structure
        const youngGenTime = node.metrics.resources?.gc?.youngGen?.time || 0;
        const oldGenTime = node.metrics.resources?.gc?.oldGen?.time || 0;
        const totalGCTime = youngGenTime + oldGenTime;
        if (totalGCTime > thresholds.gcTimeCritical) {
          newAlerts.push({
            id: `gc-critical-${node.host}-${Date.now()}`,
            type: 'warning',
            title: `High GC Time on ${node.host}`,
            message: `Total GC time: ${totalGCTime}ms - may impact performance`,
            metric: 'node.gc.totalTime',
            value: totalGCTime,
            threshold: thresholds.gcTimeCritical,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            node: node.host
          });
        }
      });
    }

    setAlerts(newAlerts);
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'info': return <InfoIcon color="info" />;
      case 'success': return <SuccessIcon color="success" />;
      default: return <InfoIcon />;
    }
  };

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  const acknowledgedAlerts = alerts.filter(a => a.acknowledged);

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          JMX Alerts ({unacknowledgedAlerts.length} active)
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<TuneIcon />}
          onClick={() => {
            setTempThresholds(thresholds);
            setShowSettings(true);
          }}
        >
          Configure Thresholds
        </Button>
      </Box>

      {/* Active Alerts */}
      {unacknowledgedAlerts.length > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Active Alerts
          </Typography>
          {unacknowledgedAlerts.map((alert) => (
            <Alert 
              key={alert.id}
              severity={alert.type}
              sx={{ mb: 1 }}
              action={
                <Button 
                  color="inherit" 
                  size="small"
                  onClick={() => acknowledgeAlert(alert.id)}
                >
                  Acknowledge
                </Button>
              }
            >
              <AlertTitle>{alert.title}</AlertTitle>
              {alert.message}
              {alert.node && (
                <Chip 
                  label={`Node: ${alert.node}`} 
                  size="small" 
                  sx={{ mt: 1 }} 
                />
              )}
            </Alert>
          ))}
        </Box>
      ) : (
        <Alert severity="success" sx={{ mb: 2 }}>
          <AlertTitle>All Clear</AlertTitle>
          No active alerts detected. Cluster metrics are within normal thresholds.
        </Alert>
      )}

      {/* Acknowledged Alerts */}
      {acknowledgedAlerts.length > 0 && (
        <Box>
          <Button
            variant="text"
            size="small"
            onClick={() => setExpandedAlert(expandedAlert ? '' : 'acknowledged')}
            startIcon={expandedAlert === 'acknowledged' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            Acknowledged Alerts ({acknowledgedAlerts.length})
          </Button>
          <Collapse in={expandedAlert === 'acknowledged'}>
            <List dense>
              {acknowledgedAlerts.map((alert) => (
                <ListItem key={alert.id}>
                  <ListItemIcon>
                    {getAlertIcon(alert.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={alert.title}
                    secondary={`${alert.message} (${new Date(alert.timestamp).toLocaleString()})`}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Box>
      )}

      {/* Threshold Configuration Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="md" fullWidth>
        <DialogTitle>Configure Alert Thresholds</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
            <TextField
              label="Memory Usage Warning (%)"
              type="number"
              value={tempThresholds.memoryUsageWarning}
              onChange={(e) => setTempThresholds(prev => ({...prev, memoryUsageWarning: Number(e.target.value)}))}
              fullWidth
            />
            <TextField
              label="Memory Usage Critical (%)"
              type="number"
              value={tempThresholds.memoryUsageCritical}
              onChange={(e) => setTempThresholds(prev => ({...prev, memoryUsageCritical: Number(e.target.value)}))}
              fullWidth
            />
            <TextField
              label="Pending Tasks Warning"
              type="number"
              value={tempThresholds.pendingTasksWarning}
              onChange={(e) => setTempThresholds(prev => ({...prev, pendingTasksWarning: Number(e.target.value)}))}
              fullWidth
            />
            <TextField
              label="Pending Tasks Critical"
              type="number"
              value={tempThresholds.pendingTasksCritical}
              onChange={(e) => setTempThresholds(prev => ({...prev, pendingTasksCritical: Number(e.target.value)}))}
              fullWidth
            />
            <TextField
              label="Timeouts Warning"
              type="number"
              value={tempThresholds.timeoutsWarning}
              onChange={(e) => setTempThresholds(prev => ({...prev, timeoutsWarning: Number(e.target.value)}))}
              fullWidth
            />
            <TextField
              label="Timeouts Critical"
              type="number"
              value={tempThresholds.timeoutsCritical}
              onChange={(e) => setTempThresholds(prev => ({...prev, timeoutsCritical: Number(e.target.value)}))}
              fullWidth
            />
            <TextField
              label="GC Time Warning (ms)"
              type="number"
              value={tempThresholds.gcTimeWarning}
              onChange={(e) => setTempThresholds(prev => ({...prev, gcTimeWarning: Number(e.target.value)}))}
              fullWidth
            />
            <TextField
              label="GC Time Critical (ms)"
              type="number"
              value={tempThresholds.gcTimeCritical}
              onChange={(e) => setTempThresholds(prev => ({...prev, gcTimeCritical: Number(e.target.value)}))}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              setThresholds(tempThresholds);
              setShowSettings(false);
            }}
            variant="contained"
          >
            Save Thresholds
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default JMXAlertsPanel;
