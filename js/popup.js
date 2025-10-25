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

// --- Dark Mode Toggle ---
const darkModeToggle = document.getElementById("darkModeToggle");

// Load dark mode state on popup open
chrome.storage.local.get("darkModeEnabled", (result) => {
    if (result.darkModeEnabled) {
        document.documentElement.setAttribute("dark_mode", "true");
    } else {
        document.documentElement.removeAttribute("dark_mode");
    }
});

// Toggle dark mode on click
darkModeToggle.addEventListener("click", () => {
    const isDark = document.documentElement.hasAttribute("dark_mode");

    if (isDark) {
        document.documentElement.removeAttribute("dark_mode");
    } else {
        document.documentElement.setAttribute("dark_mode", "true");
    }

    // Save preference
    chrome.storage.local.set({ darkModeEnabled: !isDark });
    
    // No notification for dark mode toggle
});



// Fetch bookmarks from storage
function renderBookmarksFromStorage() {
    chrome.storage.sync.get("bookmarks", (result) => {
        const folders = result.bookmarks || [];
        renderBookmarks(folders);
    });
}

// Render all folders and bookmarks
function renderBookmarks(folders) {
    const container = document.querySelector(".folder");
    if (!container) return;
    container.innerHTML = "";

    if (!folders || folders.length === 0) {
        const noMsg = document.createElement("p");
        noMsg.textContent = "No bookmarks";
        noMsg.className = "no-bookmarks";
        container.appendChild(noMsg);
        return;
    }

    folders.forEach((folder, folderIndex) => {
        const folderDiv = document.createElement("div");
        folderDiv.className = "fold";

        // --- Folder Header ---
        const header = document.createElement("div");
        header.className = "head collapsed";

        const titleSpan = document.createElement("span");
        titleSpan.className = "folder-title";
        titleSpan.textContent = folder.folderName || "Untitled Folder";
        header.appendChild(titleSpan);

        const actions = document.createElement("div");
        actions.className = "head-actions";

        const chevron = document.createElement("span");
        chevron.className = "chevron";

        const deleteFolderBtn = document.createElement("span");
        deleteFolderBtn.className = "delete-folder";
        deleteFolderBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            chrome.storage.sync.get("bookmarks", (res) => {
                const allFolders = res.bookmarks || [];
                allFolders.splice(folderIndex, 1);
                chrome.storage.sync.set({ bookmarks: allFolders }, () => {
                    renderBookmarks(allFolders);
                });
            });
        });

        actions.appendChild(deleteFolderBtn);
        actions.appendChild(chevron);
        header.appendChild(actions);
        folderDiv.appendChild(header);

        // --- Folder Content ---
        const content = document.createElement("div");
        content.className = "content";

        const bookmarks = Array.isArray(folder.bookmarks) ? folder.bookmarks : [];
        if (bookmarks.length > 0) {
            bookmarks.forEach((bm, bmIndex) => {
                const bookmarkDiv = document.createElement("div");
                bookmarkDiv.className = "bookmark";

                // Make entire row clickable
                bookmarkDiv.addEventListener("click", () => {
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        chrome.tabs.update(tabs[0].id, { url: bm.url });
                    });
                });

                // Accessibility link
                const link = document.createElement("a");
                link.href = bm.url || "#";
                link.textContent = bm.title || "Untitled";
                link.className = "bookmark-link";
                link.target = "_blank";
                link.addEventListener("click", (e) => e.preventDefault()); // row handles click

                // Right side (meta)
                const rightDiv = document.createElement("div");
                rightDiv.className = "bookmark-meta";

                const timestampSpan = document.createElement("span");
                timestampSpan.className = "timestamp";
                timestampSpan.textContent = formatTimestamp(bm.timestamp);

                const deleteText = document.createElement("span");
                deleteText.textContent = "Delete";
                deleteText.className = "delete-bookmark";

                // Delete bookmark without triggering row click
                deleteText.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    chrome.storage.sync.get("bookmarks", (res) => {
                        const allFolders = res.bookmarks || [];
                        if (allFolders[folderIndex] && Array.isArray(allFolders[folderIndex].bookmarks)) {
                            allFolders[folderIndex].bookmarks.splice(bmIndex, 1);
                            chrome.storage.sync.set({ bookmarks: allFolders }, () => {
                                renderBookmarks(allFolders);
                            });
                        }
                    });
                });

                rightDiv.appendChild(timestampSpan);
                rightDiv.appendChild(deleteText);

                bookmarkDiv.appendChild(link);
                bookmarkDiv.appendChild(rightDiv);
                content.appendChild(bookmarkDiv);
            });
        } else {
            const noBm = document.createElement("p");
            noBm.textContent = "No bookmarks in this folder";
            noBm.className = "no-bookmarks";
            content.appendChild(noBm);
        }

        folderDiv.appendChild(content);
        container.appendChild(folderDiv);

        // Toggle folder content
        header.addEventListener("click", () => {
            content.classList.toggle("open");
            header.classList.toggle("collapsed");
        });
    });
}

