const loginContainer = document.getElementById("login-container");
const setupContainer = document.getElementById("setup-container");
const resetContainer = document.getElementById("reset-container");

// --- LOGIN FORM ELEMENTS ---
const input = document.getElementById("password-input");
const button = document.getElementById("submit-password");
const error = document.getElementById("error-message");
const forgotButton = document.getElementById("forgot-password");

// --- SETUP FORM ELEMENTS ---
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const saveButton = document.getElementById("save-password");
const setupError = document.getElementById("setup-error");

// --- RESET FORM ELEMENTS ---
const currentWordEl = document.getElementById("current-word");
const resetInput = document.getElementById("reset-input");
const resetNextBtn = document.getElementById("reset-next");

// --- Reset words ---
const resetWords = [
  "orange", "castle", "mirror", "planet", "forest",
  "window", "guitar", "breeze", "pillow", "dragon"
];
let currentResetIndex = 0;

// Step 1: Check if password exists
chrome.storage.local.get("extensionPassword", (data) => {
  if (data.extensionPassword) {
    loginContainer.style.display = "block";
  } else {
    setupContainer.style.display = "block";
  }
});

// Step 2: Handle password setup
saveButton?.addEventListener("click", () => {
  const newPass = newPasswordInput.value;
  const confirmPass = confirmPasswordInput.value;

  if (newPass && newPass === confirmPass) {
    chrome.storage.local.set({ extensionPassword: newPass }, () => {
      setupContainer.style.display = "none";
      loginContainer.style.display = "block";
      alert("Password set successfully! Please log in.");
    });
  } else {
    setupError.style.display = "block";
  }
});

// Step 3: Handle login
button?.addEventListener("click", checkPassword);
input?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") checkPassword();
});

function checkPassword() {
  const enteredPass = input.value;
  chrome.storage.local.get("extensionPassword", (data) => {
    if (enteredPass === data.extensionPassword) {
      window.location.href = "popup.html";
    } else {
      error.style.display = "block";
      input.value = "";
    }
  });
}

// Step 4: Forgot password
forgotButton?.addEventListener("click", () => {
  loginContainer.style.display = "none";
  resetContainer.style.display = "block";
  currentResetIndex = 0;
  resetInput.value = "";
  showCurrentWord();
});

// Display the current word
function showCurrentWord() {
  currentWordEl.textContent = resetWords[currentResetIndex];
}

// Handle next word
resetNextBtn.addEventListener("click", () => {
  const userWord = resetInput.value.trim();
  if (userWord === resetWords[currentResetIndex]) {
    currentResetIndex++;
    resetInput.value = "";

    if (currentResetIndex >= resetWords.length) {
      // Completed reset
      chrome.storage.local.remove("extensionPassword", () => {
        alert("Password reset successful! Please set a new password.");
        resetContainer.style.display = "none";
        setupContainer.style.display = "block";
      });
    } else {
      showCurrentWord(); // Show next word
    }
  } else {
    alert("Incorrect word! Start over.");
    currentResetIndex = 0;
    resetInput.value = "";
    showCurrentWord();
  }
});
