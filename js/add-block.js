// add-block.js - Handle adding blocked websites and channels

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const saveBtn = document.getElementById('save-btn');
  const typeRadios = document.querySelectorAll('input[name="block-type"]');
  const websiteInput = document.getElementById('website-input');
  const channelInput = document.getElementById('channel-input');
  const websiteUrlField = document.getElementById('website-url');
  const channelNameField = document.getElementById('channel-name');

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

  // Close popup handlers
  const closePopup = () => {
    window.close();
  };

  closeBtn.addEventListener('click', closePopup);
  cancelBtn.addEventListener('click', closePopup);

  // Save blocked content
  saveBtn.addEventListener('click', async () => {
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

    // Close popup after saving
    window.close();
  });

  // Add blocked website
  async function addBlockedWebsite(url) {
    try {
      // Clean up the URL
      let cleanUrl = url;
      if (!url.startsWith('http')) {
        cleanUrl = 'https://' + url;
      }

      // Get existing blocked websites
      const result = await chrome.storage.local.get(['blockedWebsites']);
      const blockedWebsites = result.blockedWebsites || [];

      // Check if already blocked
      if (blockedWebsites.some(item => item.url === cleanUrl)) {
        alert('This website is already blocked');
        return;
      }

      // Add new blocked website
      blockedWebsites.push({
        url: cleanUrl,
        addedAt: Date.now()
      });

      // Save to storage
      await chrome.storage.local.set({ blockedWebsites });
      
      console.log('[Block] Website added:', cleanUrl);
    } catch (error) {
      console.error('Error adding blocked website:', error);
      alert('Failed to block website. Please try again.');
    }
  }

  // Add blocked channel
  async function addBlockedChannel(channelName) {
    try {
      // Get existing blocked channels
      const result = await chrome.storage.local.get(['blockedChannels']);
      const blockedChannels = result.blockedChannels || [];

      // Check if already blocked
      if (blockedChannels.some(item => item.name === channelName)) {
        alert('This channel is already blocked');
        return;
      }

      // Add new blocked channel
      blockedChannels.push({
        name: channelName,
        addedAt: Date.now()
      });

      // Save to storage
      await chrome.storage.local.set({ blockedChannels });
      
      console.log('[Block] Channel added:', channelName);
    } catch (error) {
      console.error('Error adding blocked channel:', error);
      alert('Failed to block channel. Please try again.');
    }
  }

  // Handle Enter key in input fields
  websiteUrlField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  });

  channelNameField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  });

  // Apply dark mode if needed
  chrome.storage.local.get(['dark_mode'], (result) => {
    if (result.dark_mode) {
      document.documentElement.setAttribute('dark_mode', 'true');
    }
  });
});
