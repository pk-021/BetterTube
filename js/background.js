"use strict";

let storage = chrome.storage.local;
let keepAliveInterval;

const defaultSettings = {
  hide_feed: true,
  hide_related: true,
  hide_comments: true,
  redirect_home: true,
  hide_trending: true,
  hide_shorts: true,
  BTubeOn: true,
  popup_states: {
    dark_mode: false,
    logged_in: false,
    first_login: true,
  },
};

// Helper functions
function getSettings(callback, keys = null) {
  storage.get(keys, (result) => {
    if (chrome.runtime.lastError) {
      storage = chrome.storage.local;
      storage.get(keys, (rslt) => callback(rslt));
    } else {
      callback(result);
    }
  });
}

function setSettings(data) {
  storage.set(data, () => {
    if (chrome.runtime.lastError) storage = chrome.storage.local, storage.set(data);
  });
}

// Initialize settings
getSettings((existing) => {
  if (!Object.keys(existing).length) {
    setSettings(defaultSettings);
  } else {
    Object.keys(defaultSettings).forEach((key) => {
      if (!(key in existing)) existing[key] = defaultSettings[key];
    });
    setSettings(existing);
  }
});

let currentSettings = {};
function updateCurrentSettings() {
  getSettings((settings) => {
    currentSettings = settings;
  });
}
updateCurrentSettings();


console.log("Service worker is working")


// // Redirect handling
// chrome.webRequest.onBeforeRequest.addListener(
//   ({ url, tabId }) => {
//     if (!currentSettings.BTubeOn) return;

//     if (
//       (currentSettings.hide_trending && /\/feed\/(trending|explore)/.test(url)) ||
//       (currentSettings.hide_shorts && /\/shorts\//.test(url))
//     ) {
//       const redirectUrl = currentSettings.redirect_home
//         ? "https://www.youtube.com/feed/subscriptions"
//         : "https://www.youtube.com";
//       chrome.tabs.update(tabId, { url: redirectUrl });
//     }

//     if (
//       currentSettings.hide_redirect_home &&
//       /^https:\/\/.*\.youtube\.com\/(?:\?.*)?$/.test(url)
//     ) {
//       chrome.tabs.update(tabId, { url: "https://www.youtube.com/feed/subscriptions" });
//     }
//   }
// );

