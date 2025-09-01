const java = require('java');

// Initialize Java JMX classes
try {
    java.classpath.push('.');
    
    const MBeanServerConnection = java.import('javax.management.MBeanServerConnection');
    const JMXConnector = java.import('javax.management.remote.JMXConnector');
    const JMXConnectorFactory = java.import('javax.management.remote.JMXConnectorFactory');
    const JMXServiceURL = java.import('javax.management.remote.JMXServiceURL');
    const ObjectName = java.import('javax.management.ObjectName');
    
    console.log('Java JMX classes initialized successfully');
    
    async function analyzeAllMBeans() {
        try {
            console.log('Connecting to Cassandra JMX...');
            const jmxUrl = 'service:jmx:rmi:///jndi/rmi://localhost:7199/jmxrmi';
            const serviceURL = new JMXServiceURL(jmxUrl);
            
            const HashMap = java.import('java.util.HashMap');
            const env = new HashMap();
            env.put('jmx.remote.x.request.waiting.timeout', 10000);
            
            java.callStaticMethod('java.lang.System', 'setProperty', 'java.rmi.server.hostname', 'localhost');
            
            const jmxConnector = JMXConnectorFactory.connectSync(serviceURL, env);
            const mbeanConnection = jmxConnector.getMBeanServerConnectionSync();
            
            console.log('Connected successfully! Discovering all MBeans...');
            
            const allMBeans = mbeanConnection.queryNamesSync(null, null);
            const mbeanArray = allMBeans.toArraySync();
            
            console.log(`Found ${mbeanArray.length} total MBeans`);
            
            // Categorize MBeans for developer usefulness
            const categories = {
                // High Priority - Critical for developers
                performance: {
                    description: "Critical performance metrics developers need to monitor",
                    mbeans: []
                },
                errors: {
                    description: "Error tracking and debugging metrics",
                    mbeans: []
                },
                latency: {
                    description: "Request latency and timing metrics",
                    mbeans: []
                },
                throughput: {
                    description: "Request rates and throughput metrics", 
                    mbeans: []
                },
                resources: {
                    description: "Memory, CPU, and resource utilization",
                    mbeans: []
                },
                
                // Medium Priority - Useful for optimization
                cache: {
                    description: "Cache hit rates and efficiency metrics",
                    mbeans: []
                },
                compaction: {
                    description: "Background compaction and maintenance",
                    mbeans: []
                },
                threadPools: {
                    description: "Thread pool utilization and queue depths",
                    mbeans: []
                },
                
                // Context-specific - Useful for specific debugging
                keyspaces: {
                    description: "Per-keyspace metrics for isolation",
                    mbeans: []
                },
                tables: {
                    description: "Per-table metrics for hotspot identification",
                    mbeans: []
                },
                
                // System level
                jvm: {
                    description: "JVM-level metrics",
                    mbeans: []
                },
                
                // Less critical for developers
                internal: {
                    description: "Internal Cassandra mechanics",
                    mbeans: []
                }
            };
            
            // Categorize each MBean
            for (let i = 0; i < mbeanArray.length; i++) {
                const mbeanName = mbeanArray[i].toString();
                
                // Performance-critical metrics (High Priority)
                if (mbeanName.includes('org.apache.cassandra.metrics:type=ClientRequest')) {
                    if (mbeanName.includes('name=Latency') || mbeanName.includes('name=TotalLatency')) {
                        categories.latency.mbeans.push(mbeanName);
                    } else if (mbeanName.includes('name=Timeouts') || mbeanName.includes('name=Failures') || 
                              mbeanName.includes('name=Unavailables') || mbeanName.includes('name=Errors')) {
                        categories.errors.mbeans.push(mbeanName);
                    } else if (mbeanName.includes('name=Rate') || mbeanName.includes('name=Count')) {
                        categories.throughput.mbeans.push(mbeanName);
                    } else {
                        categories.performance.mbeans.push(mbeanName);
                    }
                }
                
                // Resource utilization
                else if (mbeanName.includes('java.lang:type=Memory') || 
                        mbeanName.includes('java.lang:type=MemoryPool') ||
                        mbeanName.includes('org.apache.cassandra.metrics:type=Storage')) {
                    categories.resources.mbeans.push(mbeanName);
                }
                
                // Cache metrics
                else if (mbeanName.includes('org.apache.cassandra.metrics:type=Cache')) {
                    categories.cache.mbeans.push(mbeanName);
                }
                
                // Compaction metrics
                else if (mbeanName.includes('org.apache.cassandra.metrics:type=Compaction')) {
                    categories.compaction.mbeans.push(mbeanName);
                }
                
                // Thread pool metrics
                else if (mbeanName.includes('org.apache.cassandra.metrics:type=ThreadPools')) {
                    categories.threadPools.mbeans.push(mbeanName);
                }
                
                // Per-keyspace metrics
                else if (mbeanName.includes('org.apache.cassandra.metrics:type=Keyspace')) {
                    categories.keyspaces.mbeans.push(mbeanName);
                }
                
                // Per-table metrics
                else if (mbeanName.includes('org.apache.cassandra.metrics:type=Table') || 
                        mbeanName.includes('org.apache.cassandra.metrics:type=ColumnFamily')) {
                    categories.tables.mbeans.push(mbeanName);
                }
                
                // JVM metrics
                else if (mbeanName.includes('java.lang:')) {
                    categories.jvm.mbeans.push(mbeanName);
                }
                
                // Everything else is internal
                else if (mbeanName.includes('org.apache.cassandra')) {
                    categories.internal.mbeans.push(mbeanName);
                }
            }
            
            // Display analysis results
            console.log('\n=== DEVELOPER-FOCUSED MBEAN ANALYSIS ===\n');
            
            Object.entries(categories).forEach(([category, data]) => {
                console.log(`📊 ${category.toUpperCase()} (${data.mbeans.length} MBeans)`);
                console.log(`   ${data.description}`);
                
                if (data.mbeans.length > 0) {
                    console.log('   Top MBeans:');
                    data.mbeans.slice(0, 5).forEach(mbean => {
                        console.log(`     • ${mbean}`);
                    });
                    if (data.mbeans.length > 5) {
                        console.log(`     ... and ${data.mbeans.length - 5} more`);
                    }
                }
                console.log('');
            });
            
            // Sample high-priority MBeans for developers
            console.log('\n=== SAMPLING HIGH-PRIORITY MBEANS FOR DEVELOPERS ===\n');
            
            // Sample performance metrics
            console.log('🚀 PERFORMANCE METRICS:');
            await sampleMBeanCategory(mbeanConnection, categories.performance.mbeans, 'Performance');
            await sampleMBeanCategory(mbeanConnection, categories.latency.mbeans, 'Latency');
            await sampleMBeanCategory(mbeanConnection, categories.throughput.mbeans, 'Throughput');
            
            // Sample error metrics
            console.log('\n❌ ERROR & DEBUGGING METRICS:');
            await sampleMBeanCategory(mbeanConnection, categories.errors.mbeans, 'Errors');
            
            // Sample resource metrics
            console.log('\n💾 RESOURCE UTILIZATION:');
            await sampleMBeanCategory(mbeanConnection, categories.resources.mbeans, 'Resources');
            
            // Sample cache metrics
            console.log('\n🗄️ CACHE EFFICIENCY:');
            await sampleMBeanCategory(mbeanConnection, categories.cache.mbeans, 'Cache');
            
            jmxConnector.close();
            
        } catch (error) {
            console.error('Error during MBean analysis:', error);
        }
    }
    
    async function sampleMBeanCategory(mbeanConnection, mbeans, categoryName) {
        if (mbeans.length === 0) {
            console.log(`  No ${categoryName} MBeans found`);
            return;
        }
        
        // Sample first 3 MBeans from this category
        for (const mbeanName of mbeans.slice(0, 3)) {
            try {
                console.log(`\n  📋 ${mbeanName}`);
                const objectName = new ObjectName(mbeanName);
                const mbeanInfo = mbeanConnection.getMBeanInfoSync(objectName);
                const attributes = mbeanInfo.getAttributesSync();
                
                // Sample first few attributes to understand the data structure
                for (let i = 0; i < Math.min(3, attributes.lengthSync); i++) {
                    try {
                        const attr = attributes[i];
                        const attrName = attr.getNameSync();
                        const attrType = attr.getTypeSync();
                        
                        try {
                            const value = mbeanConnection.getAttributeSync(objectName, attrName);
                            let displayValue = value;
                            
                            // Handle Java objects
                            if (value && typeof value === 'object') {
                                if (value.longValue !== undefined) {
                                    displayValue = `${value.longValue} (Long)`;
                                } else if (value.doubleValue !== undefined) {
                                    displayValue = `${value.doubleValue} (Double)`;
                                } else if (value.intValue !== undefined) {
                                    displayValue = `${value.intValue} (Int)`;
                                } else if (value.getSync) {
                                    displayValue = '[CompositeData object]';
                                } else {
                                    displayValue = value.toString ? value.toString() : '[Object]';
                                }
                            }
                            
                            console.log(`     ${attrName}: ${displayValue} (${attrType})`);
                        } catch (attrError) {
                            console.log(`     ${attrName}: [Error: ${attrError.message}] (${attrType})`);
                        }
                    } catch (e) {
                        console.log(`     [Error accessing attribute ${i}]`);
                    }
                }
                
            } catch (error) {
                console.log(`  ❌ Error sampling ${mbeanName}: ${error.message}`);
            }
        }
    }
    
    // Run the analysis
    analyzeAllMBeans().then(() => {
        console.log('\n=== ANALYSIS COMPLETE ===');
        process.exit(0);
    }).catch(error => {
        console.error('Analysis failed:', error);
        process.exit(1);
    });
    
} catch (error) {
    console.error('Failed to initialize Java classes:', error);
    process.exit(1);
}
