const express = require('express');
const router = express.Router();
const PageCategory = require('../models/pageCategory');
const Client = require('../models/client');
const Collaborator = require('../models/collaborator');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Helper function to check if user is owner or editor
async function isOwnerOrEditor(clientId, userId) {
  const isOwner = await Client.verifyOwnership(clientId, userId);
  if (isOwner) return true;

  const role = await Collaborator.getRole(clientId, userId);
  return role === 'editor';
}

// GET /api/page-categories/:clientId - Get all category rules for a client
router.get('/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    // Verify user is owner or editor
    const canManage = await isOwnerOrEditor(clientId, req.user.userId);
    if (!canManage) {
      return res.status(403).json({ error: 'Only owners and editors can manage categories' });
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
    const { name, conditionType, conditionValue, priority, conditionPeriodDays, conditionsJson } = req.body;

    console.log('Create category request:', { name, conditionType, conditionValue, priority, conditionsJson });

    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }

    // Validate input
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Either conditionsJson or (conditionType + conditionValue) must be provided
    if (!conditionsJson && (!conditionType || !conditionValue)) {
      console.log('Validation failed: missing conditions');
      return res.status(400).json({ error: 'Either conditionsJson or (conditionType and conditionValue) are required' });
    }

    // Validate conditionsJson structure if provided
    if (conditionsJson) {
      if (!conditionsJson.operator || !conditionsJson.conditions || !Array.isArray(conditionsJson.conditions)) {
        console.log('Invalid conditionsJson structure:', conditionsJson);
        return res.status(400).json({ error: 'Invalid conditionsJson structure' });
      }
      if (conditionsJson.conditions.length === 0) {
        console.log('conditionsJson has no conditions');
        return res.status(400).json({ error: 'At least one condition is required' });
      }
    }

    // If using legacy single condition, validate condition type
    if (conditionType) {
      const validTypes = [
        'contains', 'not_contains', 'starts_with', 'ends_with', 'equals', 'regex',
        'pageviews_greater_than', 'pageviews_less_than',
        'avg_position_greater_than', 'avg_position_less_than',
        'avg_time_greater_than', 'avg_time_less_than'
      ];
      if (!validTypes.includes(conditionType)) {
        return res.status(400).json({ error: 'Invalid condition type' });
      }
    }

    // Verify user is owner or editor
    const canManage = await isOwnerOrEditor(clientId, req.user.userId);
    if (!canManage) {
      return res.status(403).json({ error: 'Only owners and editors can create categories' });
    }

    const categoryId = await PageCategory.create(
      clientId,
      name,
      conditionType || null,
      conditionValue || null,
      priority || 0,
      conditionPeriodDays || null,
      conditionsJson || null
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
    const { name, conditionType, conditionValue, priority, conditionPeriodDays, conditionsJson } = req.body;

    console.log('Update category request:', { categoryId, name, conditionType, conditionValue, priority, conditionsJson });

    if (isNaN(clientId) || isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    // Validate input
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Either conditionsJson or (conditionType + conditionValue) must be provided
    if (!conditionsJson && (!conditionType || !conditionValue)) {
      console.log('Validation failed: missing conditions');
      return res.status(400).json({ error: 'Either conditionsJson or (conditionType and conditionValue) are required' });
    }

    // Validate conditionsJson structure if provided
    if (conditionsJson) {
      if (!conditionsJson.operator || !conditionsJson.conditions || !Array.isArray(conditionsJson.conditions)) {
        console.log('Invalid conditionsJson structure:', conditionsJson);
        return res.status(400).json({ error: 'Invalid conditionsJson structure' });
      }
      if (conditionsJson.conditions.length === 0) {
        console.log('conditionsJson has no conditions');
        return res.status(400).json({ error: 'At least one condition is required' });
      }
    }

    // If using legacy single condition, validate condition type
    if (conditionType) {
      const validTypes = [
        'contains', 'not_contains', 'starts_with', 'ends_with', 'equals', 'regex',
        'pageviews_greater_than', 'pageviews_less_than',
        'avg_position_greater_than', 'avg_position_less_than',
        'avg_time_greater_than', 'avg_time_less_than'
      ];
      if (!validTypes.includes(conditionType)) {
        return res.status(400).json({ error: 'Invalid condition type' });
      }
    }

    // Verify user is owner or editor
    const canManage = await isOwnerOrEditor(clientId, req.user.userId);
    if (!canManage) {
      return res.status(403).json({ error: 'Only owners and editors can update categories' });
    }

    const updated = await PageCategory.update(
      categoryId,
      clientId,
      name,
      conditionType || null,
      conditionValue || null,
      priority || 0,
      conditionPeriodDays || null,
      conditionsJson || null
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

    // Verify user is owner or editor
    const canManage = await isOwnerOrEditor(clientId, req.user.userId);
    if (!canManage) {
      return res.status(403).json({ error: 'Only owners and editors can delete categories' });
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
