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
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rulesToAdd,
      removeRuleIds: rulesToRemove
    });
    console.log("Redirect rules updated");
  } catch (err) {
    console.error("Failed to update redirect rules:", err);
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

// --- Overlay Notification system ---
async function showOverlayNotification(message, type = 'info') {
  try {
    // Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) throw new Error('No active tab found');
    const tab = tabs[0];
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      throw new Error('Cannot show overlay on this page type');
    }
    // Check for overlay and inject if needed
    const checkResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'ISOLATED',
      func: () => Boolean(window.btubeOverlay)
    });
    const hasOverlay = Array.isArray(checkResults) && checkResults[0] && checkResults[0].result === true;
    if (!hasOverlay) {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['css/overlay-notification.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'ISOLATED', files: ['js/overlay-notification.js'] });
      // Poll for ready
      let ready = false;
      for (let i = 0; i < 3 && !ready; i++) {
        await new Promise(r => setTimeout(r, 100 + i * 100));
        const readyResults = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'ISOLATED', func: () => Boolean(window.btubeOverlay) });
        ready = Array.isArray(readyResults) && readyResults[0] && readyResults[0].result === true;
      }
      if (!ready) throw new Error('Overlay failed to initialize');
    }
    // Show notification
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'ISOLATED',
      func: (msg, t) => { window.btubeOverlay && window.btubeOverlay.showNotification(msg, t); },
      args: [message, type]
    });
    return;
  } catch (error) {
    // Fallback: popup window, then Chrome notification
    try {
      await chrome.windows.create({ url: `notification.html?message=${encodeURIComponent(message)}&type=${type}`, type: 'popup', width: 340, height: 180, focused: true });
      return;
    } catch (windowError) {}
    try {
      await chrome.notifications.create({ type: 'basic', iconUrl: 'assets/logo_v2.png', title: 'BTube', message });
    } catch (notificationError) {}
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
