import {
  APP_MARKER,
  CALENDAR_API_BASE,
  COMMUTE_CALENDAR_SUMMARY,
  MAX_EVENTS,
} from "./constants.js";

export async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(token);
    });
  });
}

export async function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

export async function calendarFetch(token, path, options = {}) {
  const response = await fetch(`${CALENDAR_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    await removeCachedToken(token);
    const freshToken = await getAuthToken(false);
    return calendarFetch(freshToken, path, options);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Calendar API error: ${response.status} ${response.statusText} ${detail}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function fetchTimedEvents(token, timeMin, timeMax) {
  const calendarList = await calendarFetch(token, "/users/me/calendarList?maxResults=250");
  const calendars = (calendarList.items || []).filter(
    (cal) => cal.selected !== false && cal.summary !== COMMUTE_CALENDAR_SUMMARY
  );

  const perCalendar = await Promise.all(
    calendars.map((cal) => fetchEventsFromCalendar(token, cal.id, timeMin, timeMax))
  );

  const seen = new Set();
  const merged = [];
  for (const events of perCalendar) {
    for (const event of events) {
      if (!seen.has(event.id)) {
        seen.add(event.id);
        merged.push(event);
      }
    }
  }
  return merged;
}

async function fetchEventsFromCalendar(token, calendarId, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(MAX_EVENTS),
  });

  try {
    const data = await calendarFetch(
      token,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    );
    return data.items || [];
  } catch {
    return [];
  }
}

export async function getCommuteCalendarId(token, settings) {
  if (!settings.useSeparateCalendar) {
    return "primary";
  }

  const cached = await chrome.storage.local.get("commuteCalendarId");
  if (cached.commuteCalendarId) {
    return cached.commuteCalendarId;
  }

  const existingCalendar = await findCommuteCalendar(token);
  if (existingCalendar) {
    await chrome.storage.local.set({ commuteCalendarId: existingCalendar.id });
    return existingCalendar.id;
  }

  const createdCalendar = await createCommuteCalendar(token);
  await chrome.storage.local.set({ commuteCalendarId: createdCalendar.id });
  return createdCalendar.id;
}

async function findCommuteCalendar(token) {
  const data = await calendarFetch(token, "/users/me/calendarList?maxResults=250");
  return (data.items || []).find((calendar) => calendar.summary === COMMUTE_CALENDAR_SUMMARY);
}

async function createCommuteCalendar(token) {
  return calendarFetch(token, "/calendars", {
    method: "POST",
    body: JSON.stringify({
      summary: COMMUTE_CALENDAR_SUMMARY,
      description: "Commute blocks created by NYC Transit Scheduler.",
      timeZone: "America/New_York",
    }),
  });
}

export function isExtensionCommuteEvent(event) {
  return event.extendedProperties?.private?.createdBy === APP_MARKER;
}

export function getEventStart(event) {
  if (event.start?.dateTime) return new Date(event.start.dateTime);
  if (event.start?.date) {
    const [y, m, d] = event.start.date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}

export function getEventEnd(event) {
  if (event.end?.dateTime) return new Date(event.end.dateTime);
  if (event.start?.date) {
    // For all-day events use start-of-day so earliestDeparture doesn't
    // block commutes from an all-day event to a same-day timed event.
    const [y, m, d] = event.start.date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}

export function getRoutableEvents(events) {
  return events
    .filter((event) => !isExtensionCommuteEvent(event))
    .filter((event) => event.location?.trim())
    .filter((event) => getEventStart(event) !== null)
    .sort((a, b) => getEventStart(a).getTime() - getEventStart(b).getTime());
}

export async function fetchExtensionCommuteEvents(token, calendarId, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    privateExtendedProperty: `createdBy=${APP_MARKER}`,
    maxResults: "100",
  });

  const data = await calendarFetch(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
  );
  return data.items || [];
}
