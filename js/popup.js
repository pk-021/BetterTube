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
    const addBlockBtn = document.getElementById('add-block-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

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

            // Show/hide add block button based on active tab
            if (addBlockBtn) {
                addBlockBtn.style.display = tab === 'blocking' ? 'flex' : 'none';
            }

            // Show/hide save settings button based on active tab
            // (save button visibility is controlled by settings changes, but ensure it's hidden on other tabs)
            if (saveSettingsBtn && tab !== 'settings') {
                saveSettingsBtn.style.display = 'none';
            }
        });
    });

    // Initialize Settings toggles if present
    initSettingsToggles();

    // Initialize Blocking tab functionality
    initBlockingTab();
});


// --- Settings toggles support (embedded settings view) ---
const settingsMap = {
    "extension-online": "BTubeOn",
    "redirect-subscriptions": "redirect_home",
    "disable-shorts": "hide_shorts",
    "minimal-homepage": "minimal_homepage",
    "enable-website-blocking": "enable_website_blocking",
    "enable-channel-blocking": "enable_channel_blocking"
};

// Mode presets
const modePresets = {
    "off": {
        BTubeOn: false,
        redirect_home: false,
        hide_shorts: false,
        minimal_homepage: false,
        enable_website_blocking: false,
        enable_channel_blocking: false
    },
    "minimal": {
        BTubeOn: true,
        redirect_home: false,
        hide_shorts: true,
        minimal_homepage: true,
        enable_website_blocking: true,
        enable_channel_blocking: true
    },
    "high-focus": {
        BTubeOn: true,
        redirect_home: true,
        hide_shorts: true,
        minimal_homepage: true,
        enable_website_blocking: true,
        enable_channel_blocking: true
    }
};

// Strictness levels (higher number = stricter)
const strictnessLevels = {
    "off": 0,
    "minimal": 1,
    "high-focus": 2,
    "custom": -1 // Custom is not part of the strictness hierarchy
};

