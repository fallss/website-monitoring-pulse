/**
 * NEXCT MONITORING - WARM EDITORIAL SAAS DASHBOARD
 * Core Frontend Application Logic with Light/Dark Mode System
 */

// ==========================================================================
// STATE MANAGEMENT & INITIALIZATION
// ==========================================================================

let websites = [];
let currentFilter = 'all'; // 'all' | 'up' | 'down'
let searchQuery = '';
let isRefreshingAll = false;
let pendingDeleteId = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    loadSavedWebsites();
    initSidebarState();
    setupEventListeners();
    renderDashboard();

    // Fetch from central server database (multi-device support)
    await fetchWebsitesFromServer();

    // Request desktop notification permission if supported
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Periodic Background Check every 60 seconds
    setInterval(checkAllWebsites, 60000);

    // Periodic Sync with Server every 15 seconds (syncs changes from other devices)
    setInterval(fetchWebsitesFromServer, 15000);

    // Refresh when user returns to tab/window
    window.addEventListener('focus', () => {
        fetchWebsitesFromServer();
    });

    // Periodic Relative Time refresh every 15 seconds
    setInterval(updateRelativeTimes, 15000);

    // Initial check on load if websites exist
    if (websites.length > 0) {
        checkAllWebsites();
    }
});

// ==========================================================================
// LIGHT & DARK THEME SYSTEM
// ==========================================================================

/**
 * Initialize theme based on user's saved preference or OS system preference
 */
function initTheme() {
    const savedTheme = localStorage.getItem('nexct_theme');
    let theme = 'light';

    if (savedTheme) {
        theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        theme = 'dark';
    }

    applyTheme(theme, false);

    // Listen to system theme change if no manual preference stored
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('nexct_theme')) {
                applyTheme(e.matches ? 'dark' : 'light', true);
            }
        });
    }
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('nexct_theme', newTheme);
    applyTheme(newTheme, true);
    showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
}

/**
 * Apply theme to document and update toggle button state
 */
function applyTheme(theme, reRenderCharts = false) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        const nextMode = theme === 'dark' ? 'light' : 'dark';
        btn.setAttribute('aria-label', `Switch to ${nextMode} mode`);
        btn.setAttribute('title', `Switch to ${nextMode} mode`);
    }

    if (reRenderCharts) {
        renderCharts();
    }
}

// ==========================================================================
// DATA PERSISTENCE & STORAGE
// ==========================================================================

/**
 * Load and normalize stored websites from localStorage (instant cache)
 */
function loadSavedWebsites() {
    try {
        const raw = localStorage.getItem('myWebsites');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                websites = parsed.map(site => ({
                    id: String(site.id || Date.now() + Math.random()),
                    url: site.url,
                    status: site.status || 'pending',
                    latency: typeof site.latency === 'number' ? site.latency : 0,
                    statusCode: site.statusCode || (site.status === 'up' ? 200 : (site.status === 'down' ? 503 : 0)),
                    lastChecked: site.lastChecked || (site.status !== 'pending' ? new Date().toISOString() : null),
                    history: Array.isArray(site.history) ? site.history : (site.latency > 0 ? [site.latency] : [])
                }));
            }
        }
    } catch (e) {
        console.error('Error loading websites from storage:', e);
        websites = [];
    }
}

/**
 * Fetch websites from the centralized server database (multi-device sync)
 */
async function fetchWebsitesFromServer() {
    try {
        const response = await fetch('/api/websites');
        if (!response.ok) return;
        const serverSites = await response.json();

        if (Array.isArray(serverSites)) {
            if (serverSites.length > 0) {
                // Central database has data: sync to local state & storage
                websites = serverSites.map(site => ({
                    id: String(site.id),
                    url: site.url,
                    status: site.status || 'pending',
                    latency: typeof site.latency === 'number' ? site.latency : 0,
                    statusCode: site.statusCode || (site.status === 'up' ? 200 : (site.status === 'down' ? 503 : 0)),
                    lastChecked: site.lastChecked || null,
                    history: Array.isArray(site.history) ? site.history : []
                }));
                saveDataLocal();
                renderDashboard();
            } else if (websites.length > 0) {
                // Server is empty but client has local cache: sync up to server
                await syncLocalWebsitesToServer();
            }
        }
    } catch (e) {
        console.warn('Could not sync with central server, using local cache:', e);
    }
}

/**
 * Sync local cache to server database
 */
