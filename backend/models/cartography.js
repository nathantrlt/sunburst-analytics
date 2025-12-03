const { pool } = require('../config/database');

const Cartography = {
    // Create a new cartography
    async create(clientId, name, description, filters) {
        try {
            console.log('[Cartography.create] Parameters:', {
                clientId,
                name,
                description,
                filters: JSON.stringify(filters)
            });

            const query = `
                INSERT INTO cartographies (client_id, name, description, filters, created_at)
                VALUES (?, ?, ?, ?, NOW())
            `;

            const params = [
                clientId,
                name,
                description || null,
                JSON.stringify(filters)
            ];

            console.log('[Cartography.create] Executing query with params:', params);

            const [result] = await pool.execute(query, params);

            console.log('[Cartography.create] Success! Insert ID:', result.insertId);

            return result.insertId;
        } catch (error) {
            console.error('[Cartography.create] Database error:', error);
            console.error('[Cartography.create] Error code:', error.code);
            console.error('[Cartography.create] Error message:', error.message);
            throw error;
        }
    },

    // Get all cartographies for a client
    async getByClientId(clientId) {
        const query = `
            SELECT id, client_id, name, description, filters, created_at, updated_at
            FROM cartographies
            WHERE client_id = ?
            ORDER BY created_at DESC
        `;

        const [rows] = await pool.execute(query, [clientId]);

        // Filters are already parsed by MySQL JSON column type
        return rows;
    },

    // Get a specific cartography
    async getById(id, clientId) {
        const query = `
            SELECT id, client_id, name, description, filters, created_at, updated_at
            FROM cartographies
            WHERE id = ? AND client_id = ?
        `;

        const [rows] = await pool.execute(query, [id, clientId]);

        if (rows.length === 0) {
            return null;
        }

        // Filters are already parsed by MySQL JSON column type
        return rows[0];
    },

    // Update a cartography
    async update(id, clientId, name, description, filters) {
        const query = `
            UPDATE cartographies
            SET name = ?, description = ?, filters = ?, updated_at = NOW()
            WHERE id = ? AND client_id = ?
        `;

        const [result] = await pool.execute(query, [
            name,
            description || null,
            JSON.stringify(filters),
            id,
            clientId
        ]);

        return result.affectedRows > 0;
    },

    // Delete a cartography
    async delete(id, clientId) {
        const query = `
            DELETE FROM cartographies
            WHERE id = ? AND client_id = ?
        `;

        const [result] = await pool.execute(query, [id, clientId]);

        return result.affectedRows > 0;
    },

    // Create table if not exists (for migration)
    async createTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS cartographies (
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
        `;

        await pool.execute(query);
    }
};

module.exports = Cartography;
