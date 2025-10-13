const { pool } = require('../config/database');

class Collaborator {
  // Add collaborator to a client
  static async add(clientId, userEmail, invitedBy, role = 'viewer') {
    try {
      // First, find the user by email
      const [users] = await pool.query(
        'SELECT id FROM users WHERE email = ?',
        [userEmail]
      );

      if (users.length === 0) {
        throw new Error('User not found with this email');
      }

      const userId = users[0].id;

      // Check if collaboration already exists
      const [existing] = await pool.query(
        'SELECT id FROM collaborators WHERE client_id = ? AND user_id = ?',
        [clientId, userId]
      );

      if (existing.length > 0) {
        throw new Error('User is already a collaborator on this project');
      }

      // Add collaborator
      const [result] = await pool.query(
        'INSERT INTO collaborators (client_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)',
        [clientId, userId, role, invitedBy]
      );

      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  // Get all collaborators for a client
  static async findByClientId(clientId) {
    try {
      const [rows] = await pool.query(
        `SELECT c.id, c.role, c.created_at, u.id as user_id, u.email, u.name
         FROM collaborators c
         JOIN users u ON c.user_id = u.id
         WHERE c.client_id = ?
         ORDER BY c.created_at DESC`,
        [clientId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Get all clients a user has access to (owned + collaborated)
  static async getAccessibleClients(userId) {
    try {
      const [rows] = await pool.query(
        `SELECT c.*, 'owner' as access_type
         FROM clients c
         WHERE c.user_id = ?
         UNION
         SELECT c.*, col.role as access_type
         FROM clients c
         JOIN collaborators col ON c.id = col.client_id
         WHERE col.user_id = ?
         ORDER BY created_at DESC`,
        [userId, userId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Check if user has access to a client
  static async hasAccess(clientId, userId) {
    try {
      const [rows] = await pool.query(
        `SELECT 1 FROM clients WHERE id = ? AND user_id = ?
         UNION
         SELECT 1 FROM collaborators WHERE client_id = ? AND user_id = ?`,
        [clientId, userId, clientId, userId]
      );
      return rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  // Remove collaborator
  static async remove(collaboratorId, clientId) {
    try {
      const [result] = await pool.query(
        'DELETE FROM collaborators WHERE id = ? AND client_id = ?',
        [collaboratorId, clientId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // Get user's role on a client
  static async getRole(clientId, userId) {
    try {
      // Check if owner
      const [owner] = await pool.query(
        'SELECT 1 FROM clients WHERE id = ? AND user_id = ?',
        [clientId, userId]
      );

      if (owner.length > 0) {
        return 'owner';
      }

      // Check if collaborator
      const [collab] = await pool.query(
        'SELECT role FROM collaborators WHERE client_id = ? AND user_id = ?',
        [clientId, userId]
      );

      if (collab.length > 0) {
        return collab[0].role;
      }

      return null;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Collaborator;
