import {
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_LOOKAHEAD_HOURS,
  DEFAULT_PLANNING_WINDOW,
  DEFAULT_TRAVEL_MODE,
} from "./constants.js";

export async function getSettings() {
  const values = await chrome.storage.sync.get({
    enabled: true,
    homeAddress: "",
    travelMode: DEFAULT_TRAVEL_MODE,
    planningWindow: DEFAULT_PLANNING_WINDOW,
    autoRefresh: true,
    useSeparateCalendar: true,
    tripModeOverrides: {},
    includeHomeCommutes: false,
    lookaheadHours: DEFAULT_LOOKAHEAD_HOURS,
  });

  return {
    enabled: Boolean(values.enabled),
    homeAddress: values.homeAddress.trim(),
    travelMode: values.travelMode,
    planningWindow: values.planningWindow || DEFAULT_PLANNING_WINDOW,
    autoRefresh: Boolean(values.autoRefresh),
    useSeparateCalendar: Boolean(values.useSeparateCalendar),
    tripModeOverrides: values.tripModeOverrides || {},
    includeHomeCommutes: Boolean(values.includeHomeCommutes),
    bufferMinutes: DEFAULT_BUFFER_MINUTES,
    lookaheadHours: Number(values.lookaheadHours) || DEFAULT_LOOKAHEAD_HOURS,
  };
}

export async function saveSettings(settings) {
  const current = await getSettings();
  const values = {
    enabled: Boolean(settings.enabled),
    homeAddress: (settings.homeAddress || "").trim(),
    travelMode: settings.travelMode || DEFAULT_TRAVEL_MODE,
    planningWindow: settings.planningWindow || DEFAULT_PLANNING_WINDOW,
    autoRefresh: Boolean(settings.autoRefresh),
    useSeparateCalendar: settings.useSeparateCalendar !== false,
    includeHomeCommutes: Boolean(settings.includeHomeCommutes),
    bufferMinutes: DEFAULT_BUFFER_MINUTES,
  };

  if (settings.tripModeOverrides !== undefined) {
    values.tripModeOverrides = settings.tripModeOverrides || {};
  } else if (current.travelMode !== values.travelMode) {
    values.tripModeOverrides = {};
  }
  await chrome.storage.sync.set(values);
}