async function syncLocalWebsitesToServer() {
    try {
        const response = await fetch('/api/websites/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ websites })
        });
        if (response.ok) {
            const synced = await response.json();
            if (Array.isArray(synced) && synced.length > 0) {
                websites = synced.map(s => ({ ...s, id: String(s.id) }));
                saveDataLocal();
                renderDashboard();
            }
        }
    } catch (e) {
        console.warn('Failed to sync local websites to server:', e);
    }
}

/**
 * Save current state
 */
function saveData() {
    saveDataLocal();
}

function saveDataLocal() {
    try {
        localStorage.setItem('myWebsites', JSON.stringify(websites));
    } catch (e) {
        console.error('Error saving websites locally:', e);
    }
}

// ==========================================================================
// EVENT LISTENERS & NAVIGATION
// ==========================================================================

function setupEventListeners() {
    // Escape key closes open modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAddModal();
            closeDeleteModal();
            toggleMobileSidebar(false);
        }
    });

    // Close modal when clicking outside dialog
    const addModal = document.getElementById('addWebsiteModal');
    if (addModal) {
        addModal.addEventListener('click', (e) => {
            if (e.target === addModal) closeAddModal();
        });
    }

    const delModal = document.getElementById('deleteConfirmModal');
    if (delModal) {
        delModal.addEventListener('click', (e) => {
            if (e.target === delModal) closeDeleteModal();
        });
    }

    // Window resize handler for chart responsiveness
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            renderCharts();
        }, 150);
    });
}

function navigateSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
    if (sectionId === 'overview') {
        document.getElementById('navOverview')?.classList.add('active');
    } else {
        document.getElementById('navWebsites')?.classList.add('active');
    }

    // Close mobile drawer if open
    toggleMobileSidebar(false);
}

function toggleSidebarCollapse() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('nexct_sidebar_collapsed', isCollapsed ? 'true' : 'false');
        setTimeout(renderCharts, 360);
    }
}

function initSidebarState() {
    const saved = localStorage.getItem('nexct_sidebar_collapsed');
    const sidebar = document.getElementById('sidebar');
    if (saved === 'true' && sidebar && window.innerWidth > 1024) {
        sidebar.classList.add('collapsed');
    }
}

function toggleMobileSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileDrawerOverlay');
    if (sidebar && overlay) {
        if (open) {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
        } else {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
        }
    }
}

// ==========================================================================
// SEARCH & FILTER LOGIC
// ==========================================================================

function handleSearch(val) {
    searchQuery = (val || '').trim().toLowerCase();
    const topInput = document.getElementById('topbarSearch');
    const tableInput = document.getElementById('tableSearchInput');
    const clearBtn = document.getElementById('btnClearSearch');

    if (topInput && topInput.value !== val) topInput.value = val;
    if (tableInput && tableInput.value !== val) tableInput.value = val;
    if (clearBtn) clearBtn.style.display = searchQuery ? 'inline-flex' : 'none';

    renderWebsitesTable();
}

function clearSearch() {
    handleSearch('');
    const tableInput = document.getElementById('tableSearchInput');
    if (tableInput) tableInput.focus();
}

function setFilterStatus(status) {
    currentFilter = status;

    // Update filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    if (status === 'all') document.getElementById('tabFilterAll')?.classList.add('active');
    if (status === 'up') document.getElementById('tabFilterUp')?.classList.add('active');
    if (status === 'down') document.getElementById('tabFilterDown')?.classList.add('active');

    // Update metric card active border
    document.querySelectorAll('.metric-card').forEach(c => c.classList.remove('filter-active'));
    if (status === 'all') document.getElementById('metricCardTotal')?.classList.add('filter-active');
    if (status === 'up') document.getElementById('metricCardOnline')?.classList.add('filter-active');
    if (status === 'down') document.getElementById('metricCardOffline')?.classList.add('filter-active');

    renderWebsitesTable();
}

function getFilteredWebsites() {
    return websites.filter(site => {
        // Status matching
        if (currentFilter === 'up' && site.status !== 'up') return false;
        if (currentFilter === 'down' && site.status !== 'down') return false;

        // Search matching
        if (searchQuery) {
            const cleanUrl = site.url.toLowerCase();
            return cleanUrl.includes(searchQuery);
        }

        return true;
    });
}

// ==========================================================================
// CORE DASHBOARD RENDERING
// ==========================================================================

function renderDashboard() {
    renderMetricCards();
    renderCharts();
    renderWebsitesTable();
}

/**
 * 1. Summary Metric Cards
 */
