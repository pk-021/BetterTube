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
    // Short delay to allow initial paint
    setTimeout(() => {
        document.body.setAttribute("data-loaded", "true");
    }, 50); // 50ms is usually enough
});
