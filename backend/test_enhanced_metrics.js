const db = require('./src/config/database');
const metricsService = require('./src/services/metricsService');
const operationsService = require('./src/services/operationsService');

async function testEnhancedMetrics() {
    try {
        console.log('Connecting to Cassandra...');
        await db.connect();
        console.log('Connected successfully\n');

        // Test cluster info
        console.log('--- Cluster Info ---');
        const cluster = await metricsService.getClusterInfo();
        console.log(`Name: ${cluster.name}`);
        console.log(`Total nodes: ${cluster.totalNodes}`);
        console.log(`Up nodes: ${cluster.upNodes}`);
        console.log(`Datacenters: ${cluster.datacenters.join(', ')}`);
        console.log(`Version: ${cluster.cassandraVersion}`);

        // Test nodes
        console.log('\n--- Nodes Info ---');
        const nodes = await metricsService.getNodesInfo();
        console.log(`Total nodes discovered: ${nodes.length}`);
        nodes.forEach((node, idx) => {
            console.log(`  Node ${idx + 1}: ${node.address} (${node.datacenter}, rack: ${node.rack})`);
        });

        // Test performance metrics
        console.log('\n--- Performance Metrics ---');
        const performance = await metricsService.getPerformanceMetrics();
        console.log(`Read latency mean: ${performance.readLatency.mean.toFixed(2)}ms`);
        console.log(`Write latency mean: ${performance.writeLatency.mean.toFixed(2)}ms`);
        console.log(`Throughput: ${performance.throughput.reads} reads/s, ${performance.throughput.writes} writes/s`);
        console.log(`Key cache hit rate: ${(performance.cacheHitRates.keyCache * 100).toFixed(1)}%`);
        if (performance.compactionActivity) {
            console.log(`Compactions (24h): ${performance.compactionActivity.last24h}`);
            console.log(`Bytes processed: ${(performance.compactionActivity.bytesProcessed / 1024 / 1024).toFixed(2)} MB`);
        }

        // Test storage metrics
        console.log('\n--- Storage Metrics ---');
        const storage = await metricsService.getStorageMetrics();
        console.log(`Total size: ${(storage.totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Keyspaces with data:`);
        storage.keyspacesSizes.forEach(ks => {
            console.log(`  ${ks.keyspace}: ${(ks.size / 1024 / 1024).toFixed(2)} MB`);
        });

        // Test operations
        console.log('\n--- Operations ---');
        const operations = await operationsService.getActiveOperations();
        console.log(`Total operations (manual + system): ${operations.length}`);
        const manualOps = operations.filter(op => !op.isSystemOperation);
        const systemOps = operations.filter(op => op.isSystemOperation);
        console.log(`Manual operations: ${manualOps.length}`);
        console.log(`System operations: ${systemOps.length}`);
        
        if (systemOps.length > 0) {
            console.log('Recent compactions:');
            systemOps.slice(0, 3).forEach((op, idx) => {
                console.log(`  ${idx + 1}. ${op.keyspace}.${op.table} - ${op.result.compressionRatio} ratio`);
                console.log(`     ${(op.result.bytesIn / 1024 / 1024).toFixed(2)} MB -> ${(op.result.bytesOut / 1024 / 1024).toFixed(2)} MB`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.disconnect();
        console.log('\nDisconnected');
    }
}

testEnhancedMetrics().catch(console.error);
