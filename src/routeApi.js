import { ROUTES_API_URL, TRAVEL_MODES } from "./constants.js";

const TRANSFER_ARROW = "→";

const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.legs.steps.localizedValues",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.transitDetails",
  "routes.legs.steps.travelMode",
  "routes.localizedValues",
  "routes.routeLabels",
].join(",");

export async function calculateRoute({
  origin,
  destination,
  arrivalTime,
  departureTime,
  travelMode,
  mapsApiKey,
}) {
  if (!mapsApiKey) {
    throw new Error("Missing Google Maps API key. Add it in the extension popup settings.");
  }

  const body = {
    origin: { address: origin },
    destination: { address: destination },
    travelMode,
    computeAlternativeRoutes: false,
  };

  if (travelMode === "TRANSIT" && arrivalTime) {
    body.arrivalTime = arrivalTime.toISOString();
  } else if (travelMode === "TRANSIT" && departureTime) {
    body.departureTime = departureTime.toISOString();
  } else if (travelMode === "DRIVE" && departureTime) {
    body.departureTime = departureTime.toISOString();
    body.routingPreference = "TRAFFIC_AWARE";
  } else if (travelMode === "DRIVE") {
    body.routingPreference = "TRAFFIC_AWARE";
  }

  if (travelMode === "TRANSIT") {
    body.transitPreferences = {
      allowedTravelModes: ["SUBWAY", "TRAIN", "BUS"],
    };
  }

  const response = await fetch(ROUTES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": mapsApiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Routes API error: ${response.status} ${response.statusText} ${detail}`);
  }

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) return null;

  const durationSeconds = parseDurationSeconds(route.duration);
  const transitSteps = getTransitSteps(route);
  const navigationSteps = getNavigationSteps(route);
  const compactSummary = getCompactSummary(transitSteps, travelMode);
  const summary = summarizeRoute(transitSteps, navigationSteps, travelMode);

  return {
    durationSeconds,
    durationText: route.localizedValues?.duration?.text || formatDuration(durationSeconds),
    distanceText: route.localizedValues?.distance?.text || "",
    compactSummary,
    summary,
    transitSteps,
    navigationSteps,
    mapsUrl: buildGoogleMapsUrl(origin, destination, travelMode),
  };
}

function parseDurationSeconds(duration) {
  if (!duration) return 0;
  return Number(duration.replace("s", "")) || 0;
}

function getTransitSteps(route) {
  const steps = route.legs?.flatMap((leg) => leg.steps || []) || [];
  return steps
    .map((step) => step.transitDetails)
    .filter(Boolean)
    .map((details) => {
      const line = details.transitLine || {};
      const stopDetails = details.stopDetails || {};

      return {
        line: cleanTransitLineName(line.nameShort || line.name || "Transit"),
        lineName: line.name || line.nameShort || "Transit",
        vehicle: line.vehicle?.name?.text || line.vehicle?.type || "Transit",
        headsign: details.headsign || "",
        departureStop: stopDetails.departureStop?.name || "",
        arrivalStop: stopDetails.arrivalStop?.name || "",
        departureTime:
          details.localizedValues?.departureTime?.time?.text ||
          formatIsoTime(stopDetails.departureTime),
        arrivalTime:
          details.localizedValues?.arrivalTime?.time?.text ||
          formatIsoTime(stopDetails.arrivalTime),
        stopCount: details.stopCount || 0,
      };
    });
}

function getNavigationSteps(route) {
  const steps = route.legs?.flatMap((leg) => leg.steps || []) || [];
  return steps
    .map((step) => step.navigationInstruction?.instructions)
    .filter(Boolean);
}

function getCompactSummary(transitSteps, travelMode) {
  const transitLines = transitSteps.map((step) => step.line).filter(Boolean);

  if (transitLines.length > 0) {
    return dedupe(transitLines).join(` ${TRANSFER_ARROW} `);
  }

  return TRAVEL_MODES[travelMode] || "Route";
}

function summarizeRoute(transitSteps, navigationSteps, travelMode) {
  if (transitSteps.length > 0) {
    return `Take ${dedupe(transitSteps.map((step) => step.line)).join(` ${TRANSFER_ARROW} `)}`;
  }

  if (navigationSteps.length > 0) {
    return navigationSteps[0];
  }

  return `${TRAVEL_MODES[travelMode] || "Route"} route`;
}

function dedupe(items) {
  return [...new Set(items)];
}

function cleanTransitLineName(name) {
  return String(name).replace(/\s+Line$/i, "").trim();
}

function formatDuration(totalSeconds) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function formatIsoTime(isoString) {
  if (!isoString) return "";

  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildGoogleMapsUrl(origin, destination, travelMode) {
  const modeMap = {
    TRANSIT: "transit",
    WALK: "walking",
    DRIVE: "driving",
    BICYCLE: "bicycling",
  };

  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: modeMap[travelMode] || "transit",
  });

  return `https://www.google.com/maps/dir/?${params}`;
}
