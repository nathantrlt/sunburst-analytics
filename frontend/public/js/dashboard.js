// API Configuration
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : 'https://sunburst-analytics-production.up.railway.app/api';

// Global state
let currentClient = null;
let clients = [];
let currentPage = 1;
let itemsPerPage = 10;
let pagesData = [];
let editingCategoryId = null; // Track category being edited
let currentFilters = {
    startDate: null,
    endDate: null,
    depth: 5,
    deviceType: null,
    trafficSource: null,
    category: null,
    viewMode: 'category' // 'url' or 'category' - default to category
};

// Authentication
function getToken() {
    return localStorage.getItem('token');
}

function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

// API Helper
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
        throw new Error('Unauthorized');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// Initialize Dashboard
async function initDashboard() {
    if (!checkAuth()) return;

    // Load user info
    loadUserInfo();

    // Load clients
    await loadClients();

    // Setup event listeners
    setupEventListeners();
}

// Load user info
function loadUserInfo() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.name || 'Utilisateur';
}

// Load clients list
async function loadClients() {
    try {
        const data = await apiRequest('/clients');
        clients = data.clients;
        renderClientsList();
    } catch (error) {
        console.error('Failed to load clients:', error);
    }
}

// Render clients list
function renderClientsList() {
    const buttonText = document.getElementById('selectedClientText');
    const dropdown = document.getElementById('clientSelectDropdown');
    const optionsContainer = dropdown.querySelector('.custom-select-options');

    // Update button text
    if (currentClient) {
        buttonText.textContent = currentClient.site_name;
    } else {
        buttonText.textContent = clients.length === 0 ? 'Aucun site disponible' : '-- Sélectionner un site --';
    }

    // Build options
    let optionsHTML = '';

    if (clients.length === 0) {
        optionsHTML = '<div class="custom-option disabled">Aucun site disponible</div>';
    } else {
        optionsHTML = '<div class="custom-option placeholder">-- Sélectionner un site --</div>';
        optionsHTML += clients.map(client =>
            `<div class="custom-option ${currentClient && currentClient.id === client.id ? 'selected' : ''}" data-client-id="${client.id}">
                <div class="option-name">${client.site_name}</div>
                <div class="option-url">${new URL(client.site_url).hostname}</div>
            </div>`
        ).join('');
    }

    optionsHTML += '<div class="custom-option add-new" data-action="add-new">+ Ajouter un Nouveau Site</div>';

    optionsContainer.innerHTML = optionsHTML;

    // Add click handlers to options
    optionsContainer.querySelectorAll('.custom-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();

            if (option.classList.contains('disabled') || option.classList.contains('placeholder')) {
                return;
            }

            if (option.dataset.action === 'add-new') {
                showAddClientModal();
                closeCustomDropdown();
            } else if (option.dataset.clientId) {
                selectClient(parseInt(option.dataset.clientId));
                closeCustomDropdown();
            }
        });
    });
}

// Toggle custom dropdown
function toggleCustomDropdown() {
    const dropdown = document.getElementById('clientSelectDropdown');
    const button = document.getElementById('clientSelectButton');

    if (dropdown.style.display === 'none') {
        dropdown.style.display = 'block';
        button.classList.add('open');
    } else {
        closeCustomDropdown();
    }
}

// Close custom dropdown
function closeCustomDropdown() {
    const dropdown = document.getElementById('clientSelectDropdown');
    const button = document.getElementById('clientSelectButton');
    dropdown.style.display = 'none';
    button.classList.remove('open');
}

// Select a client
async function selectClient(clientId) {
    currentClient = clients.find(c => c.id === clientId);
    if (!currentClient) return;

    // Update UI
    renderClientsList();
    document.getElementById('welcomeMessage').style.display = 'none';
    document.getElementById('dashboardContent').style.display = 'block';

    // Update site info
    document.getElementById('siteName').textContent = currentClient.site_name;
    document.getElementById('siteUrl').textContent = currentClient.site_url;

    // Show/hide management buttons based on access type
    const isOwner = currentClient.access_type === 'owner';
    const isEditor = currentClient.access_type === 'editor';
    const canManageCategories = isOwner || isEditor;

    document.getElementById('viewSnippetBtn').style.display = 'inline-block'; // Always visible
    document.getElementById('manageCategoriesBtn').style.display = canManageCategories ? 'inline-block' : 'none';
    document.getElementById('manageCollaboratorsBtn').style.display = isOwner ? 'inline-block' : 'none';
    document.getElementById('deleteSiteBtn').style.display = isOwner ? 'inline-block' : 'none';

    // Load cartographies
    await window.cartographyModule.loadCartographies();

    // Load category filter options and analytics data
    await loadCategoryFilterOptions();
    await loadAnalytics();
}

// Load analytics data
async function loadAnalytics() {
    if (!currentClient) return;

    await Promise.all([
        loadStats(),
        loadSunburstData(),
        loadPagesData(),
        loadCategoryStats(),
        loadCategoryDistribution()
    ]);
}

// Build query parameters with filters
function buildFilterParams() {
    const params = new URLSearchParams();
    if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
    if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
    if (currentFilters.deviceType) params.append('deviceType', currentFilters.deviceType);
    if (currentFilters.trafficSource) params.append('trafficSource', currentFilters.trafficSource);
    if (currentFilters.category) params.append('category', currentFilters.category);
    return params;
}

// Build filter params for sunburst (includes depth and viewMode)
function buildSunburstParams() {
    const params = buildFilterParams();
    params.append('depth', currentFilters.depth);
    params.append('viewMode', currentFilters.viewMode);
    return params;
}

// Load categories for filter dropdown
async function loadCategoryFilterOptions() {
    if (!currentClient) return;

    try {
        const data = await apiRequest(`/page-categories/${currentClient.id}`);
        const select = document.getElementById('categoryFilter');

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
        console.error('Failed to load category filter options:', error);
    }
}

