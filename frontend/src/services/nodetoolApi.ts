import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

class NodetoolApiService {
    private baseUrl = '/api/nodetool';

    async getAllMetrics() {
        try {
            const response = await api.get(`${this.baseUrl}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching nodetool metrics:', error);
            throw error;
        }
    }

    async getClusterStatus() {
        try {
            const response = await api.get(`${this.baseUrl}/cluster/status`);
            return response.data;
        } catch (error) {
            console.error('Error fetching cluster status:', error);
            throw error;
        }
    }

    async getClusterInfo() {
        try {
            const response = await api.get(`${this.baseUrl}/cluster/info`);
            return response.data;
        } catch (error) {
            console.error('Error fetching cluster info:', error);
            throw error;
        }
    }

    async getCompactionStats() {
        try {
            const response = await api.get(`${this.baseUrl}/compaction`);
            return response.data;
        } catch (error) {
            console.error('Error fetching compaction stats:', error);
            throw error;
        }
    }

    async getThreadPoolStats() {
        try {
            const response = await api.get(`${this.baseUrl}/threadpools`);
            return response.data;
        } catch (error) {
            console.error('Error fetching thread pool stats:', error);
            throw error;
        }
    }

    async getGCStats() {
        try {
            const response = await api.get(`${this.baseUrl}/gc`);
            return response.data;
        } catch (error) {
            console.error('Error fetching GC stats:', error);
            throw error;
        }
    }

    async getProxyHistograms() {
        try {
            const response = await api.get(`${this.baseUrl}/histograms`);
            return response.data;
        } catch (error) {
            console.error('Error fetching proxy histograms:', error);
            throw error;
        }
    }

    async getCachedMetrics() {
        try {
            const response = await api.get(`${this.baseUrl}/cache`);
            return response.data;
        } catch (error) {
            console.error('Error fetching cached nodetool metrics:', error);
            throw error;
        }
    }
}

export default new NodetoolApiService(); 