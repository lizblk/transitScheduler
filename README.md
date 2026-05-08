# NYC Transit Scheduler

NYC Transit Scheduler is a Chrome extension that creates route-aware commute blocks for Google Calendar. It reads upcoming timed events from the user's primary Google Calendar, calculates routes between events, and creates commute events in a dedicated `Transit Scheduler` calendar.

The project is focused on NYC students and commuters. The current route engine uses Google Routes data, so the core idea can work outside NYC as long as event locations are valid, but this project intentionally optimizes the product experience around NYC.

## Current Features

- Reads upcoming Google Calendar events with locations.
- Plans commutes for **Today**, **Next 24 hours**, or **This week**.
- Creates real Google Calendar commute events in a separate `Transit Scheduler` calendar.
- Supports transit, walking, driving, and biking.
- Lets users choose a default travel mode and override each commute row individually.
- Shows overlaps as editable warning cards so users can try another mode.
- Optionally adds home-to-first-event and last-event-to-home commute blocks.
- Adds route-first calendar titles such as `B → 5 | 47 mins`.
- Adds route summaries, transit steps, stop information, and a compact Google Maps link in event details.
- Provides Google Places autocomplete for the home address field.
- Provides a manual **Refresh Routes** button and optional route refresh while Chrome is running.
- Opens as a Chrome side panel scoped to Google Calendar tabs.
- Keeps previews session-only, with a small **Clear** action for discarding the current draft.
- Uses a Vercel backend proxy so Google Maps API keys are not shipped in the Chrome extension.

## How It Works

1. The user signs into Google through Chrome's `chrome.identity` API.
2. The extension reads upcoming timed events from the user's primary calendar.
3. Events without locations or exact times are skipped.
4. The commute planner builds trips between consecutive events, plus optional home commutes.
5. The extension sends route requests to the deployed backend proxy.
6. The backend calls Google Routes API or Google Places API using an environment variable API key.
7. The side panel shows editable commute preview cards.
8. The user adds the current commute plan to Calendar.
9. Commute events are written to a separate `Transit Scheduler` calendar and tagged with private metadata.
10. Added commute blocks can be refreshed hourly, manually refreshed, or removed by the extension.

## Architecture

```text
manifest.json
  Chrome extension configuration, OAuth client, permissions, stable unpacked extension key.

background.js
  Service worker. Handles side panel messages, Google auth, preview, add, remove, refresh, side panel tab scoping, and autocomplete requests.

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
  Side panel HTML, CSS, and client-side interaction logic.
```

## APIs Used

- Google Calendar API
- Google Routes API
- New Google Places API autocomplete endpoint
- Chrome Extensions APIs:
  - `identity`
  - `storage`
  - `alarms`
  - `sidePanel`

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
- Google Calendar sometimes takes a few seconds to visually show API-created or API-deleted commute events. The extension has already finished once it reports that blocks were added or removed, but the Google Calendar page may lag while its web UI syncs. For now, users can wait briefly or use the subtle **Refresh view** action shown after Add, Remove, and Refresh Routes. A future version should look for a less disruptive way to reduce this perceived delay.
- Optional automatic refresh is handled by Chrome extension alarms. This is useful while the user has Chrome open, but it is not a server-side scheduler: if Chrome is closed, asleep, or suspends the extension, refresh may run late or not until Chrome is active again. The manual **Refresh Routes** button is the reliable way to force an immediate update.
- MTA real-time delay integration is planned but not implemented yet.
- OAuth test users may need to be added in Google Cloud if the app remains in Testing mode.

## Future Work

### More reliable background refresh

The current automatic refresh uses Chrome alarms, which only run while Chrome is available. A production version could move scheduled refresh to a backend job so commute blocks update even when the user's browser is closed.

To implement this, we would need server-side OAuth with refresh tokens, secure token storage, user/account mapping, a scheduler such as Vercel Cron or Google Cloud Scheduler, and a backend job that can recalculate routes and patch the user's commute calendar. We would also need stronger privacy/security documentation, token revocation support, and more careful error handling for cases where a user's Google access expires.

Because that changes the project from a mostly client-side extension into a user-data backend, we kept the current version simpler and added manual **Refresh Routes** instead.

### Better Google Calendar sync behavior

Google Calendar can take a few seconds to visually reflect events created or deleted through the Calendar API. A future version should investigate less disruptive ways to reduce this perceived delay.

Possible approaches include patching existing commute events instead of deleting and recreating them, reducing the number of Calendar API writes, testing whether primary-calendar writes sync faster than a separate commute calendar, and exploring whether a Calendar-specific refresh prompt can be made less jarring than a full page reload. A deeper version could also add a small local sync layer that tracks which commute events were just written, then uses content-script UI hints to make the extension feel responsive while Google Calendar catches up.

### Expand beyond NYC

Google Maps and Routes APIs make multi-city support technically possible because the routing engine already accepts normal addresses. To support other major cities well, we would need city-aware defaults, broader route testing, region-specific onboarding copy, and optional local transit integrations for places where Google route data is not enough.

To implement this, we would likely add a city/profile setting, expand QA with sample schedules in multiple cities, handle different transit naming conventions, and make the product copy less NYC-specific. For cities with strong local transit APIs, we could add optional adapters similar to the planned MTA integration. For this project, we intentionally focused on NYC to keep the scope realistic and testable.

### MTA service alerts

A future NYC-focused version could show warnings when a commute uses a train line with active MTA delays or service changes.

To implement this, we would likely add a backend endpoint that reads MTA GTFS-realtime service-alert feeds, parses the alert data, maps Google route labels such as `B` or `5` to MTA route IDs, filters alerts to only the lines used in a commute, and displays compact warnings in the side panel and Calendar event description. We would also need to decide how much alert detail is useful: a small "service alert" badge may be better than showing long MTA alert text inside the extension.

### Multi-mode recommendations

The extension currently calculates the selected mode for each commute. A stronger planner could compare transit, walking, driving, and biking automatically and recommend the best option.

To implement this, the route planner would request multiple modes per trip, compare duration and overlap risk, handle cases where a mode is unavailable, and present a recommendation without overwhelming the user with too many choices. We would also need quota/cost controls because calculating every mode for every commute would multiply the number of Google Routes API calls.

### Smarter conflict detection

The current overlap logic checks whether a commute fits between events. Future versions could explain conflicts more clearly and account for user preferences.

Examples include showing how many minutes late a user would be, warning when a route is too close for comfort, allowing custom buffer times per user or event type, and distinguishing "impossible" commutes from merely risky ones. To implement this well, the planner would need to track slack time before and after each commute, store user tolerance settings, and show conflict labels that are informative without making the preview cards too busy.

### Saved places and notifications

Saved places could let users store home, work, school, or frequent destinations. Notifications could remind users when it is time to leave.

To implement saved places, we would expand the settings model and popup UI beyond a single home address, add a small place-management interface, and use Places autocomplete for each saved location. The planner could then recognize common labels such as "home," "work," or "campus" even when a calendar event does not contain a full street address.

To implement departure notifications, we would need Chrome notification permissions, alarm scheduling per commute event, and careful handling so notifications stay accurate after route refreshes or Calendar changes. Like automatic refresh, browser-based notifications would only be reliable while Chrome is available; truly reliable mobile-style reminders would require a backend notification system or integration with the user's calendar reminders.

## Team

- Safwan Chowdhury
- Liz Black
