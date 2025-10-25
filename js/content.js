// =======================
// Globals & Flags
// =======================
let storage = chrome.storage.local;

let offSettings = {
    minimal_homepage: false,
    hide_feed: false,
    redirect_home: false,
    hide_shorts: false,
    BTubeOn: false
}

let settingCache = {};

// =======================
// Helper: Get Settings
// =======================
function getSettings(callback, keys = null) {
    storage.get(keys, result => {
        if (chrome.runtime.lastError) {
            storage = chrome.storage.local;
            storage.get(keys, rslt => callback(rslt));
        } else {
            callback(result);
        }
    });
}

function updateCurrentSettings() {
    getSettings(settings => {
        if (!settings.BTubeOn) {
            settingCache = offSettings;
        }
        else {
            settingCache = settings;
        }
        applyAttributes(settingCache);
        console.log("updated settings:", settingCache);

        chrome.runtime.sendMessage({ type: "toggleRedirects", enabled: settings.redirect_home });
        chrome.runtime.sendMessage({ type: "toggleShorts", enabled: settings.hide_shorts });

        //when redirect is turned on at homepage
        if (settingCache.redirect_home) {
            const url = window.location.href;
            if (/^https:\/\/.*\.youtube\.com\/(?:\?.*)?$/.test(url)) {
                navigateToSubscriptions();
            }
        }
    });
}

// Load settings on script start
updateCurrentSettings();
//monitor changes to settings in local storage
chrome.storage.onChanged.addListener(changes => {
    updateCurrentSettings();
})


//minimalist homepage
let homeCenterLogo = document.createElement("img");
homeCenterLogo.src = chrome.runtime.getURL("assets/ytlogo.png");
homeCenterLogo.alt = "YTlogo";
homeCenterLogo.className = "homeCenterLogo";

function update_home_props() {
    const url = window.location.href;
    if (/^https:\/\/.*\.youtube\.com\/(?:\?.*)?$/.test(url)) {
        document.documentElement.setAttribute("is_home", true);
        searchbar = document.querySelector("#center");
        searchbar.append(homeCenterLogo);
        console.log("Center logo attached!")
    }
    else {
        document.documentElement.setAttribute("is_home", false)
    }
}

// =======================
// redirect homepage
// =======================

function navigateToSubscriptions() {
    const url = "/feed/subscriptions"; // relative URL

    // If already on subscriptions, do nothing
    if (window.location.pathname === url) return;
    link = document.querySelector('a[title="Subscriptions"]');
    link.click();
}

function handleLogoClick(event) {

    if (!settingCache.redirect_home) {
        return;
    }
    event.stopPropagation();
    event.preventDefault();
    console.log("Tasks complete!");
    navigateToSubscriptions();
}

function configureLogo() {
    const logo = document.querySelector("a#logo");
    if (logo) {
        logo.addEventListener("click", handleLogoClick, true);
        logo.addEventListener("touchend", handleLogoClick, true);
        console.log("Logo found and configured!")
    }
    else {
        setTimeout(configureLogo, 100);
    }
};



// Apply HTML attributes to the webpage
function applyAttributes(settings) {
    console.log("attributes should be applied!")
    Object.keys(settings).forEach(key => {
        if (key.includes("hide") || key === "BTubeOn" || key === "minimal_homepage" || key === "redirect_home") {
            document.documentElement.setAttribute(key, settings[key]);
        }
    });
}

//Mutation observer to observe changes to the attributes
new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        const attr = mutation.attributeName;
        if (attr === "redirect_home") {
            configureLogo();
        }
    });
}).observe(document.documentElement, { attributes: true });




// =======================
// SPA Event Handling
// =======================
function update(arg) {

    switch (arg) {
        case 1: // initial load
            console.log("Initial load complete");
            configureLogo();
            update_home_props();
            applyAttributes(settingCache);
            loadBookmarkButton();
            break;

        case 2: // state navigate end
            console.log("State navigation ended");
            break;

        case 3: // navigation start
            console.log("Navigation started");
            break;

        case 4: // navigation finish
            console.log("Navigation finished");
            configureLogo();
            update_home_props();
            loadBookmarkButton();
            break;

        default: // yt-page-data-updated
            console.log("YT page data updated");
            break;
    }
}

// =======================
// Event Listeners
// =======================
window.addEventListener("load", update.bind(null, 1));
window.addEventListener("state-navigateend", update.bind(null, 2));
window.addEventListener("yt-navigate-start", update.bind(null, 3));
window.addEventListener("yt-navigate-finish", update.bind(null, 4));
window.addEventListener("yt-page-data-updated", update);




