# 🚀 AI Prompt Vault

A Chrome extension to save, organize, search, pin, and instantly copy your frequently used AI prompts.

## ✨ Features

- 📝 Save prompts with a title and category
- 🔍 Search across titles, categories, and prompt text
- 📌 Pin important prompts to keep them at the top
- 🏷️ Category badges on every prompt
- 🎯 Filter prompts by category
- ⭐ Mark favorites and filter to show only favorites
- ↕️ Sort by newest, oldest, or alphabetically (A–Z / Z–A)
- 📋 One-click copy to clipboard
- 📤 Export prompts to a JSON file
- 📥 Import prompts from a JSON file

## 📦 Installation (Load Unpacked in Chrome)

Since this extension isn't published on the Chrome Web Store yet, install it manually in Developer Mode using the steps below.

### Step 1: Open the Extensions menu

Click the puzzle-piece icon in the Chrome toolbar (top right, next to the address bar).

![Click the Extensions icon]
<img width="410" height="384" alt="Screenshot 2026-07-30 235157" src="https://github.com/user-attachments/assets/51f55376-d739-4ba4-a54f-d363f8a7989f" />


### Step 2: Go to "Manage extensions"

In the panel that opens, click **Manage extensions** at the bottom.

![Click Manage extensions]
<img width="852" height="850" alt="Screenshot 2026-07-30 235236" src="https://github.com/user-attachments/assets/1ee701d3-c6f3-4ee5-94b0-68c13a5a98f4" />


### Step 3: Turn on Developer mode

On the Extensions page, toggle **Developer mode** ON — it's in the top-right corner.

![Enable Developer mode]
<img width="592" height="400" alt="Screenshot 2026-07-30 235252" src="https://github.com/user-attachments/assets/6a888770-4592-44db-a002-61e552ebad3e" />


### Step 4: Click "Load unpacked"

Once Developer mode is on, new buttons appear at the top of the page. Click **Load unpacked**.

![Click Load unpacked]
<img width="754" height="422" alt="Screenshot 2026-07-30 235302" src="https://github.com/user-attachments/assets/26b43777-e199-4002-8550-72743051ca10" />


### Step 5: Select the extension folder

In the file picker, select the **Ai-prompt vault** folder (the folder containing `manifest.json`, `index.html`, `popup.js`, and `popup.css`), then click **Select Folder**.

![Select the Ai-prompt vault folder]
<img width="640" height="136" alt="Screenshot 2026-07-30 235321" src="https://github.com/user-attachments/assets/127a4192-13b4-47c4-a14b-3d4ef5308d66" />


### Step 6: Pin it for easy access (optional)

Click the puzzle-piece icon again, find **AI Prompt Vault** in the list, and click the pin icon so it stays visible in your toolbar.

---

That's it! Click the **AI Prompt Vault** icon in your toolbar anytime to save, search, pin, and manage your AI prompts.

## 🔄 Updating the Extension

If you make changes to the code, go back to `chrome://extensions`, find **AI Prompt Vault**, and click the refresh/reload icon on its card to apply the changes.

## 📁 Project Structure

```
Ai-prompt vault/
├── manifest.json    # Extension configuration
├── index.html       # Popup UI
├── popup.js         # App logic
├── popup.css        # Styling
└── icons/           # Extension icons
```
