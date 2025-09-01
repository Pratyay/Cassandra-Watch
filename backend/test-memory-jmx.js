const java = require('java');

// Initialize Java classes
console.log('Initializing Java JMX classes...');
const JMXConnectorFactory = java.import('javax.management.remote.JMXConnectorFactory');
const JMXServiceURL = java.import('javax.management.remote.JMXServiceURL');
const ObjectName = java.import('javax.management.ObjectName');
const HashMap = java.import('java.util.HashMap');

async function testMemoryMetrics() {
    try {
        // Connect to JMX
        console.log('Connecting to JMX...');
        const serviceURL = new JMXServiceURL('service:jmx:rmi:///jndi/rmi://localhost:7199/jmxrmi');
        const env = new HashMap();
        env.put('jmx.remote.x.request.waiting.timeout', 10000);
        
        const jmxConnector = JMXConnectorFactory.connectSync(serviceURL, env);
        const mbeanConnection = jmxConnector.getMBeanServerConnectionSync();
        
        console.log('JMX connection successful!\n');
        
        // Test memory metrics specifically
        const memoryObjectName = new ObjectName('java.lang:type=Memory');
        
        console.log('Querying heap memory usage...');
        const heapMemoryUsage = mbeanConnection.getAttributeSync(memoryObjectName, 'HeapMemoryUsage');
        
        console.log('Raw heap memory object:', heapMemoryUsage);
        console.log('Type of heap memory object:', typeof heapMemoryUsage);
        console.log('Object properties:', Object.getOwnPropertyNames(heapMemoryUsage));
        
        // Try different ways to access the values
        console.log('\nTrying different access methods:');
        try {
            if (heapMemoryUsage.get) {
                console.log('Using .get() method:');
                console.log('  used:', heapMemoryUsage.get('used'));
                console.log('  max:', heapMemoryUsage.get('max'));
                console.log('  committed:', heapMemoryUsage.get('committed'));
            }
        } catch (e) {
            console.log('get() method failed:', e.message);
        }
        
        try {
            console.log('Direct property access:');
            console.log('  used:', heapMemoryUsage.used);
            console.log('  max:', heapMemoryUsage.max);
            console.log('  committed:', heapMemoryUsage.committed);
        } catch (e) {
            console.log('Direct property access failed:', e.message);
        }
        
        try {
            console.log('Bracket notation access:');
            console.log('  used:', heapMemoryUsage['used']);
            console.log('  max:', heapMemoryUsage['max']);
            console.log('  committed:', heapMemoryUsage['committed']);
        } catch (e) {
            console.log('Bracket notation failed:', e.message);
        }
        
        // Try to convert to string and parse
        try {
            console.log('String conversion:', heapMemoryUsage.toString());
        } catch (e) {
            console.log('toString() failed:', e.message);
        }
        
        // Try to access Java methods
        try {
            console.log('Java getValue method:');
            console.log('  used:', heapMemoryUsage.getValue('used'));
            console.log('  max:', heapMemoryUsage.getValue('max'));
        } catch (e) {
            console.log('getValue() method failed:', e.message);
        }
        
        console.log('\n=== Testing Storage Load ===');
        try {
            const storageObjectName = new ObjectName('org.apache.cassandra.metrics:type=Storage,name=Load');
            const storageLoad = mbeanConnection.getAttributeSync(storageObjectName, 'Count');
            console.log('Storage load:', storageLoad, 'Type:', typeof storageLoad);
        } catch (e) {
            console.log('Storage load query failed:', e.message);
        }
        
        console.log('\n=== Testing Thread Pool Metrics ===');
        try {
            const threadPoolObjectName = new ObjectName('org.apache.cassandra.metrics:type=ThreadPools,path=request,scope=MutationStage,name=ActiveTasks');
            const activeTasks = mbeanConnection.getAttributeSync(threadPoolObjectName, 'Value');
            console.log('MutationStage ActiveTasks:', activeTasks, 'Type:', typeof activeTasks);
        } catch (e) {
            console.log('Thread pool query failed:', e.message);
        }
        
        jmxConnector.close();
        console.log('\nConnection closed.');
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testMemoryMetrics();
