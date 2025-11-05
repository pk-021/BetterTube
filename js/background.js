"use strict";

console.log("Service worker is running");

// --- Default settings ---
const defaultSettings = {
  minimal_homepage: true,
  hide_feed: true,
  redirect_home: false,
  hide_shorts: true,
  BTubeOn: true
};

// --- Initialize settings (set defaults if none exist) ---
chrome.storage.local.get(null, (existing) => {
  const mergedSettings = { ...defaultSettings, ...existing };
  chrome.storage.local.set(mergedSettings);
});

// --- Redirect rules ---
const homeRedirectRules = [
  {
    id: 1,
    priority: 1,
    action: { type: "redirect", redirect: { url: "https://www.youtube.com/feed/subscriptions" } },
    condition: { urlFilter: "youtube.com/feed/trending", resourceTypes: ["main_frame"] }
  },
  {
    id: 2,
    priority: 1,
    action: { type: "redirect", redirect: { url: "https://www.youtube.com/feed/subscriptions" } },
    condition: { urlFilter: "youtube.com/shorts", resourceTypes: ["main_frame"] }
  },
  {
    id: 3,
    priority: 1,
    action: { type: "redirect", redirect: { url: "https://www.youtube.com/feed/subscriptions" } },
    condition: { regexFilter: "^https://(www\\.)?youtube\\.com/?$", resourceTypes: ["main_frame"] }
  }
];

const shortsRedirectRules = [
  {
    id: 4, // changed to unique ID
    priority: 1,
    action: { type: "redirect", redirect: { url: "https://www.youtube.com/feed/subscriptions" } },
    condition: { urlFilter: "youtube.com/shorts", resourceTypes: ["main_frame"] }
  }
];

// --- Rule management ---
async function updateRedirectRules(rulesToAdd, rulesToRemove) {
  try {
    console.group('[DNR] updateRedirectRules');
    console.log('About to update dynamic rules', {
      addCount: rulesToAdd?.length || 0,
      removeCount: rulesToRemove?.length || 0,
      removeRuleIds: rulesToRemove
    });
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rulesToAdd,
      removeRuleIds: rulesToRemove
    });
    // Verify the applied rules
    const allRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ids = allRules.map(r => r.id).sort((a,b)=>a-b);
    console.log('Dynamic rules now installed:', { count: allRules.length, ids });
    console.groupEnd();
  } catch (err) {
    console.groupEnd();
    console.error("[DNR] Failed to update redirect rules:", err);
  }
}

function enableHomeRedirects() {
  updateRedirectRules(homeRedirectRules, homeRedirectRules.map(r => r.id));
}

function disableHomeRedirects() {
  updateRedirectRules([], homeRedirectRules.map(r => r.id));
}

function enableShortsRedirects() {
  updateRedirectRules(shortsRedirectRules, shortsRedirectRules.map(r => r.id));
}

function disableShortsRedirects() {
  updateRedirectRules([], shortsRedirectRules.map(r => r.id));
}

// ===== Dynamic rules for user-blocked websites =====
const BLOCK_RULE_BASE_ID = 1000; // Reserve IDs >= 1000 for blocked website rules

// Escape a string for safe use inside a regex
function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build declarativeNetRequest rules from the blockedWebsites array
function buildBlockedWebsiteRules(blockedWebsites) {
  let nextId = BLOCK_RULE_BASE_ID;
  const rules = [];

  (blockedWebsites || []).forEach(entry => {
    if (!entry || !entry.url) return;
    const raw = String(entry.url).trim().toLowerCase();
    if (!raw) return;

    let regexFilter = null;

    if (raw.includes('/')) {
      // Full host + path entry (we preserved TLDs when a path exists)
      const [hostPart, ...pathParts] = raw.split('/');
      const hostEsc = escapeForRegex(hostPart);
      const pathEsc = escapeForRegex(pathParts.join('/'));
      // Match any subdomain of hostPart and the specific path (ignore query/hash)
      regexFilter = `^https?:\\/\\/(?:[a-z0-9-]+\\.)*${hostEsc}\\/${pathEsc}(?:[?#].*)?$`;
    } else {
      // Core domain only (no TLD) – match any TLD but require a label boundary
      const core = escapeForRegex(raw);
      // Ensure there's a dot right after the core label, so 'notcore.com' won't match
      regexFilter = `^https?:\\/\\/(?:[a-z0-9-]+\\.)*${core}\\.[a-z0-9.-]+(?:[\\/?#]|$)`;
    }

    try {
      rules.push({
        id: nextId++,
        priority: 1,
        action: { type: 'redirect', redirect: { url: 'https://www.google.com/' } },
        condition: {
          regexFilter,
          resourceTypes: ['main_frame']
        }
      });
    } catch (e) {
      // Skip invalid rule
      console.warn('Skipping invalid blocked website rule for', raw, e);
    }
  });

  return rules;
}