function renderMetricCards() {
    const total = websites.length;
    const online = websites.filter(w => w.status === 'up').length;
    const offline = websites.filter(w => w.status === 'down').length;

    // Counters
    document.getElementById('totalCount').innerText = total;
    document.getElementById('onlineCount').innerText = online;
    document.getElementById('offlineCount').innerText = offline;

    // Nav counter
    const navSitesCount = document.getElementById('navSitesCount');
    if (navSitesCount) navSitesCount.innerText = total;

    // Tab counters & Header Badge
    const tabCountAll = document.getElementById('tabCountAll');
    const tabCountUp = document.getElementById('tabCountUp');
    const tabCountDown = document.getElementById('tabCountDown');
    const tableHeaderCount = document.getElementById('tableHeaderCount');

    if (tabCountAll) tabCountAll.innerText = total;
    if (tabCountUp) tabCountUp.innerText = online;
    if (tabCountDown) tabCountDown.innerText = offline;
    if (tableHeaderCount) tableHeaderCount.innerText = `${total} monitor${total !== 1 ? 's' : ''}`;

    // Secondary subtext
    const onlinePct = total > 0 ? Math.round((online / total) * 100) : 0;
    const onlineSub = document.getElementById('onlinePercentageSub');
    if (onlineSub) {
        onlineSub.innerText = total > 0 ? `${onlinePct}% operational` : 'No websites registered';
    }

    const offlineDesc = document.getElementById('offlineDesc');
    if (offlineDesc) {
        if (total === 0) {
            offlineDesc.innerText = 'No issues detected';
        } else if (offline === 0) {
            offlineDesc.innerText = 'All systems green';
        } else {
            offlineDesc.innerText = `${offline} endpoint${offline > 1 ? 's' : ''} failing`;
        }
    }
}

/**
 * 2. Visualizations: Donut Chart & Response Time Chart
 */
function renderCharts() {
    renderDonutChart();
    renderResponseTimeChart();
}

/**
 * 2.1 Donut Chart - Website Status Distribution
 */
function renderDonutChart() {
    const container = document.getElementById('donutContainer');
    const uptimeBadge = document.getElementById('uptimeBadge');
    const legendOnline = document.getElementById('legendOnline');
    const legendOffline = document.getElementById('legendOffline');

    const total = websites.length;
    const online = websites.filter(w => w.status === 'up').length;
    const offline = websites.filter(w => w.status === 'down').length;
    const pending = websites.filter(w => w.status === 'pending').length;

    // CRITICAL: Empty state when 0 websites. NEVER show 100% Up when 0!
    if (total === 0) {
        if (uptimeBadge) uptimeBadge.innerText = 'No Data';
        if (legendOnline) legendOnline.innerText = '0 (0%)';
        if (legendOffline) legendOffline.innerText = '0 (0%)';

        container.innerHTML = `
            <div class="chart-empty-state">
                <div class="chart-empty-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <div class="chart-empty-title">Your monitoring overview starts here.</div>
                <div class="chart-empty-desc">Add a website to see its current status and performance.</div>
            </div>
        `;
        return;
    }

    const onlinePct = Math.round((online / total) * 100);
    const offlinePct = Math.round((offline / total) * 100);

    if (uptimeBadge) uptimeBadge.innerText = `${onlinePct}% Health`;
    if (legendOnline) legendOnline.innerText = `${online} (${onlinePct}%)`;
    if (legendOffline) legendOffline.innerText = `${offline} (${offlinePct}%)`;

    // SVG Donut calculation
    // Radius = 65, Circumference = 2 * PI * 65 ≈ 408.407
    const r = 65;
    const c = 2 * Math.PI * r;

    const onlineStroke = (online / total) * c;
    const offlineStroke = (offline / total) * c;
    const pendingStroke = (pending / total) * c;

    const onlineOffset = 0;
    const offlineOffset = -onlineStroke;
    const pendingOffset = -(onlineStroke + offlineStroke);

    container.innerHTML = `
        <div class="donut-visual-wrapper">
            <svg class="donut-svg" viewBox="0 0 170 170">
                <!-- Background Ring -->
                <circle class="donut-bg-ring" cx="85" cy="85" r="${r}" />
                
                <!-- Online Segment -->
                ${online > 0 ? `
                    <circle class="donut-segment online" cx="85" cy="85" r="${r}"
                        stroke-dasharray="${onlineStroke} ${c - onlineStroke}"
                        stroke-dashoffset="${onlineOffset}" />
                ` : ''}

                <!-- Offline Segment -->
                ${offline > 0 ? `
                    <circle class="donut-segment offline" cx="85" cy="85" r="${r}"
                        stroke-dasharray="${offlineStroke} ${c - offlineStroke}"
                        stroke-dashoffset="${offlineOffset}" />
                ` : ''}

                <!-- Pending Segment -->
                ${pending > 0 ? `
                    <circle class="donut-segment pending" cx="85" cy="85" r="${r}"
                        stroke-dasharray="${pendingStroke} ${c - pendingStroke}"
                        stroke-dashoffset="${pendingOffset}" />
                ` : ''}
            </svg>
            <div class="donut-center-info">
                <span class="donut-center-value tabular-nums">${onlinePct}%</span>
                <span class="donut-center-label">HEALTH</span>
            </div>
        </div>
    `;
}