function initSettingsToggles() {
    const present = Object.keys(settingsMap).some(id => document.getElementById(id));
    if (!present) return; // settings view not rendered

    const saveBtn = document.getElementById('save-settings-btn');
    const modeView = document.querySelector('.settings-mode-view');
    const customView = document.querySelector('.settings-custom-view');
    const editCustomBtn = document.getElementById('edit-custom-btn');
    const backToModesBtn = document.getElementById('back-to-modes-btn');
    const modeRadios = document.querySelectorAll('input[name="settings-mode"]');
    const customRadio = document.getElementById('custom-mode-radio');
    
    let initialValues = {};
    let initialMode = 'custom';
    let changed = false;

    // Navigate to custom settings editor
    function showCustomEditor() {
        modeView.hidden = true;
        customView.hidden = false;
    }

    // Navigate back to mode selector
    function showModeSelector() {
        modeView.hidden = false;
        customView.hidden = true;
    }

    // Determine current mode from stored settings
    function detectMode(settings) {
        for (const [modeName, preset] of Object.entries(modePresets)) {
            const matches = Object.keys(preset).every(key => settings[key] === preset[key]);
            if (matches) return modeName;
        }
        return 'custom';
    }

    // Apply mode preset to checkboxes
    function applyModeToCheckboxes(mode) {
        const preset = modePresets[mode];
        if (!preset) return;

        Object.entries(settingsMap).forEach(([checkboxId, storageKey]) => {
            const checkbox = document.getElementById(checkboxId);
            if (checkbox && storageKey in preset) {
                checkbox.checked = preset[storageKey];
            }
        });
    }

    // Mark the currently active mode with a visual indicator
    function markActiveMode(mode) {
        // Remove active class from all mode options
        document.querySelectorAll('.mode-option').forEach(option => {
            option.classList.remove('mode-active');
        });
        
        // Add active class to the current mode
        const activeOption = document.querySelector(`input[name="settings-mode"][value="${mode}"]`)?.closest('.mode-option');
        if (activeOption) {
            activeOption.classList.add('mode-active');
        }
    }

    // Load initial values and detect mode
    chrome.storage.local.get(Object.values(settingsMap), (result) => {
        initialValues = {};
        for (const [checkboxId, storageKey] of Object.entries(settingsMap)) {
            const checkbox = document.getElementById(checkboxId);
            if (!checkbox) continue;
            checkbox.checked = !!result[storageKey];
            initialValues[checkboxId] = !!result[storageKey];
        }

        // Detect and set current mode
        initialMode = detectMode(result);
        const modeRadio = document.querySelector(`input[name="settings-mode"][value="${initialMode}"]`);
        if (modeRadio) {
            modeRadio.checked = true;
            // Show edit button if custom mode is initially selected
            if (initialMode === 'custom' && editCustomBtn) {
                editCustomBtn.hidden = false;
            }
        }
        
        // Mark the active mode
        markActiveMode(initialMode);

        changed = false;
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.style.display = 'none';
        }
    });

    // Listen for storage changes to update active mode indicator
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            // Check if any settings that affect mode detection changed
            const relevantKeys = Object.values(settingsMap);
            const hasRelevantChanges = relevantKeys.some(key => key in changes);
            
            if (hasRelevantChanges) {
                // Re-detect the active mode
                chrome.storage.local.get(relevantKeys, (result) => {
                    const newMode = detectMode(result);
                    markActiveMode(newMode);
                    
                    // Update initial mode if different
                    if (newMode !== initialMode) {
                        initialMode = newMode;
                        
                        // Update initial values
                        Object.entries(settingsMap).forEach(([checkboxId, storageKey]) => {
                            const checkbox = document.getElementById(checkboxId);
                            if (checkbox && storageKey in result) {
                                checkbox.checked = !!result[storageKey];
                                initialValues[checkboxId] = !!result[storageKey];
                            }
                        });
                    }
                });
            }
        }
    });

    // Handle edit button click
    if (editCustomBtn) {
        editCustomBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Select custom mode if not already selected
            if (customRadio && !customRadio.checked) {
                customRadio.checked = true;
                changed = true;
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.style.display = 'inline-flex';
                }
            }
            
            showCustomEditor();
        });
    }

    // Handle back button
    if (backToModesBtn) {
        backToModesBtn.addEventListener('click', () => {
            showModeSelector();
        });
    }

    // Handle mode radio changes
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const selectedMode = e.target.value;
            
            // Show/hide edit button based on mode
            if (editCustomBtn) {
                editCustomBtn.hidden = selectedMode !== 'custom';
            }
            
            // Apply preset to checkboxes if not custom
            if (selectedMode !== 'custom') {
                applyModeToCheckboxes(selectedMode);
            }
            
            // Mark as changed if different from initial
            // For custom mode, always mark as changed if it wasn't the initial mode
            if (selectedMode === 'custom' && initialMode !== 'custom') {
                changed = true;
            } else {
                changed = selectedMode !== initialMode;
            }
            
            if (saveBtn) {
                saveBtn.disabled = !changed;
                saveBtn.style.display = changed ? 'inline-flex' : 'none';
            }
        });
    });

    // Track changes in custom toggles
    Object.entries(settingsMap).forEach(([checkboxId, storageKey]) => {
        const checkbox = document.getElementById(checkboxId);
        if (!checkbox) return;
        checkbox.addEventListener("change", () => {
            // When custom toggles change, switch to custom mode
            if (customRadio && !customRadio.checked) {
                customRadio.checked = true;
                // Show edit button when switching to custom mode
                if (editCustomBtn) {
                    editCustomBtn.hidden = false;
                }
            }

            // Check if any value differs from initial
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

            // Get selected mode
            const selectedMode = document.querySelector('input[name="settings-mode"]:checked')?.value;
            
            // Determine if login is required
            // Login is required in these cases:
            // 1. Entering custom mode (selecting custom)
            // 2. Exiting custom mode (was custom, now selecting something else)
            // 3. Moving from a stricter preset to a less strict one (e.g., high-focus -> minimal)
            
            const isCustomMode = selectedMode === 'custom';
            const wasCustomMode = initialMode === 'custom';
            
            let requiresLogin = false;
            
            if (isCustomMode || wasCustomMode) {
                // Require login when entering OR exiting custom mode
                requiresLogin = true;
            } else {
                // Both are presets, check strictness levels
                const selectedStrictness = strictnessLevels[selectedMode] || 0;
                const initialStrictness = strictnessLevels[initialMode] || 0;
                const isStricter = selectedStrictness > initialStrictness;
                requiresLogin = !isStricter; // Require login if not becoming stricter
            }
            
            // Build settings object
            let newValues = {};
            
            if (selectedMode && selectedMode !== 'custom' && modePresets[selectedMode]) {
                // Use preset values
                newValues = { ...modePresets[selectedMode] };
            } else {
                // Use custom toggle values
                Object.entries(settingsMap).forEach(([checkboxId, storageKey]) => {
                    const checkbox = document.getElementById(checkboxId);
                    if (checkbox) {
                        newValues[storageKey] = checkbox.checked;
                    }
                });
            }

            if (requiresLogin) {
                // Store pending settings and require login
                chrome.storage.local.set({ btube_pending_settings: newValues }, () => {
                    // Navigate popup to login.html
                    window.location.href = 'login.html?from=settings';
                });
            } else {
                // Apply settings directly without login for stricter presets
                chrome.storage.local.set(newValues, () => {
                    // Show success notification
                    chrome.runtime.sendMessage({
                        type: 'showNotification',
                        message: 'Settings saved successfully!',
                        notificationType: 'success'
                    });
                    
                    // Update initial values and mode
                    initialMode = selectedMode;
                    Object.entries(settingsMap).forEach(([checkboxId, storageKey]) => {
                        const checkbox = document.getElementById(checkboxId);
                        if (checkbox) {
                            initialValues[checkboxId] = checkbox.checked;
                        }
                    });
                    
                    // Update active mode indicator
                    markActiveMode(selectedMode);
                    
                    // Hide save button
                    changed = false;
                    saveBtn.disabled = true;
                    saveBtn.style.display = 'none';
                });
            }
        });
    }
}

