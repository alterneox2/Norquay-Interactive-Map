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
  if (!svg) return;

  // Don't inject twice
  if (svgDoc.getElementById("conditionsOverlay")) return;

  const g = svgEl(svgDoc, "g");
  g.setAttribute("id", "conditionsOverlay");
  // Move this if you want it higher/lower/left/right
  g.setAttribute("transform", "translate(520,30)");

  // Background panel (bigger now to fit tiles)
  const bg = svgEl(svgDoc, "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", "1120");
  bg.setAttribute("height", "190");
  bg.setAttribute("rx", "18");
  bg.setAttribute("fill", "rgba(255,255,255,0.78)");
  bg.setAttribute("stroke", "rgba(0,0,0,0.20)");
  bg.setAttribute("stroke-width", "2");
  g.appendChild(bg);

  // Temp (big)
  const temp = svgEl(svgDoc, "text");
  temp.setAttribute("id", "cTemp");
  temp.setAttribute("x", "24");
  temp.setAttribute("y", "78");
  temp.setAttribute("font-size", "64");
  temp.setAttribute("font-weight", "700");
  temp.setAttribute("font-family", "system-ui, Segoe UI, Arial");
  temp.textContent = "--°C";
  g.appendChild(temp);

  // Weather note label
  const noteLabel = svgEl(svgDoc, "text");
  noteLabel.setAttribute("x", "150");
  noteLabel.setAttribute("y", "40");
  noteLabel.setAttribute("font-size", "14");
  noteLabel.setAttribute("font-weight", "700");
  noteLabel.setAttribute("font-family", "system-ui, Segoe UI, Arial");
  noteLabel.setAttribute("fill", "rgba(0,0,0,0.65)");
  noteLabel.textContent = "Weather Note";
  g.appendChild(noteLabel);

  // Weather note wrapped (foreignObject)
  const noteFO = svgEl(svgDoc, "foreignObject");
  noteFO.setAttribute("x", "150");
  noteFO.setAttribute("y", "46");
  noteFO.setAttribute("width", "420");
  noteFO.setAttribute("height", "70");

  const noteDiv = svgDoc.createElement("div");
  noteDiv.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  noteDiv.setAttribute(
    "style",
    "font: 14px system-ui, Segoe UI, Arial; color: rgba(0,0,0,0.78); line-height: 1.25; max-height:70px; overflow:hidden;"
  );
  noteDiv.id = "cNote";
  noteDiv.textContent = "Loading…";

  noteFO.appendChild(noteDiv);
  g.appendChild(noteFO);

  // Divider line
  const div1 = svgEl(svgDoc, "line");
  div1.setAttribute("x1", "560");
  div1.setAttribute("y1", "20");
  div1.setAttribute("x2", "560");
  div1.setAttribute("y2", "160");
  div1.setAttribute("stroke", "rgba(0,0,0,0.15)");
  div1.setAttribute("stroke-width", "2");
  g.appendChild(div1);

  // --- NEW SNOW section ---
  const nsTitle = svgEl(svgDoc, "text");
  nsTitle.setAttribute("x", "580");
  nsTitle.setAttribute("y", "40");
  nsTitle.setAttribute("font-size", "14");
  nsTitle.setAttribute("font-weight", "700");
  nsTitle.setAttribute("font-family", "system-ui, Segoe UI, Arial");
  nsTitle.setAttribute("fill", "rgba(0,0,0,0.65)");
  nsTitle.textContent = "New Snow";
  g.appendChild(nsTitle);

  // Tile helper
  function addTile(x, y, w, h, valueId, labelText) {
    const r = svgEl(svgDoc, "rect");
    r.setAttribute("x", String(x));
    r.setAttribute("y", String(y));
    r.setAttribute("width", String(w));
    r.setAttribute("height", String(h));
    r.setAttribute("rx", "12");
    r.setAttribute("fill", "rgba(255,255,255,0.85)");
    r.setAttribute("stroke", "rgba(0,0,0,0.15)");
    r.setAttribute("stroke-width", "2");
    g.appendChild(r);

    const v = svgEl(svgDoc, "text");
    v.setAttribute("id", valueId);
    v.setAttribute("x", String(x + w / 2));
    v.setAttribute("y", String(y + 32));
    v.setAttribute("text-anchor", "middle");
    v.setAttribute("font-size", "22");
    v.setAttribute("font-weight", "700");
    v.setAttribute("font-family", "system-ui, Segoe UI, Arial");
    v.textContent = "--";
    g.appendChild(v);

    const l = svgEl(svgDoc, "text");
    l.setAttribute("x", String(x + w / 2));
    l.setAttribute("y", String(y + 54));
    l.setAttribute("text-anchor", "middle");
    l.setAttribute("font-size", "11");
    l.setAttribute("font-family", "system-ui, Segoe UI, Arial");
    l.setAttribute("fill", "rgba(0,0,0,0.65)");
    l.textContent = labelText;
    g.appendChild(l);
  }

  addTile(580, 52, 90, 62, "nsOvernight", "Overnight");
  addTile(682, 52, 90, 62, "ns24", "Last 24h");
  addTile(784, 52, 90, 62, "ns7", "Last 7d");

  // --- SNOW BASE section ---
  const sbTitle = svgEl(svgDoc, "text");
  sbTitle.setAttribute("x", "580");
  sbTitle.setAttribute("y", "135");
  sbTitle.setAttribute("font-size", "14");
  sbTitle.setAttribute("font-weight", "700");
  sbTitle.setAttribute("font-family", "system-ui, Segoe UI, Arial");
  sbTitle.setAttribute("fill", "rgba(0,0,0,0.65)");
  sbTitle.textContent = "Snow Base";
  g.appendChild(sbTitle);

  addTile(580, 146, 90, 62, "sbLower", "Lower");
  addTile(682, 146, 90, 62, "sbUpper", "Upper");
  addTile(784, 146, 90, 62, "sbYtd", "YTD Snow");

  // Updated
  const updated = svgEl(svgDoc, "text");
  updated.setAttribute("id", "cUpdated");
  updated.setAttribute("x", "24");
  updated.setAttribute("y", "165");
  updated.setAttribute("font-size", "11");
  updated.setAttribute("font-family", "system-ui, Segoe UI, Arial");
  updated.setAttribute("fill", "rgba(0,0,0,0.55)");
  updated.textContent = "Updated: --";
  g.appendChild(updated);

  // Add overlay LAST so it sits above everything
  svg.appendChild(g);
}