// Load statistics
async function loadStats() {
    try {
        const params = buildFilterParams();

        const data = await apiRequest(`/analytics/stats/${currentClient.id}?${params}`);
        const stats = data.stats;

        document.getElementById('statPageviews').textContent = stats.totalPageviews.toLocaleString();
        document.getElementById('statUsers').textContent = stats.uniqueUsers.toLocaleString();
        document.getElementById('statAvgPages').textContent = stats.avgPagesPerSession;
        document.getElementById('statAvgTime').textContent = stats.avgTimeSpent;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load sunburst data
async function loadSunburstData() {
    try {
        document.getElementById('sunburstLoading').style.display = 'block';
        document.getElementById('sunburstChart').innerHTML = '';
        document.getElementById('sunburstEmpty').style.display = 'none';

        const params = buildSunburstParams();

        const data = await apiRequest(`/analytics/sunburst/${currentClient.id}?${params}`);

        document.getElementById('sunburstLoading').style.display = 'none';

        if (!data.data || !data.data.children || data.data.children.length === 0) {
            document.getElementById('sunburstEmpty').style.display = 'block';
            return;
        }

        // Render sunburst (function from sunburst.js)
        if (window.createSunburst) {
            window.createSunburst(data.data);
        }
    } catch (error) {
        console.error('Failed to load sunburst data:', error);
        document.getElementById('sunburstLoading').style.display = 'none';
        document.getElementById('sunburstEmpty').style.display = 'block';
    }
}

// Load pages data
async function loadPagesData() {
    try {
        const params = buildFilterParams();

        const data = await apiRequest(`/analytics/page-positions/${currentClient.id}?${params}`);
        pagesData = data.pages;
        currentPage = 1;
        renderPagesTable();
    } catch (error) {
        console.error('Failed to load pages:', error);
    }
}

// Render pages table
function renderPagesTable() {
    const tbody = document.getElementById('pagesTableBody');

    if (pagesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Aucune donnée de page disponible pour le moment.</td></tr>';
        document.getElementById('paginationControls').style.display = 'none';
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = pagesData.slice(start, end);

    tbody.innerHTML = pageItems.map(page => `
        <tr>
            <td class="url-cell" title="${page.url}">${truncate(page.url, 50)}</td>
            <td>${page.title || '-'}</td>
            <td>${page.totalViews.toLocaleString()}</td>
            <td>${page.avgPosition}</td>
            <td>${page.avgTimeSpent}s</td>
        </tr>
    `).join('');

    // Update pagination
    const totalPages = Math.ceil(pagesData.length / itemsPerPage);
    if (totalPages > 1) {
        document.getElementById('paginationControls').style.display = 'flex';
        document.getElementById('pageInfo').textContent = `Page ${currentPage} sur ${totalPages}`;
        document.getElementById('prevPageBtn').disabled = currentPage === 1;
        document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
    } else {
        document.getElementById('paginationControls').style.display = 'none';
    }
}

// Helper function to truncate text
function truncate(str, length) {
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
}

// Load category statistics
async function loadCategoryStats() {
    if (!currentClient) return;

    try {
        const params = buildFilterParams();

        const data = await apiRequest(`/analytics/category-stats/${currentClient.id}?${params}`);
        renderCategoryStats(data.categories);
    } catch (error) {
        console.error('Failed to load category stats:', error);
        document.getElementById('categoryStatsContainer').innerHTML = '<p class="empty-state">Échec du chargement des catégories</p>';
    }
}

// Render category statistics
function renderCategoryStats(categories) {
    const container = document.getElementById('categoryStatsContainer');

    if (categories.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucune catégorie configurée pour le moment. Cliquez sur "Gérer les Catégories" pour ajouter des règles.</p>';
        return;
    }

    container.innerHTML = categories.map(cat => {
        // All categories are clickable now, including Non catégorisé
        const categoryId = cat.id !== null ? cat.id : 'uncategorized';
        return `
            <div class="category-stat-card clickable"
                 data-category-id="${categoryId}"
                 style="cursor: pointer;">
                <div class="category-name">${cat.category}</div>
                <div class="category-count">${cat.count.toLocaleString()} vues</div>
            </div>
        `;
    }).join('');

    // Add click handlers for all categories
    document.querySelectorAll('.category-stat-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            const categoryId = card.dataset.categoryId;
            showCategoryDetails(categoryId);
        });
    });
}

// Load category distribution bars
async function loadCategoryDistribution() {
    if (!currentClient) return;

    try {
        const params = buildFilterParams();
        const data = await apiRequest(`/analytics/category-distribution/${currentClient.id}?${params}`);

        renderCategoryDistributionBars(data);
    } catch (error) {
        console.error('Failed to load category distribution:', error);
        document.getElementById('pagesCategoryBar').innerHTML = '<div class="bar-loading">Échec du chargement</div>';
        document.getElementById('viewsCategoryBar').innerHTML = '<div class="bar-loading">Échec du chargement</div>';
    }
}

// Render category distribution bars
function renderCategoryDistributionBars(data) {
    const { pagesByCategory, viewsByCategory } = data;

    // Generate color palette
    const colors = generateCategoryColors(
        [...new Set([...pagesByCategory.map(c => c.category), ...viewsByCategory.map(c => c.category)])]
    );

    // Render pages distribution bar
    renderDistributionBar('pagesCategoryBar', 'pagesCategoryLegend', pagesByCategory, colors, 'pages');

    // Render views distribution bar
    renderDistributionBar('viewsCategoryBar', 'viewsCategoryLegend', viewsByCategory, colors, 'vues');
}

// Global color palette for categories (consistent across all views)
const CATEGORY_COLOR_PALETTE = [
    '#3b82f6', // 1. Bleu
    '#10b981', // 2. Vert
    '#f59e0b', // 3. Orange
    '#ef4444', // 4. Rouge
    '#8b5cf6', // 5. Violet
    '#ec4899', // 6. Rose/Magenta
    '#06b6d4', // 7. Cyan
    '#84cc16', // 8. Vert citron
    '#6366f1', // 9. Indigo
    '#eab308', // 10. Jaune
    '#14b8a6', // 11. Teal/Turquoise
    '#f97316', // 12. Orange foncé
    '#fb7185', // 13. Rose saumon
    '#3730a3', // 14. Bleu marine
    '#059669', // 15. Vert émeraude
];

// Get color for a specific category (deterministic based on category name)
function getCategoryColor(categoryName) {
    if (categoryName === 'Non catégorisé') {
        return '#6b7280'; // gray for uncategorized
    }

    // Generate a deterministic hash from category name
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
        hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Use hash to pick a color from palette
    const index = Math.abs(hash) % CATEGORY_COLOR_PALETTE.length;
    return CATEGORY_COLOR_PALETTE[index];
}

// Generate consistent colors for categories
function generateCategoryColors(categories) {
    const colors = {};
    categories.forEach(category => {
        colors[category] = getCategoryColor(category);
    });
    return colors;
}

// Export for use in sunburst
window.getCategoryColor = getCategoryColor;

// Render a single distribution bar
function renderDistributionBar(barId, legendId, distribution, colors, unit) {
    const barElement = document.getElementById(barId);
    const legendElement = document.getElementById(legendId);

    if (distribution.length === 0) {
        barElement.innerHTML = '<div class="bar-loading">Aucune donnée</div>';
        legendElement.innerHTML = '';
        return;
    }

    // Render bar segments
    barElement.innerHTML = distribution.map((item, index) => {
        const percentage = parseFloat(item.percentage);
        if (percentage < 1) return ''; // Don't show segments < 1%

        const color = colors[item.category];
        return `
            <div class="category-bar-segment"
                 data-segment-index="${index}"
                 style="width: ${percentage}%; background-color: ${color};">
                <span>${percentage >= 5 ? `${percentage}%` : ''}</span>
            </div>
        `;
    }).join('');

    // Add hover tooltips
    const segments = barElement.querySelectorAll('.category-bar-segment');
    segments.forEach((segment, index) => {
        const item = distribution[index];
        if (!item) return;

        segment.addEventListener('mouseenter', (e) => {
            showCategoryTooltip(e, item.category, item.count, unit, item.percentage);
        });

        segment.addEventListener('mousemove', (e) => {
            updateCategoryTooltipPosition(e);
        });

        segment.addEventListener('mouseleave', () => {
            hideCategoryTooltip();
        });
    });

    // Render legend
    legendElement.innerHTML = distribution.map(item => {
        const color = colors[item.category];
        return `
            <div class="category-legend-item">
                <div class="category-legend-color" style="background-color: ${color};"></div>
                <span class="category-legend-label">${item.category}:</span>
                <span class="category-legend-value">${item.count} ${unit} (${item.percentage}%)</span>
            </div>
        `;
    }).join('');
}

