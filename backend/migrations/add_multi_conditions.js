const { pool } = require('../config/database');

async function migrate() {
  const connection = await pool.getConnection();

  try {
    console.log('Starting migration: add_multi_conditions');

    // Check if conditions_json column exists
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM page_categories LIKE 'conditions_json'
    `);

    if (columns.length === 0) {
      // Add conditions_json column for complex multi-condition rules
      await connection.query(`
        ALTER TABLE page_categories
        ADD COLUMN conditions_json TEXT DEFAULT NULL
        AFTER condition_period_days
      `);
      console.log('✓ Added conditions_json column');
    } else {
      console.log('✓ Column conditions_json already exists');
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

module.exports = { migrate };
