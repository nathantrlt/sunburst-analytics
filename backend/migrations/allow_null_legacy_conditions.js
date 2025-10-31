const { pool } = require('../config/database');

async function migrate() {
  const connection = await pool.getConnection();

  try {
    console.log('Starting migration: allow_null_legacy_conditions');

    // Check if columns are already nullable
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'page_categories'
        AND COLUMN_NAME IN ('condition_type', 'condition_value')
    `);

    const needsMigration = columns.some(col => col.IS_NULLABLE === 'NO');

    if (needsMigration) {
      // Allow NULL in condition_type and condition_value for multi-condition categories
      await connection.query(`
        ALTER TABLE page_categories
        MODIFY COLUMN condition_type VARCHAR(50) NULL,
        MODIFY COLUMN condition_value TEXT NULL
      `);
      console.log('✓ Allowed NULL in condition_type and condition_value columns');
    } else {
      console.log('✓ Columns already allow NULL, skipping migration');
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
