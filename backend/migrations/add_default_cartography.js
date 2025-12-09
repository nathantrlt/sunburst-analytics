const { pool } = require('../config/database');

async function migrate() {
    try {
        console.log('Running migration: add_default_cartography');

        // Check if column already exists
        const [columns] = await pool.execute(`
            SELECT COUNT(*) as count
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'cartographies'
            AND column_name = 'is_default'
        `);

        if (columns[0].count > 0) {
            console.log('✓ is_default column already exists');
            return;
        }

        // Add is_default column
        await pool.execute(`
            ALTER TABLE cartographies
            ADD COLUMN is_default BOOLEAN DEFAULT FALSE AFTER filters
        `);

        console.log('✓ is_default column added successfully');
    } catch (error) {
        console.error('Error in add_default_cartography migration:', error);
        throw error;
    }
}

module.exports = { migrate };
