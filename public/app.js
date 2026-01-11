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

  // Hide groom icons by default; JS turns them on when groomed.
  style.textContent = `
    .run-unknown { opacity: 0.65 !important; }
    [id^="grm-"] { display: none; }
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

  // Hide all groom markers each refresh; we re-enable groomed ones after.
  svgDoc.querySelectorAll('[id^="grm-"]').forEach(el => {
    el.style.display = "none";
  });
}

function rememberOriginal(target) {
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
  if (target.dataset.origStroke && target.dataset.origStroke !== "null") {
    target.style.stroke = target.dataset.origStroke;
  } else {
    target.style.removeProperty("stroke");
  }

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

  const safe = (status === "open" || status === "closed") ? status : "unknown";
  target.classList.remove("run-open", "run-closed", "run-unknown");
  target.classList.add(`run-${safe}`);

  if (safe === "closed") {
    // CLOSED = RED
    target.style.stroke = "red";
    target.style.opacity = "1";
    target.style.strokeOpacity = "1";

    // Only set fill red if it was filled originally (some objects are shapes)
    const origFill = (target.dataset.origFill || "").toLowerCase();
    const hasFill = target.hasAttribute("fill") || target.style.fill;
    if (hasFill && origFill && origFill !== "none") {
      target.style.fill = "red";
    }
  } else if (safe === "open") {
    // OPEN = restore original styling (do not force anything)
    restoreOriginal(target);
  } else {
    // UNKNOWN = restore then dim slightly
    restoreOriginal(target);
    target.style.opacity = "0.65";
  }

  return true;
}

function setGroomMarker(svgDoc, runId, groomed) {
  // Your SVG marker IDs should be like: grm-valley-of-10
  const marker = svgDoc.getElementById(`grm-${runId}`);
  if (!marker) return;
  marker.style.display = groomed ? "inline" : "none";
}

async function reloadSvgObject(obj, statusEl) {
  const base = "/norquay-map.svg";
  const url = `${base}?v=${Date.now()}`;

  statusEl.textContent = "Reloading SVG…";
  obj.setAttribute("data", url);

  const svgDoc = await withTimeout(
    new Promise(resolve => obj.addEventListener("load", () => resolve(obj.contentDocument), { once: true })),
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

    const svgDoc = await reloadSvgObject(obj, statusEl);
    ensureSvgStyles(svgDoc);

    statusEl.textContent = "Fetching run status…";
    const live = await loadJSON("/.netlify/functions/norquay-runs", 20000);

    const runMapRaw = await loadJSON("/runMap.json", 8000).catch(() => ({}));
    const runMap = {};
    for (const [k, v] of Object.entries(runMapRaw || {})) {
      runMap[norm(k)] = (v ?? "").toString().trim();
    }

    clearPrevious(svgDoc);

    let applied = 0;
    let notFound = 0;

    for (const [runName, data] of Object.entries(live.runs || {})) {
      const status = data?.status;
      const groomed = !!data?.groomed;

      const key = norm(runName);
      const mapped = runMap[key];

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

      if (!el) { notFound++; continue; }

      if (applyState(el, status)) applied++;
      else notFound++;

      if (usedId) setGroomMarker(svgDoc, usedId, groomed);
    }

    statusEl.textContent =
      `Updated: ${new Date(live.updatedAt).toLocaleString()} — Applied: ${applied} — Not found: ${notFound}`;

  } catch (err) {
    statusEl.textContent = `ERROR: ${err.message || err}`;
  }
}

refresh();

// Refresh every 10 minutes
setInterval(refresh, 10 * 60 * 1000);

// --- CONDITIONS OVERLAY INJECTOR (for <object data="...svg">) ---

const CONDITIONS_URL = "/.netlify/functions/conditions";

function svgEl(doc, name) {
  return doc.createElementNS("http://www.w3.org/2000/svg", name);
}

function injectOverlay(svgDoc) {
  const svg = svgDoc.querySelector("svg");
  if (!svg || svgDoc.getElementById("conditionsOverlay")) return;

  const g = svgEl(svgDoc, "g");
  g.setAttribute("id", "conditionsOverlay");
  g.setAttribute("transform", "translate(520,40)");

  const bg = svgEl(svgDoc, "rect");
  bg.setAttribute("width", "900");
  bg.setAttribute("height", "140");
  bg.setAttribute("rx", "18");
  bg.setAttribute("fill", "rgba(255,255,255,0.78)");
  bg.setAttribute("stroke", "rgba(0,0,0,0.2)");
  bg.setAttribute("stroke-width", "2");
  g.appendChild(bg);

  const temp = svgEl(svgDoc, "text");
  temp.setAttribute("id", "cTemp");
  temp.setAttribute("x", "24");
  temp.setAttribute("y", "90");
  temp.setAttribute("font-size", "60");
  temp.setAttribute("font-weight", "700");
  temp.textContent = "--°C";
  g.appendChild(temp);

  const note = svgEl(svgDoc, "text");
  note.setAttribute("id", "cNote");
  note.setAttribute("x", "160");
  note.setAttribute("y", "90");
  note.setAttribute("font-size", "18");
  note.setAttribute("fill", "#333");
  note.textContent = "Loading conditions…";
  g.appendChild(note);

  const updated = svgEl(svgDoc, "text");
  updated.setAttribute("id", "cUpdated");
  updated.setAttribute("x", "24");
  updated.setAttribute("y", "125");
  updated.setAttribute("font-size", "11");
  updated.setAttribute("fill", "#666");
  g.appendChild(updated);

  svg.appendChild(g);
}

async function updateOverlay(svgDoc) {
  try {
    const res = await fetch(`${CONDITIONS_URL}?t=${Date.now()}`);
    const d = await res.json();

    svgDoc.getElementById("cTemp").textContent = `${d.tempC ?? "--"}°C`;
    svgDoc.getElementById("cNote").textContent = d.note ?? "";
    svgDoc.getElementById("cUpdated").textContent =
      "Updated: " + new Date(d.updated).toLocaleString();

  } catch {
    svgDoc.getElementById("cNote").textContent = "Unable to load conditions";
  }
}

const map = document.getElementById("map");

map.addEventListener("load", () => {
  const svgDoc = map.contentDocument;
  injectOverlay(svgDoc);
  updateOverlay(svgDoc);
  setInterval(() => updateOverlay(svgDoc), 10 * 60 * 1000);
});

