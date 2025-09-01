const cassandra = require('cassandra-driver');

async function exploreSystemTables() {
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

        // Check what system tables are available
        const tablesResult = await client.execute("SELECT keyspace_name, table_name FROM system_schema.tables WHERE keyspace_name = 'system' ORDER BY table_name");
        console.log('Available system tables:');
        tablesResult.rows.forEach(row => {
            console.log(`  ${row.table_name}`);
        });

        // Check system.local for any performance-related columns
        console.log('\n--- system.local columns ---');
        const localColumnsResult = await client.execute("SELECT column_name, type FROM system_schema.columns WHERE keyspace_name = 'system' AND table_name = 'local'");
        localColumnsResult.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.type}`);
        });

        // Check what's in system.local
        console.log('\n--- system.local data ---');
        const localResult = await client.execute('SELECT * FROM system.local');
        if (localResult.rows.length > 0) {
            const local = localResult.rows[0];
            Object.keys(local).forEach(key => {
                const value = local[key];
                if (value !== null && value !== undefined) {
                    console.log(`  ${key}: ${value}`);
                }
            });
        }

        // Check compaction_history
        console.log('\n--- compaction_history sample ---');
        try {
            const compactionResult = await client.execute('SELECT * FROM system.compaction_history LIMIT 5');
            console.log(`Found ${compactionResult.rows.length} compaction records`);
            if (compactionResult.rows.length > 0) {
                console.log('Columns:', Object.keys(compactionResult.rows[0]));
                compactionResult.rows.slice(0, 2).forEach((row, idx) => {
                    console.log(`  Record ${idx + 1}:`, {
                        keyspace: row.keyspace_name,
                        table: row.columnfamily_name,
                        compacted_at: row.compacted_at,
                        bytes_in: row.bytes_in,
                        bytes_out: row.bytes_out
                    });
                });
            }
        } catch (e) {
            console.log('compaction_history error:', e.message);
        }

        // Check if there are any built views or materialized views
        console.log('\n--- materialized views ---');
        try {
            const viewsResult = await client.execute("SELECT keyspace_name, view_name FROM system_schema.views");
            console.log(`Found ${viewsResult.rows.length} materialized views`);
            viewsResult.rows.forEach(row => {
                console.log(`  ${row.keyspace_name}.${row.view_name}`);
            });
        } catch (e) {
            console.log('views error:', e.message);
        }

        // Check sstable_activity if available
        console.log('\n--- sstable_activity ---');
        try {
            const sstableResult = await client.execute('SELECT * FROM system.sstable_activity LIMIT 5');
            console.log(`Found ${sstableResult.rows.length} sstable activity records`);
            if (sstableResult.rows.length > 0) {
                console.log('Columns:', Object.keys(sstableResult.rows[0]));
            }
        } catch (e) {
            console.log('sstable_activity error:', e.message);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.shutdown();
        console.log('\nDisconnected');
    }
}

exploreSystemTables().catch(console.error);
