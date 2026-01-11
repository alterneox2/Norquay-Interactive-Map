function norm(s) {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\u00a0/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function idify(name) {
  return norm(name).replace(/\s+/g, "-");
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); }
    );
  });
}

async function loadJSON(path, ms = 15000) {
  const r = await withTimeout(fetch(path, { cache: "no-store" }), ms, `Fetch ${path}`);
  if (!r.ok) throw new Error(`${path} returned ${r.status}`);
  return r.json();
}

function ensureSvgStyles(svgDoc) {
  if (svgDoc.getElementById("run-status-styles")) return;

  const style = svgDoc.createElementNS("http://www.w3.org/2000/svg", "style");
  style.setAttribute("id", "run-status-styles");

  // NOTE: We DO NOT set opacity for closed anymore.
  // Closed = red stroke. Open = original. Unknown = slightly dim.
  // Groom icons default hidden (you can create elements like id="groom-valley-of-10")
  style.textContent = `
    .run-open {}
    .run-closed {}
    .run-unknown { opacity: 0.65 !important; }

    [id^="groom-"] { display: none; }
  `;

  (svgDoc.documentElement || svgDoc.querySelector("svg")).appendChild(style);
}

function getDrawableTarget(el) {
  if (!el) return null;
  const drawable = "path, polygon, polyline, rect, circle, ellipse, line";
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "g") return el.querySelector(drawable) || el;
  return el.querySelector?.(drawable) || el;
}

function clearPrevious(svgDoc) {
  svgDoc.querySelectorAll(".run-open, .run-closed, .run-unknown").forEach(el => {
    el.classList.remove("run-open", "run-closed", "run-unknown");
  });

  // Do NOT wipe styles globally; we only touch styles on elements we modify.
  // Also hide all groom markers each refresh:
  svgDoc.querySelectorAll('[id^="groom-"]').forEach(el => {
    el.style.display = "none";
  });
}

function rememberOriginal(target) {
  // preserve original inline style only once
  if (target.dataset.origStroke === undefined) {
    const attrStroke = target.getAttribute("stroke");
    const inlineStroke = target.style.stroke;
    target.dataset.origStroke = attrStroke ?? inlineStroke ?? "";
  }
  if (target.dataset.origFill === undefined) {
    const attrFill = target.getAttribute("fill");
    const inlineFill = target.style.fill;
    target.dataset.origFill = attrFill ?? inlineFill ?? "";
  }
}

function restoreOriginal(target) {
  // Stroke
  if (target.dataset.origStroke && target.dataset.origStroke !== "null") {
    target.style.stroke = target.dataset.origStroke;
  } else {
    target.style.removeProperty("stroke");
  }

  // Fill: only restore if we previously changed it
  if (target.dataset.origFill && target.dataset.origFill !== "null") {
    target.style.fill = target.dataset.origFill;
  } else {
    target.style.removeProperty("fill");
  }

  target.style.removeProperty("opacity");
  target.style.removeProperty("stroke-opacity");
  target.style.removeProperty("fill-opacity");
}

function applyState(el, status) {
  const target = getDrawableTarget(el);
  if (!target) return false;

  rememberOriginal(target);

  // Normalize status
  const safe = (status === "open" || status === "closed") ? status : "unknown";

  target.classList.remove("run-open", "run-closed", "run-unknown");
  target.classList.add(`run-${safe}`);

  if (safe === "closed") {
    // CLOSED: red stroke, keep visible
    target.style.stroke = "red";

    // Only force fill red if the element is normally filled (not "none")
    // Many ski lines are strokes only; forcing fill can hide things.
    const origFill = (target.dataset.origFill || "").toLowerCase();
    const hasFillAttr = target.hasAttribute("fill") || target.style.fill;
    if (hasFillAttr && origFill && origFill !== "none") {
      target.style.fill = "red";
    }

    // Ensure full visibility
    target.style.opacity = "1";
    target.style.strokeOpacity = "1";
  } else if (safe === "open") {
    // OPEN: restore original stroke/fill
    restoreOriginal(target);
  } else {
    // UNKNOWN: slightly dim, but keep original colors
    restoreOriginal(target);
    target.style.opacity = "0.65";
  }

  return true;
}

function setGroomMarker(svgDoc, runId, groomed) {
  // Your SVG marker IDs should be like: groom-valley-of-10
  const marker = svgDoc.getElementById(`groom-${runId}`);
  if (!marker) return;
  marker.style.display = groomed ? "inline" : "none";
}

// Force the <object> to reload the SVG each time (beats caching)
async function reloadSvgObject(obj, statusEl) {
  const base = "/norquay-map.svg";
  const bust = `?v=${Date.now()}`;
  const url = base + bust;

  statusEl.textContent = "Reloading SVG…";
  obj.setAttribute("data", url);

  const svgDoc = await withTimeout(
    new Promise(resolve =>
      obj.addEventListener("load", () => resolve(obj.contentDocument), { once: true })
    ),
    12000,
    "SVG load"
  );

  if (!svgDoc) throw new Error("SVG loaded but contentDocument is null.");
  return svgDoc;
}

async function refresh() {
  const statusEl = document.getElementById("status");
  const obj = document.getElementById("map");

  try {
    statusEl.textContent = "Starting…";

    // Always reload SVG on refresh so we apply to a known, fresh DOM
    const svgDoc = await reloadSvgObject(obj, statusEl);
    ensureSvgStyles(svgDoc);

    statusEl.textContent = "Fetching run status…";
    const live = await loadJSON("/.netlify/functions/norquay-runs", 20000);

    // Optional mapping overrides: {"Norquay Gully":"norquay-gully"} etc.
    const runMapRaw = await loadJSON("/runMap.json", 8000).catch(() => ({}));
    const runMap = {};
    for (const [k, v] of Object.entries(runMapRaw || {})) {
      runMap[norm(k)] = (v ?? "").toString().trim();
    }

    clearPrevious(svgDoc);

    let applied = 0;
    let notFound = 0;

    for (const [runName, data] of Object.entries(live.runs || {})) {
      // data is now: { status: "open"|"closed", groomed: boolean }
      const status = data?.status;
      const groomed = !!data?.groomed;

      const key = norm(runName);
      const mapped = runMap[key];

      // Candidate IDs to try
      const candidates = [
        mapped || null,
        mapped ? idify(mapped) : null,
        idify(runName),
        key.replace(/\s+/g, "-"),
        key.replace(/\s+/g, "_")
      ].filter(Boolean);

      let el = null;
      let usedId = null;

      for (const c of candidates) {
        const found = svgDoc.getElementById(c);
        if (found) { el = found; usedId = c; break; }
      }

      if (!el) {
        notFound++;
        continue;
      }

      // Apply open/closed coloring
      if (applyState(el, status)) applied++;
      else notFound++;

      // Toggle groom marker (if you created one in SVG)
      if (usedId) setGroomMarker(svgDoc, usedId, groomed);
    }

    // Example debug run:
    const wiegeles = live.runs?.["Wiegele's"];
    const wiegelesStatus = typeof wiegeles === "object" ? wiegeles.status : wiegeles;

    statusEl.textContent =
      `Updated: ${new Date(live.updatedAt).toLocaleString()} — Applied: ${applied} — Not found: ${notFound} — Wiegele's: ${wiegelesStatus ?? "missing"}`;

  } catch (err) {
    statusEl.textContent = `ERROR: ${err.message || err}`;
  }
}

// Run once on page load
refresh();

// Refresh every 10 minutes
setInterval(refresh, 10 * 60 * 1000);
