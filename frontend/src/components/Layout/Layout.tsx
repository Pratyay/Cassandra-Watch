import React from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  AccountTree as TopologyIcon,
  Speed as PerformanceIcon,
  Build as OperationsIcon,
  Storage as DataIcon,
  Settings as SettingsIcon,
  Circle as StatusIcon,
  PowerSettingsNew as DisconnectIcon,
  Cable as ConnectionIcon,
  Menu,
  Analytics as JMXIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWebSocket } from '../../contexts/WebSocketContext';
import Logo from '../Logo/Logo';

const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
  connectionInfo?: any;
  onDisconnect?: () => void;
  onShowConnectionManager?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, connectionInfo, onDisconnect, onShowConnectionManager }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected, metrics } = useWebSocket();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const navigationItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Cluster Topology', icon: <TopologyIcon />, path: '/topology' },
    { text: 'Performance', icon: <PerformanceIcon />, path: '/performance' },
    { text: 'JMX Monitoring', icon: <JMXIcon />, path: '/jmx' },
    { text: 'Operations', icon: <OperationsIcon />, path: '/operations' },
    { text: 'Data Explorer', icon: <DataIcon />, path: '/data' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          backgroundColor: '#1e1e1e',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="h6" color="primary" sx={{ fontWeight: 500 }}>
              {location.pathname === '/' && 'Dashboard'}
              {location.pathname === '/topology' && 'Cluster Topology'}
              {location.pathname === '/performance' && 'Performance Metrics'}
              {location.pathname === '/jmx' && 'JMX Monitoring'}
              {location.pathname === '/operations' && 'Operations'}
              {location.pathname === '/data' && 'Data Explorer'}
              {location.pathname === '/settings' && 'Settings'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {metrics?.cluster && (
              <>
                <Typography variant="body2" color="textSecondary" sx={{ minWidth: 'fit-content' }}>
                  {metrics.cluster.name}
                </Typography>
                <Chip
                  label={`${metrics.cluster.upNodes}/${metrics.cluster.totalNodes} nodes`}
                  color={metrics.cluster.upNodes === metrics.cluster.totalNodes ? 'success' : 'warning'}
                  size="small"
                  sx={{ minWidth: 'fit-content' }}
                />
              </>
            )}
            
            <Chip
              icon={<StatusIcon sx={{ fontSize: 16 }} />}
              label={isConnected ? 'Connected' : 'Disconnected'}
              color={isConnected ? 'success' : 'error'}
              size="small"
              sx={{ minWidth: 'fit-content' }}
            />
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                icon={<ConnectionIcon sx={{ fontSize: 16 }} />}
                label="Reconnect"
                color="primary"
                size="small"
                onClick={onShowConnectionManager}
                sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
              />
              <Chip
                icon={<DisconnectIcon sx={{ fontSize: 16 }} />}
                label="Disconnect"
                color="error"
                size="small"
                onClick={onDisconnect}
                sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
              />
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: '#2d2d2d',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar>
          <Logo variant="compact" size="small" />
        </Toolbar>
        <Divider />
        
        <List>
          {navigationItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(144, 202, 249, 0.12)',
                    '&:hover': {
                      backgroundColor: 'rgba(144, 202, 249, 0.2)',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ color: location.pathname === item.path ? '#90caf9' : 'inherit' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  sx={{ 
                    '& .MuiTypography-root': { 
                      color: location.pathname === item.path ? '#90caf9' : 'inherit' 
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={onShowConnectionManager}>
              <ListItemIcon>
                <ConnectionIcon />
              </ListItemIcon>
              <ListItemText primary="Reconnect" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={onDisconnect}>
              <ListItemIcon>
                <DisconnectIcon />
              </ListItemIcon>
              <ListItemText primary="Disconnect" />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
