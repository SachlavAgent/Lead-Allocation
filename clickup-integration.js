// ClickUp OAuth Integration
// Handles ONLY the Connect ClickUp button and OAuth token storage.
// All API fetching is handled by script.js

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
