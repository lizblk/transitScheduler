import { getEventEnd, getEventStart, getRoutableEvents } from "./calendarApi.js";
import { TRAVEL_MODES } from "./constants.js";
import { calculateRoute } from "./routeApi.js";

export async function buildCommutePlan(events, settings) {
  const routableEvents = getRoutableEvents(events);
  const trips = buildTripCandidates(routableEvents, settings);
  const planned = [];
  const skipped = [];

  for (const trip of trips) {
    try {
      const travelMode = settings.tripModeOverrides?.[trip.tripId] || settings.travelMode;
      const route = await calculateRoute({
        origin: trip.origin,
        destination: trip.destination,
        arrivalTime: trip.arrivalTarget,
        departureTime: trip.departureTarget || trip.earliestDeparture,
        travelMode,
      });

      if (!route) {
        skipped.push({ ...trip, travelMode, label: trip.label, reason: "No route found" });
        continue;
      }

      const start = trip.departureTarget
        ? trip.departureTarget
        : new Date(trip.arrivalTarget.getTime() - route.durationSeconds * 1000);
      const end = trip.departureTarget
        ? new Date(start.getTime() + route.durationSeconds * 1000)
        : trip.arrivalTarget;

      if (end.getTime() <= Date.now()) {
        skipped.push({
          ...trip,
          travelMode,
          route,
          start,
          end,
          label: trip.label,
          reason: "Commute already ended",
        });
        continue;
      }

      if (trip.earliestDeparture && start < trip.earliestDeparture) {
        skipped.push({
          ...trip,
          travelMode,
          route,
          start,
          end,
          label: trip.label,
          reason: "Commute overlaps the previous event",
        });
        continue;
      }

      planned.push({
        ...trip,
        travelMode,
        travelModeLabel: TRAVEL_MODES[travelMode] || travelMode,
        route,
        start,
        end,
      });
    } catch (error) {
      skipped.push({ ...trip, label: trip.label, reason: error.message });
    }
  }

  return {
    eventsConsidered: routableEvents.length,
    planned,
    skipped,
  };
}

function buildTripCandidates(events, settings) {
  const trips = [];
  const bufferMs = settings.bufferMinutes * 60 * 1000;

  if (settings.includeHomeCommutes && settings.homeAddress && events.length > 0) {
    const first = events[0];
    trips.push({
      tripId: `home::${first.id}`,
      type: "home-to-event",
      label: `Home → ${eventName(first)}`,
      originName: "Home",
      destinationName: eventName(first),
      origin: settings.homeAddress,
      destination: first.location,
      arrivalTarget: new Date(getEventStart(first).getTime() - bufferMs),
      sourceEventId: "home",
      destinationEventId: first.id,
    });
  }

  for (let index = 0; index < events.length - 1; index += 1) {
    const from = events[index];
    const to = events[index + 1];

    trips.push({
      tripId: `${from.id}::${to.id}`,
      type: "event-to-event",
      label: `${eventName(from)} → ${eventName(to)}`,
      originName: eventName(from),
      destinationName: eventName(to),
      origin: from.location,
      destination: to.location,
      arrivalTarget: new Date(getEventStart(to).getTime() - bufferMs),
      earliestDeparture: getEventEnd(from),
      sourceEventId: from.id,
      destinationEventId: to.id,
    });
  }

  if (settings.includeHomeCommutes && settings.homeAddress && events.length > 0) {
    const last = events[events.length - 1];
    trips.push({
      tripId: `${last.id}::home`,
      type: "event-to-home",
      label: `${eventName(last)} → Home`,
      originName: eventName(last),
      destinationName: "Home",
      origin: last.location,
      destination: settings.homeAddress,
      departureTarget: new Date(getEventEnd(last).getTime() + bufferMs),
      earliestDeparture: getEventEnd(last),
      sourceEventId: last.id,
      destinationEventId: "home",
    });
  }

  return trips;
}

function eventName(event) {
  return event.summary || "Untitled event";
}
