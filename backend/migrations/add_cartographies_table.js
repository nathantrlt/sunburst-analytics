const db = require('../config/database');

async function migrate() {
    try {
        console.log('Running migration: add_cartographies_table');

        // Check if table already exists
        const [tables] = await db.execute(`
            SELECT COUNT(*) as count
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
            AND table_name = 'cartographies'
        `);

        if (tables[0].count > 0) {
            console.log('✓ cartographies table already exists');
            return;
        }

        // Create cartographies table
        await db.execute(`
            CREATE TABLE cartographies (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                filters JSON NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                INDEX idx_client_id (client_id)
            )
        `);

        console.log('✓ cartographies table created successfully');
    } catch (error) {
        console.error('Error in add_cartographies_table migration:', error);
        throw error;
    }
}

module.exports = { migrate };
