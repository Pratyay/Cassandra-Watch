#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testConnection() {
    try {
        console.log('🔗 Testing Cassandra connection...');
        
        const connectResponse = await axios.post(`${BASE_URL}/api/connections/connect`, {
            hosts: ['127.0.0.1'],
            port: 9042,
            datacenter: 'datacenter1'
        }, { timeout: 15000 });
        
        console.log('✅ Connection result:', connectResponse.data);
        
        // Test connection info
        const infoResponse = await axios.get(`${BASE_URL}/api/connections/info`);
        console.log('📋 Connection info:', infoResponse.data);
        
        // Test keyspaces
        console.log('🗂️  Testing keyspaces endpoint...');
        const keyspacesResponse = await axios.get(`${BASE_URL}/api/metrics/keyspaces`);
        console.log(`📊 Found ${keyspacesResponse.data.length} keyspaces`);
        
        // Find a user keyspace (non-system)
        const userKeyspace = keyspacesResponse.data.find(ks => !ks.isSystemKeyspace);
        if (userKeyspace) {
            console.log(`🔍 Testing tables for keyspace: ${userKeyspace.name}`);
            const tablesResponse = await axios.get(`${BASE_URL}/api/metrics/keyspaces/${userKeyspace.name}/tables`);
            console.log(`📋 Found ${tablesResponse.data.length} tables:`, tablesResponse.data.map(t => t.name));
        } else {
            console.log('⚠️  No user keyspaces found, testing with system keyspace');
            const systemKeyspace = keyspacesResponse.data.find(ks => ks.name === 'system');
            if (systemKeyspace) {
                const tablesResponse = await axios.get(`${BASE_URL}/api/metrics/keyspaces/system/tables`);
                console.log(`📋 System tables (${tablesResponse.data.length}):`, tablesResponse.data.slice(0, 3).map(t => t.name));
            }
        }
        
        // Test operations endpoint
        console.log('⚙️  Testing operations endpoint...');
        const operationsResponse = await axios.get(`${BASE_URL}/api/operations/active`);
        console.log(`🔄 Found ${operationsResponse.data.length} operations`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testConnection();
