# NYC Transit Scheduler — Setup Guide

## Prerequisites

- Google Chrome browser
- A Google account
- A Google Cloud project (free tier is fine)

## Step 1: Load the Extension to Get Your Extension ID

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select this `nyc-transit-scheduler` folder
4. The extension will appear in your list. With the manifest key in this repo, the extension ID should be:

   ```text
   aiaijloileajfeblodcgofpealkfghge
   ```

## Step 2: Set Up Google Cloud Credentials

### Create the project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project called "NYC Transit Scheduler"

### Enable APIs
3. Go to **APIs & Services → Library**
4. Search for and enable:
   - **Google Calendar API**
   - **Routes API** (under Google Maps)
   - **Places API** (under Google Maps)

### Configure OAuth consent screen
5. Go to **APIs & Services → OAuth consent screen**
6. Choose **External** user type
7. Fill in: App name, User support email, Developer contact email
8. On the Scopes step, add: `https://www.googleapis.com/auth/calendar`
9. On the Test users step, add your Gmail address
10. Save and go back to the dashboard

### Create OAuth Client ID
11. Go to **APIs & Services → Credentials**
12. Click **Create Credentials → OAuth client ID**
13. Application type: **Chrome Extension**
14. Paste the stable extension ID:

   ```text
   aiaijloileajfeblodcgofpealkfghge
   ```
15. Click Create — copy the **Client ID** (ends in `.apps.googleusercontent.com`)

### Create Maps API Key for the Backend
16. Back in Credentials, click **Create Credentials → API Key**
17. Click **Restrict Key** → under API restrictions, select **Routes API** and **Places API**
18. Save the key for your backend environment variable, not the extension source.

## Step 3: Configure the Extension

1. Confirm `manifest.json` contains the OAuth client ID for the stable extension ID above.

2. Confirm the backend proxy is deployed. See `docs/DEPLOYMENT.md`.

3. Confirm `src/constants.js` points at the deployed proxy URLs:

   ```text
   https://transit-scheduler-three.vercel.app/api/routes
   https://transit-scheduler-three.vercel.app/api/places
   ```

4. Confirm `manifest.json` includes the deployed backend host permission:

   ```text
   https://transit-scheduler-three.vercel.app/*
   ```

## Step 4: Reload and Test

1. Go back to `chrome://extensions/`
2. Click the **reload** button (circular arrow) on the NYC Transit Scheduler card
3. Click the extension icon in the toolbar
4. Enter your home address and click **Save Settings**
5. Click **Preview** to calculate commute blocks.
6. Click **Add to Calendar** to create real commute events.
7. The extension will ask for Google account permission on first run.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Authorization failed" | Check that Client ID in manifest.json matches Google Cloud credentials |
| Consent prompt does not update | Remove/reload the extension or revoke the app from your Google account, then authorize again |
| "No home address set" | Click the extension icon and enter/save your address |
| "No transit route found" | The event location may not be a real address — try with a specific street address in a test event |
| Extension ID changed | Confirm `manifest.json` includes the `key` field from this repo, then reload the extension. |

## File Structure

```
nyc-transit-scheduler/
├── manifest.json          # Extension config, OAuth client ID, permissions
├── background.js          # Service worker: message handling and workflow orchestration
├── src/
│   ├── calendarApi.js     # OAuth, Calendar API calls, event helpers
│   ├── commuteEvents.js   # Creates/deletes extension commute events
│   ├── commutePlanner.js  # Builds route candidates between calendar events
│   ├── constants.js       # API endpoints and defaults
│   ├── routeApi.js        # Google Routes API calls
│   └── settings.js        # chrome.storage settings helpers
├── injection/
│   ├── SETUP.md
│   └── popup/
│       ├── popup.html     # Extension popup UI
│       ├── popup.css      # Popup styles
│       └── popup.js       # Popup logic
├── api/
│   └── routes.js          # Serverless route proxy for Google Routes API
├── injection/icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    ├── DEPLOYMENT.md      # Backend proxy and publishing setup
    └── PRODUCT_ARCHITECTURE.md
```
