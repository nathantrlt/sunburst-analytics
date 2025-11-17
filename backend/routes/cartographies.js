const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Cartography = require('../models/cartography');
const Client = require('../models/client');

// Get all cartographies for a client
router.get('/:clientId', authMiddleware, async (req, res) => {
    try {
        const { clientId } = req.params;
        const userId = req.user.id;

        // Check if user has access to this client
        const hasAccess = await Client.userHasAccess(userId, clientId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this client' });
        }

        const cartographies = await Cartography.getByClientId(clientId);

        res.json({ cartographies });
    } catch (error) {
        console.error('Error fetching cartographies:', error);
        res.status(500).json({ error: 'Failed to fetch cartographies' });
    }
});

// Get a specific cartography
router.get('/:clientId/:cartographyId', authMiddleware, async (req, res) => {
    try {
        const { clientId, cartographyId } = req.params;
        const userId = req.user.id;

        // Check if user has access to this client
        const hasAccess = await Client.userHasAccess(userId, clientId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this client' });
        }

        const cartography = await Cartography.getById(cartographyId, clientId);

        if (!cartography) {
            return res.status(404).json({ error: 'Cartography not found' });
        }

        res.json({ cartography });
    } catch (error) {
        console.error('Error fetching cartography:', error);
        res.status(500).json({ error: 'Failed to fetch cartography' });
    }
});

// Create a new cartography
router.post('/:clientId', authMiddleware, async (req, res) => {
    try {
        const { clientId } = req.params;
        const userId = req.user.id;
        const { name, description, filters } = req.body;

        // Validate input
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Cartography name is required' });
        }

        if (!filters || typeof filters !== 'object') {
            return res.status(400).json({ error: 'Filters must be a valid object' });
        }

        // Check if user has access (must be owner or editor)
        const accessType = await Client.getUserAccessType(userId, clientId);
        if (!accessType || (accessType !== 'owner' && accessType !== 'editor')) {
            return res.status(403).json({ error: 'Only owners and editors can create cartographies' });
        }

        const cartographyId = await Cartography.create(
            clientId,
            name.trim(),
            description ? description.trim() : null,
            filters
        );

        const cartography = await Cartography.getById(cartographyId, clientId);

        res.status(201).json({
            message: 'Cartography created successfully',
            cartography
        });
    } catch (error) {
        console.error('Error creating cartography:', error);
        res.status(500).json({ error: 'Failed to create cartography' });
    }
});

// Update a cartography
router.put('/:clientId/:cartographyId', authMiddleware, async (req, res) => {
    try {
        const { clientId, cartographyId } = req.params;
        const userId = req.user.id;
        const { name, description, filters } = req.body;

        // Validate input
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Cartography name is required' });
        }

        if (!filters || typeof filters !== 'object') {
            return res.status(400).json({ error: 'Filters must be a valid object' });
        }

        // Check if user has access (must be owner or editor)
        const accessType = await Client.getUserAccessType(userId, clientId);
        if (!accessType || (accessType !== 'owner' && accessType !== 'editor')) {
            return res.status(403).json({ error: 'Only owners and editors can update cartographies' });
        }

        const success = await Cartography.update(
            cartographyId,
            clientId,
            name.trim(),
            description ? description.trim() : null,
            filters
        );

        if (!success) {
            return res.status(404).json({ error: 'Cartography not found' });
        }

        const cartography = await Cartography.getById(cartographyId, clientId);

        res.json({
            message: 'Cartography updated successfully',
            cartography
        });
    } catch (error) {
        console.error('Error updating cartography:', error);
        res.status(500).json({ error: 'Failed to update cartography' });
    }
});

// Delete a cartography
router.delete('/:clientId/:cartographyId', authMiddleware, async (req, res) => {
    try {
        const { clientId, cartographyId } = req.params;
        const userId = req.user.id;

        // Check if user has access (must be owner or editor)
        const accessType = await Client.getUserAccessType(userId, clientId);
        if (!accessType || (accessType !== 'owner' && accessType !== 'editor')) {
            return res.status(403).json({ error: 'Only owners and editors can delete cartographies' });
        }

        const success = await Cartography.delete(cartographyId, clientId);

        if (!success) {
            return res.status(404).json({ error: 'Cartography not found' });
        }

        res.json({ message: 'Cartography deleted successfully' });
    } catch (error) {
        console.error('Error deleting cartography:', error);
        res.status(500).json({ error: 'Failed to delete cartography' });
    }
});

module.exports = router;
