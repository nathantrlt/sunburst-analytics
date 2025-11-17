// Cartography Management Module
// This module handles all cartography-related functionality

let cartographies = [];
let currentCartography = null;
let editingCartographyId = null;

// Load all cartographies for the current client
async function loadCartographies() {
    if (!currentClient) {
        cartographies = [];
        return;
    }

    try {
        const data = await apiRequest(`/cartographies/${currentClient.id}`);
        cartographies = data.cartographies || [];

        // If no cartographies exist, create a default one "Cartographie 1"
        if (cartographies.length === 0) {
            await createDefaultCartography();
            // Reload after creating default
            const reloadData = await apiRequest(`/cartographies/${currentClient.id}`);
            cartographies = reloadData.cartographies || [];
        }

        renderCartographiesList();
    } catch (error) {
        console.error('Failed to load cartographies:', error);
        cartographies = [];
    }
}

// Create default cartography with current filters
async function createDefaultCartography() {
    try {
        const defaultFilters = {
            startDate: currentFilters.startDate || null,
            endDate: currentFilters.endDate || null,
            deviceType: currentFilters.deviceType || null,
            trafficSource: currentFilters.trafficSource || null,
            category: currentFilters.category || null,
            depth: currentFilters.depth || 5,
            viewMode: currentFilters.viewMode || 'category'
        };

        await apiRequest(`/cartographies/${currentClient.id}`, {
            method: 'POST',
            body: JSON.stringify({
                name: 'Cartographie 1',
                description: 'Cartographie par défaut',
                filters: defaultFilters
            })
        });

        console.log('Default cartography "Cartographie 1" created');
    } catch (error) {
        console.error('Failed to create default cartography:', error);
    }
}

// Render cartographies dropdown list
function renderCartographiesList() {
    const buttonText = document.getElementById('selectedCartographyText');
    const dropdown = document.getElementById('cartographySelectDropdown');
    const optionsContainer = dropdown.querySelector('.custom-select-options');

    // Update button text - select first cartography by default if exists
    if (currentCartography) {
        buttonText.textContent = currentCartography.name;
    } else if (cartographies.length > 0) {
        // Auto-select first cartography
        selectCartography(cartographies[0].id);
        return; // Exit and let the selection re-render
    } else {
        buttonText.textContent = 'Aucune cartographie';
    }

    // Build options
    let optionsHTML = '';

    cartographies.forEach(carto => {
        const isSelected = currentCartography && currentCartography.id === carto.id;
        optionsHTML += `
            <div class="custom-option ${isSelected ? 'selected' : ''}" data-carto-id="${carto.id}">
                <div class="option-name">${carto.name}</div>
                ${carto.description ? `<div class="option-url" style="font-size: 12px;">${carto.description}</div>` : ''}
                <button class="edit-carto-btn" data-carto-id="${carto.id}" style="margin-left: auto;">
                    ✏️
                </button>
            </div>
        `;
    });

    optionsContainer.innerHTML = optionsHTML;

    // Add click handlers
    optionsContainer.querySelectorAll('.custom-option').forEach(option => {
        option.addEventListener('click', (e) => {
            // Check if edit button was clicked
            if (e.target.classList.contains('edit-carto-btn')) {
                e.stopPropagation();
                const cartoId = parseInt(e.target.dataset.cartoId);
                openEditCartographyModal(cartoId);
                return;
            }

            const cartoId = parseInt(option.dataset.cartoId);
            selectCartography(cartoId);
            closeCartographyDropdown();
        });
    });
}

// Select a cartography and apply its filters
async function selectCartography(cartoId) {
    const carto = cartographies.find(c => c.id === cartoId);
    if (!carto) return;

    currentCartography = carto;

    // Apply cartography filters
    currentFilters = {
        startDate: carto.filters.startDate || null,
        endDate: carto.filters.endDate || null,
        depth: carto.filters.depth || 5,
        deviceType: carto.filters.deviceType || null,
        trafficSource: carto.filters.trafficSource || null,
        category: carto.filters.category || null,
        viewMode: carto.filters.viewMode || 'category'
    };

    // Update UI
    renderCartographiesList();

    // Update view mode buttons
    if (currentFilters.viewMode === 'url') {
        document.getElementById('viewByUrlBtn').classList.add('active');
        document.getElementById('viewByCategoryBtn').classList.remove('active');
    } else {
        document.getElementById('viewByCategoryBtn').classList.add('active');
        document.getElementById('viewByUrlBtn').classList.remove('active');
    }

    // Reload analytics with new filters
    await loadSunburstData();
}

