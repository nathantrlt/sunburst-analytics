const express = require('express');
const router = express.Router();
const Pageview = require('../models/pageview');
const { authenticateApiKey } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting for tracking endpoint (1000 requests per 15 minutes per IP)
const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many tracking requests, please try again later' }
});

// POST /api/track - Receive tracking data from snippet
router.post('/', trackingLimiter, authenticateApiKey, async (req, res) => {
  try {
    const {
      sessionId,
      userIdentifier,
      pageUrl,
      pageTitle,
      sequenceNumber,
      timeSpent,
      deviceType,
      userLocation,
      referrer
    } = req.body;

    // Validate required fields
    if (!sessionId || !pageUrl || sequenceNumber === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, pageUrl, sequenceNumber'
      });
    }

    // Create pageview record
    await Pageview.create({
      clientId: req.client.id,
      sessionId,
      userIdentifier: userIdentifier || null,
      pageUrl,
      pageTitle: pageTitle || '',
      sequenceNumber,
      timeSpent: timeSpent || 0,
      deviceType: deviceType || 'unknown',
      userLocation: userLocation || null,
      referrer: referrer || null
    });

    res.status(201).json({
      success: true,
      message: 'Pageview tracked successfully'
    });
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({ error: 'Failed to track pageview' });
  }
});

// POST /api/track/time - Update time spent on a page
router.post('/time', trackingLimiter, authenticateApiKey, async (req, res) => {
  try {
    const { sessionId, pageUrl, timeSpent } = req.body;

    // Validate required fields
    if (!sessionId || !pageUrl || timeSpent === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, pageUrl, timeSpent'
      });
    }

    // Update time spent
    await Pageview.updateTimeSpent(sessionId, pageUrl, timeSpent);

    res.json({
      success: true,
      message: 'Time updated successfully'
    });
  } catch (error) {
    console.error('Time update error:', error);
    res.status(500).json({ error: 'Failed to update time' });
  }
});

module.exports = router;
