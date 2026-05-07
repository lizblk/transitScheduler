const elements = {
  themeToggle: document.getElementById("theme-toggle"),
  homeAddress: document.getElementById("home-address"),
  addressSuggestions: document.getElementById("address-suggestions"),
  travelMode: document.getElementById("travel-mode"),
  planningWindow: document.getElementById("planning-window"),
  includeHomeCommutes: document.getElementById("include-home-commutes"),
  useSeparateCalendar: document.getElementById("use-separate-calendar"),
  autoRefresh: document.getElementById("auto-refresh"),
  previewBtn: document.getElementById("preview-btn"),
  refreshBtn: document.getElementById("refresh-btn"),
  addBtn: document.getElementById("add-btn"),
  removeBtn: document.getElementById("remove-btn"),
  status: document.getElementById("status"),
  resultsSection: document.getElementById("results-section"),
  resultsMeta: document.getElementById("results-meta"),
  resultsList: document.getElementById("results-list"),
};

const PREVIEW_MAX_AGE_MS = 30 * 60 * 1000;

let currentResults = null;
let currentSettings = null;
let addressAutocompleteTimer = null;
let settingsSaveTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await sendMessage({ action: "getSettings" });
  currentSettings = settings;
  renderSettings(settings);

  const lastPreview = await sendMessage({ action: "getLastPreview" });
  if (shouldRestorePreview(lastPreview, settings)) {
    renderResults(lastPreview);
  } else if (lastPreview) {
    await sendMessage({ action: "clearLastPreview" });
  }
});

elements.homeAddress.addEventListener("input", () => {
  window.clearTimeout(addressAutocompleteTimer);
  addressAutocompleteTimer = window.setTimeout(showAddressSuggestions, 250);
  scheduleSettingsSave();
});

elements.homeAddress.addEventListener("blur", () => {
  window.setTimeout(hideAddressSuggestions, 150);
});

elements.travelMode.addEventListener("change", () => {
  if (currentResults) {
    clearResults();
    setStatus("Preview again to apply the new default mode.", "warning");
  }
  scheduleSettingsSave({ immediate: true });
});

elements.themeToggle.addEventListener("change", async () => {
  const theme = elements.themeToggle.checked ? "dark" : "light";
  applyTheme(theme);
  currentSettings = await saveSettings({ quiet: true, preserveResults: true });
});

for (const element of [
  elements.planningWindow,
  elements.includeHomeCommutes,
  elements.useSeparateCalendar,
  elements.autoRefresh,
]) {
  element.addEventListener("change", () => {
    if (currentResults) {
      clearResults();
      setStatus("Settings updated. Preview again to refresh the plan.", "warning");
    }
    scheduleSettingsSave({ immediate: true });
  });
}

elements.previewBtn.addEventListener("click", async () => {
  currentSettings = await saveSettings();
  await runAction(elements.previewBtn, "Previewing...", async () => {
    const results = await sendMessage({ action: "previewCommutes" });
    renderResults(results);
    setStatus(buildStatus(results, "Preview ready."), results.errors.length ? "error" : "success");
  });
});

elements.addBtn.addEventListener("click", async () => {
  currentSettings = await saveSettings();
  await runAction(elements.addBtn, "Adding...", async () => {
    const results = await sendMessage({
      action: "addCurrentCommutesToCalendar",
      planned: currentResults?.planned || [],
    });
    renderResults(results);

    if (results.errors.length) {
      setStatus(buildStatus(results, "Some commutes could not be added."), "error");
      return;
    }

    setStatus(
      `Added ${results.created || 0} commute block${results.created === 1 ? "" : "s"} to Calendar.`,
      "success"
    );
  });
});

