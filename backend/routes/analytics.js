const express = require('express');
const router = express.Router();
const Pageview = require('../models/pageview');
const Client = require('../models/client');
const Collaborator = require('../models/collaborator');
const PageCategory = require('../models/pageCategory');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Helper to extract filters from query params
function extractFilters(query) {
  return {
    startDate: query.startDate || null,
    endDate: query.endDate || null,
    deviceType: query.deviceType || null,
    trafficSource: query.trafficSource || null,
    category: query.category || null
  };
}

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
    const filters = extractFilters(req.query);

    const stats = await Pageview.getStats(
      req.clientId,
      filters
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
    const filters = extractFilters(req.query);
    const maxDepth = parseInt(req.query.depth) || 5;

    if (maxDepth < 1 || maxDepth > 20) {
      return res.status(400).json({ error: 'Depth must be between 1 and 20' });
    }

    const journeyData = await Pageview.getJourneyData(
      req.clientId,
      maxDepth,
      filters
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
    const filters = extractFilters(req.query);

    const pagePositions = await Pageview.getPagePositions(
      req.clientId,
      filters
    );

    const formattedData = pagePositions.map(page => ({
      url: page.page_url,
      title: page.page_title || page.page_url,
      totalViews: parseInt(page.total_views) || 0,
      avgPosition: Math.round(parseFloat(page.avg_position) || 0),
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
    const filters = extractFilters(req.query);

    const categoryStats = await PageCategory.getCategoryStats(
      req.clientId,
      filters
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

// DELETE /api/analytics/cleanup-gtm/:clientId - Remove GTM tracking data
router.delete('/cleanup-gtm/:clientId', verifyClientAccess, async (req, res) => {
  try {
    const pool = require('../config/database');

    const [result] = await pool.query(`
      DELETE FROM pageviews
      WHERE client_id = ?
      AND (
        pageUrl LIKE '%gtm-msr.appspot.com%'
        OR pageUrl LIKE '%googletagmanager.com%'
        OR pageUrl LIKE '%google-analytics.com%'
      )
    `, [req.clientId]);

    res.json({
      success: true,
      message: `${result.affectedRows} entrées GTM supprimées`,
      deletedCount: result.affectedRows
    });
  } catch (error) {
    console.error('GTM cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup GTM data' });
  }
});

// GET /api/analytics/category-details/:clientId/:categoryId - Get detailed category analytics
router.get('/category-details/:clientId/:categoryId', verifyClientAccess, async (req, res) => {
  try {
    const filters = extractFilters(req.query);
    const categoryId = parseInt(req.params.categoryId);

    // Get category info
    const category = await PageCategory.findById(categoryId);
    if (!category || category.client_id !== req.clientId) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get all pageviews and apply category matching
    const pageviews = await Pageview.getAllPageviews(
      req.clientId,
      filters
    );

    // Filter pages that match this category
    const categoryPages = pageviews.filter(pv =>
      PageCategory.matchesRule(pv.page_url, category)
    );

    // Calculate global stats
    const totalViews = categoryPages.length;
    const uniquePages = [...new Set(categoryPages.map(p => p.page_url))].length;
    const avgDepth = categoryPages.length > 0
      ? categoryPages.reduce((sum, p) => sum + p.sequence_number, 0) / categoryPages.length
      : 0;
    const avgTimeSpent = categoryPages.length > 0
      ? categoryPages.reduce((sum, p) => sum + p.time_spent, 0) / categoryPages.length
      : 0;

    // Group by page for detailed stats
    const pageStats = {};
    categoryPages.forEach(pv => {
      if (!pageStats[pv.page_url]) {
        pageStats[pv.page_url] = {
          url: pv.page_url,
          title: pv.page_title || pv.page_url,
          views: 0,
          totalDepth: 0,
          totalTime: 0
        };
      }
      pageStats[pv.page_url].views++;
      pageStats[pv.page_url].totalDepth += pv.sequence_number;
      pageStats[pv.page_url].totalTime += pv.time_spent;
    });

    const pages = Object.values(pageStats).map(p => ({
      url: p.url,
      title: p.title,
      views: p.views,
      avgDepth: Math.round(p.totalDepth / p.views),
      avgTimeSpent: Math.round(p.totalTime / p.views)
    })).sort((a, b) => b.views - a.views);

    res.json({
      category: {
        id: category.id,
        name: category.name,
        condition_type: category.condition_type,
        condition_value: category.condition_value
      },
      stats: {
        totalViews,
        uniquePages,
        avgDepth: Math.round(avgDepth),
        avgTimeSpent: Math.round(avgTimeSpent)
      },
      pages
    });
  } catch (error) {
    console.error('Get category details error:', error);
    res.status(500).json({ error: 'Failed to fetch category details' });
  }
});

module.exports = router;
