import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AllMetrics, Operation, WebSocketMessage } from '../types';

interface WebSocketContextType {
  isConnected: boolean;
  isWebSocketConnected: boolean;
  isCassandraConnected: boolean;
  metrics: AllMetrics | null;
  operations: Operation[];
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
