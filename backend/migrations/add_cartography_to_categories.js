const { pool } = require('../config/database');

async function migrate() {
    try {
        console.log('Running migration: add_cartography_to_categories');

        // Check if column already exists
        const [columns] = await pool.execute(`
            SELECT COUNT(*) as count
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = 'page_categories'
            AND column_name = 'cartography_id'
        `);

        if (columns[0].count > 0) {
            console.log('✓ cartography_id column already exists in page_categories');
            return;
        }

        // Add cartography_id column (nullable to support legacy data)
        await pool.execute(`
            ALTER TABLE page_categories
            ADD COLUMN cartography_id INT NULL AFTER client_id,
            ADD INDEX idx_cartography_id (cartography_id),
            ADD CONSTRAINT fk_page_categories_cartography
                FOREIGN KEY (cartography_id) REFERENCES cartographies(id) ON DELETE CASCADE
        `);

        console.log('✓ cartography_id column added to page_categories');

        // Migrate existing categories to the first cartography of each client
        // This ensures existing data continues to work
        const [existingCategories] = await pool.execute(`
            SELECT DISTINCT pc.client_id
            FROM page_categories pc
            WHERE pc.cartography_id IS NULL
        `);

        for (const { client_id } of existingCategories) {
            // Get the first (oldest) cartography for this client
            const [cartographies] = await pool.execute(`
                SELECT id FROM cartographies
                WHERE client_id = ?
                ORDER BY created_at ASC
                LIMIT 1
            `, [client_id]);

            if (cartographies.length > 0) {
                const cartographyId = cartographies[0].id;
                await pool.execute(`
                    UPDATE page_categories
                    SET cartography_id = ?
                    WHERE client_id = ? AND cartography_id IS NULL
                `, [cartographyId, client_id]);
                console.log(`  ✓ Migrated categories for client ${client_id} to cartography ${cartographyId}`);
            }
        }

        console.log('✓ Migration completed successfully');
    } catch (error) {
        console.error('Error in add_cartography_to_categories migration:', error);
        throw error;
    }
}

module.exports = { migrate };