// Format seconds into mm:ss
function formatTimestamp(seconds) {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Close popup with animation
function closePopup() {
    const popup = document.getElementById("popup");
    if (!popup) return;
    popup.classList.add("closing");
    popup.addEventListener("animationend", () => popup.remove(), { once: true });
}



window.addEventListener("DOMContentLoaded", () => {
    renderBookmarksFromStorage();
    
    // Test notification button (uncomment for testing)
    const testBtn = document.getElementById("test-notification");
    if (testBtn) {
        testBtn.addEventListener("click", () => {
            showNotification("This is a test notification from BTube!", "info");
        });
    }
    
    // Short delay to allow initial paint
    setTimeout(() => {
        document.body.setAttribute("data-loaded", "true");
    }, 50); // 50ms is usually enough

    // Tabs switching logic
    const tabButtons = document.querySelectorAll('.tabbar .tab-btn');
    const tabViews = {
        home: document.getElementById('tab-home'),
        settings: document.getElementById('tab-settings'),
        blocking: document.getElementById('tab-blocking')
    };

    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            // No-op if already active
            if (target.classList.contains('active')) {
                e.preventDefault();
                return;
            }

            const tab = target.getAttribute('data-tab');
            if (!tab || !(tab in tabViews)) return;

            // Update buttons state
            tabButtons.forEach(b => {
                const isActive = b === target;
                b.classList.toggle('active', isActive);
                b.setAttribute('aria-selected', String(isActive));
            });

            // Update views state
            Object.entries(tabViews).forEach(([key, el]) => {
                const show = key === tab;
                if (!el) return;
                el.classList.toggle('active', show);
                el.hidden = !show;
            });
        });
    });

    // Initialize Settings toggles if present
    initSettingsToggles();
});


// --- Settings toggles support (embedded settings view) ---
const settingsMap = {
    "extension-online": "BTubeOn",
    "redirect-subscriptions": "redirect_home",
    "disable-shorts": "hide_shorts",
    "minimal-homepage": "minimal_homepage"
};

function initSettingsToggles() {
    const present = Object.keys(settingsMap).some(id => document.getElementById(id));
    if (!present) return; // settings view not rendered

    const saveBtn = document.getElementById('save-settings-btn');
    let initialValues = {};
    let changed = false;

    // Load initial values
    chrome.storage.local.get(Object.values(settingsMap), (result) => {
        initialValues = {};
        for (const [checkboxId, storageKey] of Object.entries(settingsMap)) {
            const checkbox = document.getElementById(checkboxId);
            if (!checkbox) continue;
            checkbox.checked = !!result[storageKey];
            initialValues[checkboxId] = !!result[storageKey];
        }
        changed = false;
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.style.display = 'none';
        }
    });

    // Track changes
    Object.entries(settingsMap).forEach(([checkboxId, storageKey]) => {
        const checkbox = document.getElementById(checkboxId);
        if (!checkbox) return;
        checkbox.addEventListener("change", () => {
            // If any value differs from initial, enable button and show it
            changed = Object.entries(settingsMap).some(([id]) => {
                const cb = document.getElementById(id);
                return cb && cb.checked !== initialValues[id];
            });
            if (saveBtn) {
                saveBtn.disabled = !changed;
                saveBtn.style.display = changed ? 'inline-flex' : 'none';
            }
        });
    });

    // Save on button click (only if settings tab is active)
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const settingsTab = document.getElementById('tab-settings');
            if (!settingsTab.classList.contains('active')) return;

            // Store pending settings in local storage
            let newValues = {};
            Object.entries(settingsMap).forEach(([checkboxId, storageKey]) => {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    newValues[storageKey] = checkbox.checked;
                }
            });
            chrome.storage.local.set({ btube_pending_settings: newValues }, () => {
                // Navigate popup to login.html
                window.location.href = 'login.html?from=settings';
            });
        });
    }
}
