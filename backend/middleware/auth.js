const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  });
};

// Middleware to verify API key for tracking
const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.body.apiKey || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  try {
    const Client = require('../models/client');
    const client = await Client.findByApiKey(apiKey);

    if (!client) {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    req.client = client;
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

module.exports = {
  authenticateToken,
  authenticateApiKey,
  generateToken
};