async function applyBlockedWebsiteRules(blockedWebsites) {
  console.group('[Blocks] Applying blocked website rules');
  console.log('Blocked websites input:', blockedWebsites);
  const rules = buildBlockedWebsiteRules(blockedWebsites);

  // Fetch previous rule ids from storage (so we can remove them)
  const prev = await chrome.storage.local.get(['btube_block_rule_ids']);
  const toRemove = Array.isArray(prev.btube_block_rule_ids) ? prev.btube_block_rule_ids : [];
  const toAdd = rules;

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: toAdd,
      removeRuleIds: toRemove
    });
    await chrome.storage.local.set({ btube_block_rule_ids: toAdd.map(r => r.id) });
    console.log(`Applied ${toAdd.length} blocked-website redirect rules`, {
      removedIds: toRemove,
      addedIds: toAdd.map(r => r.id),
      samples: toAdd.slice(0, 3).map(r => ({ id: r.id, regex: r.condition.regexFilter }))
    });

    // Verify install status and specifically our block rules range
    const allRules = await chrome.declarativeNetRequest.getDynamicRules();
    const blockRange = allRules.filter(r => r.id >= BLOCK_RULE_BASE_ID);
    console.log('Verification: dynamic rules count', allRules.length, 'blocked-range count', blockRange.length);
    console.groupEnd();
  } catch (err) {
    console.groupEnd();
    console.error('[Blocks] Failed updating blocked website rules:', err);
  }
}

// Initialize blocked website rules on startup
chrome.storage.local.get(['blockedWebsites'], (res) => {
  const list = res.blockedWebsites || [];
  console.log('[Startup] Initializing blocked website rules with', list.length, 'entries');
  applyBlockedWebsiteRules(list);
});

// Rebuild rules whenever the blocked list changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.blockedWebsites) {
    const list = changes.blockedWebsites.newValue || [];
    console.log('[Storage] blockedWebsites changed:', {
      oldLen: (changes.blockedWebsites.oldValue || []).length,
      newLen: list.length
    });
    applyBlockedWebsiteRules(list);
  }
});

// --- Notification system ---
function showOverlayNotification(message, type = 'info') {
  if (chrome && chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/logo_v2.png',
      title: 'BTube',
      message: message
    });
  }
}


// --- Listen for messages ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Background received message:', msg.type);
  
  if (msg.type === "toggleRedirects") {
    msg.enabled ? enableHomeRedirects() : disableHomeRedirects();
    sendResponse({ success: true });
  } else if (msg.type === "toggleShorts") {
    msg.enabled ? enableShortsRedirects() : disableShortsRedirects();
    sendResponse({ success: true });
  } else if (msg.type === "showNotification") {
    console.log('Processing notification request:', msg.message);
    // Handle async overlay notification
  showOverlayNotification(msg.message, msg.notificationType || 'info')
      .then(() => {
        console.log('Notification sent successfully');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Notification error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (msg.type === "checkOverlay") {
    // Diagnostic message
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(tabs => {
        if (tabs.length > 0) {
          return checkTabForOverlay(tabs[0].id);
        }
        throw new Error('No active tab');
      })
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ hasOverlay: false, error: error.message });
      });
    return true;
  }
  return false; // No async response needed for other messages
});
