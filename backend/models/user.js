const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // Create a new user
  static async create(email, password, name) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
        [email, hashedPassword, name]
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT id, email, name, created_at FROM users WHERE id = ?',
        [id]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Check if email exists
  static async emailExists(email) {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) as count FROM users WHERE email = ?',
        [email]
      );
      return rows[0].count > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;
