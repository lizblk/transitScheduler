# NYC Transit Scheduler Project Plan

## Product Direction

The first reliable version should create real Google Calendar events for commutes instead of trying to draw temporary blocks inside the Google Calendar webpage. Real events are easier to demo, easier to update, and less likely to break when Google Calendar changes its UI.

Example output:

- `10:00 AM Class at 15 Beekman Street`
- `1:25 PM Commute: Class -> Work`
- `2:00 PM Work shift`

## MVP Scope

1. Read upcoming timed Google Calendar events.
2. Keep events that have a location.
3. Build commute candidates between consecutive events.
4. Optionally build home-to-first-event and last-event-to-home commutes.
5. Calculate routes with the Google Routes API.
6. Preview commute blocks in the extension popup.
7. Create real Google Calendar commute events after user confirmation.

## Current Architecture

```text
background.js
  Handles Chrome messages and orchestrates preview/add workflows.

src/settings.js
  Reads and writes extension settings from chrome.storage.

src/calendarApi.js
  Handles OAuth, Calendar API requests, and event filtering helpers.

src/routeApi.js
  Calls the Google Routes API and normalizes route responses.

src/commutePlanner.js
  Turns calendar events and settings into planned commute blocks.

src/commuteEvents.js
  Deletes old extension-created commute blocks and creates new ones.

injection/popup/
  Extension popup UI for settings, preview, and calendar insertion.
```

## Data Model

Commute events are marked with private extended properties:

```json
{
  "createdBy": "nyc-transit-scheduler",
  "commuteType": "event-to-event",
  "sourceEventId": "...",
  "destinationEventId": "..."
}
```

This lets the extension find and replace only the commute events it created.

## Next Milestones

1. Test OAuth and Calendar reads in Chrome.
2. Configure a restricted Google Routes API key for local demo builds without exposing it in the user-facing popup.
3. Preview routes for a few test Calendar events with locations.
4. Create commute blocks and confirm they appear in Google Calendar.
5. Improve duplicate/update behavior after the basic flow works.
6. Add MTA delay awareness as a later enhancement.