elements.refreshBtn.addEventListener("click", async () => {
  currentSettings = await saveSettings();
  await runAction(elements.refreshBtn, "Refreshing...", async () => {
    const response = await sendMessage({ action: "runAutoRefresh" });

    if (!response.refreshed) {
      setStatus(response.reason || "Add commute blocks once before refreshing routes.", "warning");
      return;
    }

    renderResults(response.results);

    if (response.results?.errors?.length) {
      setStatus(buildStatus(response.results, "Some routes could not be refreshed."), "error");
      return;
    }

    setStatus("Routes refreshed.", "success");
  });
});

elements.removeBtn.addEventListener("click", async () => {
  await runAction(elements.removeBtn, "Removing...", async () => {
    const results = await sendMessage({ action: "removeCommutesFromCalendar" });

    if (results.errors?.length) {
      setStatus(formatErrorList(results.errors), "error");
      return;
    }

    clearResults();
    setStatus(
      `Removed ${results.deleted || 0} commute block${results.deleted === 1 ? "" : "s"}.`,
      "success"
    );
  });
});

function renderSettings(settings) {
  const theme = resolveTheme(settings.theme);
  applyTheme(theme);
  elements.themeToggle.checked = theme === "dark";
  elements.homeAddress.value = settings.homeAddress || "";
  elements.travelMode.value = settings.travelMode || "TRANSIT";
  elements.planningWindow.value = settings.planningWindow || "NEXT_24_HOURS";
  elements.includeHomeCommutes.checked = settings.includeHomeCommutes;
  elements.useSeparateCalendar.checked = settings.useSeparateCalendar !== false;
  elements.autoRefresh.checked = settings.autoRefresh;
}

async function showAddressSuggestions() {
  const input = elements.homeAddress.value.trim();
  if (input.length < 3) {
    hideAddressSuggestions();
    return;
  }

  try {
    const result = await sendMessage({ action: "autocompleteAddress", input });
    if (result.error || !result.suggestions?.length) {
      hideAddressSuggestions();
      return;
    }

    renderAddressSuggestions(result.suggestions);
  } catch (_error) {
    hideAddressSuggestions();
  }
}

function renderAddressSuggestions(suggestions) {
  elements.addressSuggestions.innerHTML = "";

  for (const suggestion of suggestions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "address-suggestion";

    const main = document.createElement("span");
    main.className = "address-main";
    main.textContent = suggestion.mainText || suggestion.text;
    button.appendChild(main);

    if (suggestion.secondaryText) {
      const secondary = document.createElement("span");
      secondary.className = "address-secondary";
      secondary.textContent = suggestion.secondaryText;
      button.appendChild(secondary);
    }

    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      elements.homeAddress.value = suggestion.text;
      hideAddressSuggestions();
      scheduleSettingsSave({ immediate: true });
    });

    elements.addressSuggestions.appendChild(button);
  }

  elements.addressSuggestions.classList.remove("hidden");
}

function hideAddressSuggestions() {
  elements.addressSuggestions.classList.add("hidden");
}

function scheduleSettingsSave(options = {}) {
  window.clearTimeout(settingsSaveTimer);
  const delay = options.immediate ? 0 : 500;
  settingsSaveTimer = window.setTimeout(async () => {
    currentSettings = await saveSettings({ quiet: true });
  }, delay);
}

async function saveSettings(options = {}) {
  const defaultModeChanged =
    currentSettings?.travelMode && currentSettings.travelMode !== elements.travelMode.value;
  const settings = {
    theme: elements.themeToggle.checked ? "dark" : "light",
    homeAddress: elements.homeAddress.value,
    travelMode: elements.travelMode.value,
    planningWindow: elements.planningWindow.value,
    includeHomeCommutes: elements.includeHomeCommutes.checked,
    useSeparateCalendar: elements.useSeparateCalendar.checked,
    autoRefresh: elements.autoRefresh.checked,
  };

  if (defaultModeChanged) {
    settings.tripModeOverrides = {};
    if (!options.preserveResults) {
      clearResults();
    }
    if (!options.quiet) {
      setStatus("Default mode changed. Preview again to update commute modes.", "warning");
    }
  }

  return sendMessage({
    action: "saveSettings",
    settings,
  });
}

