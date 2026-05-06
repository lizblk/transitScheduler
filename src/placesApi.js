import { PLACES_PROXY_URL } from "./constants.js";

export async function autocompleteAddress(input) {
  const searchText = input.trim();
  if (searchText.length < 3) return [];

  const response = await fetch(PLACES_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: searchText }),
  });

  if (!response.ok) {
    throw new Error("Address suggestions are unavailable right now.");
  }

  const data = await response.json();
  return data.suggestions || [];
}
