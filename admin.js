/**
 * ADMIN PANEL
 * Handles authentication, dashboard, and lead management
 */

(function() {
  'use strict';

  // =============================================
  // DOM REFS
  // =============================================
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  // =============================================
  // STATE
  // =============================================
  let currentTab = 'contacts';
  let allContacts = [];
  let allValuations = [];
  let searchQuery = '';

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatStatus(status) {
    const map = {
      'new': 'New',
      'called': 'Called',
      'inprogress': 'In Progress',
      'closed': 'Closed',
      'reportsent': 'Report Sent',
      'lost': 'Lost'
    };
    return map[status] || status || 'New';
  }

  function getStatusClass(status) {
    const map = {
      'new': 'status-badge-new',
      'called': 'status-badge-called',
      'inprogress': 'status-badge-inprogress',
      'closed': 'status-badge-closed',
      'reportsent': 'status-badge-reportsent',
      'lost': 'status-badge-lost'
    };
    return map[status] || 'status-badge-new';
  }

  function getInterestClass(interest) {
    const map = {
      'buying': 'interest-badge buying',
      'selling': 'interest-badge selling',
      'both': 'interest-badge both',
      'investing': 'interest-badge investing'
    };
    return map[interest] || '';
  }

  function formatInterest(interest) {
    const map = {
      'buying': 'Buying',
      'selling': 'Selling',
      'both': 'Both',
      'investing': 'Investing'
    };
    return map[interest] || interest || '—';
  }

  function truncateText(text, maxLength = 50) {
    if (!text) return '—';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function getStatusOptions(type) {
    if (type === 'contact') {
      return ['new', 'called', 'closed', 'lost'];
    } else {
      return ['new', 'inprogress', 'reportsent', 'lost'];
    }
  }

  // =============================================
  // 1. AUTHENTICATION
  // =============================================

  function showLoginForm() {
    const loginPage = $('#loginPage');
    const dashboardPage = $('#dashboardPage');
    if (loginPage) loginPage.classList.remove('hidden');
    if (dashboardPage) dashboardPage.classList.add('hidden');
    
    // Reset login form
    const form = $('#loginForm');
    if (form) form.reset();
    const error = $('#loginError');
    if (error) error.classList.add('hidden');
  }

  function showDashboard() {
    const loginPage = $('#loginPage');
    const dashboardPage = $('#dashboardPage');
    if (loginPage) loginPage.classList.add('hidden');
    if (dashboardPage) dashboardPage.classList.remove('hidden');
  }

  function setupLogin() {
    const form = $('#loginForm');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const username = $('#loginUsername');
      const password = $('#loginPassword');
      const error = $('#loginError');
      const btn = $('#loginBtn');
      const btnText = btn.querySelector('.btn-text');
      const btnSpinner = btn.querySelector('.btn-spinner');

      // Validate
      let valid = true;
      [username, password].forEach(field => {
        field.classList.remove('error');
        if (!field.value.trim()) {
          field.classList.add('error');
          valid = false;
        }
      });

      if (!valid) return;

      // Submit
      btn.disabled = true;
      btnText.textContent = 'Signing in...';
      btnSpinner.classList.remove('hidden');
      error.classList.add('hidden');

      try {
        const response = await fetch(CONFIG.workerUrl + '/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.value.trim(),
            password: password.value.trim(),
            clientId: CONFIG.clientId
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Invalid credentials');
        }

        if (data.success && data.token) {
          localStorage.setItem('adminToken', data.token);
          localStorage.setItem('adminClientId', CONFIG.clientId);
          showDashboard();
          loadDashboardData();
        } else {
          throw new Error('Invalid response');
        }

      } catch (err) {
        console.error('Login error:', err);
        error.classList.remove('hidden');
        error.querySelector('.error-text').textContent = err.message || 'Invalid username or password. Please try again.';
        // Shake animation
        const card = document.querySelector('.login-card');
        if (card) {
          card.style.animation = 'none';
          void card.offsetHeight;
          card.style.animation = 'shake 0.5s ease-in-out';
        }
      } finally {
        btn.disabled = false;
        btnText.textContent = 'Sign In';
        btnSpinner.classList.add('hidden');
      }
    });

    // Password toggle
    const toggle = $('#passwordToggle');
    if (toggle) {
      toggle.addEventListener('click', function() {
        const input = $('#loginPassword');
        if (input) {
          const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
          input.setAttribute('type', type);
          this.querySelector('.toggle-icon').textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
        }
      });
    }
  }

  // =============================================
  // 2. VERIFY SESSION
  // =============================================

  async function verifySession() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      showLoginForm();
      return false;
    }

    try {
      const response = await fetch(CONFIG.workerUrl + '/admin/verify', {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });

      if (!response.ok) {
        throw new Error('Session expired');
      }

      const data = await response.json();
      if (data.valid) {
        // Set agent name
        const nameEl = $('#adminAgentName');
        if (nameEl && data.agentName) {
          nameEl.textContent = data.agentName;
        } else if (nameEl) {
          nameEl.textContent = CONFIG.agentName;
        }
        showDashboard();
        loadDashboardData();
        return true;
      } else {
        throw new Error('Invalid session');
      }

    } catch (err) {
      console.error('Session verification error:', err);
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminClientId');
      showLoginForm();
      return false;
    }
  }

  // =============================================
  // 3. LOAD DASHBOARD DATA
  // =============================================

  async function loadDashboardData() {
    await Promise.all([
      loadContacts(),
      loadValuations()
    ]);
    updateStats();
  }

  // =============================================
  // 4. LOAD CONTACTS
  // =============================================

  async function loadContacts() {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const skeleton = $('#contactsSkeleton');
    const body = $('#contactsBody');
    const empty = $('#contactsEmpty');

    // Show skeleton
    if (skeleton) skeleton.classList.remove('hidden');
    if (body) body.innerHTML = '';
    if (empty) empty.classList.add('hidden');

    try {
      const response = await fetch(CONFIG.workerUrl + '/admin/leads', {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });

      if (!response.ok) throw new Error('Failed to load leads');

      const data = await response.json();
      allContacts = data.leads || [];

      // Update badge
      const badge = $('#contactBadge');
      if (badge) {
        const newCount = allContacts.filter(c => c.status === 'new').length;
        badge.textContent = newCount;
      }

      renderContacts(allContacts);

    } catch (err) {
      console.error('Load contacts error:', err);
      if (body) {
        body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-light);">⚠️ Error loading leads. Please refresh.</td></tr>`;
      }
    } finally {
      if (skeleton) skeleton.classList.add('hidden');
    }
  }

  // =============================================
  // 5. RENDER CONTACTS TABLE
  // =============================================

  function renderContacts(contacts) {
    const body = $('#contactsBody');
    const empty = $('#contactsEmpty');
    const filtered = filterData(contacts, searchQuery, 'contact');

    if (!body) return;

    if (filtered.length === 0) {
      body.innerHTML = '';
      if (empty) {
        empty.classList.remove('hidden');
        empty.querySelector('h4').textContent = contacts.length === 0 ? 'No leads yet' : 'No matches found';
        empty.querySelector('p').textContent = contacts.length === 0 ? 'Contact leads will appear here as they come in' : 'Try adjusting your search';
      }
      return;
    }

    if (empty) empty.classList.add('hidden');

    body.innerHTML = filtered.map((lead, index) => `
      <tr data-id="${lead.id}" data-type="contact">
        <td class="row-number">${index + 1}</td>
        <td><strong>${escapeHtml(lead.visitor_name || '—')}</strong></td>
        <td><a href="mailto:${escapeHtml(lead.visitor_email || '')}" style="color:var(--primary);">${escapeHtml(lead.visitor_email || '—')}</a></td>
        <td>${lead.visitor_phone ? `<a href="tel:${escapeHtml(lead.visitor_phone)}" style="color:var(--text-medium);">${escapeHtml(lead.visitor_phone)}</a>` : '—'}</td>
        <td><span class="${getInterestClass(lead.interested_in)}">${formatInterest(lead.interested_in)}</span></td>
        <td><span class="truncate-text" onclick="window.toggleMessage(this)" title="${escapeHtml(lead.message || '')}">${escapeHtml(truncateText(lead.message, 40))}</span></td>
        <td>${formatDate(lead.created_at)}</td>
        <td>
          <select class="status-badge ${getStatusClass(lead.status)}" 
                  onchange="window.updateStatus(this, ${lead.id}, 'contact')"
                  data-original="${lead.status || 'new'}">
            ${getStatusOptions('contact').map(s => 
              `<option value="${s}" ${(lead.status || 'new') === s ? 'selected' : ''}>${formatStatus(s)}</option>`
            ).join('')}
          </select>
        </td>
      </tr>
    `).join('');
  }

  // =============================================
  // 6. LOAD VALUATIONS
  // =============================================

  async function loadValuations() {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const skeleton = $('#valuationsSkeleton');
    const body = $('#valuationsBody');
    const empty = $('#valuationsEmpty');

    // Show skeleton
    if (skeleton) skeleton.classList.remove('hidden');
    if (body) body.innerHTML = '';
    if (empty) empty.classList.add('hidden');

    try {
      const response = await fetch(CONFIG.workerUrl + '/admin/valuations', {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });

      if (!response.ok) throw new Error('Failed to load valuations');

      const data = await response.json();
      allValuations = data.valuations || [];

      // Update badge
      const badge = $('#valuationBadge');
      if (badge) {
        const newCount = allValuations.filter(v => v.status === 'new' || v.status === 'inprogress').length;
        badge.textContent = newCount;
      }

      renderValuations(allValuations);

    } catch (err) {
      console.error('Load valuations error:', err);
      if (body) {
        body.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-light);">⚠️ Error loading valuations. Please refresh.</td></tr>`;
      }
    } finally {
      if (skeleton) skeleton.classList.add('hidden');
    }
  }

  // =============================================
  // 7. RENDER VALUATIONS TABLE
  // =============================================

  function renderValuations(valuations) {
    const body = $('#valuationsBody');
    const empty = $('#valuationsEmpty');
    const filtered = filterData(valuations, searchQuery, 'valuation');

    if (!body) return;

    if (filtered.length === 0) {
      body.innerHTML = '';
      if (empty) {
        empty.classList.remove('hidden');
        empty.querySelector('h4').textContent = valuations.length === 0 ? 'No valuations yet' : 'No matches found';
        empty.querySelector('p').textContent = valuations.length === 0 ? 'Valuation requests will appear here as they come in' : 'Try adjusting your search';
      }
      return;
    }

    if (empty) empty.classList.add('hidden');

    body.innerHTML = filtered.map((val, index) => `
      <tr data-id="${val.id}" data-type="valuation">
        <td class="row-number">${index + 1}</td>
        <td><strong>${escapeHtml(val.visitor_name || '—')}</strong></td>
        <td><a href="mailto:${escapeHtml(val.visitor_email || '')}" style="color:var(--primary);">${escapeHtml(val.visitor_email || '—')}</a></td>
        <td>${val.visitor_phone ? `<a href="tel:${escapeHtml(val.visitor_phone)}" style="color:var(--text-medium);">${escapeHtml(val.visitor_phone)}</a>` : '—'}</td>
        <td style="max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(val.property_address || '')}">${escapeHtml(val.property_address || '—')}</td>
        <td>${escapeHtml(val.property_city || '—')}</td>
        <td>${val.bedrooms || '—'} / ${val.bathrooms || '—'}</td>
        <td>${escapeHtml(val.condition || '—')}</td>
        <td>${val.sqft || '—'}</td>
        <td>${formatDate(val.created_at)}</td>
        <td>
          <select class="status-badge ${getStatusClass(val.status)}" 
                  onchange="window.updateStatus(this, ${val.id}, 'valuation')"
                  data-original="${val.status || 'new'}">
            ${getStatusOptions('valuation').map(s => 
              `<option value="${s}" ${(val.status || 'new') === s ? 'selected' : ''}>${formatStatus(s)}</option>`
            ).join('')}
          </select>
        </td>
      </tr>
    `).join('');
  }

  // =============================================
  // 8. FILTER DATA
  // =============================================

  function filterData(data, query, type) {
    if (!query.trim()) return data;

    const q = query.toLowerCase().trim();
    return data.filter(item => {
      const searchable = [
        item.visitor_name,
        item.visitor_email,
        item.visitor_phone,
        item.property_address,
        item.property_city,
        item.message,
        item.interested_in
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }

  // =============================================
  // 9. UPDATE STATUS
  // =============================================

  window.updateStatus = async function(select, id, type) {
    const newStatus = select.value;
    const original = select.dataset.original;
    const token = localStorage.getItem('adminToken');

    // Optimistic update
    select.disabled = true;
    select.className = 'status-badge ' + getStatusClass(newStatus);

    try {
      const response = await fetch(CONFIG.workerUrl + '/admin/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ id, type, status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update status');

      // Success - highlight row
      const row = select.closest('tr');
      if (row) {
        row.classList.add('highlight');
        setTimeout(() => row.classList.remove('highlight'), 1500);
      }

      // Update original
      select.dataset.original = newStatus;

      // Update badge counts
      updateStats();

    } catch (err) {
      console.error('Status update error:', err);
      // Revert
      select.className = 'status-badge ' + getStatusClass(original);
      select.value = original;
      alert('Failed to update status. Please try again.');
    } finally {
      select.disabled = false;
    }
  };

  // =============================================
  // 10. TOGGLE MESSAGE EXPAND
  // =============================================

  window.toggleMessage = function(el) {
    el.classList.toggle('expanded');
    el.title = el.classList.contains('expanded') ? 'Click to collapse' : el.textContent;
  };

  // =============================================
  // 11. UPDATE STATS
  // =============================================

  function updateStats() {
    // Total leads
    const totalLeads = $('#totalLeads');
    if (totalLeads) totalLeads.textContent = allContacts.length;

    // New leads this week
    const newLeads = $('#newLeads');
    if (newLeads) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const count = allContacts.filter(c => new Date(c.created_at) > weekAgo).length;
      newLeads.textContent = count;
    }

    // Total valuations
    const totalValuations = $('#totalValuations');
    if (totalValuations) totalValuations.textContent = allValuations.length;

    // Closed deals (approximate from contacts with 'closed' status)
    const closedDeals = $('#closedDeals');
    if (closedDeals) {
      const count = allContacts.filter(c => c.status === 'closed').length;
      closedDeals.textContent = count;
    }
  }

  // =============================================
  // 12. SEARCH
  // =============================================

  function setupSearch() {
    const input = $('#searchInput');
    const clear = $('#searchClear');

    if (!input) return;

    input.addEventListener('input', function() {
      searchQuery = this.value;
      if (clear) {
        clear.classList.toggle('hidden', !this.value);
      }
      filterTable();
    });

    if (clear) {
      clear.addEventListener('click', function() {
        input.value = '';
        searchQuery = '';
        this.classList.add('hidden');
        filterTable();
        input.focus();
      });
    }
  }

  function filterTable() {
    if (currentTab === 'contacts') {
      renderContacts(allContacts);
    } else {
      renderValuations(allValuations);
    }
  }

  // =============================================
  // 13. TAB SWITCHING
  // =============================================

  function setupTabs() {
    const tabs = $$('.admin-tab');

    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        const tabName = this.dataset.tab;
        switchTab(tabName);
      });
    });
  }

  function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    $$('.admin-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update content
    $$('.admin-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === tabName + 'Tab');
    });

    // Clear search
    const input = $('#searchInput');
    if (input) {
      input.value = '';
      searchQuery = '';
      const clear = $('#searchClear');
      if (clear) clear.classList.add('hidden');
    }

    // Refresh data if needed
    if (tabName === 'contacts' && allContacts.length === 0) {
      loadContacts();
    } else if (tabName === 'valuations' && allValuations.length === 0) {
      loadValuations();
    } else {
      filterTable();
    }
  }

  // =============================================
  // 14. LOGOUT
  // =============================================

  function setupLogout() {
    const btn = $('#logoutBtn');
    if (!btn) return;

    btn.addEventListener('click', async function() {
      if (!confirm('Are you sure you want to logout?')) return;

      const token = localStorage.getItem('adminToken');

      try {
        if (token) {
          await fetch(CONFIG.workerUrl + '/admin/logout', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token
            }
          });
        }
      } catch (err) {
        console.error('Logout error:', err);
      }

      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminClientId');
      showLoginForm();
    });
  }

  // =============================================
  // 15. ESCAPE HTML
  // =============================================

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // =============================================
  // 16. KEYBOARD SHORTCUTS
  // =============================================

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      // Ctrl+1 for contacts, Ctrl+2 for valuations
      if (e.ctrlKey && e.key === '1') {
        e.preventDefault();
        switchTab('contacts');
      }
      if (e.ctrlKey && e.key === '2') {
        e.preventDefault();
        switchTab('valuations');
      }
      // Escape to clear search
      if (e.key === 'Escape') {
        const input = $('#searchInput');
        if (input && document.activeElement === input) {
          input.value = '';
          searchQuery = '';
          const clear = $('#searchClear');
          if (clear) clear.classList.add('hidden');
          filterTable();
          input.blur();
        }
      }
      // Ctrl+F to focus search
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const input = $('#searchInput');
        if (input) {
          input.focus();
          input.select();
        }
      }
    });
  }

  // =============================================
  // 17. REFRESH DATA
  // =============================================

  function setupAutoRefresh() {
    // Refresh data every 60 seconds
    setInterval(() => {
      if (!document.hidden) {
        loadDashboardData();
      }
    }, 60000);
  }

  // =============================================
  // 18. INITIALIZATION
  // =============================================

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  }

  function initApp() {
    // Check CONFIG
    if (typeof CONFIG === 'undefined') {
      console.error('CONFIG not loaded. Check config.js file.');
      return;
    }

    // Setup authentication
    setupLogin();
    setupLogout();
    setupTabs();
    setupSearch();
    setupKeyboardShortcuts();
    setupAutoRefresh();

    // Check session
    verifySession();

    // Expose functions globally
    window.switchTab = switchTab;
    window.loadContacts = loadContacts;
    window.loadValuations = loadValuations;

    console.log('🔐 Admin panel initialized successfully.');
  }

  // Start the application
  if (typeof window !== 'undefined') {
    init();
  }

})();
