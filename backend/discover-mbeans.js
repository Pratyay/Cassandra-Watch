const java = require('java');

// Initialize Java classes
console.log('Initializing Java JMX classes...');
const JMXConnectorFactory = java.import('javax.management.remote.JMXConnectorFactory');
const JMXServiceURL = java.import('javax.management.remote.JMXServiceURL');
const ObjectName = java.import('javax.management.ObjectName');
const HashMap = java.import('java.util.HashMap');

async function discoverAllMBeans() {
    try {
        // Connect to JMX
        console.log('Connecting to JMX...');
        const serviceURL = new JMXServiceURL('service:jmx:rmi:///jndi/rmi://localhost:7199/jmxrmi');
        const env = new HashMap();
        env.put('jmx.remote.x.request.waiting.timeout', 10000);
        
        const jmxConnector = JMXConnectorFactory.connectSync(serviceURL, env);
        const mbeanConnection = jmxConnector.getMBeanServerConnectionSync();
        
        console.log('JMX connection successful!\n');
        
        // Get all MBeans
        console.log('=== Discovering all MBeans ===');
        const allMBeans = mbeanConnection.queryNamesSync(null, null);
        
        console.log(`Found ${allMBeans.sizeSync()} total MBeans\n`);
        
        // Categorize MBeans
        const categories = {
            cassandra: [],
            java: [],
            jvm: [],
            other: []
        };
        
        const mbeanArray = allMBeans.toArraySync();
        
        for (let i = 0; i < mbeanArray.length; i++) {
            const mbeanName = mbeanArray[i].toString();
            
            if (mbeanName.startsWith('org.apache.cassandra')) {
                categories.cassandra.push(mbeanName);
            } else if (mbeanName.startsWith('java.lang')) {
                categories.java.push(mbeanName);
            } else if (mbeanName.includes('java.') || mbeanName.includes('jvm')) {
                categories.jvm.push(mbeanName);
            } else {
                categories.other.push(mbeanName);
            }
        }
        
        console.log('=== CASSANDRA MBEANS ===');
        categories.cassandra.forEach(name => console.log(name));
        
        console.log('\n=== JAVA LANG MBEANS ===');
        categories.java.forEach(name => console.log(name));
        
        console.log('\n=== JVM MBEANS ===');
        categories.jvm.forEach(name => console.log(name));
        
        console.log('\n=== OTHER MBEANS ===');
        categories.other.forEach(name => console.log(name));
        
        // Sample a few Cassandra MBeans to see their attributes
        console.log('\n=== SAMPLING CASSANDRA MBEAN ATTRIBUTES ===');
        const cassandraStorage = categories.cassandra.filter(name => name.includes('Storage'));
        const cassandraThreadPools = categories.cassandra.filter(name => name.includes('ThreadPools'));
        const cassandraCache = categories.cassandra.filter(name => name.includes('Cache'));
        const cassandraClientRequest = categories.cassandra.filter(name => name.includes('ClientRequest'));
        
        // Sample Storage MBeans
        if (cassandraStorage.length > 0) {
            console.log('\n--- Storage MBeans ---');
            for (let i = 0; i < Math.min(3, cassandraStorage.length); i++) {
                const mbeanName = cassandraStorage[i];
                console.log(`\nMBean: ${mbeanName}`);
                try {
                    const objectName = new ObjectName(mbeanName);
                    const mbeanInfo = mbeanConnection.getMBeanInfoSync(objectName);
                    const attributes = mbeanInfo.getAttributes();
                    
                    console.log('  Attributes:');
                    for (let j = 0; j < attributes.length; j++) {
                        const attr = attributes[j];
                        console.log(`    ${attr.getName()} (${attr.getType()})`);
                    }
                } catch (e) {
                    console.log(`  Error getting info: ${e.message}`);
                }
            }
        }
        
        // Sample ThreadPool MBeans
        if (cassandraThreadPools.length > 0) {
            console.log('\n--- ThreadPool MBeans ---');
            for (let i = 0; i < Math.min(3, cassandraThreadPools.length); i++) {
                const mbeanName = cassandraThreadPools[i];
                console.log(`\nMBean: ${mbeanName}`);
                try {
                    const objectName = new ObjectName(mbeanName);
                    const mbeanInfo = mbeanConnection.getMBeanInfoSync(objectName);
                    const attributes = mbeanInfo.getAttributes();
                    
                    console.log('  Attributes:');
                    for (let j = 0; j < attributes.length; j++) {
                        const attr = attributes[j];
                        console.log(`    ${attr.getName()} (${attr.getType()})`);
                    }
                } catch (e) {
                    console.log(`  Error getting info: ${e.message}`);
                }
            }
        }
        
        // Sample ClientRequest MBeans
        if (cassandraClientRequest.length > 0) {
            console.log('\n--- ClientRequest MBeans ---');
            for (let i = 0; i < Math.min(3, cassandraClientRequest.length); i++) {
                const mbeanName = cassandraClientRequest[i];
                console.log(`\nMBean: ${mbeanName}`);
                try {
                    const objectName = new ObjectName(mbeanName);
                    const mbeanInfo = mbeanConnection.getMBeanInfoSync(objectName);
                    const attributes = mbeanInfo.getAttributes();
                    
                    console.log('  Attributes:');
                    for (let j = 0; j < attributes.length; j++) {
                        const attr = attributes[j];
                        console.log(`    ${attr.getName()} (${attr.getType()})`);
                    }
                } catch (e) {
                    console.log(`  Error getting info: ${e.message}`);
                }
            }
        }
        
        // Sample Cache MBeans
        if (cassandraCache.length > 0) {
            console.log('\n--- Cache MBeans ---');
            for (let i = 0; i < Math.min(3, cassandraCache.length); i++) {
                const mbeanName = cassandraCache[i];
                console.log(`\nMBean: ${mbeanName}`);
                try {
                    const objectName = new ObjectName(mbeanName);
                    const mbeanInfo = mbeanConnection.getMBeanInfoSync(objectName);
                    const attributes = mbeanInfo.getAttributes();
                    
                    console.log('  Attributes:');
                    for (let j = 0; j < attributes.length; j++) {
                        const attr = attributes[j];
                        console.log(`    ${attr.getName()} (${attr.getType()})`);
                    }
                } catch (e) {
                    console.log(`  Error getting info: ${e.message}`);
                }
            }
        }
        
        jmxConnector.close();
        console.log('\nConnection closed.');
        
        // Return the categorized results
        return {
            total: mbeanArray.length,
            categories: {
                cassandra: categories.cassandra.length,
                java: categories.java.length,
                jvm: categories.jvm.length,
                other: categories.other.length
            },
            mbeans: categories
        };
        
    } catch (error) {
        console.error('Discovery failed:', error.message);
        return null;
    }
}

discoverAllMBeans().then(result => {
    if (result) {
        console.log('\n=== SUMMARY ===');
        console.log(`Total MBeans: ${result.total}`);
        console.log(`Cassandra MBeans: ${result.categories.cassandra}`);
        console.log(`Java MBeans: ${result.categories.java}`);
        console.log(`JVM MBeans: ${result.categories.jvm}`);
        console.log(`Other MBeans: ${result.categories.other}`);
    }
});
