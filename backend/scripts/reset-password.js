const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

async function resetPassword(email, newPassword) {
  try {
    console.log(`Resetting password for: ${email}`);

    // Check if user exists
    const [users] = await pool.query('SELECT id, email FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    const user = users[0];
    console.log(`User found - ID: ${user.id}, Email: ${user.email}`);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

    console.log('✓ Password updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

// Get arguments
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Usage: node reset-password.js <email> <new-password>');
  process.exit(1);
}

resetPassword(email, newPassword);
