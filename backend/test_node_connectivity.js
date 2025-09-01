const cassandra = require('cassandra-driver');
const net = require('net');

async function testNodeConnectivity(host, port = 9042, timeout = 5000) {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host, port }, () => {
            socket.end();
            resolve(true);
        });
        
        socket.setTimeout(timeout);
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        
        socket.on('error', () => {
            resolve(false);
        });
    });
}

async function checkClusterNodes() {
    const client = new cassandra.Client({
        contactPoints: ['127.0.0.1:9042'],
        localDataCenter: 'datacenter1',
        socketOptions: {
            connectTimeout: 30000,
            readTimeout: 30000
        }
    });

    try {
        console.log('Connecting to Cassandra...');
        await client.connect();
        console.log('Connected successfully\n');

        // Get all nodes from system tables
        const localResult = await client.execute('SELECT cluster_name, data_center, release_version, broadcast_address, listen_address FROM system.local');
        const peersResult = await client.execute('SELECT peer, data_center, release_version, host_id FROM system.peers');
        
        const local = localResult.rows[0];
        console.log('Local node (connected through tunnel):', {
            cluster: local.cluster_name,
            datacenter: local.data_center,
            version: local.release_version,
            broadcast_address: local.broadcast_address?.toString(),
            listen_address: local.listen_address?.toString()
        });
        
        console.log(`\nFound ${peersResult.rows.length} peers in system.peers:`);
        
        // Test connectivity to each peer
        const connectivityResults = [];
        for (const peer of peersResult.rows) {
            const address = peer.peer?.toString();
            console.log(`\nTesting ${address}...`);
            
            if (address) {
                const isReachable = await testNodeConnectivity(address, 9042, 3000);
                connectivityResults.push({
                    address,
                    datacenter: peer.data_center,
                    version: peer.release_version,
                    hostId: peer.host_id?.toString(),
                    isReachable
                });
                
                console.log(`  ${address}: ${isReachable ? '✅ REACHABLE' : '❌ UNREACHABLE'}`);
                console.log(`  Datacenter: ${peer.data_center}`);
                console.log(`  Version: ${peer.release_version}`);
            }
        }
        
        console.log('\n=== SUMMARY ===');
        const reachableNodes = connectivityResults.filter(node => node.isReachable);
        const unreachableNodes = connectivityResults.filter(node => !node.isReachable);
        
        console.log(`Total nodes in peers table: ${connectivityResults.length}`);
        console.log(`Reachable nodes: ${reachableNodes.length}`);
        console.log(`Unreachable nodes: ${unreachableNodes.length}`);
        
        if (reachableNodes.length > 0) {
            console.log('\nReachable nodes:');
            reachableNodes.forEach(node => {
                console.log(`  ✅ ${node.address} (${node.datacenter})`);
            });
        }
        
        if (unreachableNodes.length > 0) {
            console.log('\nUnreachable nodes (stale entries):');
            unreachableNodes.forEach(node => {
                console.log(`  ❌ ${node.address} (${node.datacenter}) - likely stale peer entry`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.shutdown();
        console.log('\nDisconnected');
    }
}

checkClusterNodes().catch(console.error);
