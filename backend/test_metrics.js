const db = require('./src/config/database');
const metricsService = require('./src/services/metricsService');

async function testMetrics() {
    try {
        console.log('Connecting to Cassandra...');
        await db.connect();
        console.log('Connected successfully\n');

        // Test multiple times to check consistency
        for (let i = 1; i <= 3; i++) {
            console.log(`--- Test ${i} ---`);
            
            const cluster = await metricsService.getClusterInfo();
            console.log('Cluster info:');
            console.log(`  Name: ${cluster.name}`);
            console.log(`  Total nodes: ${cluster.totalNodes}`);
            console.log(`  Up nodes: ${cluster.upNodes}`);
            console.log(`  Datacenters: ${cluster.datacenters.join(', ')}`);
            if (cluster.debug) {
                console.log(`  Debug - Unique addresses: ${cluster.debug.uniqueNodeAddresses.join(', ')}`);
            }
            
            const nodes = await metricsService.getNodesInfo();
            console.log(`Nodes count: ${nodes.length}`);
            nodes.forEach((node, idx) => {
                console.log(`  Node ${idx + 1}: ${node.address} (${node.datacenter})`);
            });
            
            const storage = await metricsService.getStorageMetrics();
            console.log('Storage:');
            console.log(`  Total size: ${storage.totalSize} bytes`);
            console.log(`  Keyspaces: ${storage.keyspacesSizes ? storage.keyspacesSizes.length : 'N/A'}`);
            
            if (i < 3) {
                console.log('\\nWaiting 3 seconds...\\n');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.disconnect();
        console.log('\\nDisconnected');
    }
}

testMetrics().catch(console.error);
