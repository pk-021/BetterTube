// BTube Overlay Notification System
"use strict";

class BTubeNotificationOverlay {
  constructor() {
    this.notifications = [];
    this.container = null;
    this.notificationId = 0;
    this.init();
  }

  init() {
    // Create the main overlay container
    this.createContainer();
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'showOverlayNotification') {
        try {
          this.showNotification(message.message, message.notificationType || 'info');
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error showing overlay notification:', error);
          sendResponse({ success: false, error: error.message });
        }
      }
      return true; // Keep the message channel open
    });
    
    console.log('BTube overlay notification system initialized');
  }

  createContainer() {
    // Remove existing container if any
    if (this.container) {
      this.container.remove();
    }

    // Create overlay container
    this.container = document.createElement('div');
    this.container.className = 'btube-notification-overlay';
    this.container.setAttribute('data-btube-overlay', 'true');
    
    // Append to document
    document.body.appendChild(this.container);
  }

  showNotification(message, type = 'info', duration = 5000) {
    const notificationId = ++this.notificationId;
    
    // Create notification element
    const notification = this.createNotificationElement(message, type, notificationId);
    
    // Add to container
    this.container.appendChild(notification);
    this.notifications.push({ id: notificationId, element: notification });

    // Trigger show animation
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // Auto-close timer
    const timer = setTimeout(() => {
      this.removeNotification(notificationId);
    }, duration);

    // Store timer reference
    notification.dataset.timer = timer;

    return notificationId;
  }

  createNotificationElement(message, type, id) {
    const notification = document.createElement('div');
    notification.className = 'btube-notification';
    notification.dataset.notificationId = id;

    // Get logo URL
    const logoUrl = chrome.runtime.getURL('assets/logo_v2.png');

    notification.innerHTML = `
      <div class="btube-notification-header">
        <img src="${logoUrl}" alt="BTube" class="btube-notification-logo">
        <span class="btube-notification-title">BTube</span>
        <button class="btube-notification-close" data-action="close">&times;</button>
      </div>
      <div class="btube-notification-body">
        <p class="btube-notification-message">${this.escapeHtml(message)}</p>
      </div>
      <div class="btube-notification-actions">
        <button class="btube-notification-btn" data-action="ok">OK</button>
      </div>
      <div class="btube-notification-progress"></div>
    `;

    // Add event listeners
    notification.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'close' || action === 'ok') {
        this.removeNotification(id);
      }
    });

    // Start progress bar animation
    setTimeout(() => {
      const progressBar = notification.querySelector('.btube-notification-progress');
      if (progressBar) {
        progressBar.classList.add('animate');
      }
      // Overlay notification system replaced with Chrome notifications
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
      // Remove from notifications array
      this.notifications = this.notifications.filter(n => n.id !== id);
    }, 300);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public method to show notification (can be called from other scripts)
  static show(message, type = 'info') {
    if (window.btubeOverlay) {
      return window.btubeOverlay.showNotification(message, type);
    }
  }
}

// Initialize overlay system
if (!window.btubeOverlay) {
  window.btubeOverlay = new BTubeNotificationOverlay();
}