function isVideoPage() {
    const url = window.location.href;
    const videoEl = document.querySelector("video");
    return (
        /^https:\/\/(www\.)?youtube\.com\/watch\?v=[^&]+/.test(url) &&
        !!videoEl
    );
}

let loadBookmarkButton = () => {
    if (!isVideoPage()) {
        return;
    }

    const button = document.querySelector(".bookmark-btn");
    console.log("TRYING TO LOAD BUTTON!");

    if (!button) {
        // Create button wrapper
        const bookmarkBtn = document.createElement("button");
        bookmarkBtn.className = "ytp-button bookmark-btn";
        bookmarkBtn.title = "Click to bookmark current timestamp";
        bookmarkBtn.addEventListener("click", addNewBookmarkEventHandler);

        // Inline SVG
        bookmarkBtn.innerHTML = `
        <svg class="bookmark-icon" viewBox="0 0 24 24" width="100%" height="100%" fill="#fff" fill-opacity="1" xmlns="http://www.w3.org/2000/svg">
            <g transform="scale(0.6) translate(-4,0)">
                <path d="M6 4C6 3.45 6.45 3 7 3H17C17.55 3 18 3.45 18 4V21L12 17L6 21V4Z"/>
            </g>
        </svg>
        `;

        const youtubeRightControls = document.querySelector(".ytp-right-controls");
        if (youtubeRightControls) {
            console.log("Youtube right controls found!");
            youtubeRightControls.prepend(bookmarkBtn);
        }
    }
};


let bookmarks = [
];

function saveBookMarksToStorage() {
    chrome.storage.sync.set(
        {
            bookmarks: bookmarks,
        },
        () => {
            console.log("Bookmarks Saved to storage.");
        }
    );
}

function getBookmarksFromStorage(func) {
    chrome.storage.sync.get(["bookmarks"], (result) => {
        if (result.bookmarks) {
            bookmarks = result.bookmarks;
        }
        func(bookmarks);
    });
}