// Category bar tooltip functions
let categoryTooltip = null;

function showCategoryTooltip(event, categoryName, count, unit, percentage) {
    // Create tooltip if it doesn't exist
    if (!categoryTooltip) {
        categoryTooltip = document.createElement('div');
        categoryTooltip.className = 'category-bar-tooltip';
        document.body.appendChild(categoryTooltip);
    }

    // Set content
    categoryTooltip.innerHTML = `
        <div class="tooltip-category-name">${categoryName}</div>
        <div class="tooltip-category-info">${count} ${unit} (${percentage}%)</div>
    `;

    // Position and show
    categoryTooltip.style.display = 'block';
    updateCategoryTooltipPosition(event);
}

function updateCategoryTooltipPosition(event) {
    if (!categoryTooltip) return;

    const offset = 10;
    let left = event.clientX + offset;
    let top = event.clientY + offset;

    // Adjust if tooltip goes off screen
    const tooltipRect = categoryTooltip.getBoundingClientRect();
    if (left + tooltipRect.width > window.innerWidth) {
        left = event.clientX - tooltipRect.width - offset;
    }
    if (top + tooltipRect.height > window.innerHeight) {
        top = event.clientY - tooltipRect.height - offset;
    }

    categoryTooltip.style.left = left + 'px';
    categoryTooltip.style.top = top + 'px';
}

function hideCategoryTooltip() {
    if (categoryTooltip) {
        categoryTooltip.style.display = 'none';
    }
}

// Load categories for management modal
async function loadCategories() {
    if (!currentClient) return;

    try {
        const data = await apiRequest(`/page-categories/${currentClient.id}`);
        renderCategoriesList(data.categories);
    } catch (error) {
        console.error('Failed to load categories:', error);
        document.getElementById('categoriesList').innerHTML =
            '<p class="empty-state">Échec du chargement des catégories</p>';
    }
}

