const db = require('./src/config/database');
const operationsService = require('./src/services/operationsService');

async function testOperations() {
    try {
        console.log('Connecting to Cassandra...');
        await db.connect();
        console.log('Connected successfully\n');

        // Test operations
        console.log('--- Operations ---');
        const operations = await operationsService.getActiveOperations();
        console.log(`Total operations: ${operations.length}`);
        
        const manualOps = operations.filter(op => !op.isSystemOperation);
        const systemOps = operations.filter(op => op.isSystemOperation);
        console.log(`Manual operations: ${manualOps.length}`);
        console.log(`System operations (compactions): ${systemOps.length}`);
        
        if (systemOps.length > 0) {
            console.log('\nRecent compactions:');
            systemOps.slice(0, 5).forEach((op, idx) => {
                const bytesIn = op.result.bytesIn / 1024 / 1024;
                const bytesOut = op.result.bytesOut / 1024 / 1024;
                console.log(`  ${idx + 1}. ${op.keyspace}.${op.table}`);
                console.log(`     ${bytesIn.toFixed(2)} MB -> ${bytesOut.toFixed(2)} MB (ratio: ${op.result.compressionRatio})`);
                console.log(`     ${op.startTime.toLocaleString()}`);
            });
        }

        // Test data browsing - find user tables
        console.log('\n--- Available User Tables ---');
        const tablesQuery = "SELECT keyspace_name, table_name FROM system_schema.tables";
        const tablesResult = await operationsService.executeQuery(tablesQuery);
        
        if (tablesResult.success && tablesResult.rows.length > 0) {
            console.log(`Found ${tablesResult.rows.length} user tables:`);
            tablesResult.rows.forEach((row, idx) => {
                console.log(`  ${idx + 1}. ${row.keyspace_name}.${row.table_name}`);
            });
            
            // Browse the first table
            const firstTable = tablesResult.rows[0];
            console.log(`\n--- Browsing ${firstTable.keyspace_name}.${firstTable.table_name} ---`);
            
            const browseQuery = `SELECT * FROM ${firstTable.keyspace_name}.${firstTable.table_name} LIMIT 5`;
            const browseResult = await operationsService.executeQuery(browseQuery);
            
            if (browseResult.success) {
                console.log(`Rows: ${browseResult.rowCount}`);
                if (browseResult.columns) {
                    console.log('Columns:', browseResult.columns.map(col => `${col.name}(${col.type})`).join(', '));
                }
                if (browseResult.rows && browseResult.rows.length > 0) {
                    console.log('Sample data:');
                    browseResult.rows.slice(0, 2).forEach((row, idx) => {
                        console.log(`  Row ${idx + 1}:`, JSON.stringify(row, null, 2).substring(0, 200) + '...');
                    });
                }
            } else {
                console.log('Browse error:', browseResult.error);
            }
        } else {
            console.log('No user tables found or error:', tablesResult.error);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.disconnect();
        console.log('\nDisconnected');
    }
}

testOperations().catch(console.error);
