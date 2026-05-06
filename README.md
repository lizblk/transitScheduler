# NYC Transit Scheduler

NYC Transit Scheduler is a Chrome extension that turns Google Calendar locations into route-aware commute blocks. It reads upcoming timed events from the user's primary Google Calendar, calculates routes between events, and creates commute events in a dedicated `Transit Scheduler` calendar.

The project is focused on NYC students and commuters, but the current route engine uses Google Routes data and can work outside NYC as long as event locations are valid.

## Current Features

- Reads upcoming Google Calendar events with locations.
- Plans commutes for **Today**, **Next 24 hours**, or **This week**.
- Creates real Google Calendar commute events in a separate `Transit Scheduler` calendar.
- Supports transit, walking, driving, and biking.
- Lets users choose a default travel mode and override each commute row individually.
- Optionally adds home-to-first-event and last-event-to-home commute blocks.
- Adds route-first calendar titles such as `B → 5 | 47 mins`.
- Adds route summaries, transit steps, stop information, and a compact Google Maps link in event details.
- Provides Google Places autocomplete for the home address field.
- Provides daily auto-refresh and a manual **Refresh Routes** button.
- Uses a Vercel backend proxy so Google Maps API keys are not shipped in the Chrome extension.

## How It Works

1. The user signs into Google through Chrome's `chrome.identity` API.
2. The extension reads upcoming timed events from the user's primary calendar.
3. Events without locations or exact times are skipped.
4. The commute planner builds trips between consecutive events, plus optional home commutes.
5. The extension sends route requests to the deployed backend proxy.
6. The backend calls Google Routes API or Google Places API using an environment variable API key.
7. The popup shows editable commute preview cards.
8. The user adds the current commute plan to Calendar.
9. Commute events are written to a separate `Transit Scheduler` calendar and tagged with private metadata.

## Architecture

```text
manifest.json
  Chrome extension configuration, OAuth client, permissions, stable unpacked extension key.

background.js
  Service worker. Handles popup messages, Google auth, preview, add, remove, refresh, and autocomplete requests.

src/calendarApi.js
  Google Calendar API helpers, auth token handling, timed event fetching, and commute calendar creation.

src/commutePlanner.js
  Builds commute candidates and calculates route plans.

src/commuteEvents.js
  Creates/removes commute events and formats Calendar titles/descriptions.

src/routeApi.js
  Calls the route proxy and normalizes Google Routes responses.

src/placesApi.js
  Calls the Places autocomplete proxy.

src/settings.js
  Reads/writes user settings from Chrome storage.

api/routes.js
  Vercel serverless function that proxies Google Routes API.

api/places.js
  Vercel serverless function that proxies new Google Places API autocomplete.

injection/popup/
  Extension popup HTML, CSS, and client-side interaction logic.
```

## APIs Used

- Google Calendar API
- Google Routes API
- New Google Places API autocomplete endpoint
- Chrome Extensions APIs:
  - `identity`
  - `storage`
  - `alarms`

## Security Model

The Chrome extension does **not** contain a Google Maps API key. Route and address autocomplete requests go through the backend proxy:

```text
Chrome extension -> Vercel proxy -> Google Maps Platform APIs
```

The backend reads the key from:

```text
GOOGLE_ROUTES_API_KEY
```

That key should be restricted in Google Cloud to:

- Routes API
- Places API

## Stable Extension ID

This repo includes a `manifest.json` `key` field so everyone loading the unpacked extension gets the same Chrome extension ID:

```text
aiaijloileajfeblodcgofpealkfghge
```

The Google OAuth Chrome Extension client must use that ID.

## Setup

Detailed setup lives in:

- [injection/SETUP.md](injection/SETUP.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

Short version:

1. Enable Google Calendar API, Routes API, and Places API.
2. Configure Google OAuth for the stable extension ID.
3. Deploy the Vercel backend with `GOOGLE_ROUTES_API_KEY`.
4. Load the repo as an unpacked Chrome extension.
5. Test Preview, Add to Calendar, Refresh Routes, and Remove Commute Blocks.

## Known Limitations

- Google Calendar's grid UI is limited. The extension can control event title, time, location, color, and description, but it cannot render fully custom route chips inside calendar blocks.
- Daily refresh uses Chrome alarms, so it runs when Chrome is available rather than at a guaranteed exact time.
- MTA real-time delay integration is planned but not implemented yet.
- OAuth test users may need to be added in Google Cloud if the app remains in Testing mode.

## Future Work

- MTA service-alert integration for subway delay warnings.
- Compare multiple travel modes and recommend the best one.
- Smarter conflict detection when there is not enough time between events.
- Better support for work/school saved addresses.
- Optional notifications when it is time to leave.

## Team

- Safwan Chowdhury
- Liz Black
