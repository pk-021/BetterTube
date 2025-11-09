"use strict";

// --- Containers ---
const loginContainer = document.getElementById("login-container");
const setupContainer = document.getElementById("setup-container");
const resetContainer = document.getElementById("reset-container");

// --- Login elements ---
const input = document.getElementById("password-input");
const button = document.getElementById("submit-password");
const error = document.getElementById("error-message");
const forgotButton = document.getElementById("forgot-password");

// --- Setup elements ---
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const saveButton = document.getElementById("save-password");
const setupError = document.getElementById("setup-error");

// --- Custom notification elements ---
const customNotification = document.getElementById("custom-notification");
const notificationMessage = document.getElementById("notification-message");
const notificationCloseButton = document.getElementById("notification-close");

// --- Reset elements ---
const currentWordEl = document.getElementById("current-word");
const resetInput = document.getElementById("reset-input");
const resetNextBtn = document.getElementById("reset-next");

// --- Reset words ---
const resetWords = [
  "orange",
  "castle",
  "mirror",
  "planet",
  "forest",
  "window",
  "guitar",
  "breeze",
  "pillow",
  "dragon",
];
let currentResetIndex = 0;

// --- Helper to show/hide containers ---
function showContainer(container) {
  [loginContainer, setupContainer, resetContainer].forEach((c) =>
    c.classList.add("hidden")
  );
  container.classList.remove("hidden");
}

// --- Promisify chrome.storage.local.get ---
function getPassword() {
  return new Promise((resolve) => {
    chrome.storage.local.get("extensionPassword", (data) => {
      resolve(data.extensionPassword);
    });
  });
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

// --- Password strength check ---
function isStrongPassword(password) {
  // Minimum 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return strongRegex.test(password);
}

// --- Initialize page ---
async function init() {
  applyDarkMode(); // Apply dark mode on load

  const password = await getPassword();
  if (password) {
    showContainer(loginContainer);
  } else {
    showContainer(setupContainer);
  }
}

// --- Setup password ---
saveButton.addEventListener("click", async () => {
  const newPass = newPasswordInput.value.trim();
  const confirmPass = confirmPasswordInput.value.trim();

  if (!newPass) {
    setupError.textContent = "Password cannot be empty.";
    setupError.classList.remove("hidden");
    return;
  }

  if (newPass !== confirmPass) {
    setupError.textContent = "Passwords do not match.";
    setupError.classList.remove("hidden");
    return;
  }

  if (!isStrongPassword(newPass)) {
    setupError.textContent =
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
    setupError.classList.remove("hidden");
    return;
  }

  await chrome.storage.local.set({ extensionPassword: newPass });
  showNotification("Password set successfully! Please log in.", loginContainer);
  setupError.classList.add("hidden");
});

// --- Check login ---
async function checkPassword() {
  const enteredPass = input.value.trim();
  const password = await getPassword();

  if (enteredPass === password) {
    // Check for pending settings in storage
    chrome.storage.local.get('btube_pending_settings', (data) => {
      if (data.btube_pending_settings) {
          chrome.storage.local.set(data.btube_pending_settings, () => {
            chrome.storage.local.remove('btube_pending_settings');
            
            // Show success notification
            chrome.runtime.sendMessage({
              type: 'showNotification',
              message: 'Settings saved successfully!',
              notificationType: 'success'
            });
            
            setTimeout(() => {
              window.location.href = "popup.html";
            }, 500);
          });
      } else {
        window.location.href = "settings.html";
      }
    });
  } else {
    error.classList.remove("hidden");
    input.value = "";
  }
}

button.addEventListener("click", checkPassword);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") checkPassword();
});

// --- Forgot password ---
forgotButton.addEventListener("click", () => {
  currentResetIndex = 0;
  resetInput.value = "";
  showCurrentWord();
  showContainer(resetContainer);
});

// --- Show current word ---
function showCurrentWord() {
  currentWordEl.textContent = resetWords[currentResetIndex];
}

// --- Handle reset next ---
resetNextBtn.addEventListener("click", async () => {
  const userWord = resetInput.value.trim();

  if (userWord === resetWords[currentResetIndex]) {
    currentResetIndex++;
    resetInput.value = "";

    if (currentResetIndex >= resetWords.length) {
      await chrome.storage.local.remove("extensionPassword");
      showNotification(
        "Password reset successful! Please set a new password.",
        setupContainer
      );
    } else {
      showCurrentWord();
    }
  } else {
    showNotification("Incorrect word! Start over.");
    currentResetIndex = 0;
    resetInput.value = "";
    showCurrentWord();
  }
});

// --- Browser notification function ---
function showBrowserNotification(message, type = 'info') {
  chrome.runtime.sendMessage({
    type: 'showNotification',
    message: message,
    notificationType: type
  });
}

// --- Custom notification function (for login page) ---
function showNotification(message, targetContainer = loginContainer, useBrowserNotification = false) {
  // If useBrowserNotification is true, show browser notification instead
  if (useBrowserNotification) {
    showBrowserNotification(message);
    if (targetContainer !== loginContainer) {
      showContainer(targetContainer);
    }
    return;
  }

  notificationMessage.textContent = message;

  // Show the notification
  customNotification.style.opacity = "0";
  customNotification.classList.remove("hidden");

  void customNotification.offsetWidth;
  customNotification.style.opacity = "1";

  // Focus the OK button
  setTimeout(() => {
    notificationCloseButton.focus();
  }, 100);

  // Setup event listener for the OK button
  notificationCloseButton.addEventListener("click", function closeHandler() {
    // Fade out effect
    customNotification.style.opacity = "0";

    // Wait for transition to complete before hiding
    setTimeout(() => {
      customNotification.classList.add("hidden");
      showContainer(targetContainer);
      notificationCloseButton.removeEventListener("click", closeHandler);
    }, 300);
  });
}

// --- Initialize on DOM load ---
window.addEventListener("DOMContentLoaded", () => {
  init();
  setTimeout(() => {
    document.body.setAttribute("data-loaded", "true");
  }, 50); // 50ms is usually enough
});
