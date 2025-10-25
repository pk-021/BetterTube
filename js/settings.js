// --- Notification Helper ---
function showNotification(message, type = 'info') {
    if (chrome && chrome.notifications) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/logo_v2.png',
            title: 'BTube',
            message: message
        });
    }
}

// --- Get dark mode preference ---
function applyDarkMode() {
    chrome.storage.local.get("darkModeEnabled", (data) => {
        if (data.darkModeEnabled) {
            document.documentElement.setAttribute("dark_mode", "true");
        } else {
            document.documentElement.removeAttribute("dark_mode");
        }
    });
}



// Mapping HTML checkbox IDs -> Storage keys
const settingsMap = {
    "extension-online": "BTubeOn",
    "redirect-subscriptions": "redirect_home",
    "disable-shorts": "hide_shorts",
    "minimal-homepage": "minimal_homepage"
};



// --- Load and attach listeners ---
function initSettingsToggles() {
    chrome.storage.local.get(Object.values(settingsMap), (result) => {
        for (const [checkboxId, storageKey] of Object.entries(settingsMap)) {
            const checkbox = document.getElementById(checkboxId);
            if (!checkbox) continue;

            // Load saved state
            checkbox.checked = !!result[storageKey];

            // Save changes on toggle
            checkbox.addEventListener("change", () => {
                const newValue = checkbox.checked;
                chrome.storage.local.set({ [storageKey]: newValue });
                // Only show notification for non-dark mode settings
                const settingNames = {
                    "extension-online": "Extension",
                    "redirect-subscriptions": "Redirect to Subscriptions",
                    "disable-shorts": "Disable Shorts",
                    "minimal-homepage": "Minimal Homepage"
                };
                // Do not notify for dark mode
                if (settingNames.hasOwnProperty(checkboxId)) {
                    const settingName = settingNames[checkboxId];
                    showNotification(`${settingName} ${newValue ? 'enabled' : 'disabled'}`, 'info');
                }
            });
        }
    });
}



// ======================
// Init
// ======================

window.addEventListener("DOMContentLoaded", () => {
    applyDarkMode();
    initSettingsToggles();

    // Short delay to allow initial paint
    setTimeout(() => {
        document.body.setAttribute("data-loaded", "true");
    }, 50);
});