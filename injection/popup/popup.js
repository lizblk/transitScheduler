const elements = {
  enabled: document.getElementById("enabled"),
  homeAddress: document.getElementById("home-address"),
  travelMode: document.getElementById("travel-mode"),
  planningWindow: document.getElementById("planning-window"),
  includeHomeCommutes: document.getElementById("include-home-commutes"),
  useSeparateCalendar: document.getElementById("use-separate-calendar"),
  autoRefresh: document.getElementById("auto-refresh"),
  saveSettings: document.getElementById("save-settings"),
  previewBtn: document.getElementById("preview-btn"),
  addBtn: document.getElementById("add-btn"),
  removeBtn: document.getElementById("remove-btn"),
  status: document.getElementById("status"),
  resultsSection: document.getElementById("results-section"),
  resultsMeta: document.getElementById("results-meta"),
  resultsList: document.getElementById("results-list"),
};

let currentResults = null;

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await sendMessage({ action: "getSettings" });
  renderSettings(settings);

  const lastPreview = await sendMessage({ action: "getLastPreview" });
  if (lastPreview) renderResults(lastPreview);
});

elements.saveSettings.addEventListener("click", async () => {
  await saveSettings();
  setStatus("Settings saved.", "success");
});

elements.previewBtn.addEventListener("click", async () => {
  await saveSettings();
  await runAction(elements.previewBtn, "Previewing...", async () => {
    const results = await sendMessage({ action: "previewCommutes" });
    renderResults(results);
    setStatus(buildStatus(results, "Preview ready."), results.errors.length ? "error" : "success");
  });
});

elements.addBtn.addEventListener("click", async () => {
  await saveSettings();
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

elements.removeBtn.addEventListener("click", async () => {
  await runAction(elements.removeBtn, "Removing...", async () => {
    const results = await sendMessage({ action: "removeCommutesFromCalendar" });

    if (results.errors?.length) {
      setStatus(results.errors.join(" "), "error");
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
  elements.enabled.checked = settings.enabled;
  elements.homeAddress.value = settings.homeAddress || "";
  elements.travelMode.value = settings.travelMode || "TRANSIT";
  elements.planningWindow.value = settings.planningWindow || "NEXT_24_HOURS";
  elements.includeHomeCommutes.checked = settings.includeHomeCommutes;
  elements.useSeparateCalendar.checked = settings.useSeparateCalendar !== false;
  elements.autoRefresh.checked = settings.autoRefresh;
}

async function saveSettings() {
  const settings = {
    enabled: elements.enabled.checked,
    homeAddress: elements.homeAddress.value,
    travelMode: elements.travelMode.value,
    planningWindow: elements.planningWindow.value,
    includeHomeCommutes: elements.includeHomeCommutes.checked,
    useSeparateCalendar: elements.useSeparateCalendar.checked,
    autoRefresh: elements.autoRefresh.checked,
  };

  return sendMessage({
    action: "saveSettings",
    settings,
  });
}

function renderResults(results) {
  currentResults = results;
  currentResults.defaultTravelMode = currentResults.defaultTravelMode || elements.travelMode.value;
  elements.resultsList.innerHTML = "";
  elements.resultsSection.classList.remove("hidden");
  elements.resultsMeta.textContent = `${results.eventsConsidered || 0} events checked`;
  elements.addBtn.disabled = !results.planned?.length || Boolean(results.errors?.length);

  if (!results.planned?.length && !results.skipped?.length && !results.errors?.length) {
    appendResult("empty", "No commute blocks found", "Add locations to upcoming events and preview again.");
    return;
  }

  for (const item of results.planned || []) {
    appendPlannedResult(item);
  }

  for (const item of results.skipped || []) {
    appendResult("skipped", item.label || "Skipped", item.reason || String(item));
  }

  for (const item of results.errors || []) {
    appendResult("error-item", "Error", typeof item === "string" ? item : item.message);
  }
}

function appendPlannedResult(item) {
  const div = document.createElement("div");
  div.className = "result-item planned";
  div.dataset.tripId = item.tripId;

  const header = document.createElement("div");
  header.className = "result-event";
  header.textContent = item.label;
  div.appendChild(header);

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

async function updateCommuteMode(tripId, travelMode, rowEl) {
  const commute = currentResults?.planned?.find((item) => item.tripId === tripId);
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

    if (result.error) {
      detail.textContent = result.error;
      rowEl.classList.add("has-error");
      select.value = commute.travelMode;
      return;
    }

    const index = currentResults.planned.findIndex((item) => item.tripId === tripId);
    currentResults.planned[index] = result.commute;
    renderResults(currentResults);
    setStatus("Commute updated.", "success");
  } catch (error) {
    detail.textContent = error.message || originalText;
    rowEl.classList.add("has-error");
  } finally {
    rowEl.classList.remove("is-loading");
    select.disabled = false;
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

function getTravelModeOptions() {
  return [
    { value: "TRANSIT", label: "Transit" },
    { value: "WALK", label: "Walking" },
    { value: "DRIVE", label: "Driving" },
    { value: "BICYCLE", label: "Biking" },
  ];
}

function appendResult(className, title, detail, href = "") {
  const div = document.createElement("div");
  div.className = `result-item ${className}`;

  const titleEl = document.createElement("div");
  titleEl.className = "result-event";
  titleEl.textContent = title;
  div.appendChild(titleEl);

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
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function buildStatus(results, fallback) {
  if (results.errors?.length) return results.errors.join(" ");
  return fallback;
}

function setStatus(text, type = "") {
  elements.status.textContent = text;
  elements.status.className = `status-text ${type}`;
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