// --- Blocking Tab Functionality ---
function initBlockingTab() {
    const addBlockBtn = document.getElementById('add-block-btn');
    const overlay = document.getElementById('add-block-overlay');
    const closeOverlayBtn = document.getElementById('close-overlay-btn');
    const cancelOverlayBtn = document.getElementById('cancel-overlay-btn');
    const saveOverlayBtn = document.getElementById('save-overlay-btn');
    const typeRadios = document.querySelectorAll('input[name="block-type"]');
    const websiteInput = document.getElementById('website-input');
    const channelInput = document.getElementById('channel-input');
    const websiteUrlField = document.getElementById('website-url');
    const channelNameField = document.getElementById('channel-name');
    
    // Load blocked content when popup opens
    loadBlockedContent();

    // Listen for storage changes to update the lists in real-time
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.blockedWebsites || changes.blockedChannels) {
                loadBlockedContent();
            }
        }
    });

    // Add block button - shows overlay
    if (addBlockBtn) {
        addBlockBtn.addEventListener('click', () => {
            overlay.hidden = false;
            websiteUrlField.focus();
        });
    }

    // Handle type selection change
    typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'website') {
                websiteInput.hidden = false;
                channelInput.hidden = true;
                websiteUrlField.focus();
            } else {
                websiteInput.hidden = true;
                channelInput.hidden = false;
                channelNameField.focus();
            }
        });
    });

    // Close overlay handlers
    const closeOverlay = () => {
        overlay.hidden = true;
        websiteUrlField.value = '';
        channelNameField.value = '';
        document.querySelector('input[name="block-type"][value="website"]').checked = true;
        websiteInput.hidden = false;
        channelInput.hidden = true;
    };

    if (closeOverlayBtn) {
        closeOverlayBtn.addEventListener('click', closeOverlay);
    }

    if (cancelOverlayBtn) {
        cancelOverlayBtn.addEventListener('click', closeOverlay);
    }

    // Save blocked content
    if (saveOverlayBtn) {
        saveOverlayBtn.addEventListener('click', async () => {
            const blockType = document.querySelector('input[name="block-type"]:checked').value;
            
            if (blockType === 'website') {
                const url = websiteUrlField.value.trim();
                if (!url) {
                    alert('Please enter a website URL');
                    return;
                }
                await addBlockedWebsite(url);
            } else {
                const channelName = channelNameField.value.trim();
                if (!channelName) {
                    alert('Please enter a channel name or ID');
                    return;
                }
                await addBlockedChannel(channelName);
            }

            closeOverlay();
        });
    }

    // Handle Escape key to close overlay
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.hidden) {
            e.preventDefault();
            e.stopPropagation();
            closeOverlay();
        }
    });

    // Handle Enter key in input fields
    if (websiteUrlField) {
        websiteUrlField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveOverlayBtn.click();
            }
        });
    }

    if (channelNameField) {
        channelNameField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveOverlayBtn.click();
            }
        });
    }

    // Close overlay when clicking outside
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeOverlay();
            }
        });
    }
}

