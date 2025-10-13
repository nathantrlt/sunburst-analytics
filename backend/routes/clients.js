const express = require('express');
const router = express.Router();
const Client = require('../models/client');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/clients - Get all clients for logged in user
router.get('/', async (req, res) => {
  try {
    const clients = await Client.findByUserId(req.user.userId);
    res.json({ clients });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// POST /api/clients - Create new client
router.post('/', async (req, res) => {
  try {
    const { siteName, siteUrl } = req.body;

    // Validate input
    if (!siteName || !siteUrl) {
      return res.status(400).json({ error: 'Site name and URL are required' });
    }

    // Validate URL format
    try {
      new URL(siteUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Create client
    const result = await Client.create(req.user.userId, siteName, siteUrl);

    // Get the full client data
    const client = await Client.findById(result.id);

    res.status(201).json({
      message: 'Client created successfully',
      client: {
        id: client.id,
        site_name: client.site_name,
        site_url: client.site_url,
        api_key: client.api_key,
        created_at: client.created_at
      }
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// DELETE /api/clients/:id - Delete a client
router.delete('/:id', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    // Verify ownership
    const isOwner = await Client.verifyOwnership(clientId, req.user.userId);
    if (!isOwner) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Delete client
    const deleted = await Client.delete(clientId, req.user.userId);

    if (deleted) {
      res.json({ message: 'Client deleted successfully' });
    } else {
      res.status(404).json({ error: 'Client not found' });
    }
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// GET /api/clients/:id - Get single client
router.get('/:id', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    // Verify ownership
    const isOwner = await Client.verifyOwnership(clientId, req.user.userId);
    if (!isOwner) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({
      client: {
        id: client.id,
        site_name: client.site_name,
        site_url: client.site_url,
        api_key: client.api_key,
        created_at: client.created_at
      }
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

module.exports = router;