// Render categories list in modal
function renderCategoriesList(categories) {
    const container = document.getElementById('categoriesList');

    if (categories.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucune règle de catégorie pour le moment.</p>';
        return;
    }

    container.innerHTML = categories.map(cat => {
        let ruleDisplay = '';

        // Check if it's a multi-condition category
        if (cat.conditions_json) {
            const conditions = typeof cat.conditions_json === 'string'
                ? JSON.parse(cat.conditions_json)
                : cat.conditions_json;

            const operator = conditions.operator === 'AND' ? 'ET' : 'OU';
            const conditionsCount = conditions.conditions ? conditions.conditions.length : 0;
            ruleDisplay = `${conditionsCount} conditions (${operator})`;
        } else {
            // Legacy single condition
            const conditionLabel = {
                'contains': 'URL contient',
                'not_contains': 'URL ne contient pas',
                'starts_with': 'URL commence par',
                'ends_with': 'URL se termine par',
                'equals': 'URL est égale à',
                'regex': 'Expression régulière',
                'pageviews_greater_than': 'Nb vues >',
                'pageviews_less_than': 'Nb vues <',
                'avg_position_greater_than': 'Position moy. >',
                'avg_position_less_than': 'Position moy. <',
                'avg_time_greater_than': 'Temps moy. >',
                'avg_time_less_than': 'Temps moy. <'
            }[cat.condition_type] || cat.condition_type;

            const periodInfo = cat.condition_period_days
                ? ` (${cat.condition_period_days} jours)`
                : '';

            ruleDisplay = `${conditionLabel} : "${cat.condition_value}"${periodInfo}`;
        }

        return `
            <div class="category-item" data-category-id="${cat.id}">
                <div class="category-info">
                    <strong>${cat.name}</strong>
                    <span class="category-rule">${ruleDisplay}</span>
                    <span class="category-priority">Priorité : ${cat.priority}</span>
                </div>
                <div class="category-actions">
                    <button class="btn btn-secondary btn-small edit-category-btn" data-category-id="${cat.id}">
                        Modifier
                    </button>
                    <button class="btn btn-danger btn-small remove-category-btn" data-category-id="${cat.id}">
                        Retirer
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers for edit buttons
    document.querySelectorAll('.edit-category-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const categoryId = parseInt(btn.dataset.categoryId);
            const category = categories.find(c => c.id === categoryId);
            if (category) {
                populateCategoryForm(category);
            }
        });
    });

    // Add click handlers for remove buttons
    document.querySelectorAll('.remove-category-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const categoryId = parseInt(btn.dataset.categoryId);
            await handleRemoveCategory(categoryId);
        });
    });
}

// Populate category form for editing
function populateCategoryForm(category) {
    editingCategoryId = category.id;

    // Fill common fields
    document.getElementById('categoryName').value = category.name;
    document.getElementById('categoryPriority').value = category.priority;

    // Check if this category uses multi-conditions
    if (category.conditions_json) {
        // Parse conditions
        const conditions = typeof category.conditions_json === 'string'
            ? JSON.parse(category.conditions_json)
            : category.conditions_json;

        // Enable advanced mode
        document.getElementById('advancedConditionsToggle').checked = true;
        toggleAdvancedConditions(true);

        // Set operator
        document.getElementById('multiConditionOperator').value = conditions.operator || 'AND';

        // Clear existing conditions
        document.getElementById('multiConditionsList').innerHTML = '';

        // Add each condition
        if (conditions.conditions && Array.isArray(conditions.conditions)) {
            conditions.conditions.forEach(condition => {
                addConditionRow();
                const lastItem = document.getElementById('multiConditionsList').lastElementChild;
                lastItem.querySelector('.condition-type').value = condition.type;
                lastItem.querySelector('.condition-value').value = condition.value;

                // Set period if it exists
                if (condition.period_days) {
                    const periodInput = lastItem.querySelector('.condition-period');
                    if (periodInput) {
                        periodInput.value = condition.period_days;
                    }
                }
            });
        }
    } else {
        // Legacy single condition
        document.getElementById('conditionType').value = category.condition_type || '';
        document.getElementById('conditionValue').value = category.condition_value || '';

        if (category.condition_period_days) {
            document.getElementById('conditionPeriod').value = category.condition_period_days;
        } else {
            document.getElementById('conditionPeriod').value = '';
        }

        // Make sure advanced mode is off
        document.getElementById('advancedConditionsToggle').checked = false;
        toggleAdvancedConditions(false);

        // Update form based on condition type
        updateConditionForm();
    }

    // Change form title and button text
    document.querySelector('.add-category-section h3').textContent = 'Modifier la Règle de Catégorie';
    document.querySelector('#addCategoryBtn .btn-text').textContent = 'Mettre à Jour';

    // Scroll to form
    document.querySelector('.add-category-section').scrollIntoView({ behavior: 'smooth' });
}

// Reset category form to add mode
function resetCategoryForm() {
    editingCategoryId = null;
    document.getElementById('addCategoryForm').reset();
    document.querySelector('.add-category-section h3').textContent = 'Ajouter une Règle de Catégorie';
    document.querySelector('#addCategoryBtn .btn-text').textContent = 'Ajouter la Règle de Catégorie';
    document.getElementById('categoryError').style.display = 'none';
    document.getElementById('categorySuccess').style.display = 'none';

    // Reset advanced conditions
    document.getElementById('advancedConditionsToggle').checked = false;
    document.getElementById('multiConditionsList').innerHTML = '';
    toggleAdvancedConditions(false);
}

// Update form based on condition type
function updateConditionForm() {
    const conditionType = document.getElementById('conditionType').value;
    const periodGroup = document.getElementById('periodGroup');
    const conditionValueLabel = document.getElementById('conditionValueLabel');
    const conditionValueInput = document.getElementById('conditionValue');
    const conditionValueHint = document.getElementById('conditionValueHint');

    const isMetricBased = [
        'pageviews_greater_than', 'pageviews_less_than',
        'avg_position_greater_than', 'avg_position_less_than',
        'avg_time_greater_than', 'avg_time_less_than'
    ].includes(conditionType);

    if (isMetricBased) {
        periodGroup.style.display = 'block';
        conditionValueLabel.textContent = 'Valeur Seuil';
        conditionValueInput.type = 'number';
        conditionValueInput.placeholder = '100';
        conditionValueInput.step = conditionType.includes('avg_position') ? '0.1' : '1';

        if (conditionType.includes('pageviews')) {
            conditionValueHint.textContent = 'Exemple : 100 pour filtrer les pages avec plus/moins de 100 vues';
        } else if (conditionType.includes('avg_position')) {
            conditionValueHint.textContent = 'Exemple : 3.5 pour filtrer les pages en position moyenne > ou < 3.5';
        } else if (conditionType.includes('avg_time')) {
            conditionValueHint.textContent = 'Exemple : 60 pour filtrer les pages avec plus/moins de 60 secondes passées';
        }
    } else {
        periodGroup.style.display = 'none';
        conditionValueLabel.textContent = 'Valeur de la Condition';
        conditionValueInput.type = 'text';
        conditionValueInput.placeholder = '/produit';
        conditionValueInput.step = '';
        conditionValueHint.textContent = 'Exemple : Si l\'URL contient "/produit" → Catégorie = "Article"';
    }
}

// Build conditionsJson from multi-condition UI
function buildConditionsJson() {
    const operator = document.getElementById('multiConditionOperator').value;
    const conditionItems = document.querySelectorAll('.condition-item');

    const conditions = [];
    conditionItems.forEach(item => {
        const type = item.querySelector('.condition-type').value;
        const value = item.querySelector('.condition-value').value.trim();
        const periodInput = item.querySelector('.condition-period');

        const condition = { type, value };
        if (periodInput && periodInput.value) {
            condition.period_days = parseInt(periodInput.value);
        }

        conditions.push(condition);
    });

    return {
        operator,
        conditions
    };
}

// Add a new condition to the multi-condition list
function addConditionRow() {
    const container = document.getElementById('multiConditionsList');
    const index = container.children.length;

    const conditionHtml = `
        <div class="condition-item">
            <div class="form-group">
                <label>Type</label>
                <select class="condition-type" required>
                    <optgroup label="Basé sur l'URL">
                        <option value="contains">L'URL contient</option>
                        <option value="not_contains">L'URL ne contient pas</option>
                        <option value="starts_with">L'URL commence par</option>
                        <option value="ends_with">L'URL se termine par</option>
                        <option value="equals">L'URL est égale à</option>
                        <option value="regex">Expression régulière</option>
                    </optgroup>
                    <optgroup label="Basé sur les Métriques">
                        <option value="pageviews_greater_than">Nombre de vues > que</option>
                        <option value="pageviews_less_than">Nombre de vues < que</option>
                        <option value="avg_position_greater_than">Position moyenne > que</option>
                        <option value="avg_position_less_than">Position moyenne < que</option>
                        <option value="avg_time_greater_than">Temps moyen > que (secondes)</option>
                        <option value="avg_time_less_than">Temps moyen < que (secondes)</option>
                    </optgroup>
                </select>
            </div>
            <div class="form-group">
                <label>Valeur</label>
                <input type="text" class="condition-value" required placeholder="/produit">
            </div>
            <button type="button" class="btn btn-danger btn-small remove-condition-btn">✕</button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', conditionHtml);

    // Add event listener to remove button
    const removeBtn = container.lastElementChild.querySelector('.remove-condition-btn');
    removeBtn.addEventListener('click', () => {
        container.removeChild(container.lastElementChild);
    });
}

// Toggle advanced conditions mode
function toggleAdvancedConditions(enabled) {
    const simpleSection = document.querySelectorAll('#conditionType, #conditionValue, #periodGroup');
    const advancedSection = document.getElementById('advancedConditionsSection');

    if (enabled) {
        // Hide simple mode fields
        simpleSection.forEach(el => {
            if (el) el.closest('.form-group').style.display = 'none';
        });
        // Show advanced mode
        advancedSection.style.display = 'block';

        // If there's an existing simple condition, convert it to advanced mode
        const conditionType = document.getElementById('conditionType').value;
        const conditionValue = document.getElementById('conditionValue').value.trim();

        if (document.getElementById('multiConditionsList').children.length === 0) {
            // If we have a simple condition filled, convert it
            if (conditionType && conditionValue) {
                addConditionRow();
                const lastCondition = document.getElementById('multiConditionsList').lastElementChild;
                lastCondition.querySelector('.condition-type').value = conditionType;
                lastCondition.querySelector('.condition-value').value = conditionValue;
            } else {
                // Otherwise add empty condition
                addConditionRow();
            }
        }
    } else {
        // Show simple mode fields
        simpleSection.forEach(el => {
            if (el) el.closest('.form-group').style.display = 'block';
        });
        // Hide advanced mode
        advancedSection.style.display = 'none';
    }
}

// Handle add category
async function handleAddCategory(e) {
    e.preventDefault();
    if (!currentClient) return;

    const name = document.getElementById('categoryName').value.trim();
    const priority = parseInt(document.getElementById('categoryPriority').value) || 0;

    document.getElementById('categoryError').style.display = 'none';
    document.getElementById('categorySuccess').style.display = 'none';

    try {
        const btn = document.getElementById('addCategoryBtn');
        btn.querySelector('.btn-text').style.display = 'none';
        btn.querySelector('.btn-loader').style.display = 'inline';
        btn.disabled = true;

        // Check if advanced mode is enabled
        const isAdvancedMode = document.getElementById('advancedConditionsToggle').checked;

        let requestBody;
        if (isAdvancedMode) {
            // Build conditionsJson from multi-condition list
            const conditionsJson = buildConditionsJson();
            console.log('Built conditionsJson:', conditionsJson);

            // Validate that we have at least one condition with values
            if (!conditionsJson.conditions || conditionsJson.conditions.length === 0) {
                throw new Error('Veuillez ajouter au moins une condition');
            }

            // Check that all conditions have values
            const emptyConditions = conditionsJson.conditions.filter(c => !c.value);
            if (emptyConditions.length > 0) {
                throw new Error('Toutes les conditions doivent avoir une valeur');
            }

            requestBody = {
                name,
                priority,
                conditionsJson
            };
        } else {
            // Use legacy single condition
            const conditionType = document.getElementById('conditionType').value;
            const conditionValue = document.getElementById('conditionValue').value.trim();
            const conditionPeriodDays = document.getElementById('conditionPeriod').value
                ? parseInt(document.getElementById('conditionPeriod').value)
                : null;

            requestBody = {
                name,
                conditionType,
                conditionValue,
                priority,
                conditionPeriodDays
            };
        }

        if (editingCategoryId) {
            // Update existing category
            await apiRequest(`/page-categories/${currentClient.id}/${editingCategoryId}`, {
                method: 'PUT',
                body: JSON.stringify(requestBody)
            });

            // Show success
            const successDiv = document.getElementById('categorySuccess');
            successDiv.textContent = 'Catégorie mise à jour avec succès !';
            successDiv.style.display = 'block';
        } else {
            // Add new category
            await apiRequest(`/page-categories/${currentClient.id}`, {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });

            // Show success
            const successDiv = document.getElementById('categorySuccess');
            successDiv.textContent = 'Catégorie ajoutée avec succès !';
            successDiv.style.display = 'block';
        }

        // Reset form
        resetCategoryForm();

        // Reload categories
        await loadCategories();
        await loadCategoryStats();
        await loadCategoryDistribution();
        await loadCategoryFilterOptions();
    } catch (error) {
        const errorDiv = document.getElementById('categoryError');
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    } finally {
        const btn = document.getElementById('addCategoryBtn');
        btn.querySelector('.btn-text').style.display = 'inline';
        btn.querySelector('.btn-loader').style.display = 'none';
        btn.disabled = false;
    }
}

// Handle remove category
async function handleRemoveCategory(categoryId) {
    if (!currentClient) return;

    if (!confirm('Êtes-vous sûr de vouloir retirer cette règle de catégorie ?')) {
        return;
    }

    try {
        await apiRequest(`/page-categories/${currentClient.id}/${categoryId}`, {
            method: 'DELETE'
        });

        // Reload categories
        await loadCategories();
        await loadCategoryStats();
        await loadCategoryDistribution();
    } catch (error) {
        alert('Échec de la suppression de la catégorie : ' + error.message);
    }
}

// Load collaborators for current client
async function loadCollaborators() {
    if (!currentClient) return;

    try {
        const data = await apiRequest(`/collaborators/${currentClient.id}`);
        renderCollaboratorsList(data.collaborators);
    } catch (error) {
        console.error('Failed to load collaborators:', error);
        document.getElementById('collaboratorsList').innerHTML =
            '<p class="empty-state">Échec du chargement des collaborateurs</p>';
    }
}

// Render collaborators list
function renderCollaboratorsList(collaborators) {
    const container = document.getElementById('collaboratorsList');

    if (collaborators.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucun collaborateur pour le moment.</p>';
        return;
    }

    container.innerHTML = collaborators.map(collab => `
        <div class="collaborator-item" data-collaborator-id="${collab.id}">
            <div class="collaborator-info">
                <strong>${collab.name || collab.email}</strong>
                <span class="collaborator-email">${collab.email}</span>
                <span class="collaborator-role badge">${collab.role === 'viewer' ? 'Lecteur' : collab.role === 'editor' ? 'Éditeur' : collab.role}</span>
            </div>
            <button class="btn btn-danger btn-small remove-collaborator-btn" data-collaborator-id="${collab.id}">
                Retirer
            </button>
        </div>
    `).join('');

    // Add click handlers for remove buttons
    document.querySelectorAll('.remove-collaborator-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const collaboratorId = parseInt(btn.dataset.collaboratorId);
            await handleRemoveCollaborator(collaboratorId);
        });
    });
}

