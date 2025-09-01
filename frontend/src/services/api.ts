import axios from 'axios';
import { AllMetrics, Operation, QueryResult, NodetoolResult } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // Increased from 30000ms to 120000ms (2 minutes)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export class ApiService {
  // Metrics endpoints
  static async getAllMetrics(): Promise<AllMetrics> {
    const response = await api.get('/api/metrics');
    return response.data;
  }

  static async getClusterMetrics() {
    const response = await api.get('/api/metrics/cluster');
    return response.data;
  }

  static async getNodesInfo() {
    const response = await api.get('/api/metrics/nodes');
    return response.data;
  }

  static async getKeyspacesInfo() {
    const response = await api.get('/api/metrics/keyspaces');
    return response.data;
  }

  static async getTablesInfo(keyspace: string) {
    const response = await api.get(`/api/metrics/keyspaces/${keyspace}/tables`);
    return response.data;
  }

  static async getPerformanceMetrics() {
    const response = await api.get('/api/metrics/performance');
    return response.data;
  }

  static async getStorageMetrics() {
    const response = await api.get('/api/metrics/storage');
    return response.data;
  }

  static async getSystemMetrics() {
    const response = await api.get('/api/metrics/system');
    return response.data;
  }

  // Operations endpoints
  static async getClusterStatus(): Promise<NodetoolResult> {
    const response = await api.get('/api/operations/cluster/status');
    return response.data;
  }

  static async getClusterInfo(): Promise<NodetoolResult> {
    const response = await api.get('/api/operations/cluster/info');
    return response.data;
  }

  static async repairKeyspace(keyspace?: string, options?: any): Promise<NodetoolResult> {
    const endpoint = keyspace ? `/api/operations/repair/${keyspace}` : '/api/operations/repair';
    const response = await api.post(endpoint, options);
    return response.data;
  }

  static async compactKeyspace(keyspace?: string): Promise<NodetoolResult> {
    const endpoint = keyspace ? `/api/operations/compact/${keyspace}` : '/api/operations/compact';
    const response = await api.post(endpoint);
    return response.data;
  }

  static async flushKeyspace(keyspace?: string): Promise<NodetoolResult> {
    const endpoint = keyspace ? `/api/operations/flush/${keyspace}` : '/api/operations/flush';
    const response = await api.post(endpoint);
    return response.data;
  }

  static async cleanupKeyspace(keyspace?: string): Promise<NodetoolResult> {
    const endpoint = keyspace ? `/api/operations/cleanup/${keyspace}` : '/api/operations/cleanup';
    const response = await api.post(endpoint);
    return response.data;
  }

  static async scrubKeyspace(keyspace?: string): Promise<NodetoolResult> {
    const endpoint = keyspace ? `/api/operations/scrub/${keyspace}` : '/api/operations/scrub';
    const response = await api.post(endpoint);
    return response.data;
  }

  static async drainNode(): Promise<NodetoolResult> {
    const response = await api.post('/api/operations/drain');
    return response.data;
  }

  static async createKeyspace(name: string, replicationStrategy: any) {
    const response = await api.post('/api/operations/keyspace', {
      name,
      replicationStrategy
    });
    return response.data;
  }

  static async dropKeyspace(name: string) {
    const response = await api.delete(`/api/operations/keyspace/${name}`);
    return response.data;
  }

  static async executeQuery(query: string, consistency?: string): Promise<QueryResult> {
    const response = await api.post('/api/operations/query', {
      query,
      consistency
    });
    return response.data;
  }

  static async getActiveOperations(): Promise<Operation[]> {
    const response = await api.get('/api/operations/active');
    return response.data;
  }

  static async getOperationStatus(operationId: string): Promise<Operation> {
    const response = await api.get(`/api/operations/status/${operationId}`);
    return response.data;
  }

  static async getCompactionStats(): Promise<NodetoolResult> {
    const response = await api.get('/api/operations/stats/compaction');
    return response.data;
  }

  static async getThreadPoolStats(): Promise<NodetoolResult> {
    const response = await api.get('/api/operations/stats/threadpool');
    return response.data;
  }

  static async getGCStats(): Promise<NodetoolResult> {
    const response = await api.get('/api/operations/stats/gc');
    return response.data;
  }

  // Connection management
  static async testConnection(config: any) {
    const response = await api.post('/api/connections/test', config);
    return response.data;
  }

  static async connect(config: any) {
    const response = await api.post('/api/connections/connect', config);
    return response.data;
  }

  static async disconnect() {
    const response = await api.post('/api/connections/disconnect');
    return response.data;
  }

  static async getConnectionInfo() {
    const response = await api.get('/api/connections/info');
    return response.data;
  }

  // JMX endpoints
  static async testJMXConnection(host: string, port: number = 7199) {
    const response = await api.post('/api/jmx/test', { host, port });
    return response.data;
  }

  static async getJMXMetrics(host: string, port: number = 7199) {
    const response = await api.get(`/api/jmx/metrics/${host}?port=${port}`);
    return response.data;
  }

  static async getClusterJMXMetrics() {
    const response = await api.get('/api/jmx/cluster-metrics');
    return response.data;
  }

  static async getAllNodesJMXMetrics() {
    const response = await api.get('/api/jmx/all-nodes');
    return response.data;
  }

  static async getMBeans(host: string, port: number = 7199) {
    const response = await api.get(`/api/jmx/mbeans/${host}?port=${port}`);
    return response.data;
  }

  static async getMBeanValue(host: string, mbean: string, port: number = 7199, attribute?: string) {
    const encodedMBean = encodeURIComponent(mbean);
    const url = `/api/jmx/mbean/${host}/${encodedMBean}?port=${port}${attribute ? `&attribute=${attribute}` : ''}`;
    const response = await api.get(url);
    return response.data;
  }

  static async disconnectJMX() {
    const response = await api.post('/api/jmx/disconnect');
    return response.data;
  }

  static async forceDisconnectJMX() {
    const response = await api.post('/api/jmx/force-disconnect');
    return response.data;
  }

  static async checkJMXHealth(host: string, port: number = 7199) {
    const response = await api.get(`/api/jmx/health/${host}?port=${port}`);
    return response.data;
  }

  // Health check
  static async getHealth() {
    const response = await api.get('/health');
    return response.data;
  }
}

export default ApiService;
