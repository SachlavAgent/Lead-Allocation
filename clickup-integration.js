// ClickUp API Integration
const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

async function getClickUpApiKey() {
  try {
    const response = await fetch('/.github/workflows/get-secret.js');
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    console.log('Using environment variable for API key');
  }
  return localStorage.getItem('clickupApiKey');
}

async function fetchUnassignedLeads() {
  const apiKey = await getClickUpApiKey();
  if (!apiKey) {
    alert('ClickUp API key not configured. Please add it to GitHub Secrets.');
    return [];
  }

  try {
    const response = await fetch(
      `${CLICKUP_API_BASE}/list/${CLICKUP_CONFIG.listId}/task?assignee=0&include_subtasks=false`,
      {
        headers: { 'Authorization': apiKey }
      }
    );

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    
    const data = await response.json();
    return data.tasks || [];
  } catch (error) {
    console.error('Error fetching unassigned leads:', error);
    alert('Failed to fetch unassigned leads from ClickUp');
    return [];
  }
}

async function assignLeadsToSalesperson(taskIds, userId) {
  const apiKey = await getClickUpApiKey();
  if (!apiKey) return false;

  try {
    for (const taskId of taskIds) {
      const response = await fetch(
        `${CLICKUP_API_BASE}/task/${taskId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            assignees: [{ id: parseInt(userId) }]
          })
        }
      );

      if (!response.ok) throw new Error(`Failed to assign task ${taskId}`);
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

  const rows = calculateAllocation();
  if (rows.length === 0) {
    alert('Please add salespeople and calculate allocation.');
    return;
  }

  // Show loading state
  const syncBtn = document.getElementById('syncClickUpBtn');
  const originalText = syncBtn.textContent;
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing...';

  try {
    // Fetch unassigned leads
    const unassignedLeads = await fetchUnassignedLeads();
    
    if (unassignedLeads.length === 0) {
      alert('No unassigned leads found in ClickUp.');
      return;
    }

    let totalAssigned = 0;
    let leadsIndex = 0;

    // Assign leads to each salesperson
    for (const person of rows) {
      if (person.final === 0 || !person.name.trim()) continue;

      // Find the salesperson in config
      const salesPersonConfig = CLICKUP_CONFIG.salespeople.find(
        sp => sp.name.toLowerCase() === person.name.toLowerCase()
      );

      if (!salesPersonConfig) {
        console.warn(`Salesperson ${person.name} not found in config`);
        continue;
      }

      // Get task IDs to assign
      const tasksToAssign = unassignedLeads
        .slice(leadsIndex, leadsIndex + person.final)
        .map(task => task.id);

      if (tasksToAssign.length === 0) {
        console.warn(`Not enough unassigned leads for ${person.name}`);
        break;
      }

      // Assign leads
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

// Store API key in localStorage (user can set this manually for now)
function setClickUpApiKey(apiKey) {
  localStorage.setItem('clickupApiKey', apiKey);
  alert('ClickUp API key saved!');
}
assignLeadsToSalespeople();
