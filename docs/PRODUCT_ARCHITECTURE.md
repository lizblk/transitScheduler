# Product And Architecture Guide

## Product Summary

NYC Transit Scheduler is a Chrome extension that creates route-aware commute blocks for Google Calendar users who need travel time built into their schedule.

The user experience is:

1. Open the extension side panel.
2. Set a home address, default mode, and planning window.
3. Preview upcoming commutes.
4. Adjust individual commute modes if needed.
5. Add commute blocks to Calendar.
6. Let hourly refresh keep routes up to date.

## Main User Workflows

### Preview Commutes

The side panel asks the background service worker to:

1. Authenticate with Google Calendar.
2. Fetch upcoming timed events from the primary calendar.
3. Filter to events with locations.
4. Build route candidates between consecutive events.
5. Call the route proxy for each candidate.
6. Return planned, skipped, and error results.

### Add Commutes To Calendar

After preview, the side panel sends the current edited plan to the background worker. This matters because each row can have a different selected travel mode.

The background worker:

1. Finds or creates the `Transit Scheduler` calendar.
2. Removes existing extension-created commute blocks in the active planning window.
3. Creates new commute events from the current preview plan.
4. Saves trip-mode overrides for future refreshes.

### Refresh Routes

Manual **Refresh Routes** and hourly auto-refresh use the same route-planning pipeline. Refresh only runs automatically after the user has added commute blocks at least once.

### Remove Commute Blocks

Remove deletes extension-created commute blocks from the managed commute calendar and clears the local managed state.

## Frontend Popup

Files:

```text
injection/popup/popup.html
injection/popup/popup.css
injection/popup/popup.js
```

Responsibilities:

- Render settings.
- Autosave settings as controls change.
- Show address autocomplete suggestions.
- Trigger preview/add/remove/refresh actions.
- Render commute preview cards.
- Support per-row travel mode changes.
- Display friendly status messages.

The side panel does not call Google directly. It sends messages to `background.js`.

## Background Service Worker

File:

```text
background.js
```

Responsibilities:

- Receive side panel messages.
- Manage Google auth through `chrome.identity`.
- Fetch Calendar events.
- Coordinate route planning.
- Create/remove Calendar commute events.
- Run hourly refresh through `chrome.alarms`.
- Proxy address autocomplete requests from the side panel to `src/placesApi.js`.

Main message actions:

- `getSettings`
- `saveSettings`
- `previewCommutes`
- `addCurrentCommutesToCalendar`
- `recalculateCommuteMode`
- `removeCommutesFromCalendar`
- `runAutoRefresh`
- `getLastPreview`
- `autocompleteAddress`

## Calendar Integration

File:

```text
src/calendarApi.js
```

The extension reads normal user events from the primary calendar, but writes commute blocks to a dedicated calendar named:

```text
Transit Scheduler
```

Commute events are tagged with private extended properties:

```json
{
  "createdBy": "nyc-transit-scheduler",
  "commuteType": "event-to-event",
  "sourceEventId": "...",
  "destinationEventId": "..."
}
```

This lets the extension safely find and replace only commute events it created.

## Route Planning

Files:

```text
src/commutePlanner.js
src/routeApi.js
src/commuteEvents.js
```

`commutePlanner.js` builds trip candidates:

- Home -> first event
- Event -> next event
- Last event -> home

`routeApi.js` calls the backend route proxy and normalizes responses into a compact route object:

```js
{
  durationSeconds,
  durationText,
  compactSummary,
  summary,
  transitSteps,
  navigationSteps,
  mapsUrl
}
```

`commuteEvents.js` turns planned commutes into Google Calendar events. Calendar titles prioritize route previews:

```text
B → 5 | 47 mins
Driving | 22 mins
```

Descriptions include detailed steps and a compact Google Maps link.

## Address Autocomplete

Files:

```text
api/places.js
src/placesApi.js
```

The side panel sends home-address input to the background worker, which calls `src/placesApi.js`, which calls:

```text
https://transit-scheduler-three.vercel.app/api/places
```

The backend uses the **new Places API** endpoint:

```text
https://places.googleapis.com/v1/places:autocomplete
```

Suggestions are biased toward NYC and restricted to US results.

## Backend Proxy

Files:

```text
api/routes.js
api/places.js
vercel.json
```

The backend keeps the Google Maps Platform API key off the client. It expects this Vercel environment variable:

```text
GOOGLE_ROUTES_API_KEY
```

Despite the name, the key must allow:

- Routes API
- Places API

## Settings

File:

```text
src/settings.js
```

Stored settings include:

- Popup theme
- Home address
- Default travel mode
- Planning window
- Auto-refresh preference
- Separate calendar preference
- Home commute preference
- Per-trip travel mode overrides

## Permissions

Manifest permissions:

- `identity`: Google OAuth through Chrome.
- `storage`: User preferences and cached preview state.
- `alarms`: Hourly route refresh.
- `sidePanel`: Keeps the planner open beside Google Calendar.

Host permissions:

- `https://www.googleapis.com/*`: Google Calendar API.
- `https://transit-scheduler-three.vercel.app/*`: Route and Places proxy.

OAuth scope:

```text
https://www.googleapis.com/auth/calendar
```

This is needed because the extension creates and manages a separate commute calendar.

## Stable Extension ID

`manifest.json` includes a public `key` field so unpacked installs share this ID:

```text
aiaijloileajfeblodcgofpealkfghge
```

Google Cloud OAuth must be configured for that ID.

## Current Limitations

- Google Calendar blocks cannot show fully custom UI.
- Hourly refresh depends on Chrome alarms and Chrome availability.
- MTA delay detection is not implemented yet.
- The backend does not store user data, but route requests do pass through it transiently.

## Recommended Next Features

1. Expand beyond NYC to support other major cities with city-aware defaults and broader route testing.
2. MTA service alerts for subway delay warnings.
3. Multi-mode comparison and automatic recommendation.
4. Risk warnings when users may be late.
5. More polished onboarding for first-time users.
6. Optional departure notifications.
