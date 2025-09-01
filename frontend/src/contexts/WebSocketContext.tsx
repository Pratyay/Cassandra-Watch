import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AllMetrics, Operation, WebSocketMessage } from '../types';
import ApiService from '../services/api';

interface WebSocketContextType {
  isConnected: boolean;
  isWebSocketConnected: boolean;
  isCassandraConnected: boolean;
  metrics: AllMetrics | null;
  operations: Operation[];
  // JMX connection state
  jmxConnected: boolean;
  jmxData: any;
  jmxLoading: boolean;
  jmxError: string | null;
  // JMX methods
  connectJMX: () => Promise<void>;
  getJMXData: (forceRefresh?: boolean) => Promise<any>;
  sendMessage: (message: any) => void;
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [isCassandraConnected, setIsCassandraConnected] = useState(false);
  const [metrics, setMetrics] = useState<AllMetrics | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  
  // JMX connection state
  const [jmxConnected, setJmxConnected] = useState(false);
  const [jmxData, setJmxData] = useState<any>(null);
  const [jmxLoading, setJmxLoading] = useState(false);
  const [jmxError, setJmxError] = useState<string | null>(null);
  const [jmxLastFetch, setJmxLastFetch] = useState<number>(0);
  const jmxCacheTimeout = 5000; // 5 seconds cache

  const connect = useCallback(() => {
    try {
      const websocket = new WebSocket('ws://localhost:3001/ws');
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        setIsWebSocketConnected(true);
        setWs(websocket);
        
        // Subscribe to metrics and operations updates
        websocket.send(JSON.stringify({
          type: 'subscribe',
          channels: ['metrics', 'operations', 'alerts']
        }));
        
        // Initialize JMX connection after WebSocket is ready
        setTimeout(() => {
          connectJMX();
        }, 1000);
      };

      websocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onclose = () => {
        console.log('WebSocket disconnected');
        setIsWebSocketConnected(false);
        setIsCassandraConnected(false);
        setWs(null);
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (!isWebSocketConnected) {
            connect();
          }
        }, 3000);
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsWebSocketConnected(false);
        setIsCassandraConnected(false);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [isWebSocketConnected]);

  const handleMessage = (message: WebSocketMessage) => {
    console.log('WebSocket message received:', message.type, message);
    switch (message.type) {
      case 'initial':
        setIsCassandraConnected(true);
        console.log('Received initial data:', message.data);
        if (message.data?.metrics) {
          setMetrics(message.data.metrics);
          console.log('Set metrics:', message.data.metrics);
        }
        if (message.data?.operations) {
          setOperations(message.data.operations);
          console.log('Set operations:', message.data.operations);
        }
        break;
        
      case 'connection_pending':
        setIsCassandraConnected(false);
        console.log('Cassandra connection pending:', message.message);
        break;
        
      case 'metrics_update':
        setIsCassandraConnected(true);
        console.log('Received metrics update:', message.data);
        if (message.data) {
          setMetrics(message.data);
        }
        break;
        
      case 'operations_update':
        if (message.data) {
          setOperations(message.data);
        }
        break;
        
      case 'operation_update':
        if (message.data?.operationId && message.data?.operation) {
          setOperations(prev => 
            prev.map(op => 
              op.id === message.data.operationId 
                ? { ...op, ...message.data.operation }
                : op
            )
          );
        }
        break;
        
      case 'alert':
        // Handle alerts (could show notifications)
        console.log('Alert received:', message.data);
        break;
        
      case 'error':
        console.error('WebSocket error message:', message.message);
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const sendMessage = useCallback((message: any) => {
    if (ws && isWebSocketConnected) {
      ws.send(JSON.stringify(message));
    }
  }, [ws, isWebSocketConnected]);

  const subscribe = useCallback((channels: string[]) => {
    sendMessage({
      type: 'subscribe',
      channels
    });
  }, [sendMessage]);

  const unsubscribe = useCallback((channels: string[]) => {
    sendMessage({
      type: 'unsubscribe',
      channels
    });
  }, [sendMessage]);

  const connectJMX = useCallback(async () => {
    if (jmxConnected && jmxData && (Date.now() - jmxLastFetch) < jmxCacheTimeout) {
      console.log('JMX: Using cached data');
      return;
    }
    
    try {
      setJmxLoading(true);
      setJmxError(null);
      
      console.log('JMX: Establishing connection...');
      const allNodesData = await ApiService.getAllNodesJMXMetrics();
      
      if (allNodesData?.success) {
        setJmxData(allNodesData);
        setJmxConnected(true);
        setJmxLastFetch(Date.now());
        console.log('JMX: Connection established successfully');
      } else {
        throw new Error('Failed to establish JMX connection');
      }
    } catch (error: any) {
      console.error('JMX: Connection failed:', error);
      setJmxError(error.message || 'JMX connection failed');
      setJmxConnected(false);
    } finally {
      setJmxLoading(false);
    }
  }, [jmxConnected, jmxData, jmxLastFetch]);

  const getJMXData = useCallback(async (forceRefresh: boolean = false) => {
    // Return cached data if available and not expired
    if (!forceRefresh && jmxData && (Date.now() - jmxLastFetch) < jmxCacheTimeout) {
      console.log('JMX: Returning cached data');
      return jmxData;
    }
    
    // If not connected, connect first
    if (!jmxConnected) {
      await connectJMX();
    }
    
    // Fetch fresh data
    try {
      setJmxLoading(true);
      const allNodesData = await ApiService.getAllNodesJMXMetrics();
      
      if (allNodesData?.success) {
        setJmxData(allNodesData);
        setJmxLastFetch(Date.now());
        setJmxError(null);
        return allNodesData;
      } else {
        throw new Error('Failed to fetch JMX data');
      }
    } catch (error: any) {
      console.error('JMX: Data fetch failed:', error);
      setJmxError(error.message || 'Failed to fetch JMX data');
      throw error;
    } finally {
      setJmxLoading(false);
    }
  }, [jmxConnected, jmxData, jmxLastFetch, connectJMX]);

  useEffect(() => {
    connect();
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const value: WebSocketContextType = {
    isConnected: isCassandraConnected,
    isWebSocketConnected,
    isCassandraConnected,
    metrics,
    operations,
    // JMX state
    jmxConnected,
    jmxData,
    jmxLoading,
    jmxError,
    // JMX methods
    connectJMX,
    getJMXData,
    sendMessage,
    subscribe,
    unsubscribe
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
