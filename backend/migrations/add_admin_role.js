const { pool } = require('../config/database');

async function up() {
  try {
    // Alter the role column to add 'admin' to the ENUM
    await pool.query(`
      ALTER TABLE collaborators
      MODIFY COLUMN role ENUM('viewer', 'editor', 'admin') DEFAULT 'viewer'
    `);

    console.log('Migration: Added admin role to collaborators table');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

async function down() {
  try {
    // Revert back to only viewer and editor
    // First, update any admin roles to editor
    await pool.query(`
      UPDATE collaborators SET role = 'editor' WHERE role = 'admin'
    `);

    // Then alter the column
    await pool.query(`
      ALTER TABLE collaborators
      MODIFY COLUMN role ENUM('viewer', 'editor') DEFAULT 'viewer'
    `);

    console.log('Migration: Removed admin role from collaborators table');
  } catch (error) {
    console.error('Migration rollback error:', error);
    throw error;
  }
}

module.exports = { up, down };
