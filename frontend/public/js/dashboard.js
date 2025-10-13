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
let currentFilters = {
    startDate: null,
    endDate: null,
    depth: 5
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
    document.getElementById('userName').textContent = user.name || 'User';
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
    const container = document.getElementById('clientsList');

    if (clients.length === 0) {
        container.innerHTML = '<p class="empty-state">No sites yet. Add one to get started!</p>';
        return;
    }

    container.innerHTML = clients.map(client => `
        <div class="client-item ${currentClient && currentClient.id === client.id ? 'active' : ''}"
             data-client-id="${client.id}">
            <div class="client-name">${client.site_name}</div>
            <div class="client-url">${new URL(client.site_url).hostname}</div>
        </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.client-item').forEach(item => {
        item.addEventListener('click', () => {
            const clientId = parseInt(item.dataset.clientId);
            selectClient(clientId);
        });
    });
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

    // Load analytics data
    await loadAnalytics();
}

// Load analytics data
async function loadAnalytics() {
    if (!currentClient) return;

    await Promise.all([
        loadStats(),
        loadSunburstData(),
        loadPagesData()
    ]);
}

// Load statistics
async function loadStats() {
    try {
        const params = new URLSearchParams();
        if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
        if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);

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

        const params = new URLSearchParams();
        if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
        if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
        params.append('depth', currentFilters.depth);

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
        const params = new URLSearchParams();
        if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
        if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);

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
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No page data available yet.</td></tr>';
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
        document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
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

// Setup event listeners
function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    });

    // Add client
    document.getElementById('addClientBtn').addEventListener('click', () => {
        document.getElementById('addSiteModal').style.display = 'flex';
        document.getElementById('addSiteForm').reset();
        document.getElementById('snippetDisplay').style.display = 'none';
        document.getElementById('addSiteForm').style.display = 'block';
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
        alert('Snippet copied to clipboard!');
    });

    // Delete site
    document.getElementById('deleteSiteBtn').addEventListener('click', handleDeleteSite);

    // Apply filters
    document.getElementById('applyFiltersBtn').addEventListener('click', () => {
        currentFilters.startDate = document.getElementById('startDate').value || null;
        currentFilters.endDate = document.getElementById('endDate').value || null;
        currentFilters.depth = parseInt(document.getElementById('depthSelect').value);
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

    if (!confirm(`Are you sure you want to delete "${currentClient.site_name}"? This will also delete all analytics data.`)) {
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
        alert('Failed to delete site: ' + error.message);
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', initDashboard);
