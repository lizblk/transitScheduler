import {
  DEFAULT_LOOKAHEAD_HOURS,
  DEFAULT_PLANNING_WINDOW,
} from "./src/constants.js";
import { fetchTimedEvents, getAuthToken, getCommuteCalendarId } from "./src/calendarApi.js";
import { removeCommuteEvents, replaceCommuteEvents } from "./src/commuteEvents.js";
import { buildCommutePlan } from "./src/commutePlanner.js";
import { calculateRoute } from "./src/routeApi.js";
import { autocompleteAddress } from "./src/placesApi.js";
import { getSettings, saveSettings } from "./src/settings.js";

function getWindow(settings) {
  const timeMin = new Date();
  const planningWindow = settings.planningWindow || DEFAULT_PLANNING_WINDOW;
  let timeMax;

  if (planningWindow === "TODAY") {
    timeMax = new Date(timeMin);
    timeMax.setHours(23, 59, 59, 999);
  } else if (planningWindow === "THIS_WEEK") {
    timeMax = new Date(timeMin.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else {
    const hours = settings.lookaheadHours || DEFAULT_LOOKAHEAD_HOURS;
    timeMax = new Date(timeMin.getTime() + hours * 60 * 60 * 1000);
  }

  return { timeMin, timeMax };
}

function getCommuteCleanupWindow(settings) {
  const { timeMax } = getWindow(settings);
  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);

  return { timeMin, timeMax };
}

async function previewCommutes() {
  const settings = await getSettings();
  const results = {
    planned: [],
    skipped: [],
    errors: [],
    eventsConsidered: 0,
    defaultTravelMode: settings.travelMode,
    timestamp: new Date().toISOString(),
  };

  try {
    const token = await getAuthToken(true);
    const { timeMin, timeMax } = getWindow(settings);
    const events = await fetchTimedEvents(token, timeMin, timeMax);
    const plan = await buildCommutePlan(events, settings);

    results.eventsConsidered = plan.eventsConsidered;
    results.planned = serializeCommutes(plan.planned);
    results.skipped = serializeSkippedCommutes(plan.skipped);

    await chrome.storage.local.set({
      lastPreviewResults: results,
      lastPreviewWindow: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      },
    });

    return results;
  } catch (error) {
    results.errors.push(error.message);
    return results;
  }
}

async function addCommutesToCalendar() {
  const settings = await getSettings();
  const results = {
    planned: [],
    skipped: [],
    errors: [],
    eventsConsidered: 0,
    created: 0,
    deleted: 0,
    defaultTravelMode: settings.travelMode,
    timestamp: new Date().toISOString(),
  };

  try {
    const token = await getAuthToken(true);
    const { timeMin, timeMax } = getWindow(settings);
    const events = await fetchTimedEvents(token, timeMin, timeMax);
    const plan = await buildCommutePlan(events, settings);

    if (plan.planned.length === 0) {
      return {
        ...results,
        eventsConsidered: plan.eventsConsidered,
        skipped: serializeSkippedCommutes(plan.skipped),
      };
    }

    const cleanupWindow = getCommuteCleanupWindow(settings);
    const commuteCalendarId = await getCommuteCalendarId(token, settings);
    const writeResults = await replaceCommuteEvents(
      token,
      commuteCalendarId,
      plan.planned,
      cleanupWindow.timeMin,
      cleanupWindow.timeMax
    );

    const finalResults = {
      ...results,
      eventsConsidered: plan.eventsConsidered,
      planned: serializeCommutes(plan.planned),
      skipped: serializeSkippedCommutes(plan.skipped),
      created: writeResults.created.length,
      deleted: writeResults.deleted,
      timestamp: new Date().toISOString(),
    };

    await chrome.storage.local.set({ lastPreviewResults: finalResults });
    return finalResults;
  } catch (error) {
    return {
      ...results,
      created: 0,
      deleted: 0,
      errors: [...results.errors, error.message],
    };
  }
}

