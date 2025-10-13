const { pool } = require('../config/database');
const crypto = require('crypto');

class Client {
  // Generate a unique API key
  static generateApiKey() {
    return 'sk_' + crypto.randomBytes(32).toString('hex');
  }

  // Create a new client
  static async create(userId, siteName, siteUrl) {
    try {
      const apiKey = this.generateApiKey();
      const [result] = await pool.query(
        'INSERT INTO clients (user_id, site_name, site_url, api_key) VALUES (?, ?, ?, ?)',
        [userId, siteName, siteUrl, apiKey]
      );
      return {
        id: result.insertId,
        apiKey
      };
    } catch (error) {
      throw error;
    }
  }

  // Get all clients for a user
  static async findByUserId(userId) {
    try {
      const [rows] = await pool.query(
        'SELECT id, site_name, site_url, api_key, created_at FROM clients WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Find client by API key
  static async findByApiKey(apiKey) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM clients WHERE api_key = ?',
        [apiKey]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Find client by ID
  static async findById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM clients WHERE id = ?',
        [id]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Delete client
  static async delete(id, userId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM clients WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // Verify client ownership
  static async verifyOwnership(clientId, userId) {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) as count FROM clients WHERE id = ? AND user_id = ?',
        [clientId, userId]
      );
      return rows[0].count > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Client;
