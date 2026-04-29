// ClickUp API Integration
// Updated to use OAuth token instead of personal API key.

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

// Your ClickUp Custom App client ID (the SAME app you created for the mobile app)
// This is safe to have in frontend code.
const CLICKUP_CLIENT_ID = 'R6XIXNRA9367UQK6LBGWGT1OFH50UP4J';
const CLICKUP_REDIRECT_URI = 'https://sachlavagent.github.io/Lead-Allocation/callback.html';

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

function updateConnectButton() {
  const btn = document.getElementById('connectClickUpBtn');
  if (!btn) return;
  if (isConnected()) {
    btn.textContent = '✓ ClickUp Connected';
    btn.style.backgroundColor = '#22c55e';
    btn.onclick = () => {
      if (confirm('Disconnect ClickUp?')) disconnectClickUp();
    };
  } else {
    btn.textContent = 'Connect ClickUp';
    btn.style.backgroundColor = '';
    btn.onclick = connectClickUp;
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', updateConnectButton);

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
    // Token expired — clear it and prompt reconnect
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

// ── Existing functions (updated to use OAuth) ─────────────────────────────────

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

    alert(`✓ Successfully assigned ${totalAssigned} leads to salespeople in ClickUp!`);

  } catch (error) {
    console.error('Sync error:', error);
    alert(`Error syncing to ClickUp: ${error.message}`);
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = originalText;
  }
}