// Handle add collaborator
async function handleAddCollaborator(e) {
    e.preventDefault();
    if (!currentClient) return;

    const email = document.getElementById('collaboratorEmail').value.trim();
    const role = document.getElementById('collaboratorRole').value;

    document.getElementById('collaboratorError').style.display = 'none';
    document.getElementById('collaboratorSuccess').style.display = 'none';

    try {
        const btn = document.getElementById('addCollaboratorBtn');
        btn.querySelector('.btn-text').style.display = 'none';
        btn.querySelector('.btn-loader').style.display = 'inline';
        btn.disabled = true;

        await apiRequest(`/collaborators/${currentClient.id}`, {
            method: 'POST',
            body: JSON.stringify({ email, role })
        });

        // Show success
        const successDiv = document.getElementById('collaboratorSuccess');
        successDiv.textContent = 'Collaborateur ajouté avec succès !';
        successDiv.style.display = 'block';

        // Reset form
        document.getElementById('addCollaboratorForm').reset();

        // Reload collaborators list
        await loadCollaborators();
    } catch (error) {
        const errorDiv = document.getElementById('collaboratorError');
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    } finally {
        const btn = document.getElementById('addCollaboratorBtn');
        btn.querySelector('.btn-text').style.display = 'inline';
        btn.querySelector('.btn-loader').style.display = 'none';
        btn.disabled = false;
    }
}

// Handle remove collaborator
async function handleRemoveCollaborator(collaboratorId) {
    if (!currentClient) return;

    if (!confirm('Êtes-vous sûr de vouloir retirer ce collaborateur ?')) {
        return;
    }

    try {
        await apiRequest(`/collaborators/${currentClient.id}/${collaboratorId}`, {
            method: 'DELETE'
        });

        // Reload collaborators list
        await loadCollaborators();
    } catch (error) {
        alert('Échec de la suppression du collaborateur : ' + error.message);
    }
}

// Show add client modal
function showAddClientModal() {
    document.getElementById('addSiteModal').style.display = 'flex';
    document.getElementById('addSiteForm').reset();
    document.getElementById('snippetDisplay').style.display = 'none';
    document.getElementById('addSiteForm').style.display = 'block';
}