function showModal() {
    getBookmarksFromStorage((bookmarksData) => {
        let folderSelectHTML = "";

        if (bookmarksData.length > 0) {
            let options = "";
            bookmarksData.forEach((bookmark) => {
                options += `<option value="${bookmark.folderName}">${bookmark.folderName}</option>`;
            });
            folderSelectHTML = `
                <span>Select a folder</span>
                <select class="folder__select" name="folder" id="folder">
                    ${options}
                </select>
            `;
        } else {
            folderSelectHTML = `
                <span class="no-folder">No folder yet. Create one below.</span>
            `;
        }

        let code = `
            <div class="modal">
                <div class="modalContent">
                    <h1 class="modal__title">Add new bookmark</h1>
                    ${folderSelectHTML}
                    <input class="bookmark__input" type="text" placeholder="Create new Folder" />
                    <div class="action">
                        <button class="cancel yt-button">Cancel</button>
                        <button class="save__btn yt-button primary" disabled>Save</button>
                    </div>
                </div>
            </div>

            <style>
                .no-folder {
                    font-size: 14px;
                    color: var(--yt-spec-text-secondary);
                }

                /* Modal overlay */
                .modal {
                    position: fixed;
                    inset: 0;
                    background-color: rgba(0,0,0,0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.3s ease forwards;
                    z-index: 9999;
                }

                /* Modal content */
                .modalContent {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 20px;
                    border-radius: 12px;
                    min-width: 350px;
                    max-width: 400px;
                    background-color: var(--yt-spec-raised-background);
                    color: var(--yt-spec-text-primary);
                    transform: translateY(-30px);
                    opacity: 0;
                    animation: slideIn 0.3s ease forwards;
                }

                /* Animations */
                @keyframes fadeIn { from { background-color: rgba(0,0,0,0); } to { background-color: rgba(0,0,0,0.6); } }
                @keyframes slideIn { to { transform: translateY(0); opacity: 1; } }
                @keyframes fadeOut { from { background-color: rgba(0,0,0,0.6); } to { background-color: rgba(0,0,0,0); } }
                @keyframes slideOut { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-30px); opacity: 0; } }

                .modal.closing { animation: fadeOut 0.25s ease forwards; }
                .modal.closing .modalContent { animation: slideOut 0.25s ease forwards; }

                /* Inputs & dropdown using YouTube CSS variables */
                .bookmark__input,
                .folder__select {
                    border: 1px solid var(--yt-spec-10-percent-layer);
                    border-radius: 6px;
                    padding: 10px;
                    background-color: var(--yt-spec-badge-chip-background);
                    color: var(--yt-spec-text-primary);
                }

                .bookmark__input::placeholder {
                    color: var(--yt-spec-text-secondary);
                }

                .folder__select option {
                    background-color: var(--yt-spec-raised-background);
                    color: var(--yt-spec-text-primary);
                }

                /* YouTube-style buttons */
                .yt-button {
                    font-family: Roboto, Arial, sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    padding: 8px 16px;
                    border-radius: 18px;
                    border: none;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }
                .yt-button.primary {
                    background-color: var(--yt-spec-call-to-action);
                    color: var(--yt-spec-static-overlay-text-primary);
                }
                .yt-button.primary:hover:not(:disabled) { background-color: #cc0000; }
                .yt-button.primary:disabled {
                    background-color: var(--yt-spec-badge-chip-background);
                    color: var(--yt-spec-text-disabled);
                    cursor: not-allowed;
                }
                .yt-button.cancel {
                    background-color: var(--yt-spec-badge-chip-background);
                    color: var(--yt-spec-text-primary);
                    margin-right: auto;
                }
                .yt-button.cancel:hover { background-color: var(--yt-spec-10-percent-layer); }

                .action {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 10px;
                }
            </style>
        `;

        let temp = document.createElement("div");
        temp.innerHTML = code;
        let modal = temp.querySelector(".modal");
        document.body.appendChild(temp);

        const saveBtn = modal.querySelector(".save__btn");
        const input = modal.querySelector(".bookmark__input");
        const select = modal.querySelector(".folder__select");

        // Enable Save button only when input or select has value
        function updateSaveButtonState() {
            saveBtn.disabled = !((input && input.value.trim() !== "") || (select && select.value));
        }
        if (input) {
            input.addEventListener("input", updateSaveButtonState);
            // Only trigger Save for this modal, not globally
            input.addEventListener("keydown", function(e) {
                if (e.key === "Enter" && !saveBtn.disabled) {
                    e.preventDefault();
                    e.stopPropagation();
                    // Only click the saveBtn inside this modal
                    saveBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                }
            });
        }
        if (select) select.addEventListener("change", updateSaveButtonState);
        updateSaveButtonState();

        // Close modal animation
        function closeModalAnimated() {
            modal.classList.add("closing");
            modal.addEventListener("animationend", () => {
                modal.remove();
                document.removeEventListener("keydown", escListener);
            }, { once: true });
        }

        // ESC key support
        function escListener(e) {
            if (e.key === "Escape") closeModalAnimated();
        }
        document.addEventListener("keydown", escListener);

        // Click outside to close
        modal.addEventListener("click", (e) => { if (e.target === modal) closeModalAnimated(); });

        // Cancel button
        modal.querySelector(".cancel").addEventListener("click", closeModalAnimated);

        // Save button
        saveBtn.addEventListener("click", () => {
            let bookmarkName = input.value.trim();
            let folderName = select?.value;
            let count = bookmarks.length + 1;

            const timestamp = getCurrentTime();
            const shortUrl = convertToShortUrl(location.href);

            if (bookmarkName === "" && folderName) {
                let f = bookmarks.find(b => b.folderName === folderName);
                f.bookmarks.push({
                    url: shortUrl,
                    title: getTitle(),
                    id: f.bookmarks.length + 1,
                    timestamp: timestamp,
                });
            } else if (bookmarkName !== "") {
                bookmarks.push({
                    folderName: bookmarkName,
                    bookmarks: [{
                        url: shortUrl,
                        title: getTitle(),
                        id: 1,
                        timestamp: timestamp,
                    }],
                    id: count,
                });
            } else return;

            saveBookMarksToStorage();
            
            // Show notification that bookmark was saved using overlay
            if (chrome && chrome.notifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'assets/logo_v2.png',
                    title: 'BTube',
                    message: 'Bookmark saved successfully!'
                });
            }
            
            closeModalAnimated();
        });
    });
}


const addNewBookmarkEventHandler = () => {
    showModal();
};

function getTitle() {
    return document.querySelector("h1.style-scope.ytd-watch-metadata").children[0]
        .innerText;
}

function convertToShortUrl(longUrl) {
    let url = longUrl.substring(29, longUrl.length);
    const urlParams = new URLSearchParams(url);
    const videoId = urlParams.get("v");
    console.log(urlParams);
    return `https://youtu.be/${videoId}?t=${getCurrentTime()}`;
}

function getCurrentTime() {
    let d = document.querySelector(".video-stream.html5-main-video");
    return parseInt(d.currentTime);
}







