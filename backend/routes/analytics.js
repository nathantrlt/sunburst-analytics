const express = require('express');
const router = express.Router();
const Pageview = require('../models/pageview');
const Client = require('../models/client');
const Collaborator = require('../models/collaborator');
const PageCategory = require('../models/pageCategory');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Verify client access middleware (owner or collaborator)
const verifyClientAccess = async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    const hasAccess = await Collaborator.hasAccess(clientId, req.user.userId);
    if (!hasAccess) {
      return res.status(404).json({ error: 'Client not found' });
    }

    req.clientId = clientId;
    next();
  } catch (error) {
    console.error('Client access verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
};

// GET /api/analytics/stats/:clientId - Get general statistics
router.get('/stats/:clientId', verifyClientAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await Pageview.getStats(
      req.clientId,
      startDate || null,
      endDate || null
    );

    res.json({
      stats: {
        totalPageviews: parseInt(stats.total_pageviews) || 0,
        uniqueSessions: parseInt(stats.unique_sessions) || 0,
        uniqueUsers: parseInt(stats.unique_users) || 0,
        avgTimeSpent: Math.round(parseFloat(stats.avg_time_spent) || 0),
        avgPagesPerSession: parseFloat((parseFloat(stats.avg_pages_per_session) || 0).toFixed(2))
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/analytics/sunburst/:clientId - Get data for sunburst visualization
router.get('/sunburst/:clientId', verifyClientAccess, async (req, res) => {
  try {
    const { startDate, endDate, depth } = req.query;
    const maxDepth = parseInt(depth) || 5;

    if (maxDepth < 1 || maxDepth > 20) {
      return res.status(400).json({ error: 'Depth must be between 1 and 20' });
    }

    const journeyData = await Pageview.getJourneyData(
      req.clientId,
      maxDepth,
      startDate || null,
      endDate || null
    );

    // Transform data into hierarchical structure for sunburst
    const sunburstData = transformToSunburst(journeyData, maxDepth);

    res.json({ data: sunburstData });
  } catch (error) {
    console.error('Get sunburst data error:', error);
    res.status(500).json({ error: 'Failed to fetch sunburst data' });
  }
});

// GET /api/analytics/page-positions/:clientId - Get page position statistics
router.get('/page-positions/:clientId', verifyClientAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const pagePositions = await Pageview.getPagePositions(
      req.clientId,
      startDate || null,
      endDate || null
    );

    const formattedData = pagePositions.map(page => ({
      url: page.page_url,
      title: page.page_title || page.page_url,
      totalViews: parseInt(page.total_views) || 0,
      avgPosition: parseFloat((parseFloat(page.avg_position) || 0).toFixed(2)),
      avgTimeSpent: Math.round(parseFloat(page.avg_time_spent) || 0)
    }));

    res.json({ pages: formattedData });
  } catch (error) {
    console.error('Get page positions error:', error);
    res.status(500).json({ error: 'Failed to fetch page positions' });
  }
});

// GET /api/analytics/category-stats/:clientId - Get statistics by category
router.get('/category-stats/:clientId', verifyClientAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const categoryStats = await PageCategory.getCategoryStats(
      req.clientId,
      startDate || null,
      endDate || null
    );

    res.json({ categories: categoryStats });
  } catch (error) {
    console.error('Get category stats error:', error);
    res.status(500).json({ error: 'Failed to fetch category statistics' });
  }
});

// Helper function to transform journey data to sunburst format
function transformToSunburst(journeyData, maxDepth) {
  if (!journeyData || journeyData.length === 0) {
    return { name: 'root', children: [] };
  }

  // Group by session
  const sessions = {};
  journeyData.forEach(row => {
    if (!sessions[row.session_id]) {
      sessions[row.session_id] = [];
    }
    sessions[row.session_id].push({
      url: row.page_url,
      title: row.page_title || row.page_url,
      sequence: row.sequence_number
    });
  });

  // Build hierarchical tree
  const root = { name: 'root', children: [] };
  const pathMap = new Map();

  Object.values(sessions).forEach(session => {
    // Sort by sequence number
    session.sort((a, b) => a.sequence - b.sequence);

    // Build path
    let currentPath = '';
    let currentLevel = root;

    session.forEach((page, index) => {
      if (index >= maxDepth) return;

      const pageName = page.title || page.url;
      currentPath += '/' + pageName;

      // Find or create child at current level
      let child = currentLevel.children.find(c => c.name === pageName && c.path === currentPath);

      if (!child) {
        child = {
          name: pageName,
          url: page.url,
          path: currentPath,
          value: 0,
          children: []
        };
        currentLevel.children.push(child);
      }

      child.value += 1;
      currentLevel = child;
    });
  });

  // Remove empty children arrays and sort by value
  function cleanupTree(node) {
    if (node.children && node.children.length > 0) {
      node.children.forEach(cleanupTree);
      node.children.sort((a, b) => b.value - a.value);
    } else {
      delete node.children;
    }
    delete node.path;
  }

  cleanupTree(root);

  return root;
}

module.exports = router;
