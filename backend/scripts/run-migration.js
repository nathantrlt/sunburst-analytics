const { pool } = require('../config/database');

async function runMigration() {
  try {
    console.log('Running migration: add_admin_role');

    const migration = require('../migrations/add_admin_role');
    await migration.up();

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