async function addCurrentCommutesToCalendar(plannedCommutes = []) {
  const settings = await getSettings();
  const results = {
    planned: plannedCommutes,
    skipped: [],
    errors: [],
    eventsConsidered: plannedCommutes.length,
    created: 0,
    deleted: 0,
    defaultTravelMode: settings.travelMode,
    timestamp: new Date().toISOString(),
  };

  try {
    const token = await getAuthToken(true);
    const cleanupWindow = getCommuteCleanupWindow(settings);
    const hydratedCommutes = plannedCommutes.map(hydrateCommute);
    const commuteCalendarId = await getCommuteCalendarId(token, settings);
    const writeResults = await replaceCommuteEvents(
      token,
      commuteCalendarId,
      hydratedCommutes,
      cleanupWindow.timeMin,
      cleanupWindow.timeMax
    );

    results.created = writeResults.created.length;
    results.deleted = writeResults.deleted;
    await Promise.all([
      chrome.storage.local.set({
        lastPreviewResults: results,
        commutesManaged: true,
        lastAutoRefreshAt: null,
      }),
      saveTripModeOverrides(plannedCommutes),
    ]);
    return results;
  } catch (error) {
    return {
      ...results,
      errors: [error.message],
    };
  }
}

async function recalculateCommuteMode(commute, travelMode) {
  const settings = await getSettings();

  try {
    const route = await calculateRoute({
      origin: commute.origin,
      destination: commute.destination,
      arrivalTime: commute.arrivalTarget ? new Date(commute.arrivalTarget) : null,
      departureTime: commute.departureTarget
        ? new Date(commute.departureTarget)
        : commute.earliestDeparture
          ? new Date(commute.earliestDeparture)
          : null,
      travelMode,
    });

    if (!route) {
      return { error: "No route found" };
    }

    const start = commute.departureTarget
      ? new Date(commute.departureTarget)
      : new Date(new Date(commute.arrivalTarget).getTime() - route.durationSeconds * 1000);
    const end = commute.departureTarget
      ? new Date(start.getTime() + route.durationSeconds * 1000)
      : new Date(commute.arrivalTarget);

    if (commute.earliestDeparture && start < new Date(commute.earliestDeparture)) {
      return { error: "Commute overlaps the previous event" };
    }

    return {
      commute: {
        ...commute,
        travelMode,
        travelModeLabel: getTravelModeLabel(travelMode),
        route,
        start: start.toISOString(),
        end: end.toISOString(),
        durationText: route.durationText,
        distanceText: route.distanceText,
        compactSummary: route.compactSummary,
        summary: route.summary,
        mapsUrl: route.mapsUrl,
      },
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function removeCommutesFromCalendar() {
  const settings = await getSettings();
  const results = {
    deleted: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    const token = await getAuthToken(true);
    const { timeMin, timeMax } = getCommuteCleanupWindow(settings);
    const commuteCalendarId = await getCommuteCalendarId(token, settings);
    const removeResults = await removeCommuteEvents(token, commuteCalendarId, timeMin, timeMax);

    results.deleted = removeResults.deleted;
    await chrome.storage.local.remove([
      "lastPreviewResults",
      "lastPreviewWindow",
      "commutesManaged",
      "lastAutoRefreshAt",
    ]);
    return results;
  } catch (error) {
    results.errors.push(error.message);
    return results;
  }
}

async function runAutoRefresh() {
  const settings = await getSettings();
  const { commutesManaged } = await chrome.storage.local.get("commutesManaged");

  if (!settings.autoRefresh || !commutesManaged) {
    return {
      refreshed: false,
      reason: "Auto refresh is off or no commute blocks are currently managed.",
    };
  }

  const results = await addCommutesToCalendar();
  await chrome.storage.local.set({ lastAutoRefreshAt: new Date().toISOString() });
  return {
    refreshed: true,
    results,
  };
}

function serializeCommutes(commutes) {
  return commutes.map((commute) => ({
    tripId: commute.tripId,
    type: commute.type,
    label: commute.label,
    originName: commute.originName,
    destinationName: commute.destinationName,
    origin: commute.origin,
    destination: commute.destination,
    arrivalTarget: commute.arrivalTarget?.toISOString() || null,
    departureTarget: commute.departureTarget?.toISOString() || null,
    earliestDeparture: commute.earliestDeparture?.toISOString() || null,
    sourceEventId: commute.sourceEventId,
    destinationEventId: commute.destinationEventId,
    travelMode: commute.travelMode,
    travelModeLabel: commute.travelModeLabel,
    start: commute.start.toISOString(),
    end: commute.end.toISOString(),
    durationText: commute.route.durationText,
    distanceText: commute.route.distanceText,
    compactSummary: commute.route.compactSummary,
    summary: commute.route.summary,
    route: commute.route,
    mapsUrl: commute.route.mapsUrl,
  }));
}

function serializeSkippedCommutes(commutes) {
  return commutes.map((commute) => ({
    tripId: commute.tripId || null,
    type: commute.type || null,
    label: commute.label || "Skipped",
    reason: commute.reason || "Skipped",
    originName: commute.originName || null,
    destinationName: commute.destinationName || null,
    origin: commute.origin || null,
    destination: commute.destination || null,
    arrivalTarget: commute.arrivalTarget?.toISOString?.() || commute.arrivalTarget || null,
    departureTarget: commute.departureTarget?.toISOString?.() || commute.departureTarget || null,
    earliestDeparture: commute.earliestDeparture?.toISOString?.() || commute.earliestDeparture || null,
    sourceEventId: commute.sourceEventId || null,
    destinationEventId: commute.destinationEventId || null,
    travelMode: commute.travelMode || null,
    start: commute.start?.toISOString?.() || commute.start || null,
    end: commute.end?.toISOString?.() || commute.end || null,
    durationText: commute.route?.durationText || null,
    distanceText: commute.route?.distanceText || null,
    compactSummary: commute.route?.compactSummary || null,
    summary: commute.route?.summary || null,
    mapsUrl: commute.route?.mapsUrl || null,
  }));
}

async function saveTripModeOverrides(plannedCommutes) {
  const settings = await getSettings();
  const tripModeOverrides = {};

  for (const commute of plannedCommutes) {
    if (commute.tripId && commute.travelMode && commute.travelMode !== settings.travelMode) {
      tripModeOverrides[commute.tripId] = commute.travelMode;
    }
  }

  await saveSettings({ ...settings, tripModeOverrides });
}

function hydrateCommute(commute) {
  return {
    ...commute,
    start: new Date(commute.start),
    end: new Date(commute.end),
    route: commute.route || {
      durationText: commute.durationText,
      distanceText: commute.distanceText,
      compactSummary: commute.compactSummary,
      summary: commute.summary,
      mapsUrl: commute.mapsUrl,
      transitSteps: commute.transitSteps || [],
      navigationSteps: commute.navigationSteps || [],
    },
  };
}

function getTravelModeLabel(travelMode) {
  const labels = {
    TRANSIT: "Transit",
    WALK: "Walking",
    DRIVE: "Driving",
    BICYCLE: "Biking",
  };

  return labels[travelMode] || travelMode;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "getSettings") {
    getSettings().then(sendResponse);
    return true;
  }

  if (message.action === "saveSettings") {
    saveSettings(message.settings || {}).then(() => getSettings()).then(sendResponse);
    return true;
  }

  if (message.action === "previewCommutes") {
    previewCommutes().then(sendResponse);
    return true;
  }

  if (message.action === "addCommutesToCalendar") {
    addCommutesToCalendar().then(sendResponse);
    return true;
  }

  if (message.action === "addCurrentCommutesToCalendar") {
    addCurrentCommutesToCalendar(message.planned || []).then(sendResponse);
    return true;
  }

  if (message.action === "recalculateCommuteMode") {
    recalculateCommuteMode(message.commute, message.travelMode).then(sendResponse);
    return true;
  }

  if (message.action === "removeCommutesFromCalendar") {
    removeCommutesFromCalendar().then(sendResponse);
    return true;
  }

  if (message.action === "runAutoRefresh") {
    runAutoRefresh().then(sendResponse);
    return true;
  }

  if (message.action === "getLastPreview") {
    chrome.storage.local.get("lastPreviewResults", (data) => {
      sendResponse(data.lastPreviewResults || null);
    });
    return true;
  }

  if (message.action === "autocompleteAddress") {
    autocompleteAddress(message.input || "")
      .then((suggestions) => sendResponse({ suggestions }))
      .catch((error) => sendResponse({ error: error.message, suggestions: [] }));
    return true;
  }

  return false;
});

chrome.alarms.clear("dailyCommuteRefresh");

chrome.alarms.get("autoCommuteRefresh", (alarm) => {
  if (!alarm) {
    chrome.alarms.create("autoCommuteRefresh", {
      periodInMinutes: 60,
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "autoCommuteRefresh") {
    runAutoRefresh();
  }
});

console.log("NYC Transit Scheduler service worker loaded.");