/**
 * 2.2 Response Time Line/Area Performance Chart
 */
function renderResponseTimeChart() {
    const svgWrapper = document.getElementById('perfSvgWrapper');
    const avgLatencyEl = document.getElementById('perfAvgLatency');
    const minLatencyEl = document.getElementById('perfMinLatency');
    const maxLatencyEl = document.getElementById('perfMaxLatency');
    const sampleCountEl = document.getElementById('chartSampleCount');

    // Filter websites with valid response times
    const activeSites = websites.filter(w => w.latency > 0);

    if (websites.length === 0 || activeSites.length === 0) {
        if (avgLatencyEl) avgLatencyEl.innerText = '0 ms';
        if (minLatencyEl) minLatencyEl.innerText = '0 ms';
        if (maxLatencyEl) maxLatencyEl.innerText = '0 ms';
        if (sampleCountEl) sampleCountEl.innerText = 'No Checks Yet';

        svgWrapper.innerHTML = `
            <div class="chart-empty-state">
                <div class="chart-empty-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                </div>
                <div class="chart-empty-title">Waiting for monitoring data</div>
                <div class="chart-empty-desc">Graphs will populate once response performance checks complete.</div>
            </div>
        `;
        return;
    }

    // Compute key statistics from real data
    const latencies = activeSites.map(s => s.latency);
    const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);

    if (avgLatencyEl) avgLatencyEl.innerText = `${avgLatency} ms`;
    if (minLatencyEl) minLatencyEl.innerText = `${minLatency} ms`;
    if (maxLatencyEl) maxLatencyEl.innerText = `${maxLatency} ms`;
    if (sampleCountEl) sampleCountEl.innerText = `${activeSites.length} Endpoint${activeSites.length > 1 ? 's' : ''}`;

    // SVG Dimensions
    const width = svgWrapper.clientWidth || 500;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 20, left: 45 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Y Axis scaling (round up to pleasant ceiling)
    const yMaxVal = Math.max(Math.ceil((maxLatency * 1.25) / 100) * 100, 200);

    // Compute points for each site
    const points = activeSites.map((site, index) => {
        const x = activeSites.length === 1 
            ? padding.left + chartW / 2 
            : padding.left + (index / (activeSites.length - 1)) * chartW;
        const normalizedY = (site.latency / yMaxVal) * chartH;
        const y = padding.top + chartH - normalizedY;
        return { x, y, site };
    });

    // Build SVG Path
    let pathD = '';
    let areaD = '';

    if (points.length === 1) {
        const p = points[0];
        pathD = `M ${padding.left} ${p.y} L ${padding.left + chartW} ${p.y}`;
        areaD = `M ${padding.left} ${p.y} L ${padding.left + chartW} ${p.y} L ${padding.left + chartW} ${padding.top + chartH} L ${padding.left} ${padding.top + chartH} Z`;
    } else {
        pathD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            pathD += ` L ${points[i].x} ${points[i].y}`;
        }
        areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;
    }

    // Grid lines for Y-axis (3 levels)
    const gridYValues = [0, Math.round(yMaxVal / 2), yMaxVal];
    const gridLines = gridYValues.map(val => {
        const yPos = padding.top + chartH - (val / yMaxVal) * chartH;
        return `
            <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" 
                  stroke="var(--border-subtle)" stroke-dasharray="3 3" stroke-width="1" />
            <text x="${padding.left - 8}" y="${yPos + 4}" fill="var(--text-muted)" font-size="10" 
                  font-family="inherit" text-anchor="end" class="tabular-nums">${val}ms</text>
        `;
    }).join('');

    // Interactive data circles & tooltip triggers
    const dataCircles = points.map(pt => {
        const color = pt.site.status === 'up' ? 'var(--status-online)' : 'var(--status-offline)';

        return `
            <g class="chart-point" data-url="${escapeHtml(pt.site.url)}" data-ms="${pt.site.latency}" data-code="${pt.site.statusCode}" data-status="${pt.site.status}" data-time="${pt.site.lastChecked || ''}">
                <circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="${color}" stroke="var(--surface)" stroke-width="2" style="cursor: pointer; transition: r 0.2s;" />
                <circle cx="${pt.x}" cy="${pt.y}" r="12" fill="transparent" style="cursor: pointer;" 
                    onmouseenter="showChartTooltip(event, '${escapeHtml(pt.site.url)}', ${pt.site.latency}, '${pt.site.status}', ${pt.site.statusCode})" 
                    onmouseleave="hideChartTooltip()" />
            </g>
        `;
    }).join('');

    svgWrapper.innerHTML = `
        <svg class="perf-svg" viewBox="0 0 ${width} ${height}">
            <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#C98752" stop-opacity="0.32"/>
                    <stop offset="100%" stop-color="#C98752" stop-opacity="0.02"/>
                </linearGradient>
            </defs>

            <!-- Grid Lines -->
            ${gridLines}

            <!-- Area Fill -->
            <path d="${areaD}" fill="url(#latencyGradient)" />

            <!-- Line Path -->
            <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

            <!-- Points & Tooltip Triggers -->
            ${dataCircles}
        </svg>
    `;
}

