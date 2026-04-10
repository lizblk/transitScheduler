// ============================================================
// NYC Transit Scheduler — Popup Script
// ============================================================

const elements = {
  homeAddress: document.getElementById("home-address"),
  saveAddress: document.getElementById("save-address"),
  addressStatus: document.getElementById("address-status"),
  runBtn: document.getElementById("run-btn"),
  lastRun: document.getElementById("last-run"),
  resultsSection: document.getElementById("results-section"),
  resultsList: document.getElementById("results-list"),
};

// --------------- INIT ---------------

document.addEventListener("DOMContentLoaded", async () => {
  // Load saved home address
  const { homeAddress } = await chrome.storage.sync.get("homeAddress");
  if (homeAddress) {
    elements.homeAddress.value = homeAddress;
    setStatus(elements.addressStatus, "Saved ✓", "success");
  }

  // Load last run results
  const { lastRunResults } = await chrome.storage.local.get("lastRunResults");
  if (lastRunResults) {
    displayResults(lastRunResults);
    elements.lastRun.textContent = `Last run: ${formatTimestamp(lastRunResults.timestamp)}`;
  }
});

// --------------- SAVE ADDRESS ---------------

elements.saveAddress.addEventListener("click", async () => {
  const address = elements.homeAddress.value.trim();
  if (!address) {
    setStatus(elements.addressStatus, "Please enter an address.", "error");
    return;
  }

  await chrome.storage.sync.set({ homeAddress: address });
  setStatus(elements.addressStatus, "Saved ✓", "success");
});

// --------------- RUN PIPELINE ---------------

elements.runBtn.addEventListener("click", async () => {
  elements.runBtn.disabled = true;
  elements.runBtn.textContent = "Checking…";
  elements.lastRun.textContent = "";
  elements.resultsSection.classList.add("hidden");

  try {
    const results = await chrome.runtime.sendMessage({ action: "runPipeline" });
    displayResults(results);
    elements.lastRun.textContent = `Last run: ${formatTimestamp(results.timestamp)}`;
  } catch (err) {
    setStatus(elements.lastRun, `Error: ${err.message}`, "error");
  } finally {
    elements.runBtn.disabled = false;
    elements.runBtn.textContent = "Check Calendar & Calculate Routes";
  }
});

// --------------- DISPLAY RESULTS ---------------

function displayResults(results) {
  if (!results) return;

  elements.resultsList.innerHTML = "";

  const hasContent =
    results.processed.length > 0 ||
    results.skipped.length > 0 ||
    results.errors.length > 0;

  if (!hasContent) {
    elements.resultsList.innerHTML =
      '<div class="result-item skipped">No upcoming events to process.</div>';
    elements.resultsSection.classList.remove("hidden");
    return;
  }

  // Processed events
  for (const item of results.processed) {
    const departureStr = new Date(item.departureTime).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    appendResult("processed", item.event, `Leave by ${departureStr} (${item.travelTime})`);
  }

  // Skipped events
  for (const item of results.skipped) {
    if (typeof item === "string") {
      appendResult("skipped", item, null);
    } else {
      appendResult("skipped", item.event, item.reason);
    }
  }

  // Errors
  for (const item of results.errors) {
    if (typeof item === "string") {
      appendResult("error-item", "Error", item);
    } else {
      appendResult("error-item", item.event, item.error);
    }
  }

  elements.resultsSection.classList.remove("hidden");
}

function appendResult(className, title, detail) {
  const div = document.createElement("div");
  div.className = `result-item ${className}`;
  div.innerHTML = `
    <div class="result-event">${escapeHtml(title)}</div>
    ${detail ? `<div class="result-detail">${escapeHtml(detail)}</div>` : ""}
  `;
  elements.resultsList.appendChild(div);
}

// --------------- UTILITIES ---------------

function setStatus(el, text, type = "") {
  el.textContent = text;
  el.className = `status-text ${type}`;
}

function formatTimestamp(isoString) {
  return new Date(isoString).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