// Setup event listeners
function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    });

    // Custom select dropdown
    document.getElementById('clientSelectButton').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCustomDropdown();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const wrapper = document.querySelector('.custom-select-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            closeCustomDropdown();
        }
    });

    // Close modal
    document.getElementById('closeAddSiteModal').addEventListener('click', () => {
        document.getElementById('addSiteModal').style.display = 'none';
    });

    // Add site form
    document.getElementById('addSiteForm').addEventListener('submit', handleAddSite);

    // Done with snippet
    document.getElementById('doneSnippetBtn').addEventListener('click', () => {
        document.getElementById('addSiteModal').style.display = 'none';
        loadClients();
    });

    // Copy snippet
    document.getElementById('copySnippetBtn').addEventListener('click', () => {
        const snippet = document.getElementById('trackingSnippet').textContent;
        navigator.clipboard.writeText(snippet);
        alert('Code de suivi copié dans le presse-papiers !');
    });

    // Delete site
    document.getElementById('deleteSiteBtn').addEventListener('click', handleDeleteSite);

    // View snippet
    document.getElementById('viewSnippetBtn').addEventListener('click', () => {
        if (!currentClient) return;
        const snippet = generateSnippet(currentClient.api_key);
        document.getElementById('viewTrackingSnippet').textContent = snippet;
        document.getElementById('viewSnippetModal').style.display = 'flex';
    });

    // Close view snippet modal
    document.getElementById('closeViewSnippetModal').addEventListener('click', () => {
        document.getElementById('viewSnippetModal').style.display = 'none';
    });

    // Close category details modal
    document.getElementById('closeCategoryDetailsModal').addEventListener('click', () => {
        document.getElementById('categoryDetailsModal').style.display = 'none';
    });

    // Copy view snippet
    document.getElementById('copyViewSnippetBtn').addEventListener('click', () => {
        const snippet = document.getElementById('viewTrackingSnippet').textContent;
        navigator.clipboard.writeText(snippet);
        alert('Code de suivi copié dans le presse-papiers !');
    });

    // Manage categories
    document.getElementById('manageCategoriesBtn').addEventListener('click', () => {
        document.getElementById('categoriesModal').style.display = 'flex';
        document.getElementById('categoryError').style.display = 'none';
        document.getElementById('categorySuccess').style.display = 'none';
        document.getElementById('addCategoryForm').reset();
        loadCategories();
    });

    // Close categories modal
    document.getElementById('closeCategoriesModal').addEventListener('click', () => {
        document.getElementById('categoriesModal').style.display = 'none';
        resetCategoryForm();
    });

    // Add category form
    document.getElementById('addCategoryForm').addEventListener('submit', handleAddCategory);

    // Update form when condition type changes
    document.getElementById('conditionType').addEventListener('change', updateConditionForm);

    // Advanced conditions toggle
    document.getElementById('advancedConditionsToggle').addEventListener('change', (e) => {
        toggleAdvancedConditions(e.target.checked);
    });

    // Add condition button
    document.getElementById('addConditionBtn').addEventListener('click', () => {
        addConditionRow();
    });

    // Manage collaborators
    document.getElementById('manageCollaboratorsBtn').addEventListener('click', () => {
        document.getElementById('collaboratorsModal').style.display = 'flex';
        document.getElementById('collaboratorError').style.display = 'none';
        document.getElementById('collaboratorSuccess').style.display = 'none';
        document.getElementById('addCollaboratorForm').reset();
        loadCollaborators();
    });

    // Close collaborators modal
    document.getElementById('closeCollaboratorsModal').addEventListener('click', () => {
        document.getElementById('collaboratorsModal').style.display = 'none';
    });

    // Add collaborator form
    document.getElementById('addCollaboratorForm').addEventListener('submit', handleAddCollaborator);

    // Apply filters
    document.getElementById('applyFiltersBtn').addEventListener('click', () => {
        // Don't touch startDate and endDate - they are managed by the calendar modal
        currentFilters.depth = parseInt(document.getElementById('depthSelect').value);
        currentFilters.deviceType = document.getElementById('deviceFilter').value || null;
        currentFilters.trafficSource = document.getElementById('trafficSourceFilter').value || null;
        currentFilters.category = document.getElementById('categoryFilter').value || null;
        loadAnalytics();
    });

    // Reset filters
    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
        currentFilters = {
            startDate: null,
            endDate: null,
            depth: 5,
            deviceType: null,
            trafficSource: null,
            category: null
        };
        updateDateRangeLabel();
        document.getElementById('depthSelect').value = '5';
        document.getElementById('deviceFilter').value = '';
        document.getElementById('trafficSourceFilter').value = '';
        document.getElementById('categoryFilter').value = '';
        loadAnalytics();
    });

    // Sunburst View Mode Toggle
    document.getElementById('viewByUrlBtn').addEventListener('click', () => {
        if (currentFilters.viewMode !== 'url') {
            currentFilters.viewMode = 'url';
            document.getElementById('viewByUrlBtn').classList.add('active');
            document.getElementById('viewByCategoryBtn').classList.remove('active');
            loadSunburstData();
        }
    });

    document.getElementById('viewByCategoryBtn').addEventListener('click', () => {
        if (currentFilters.viewMode !== 'category') {
            currentFilters.viewMode = 'category';
            document.getElementById('viewByCategoryBtn').classList.add('active');
            document.getElementById('viewByUrlBtn').classList.remove('active');
            loadSunburstData();
        }
    });

    // Date Range Modal Management
    let tempStartDate = null;
    let tempEndDate = null;
    let selectedPreset = 'all';
    let startCalendar, endCalendar;

    // Format date to YYYY-MM-DD
    function formatDate(date) {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Format date for display
    function formatDateDisplay(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }

    // Update date range label
    function updateDateRangeLabel() {
        const label = document.getElementById('dateRangeLabel');
        const startDate = currentFilters.startDate;
        const endDate = currentFilters.endDate;

        if (!startDate && !endDate) {
            label.textContent = 'Toutes les dates';
        } else if (startDate && endDate) {
            label.textContent = `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;
        } else if (startDate) {
            label.textContent = `À partir du ${formatDateDisplay(startDate)}`;
        } else if (endDate) {
            label.textContent = `Jusqu'au ${formatDateDisplay(endDate)}`;
        }
    }

    // Calculate date range from preset
    function getDateRangeFromPreset(range) {
        const today = new Date();
        let start = null;
        let end = null;

        switch(range) {
            case 'today':
                start = new Date(today);
                end = new Date(today);
                break;
            case 'yesterday':
                start = new Date(today);
                start.setDate(today.getDate() - 1);
                end = new Date(start);
                break;
            case '7':
                start = new Date(today);
                start.setDate(today.getDate() - 7);
                end = new Date(today);
                break;
            case '15':
                start = new Date(today);
                start.setDate(today.getDate() - 15);
                end = new Date(today);
                break;
            case '30':
                start = new Date(today);
                start.setDate(today.getDate() - 30);
                end = new Date(today);
                break;
            case 'year':
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today);
                break;
            case '365':
                start = new Date(today);
                start.setDate(today.getDate() - 365);
                end = new Date(today);
                break;
            case 'all':
                start = null;
                end = null;
                break;
        }

        return { start, end };
    }

    // Open date range modal
    document.getElementById('dateRangeBtn').addEventListener('click', () => {
        // Check if flatpickr is available
        if (typeof flatpickr === 'undefined') {
            console.error('Flatpickr library not loaded');
            return;
        }

        tempStartDate = currentFilters.startDate ? new Date(currentFilters.startDate) : null;
        tempEndDate = currentFilters.endDate ? new Date(currentFilters.endDate) : null;

        // Initialize calendars
        if (!startCalendar) {
            startCalendar = flatpickr('#startCalendar', {
                inline: true,
                dateFormat: 'Y-m-d',
                defaultDate: tempStartDate,
                onChange: function(selectedDates) {
                    tempStartDate = selectedDates[0] || null;
                    // Clear preset selection
                    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
                }
            });
        }

        if (!endCalendar) {
            endCalendar = flatpickr('#endCalendar', {
                inline: true,
                dateFormat: 'Y-m-d',
                defaultDate: tempEndDate,
                onChange: function(selectedDates) {
                    tempEndDate = selectedDates[0] || null;
                    // Clear preset selection
                    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
                }
            });
        }

        // Update calendars with current dates
        if (tempStartDate) startCalendar.setDate(tempStartDate, false);
        if (tempEndDate) endCalendar.setDate(tempEndDate, false);

        document.getElementById('dateRangeModal').style.display = 'flex';
    });

    // Close modal
    function closeDateRangeModal() {
        document.getElementById('dateRangeModal').style.display = 'none';
    }

    document.getElementById('closeDateRangeModal').addEventListener('click', closeDateRangeModal);
    document.getElementById('cancelDateRange').addEventListener('click', closeDateRangeModal);

    // Click outside modal to close
    document.getElementById('dateRangeModal').addEventListener('click', (e) => {
        if (e.target.id === 'dateRangeModal') {
            closeDateRangeModal();
        }
    });

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const range = btn.dataset.range;
            selectedPreset = range;

            // Update active state
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Calculate dates
            const { start, end } = getDateRangeFromPreset(range);
            tempStartDate = start;
            tempEndDate = end;

            // Update calendars
            if (tempStartDate) {
                startCalendar.setDate(tempStartDate, false);
            } else {
                startCalendar.clear();
            }

            if (tempEndDate) {
                endCalendar.setDate(tempEndDate, false);
            } else {
                endCalendar.clear();
            }
        });
    });

    // Apply date range
    document.getElementById('applyDateRange').addEventListener('click', () => {
        currentFilters.startDate = tempStartDate ? formatDate(tempStartDate) : null;
        currentFilters.endDate = tempEndDate ? formatDate(tempEndDate) : null;

        updateDateRangeLabel();
        closeDateRangeModal();
        loadAnalytics();
    });

    // Pagination
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPagesTable();
        }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(pagesData.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderPagesTable();
        }
    });

    // Table sorting
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.dataset.sort;
            sortPagesData(sortBy);
        });
    });

    // Settings page event listeners
    // Theme toggle
    document.getElementById('lightThemeBtn').addEventListener('click', () => {
        setTheme('light');
    });

    document.getElementById('darkThemeBtn').addEventListener('click', () => {
        setTheme('dark');
    });

    // Copy snippet from settings
    document.getElementById('copySettingsSnippetBtn').addEventListener('click', () => {
        const snippet = document.getElementById('settingsTrackingSnippet').textContent;
        navigator.clipboard.writeText(snippet);
        alert('Code de suivi copié dans le presse-papiers !');
    });

    // Settings logout
    document.getElementById('settingsLogoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    });

    // Settings manage collaborators
    document.getElementById('settingsManageCollaboratorsBtn').addEventListener('click', () => {
        document.getElementById('collaboratorsModal').style.display = 'flex';
        document.getElementById('collaboratorError').style.display = 'none';
        document.getElementById('collaboratorSuccess').style.display = 'none';
        document.getElementById('addCollaboratorForm').reset();
        loadCollaborators();
    });

    // Settings manage categories
    document.getElementById('settingsManageCategoriesBtn').addEventListener('click', () => {
        document.getElementById('categoriesModal').style.display = 'flex';
        document.getElementById('categoryError').style.display = 'none';
        document.getElementById('categorySuccess').style.display = 'none';
        document.getElementById('addCategoryForm').reset();
        loadCategories();
    });

    // Settings delete site
    document.getElementById('settingsDeleteSiteBtn').addEventListener('click', handleDeleteSite);
}

