const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:Postgre@123@localhost:5432/fraud_detection_db'
});

async function run() {
    try {
        const res = await pool.query("DELETE FROM users WHERE email ILIKE $1 RETURNING *", ['%fiza%']);
        console.log('Deleted users:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

run();