function showChartTooltip(e, url, ms, status, code) {
    const tooltip = document.getElementById('chartTooltip');
    if (!tooltip) return;

    const domain = getDomainFromUrl(url);
    const statusText = status === 'up' ? 'Online' : 'Offline';
    const statusColor = status === 'up' ? 'var(--status-online)' : 'var(--status-offline)';

    tooltip.innerHTML = `
        <div class="chart-tooltip-title">${escapeHtml(domain)}</div>
        <div class="chart-tooltip-meta">
            <span style="color: ${statusColor}; font-weight: 600;">● ${statusText} (${code || 200})</span>
            <span>•</span>
            <span style="color: var(--foreground); font-weight: 700;">${ms} ms</span>
        </div>
    `;

    tooltip.style.display = 'block';
    const rect = e.target.getBoundingClientRect();
    const parentRect = document.getElementById('perfChartContainer').getBoundingClientRect();

    tooltip.style.left = `${rect.left - parentRect.left + 12}px`;
    tooltip.style.top = `${rect.top - parentRect.top}px`;
}

function hideChartTooltip() {
    const tooltip = document.getElementById('chartTooltip');
    if (tooltip) tooltip.style.display = 'none';
}

/**
 * 3. Websites Monitoring Table
 */
function renderWebsitesTable() {
    const tbody = document.getElementById('websiteTableBody');
    const emptyState = document.getElementById('emptyTableState');
    const tableEl = document.getElementById('websitesMainTable');
    if (!tbody || !emptyState || !tableEl) return;

    const filtered = getFilteredWebsites();

    if (websites.length === 0) {
        tableEl.style.display = 'none';
        emptyState.style.display = 'flex';
        document.getElementById('emptyStateTitle').innerText = 'Your monitoring overview starts here.';
        document.getElementById('emptyStateDesc').innerText = 'Add a website to see its current status and performance.';
        document.getElementById('emptyStateCta').style.display = 'inline-flex';
        return;
    }

    if (filtered.length === 0) {
        tableEl.style.display = 'none';
        emptyState.style.display = 'flex';
        document.getElementById('emptyStateTitle').innerText = 'No matching websites found.';
        document.getElementById('emptyStateDesc').innerText = `No websites matched your active filter "${currentFilter}" or query "${searchQuery}".`;
        document.getElementById('emptyStateCta').style.display = 'none';
        return;
    }

    tableEl.style.display = 'table';
    emptyState.style.display = 'none';
    tbody.innerHTML = '';

    filtered.forEach((site) => {
        const domain = getDomainFromUrl(site.url);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;

        // Status badge configuration
        let badgeClass = 'status-pending';
        let badgeLabel = 'Checking...';
        if (site.status === 'up') {
            badgeClass = 'status-up';
            badgeLabel = `Online (${site.statusCode || 200})`;
        } else if (site.status === 'down') {
            badgeClass = 'status-down';
            badgeLabel = `Offline (${site.statusCode || 503})`;
        }

        // Latency color
        let latencyClass = 'zero';
        let latencyDisplay = '-';
        if (site.latency > 0) {
            latencyDisplay = `${site.latency} ms`;
            if (site.latency < 250) latencyClass = 'fast';
            else if (site.latency <= 600) latencyClass = 'medium';
            else latencyClass = 'slow';
        }

        // Relative time formatting
        const relativeTime = formatRelativeTime(site.lastChecked);

        // Find actual index in complete array for move up/down
        const actualIndex = websites.findIndex(w => String(w.id) === String(site.id));
        const isFirst = actualIndex === 0;
        const isLast = actualIndex === websites.length - 1;

        const row = document.createElement('tr');
        row.id = `site-row-${site.id}`;
        row.className = 'website-row';
        row.innerHTML = `
            <td class="col-website">
                <div class="website-identity">
                    <div class="website-favicon-box">
                        <img class="website-favicon-img" src="${faviconUrl}" alt="${escapeHtml(domain)}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" />
                        <!-- Fallback Globe SVG -->
                        <svg class="website-favicon-fallback" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                    </div>
                    <div class="website-name-wrap">
                        <div class="website-domain-row">
                            <a href="${escapeHtml(site.url)}" target="_blank" rel="noopener noreferrer" class="website-domain">
                                ${escapeHtml(domain)}
                            </a>
                            <button class="btn-copy-url" onclick="copyToClipboard('${escapeHtml(site.url)}')" title="Copy URL" aria-label="Copy URL">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                        </div>
                        <span class="website-full-url" title="${escapeHtml(site.url)}">${escapeHtml(site.url)}</span>
                    </div>
                </div>
            </td>

            <td class="col-status">
                <span class="status-badge ${badgeClass}">
                    <span class="status-badge-dot"></span>
                    ${badgeLabel}
                </span>
            </td>

            <td class="col-latency">
                <span class="cell-label-mobile">Latency</span>
                <span class="latency-pill ${latencyClass} tabular-nums">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    ${latencyDisplay}
                </span>
            </td>

            <td class="col-checked">
                <span class="cell-label-mobile">Checked</span>
                <div class="checked-cell">
                    <span class="checked-relative" id="rel-time-${site.id}" title="${site.lastChecked || 'Not checked yet'}">
                        ${relativeTime}
                    </span>
                    <span class="checked-code">
                        ${site.lastChecked ? formatTimeOnly(site.lastChecked) : 'Pending'}
                    </span>
                </div>
            </td>

            <td class="col-actions">
                <div class="table-actions">
                    <!-- Refresh single site button -->
                    <button class="btn-action-icon btn-check-now" id="btn-check-${site.id}" onclick="handleSingleCheck(${site.id})" title="Check now" aria-label="Check now">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                        </svg>
                        <span class="btn-check-text-mobile">Check</span>
                    </button>

                    <div class="actions-right-group">
                        <!-- Reorder Up -->
                        <button class="btn-action-icon" onclick="moveWebsiteUp(${site.id})" ${isFirst ? 'disabled' : ''} title="Move Up" aria-label="Move Up">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="18 15 12 9 6 15"></polyline>
                            </svg>
                        </button>

                        <!-- Reorder Down -->
                        <button class="btn-action-icon" onclick="moveWebsiteDown(${site.id})" ${isLast ? 'disabled' : ''} title="Move Down" aria-label="Move Down">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>

                        <!-- Delete Button -->
                        <button class="btn-action-icon btn-delete-row" onclick="openDeleteModal(${site.id})" title="Delete website" aria-label="Delete website">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function updateRelativeTimes() {
    websites.forEach(site => {
        const el = document.getElementById(`rel-time-${site.id}`);
        if (el) {
            el.innerText = formatRelativeTime(site.lastChecked);
        }
    });
}

// ==========================================================================
// ADD WEBSITE WORKFLOW & MODAL
// ==========================================================================

function openAddModal() {
    const modal = document.getElementById('addWebsiteModal');
    const input = document.getElementById('modalUrlInput');
    const errorMsg = document.getElementById('modalUrlError');

    if (modal && input) {
        input.value = '';
        input.classList.remove('has-error');
        if (errorMsg) {
            errorMsg.innerText = '';
            errorMsg.style.display = 'none';
        }

        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => input.focus(), 100);
    }
}

function closeAddModal() {
    const modal = document.getElementById('addWebsiteModal');
    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }
}

async function submitAddWebsite(event) {
    if (event) event.preventDefault();

    const input = document.getElementById('modalUrlInput');
    const errorEl = document.getElementById('modalUrlError');
    const submitBtn = document.getElementById('btnSubmitAdd');
    const submitText = document.getElementById('btnSubmitAddText');

    let rawUrl = (input.value || '').trim();

    // 1. Validation
    if (!rawUrl) {
        showInputError(input, errorEl, 'Please enter a website URL.');
        return;
    }

    // Auto prepend scheme if missing
    if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = 'https://' + rawUrl;
    }

    // Validate URL syntax
    try {
        const parsed = new URL(rawUrl);
        if (!parsed.hostname || !parsed.hostname.includes('.')) {
            showInputError(input, errorEl, 'Please enter a valid domain (e.g. https://example.com).');
            return;
        }
    } catch (e) {
        showInputError(input, errorEl, 'Invalid URL format. Example: https://example.com');
        return;
    }

    // Check duplicate
    if (websites.some(w => w.url.toLowerCase() === rawUrl.toLowerCase())) {
        showInputError(input, errorEl, 'This website is already in your monitoring list.');
        return;
    }

    // Clear error
    input.classList.remove('has-error');
    if (errorEl) errorEl.style.display = 'none';

    // 2. Set Loading State
    submitBtn.disabled = true;
    submitText.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spinning" style="animation: spin 0.8s linear infinite;">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
        Adding & Checking...
    `;

    // 3. Save to central server database
    let siteId = String(Date.now());
    let normalizedUrl = rawUrl;

    try {
        const response = await fetch('/api/websites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: rawUrl, id: siteId })
        });
        if (response.ok) {
            const created = await response.json();
            siteId = String(created.id);
            normalizedUrl = created.url;
        }
    } catch (e) {
        console.warn('Backend unavailable, saving locally:', e);
    }

    const newSite = {
        id: siteId,
        url: normalizedUrl,
        status: 'pending',
        latency: 0,
        statusCode: 0,
        lastChecked: null,
        history: []
    };

    websites.push(newSite);
    saveData();
    renderDashboard();

    // 4. Perform Immediate Health Check
    try {
        await checkSingleWebsite(newSite.id);
        showToast(`Website "${getDomainFromUrl(normalizedUrl)}" added successfully!`, 'success');
        closeAddModal();
    } catch (e) {
        console.error('Error during initial check:', e);
        showToast(`Website added, but check returned error.`, 'info');
        closeAddModal();
    } finally {
        submitBtn.disabled = false;
        submitText.innerText = 'Add Website';
    }
}

function showInputError(input, errorEl, msg) {
    input.classList.add('has-error');
    if (errorEl) {
        errorEl.innerText = msg;
        errorEl.style.display = 'flex';
    }
    input.focus();
}

// ==========================================================================
// DELETE WEBSITE CONFIRMATION MODAL
// ==========================================================================

function openDeleteModal(id) {
    const site = websites.find(w => String(w.id) === String(id));
    if (!site) return;

    pendingDeleteId = String(id);
    const modal = document.getElementById('deleteConfirmModal');
    const targetLabel = document.getElementById('deleteTargetUrl');

    if (targetLabel) targetLabel.innerText = site.url;
    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeDeleteModal() {
    pendingDeleteId = null;
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }
}

async function executeDeleteWebsite() {
    if (!pendingDeleteId) return;

    const idToDelete = String(pendingDeleteId);
    const site = websites.find(w => String(w.id) === idToDelete);
    const domain = site ? getDomainFromUrl(site.url) : 'Website';

    websites = websites.filter(w => String(w.id) !== idToDelete);
    saveData();
    closeDeleteModal();
    renderDashboard();
    showToast(`Removed "${domain}" from monitoring`, 'info');

    try {
        await fetch(`/api/websites/${idToDelete}`, { method: 'DELETE' });
    } catch (e) {
        console.warn('Failed to delete on server:', e);
    }
}

// ==========================================================================
// REORDER WEBSITES
// ==========================================================================

function moveWebsiteUp(id) {
    const index = websites.findIndex(w => String(w.id) === String(id));
    if (index > 0) {
        [websites[index - 1], websites[index]] = [websites[index], websites[index - 1]];
        saveData();
        renderWebsitesTable();
        showToast('Website order updated', 'info');
    }
}

function moveWebsiteDown(id) {
    const index = websites.findIndex(w => String(w.id) === String(id));
    if (index >= 0 && index < websites.length - 1) {
        [websites[index], websites[index + 1]] = [websites[index + 1], websites[index]];
        saveData();
        renderWebsitesTable();
        showToast('Website order updated', 'info');
    }
}

// ==========================================================================
// MONITORING & API HEALTH CHECKS
// ==========================================================================

/**
 * Execute a single check against `/api/check?url=...`
 */
async function checkSingleWebsite(id) {
    const targetId = String(id);
    const index = websites.findIndex(w => String(w.id) === targetId);
    if (index === -1) return;

    const site = websites[index];
    const prevStatus = site.status;

    try {
        const response = await fetch(`/api/check?url=${encodeURIComponent(site.url)}`);
        const data = await response.json();

        const newStatus = data.status || 'down';
        const newLatency = typeof data.response_time_ms === 'number' ? data.response_time_ms : 0;
        const newCode = data.status_code || (newStatus === 'up' ? 200 : 503);
        const checkedAt = data.checked_at || new Date().toISOString();

        websites[index].status = newStatus;
        websites[index].latency = newLatency;
        websites[index].statusCode = newCode;
        websites[index].lastChecked = checkedAt;

        // Keep last 15 latency data points
        websites[index].history = websites[index].history || [];
        if (newLatency > 0) {
            websites[index].history.push(newLatency);
            if (websites[index].history.length > 15) {
                websites[index].history.shift();
            }
        }

        // Trigger notifications if status changed
        if (prevStatus === 'up' && newStatus === 'down') {
            sendNotification(`⚠️ Alert: ${getDomainFromUrl(site.url)} is DOWN! (Code: ${newCode})`);
        } else if (prevStatus === 'down' && newStatus === 'up') {
            showToast(`🟢 Recovered: ${getDomainFromUrl(site.url)} is back UP!`, 'success');
        }

        // Sync updated metrics to central database
        fetch(`/api/websites/${targetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: newStatus,
                latency: newLatency,
                statusCode: newCode,
                lastChecked: checkedAt,
                history: websites[index].history
            })
        }).catch(() => {});

    } catch (err) {
        console.error(`Check error for ${site.url}:`, err);
        websites[index].status = 'down';
        websites[index].latency = 0;
        websites[index].statusCode = 503;
        websites[index].lastChecked = new Date().toISOString();

        fetch(`/api/websites/${targetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'down',
                latency: 0,
                statusCode: 503,
                lastChecked: websites[index].lastChecked,
                history: websites[index].history || []
            })
        }).catch(() => {});
    }

    saveData();
    renderDashboard();
}

