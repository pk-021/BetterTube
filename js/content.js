// =======================
// Globals & Flags
// =======================
let storage = chrome.storage.local;

const flags = {
    redirectAttached: false,
};

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
        settingCache = settings;
        console.log("Settings loaded:", settingCache);
    });
}

// Load settings on script start
updateCurrentSettings();


//monitor changes to settings in local storage
chrome.storage.onChanged.addListener(changes => {
    updateCurrentSettings();
    applyAttributes(settingCache);
})




// =======================
// Redirect Logic
// =======================
function update_is_home_attrb() {
    const url = window.location.href;
    if (
        settingCache.redirect_home &&
        /^https:\/\/.*\.youtube\.com\/(?:\?.*)?$/.test(url)
    ) {
        document.documentElement.setAttribute("is_home", true);
    }
    else {
        document.documentElement.setAttribute("is_home", false)
    }
}

// =======================
// Logo Link Handling
// =======================

function navigateToSubscriptions() {
    const url = "/feed/subscriptions"; // relative URL


    // If already on subscriptions, do nothing
    if (window.location.pathname === url) return;

    link = document.querySelector('a[title="Subscriptions"]');
    link.click();


    console.log("SPA click subscriptions");
}

function handleLogoClick(event) {
    event.stopPropagation();
    event.preventDefault();

    // if (window.location.href === "https://www.youtube.com/feed/subscriptions") {
    //     console.log("Already on Subscriptions page — no redirect.");
    // }
    // else{

    navigateToSubscriptions();
    // }
}

function configureLink(link) {
    // if (link.href !== "https://www.youtube.com/feed/subscriptions") {
    link.addEventListener("click", handleLogoClick, true);
    link.addEventListener("touchend", handleLogoClick, true);
    // link.href = "https://www.youtube.com/feed/subscriptions";
}

function configurePageLinks() {
    if (flags.redirectAttached) return;

    const configureLogo = () => {
        const logo = document.querySelector("a#logo");
        if (logo) {

            //Configuration on page load
            if (settingCache.redirect_home) {
                configureLink(logo);
                console.log("Logo found and configured!")
            } else {
                flags.redirectAttached = false;
                observer.disconnect();
            }

            // Observe changes to the logo for SPA updates
            const observer = new MutationObserver(() => {
                if (settingCache.redirect_home) {
                    configureLink(logo);
                } else {
                    flags.redirectAttached = false;
                    observer.disconnect();
                }
            });

            observer.observe(logo, { attributes: true, attributeFilter: ["href"] });
            flags.redirectAttached = true;
        } else {
            // Retry if logo not yet in DOM
            setTimeout(configureLogo, 100);
        }
    };
    configureLogo();
}



// Apply HTML attributes to the webpage
function applyAttributes(settings) {
    console.log("attributes should be applied!")
    Object.keys(settings).forEach(key => {
        if (key.includes("hide") || key === "BTubeOn") {
            document.documentElement.setAttribute(key, settings[key]);
        }
    });
}

//Mutation observer to observe changes to the attributes
new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        const attr = mutation.attributeName;
        if (attr.startsWith("hide_") || attr === "BTubeOn") {

            console.log("attribute change:", attr);
        }
    });
}).observe(document.documentElement, { attributes: true });


// =======================
// SPA Event Handling
// =======================
function update(arg) {
    update_is_home_attrb();

    switch (arg) {
        case 1: // initial load
            console.log("Initial load complete");
            if (settingCache.redirect_home) { configurePageLinks() };
            applyAttributes(settingCache);
            break;

        case 2: // state navigate end
            console.log("State navigation ended");
            break;

        case 3: // navigation start
            console.log("Navigation started");
            break;

        case 4: // navigation finish
            console.log("Navigation finished");
            if (settingCache.redirect_home) { configurePageLinks() };
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



// =======================
// Background Message Listener
// =======================
chrome.runtime.onMessage.addListener(request => {
    if (request.type === "HANDSHAKE") {
        console.log("Message from background:", request.message);
        alert(request.message); // temporary visual check
    }
});
