const db = require('./src/config/database');
const operationsService = require('./src/services/operationsService');

async function testLoomData() {
    try {
        console.log('Connecting to Cassandra...');
        await db.connect();
        console.log('Connected successfully\n');

        // Browse loom.executions (most likely to have data)
        console.log('--- Browsing loom.executions ---');
        const execQuery = 'SELECT * FROM loom.executions LIMIT 5';
        const execResult = await operationsService.executeQuery(execQuery);
        
        if (execResult.success) {
            console.log(`Rows: ${execResult.rowCount}`);
            if (execResult.columns) {
                console.log('Columns:', execResult.columns.map(col => col.name).join(', '));
            }
            if (execResult.rows && execResult.rows.length > 0) {
                console.log('\nSample execution data:');
                execResult.rows.slice(0, 2).forEach((row, idx) => {
                    console.log(`  Row ${idx + 1}: ${Object.keys(row).slice(0, 5).join(', ')}...`);
                });
            }
        } else {
            console.log('Error:', execResult.error);
        }

        // Browse loom.namespaces
        console.log('\n--- Browsing loom.namespaces ---');
        const nsQuery = 'SELECT * FROM loom.namespaces LIMIT 5';
        const nsResult = await operationsService.executeQuery(nsQuery);
        
        if (nsResult.success) {
            console.log(`Rows: ${nsResult.rowCount}`);
            if (nsResult.columns) {
                console.log('Columns:', nsResult.columns.map(col => col.name).join(', '));
            }
            if (nsResult.rows && nsResult.rows.length > 0) {
                console.log('\nSample namespace data:');
                nsResult.rows.forEach((row, idx) => {
                    console.log(`  Row ${idx + 1}:`, Object.keys(row).map(key => `${key}: ${row[key]}`).join(', '));
                });
            }
        } else {
            console.log('Error:', nsResult.error);
        }

        // Browse loom.tasks 
        console.log('\n--- Browsing loom.tasks ---');
        const taskQuery = 'SELECT * FROM loom.tasks LIMIT 3';
        const taskResult = await operationsService.executeQuery(taskQuery);
        
        if (taskResult.success) {
            console.log(`Rows: ${taskResult.rowCount}`);
            if (taskResult.columns) {
                console.log('Columns:', taskResult.columns.map(col => col.name).join(', '));
            }
        } else {
            console.log('Error:', taskResult.error);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.disconnect();
        console.log('\nDisconnected');
    }
}

testLoomData().catch(console.error);