// Toggle cartography dropdown
function toggleCartographyDropdown() {
    const dropdown = document.getElementById('cartographySelectDropdown');
    const button = document.getElementById('cartographySelectButton');

    if (dropdown.style.display === 'none') {
        dropdown.style.display = 'block';
        button.classList.add('open');
    } else {
        closeCartographyDropdown();
    }
}

// Close cartography dropdown
function closeCartographyDropdown() {
    const dropdown = document.getElementById('cartographySelectDropdown');
    const button = document.getElementById('cartographySelectButton');
    dropdown.style.display = 'none';
    button.classList.remove('open');
}

// Open create cartography modal
function openCreateCartographyModal() {
    editingCartographyId = null;

    // Reset form
    document.getElementById('cartographyForm').reset();
    document.getElementById('cartographyModalTitle').textContent = 'Créer une Cartographie';
    document.getElementById('saveCartographyBtn').querySelector('.btn-text').textContent = 'Créer la Cartographie';
    document.getElementById('deleteCartographyBtn').style.display = 'none';

    // Pre-fill with current filters if any
    document.getElementById('cartoStartDate').value = currentFilters.startDate || '';
    document.getElementById('cartoEndDate').value = currentFilters.endDate || '';
    document.getElementById('cartoDeviceFilter').value = currentFilters.deviceType || '';
    document.getElementById('cartoTrafficSourceFilter').value = currentFilters.trafficSource || '';
    document.getElementById('cartoCategoryFilter').value = currentFilters.category || '';
    document.getElementById('cartoDepthSelect').value = currentFilters.depth || 5;
    document.getElementById('cartoViewMode').value = currentFilters.viewMode || 'category';

    // Load categories for the filter dropdown
    loadCartoCategoryOptions();

    // Show modal
    document.getElementById('cartographyModal').style.display = 'flex';
    document.getElementById('cartographyError').style.display = 'none';
    document.getElementById('cartographySuccess').style.display = 'none';
}

// Open edit cartography modal
async function openEditCartographyModal(cartoId) {
    const carto = cartographies.find(c => c.id === cartoId);
    if (!carto) return;

    editingCartographyId = cartoId;

    // Fill form with cartography data
    document.getElementById('cartographyName').value = carto.name;
    document.getElementById('cartographyDescription').value = carto.description || '';
    document.getElementById('cartoStartDate').value = carto.filters.startDate || '';
    document.getElementById('cartoEndDate').value = carto.filters.endDate || '';
    document.getElementById('cartoDeviceFilter').value = carto.filters.deviceType || '';
    document.getElementById('cartoTrafficSourceFilter').value = carto.filters.trafficSource || '';
    document.getElementById('cartoCategoryFilter').value = carto.filters.category || '';
    document.getElementById('cartoDepthSelect').value = carto.filters.depth || 5;
    document.getElementById('cartoViewMode').value = carto.filters.viewMode || 'category';

    // Update modal title and buttons
    document.getElementById('cartographyModalTitle').textContent = 'Modifier la Cartographie';
    document.getElementById('saveCartographyBtn').querySelector('.btn-text').textContent = 'Mettre à Jour';
    document.getElementById('deleteCartographyBtn').style.display = 'block';

    // Load categories for the filter dropdown
    await loadCartoCategoryOptions();

    // Show modal
    document.getElementById('cartographyModal').style.display = 'flex';
    document.getElementById('cartographyError').style.display = 'none';
    document.getElementById('cartographySuccess').style.display = 'none';

    closeCartographyDropdown();
}

// Load category options for cartography filter
async function loadCartoCategoryOptions() {
    if (!currentClient) return;

    try {
        const data = await apiRequest(`/page-categories/${currentClient.id}`);
        const select = document.getElementById('cartoCategoryFilter');

        // Clear existing options except first
        select.innerHTML = '<option value="">Toutes les catégories</option>';

        // Add category options
        data.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load category options:', error);
    }
}

