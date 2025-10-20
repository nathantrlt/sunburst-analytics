const express = require('express');
const router = express.Router();
const PageCategory = require('../models/pageCategory');
const Client = require('../models/client');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/page-categories/:clientId - Get all category rules for a client
router.get('/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    // Verify user is owner (only owners can manage categories)
    const isOwner = await Client.verifyOwnership(clientId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only owners can manage categories' });
    }

    const categories = await PageCategory.findByClientId(clientId);
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/page-categories/:clientId - Create a new category rule
router.post('/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const { name, conditionType, conditionValue, priority } = req.body;

    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    // Validate input
    if (!name || !conditionType || !conditionValue) {
      return res.status(400).json({ error: 'Name, condition type, and condition value are required' });
    }

    const validTypes = ['contains', 'starts_with', 'ends_with', 'equals', 'regex'];
    if (!validTypes.includes(conditionType)) {
      return res.status(400).json({ error: 'Invalid condition type' });
    }

    // Verify user is owner
    const isOwner = await Client.verifyOwnership(clientId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only owners can create categories' });
    }

    const categoryId = await PageCategory.create(
      clientId,
      name,
      conditionType,
      conditionValue,
      priority || 0
    );

    res.status(201).json({
      message: 'Category created successfully',
      categoryId
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/page-categories/:clientId/:categoryId - Update a category rule
router.put('/:clientId/:categoryId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const categoryId = parseInt(req.params.categoryId);
    const { name, conditionType, conditionValue, priority } = req.body;

    if (isNaN(clientId) || isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    // Validate input
    if (!name || !conditionType || !conditionValue) {
      return res.status(400).json({ error: 'Name, condition type, and condition value are required' });
    }

    const validTypes = ['contains', 'starts_with', 'ends_with', 'equals', 'regex'];
    if (!validTypes.includes(conditionType)) {
      return res.status(400).json({ error: 'Invalid condition type' });
    }

    // Verify user is owner
    const isOwner = await Client.verifyOwnership(clientId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only owners can update categories' });
    }

    const updated = await PageCategory.update(
      categoryId,
      clientId,
      name,
      conditionType,
      conditionValue,
      priority || 0
    );

    if (updated) {
      res.json({ message: 'Category updated successfully' });
    } else {
      res.status(404).json({ error: 'Category not found' });
    }
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/page-categories/:clientId/:categoryId - Delete a category rule
router.delete('/:clientId/:categoryId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const categoryId = parseInt(req.params.categoryId);

    if (isNaN(clientId) || isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    // Verify user is owner
    const isOwner = await Client.verifyOwnership(clientId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only owners can delete categories' });
    }

    const deleted = await PageCategory.delete(categoryId, clientId);

    if (deleted) {
      res.json({ message: 'Category deleted successfully' });
    } else {
      res.status(404).json({ error: 'Category not found' });
    }
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