// Handle add site
async function handleAddSite(e) {
    e.preventDefault();

    const siteName = document.getElementById('newSiteName').value.trim();
    const siteUrl = document.getElementById('newSiteUrl').value.trim();

    document.getElementById('addSiteError').style.display = 'none';

    try {
        const btn = document.getElementById('submitSiteBtn');
        btn.querySelector('.btn-text').style.display = 'none';
        btn.querySelector('.btn-loader').style.display = 'inline';
        btn.disabled = true;

        const data = await apiRequest('/clients', {
            method: 'POST',
            body: JSON.stringify({ siteName, siteUrl })
        });

        // Show snippet
        document.getElementById('addSiteForm').style.display = 'none';
        document.getElementById('snippetDisplay').style.display = 'block';

        const snippet = generateSnippet(data.client.api_key);
        document.getElementById('trackingSnippet').textContent = snippet;
    } catch (error) {
        const errorDiv = document.getElementById('addSiteError');
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    } finally {
        const btn = document.getElementById('submitSiteBtn');
        btn.querySelector('.btn-text').style.display = 'inline';
        btn.querySelector('.btn-loader').style.display = 'none';
        btn.disabled = false;
    }
}

// Generate tracking snippet
function generateSnippet(apiKey) {
    const baseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://sunburst-analytics-production.up.railway.app';

    return `<script>
(function() {
  window.SUNBURST_API_KEY = '${apiKey}';
  window.SUNBURST_ENDPOINT = '${baseUrl}/api/track';

  var script = document.createElement('script');
  script.src = '${baseUrl}/tracker.js';
  script.async = true;
  document.head.appendChild(script);
})();
</script>`;
}

// Handle delete site
async function handleDeleteSite() {
    if (!currentClient) return;

    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${currentClient.site_name}" ? Cela supprimera également toutes les données analytiques.`)) {
        return;
    }

    try {
        await apiRequest(`/clients/${currentClient.id}`, { method: 'DELETE' });

        // Reset state
        currentClient = null;
        document.getElementById('welcomeMessage').style.display = 'block';
        document.getElementById('dashboardContent').style.display = 'none';

        // Reload clients
        await loadClients();
    } catch (error) {
        alert('Échec de la suppression du site : ' + error.message);
    }
}

