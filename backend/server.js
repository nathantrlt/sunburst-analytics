const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
require('dotenv').config();

const { testConnection, initDatabase } = require('./config/database');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const trackingRoutes = require('./routes/tracking');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - Configure CSP to allow D3.js CDN and tracker
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://d3js.org"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static('frontend/public'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/track', trackingRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('🚀 Starting Sunburst Analytics Server...\n');

    // Test database connection
    await testConnection();

    // Initialize database tables
    await initDatabase();

    // Start listening
    app.listen(PORT, () => {
      console.log(`\n✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ Frontend: http://localhost:${PORT}/index.html`);
      console.log(`✓ Dashboard: http://localhost:${PORT}/dashboard.html`);
      console.log(`✓ API: http://localhost:${PORT}/api`);
      console.log(`\n📊 Sunburst Analytics is ready!\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});

startServer();