/**
 * Trigger check for single site from row button
 */
async function handleSingleCheck(id) {
    const btn = document.getElementById(`btn-check-${id}`);
    if (btn) btn.classList.add('spinning');

    await checkSingleWebsite(id);

    if (btn) btn.classList.remove('spinning');
    showToast('Status check completed', 'info');
}

/**
 * Trigger check for all registered websites
 */
async function checkAllWebsites() {
    if (websites.length === 0) return;

    for (const site of websites) {
        await checkSingleWebsite(site.id);
    }
}

/**
 * Manual Refresh All button handler with UI feedback
 */
async function handleRefreshAll() {
    if (isRefreshingAll) return;
    if (websites.length === 0) {
        showToast('No websites to refresh. Add one first!', 'info');
        return;
    }

    isRefreshingAll = true;
    const btn = document.getElementById('btnRefreshAll');
    if (btn) btn.classList.add('loading');

    showToast('Refreshing all monitored websites...', 'info');

    try {
        await checkAllWebsites();
        showToast('All websites refreshed successfully', 'success');
    } catch (e) {
        console.error('Refresh all error:', e);
        showToast('Completed with some network warnings', 'info');
    } finally {
        if (btn) btn.classList.remove('loading');
        isRefreshingAll = false;
    }
}

// ==========================================================================
// NOTIFICATIONS & TOAST SYSTEM
// ==========================================================================

function showToast(message, type = 'success') {
    // Toast notifications completely disabled per user request
    return;
}

function sendNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('NEXCT Monitoring Alert', {
                body: message,
                icon: 'favicon/favicon-96x96.png'
            });
        } catch (e) {
            console.error('Notification error:', e);
        }
    }
}

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

function getDomainFromUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch {
        return url.replace(/^https?:\/\//i, '').split('/')[0];
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('URL copied to clipboard!', 'info');
        }).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    try {
        document.execCommand('copy');
        showToast('URL copied to clipboard!', 'info');
    } catch {
        showToast('Failed to copy URL', 'error');
    }
    document.body.removeChild(temp);
}

function formatRelativeTime(isoString) {
    if (!isoString) return 'Pending check';

    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffSec = Math.floor((now - date) / 1000);

        if (diffSec < 10) return 'Just now';
        if (diffSec < 60) return `${diffSec}s ago`;

        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;

        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `${diffHour}h ago`;

        return `${Math.floor(diffHour / 24)}d ago`;
    } catch {
        return 'Recently';
    }
}

function formatTimeOnly(isoString) {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
        return '';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}