// ClickUp API Integration
// Uses OAuth via Render backend — no personal API key needed.

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

// Lead Allocator ClickUp Custom App client ID (safe to expose)
const CLICKUP_CLIENT_ID = 'GXLOAPT91242XUNR8ODIXZBATBNS4RXC';

// Render handles the OAuth redirect and token exchange
const CLICKUP_REDIRECT_URI = 'https://clickup-auth-proxy.onrender.com';

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getOAuthToken() {
  return localStorage.getItem('clickup_oauth_token');
}

function isConnected() {
  return !!getOAuthToken();
}

function connectClickUp() {
  const authUrl =
    `https://app.clickup.com/api?client_id=${CLICKUP_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(CLICKUP_REDIRECT_URI)}`;
  window.location.href = authUrl;
}

function disconnectClickUp() {
  localStorage.removeItem('clickup_oauth_token');
  updateConnectButton();
}

// Check URL hash for token after OAuth redirect from Render
function checkForTokenInUrl() {
  const hash = window.location.hash;
  if (hash.includes('clickup_token=')) {
    const token = decodeURIComponent(hash.split('clickup_token=')[1].split('&')[0]);
    if (token) {
      localStorage.setItem('clickup_oauth_token', token);
      history.replaceState(null, '', window.location.pathname + window.location.search);
      updateConnectButton();
      console.log('[ClickUp] OAuth success — token saved');
    }
  }

  // Check for errors
  const params = new URLSearchParams(window.location.search);
  const error = params.get('clickup_error');
  if (error) {
    console.error('[ClickUp] OAuth error:', error);
    alert('ClickUp connection failed: ' + error + '. Please try again.');
    history.replaceState(null, '', window.location.pathname);
  }
}

function updateConnectButton() {
  const btn = document.getElementById('connectClickUpBtn');
  if (!btn) return;
  if (isConnected()) {
    btn.textContent = '✓ ClickUp Connected';
    btn.style.backgroundColor = '#22c55e';
    btn.style.color = '#fff';
    btn.onclick = () => {
      if (confirm('Disconnect ClickUp?')) disconnectClickUp();
    };
  } else {
    btn.textContent = 'Connect ClickUp';
    btn.style.backgroundColor = '';
    btn.style.color = '';
    btn.onclick = connectClickUp;
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
  checkForTokenInUrl();
  updateConnectButton();
});

// ── API call helper ───────────────────────────────────────────────────────────

async function clickupFetch(path, options = {}) {
  const token = getOAuthToken();
  if (!token) {
    alert('Please connect your ClickUp account first.');
    return null;
  }

  const response = await fetch(`${CLICKUP_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    localStorage.removeItem('clickup_oauth_token');
    updateConnectButton();
    alert('ClickUp session expired. Please reconnect.');
    return null;
  }

  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status}`);
  }

  return response.json();
}

// ── Lead allocation functions ─────────────────────────────────────────────────

async function fetchUnassignedLeads() {
  try {
    const data = await clickupFetch(
      `/list/${CLICKUP_CONFIG.listId}/task?assignee=0&include_subtasks=false`
    );
    return data ? (data.tasks || []) : [];
  } catch (error) {
    console.error('Error fetching unassigned leads:', error);
    alert('Failed to fetch unassigned leads from ClickUp');
    return [];
  }
}

async function assignLeadsToSalesperson(taskIds, userId) {
  try {
    for (const taskId of taskIds) {
      const result = await clickupFetch(`/task/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          assignees: [{ id: parseInt(userId) }]
        }),
      });
      if (!result) return false;
    }
    return true;
  } catch (error) {
    console.error('Error assigning leads:', error);
    return false;
  }
}

async function syncToClickUp() {
  const date = allocationDateInput.value;
  if (!date) {
    alert('Please select a date first.');
    return;
  }

  if (!isConnected()) {
    alert('Please connect your ClickUp account first.');
    connectClickUp();
    return;
  }

  const rows = calculateAllocation();
  if (rows.length === 0) {
    alert('Please add salespeople and calculate allocation.');
    return;
  }

  const syncBtn = document.getElementById('syncClickUpBtn');
  const originalText = syncBtn.textContent;
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing...';

  try {
    const unassignedLeads = await fetchUnassignedLeads();

    if (unassignedLeads.length === 0) {
      alert('No unassigned leads found in ClickUp.');
      return;
    }

    let totalAssigned = 0;
    let leadsIndex = 0;

    for (const person of rows) {
      if (person.final === 0 || !person.name.trim()) continue;

      const salesPersonConfig = CLICKUP_CONFIG.salespeople.find(
        sp => sp.name.toLowerCase() === person.name.toLowerCase()
      );

      if (!salesPersonConfig) {
        console.warn(`Salesperson ${person.name} not found in config`);
        continue;
      }

      const tasksToAssign = unassignedLeads
        .slice(leadsIndex, leadsIndex + person.final)
        .map(task => task.id);

      if (tasksToAssign.length === 0) {
        console.warn(`Not enough unassigned leads for ${person.name}`);
        break;
      }

      const success = await assignLeadsToSalesperson(tasksToAssign, salesPersonConfig.userId);

      if (success) {
        totalAssigned += tasksToAssign.length;
        leadsIndex += tasksToAssign.length;
      } else {
        throw new Error(`Failed to assign leads to ${person.name}`);
      }
    }

    alert(`Successfully assigned ${totalAssigned} leads to salespeople in ClickUp!`);

  } catch (error) {
    console.error('Sync error:', error);
    alert(`Error syncing to ClickUp: ${error.message}`);
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = originalText;
  }
}