function resolveTheme(theme) {
  if (theme === "dark" || theme === "light") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.body.classList.toggle("theme-dark", theme === "dark");
}

function shouldRestorePreview(preview, settings) {
  if (!preview || preview.defaultTravelMode !== settings.travelMode || !preview.timestamp) {
    return false;
  }

  const previewAge = Date.now() - new Date(preview.timestamp).getTime();
  return previewAge >= 0 && previewAge <= PREVIEW_MAX_AGE_MS;
}

function renderResults(results) {
  currentResults = results;
  currentResults.defaultTravelMode = currentResults.defaultTravelMode || elements.travelMode.value;
  elements.resultsList.innerHTML = "";
  elements.resultsSection.classList.remove("hidden");
  elements.resultsMeta.textContent = `${results.eventsConsidered || 0} events checked`;
  elements.addBtn.disabled = !results.planned?.length || Boolean(results.errors?.length);

  if (!results.planned?.length && !results.skipped?.length && !results.errors?.length) {
    appendResult("empty", "No commute blocks found", "Add locations to upcoming events and preview again.", "", "Empty");
    return;
  }

  for (const item of buildTimelineItems(results)) {
    if (item.kind === "planned") {
      appendPlannedResult(item.data);
    } else if (isEditableSkippedItem(item.data)) {
      appendEditableSkippedResult(item.data);
    } else {
      appendTimelineNotice(item);
    }
  }
}

function buildTimelineItems(results) {
  const items = [];

  for (const item of results.planned || []) {
    items.push({
      kind: "planned",
      data: item,
      sortTime: getSortTime(item) || Number.MAX_SAFE_INTEGER,
      order: items.length,
    });
  }

  for (const item of results.skipped || []) {
    items.push({
      kind: "skipped",
      data: item,
      sortTime: getSortTime(item) || Number.MAX_SAFE_INTEGER,
      order: items.length,
    });
  }

  for (const item of results.errors || []) {
    items.push({
      kind: "error",
      data: item,
      sortTime: Number.MAX_SAFE_INTEGER,
      order: items.length,
    });
  }

  return items.sort((a, b) => a.sortTime - b.sortTime || a.order - b.order);
}