// Add blocked website
async function addBlockedWebsite(url) {
    try {
        // Process and extract essential part of URL
        let processedUrl = url.trim();
        
        // Remove protocol if present
        processedUrl = processedUrl.replace(/^https?:\/\//i, '');
        
        // Remove www. if present
        processedUrl = processedUrl.replace(/^www\./i, '');
        
        // Remove trailing slashes
        processedUrl = processedUrl.replace(/\/+$/, '');
        
        // Extract video ID if it's a YouTube video URL
        // Handles: youtube.com/watch?v=VIDEO_ID, youtu.be/VIDEO_ID, youtube.com/embed/VIDEO_ID
        const videoIdMatch = processedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        if (videoIdMatch) {
            // For YouTube videos, keep the full format
            processedUrl = `youtube.com/watch?v=${videoIdMatch[1]}`;
        } else {
            // Extract domain and path (remove query params and fragments for general URLs)
            processedUrl = processedUrl.split('?')[0].split('#')[0];
            
            // Remove domain extensions (.com, .org, .net, etc.) unless it's a path
            if (!processedUrl.includes('/')) {
                // Only remove extension if it's just a domain (no path)
                processedUrl = processedUrl.replace(/\.(com|org|net|edu|gov|co|io|ai|me|tv|info|biz|dev|app|tech|online|site|xyz|store|shop|blog|news|pro|cloud|digital|web|us|uk|ca|au|de|fr|jp|in|br|ru|cn|kr|es|it|nl|se|pl|tr|mx|za|id|th|my|sg|ph|vn|tw|hk|nz|ar|cl|pe|eg|pk|bd|ng|ke|ua|ro|cz|gr|pt|be|hu|at|ch|dk|fi|no|ie|il|sa|ae|qa|kw|om|bh|lb|jo|iq|sy|ye|ly|tn|ma|dz|sd|so|et|ug|tz|gh|sn|ci|cm|bw|zm|zw|mw|mg|mu|re|mz|ao|na|ls|sz|gm|gn|gw|sl|lr|ml|bf|ne|td|cf|ga|cg|cd|rw|bi|dj|er|ss|st|cv|sc|km|mr|eh)$/i, '');
            }
        }

        if (!processedUrl) {
            alert('Please enter a valid URL');
            return;
        }

        // Get existing blocked websites
        const result = await chrome.storage.local.get(['blockedWebsites']);
        const blockedWebsites = result.blockedWebsites || [];

        // Check if already blocked (case-insensitive)
        if (blockedWebsites.some(item => item.url.toLowerCase() === processedUrl.toLowerCase())) {
            alert('This website is already blocked');
            return;
        }

        // Add new blocked website
        blockedWebsites.push({
            url: processedUrl,
            addedAt: Date.now()
        });

        // Save to storage
        await chrome.storage.local.set({ blockedWebsites });
        
        console.log('Website blocked:', processedUrl);
    } catch (error) {
        console.error('Error adding blocked website:', error);
        alert('Failed to block website. Please try again.');
    }
}

// Add blocked channel
async function addBlockedChannel(channelName) {
    try {
        // Process and extract essential part of channel
        let processedChannel = channelName.trim();
        
        // Handle full YouTube URLs
        // Formats: youtube.com/@channelname, youtube.com/channel/UCxxxx, youtube.com/c/channelname
        if (processedChannel.includes('youtube.com') || processedChannel.includes('youtu.be')) {
            // Remove protocol and domain
            processedChannel = processedChannel.replace(/^https?:\/\//i, '');
            processedChannel = processedChannel.replace(/^(www\.)?youtube\.com\//i, '');
            
            // Extract channel handle (@name)
            const handleMatch = processedChannel.match(/@([a-zA-Z0-9_.-]+)/);
            if (handleMatch) {
                processedChannel = '@' + handleMatch[1];
            } 
            // Extract channel ID (UC...)
            else if (processedChannel.startsWith('channel/')) {
                const channelId = processedChannel.replace('channel/', '').split('/')[0].split('?')[0];
                processedChannel = channelId;
            }
            // Extract custom channel name (/c/...)
            else if (processedChannel.startsWith('c/')) {
                const customName = processedChannel.replace('c/', '').split('/')[0].split('?')[0];
                processedChannel = customName;
            }
            // Extract user name (/user/...)
            else if (processedChannel.startsWith('user/')) {
                const userName = processedChannel.replace('user/', '').split('/')[0].split('?')[0];
                processedChannel = userName;
            }
        }
        // If it already starts with @, keep it as is
        else if (!processedChannel.startsWith('@') && !processedChannel.startsWith('UC')) {
            // Assume it's a handle without @ prefix, add it
            processedChannel = '@' + processedChannel;
        }
        
        // Remove any remaining query params or fragments
        processedChannel = processedChannel.split('?')[0].split('#')[0];

        if (!processedChannel || processedChannel === '@') {
            alert('Please enter a valid channel name or ID');
            return;
        }

        // Get existing blocked channels
        const result = await chrome.storage.local.get(['blockedChannels']);
        const blockedChannels = result.blockedChannels || [];

        // Check if already blocked (case-insensitive)
        if (blockedChannels.some(item => item.name.toLowerCase() === processedChannel.toLowerCase())) {
            alert('This channel is already blocked');
            return;
        }

        // Add new blocked channel
        blockedChannels.push({
            name: processedChannel,
            addedAt: Date.now()
        });

        // Save to storage
        await chrome.storage.local.set({ blockedChannels });
        
        console.log('Channel blocked:', processedChannel);
    } catch (error) {
        console.error('Error adding blocked channel:', error);
        alert('Failed to block channel. Please try again.');
    }
}

// Load and display blocked websites and channels
async function loadBlockedContent() {
    try {
        const result = await chrome.storage.local.get(['blockedWebsites', 'blockedChannels']);
        
        const blockedWebsites = result.blockedWebsites || [];
        const blockedChannels = result.blockedChannels || [];

        // Render blocked websites
        renderBlockedWebsites(blockedWebsites);
        
        // Render blocked channels
        renderBlockedChannels(blockedChannels);
    } catch (error) {
        console.error('Error loading blocked content:', error);
    }
}

// Render blocked websites list
function renderBlockedWebsites(websites) {
    const listContainer = document.getElementById('blocked-websites-list');
    const emptyMessage = document.getElementById('empty-websites');
    
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (websites.length === 0) {
        emptyMessage.hidden = false;
        return;
    }

    emptyMessage.hidden = true;

    websites.forEach((website, index) => {
        const item = createBlockedItem(website.url, () => {
            deleteBlockedWebsite(index);
        });
        listContainer.appendChild(item);
    });
}

// Render blocked channels list
function renderBlockedChannels(channels) {
    const listContainer = document.getElementById('blocked-channels-list');
    const emptyMessage = document.getElementById('empty-channels');
    
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (channels.length === 0) {
        emptyMessage.hidden = false;
        return;
    }

    emptyMessage.hidden = true;

    channels.forEach((channel, index) => {
        const item = createBlockedItem(channel.name, () => {
            deleteBlockedChannel(index);
        });
        listContainer.appendChild(item);
    });
}

// Create a blocked item element
function createBlockedItem(title, onDelete) {
    const item = document.createElement('div');
    item.className = 'blocked-item';

    const content = document.createElement('div');
    content.className = 'blocked-item-content';

    const titleEl = document.createElement('div');
    titleEl.className = 'blocked-item-title';
    titleEl.textContent = title;
    titleEl.title = title; // Show full text on hover

    content.appendChild(titleEl);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-block-btn';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
    deleteBtn.addEventListener('click', onDelete);

    item.appendChild(content);
    item.appendChild(deleteBtn);

    return item;
}

// Delete blocked website
async function deleteBlockedWebsite(index) {
    try {
        const result = await chrome.storage.local.get(['blockedWebsites']);
        const blockedWebsites = result.blockedWebsites || [];
        
        blockedWebsites.splice(index, 1);
        
        await chrome.storage.local.set({ blockedWebsites });
        console.log('Website unblocked');
    } catch (error) {
        console.error('Error deleting blocked website:', error);
    }
}

// Delete blocked channel
async function deleteBlockedChannel(index) {
    try {
        const result = await chrome.storage.local.get(['blockedChannels']);
        const blockedChannels = result.blockedChannels || [];
        
        blockedChannels.splice(index, 1);
        
        await chrome.storage.local.set({ blockedChannels });
        console.log('Channel unblocked');
    } catch (error) {
        console.error('Error deleting blocked channel:', error);
    }
}
