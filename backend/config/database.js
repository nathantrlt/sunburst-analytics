const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection pool configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sunburst_analytics',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✓ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    process.exit(1);
  }
};

// Initialize database tables
const initDatabase = async () => {
  try {
    const connection = await pool.getConnection();

    // Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      )
    `);

    // Create clients table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        site_name VARCHAR(255) NOT NULL,
        site_url VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_api_key (api_key),
        INDEX idx_user_id (user_id)
      )
    `);

    // Create pageviews table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pageviews (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        session_id VARCHAR(255) NOT NULL,
        user_identifier VARCHAR(255),
        page_url VARCHAR(500) NOT NULL,
        page_title VARCHAR(255),
        sequence_number INT NOT NULL,
        time_spent INT DEFAULT 0,
        device_type VARCHAR(50),
        user_location VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        referrer VARCHAR(500),
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        INDEX idx_client_id (client_id),
        INDEX idx_session_id (session_id),
        INDEX idx_timestamp (timestamp)
      )
    `);

    // Create collaborators table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS collaborators (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('viewer', 'editor') DEFAULT 'viewer',
        invited_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_collaboration (client_id, user_id),
        INDEX idx_client_id (client_id),
        INDEX idx_user_id (user_id)
      )
    `);

    console.log('✓ Database tables initialized');
    connection.release();
  } catch (error) {
    console.error('✗ Database initialization failed:', error.message);
    throw error;
  }
};

module.exports = {
  pool,
  testConnection,
  initDatabase
};
