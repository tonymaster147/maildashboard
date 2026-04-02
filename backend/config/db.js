const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tutoring_platform',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 100,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  idleTimeout: 60000
});

// Test connection
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
  });

// Log pool health every 60s to detect exhaustion
setInterval(() => {
  const p = pool.pool;
  if (p) {
    const free = p._freeConnections?.length || 0;
    const all = p._allConnections?.length || 0;
    const queued = p._connectionQueue?.length || 0;
    if (queued > 0 || free === 0) {
      console.warn(`⚠️ DB Pool: ${all} active, ${free} free, ${queued} queued`);
    }
  }
}, 60000);

module.exports = pool;
