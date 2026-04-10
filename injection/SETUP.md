# NYC Transit Scheduler — Setup Guide

## Prerequisites

- Google Chrome browser
- A Google account
- A Google Cloud project (free tier is fine)

## Step 1: Load the Extension to Get Your Extension ID

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select this `nyc-transit-scheduler` folder
4. The extension will appear in your list — copy the **ID** (a 32-character string like `abcdefghijklmnopqrstuvwxyz...`)

## Step 2: Set Up Google Cloud Credentials

### Create the project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project called "NYC Transit Scheduler"

### Enable APIs
3. Go to **APIs & Services → Library**
4. Search for and enable:
   - **Google Calendar API**
   - **Directions API** (under Google Maps)

### Configure OAuth consent screen
5. Go to **APIs & Services → OAuth consent screen**
6. Choose **External** user type
7. Fill in: App name, User support email, Developer contact email
8. On the Scopes step, add: `https://www.googleapis.com/auth/calendar.events`
9. On the Test users step, add your Gmail address
10. Save and go back to the dashboard

### Create OAuth Client ID
11. Go to **APIs & Services → Credentials**
12. Click **Create Credentials → OAuth client ID**
13. Application type: **Chrome Extension**
14. Paste the **extension ID** from Step 1
15. Click Create — copy the **Client ID** (ends in `.apps.googleusercontent.com`)

### Create Maps API Key
16. Back in Credentials, click **Create Credentials → API Key**
17. Click **Restrict Key** → under API restrictions, select **Directions API** only
18. Save the key

## Step 3: Configure the Extension

1. Open `manifest.json` and replace `YOUR_CLIENT_ID_HERE.apps.googleusercontent.com` with your actual Client ID

2. Open `background.js` and replace `YOUR_MAPS_API_KEY_HERE` with your actual Maps API key

## Step 4: Reload and Test

1. Go back to `chrome://extensions/`
2. Click the **reload** button (circular arrow) on the NYC Transit Scheduler card
3. Click the extension icon in the toolbar
4. Enter your home address and click **Save**
5. Click **Check Calendar & Calculate Routes**
6. The extension will ask for Google account permission on first run

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Authorization failed" | Check that Client ID in manifest.json matches Google Cloud credentials |
| "No home address set" | Click the extension icon and enter/save your address |
| "No transit route found" | The event location may not be a real address — try with a specific street address in a test event |
| Extension ID changed | If you removed and re-loaded the extension, the ID changes. Update it in Google Cloud credentials. |

## File Structure

```
nyc-transit-scheduler/
├── manifest.json          # Extension config, OAuth client ID, permissions
├── background.js          # Service worker: auth, calendar, directions, injection
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic: address saving, results display
├── icons/
│   ├── icon16.png         # Toolbar icon
│   ├── icon48.png         # Extensions page icon
│   └── icon128.png        # Chrome Web Store icon
└── SETUP.md               # This file
```
