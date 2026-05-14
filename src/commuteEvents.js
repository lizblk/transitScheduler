import { APP_MARKER, COMMUTE_EVENT_COLOR_IDS } from "./constants.js";
import { calendarFetch, fetchExtensionCommuteEvents } from "./calendarApi.js";

export async function removeCommuteEvents(token, calendarId, timeMin, timeMax) {
  const existing = await fetchExtensionCommuteEvents(token, calendarId, timeMin, timeMax);

  await Promise.all(existing.map((event) => deleteCalendarEvent(token, calendarId, event.id)));

  return { deleted: existing.length };
}

export async function replaceCommuteEvents(token, calendarId, plannedCommutes, timeMin, timeMax) {
  const existing = await fetchExtensionCommuteEvents(token, calendarId, timeMin, timeMax);

  await Promise.all(existing.map((event) => deleteCalendarEvent(token, calendarId, event.id)));

  const created = await Promise.all(
    plannedCommutes.map((commute) => createCommuteEvent(token, calendarId, commute))
  );

  return {
    deleted: existing.length,
    created,
  };
}

async function createCommuteEvent(token, calendarId, commute) {
  const body = {
    summary: getCommuteTitle(commute),
    location: getVisibleRoutePreview(commute),
    description: buildDescription(commute),
    start: {
      dateTime: commute.start.toISOString(),
      timeZone: "America/New_York",
    },
    end: {
      dateTime: commute.end.toISOString(),
      timeZone: "America/New_York",
    },
    colorId: getCommuteColorId(commute),
    extendedProperties: {
      private: {
        createdBy: APP_MARKER,
        commuteType: commute.type,
        sourceEventId: commute.sourceEventId,
        destinationEventId: commute.destinationEventId,
      },
    },
  };

  return calendarFetch(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

function deleteCalendarEvent(token, calendarId, eventId) {
  return calendarFetch(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: "DELETE" }
  );
}

function getCommuteTitle(commute) {
  const destination =
    commute.type === "event-to-home" ? "home" : commute.destinationName;
  const routePreview = `${commute.route.compactSummary} | ${commute.route.durationText}`;

  if (routePreview.length <= 28) {
    return routePreview;
  }

  return `${routePreview} to ${destination}`;
}

function getCommuteColorId(commute) {
  return COMMUTE_EVENT_COLOR_IDS[commute.travelMode] || COMMUTE_EVENT_COLOR_IDS.TRANSIT;
}

function getVisibleRoutePreview(commute) {
  return `${commute.route.compactSummary} | ${commute.route.durationText} | Open Maps in details`;
}

function buildDescription(commute) {
  const lines = [
    `<b>${escapeHtml(commute.route.compactSummary)} | ${escapeHtml(commute.route.durationText)}</b>`,
    `<a href="${escapeAttribute(commute.route.mapsUrl)}">Open in Google Maps</a>`,
    "",
    `Leave: ${formatTime(commute.start)}`,
    `Arrive: ${formatTime(commute.end)}`,
    `Mode: ${escapeHtml(commute.travelModeLabel)}`,
    `Route: ${escapeHtml(commute.route.summary)}`,
    "",
    ...buildStepLines(commute),
    "",
    `From: ${escapeHtml(commute.originName)}`,
    escapeHtml(commute.origin),
    "",
    `To: ${escapeHtml(commute.destinationName)}`,
    escapeHtml(commute.destination),
    "",
    "Created by NYC Transit Scheduler.",
  ];

  return lines.join("<br>");
}

function buildStepLines(commute) {
  if (commute.route.transitSteps?.length) {
    const lines = ["<b>Transit steps</b>"];

    if (commute.route.walkToTransitSeconds > 0) {
      lines.push(`Walk to station: ${formatDuration(commute.route.walkToTransitSeconds)}`);
    }

    for (const step of commute.route.transitSteps) {
      lines.push(formatTransitStep(step));
    }

    if (commute.route.walkFromTransitSeconds > 0) {
      lines.push(`Walk to destination: ${formatDuration(commute.route.walkFromTransitSeconds)}`);
    }

    return lines;
  }

  if (commute.route.navigationSteps?.length) {
    return [
      "<b>Route preview</b>",
      ...commute.route.navigationSteps.slice(0, 5).map((step) => escapeHtml(step)),
      "Open Google Maps for turn-by-turn details.",
    ];
  }

  return [];
}

function formatTransitStep(step) {
  const parts = [
    `${escapeHtml(step.line)} toward ${escapeHtml(step.headsign || "destination")}`,
    step.departureStop ? `board at ${escapeHtml(step.departureStop)}` : "",
    step.arrivalStop ? `get off at ${escapeHtml(step.arrivalStop)}` : "",
    step.stopCount ? `${step.stopCount} stops` : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

function formatDuration(totalSeconds) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
