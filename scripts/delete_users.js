const { Pool } = require('pg');
require('dotenv').config({ path: '../backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function deleteAllUsers() {
    const client = await pool.connect();
    try {
        console.log("--- NEURAL SHIELD DATABASE CLEANUP ---");
        console.log("Connecting to:", process.env.DATABASE_URL.split('@')[1]); // Log without credentials

        await client.query('BEGIN');

        console.log("Deleting fraud analysis records...");
        await client.query('DELETE FROM fraud_analysis');

        console.log("Deleting transactions...");
        await client.query('DELETE FROM transactions');

        console.log("Deleting user profiles...");
        await client.query('DELETE FROM user_profiles');

        console.log("Deleting all users...");
        const result = await client.query('DELETE FROM users');

        await client.query('COMMIT');
        console.log(`Successfully deleted ${result.rowCount} users and all associated data.`);
        console.log("--------------------------------------");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Cleanup Failed:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

deleteAllUsers();