function fmtCm(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "--";
  return `${Number(n)}cm`;
}

async function updateOverlay(svgDoc) {
  try {
    const res = await fetch(`${CONDITIONS_URL}?t=${Date.now()}`, { cache: "no-store" });
    const d = await res.json();

    // Temp + Note
    const tempC = d.tempC ?? null;
    svgDoc.getElementById("cTemp").textContent = tempC === null ? "--°C" : `${tempC}°C`;
    svgDoc.getElementById("cNote").textContent = d.note ?? "";

    // New Snow
    svgDoc.getElementById("nsOvernight").textContent = fmtCm(d.newSnow?.overnightCm);
    svgDoc.getElementById("ns24").textContent = fmtCm(d.newSnow?.last24Cm);
    svgDoc.getElementById("ns7").textContent = fmtCm(d.newSnow?.last7DaysCm);

    // Snow Base
    svgDoc.getElementById("sbLower").textContent = fmtCm(d.snowBase?.lowerCm);
    svgDoc.getElementById("sbUpper").textContent = fmtCm(d.snowBase?.upperCm);
    svgDoc.getElementById("sbYtd").textContent = fmtCm(d.snowBase?.ytdSnowfallCm);

    // Updated
    const when = d.updated ? new Date(d.updated) : null;
    svgDoc.getElementById("cUpdated").textContent =
      `Updated: ${when ? when.toLocaleString() : "--"}`;

  } catch (e) {
    // Only change note on failure, keep old values
    const noteEl = svgDoc.getElementById("cNote");
    if (noteEl) noteEl.textContent = "Unable to load conditions";
  }
}

// Wire it up to the <object id="map">
const map = document.getElementById("map");
map.addEventListener("load", () => {
  const svgDoc = map.contentDocument;
  if (!svgDoc) return;

  injectOverlay(svgDoc);
  updateOverlay(svgDoc);
  setInterval(() => updateOverlay(svgDoc), 10 * 60 * 1000);
});


