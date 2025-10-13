const express = require('express');
const router = express.Router();
const Collaborator = require('../models/collaborator');
const Client = require('../models/client');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/collaborators/:clientId - Get all collaborators for a client
router.get('/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    // Verify user is owner
    const isOwner = await Client.verifyOwnership(clientId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only owners can view collaborators' });
    }

    const collaborators = await Collaborator.findByClientId(clientId);
    res.json({ collaborators });
  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

// POST /api/collaborators/:clientId - Add a collaborator
router.post('/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const { email, role } = req.body;

    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate role
    if (role && !['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be viewer or editor' });
    }

    // Verify user is owner
    const isOwner = await Client.verifyOwnership(clientId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only owners can add collaborators' });
    }

    // Check if trying to add themselves
    if (email === req.user.email) {
      return res.status(400).json({ error: 'You cannot add yourself as a collaborator' });
    }

    const collaboratorId = await Collaborator.add(
      clientId,
      email,
      req.user.userId,
      role || 'viewer'
    );

    res.status(201).json({
      message: 'Collaborator added successfully',
      collaboratorId
    });
  } catch (error) {
    console.error('Add collaborator error:', error);

    if (error.message === 'User not found with this email') {
      return res.status(404).json({ error: error.message });
    }

    if (error.message === 'User is already a collaborator on this project') {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

// DELETE /api/collaborators/:clientId/:collaboratorId - Remove a collaborator
router.delete('/:clientId/:collaboratorId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const collaboratorId = parseInt(req.params.collaboratorId);

    if (isNaN(clientId) || isNaN(collaboratorId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    // Verify user is owner
    const isOwner = await Client.verifyOwnership(clientId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only owners can remove collaborators' });
    }

    const removed = await Collaborator.remove(collaboratorId, clientId);

    if (removed) {
      res.json({ message: 'Collaborator removed successfully' });
    } else {
      res.status(404).json({ error: 'Collaborator not found' });
    }
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

module.exports = router;
