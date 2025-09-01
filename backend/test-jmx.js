const java = require('java');

console.log('Testing JMX connection to localhost:7199...');

try {
    // Initialize Java classes
    java.classpath.push('.');
    
    const JMXConnectorFactory = java.import('javax.management.remote.JMXConnectorFactory');
    const JMXServiceURL = java.import('javax.management.remote.JMXServiceURL');
    const ObjectName = java.import('javax.management.ObjectName');
    
    // Set system properties for SSH tunnel compatibility
    java.callStaticMethod('java.lang.System', 'setProperty', 'java.rmi.server.hostname', 'localhost');
    java.callStaticMethod('java.lang.System', 'setProperty', 'com.sun.management.jmxremote.local.only', 'false');
    
    // Try different JMX URLs
    const jmxUrls = [
        'service:jmx:rmi:///jndi/rmi://localhost:7199/jmxrmi',
        'service:jmx:rmi://localhost:7199/jndi/rmi://localhost:7199/jmxrmi',
        'service:jmx:rmi://localhost/jndi/rmi://localhost:7199/jmxrmi'
    ];
    
    for (const jmxUrl of jmxUrls) {
        try {
            console.log(`Trying URL: ${jmxUrl}`);
            
            const serviceURL = new JMXServiceURL(jmxUrl);
            const HashMap = java.import('java.util.HashMap');
            const env = new HashMap();
            env.put('jmx.remote.x.request.waiting.timeout', 10000);
            
            const jmxConnector = JMXConnectorFactory.connectSync(serviceURL, env);
            const mbeanConnection = jmxConnector.getMBeanServerConnectionSync();
            
            // Test by querying runtime MBean
            const runtimeObjectName = new ObjectName('java.lang:type=Runtime');
            const uptime = mbeanConnection.getAttributeSync(runtimeObjectName, 'Uptime');
            
            console.log(`SUCCESS! Connected with URL: ${jmxUrl}`);
            console.log(`JVM Uptime: ${uptime} ms`);
            
            // Test Cassandra-specific MBean
            try {
                const storageObjectName = new ObjectName('org.apache.cassandra.metrics:type=Storage,name=Load');
                const load = mbeanConnection.getAttribute(storageObjectName, 'Count');
                console.log(`Cassandra Storage Load: ${load} bytes`);
            } catch (e) {
                console.log(`Cassandra MBean not available: ${e.message}`);
            }
            
            jmxConnector.close();
            process.exit(0);
        } catch (error) {
            console.log(`Failed with URL ${jmxUrl}: ${error.message}`);
        }
    }
    
    console.log('All JMX connection attempts failed');
    process.exit(1);
    
} catch (error) {
    console.error('Error testing JMX:', error.message);
    process.exit(1);
}
