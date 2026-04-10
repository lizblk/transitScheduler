// ============================================================
// NYC Transit Scheduler — Background Service Worker
// ============================================================
// This service worker handles:
//   1. OAuth token management via chrome.identity
//   2. Fetching upcoming Google Calendar events
//   3. Calculating transit routes via Google Maps Directions API
//   4. Injecting departure times back into calendar events
// ============================================================

// --------------- CONFIGURATION ---------------

const MAPS_API_KEY = "API_Key_Here";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const DIRECTIONS_API_BASE = "https://maps.googleapis.com/maps/api/directions/json";

// How far ahead to look for events (in hours)
const LOOKAHEAD_HOURS = 24;

// Prefix used to identify departure notes we've already injected
const DEPARTURE_TAG = "🚇 Leave by";

// --------------- AUTH ---------------

/**
 * Get an OAuth token using chrome.identity.
 * Returns a valid access token string or throws on failure.
 */
async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Remove a cached token (e.g. if it's expired) so the next call fetches a fresh one.
 */
async function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

// --------------- GOOGLE CALENDAR ---------------

/**
 * Fetch upcoming calendar events within the lookahead window.
 * Returns an array of event objects from the Calendar API.
 */
async function fetchUpcomingEvents(token) {
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() + LOOKAHEAD_HOURS * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    timeMin: now,
    timeMax: cutoff,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: "20",
  });

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (response.status === 401) {
    // Token expired — clear it and retry once
    await removeCachedToken(token);
    const freshToken = await getAuthToken(false);
    return fetchUpcomingEvents(freshToken);
  }

  if (!response.ok) {
    throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Filter events to only those with a non-empty location and a future start time.
 */
function filterEventsWithLocations(events) {
  return events.filter((event) => {
    const location = (event.location || "").trim();
    if (!location) return false;

    // Skip events that already have a departure annotation
    if (event.description && event.description.includes(DEPARTURE_TAG)) {
      return false;
    }

    // Must have a dateTime (skip all-day events)
    return !!event.start?.dateTime;
  });
}

// --------------- GOOGLE MAPS DIRECTIONS ---------------

/**
 * Calculate transit travel time from origin to destination, arriving by arrivalTime.
 *
 * Returns { durationSeconds, durationText, departureTime } or null if no route found.
 */
async function calculateTransitRoute(origin, destination, arrivalTimeMs) {
  const params = new URLSearchParams({
    origin,
    destination,
    mode: "transit",
    transit_mode: "subway",
    arrival_time: Math.floor(arrivalTimeMs / 1000).toString(),
    key: MAPS_API_KEY,
  });

  const response = await fetch(`${DIRECTIONS_API_BASE}?${params}`);

  if (!response.ok) {
    console.warn(`Directions API error: ${response.status}`);
    return null;
  }

  const data = await response.json();

  if (data.status !== "OK" || !data.routes?.length) {
    console.warn(`No transit route found: ${data.status}`);
    return null;
  }

  const leg = data.routes[0].legs[0];
  const durationSeconds = leg.duration.value;
  const durationText = leg.duration.text;

  // Calculate when to leave: event start minus travel duration, minus a 5-min buffer
  const bufferMs = 5 * 60 * 1000;
  const departureTimeMs = arrivalTimeMs - durationSeconds * 1000 - bufferMs;

  return {
    durationSeconds,
    durationText,
    departureTime: new Date(departureTimeMs),
  };
}

// --------------- CALENDAR INJECTION ---------------

/**
 * Update an event's description to include a departure time note.
 */
async function injectDepartureTime(token, event, routeInfo) {
  const departureStr = routeInfo.departureTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const note = `${DEPARTURE_TAG} ${departureStr} (${routeInfo.durationText} commute + 5 min buffer)`;

  const existingDescription = event.description || "";
  const updatedDescription = `${note}\n\n${existingDescription}`.trim();

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${event.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description: updatedDescription }),
    }
  );

  if (!response.ok) {
    console.error(`Failed to update event "${event.summary}": ${response.status}`);
    return false;
  }

  console.log(`✅ Injected departure time for "${event.summary}": ${note}`);
  return true;
}

// --------------- MAIN PIPELINE ---------------

/**
 * Run the full pipeline:
 *   1. Authenticate
 *   2. Fetch upcoming events
 *   3. Filter to events with locations
 *   4. Calculate transit routes
 *   5. Inject departure times
 *
 * Returns a summary object for the popup to display.
 */
async function runPipeline() {
  const results = {
    processed: [],
    skipped: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    // Step 1: Get auth token
    const token = await getAuthToken(true);

    // Step 2: Get home address from storage
    const { homeAddress } = await chrome.storage.sync.get("homeAddress");
    if (!homeAddress) {
      results.errors.push("No home address set. Please set one in the extension popup.");
      return results;
    }

    // Step 3: Fetch events
    const allEvents = await fetchUpcomingEvents(token);
    const events = filterEventsWithLocations(allEvents);

    if (events.length === 0) {
      results.skipped.push("No upcoming events with locations found.");
      return results;
    }

    // Step 4 & 5: Calculate routes and inject departure times
    for (const event of events) {
      try {
        const eventStartMs = new Date(event.start.dateTime).getTime();
        const routeInfo = await calculateTransitRoute(
          homeAddress,
          event.location,
          eventStartMs
        );

        if (!routeInfo) {
          results.skipped.push({
            event: event.summary,
            reason: "No transit route found",
          });
          continue;
        }

        // Don't inject if departure time is in the past
        if (routeInfo.departureTime.getTime() < Date.now()) {
          results.skipped.push({
            event: event.summary,
            reason: "Departure time already passed",
          });
          continue;
        }

        const success = await injectDepartureTime(token, event, routeInfo);
        if (success) {
          results.processed.push({
            event: event.summary,
            departureTime: routeInfo.departureTime.toISOString(),
            travelTime: routeInfo.durationText,
          });
        }
      } catch (err) {
        results.errors.push({
          event: event.summary,
          error: err.message,
        });
      }
    }
  } catch (err) {
    results.errors.push(`Pipeline error: ${err.message}`);
  }

  // Store results so the popup can read them
  await chrome.storage.local.set({ lastRunResults: results });
  return results;
}

// --------------- MESSAGE HANDLING ---------------

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "runPipeline") {
    runPipeline().then(sendResponse).catch((err) => {
      sendResponse({ errors: [err.message] });
    });
    return true; // keep the message channel open for async response
  }

  if (message.action === "getLastResults") {
    chrome.storage.local.get("lastRunResults", (data) => {
      sendResponse(data.lastRunResults || null);
    });
    return true;
  }
});

// --------------- PERIODIC ALARM (Step 8 — wired up now, activates later) ---------------

chrome.alarms.create("transitCheck", { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "transitCheck") {
    console.log("⏰ Running scheduled transit check...");
    runPipeline();
  }
});

console.log("NYC Transit Scheduler service worker loaded.");
