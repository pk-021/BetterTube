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

// --- Listen for messages ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "toggleRedirects") {
    msg.enabled ? enableHomeRedirects() : disableHomeRedirects();
  } else if (msg.type === "toggleShorts") {
    // fixed typo 'elabled' → 'enabled'
    msg.enabled ? enableShortsRedirects() : disableShortsRedirects();
  }
});
