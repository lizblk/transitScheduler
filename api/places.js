const GOOGLE_PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

const FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text",
  "suggestions.placePrediction.structuredFormat",
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
    res.status(500).json({ error: "Places proxy is missing GOOGLE_ROUTES_API_KEY." });
    return;
  }

  try {
    const input = normalizeInput(req.body?.input);
    const response = await fetch(GOOGLE_PLACES_AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_ROUTES_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["us"],
        languageCode: "en",
        locationBias: {
          circle: {
            center: {
              latitude: 40.7128,
              longitude: -74.006,
            },
            radius: 50000,
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }

    const suggestions = (data.suggestions || [])
      .map((suggestion) => suggestion.placePrediction)
      .filter(Boolean)
      .map((prediction) => ({
        placeId: prediction.placeId,
        text: prediction.text?.text || "",
        mainText: prediction.structuredFormat?.mainText?.text || "",
        secondaryText: prediction.structuredFormat?.secondaryText?.text || "",
      }))
      .filter((prediction) => prediction.text);

    res.status(200).json({ suggestions });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeInput(value) {
  const input = String(value || "").trim();

  if (input.length < 3) {
    throw new Error("Type at least 3 characters.");
  }

  if (input.length > 200) {
    throw new Error("Search text is too long.");
  }

  return input;
}