function getSortTime(item) {
  for (const value of [item.arrivalTarget, item.departureTarget, item.earliestDeparture, item.start]) {
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  return null;
}

function appendPlannedResult(item) {
  const div = document.createElement("div");
  div.className = "result-item planned";
  div.dataset.tripId = item.tripId;

  const header = document.createElement("div");
  header.className = "result-event";
  header.textContent = item.label;

  const badge = document.createElement("span");
  badge.className = "badge badge-ready";
  badge.textContent = currentResults?.created ? "Added" : "Ready";

  const topRow = document.createElement("div");
  topRow.className = "result-top-row";
  topRow.appendChild(header);
  topRow.appendChild(badge);
  div.appendChild(topRow);

  const controls = document.createElement("div");
  controls.className = "result-controls";

  const select = document.createElement("select");
  select.className = "mode-select";
  select.setAttribute("aria-label", `Travel mode for ${item.label}`);

  for (const option of getTravelModeOptions()) {
    const optionEl = document.createElement("option");
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    optionEl.selected = option.value === item.travelMode;
    select.appendChild(optionEl);
  }

  select.addEventListener("change", () => updateCommuteMode(item.tripId, select.value, div));
  controls.appendChild(select);

  const detail = document.createElement("div");
  detail.className = "result-detail";
  detail.textContent = getCommuteDetail(item);
  controls.appendChild(detail);

  div.appendChild(controls);

  if (item.mapsUrl) {
    const link = document.createElement("a");
    link.href = item.mapsUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open route";
    div.appendChild(link);
  }

  elements.resultsList.appendChild(div);
}

function appendEditableSkippedResult(item) {
  const div = document.createElement("div");
  div.className = "result-item error-item";
  div.dataset.tripId = item.tripId;

  const header = document.createElement("div");
  header.className = "result-event";
  header.textContent = item.label;

  const badge = document.createElement("span");
  badge.className = "badge badge-issue";
  badge.textContent = getBadgeForSkip(item.reason || "");

  const topRow = document.createElement("div");
  topRow.className = "result-top-row";
  topRow.appendChild(header);
  topRow.appendChild(badge);
  div.appendChild(topRow);

  const controls = document.createElement("div");
  controls.className = "result-controls";

  const select = document.createElement("select");
  select.className = "mode-select";
  select.setAttribute("aria-label", `Try another travel mode for ${item.label}`);

  for (const option of getTravelModeOptions()) {
    const optionEl = document.createElement("option");
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    optionEl.selected = option.value === item.travelMode;
    select.appendChild(optionEl);
  }

  select.addEventListener("change", () => updateCommuteMode(item.tripId, select.value, div));
  controls.appendChild(select);

  const detail = document.createElement("div");
  detail.className = "result-detail";
  detail.textContent = `${getSkippedDetail(item, item.reason)} Try choosing another mode.`;
  controls.appendChild(detail);

  div.appendChild(controls);

  if (item.mapsUrl) {
    const link = document.createElement("a");
    link.href = item.mapsUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open route";
    div.appendChild(link);
  }

  elements.resultsList.appendChild(div);
}

function appendTimelineNotice(item) {
  const notice = item.data;
  const reason = notice.reason || String(notice);
  const badge = item.kind === "error" ? "Issue" : getBadgeForSkip(reason);
  const className = badge === "Overlap" || badge === "Issue" ? "error-item" : "skipped";
  appendResult(
    className,
    notice.label || (item.kind === "error" ? "Needs attention" : "Skipped"),
    getSkippedDetail(notice, reason),
    notice.mapsUrl || "",
    badge
  );
}

async function updateCommuteMode(tripId, travelMode, rowEl) {
  const commute =
    currentResults?.planned?.find((item) => item.tripId === tripId) ||
    currentResults?.skipped?.find((item) => item.tripId === tripId);
  if (!commute) return;

  const select = rowEl.querySelector(".mode-select");
  const detail = rowEl.querySelector(".result-detail");
  const originalText = detail.textContent;

  rowEl.classList.add("is-loading");
  select.disabled = true;
  detail.textContent = "Recalculating...";

  try {
    const result = await sendMessage({
      action: "recalculateCommuteMode",
      commute,
      travelMode,
    });

    if (result.commute) {
      applyRecalculatedCommute(tripId, result);
      renderResults(currentResults);
      setStatus(result.status === "skipped" ? "" : "Commute updated.", "success");
      return;
    }

    if (result.error) {
      detail.textContent = formatFriendlyError(result.error);
      rowEl.classList.add("has-error");
      select.value = commute.travelMode;
      return;
    }
  } catch (error) {
    detail.textContent = formatFriendlyError(error.message || originalText);
    rowEl.classList.add("has-error");
  } finally {
    rowEl.classList.remove("is-loading");
    select.disabled = false;
  }
}

function applyRecalculatedCommute(tripId, result) {
  currentResults.planned = currentResults.planned || [];
  currentResults.skipped = currentResults.skipped || [];

  if (result.status === "skipped") {
    currentResults.planned = currentResults.planned.filter((item) => item.tripId !== tripId);
    upsertByTripId(currentResults.skipped, result.commute);
    return;
  }

  currentResults.skipped = currentResults.skipped.filter((item) => item.tripId !== tripId);
  upsertByTripId(currentResults.planned, result.commute);
}

function upsertByTripId(items, nextItem) {
  const index = items.findIndex((item) => item.tripId === nextItem.tripId);
  if (index >= 0) {
    items[index] = nextItem;
  } else {
    items.push(nextItem);
  }
}

function clearResults() {
  currentResults = null;
  elements.resultsList.innerHTML = "";
  elements.resultsSection.classList.add("hidden");
  elements.resultsMeta.textContent = "";
  elements.addBtn.disabled = true;
}

function getCommuteDetail(item) {
  return `${formatTime(item.start)}-${formatTime(item.end)} | ${item.compactSummary || item.summary} | ${item.durationText}`;
}

function getSkippedDetail(item, reason) {
  const parts = [];
  const friendlyReason = formatFriendlyError(reason);
  const timeRange = item.start && item.end ? `${formatTime(item.start)}-${formatTime(item.end)}` : "";
  const routeSummary = item.compactSummary || item.summary;

  if (timeRange) parts.push(timeRange);
  if (routeSummary) parts.push(routeSummary);
  if (item.durationText) parts.push(item.durationText);
  parts.push(friendlyReason);

  return parts.join(" | ");
}

function isEditableSkippedItem(item) {
  return Boolean(
    item?.tripId &&
      item.origin &&
      item.destination &&
      item.reason?.includes("Commute overlaps")
  );
}

function getTravelModeOptions() {
  return [
    { value: "TRANSIT", label: "Transit" },
    { value: "WALK", label: "Walking" },
    { value: "DRIVE", label: "Driving" },
    { value: "BICYCLE", label: "Biking" },
  ];
}

function appendResult(className, title, detail, href = "", badgeText = "") {
  const div = document.createElement("div");
  div.className = `result-item ${className}`;

  const titleEl = document.createElement("div");
  titleEl.className = "result-event";
  titleEl.textContent = title;

  if (badgeText) {
    const badge = document.createElement("span");
    badge.className = `badge ${getBadgeClass(badgeText)}`;
    badge.textContent = badgeText;

    const topRow = document.createElement("div");
    topRow.className = "result-top-row";
    topRow.appendChild(titleEl);
    topRow.appendChild(badge);
    div.appendChild(topRow);
  } else {
    div.appendChild(titleEl);
  }

  if (detail) {
    const detailEl = document.createElement("div");
    detailEl.className = "result-detail";
    detailEl.textContent = detail;
    div.appendChild(detailEl);
  }

  if (href) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open route";
    div.appendChild(link);
  }

  elements.resultsList.appendChild(div);
}

