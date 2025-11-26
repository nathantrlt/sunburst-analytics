const { pool } = require('../config/database');

async function checkAndMigrate() {
  try {
    console.log('Checking database schema...');

    // Check if 'admin' role exists in the ENUM
    const [columns] = await pool.query(`
      SHOW COLUMNS FROM collaborators WHERE Field = 'role'
    `);

    if (columns.length > 0) {
      const roleColumn = columns[0];
      const enumValues = roleColumn.Type; // Example: "enum('viewer','editor')"

      console.log('Current role ENUM:', enumValues);

      // Check if 'admin' is already in the ENUM
      if (!enumValues.includes('admin')) {
        console.log('Admin role not found in ENUM. Applying migration...');

        // Apply migration
        await pool.query(`
          ALTER TABLE collaborators
          MODIFY COLUMN role ENUM('viewer', 'editor', 'admin') DEFAULT 'viewer'
        `);

        console.log('✅ Migration applied successfully: admin role added to collaborators table');
      } else {
        console.log('✅ Database schema is up to date (admin role already exists)');
      }
    }
  } catch (error) {
    console.error('❌ Auto-migration error:', error);
    // Don't throw - allow the server to start even if migration fails
  }
}

module.exports = { checkAndMigrate };
