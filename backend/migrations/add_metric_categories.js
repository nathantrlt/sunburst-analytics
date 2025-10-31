const { pool } = require('../config/database');

async function migrate() {
  const connection = await pool.getConnection();

  try {
    console.log('Starting migration: add_metric_categories');

    // Check if condition_period_days column exists
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM page_categories LIKE 'condition_period_days'
    `);

    if (columns.length === 0) {
      // Add condition_period_days column
      await connection.query(`
        ALTER TABLE page_categories
        ADD COLUMN condition_period_days INT DEFAULT NULL
        AFTER condition_value
      `);
      console.log('✓ Added condition_period_days column');
    } else {
      console.log('✓ Column condition_period_days already exists');
    }

    // Convert empty strings to NULL first
    await connection.query(`
      UPDATE page_categories
      SET condition_type = NULL
      WHERE condition_type = '' OR condition_type IS NULL
    `);
    await connection.query(`
      UPDATE page_categories
      SET condition_value = NULL
      WHERE condition_value = '' OR condition_value IS NULL
    `);

    // Change condition_type from ENUM to VARCHAR to support both legacy and multi-conditions
    await connection.query(`
      ALTER TABLE page_categories
      MODIFY COLUMN condition_type VARCHAR(50) NULL,
      MODIFY COLUMN condition_value TEXT NULL
    `);
    console.log('✓ Updated condition_type to VARCHAR (nullable)');

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
