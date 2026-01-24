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

	/* --- LIFT RUNNING ANIMATION (low bandwidth, CSS-only) --- */
	@keyframes liftDotsMove { to { stroke-dashoffset: -18; } }

	/* When running: show a dashed stroke that "moves" */
	.lift-running {
		fill: none !important;
		stroke: rgba(16,185,129,0.95) !important;
		stroke-width: 6 !important;
		stroke-linecap: round !important;
		stroke-dasharray: 1 16 !important;   /* dot + gap */
		stroke-dashoffset: 0;
		animation: liftDotsMove 1.1s linear infinite;
	}

	/* When stopped: solid red stroke, no animation */
	.lift-stopped {
		fill: none !important;
		stroke: rgba(239,68,68,0.95) !important;
		stroke-width: 6 !important;
		stroke-linecap: round !important;
		stroke-dasharray: none !important;
		animation: none !important;
	}

	/* Respect reduced-motion on phones */
	@media (prefers-reduced-motion: reduce) {
		.lift-running { animation: none !important; stroke-dasharray: none !important; }
	}
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
// ---------------- LIFT BADGES (A–G) ----------------
// These IDs are from your norquay-map.svg (red ellipse behind each letter).
const LIFT_BADGE_ELLIPSE_ID_BY_LETTER = {
  A: "north-american-liftletter",
  B: "cascade-liftletter",
  C: "spirit-liftletter",
  D: "mystic-liftletter",
  E: "sundance-liftletter",
  F: "rundle-liftletter",
  G: "tube-park-liftletter"
};

// Map lift names (from the conditions page) -> letter
const LIFT_NAME_TO_LETTER = {
  "north american chair": "A",
  "cascade lift": "B",
  "spirit chair": "C",
  "mystic chair": "D",
  "sundance carpet": "E",
  "rundle conveyor": "F",
  "tube park carpet": "G"
};

// Lift line PATH ids in norquay-map.svg
const LIFT_PATH_ID_BY_LETTER = {
  A: "north-american-lift",
  B: "cascade-lift",
  C: "spirit-lift",
  D: "mystic-lift",
  E: "sundance-lift",
  F: "rundle-lift",
  G: "tube-park-lift"
};

function setLiftPathRunning(svgDoc, letter, isOpen) {
  const pathId = LIFT_PATH_ID_BY_LETTER[letter];
  if (!pathId) return;

  const p = svgDoc.getElementById(pathId);
  if (!p) return;

  p.classList.toggle("lift-running", !!isOpen);
  p.classList.toggle("lift-stopped", !isOpen);
}

function setLiftBadge(svgDoc, letter, isOpen) {
  const ellipseId = LIFT_BADGE_ELLIPSE_ID_BY_LETTER[letter];
  if (!ellipseId) return;

  const ellipse = svgDoc.getElementById(ellipseId);
  if (!ellipse) return;

  // The letter itself is a path in the SVG with aria-label="A".."G"
  const letterPath = svgDoc.querySelector(`path[aria-label="${letter}"]`);

  const fill = isOpen ? "#10b981" : "#ef4444"; // green / red
  ellipse.style.fill = fill;
  ellipse.style.fillOpacity = "0.95";

  // Keep the white ring
  ellipse.style.stroke = "#ffffff";
  ellipse.style.strokeOpacity = "1";

  // Ensure letter stays readable
  if (letterPath) {
    letterPath.style.fill = "#ffffff";
    letterPath.style.fillOpacity = "1";
  }
}