async function runAction(button, busyText, callback) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = busyText;

  try {
    await callback();
  } catch (error) {
    setStatus(formatFriendlyError(error.message), "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function buildStatus(results, fallback) {
  if (results.errors?.length) return formatErrorList(results.errors);
  return fallback;
}

function setStatus(text, type = "") {
  elements.status.textContent = text;
  elements.status.className = `status-text ${type}`;
}

function formatErrorList(errors) {
  return errors.map(formatFriendlyError).join(" ");
}

function formatFriendlyError(error) {
  const message = typeof error === "string" ? error : error?.message || String(error);

  if (message.includes("Missing Google Maps API key")) {
    return "Routes are not configured yet. Add the Google Routes API key in developer setup.";
  }

  if (message.includes("Authorization") || message.includes("OAuth") || message.includes("401")) {
    return "Google Calendar needs authorization. Reload the extension and sign in again.";
  }

  if (message.includes("Calendar API error")) {
    return "Google Calendar could not be updated. Try refreshing again.";
  }

  if (message.includes("Routes API error")) {
    return "Google Maps could not calculate this route. Try another travel mode.";
  }

  if (message.includes("Commute overlaps")) {
    return "This commute overlaps the previous event.";
  }

  return message;
}

function getBadgeForSkip(reason) {
  if (reason.includes("overlaps")) return "Overlap";
  if (reason.includes("ended")) return "Past";
  return "Skipped";
}

function getBadgeClass(badgeText) {
  const normalized = badgeText.toLowerCase();
  if (normalized === "added" || normalized === "ready") return "badge-ready";
  if (normalized === "overlap" || normalized === "issue") return "badge-issue";
  return "badge-muted";
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}
