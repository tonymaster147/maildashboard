const db = require('./config/db');

async function updateDb() {
  try {
    console.log('Adding source_url column...');
    await db.query("ALTER TABLE orders ADD COLUMN source_url VARCHAR(500) DEFAULT NULL;");
    console.log('Ok.');
  } catch (err) {
    console.log('Err (might already exist):', err.message);
  }

  try {
    console.log('Modifying status ENUM...');
    await db.query("ALTER TABLE orders MODIFY status ENUM('incomplete', 'pending', 'active', 'in_progress', 'completed', 'cancelled') DEFAULT 'incomplete';");
    console.log('Ok.');
  } catch (err) {
    console.log('Err:', err.message);
  }

  process.exit(0);
}

updateDb();
