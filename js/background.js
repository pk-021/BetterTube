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

// Initialize settings (set defaults if none exist)
chrome.storage.local.get(null, (existing) => {
  if (!Object.keys(existing).length) {
    chrome.storage.local.set(defaultSettings);
  } else {
    const merged = { ...defaultSettings, ...existing };
    chrome.storage.local.set(merged);
  }
});

// --- Redirect rules ---
const subscriptionRedirectRules = [
  {
    id: 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { url: "https://www.youtube.com/feed/subscriptions" }
    },
    condition: {
      urlFilter: "youtube.com/feed/trending",
      resourceTypes: ["main_frame"]
    }
  },
  {
    id: 2,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { url: "https://www.youtube.com/feed/subscriptions" }
    },
    condition: {
      urlFilter: "youtube.com/shorts",
      resourceTypes: ["main_frame"]
    }
  },
  {
    id: 3,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { url: "https://www.youtube.com/feed/subscriptions" }
    },
    condition: {
      regexFilter: "^https://(www\\.)?youtube\\.com/?$",
      resourceTypes: ["main_frame"]
    }
  }
];

// --- Rule management ---
function enableRedirects() {
  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: subscriptionRedirectRules,
    removeRuleIds: subscriptionRedirectRules.map(r => r.id)
  }).then(() => console.log("Redirect rules enabled"))
    .catch(err => console.error("Failed to enable redirect rules:", err));
}

function disableRedirects() {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: subscriptionRedirectRules.map(r => r.id)
  }).then(() => console.log("Redirect rules disabled"))
    .catch(err => console.error("Failed to disable redirect rules:", err));
}

// --- Message handling ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "toggleRedirects") {
    msg.enabled ? enableRedirects() : disableRedirects();
  }
});