// Handle cartography form submission
async function handleCartographySubmit(e) {
    e.preventDefault();
    if (!currentClient) return;

    const name = document.getElementById('cartographyName').value.trim();
    const description = document.getElementById('cartographyDescription').value.trim();

    const filters = {
        startDate: document.getElementById('cartoStartDate').value || null,
        endDate: document.getElementById('cartoEndDate').value || null,
        deviceType: document.getElementById('cartoDeviceFilter').value || null,
        trafficSource: document.getElementById('cartoTrafficSourceFilter').value || null,
        category: document.getElementById('cartoCategoryFilter').value || null,
        depth: parseInt(document.getElementById('cartoDepthSelect').value) || 5,
        viewMode: document.getElementById('cartoViewMode').value || 'category'
    };

    document.getElementById('cartographyError').style.display = 'none';
    document.getElementById('cartographySuccess').style.display = 'none';

    try {
        const btn = document.getElementById('saveCartographyBtn');
        btn.querySelector('.btn-text').style.display = 'none';
        btn.querySelector('.btn-loader').style.display = 'inline';
        btn.disabled = true;

        if (editingCartographyId) {
            // Update existing cartography
            await apiRequest(`/cartographies/${currentClient.id}/${editingCartographyId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, description, filters })
            });

            const successDiv = document.getElementById('cartographySuccess');
            successDiv.textContent = 'Cartographie mise à jour avec succès !';
            successDiv.style.display = 'block';
        } else {
            // Create new cartography
            await apiRequest(`/cartographies/${currentClient.id}`, {
                method: 'POST',
                body: JSON.stringify({ name, description, filters })
            });

            const successDiv = document.getElementById('cartographySuccess');
            successDiv.textContent = 'Cartographie créée avec succès !';
            successDiv.style.display = 'block';
        }

        // Reload cartographies
        await loadCartographies();

        // Close modal after a short delay
        setTimeout(() => {
            document.getElementById('cartographyModal').style.display = 'none';
        }, 1500);
    } catch (error) {
        const errorDiv = document.getElementById('cartographyError');
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    } finally {
        const btn = document.getElementById('saveCartographyBtn');
        btn.querySelector('.btn-text').style.display = 'inline';
        btn.querySelector('.btn-loader').style.display = 'none';
        btn.disabled = false;
    }
}

// Handle cartography deletion
async function handleCartographyDelete() {
    if (!currentClient || !editingCartographyId) return;

    if (!confirm('Êtes-vous sûr de vouloir supprimer cette cartographie ?')) {
        return;
    }

    try {
        await apiRequest(`/cartographies/${currentClient.id}/${editingCartographyId}`, {
            method: 'DELETE'
        });

        // Reset if this was the selected cartography
        if (currentCartography && currentCartography.id === editingCartographyId) {
            await selectCartography(null);
        }

        // Reload cartographies
        await loadCartographies();

        // Close modal
        document.getElementById('cartographyModal').style.display = 'none';
    } catch (error) {
        alert('Échec de la suppression de la cartographie : ' + error.message);
    }
}

// Setup cartography event listeners
function setupCartographyEventListeners() {
    // Dropdown toggle
    document.getElementById('cartographySelectButton').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCartographyDropdown();
    });

    // Create button
    document.getElementById('createCartographyBtn').addEventListener('click', openCreateCartographyModal);

    // Edit current cartography button
    document.getElementById('editCurrentCartographyBtn').addEventListener('click', () => {
        if (currentCartography) {
            openEditCartographyModal(currentCartography.id);
        } else {
            alert('Aucune cartographie sélectionnée');
        }
    });

    // Close modal
    document.getElementById('closeCartographyModal').addEventListener('click', () => {
        document.getElementById('cartographyModal').style.display = 'none';
    });

    // Form submit
    document.getElementById('cartographyForm').addEventListener('submit', handleCartographySubmit);

    // Delete button
    document.getElementById('deleteCartographyBtn').addEventListener('click', handleCartographyDelete);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const wrapper = document.querySelector('.cartography-select');
        if (wrapper && !wrapper.contains(e.target)) {
            closeCartographyDropdown();
        }
    });
}

// Export functions for use in main dashboard.js
window.cartographyModule = {
    loadCartographies,
    selectCartography,
    setupCartographyEventListeners
};
