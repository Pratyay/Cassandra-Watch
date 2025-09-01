const jmxService = require('./src/services/jmxService');

async function testJMXFunctionality() {
    console.log('🧪 Testing JMX Service Functionality...\n');

    // Test 1: Test JMX connection to localhost
    console.log('1. Testing JMX connection to localhost:7199...');
    const connectionTest = await jmxService.testJMXConnection('127.0.0.1', 7199);
    console.log('Connection test result:', connectionTest);
    console.log('');

    // Test 2: List available MBeans
    console.log('2. Listing available MBeans...');
    const mbeans = await jmxService.listMBeans('127.0.0.1', 7199);
    console.log('MBeans result:', JSON.stringify(mbeans, null, 2));
    console.log('');

    // Test 3: Get JMX metrics for a single node
    console.log('3. Getting JMX metrics for single node...');
    const nodeMetrics = await jmxService.getJMXMetrics('127.0.0.1', 7199);
    if (nodeMetrics.metrics) {
        console.log('Node metrics sample:');
        console.log('- Storage Load:', nodeMetrics.metrics.storage.load, 'bytes');
        console.log('- Heap Memory Used:', nodeMetrics.metrics.memory.heapMemoryUsage.used, 'bytes');
        console.log('- Active Read Threads:', nodeMetrics.metrics.threadPools.readStage.activeTasks);
        console.log('- Key Cache Hit Rate:', (nodeMetrics.metrics.cache.keyCache.hitRate * 100).toFixed(2) + '%');
    } else {
        console.log('Error getting node metrics:', nodeMetrics.error);
    }
    console.log('');

    // Test 4: Get cluster-wide aggregated metrics
    console.log('4. Getting aggregated cluster metrics...');
    const clusterMetrics = await jmxService.getAggregatedMetrics(['127.0.0.1']);
    if (clusterMetrics.success) {
        console.log('Cluster aggregated metrics:');
        console.log('- Total Heap Used:', clusterMetrics.aggregated.memory.totalHeapUsed, 'bytes');
        console.log('- Total Active Threads:', clusterMetrics.aggregated.threadPools.totalActiveThreads);
        console.log('- Average Read Latency:', clusterMetrics.aggregated.performance.avgReadLatency.toFixed(2), 'ms');
        console.log('- Key Cache Hit Rate:', (clusterMetrics.aggregated.cache.keyCache.hitRate * 100).toFixed(2) + '%');
    } else {
        console.log('Error getting cluster metrics:', clusterMetrics.error);
    }
    console.log('');

    // Test 5: Test multiple nodes (simulated)
    console.log('5. Testing multiple nodes...');
    const multiNodeMetrics = await jmxService.getClusterJMXMetrics(['127.0.0.1', '192.168.1.100', '192.168.1.101']);
    console.log('Multi-node result:');
    console.log('- Total nodes:', multiNodeMetrics.totalNodes);
    console.log('- Successful connections:', multiNodeMetrics.successfulNodes);
    console.log('- Errors:', multiNodeMetrics.errors.length);
    console.log('');

    console.log('✅ JMX Service Testing Complete!');
}

// Run the test
testJMXFunctionality().catch(console.error);