// Sort pages data
let sortDirection = {};
function sortPagesData(sortBy) {
    const direction = sortDirection[sortBy] === 'asc' ? 'desc' : 'asc';
    sortDirection[sortBy] = direction;

    pagesData.sort((a, b) => {
        let aVal, bVal;

        switch (sortBy) {
            case 'url':
                aVal = a.url;
                bVal = b.url;
                break;
            case 'title':
                aVal = a.title || '';
                bVal = b.title || '';
                break;
            case 'views':
                aVal = a.totalViews;
                bVal = b.totalViews;
                break;
            case 'position':
                aVal = a.avgPosition;
                bVal = b.avgPosition;
                break;
            case 'time':
                aVal = a.avgTimeSpent;
                bVal = b.avgTimeSpent;
                break;
            default:
                return 0;
        }

        if (typeof aVal === 'string') {
            return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else {
            return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
    });

    currentPage = 1;
    renderPagesTable();
}

// Category pages data and sorting state
let categoryPagesData = [];
let categorySortColumn = 'views';
let categorySortDirection = 'desc';

// Show category details modal
async function showCategoryDetails(categoryId) {
    document.getElementById('categoryDetailsModal').style.display = 'flex';
    document.getElementById('categoryDetailsLoading').style.display = 'block';
    document.getElementById('categoryDetailsContent').style.display = 'none';

    try {
        const params = buildFilterParams();

        const data = await apiRequest(`/analytics/category-details/${currentClient.id}/${categoryId}?${params}`);

        // Update title
        document.getElementById('categoryDetailsTitle').textContent = `Catégorie : ${data.category.name}`;

        // Update global stats
        document.getElementById('catStatViews').textContent = data.stats.totalViews.toLocaleString();
        document.getElementById('catStatPages').textContent = data.stats.uniquePages.toLocaleString();
        document.getElementById('catStatDepth').textContent = data.stats.avgDepth;
        document.getElementById('catStatTime').textContent = data.stats.avgTimeSpent;

        // Store pages data and render
        categoryPagesData = data.pages;
        categorySortColumn = 'views';
        categorySortDirection = 'desc';
        renderCategoryPagesTable();
        setupCategorySortHandlers();

        document.getElementById('categoryDetailsLoading').style.display = 'none';
        document.getElementById('categoryDetailsContent').style.display = 'block';
    } catch (error) {
        console.error('Failed to load category details:', error);
        document.getElementById('categoryDetailsLoading').innerHTML = '<p class="error-message">Échec du chargement des détails</p>';
    }
}

// Render category pages table
function renderCategoryPagesTable() {
    const tbody = document.getElementById('categoryPagesTableBody');

    if (categoryPagesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Aucune page dans cette catégorie</td></tr>';
        return;
    }

    // Sort data
    const sortedData = [...categoryPagesData].sort((a, b) => {
        let aVal = a[categorySortColumn];
        let bVal = b[categorySortColumn];

        // String comparison for text fields
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (categorySortDirection === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });

    tbody.innerHTML = sortedData.map(page => `
        <tr>
            <td><a href="${page.url}" target="_blank">${page.url}</a></td>
            <td>${page.title}</td>
            <td>${page.views.toLocaleString()}</td>
            <td>${page.avgDepth}</td>
            <td>${page.avgTimeSpent}</td>
        </tr>
    `).join('');

    // Update sort indicators
    document.querySelectorAll('#categoryDetailsModal .sortable').forEach(th => {
        const indicator = th.querySelector('.sort-indicator');
        if (th.dataset.sort === categorySortColumn) {
            indicator.textContent = categorySortDirection === 'asc' ? ' ↑' : ' ↓';
        } else {
            indicator.textContent = '';
        }
    });
}

// Setup sort handlers for category pages table
function setupCategorySortHandlers() {
    document.querySelectorAll('#categoryDetailsModal .sortable').forEach(th => {
        th.style.cursor = 'pointer';
        th.onclick = () => {
            const column = th.dataset.sort;
            if (categorySortColumn === column) {
                categorySortDirection = categorySortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                categorySortColumn = column;
                categorySortDirection = column === 'url' || column === 'title' ? 'asc' : 'desc';
            }
            renderCategoryPagesTable();
        };
    });
}

// Navigation menu handler
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const filtersSection = document.querySelector('.filters-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));

            // Add active class to clicked item
            item.classList.add('active');

            // Get section name
            const section = item.dataset.section;

            // Hide all content sections
            document.querySelectorAll('.content-section').forEach(s => {
                s.style.display = 'none';
            });

            // Show/hide filters based on section
            if (section === 'documentation' || section === 'parametres') {
                // Hide filters for documentation and parametres sections
                if (filtersSection) {
                    filtersSection.style.display = 'none';
                }
            } else {
                // Show filters for dashboard and cartographie sections
                if (filtersSection) {
                    filtersSection.style.display = 'block';
                }
            }

            // Show the selected section
            if (section === 'dashboard') {
                document.getElementById('dashboardSection').style.display = 'block';
            } else if (section === 'cartographie') {
                document.getElementById('cartographieSection').style.display = 'block';
            } else if (section === 'documentation') {
                document.getElementById('documentationSection').style.display = 'block';
            } else if (section === 'parametres') {
                document.getElementById('parametresSection').style.display = 'block';
                loadSettingsPage();
            }
        });
    });
}

// Load settings page data
function loadSettingsPage() {
    // Load user info
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('settingsUserName').textContent = user.name || '-';
    document.getElementById('settingsUserEmail').textContent = user.email || '-';

    // Update tracking snippet if a client is selected
    if (currentClient) {
        const snippet = generateSnippet(currentClient.api_key);
        document.getElementById('settingsTrackingSnippet').textContent = snippet;
        document.getElementById('copySettingsSnippetBtn').disabled = false;

        // Show/hide management options based on access
        const isOwner = currentClient.access_type === 'owner';
        document.getElementById('siteSettingsCard').style.display = isOwner ? 'block' : 'none';
        document.getElementById('dangerZoneCard').style.display = isOwner ? 'block' : 'none';
    } else {
        document.getElementById('settingsTrackingSnippet').textContent = 'Sélectionnez un site pour voir le code de suivi';
        document.getElementById('copySettingsSnippetBtn').disabled = true;
        document.getElementById('siteSettingsCard').style.display = 'none';
        document.getElementById('dangerZoneCard').style.display = 'none';
    }

    // Update theme button states
    updateThemeButtons();
}

// Theme Management
function getTheme() {
    return localStorage.getItem('theme') || 'light';
}

function setTheme(theme) {
    localStorage.setItem('theme', theme);
    document.body.setAttribute('data-theme', theme);
    updateThemeButtons();
}

function updateThemeButtons() {
    const currentTheme = getTheme();
    document.getElementById('lightThemeBtn').classList.toggle('active', currentTheme === 'light');
    document.getElementById('darkThemeBtn').classList.toggle('active', currentTheme === 'dark');
}

function initTheme() {
    const savedTheme = getTheme();
    setTheme(savedTheme);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initDashboard();
    initNavigation();
    window.cartographyModule.setupCartographyEventListeners();
});
