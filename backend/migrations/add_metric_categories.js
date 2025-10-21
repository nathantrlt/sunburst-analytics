const { pool } = require('../config/database');

async function migrate() {
  const connection = await pool.getConnection();

  try {
    console.log('Starting migration: add_metric_categories');

    // Add condition_period_days column
    await connection.query(`
      ALTER TABLE page_categories
      ADD COLUMN IF NOT EXISTS condition_period_days INT DEFAULT NULL
      AFTER condition_value
    `);
    console.log('✓ Added condition_period_days column');

    // Modify condition_type ENUM to add new types
    await connection.query(`
      ALTER TABLE page_categories
      MODIFY COLUMN condition_type ENUM(
        'contains', 'starts_with', 'ends_with', 'equals', 'regex',
        'pageviews_greater_than', 'pageviews_less_than',
        'avg_position_greater_than', 'avg_position_less_than',
        'avg_time_greater_than', 'avg_time_less_than'
      ) NOT NULL
    `);
    console.log('✓ Updated condition_type ENUM');

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
