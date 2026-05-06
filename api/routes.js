const GOOGLE_ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

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

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.GOOGLE_ROUTES_API_KEY) {
    res.status(500).json({ error: "Routes proxy is missing GOOGLE_ROUTES_API_KEY." });
    return;
  }

  try {
    const routeRequest = sanitizeRouteRequest(req.body || {});
    const response = await fetch(GOOGLE_ROUTES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_ROUTES_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(routeRequest),
    });

    const text = await response.text();
    res.status(response.status);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sanitizeRouteRequest(body) {
  const origin = normalizeAddress(body.origin?.address);
  const destination = normalizeAddress(body.destination?.address);
  const travelMode = normalizeTravelMode(body.travelMode);

  const routeRequest = {
    origin: { address: origin },
    destination: { address: destination },
    travelMode,
    computeAlternativeRoutes: false,
  };

  if (travelMode === "TRANSIT") {
    if (body.arrivalTime) {
      routeRequest.arrivalTime = normalizeIsoTime(body.arrivalTime);
    } else if (body.departureTime) {
      routeRequest.departureTime = normalizeIsoTime(body.departureTime);
    }

    routeRequest.transitPreferences = {
      allowedTravelModes: ["SUBWAY", "TRAIN", "BUS"],
    };
  }

  if (travelMode === "DRIVE") {
    routeRequest.routingPreference = "TRAFFIC_AWARE";
    if (body.departureTime) {
      routeRequest.departureTime = normalizeIsoTime(body.departureTime);
    }
  }

  return routeRequest;
}

function normalizeAddress(value) {
  const address = String(value || "").trim();
  if (!address) {
    throw new Error("Origin and destination are required.");
  }

  if (address.length > 500) {
    throw new Error("Address is too long.");
  }

  return address;
}

function normalizeTravelMode(value) {
  const travelMode = String(value || "TRANSIT").toUpperCase();
  const allowed = new Set(["TRANSIT", "WALK", "DRIVE", "BICYCLE"]);

  if (!allowed.has(travelMode)) {
    throw new Error("Unsupported travel mode.");
  }

  return travelMode;
}

function normalizeIsoTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid route time.");
  }

  return date.toISOString();
}
