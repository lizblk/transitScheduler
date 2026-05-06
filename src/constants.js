export const APP_NAME = "NYC Transit Scheduler";
export const APP_MARKER = "nyc-transit-scheduler";
export const COMMUTE_CALENDAR_SUMMARY = "Transit Scheduler";

export const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
export const ROUTES_PROXY_URL = "https://transit-scheduler-three.vercel.app/api/routes";
export const PLACES_PROXY_URL = "https://transit-scheduler-three.vercel.app/api/places";

export const DEFAULT_LOOKAHEAD_HOURS = 24;
export const DEFAULT_PLANNING_WINDOW = "NEXT_24_HOURS";
export const DEFAULT_BUFFER_MINUTES = 1;
export const DEFAULT_TRAVEL_MODE = "TRANSIT";
export const MAX_EVENTS = 50;

export const COMMUTE_EVENT_COLOR_IDS = {
  TRANSIT: "9",
  WALK: "10",
  DRIVE: "5",
  BICYCLE: "3",
};

export const TRAVEL_MODES = {
  TRANSIT: "Transit",
  WALK: "Walking",
  DRIVE: "Driving",
  BICYCLE: "Biking",
};