function applyLiftBadgesFromConditions(svgDoc, cond) {
  const lifts = cond?.lifts;
  if (!lifts || typeof lifts !== "object") return;

  // Normalize keys once
  const normLifts = {};
  for (const [k, v] of Object.entries(lifts)) {
    normLifts[norm(k)] = v;
  }

  for (const [liftName, letter] of Object.entries(LIFT_NAME_TO_LETTER)) {
    const raw = normLifts[liftName];
    const s = (raw ?? "").toString().toLowerCase().trim();

    // Accept several backend formats:
    // "open"/"closed", true/false, {status:"open"}, etc.
    const isOpen =
      raw === true ||
      s === "open" ||
      s === "running" ||
      s === "1" ||
      s === "yes" ||
      (typeof raw === "object" && (raw.status === "open" || raw.open === true));

    setLiftBadge(svgDoc, letter, isOpen);
	
  }
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

// ---------------- CONDITIONS OVERLAY ----------------

const CONDITIONS_URL = "/.netlify/functions/conditions";

function svgEl(doc, name) {
  return doc.createElementNS("http://www.w3.org/2000/svg", name);
}

function fmtCm(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "--";
  return `${Number(n)}cm`;
}

function injectOverlay(svgDoc) {
  const svg = svgDoc.querySelector("svg");
  if (!svg) return;

  // Don't inject twice (within a single loaded SVG)
  if (svgDoc.getElementById("conditionsOverlay")) return;

  // Layout constants (edit these ONLY if you want to move/resize)
  const PANEL_W = 1020;
  const PANEL_H = 200;

  const LEFT_W = 560;          // left side: temp + note
  const PAD = 18;
  const DIV_X = LEFT_W + PAD;  // divider position

  const RIGHT_X = DIV_X + 18;  // right side tile area start
  const RIGHT_W = PANEL_W - RIGHT_X - PAD;

  const TILE_W = 84;
  const TILE_H = 56;
  const TILE_GAP = 12;

  const g = svgEl(svgDoc, "g");
  g.setAttribute("id", "conditionsOverlay");
  // Move overlay here (x,y)
  g.setAttribute("transform", "translate(510,30)");

  // Defs + clipPath so nothing ever draws outside the panel border
  const defs = svgEl(svgDoc, "defs");
  const clip = svgEl(svgDoc, "clipPath");
  clip.setAttribute("id", "conditionsClip");

  const clipRect = svgEl(svgDoc, "rect");
  clipRect.setAttribute("x", "0");
  clipRect.setAttribute("y", "0");
  clipRect.setAttribute("width", String(PANEL_W));
  clipRect.setAttribute("height", String(PANEL_H));
  clipRect.setAttribute("rx", "18");

  clip.appendChild(clipRect);
  defs.appendChild(clip);
  g.appendChild(defs);

  // Main panel border/background
  const bg = svgEl(svgDoc, "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(PANEL_W));
  bg.setAttribute("height", String(PANEL_H));
  bg.setAttribute("rx", "18");
  bg.setAttribute("fill", "rgba(255,255,255,0.78)");
  bg.setAttribute("stroke", "rgba(0,0,0,0.20)");
  bg.setAttribute("stroke-width", "2");
  g.appendChild(bg);
  
 // Title inside Conditions panel
 const title = svgEl(svgDoc, "text");
 title.setAttribute("x", "24");
 title.setAttribute("y", "32");
 title.setAttribute("font-size", "18");
 title.setAttribute("font-weight", "800");
 title.setAttribute("font-family", "system-ui, Segoe UI, Arial");
 title.setAttribute("fill", "rgba(0,0,0,0.85)");
 title.textContent = "Norquay Live Run Status";
 g.appendChild(title);
 
  // Clip everything inside the rounded border
  g.setAttribute("clip-path", "url(#conditionsClip)");

  // Divider
  const div1 = svgEl(svgDoc, "line");
  div1.setAttribute("x1", String(DIV_X));
  div1.setAttribute("y1", "14");
  div1.setAttribute("x2", String(DIV_X));
  div1.setAttribute("y2", String(PANEL_H - 14));
  div1.setAttribute("stroke", "rgba(0,0,0,0.15)");
  div1.setAttribute("stroke-width", "2");
  g.appendChild(div1);

  // Right-side tiles container (subtle)
  const tilesBg = svgEl(svgDoc, "rect");
  tilesBg.setAttribute("x", String(RIGHT_X));
  tilesBg.setAttribute("y", "14");
  tilesBg.setAttribute("width", String(RIGHT_W));
  tilesBg.setAttribute("height", String(PANEL_H - 28));
  tilesBg.setAttribute("rx", "14");
  tilesBg.setAttribute("fill", "rgba(255,255,255,0.55)");
  tilesBg.setAttribute("stroke", "rgba(0,0,0,0.10)");
  tilesBg.setAttribute("stroke-width", "1.5");
  g.appendChild(tilesBg);

  // Temp
  const temp = svgEl(svgDoc, "text");
  temp.setAttribute("id", "cTemp");
  temp.setAttribute("x", "24");
  temp.setAttribute("y", "92");
  temp.setAttribute("font-size", "40");
  temp.setAttribute("font-weight", "600");
  temp.setAttribute("font-family", "system-ui, Segoe UI, Arial");
  temp.textContent = "--°C";
  g.appendChild(temp);

  // Weather note label
  const noteLabel = svgEl(svgDoc, "text");
  noteLabel.setAttribute("x", "150");
  noteLabel.setAttribute("y", "54");
  noteLabel.setAttribute("font-size", "14");
  noteLabel.setAttribute("font-weight", "700");
  noteLabel.setAttribute("font-family", "system-ui, Segoe UI, Arial");
  noteLabel.setAttribute("fill", "rgba(0,0,0,0.65)");
  noteLabel.textContent = "Weather Note";
  g.appendChild(noteLabel);

  // Weather note wrapped (foreignObject)
  const noteFO = svgEl(svgDoc, "foreignObject");
  noteFO.setAttribute("x", "150");
  noteFO.setAttribute("y", "60");
  noteFO.setAttribute("width", String(LEFT_W - 150)); // fits left area neatly
  noteFO.setAttribute("height", "78");

  const noteDiv = svgDoc.createElement("div");
  noteDiv.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  noteDiv.setAttribute(
    "style",
    "font: 14px system-ui, Segoe UI, Arial; color: rgba(0,0,0,0.78); line-height: 1.25; max-height:78px; overflow:hidden;"
  );
  noteDiv.id = "cNote";
  noteDiv.textContent = "Loading…";

  noteFO.appendChild(noteDiv);
  g.appendChild(noteFO);

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
    v.setAttribute("font-size", "20");
    v.setAttribute("font-weight", "700");
    v.setAttribute("font-family", "system-ui, Segoe UI, Arial");
    v.textContent = "--";
    g.appendChild(v);

    const l = svgEl(svgDoc, "text");
    l.setAttribute("x", String(x + w / 2));
    l.setAttribute("y", String(y + 52));
    l.setAttribute("text-anchor", "middle");
    l.setAttribute("font-size", "10.5");
    l.setAttribute("font-family", "system-ui, Segoe UI, Arial");
    l.setAttribute("fill", "rgba(0,0,0,0.65)");
    l.textContent = labelText;
    g.appendChild(l);
  }

  // Titles (right area)
  const nsTitle = svgEl(svgDoc, "text");
  nsTitle.setAttribute("x", String(RIGHT_X + 12));
  nsTitle.setAttribute("y", "34");
  nsTitle.setAttribute("font-size", "14");
  nsTitle.setAttribute("font-weight", "700");
  nsTitle.setAttribute("font-family", "system-ui, Segoe UI, Arial");
  nsTitle.setAttribute("fill", "rgba(0,0,0,0.65)");
  nsTitle.textContent = "New Snow";
  g.appendChild(nsTitle);

  const sbTitle = svgEl(svgDoc, "text");
  sbTitle.setAttribute("x", String(RIGHT_X + 12));
  sbTitle.setAttribute("y", "118");
  sbTitle.setAttribute("font-size", "14");
  sbTitle.setAttribute("font-weight", "700");
  sbTitle.setAttribute("font-family", "system-ui, Segoe UI, Arial");
  sbTitle.setAttribute("fill", "rgba(0,0,0,0.65)");
  sbTitle.textContent = "Snow Base";
  g.appendChild(sbTitle);

  // New Snow row
  const t0x = RIGHT_X + 12;
  const row1y = 40;
  addTile(t0x + (TILE_W + TILE_GAP) * 0, row1y, TILE_W, TILE_H, "nsOvernight", "Overnight");
  addTile(t0x + (TILE_W + TILE_GAP) * 1, row1y, TILE_W, TILE_H, "ns24", "Last 24h");
  addTile(t0x + (TILE_W + TILE_GAP) * 2, row1y, TILE_W, TILE_H, "ns7", "Last 7d");

  // Snow Base row
  const row2y = 124;
  addTile(t0x + (TILE_W + TILE_GAP) * 0, row2y, TILE_W, TILE_H, "sbLower", "Lower");
  addTile(t0x + (TILE_W + TILE_GAP) * 1, row2y, TILE_W, TILE_H, "sbUpper", "Upper");
  addTile(t0x + (TILE_W + TILE_GAP) * 2, row2y, TILE_W, TILE_H, "sbYtd", "YTD Snow");

  // Updated text
  const updated = svgEl(svgDoc, "text");
  updated.setAttribute("id", "cUpdated");
  updated.setAttribute("x", "24");
  updated.setAttribute("y", String(PANEL_H - 12));
  updated.setAttribute("font-size", "11");
  updated.setAttribute("font-family", "system-ui, Segoe UI, Arial");
  updated.setAttribute("fill", "rgba(0,0,0,0.55)");
  updated.textContent = "Updated: --";
  g.appendChild(updated);

  // Add overlay LAST so it sits above everything
  svg.appendChild(g);
}

function updateOverlayFromData(svgDoc, d) {
  if (!d) return;

  const tempC = d.tempC ?? null;
  const note = (d.note ?? "").toString();
  const when = d.updated ? new Date(d.updated) : null;

  const tempEl = svgDoc.getElementById("cTemp");
  if (tempEl) tempEl.textContent = (tempC === null) ? "--°C" : `${tempC}°C`;

  const noteEl = svgDoc.getElementById("cNote");
  if (noteEl) noteEl.textContent = note.length > 260 ? (note.slice(0, 260) + "…") : note;

  const nsO = svgDoc.getElementById("nsOvernight");
  const ns24 = svgDoc.getElementById("ns24");
  const ns7 = svgDoc.getElementById("ns7");
  if (nsO) nsO.textContent = fmtCm(d.newSnow?.overnightCm);
  if (ns24) ns24.textContent = fmtCm(d.newSnow?.last24Cm);
  if (ns7) ns7.textContent = fmtCm(d.newSnow?.last7DaysCm);

  const sbL = svgDoc.getElementById("sbLower");
  const sbU = svgDoc.getElementById("sbUpper");
  const sbY = svgDoc.getElementById("sbYtd");
  if (sbL) sbL.textContent = fmtCm(d.snowBase?.lowerCm);
  if (sbU) sbU.textContent = fmtCm(d.snowBase?.upperCm);
  if (sbY) sbY.textContent = fmtCm(d.snowBase?.ytdSnowfallCm);

  const upEl = svgDoc.getElementById("cUpdated");
  if (upEl) upEl.textContent = `Updated: ${when ? when.toLocaleString() : "--"}`;
}

// ---------------- MAIN REFRESH ----------------

async function refresh() {
  const statusEl = document.getElementById("status");
  const obj = document.getElementById("map");

  try {
    statusEl.textContent = "Starting…";

    const svgDoc = await reloadSvgObject(obj, statusEl);
    ensureSvgStyles(svgDoc);

    // Inject overlay immediately (so layout is always present)
    injectOverlay(svgDoc);

    statusEl.textContent = "Fetching run status + conditions…";

    const runMapRawPromise = loadJSON("/runMap.json", 8000).catch(() => ({}));
    const livePromise = loadJSON("/.netlify/functions/norquay-runs", 20000);
    const condPromise = loadJSON(CONDITIONS_URL, 15000).catch(() => null);

    const [runMapRaw, live, cond] = await Promise.all([runMapRawPromise, livePromise, condPromise]);

    // Update conditions overlay (if we got data)
    if (cond) {
      updateOverlayFromData(svgDoc, cond);
      applyLiftBadgesFromConditions(svgDoc, cond);
    }

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

// Refresh every 20 minutes
setInterval(refresh, 20 * 60 * 1000);
