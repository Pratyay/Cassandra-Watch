const cassandra = require('cassandra-driver');

async function debugCluster() {
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
        console.log('Connected successfully');

        // Test multiple times to see consistency
        for (let i = 1; i <= 5; i++) {
            console.log(`\n--- Test ${i} ---`);
            
            const localResult = await client.execute('SELECT cluster_name, data_center, release_version, broadcast_address, listen_address FROM system.local');
            const peersResult = await client.execute('SELECT peer, data_center, release_version, host_id FROM system.peers');
            
            console.log('Local node:', {
                cluster: localResult.rows[0].cluster_name,
                datacenter: localResult.rows[0].data_center,
                version: localResult.rows[0].release_version,
                broadcast_address: localResult.rows[0].broadcast_address?.toString(),
                listen_address: localResult.rows[0].listen_address?.toString()
            });
            
            console.log(`Peers count: ${peersResult.rows.length}`);
            peersResult.rows.forEach((peer, idx) => {
                console.log(`  Peer ${idx + 1}:`, {
                    address: peer.peer?.toString(),
                    datacenter: peer.data_center,
                    version: peer.release_version,
                    hostId: peer.host_id?.toString()
                });
            });
            
            // Wait 2 seconds between tests
            if (i < 5) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Test storage metrics with correct query
        console.log('\n--- Storage Test ---');
        try {
            const sizeResult = await client.execute(`
                SELECT keyspace_name, 
                       SUM(mean_partition_size * partitions_count) as total_size 
                FROM system.size_estimates 
                GROUP BY keyspace_name
            `);
            
            console.log('Storage metrics by keyspace:');
            let grandTotal = 0;
            sizeResult.rows.forEach(row => {
                const size = row.total_size;
                let sizeValue = 0;
                if (size && typeof size.toNumber === 'function') {
                    sizeValue = size.toNumber();
                } else if (typeof size === 'number') {
                    sizeValue = size;
                }
                console.log(`  ${row.keyspace_name}: ${sizeValue} bytes`);
                grandTotal += sizeValue;
            });
            console.log(`Total cluster size: ${grandTotal} bytes (${(grandTotal / 1024 / 1024).toFixed(2)} MB)`);
        } catch (sizeError) {
            console.log('Size estimates error:', sizeError.message);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.shutdown();
        console.log('Disconnected');
    }
}

debugCluster().catch(console.error);
