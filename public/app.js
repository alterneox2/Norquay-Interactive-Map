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
  style.textContent = `
    .open {
      opacity: 1 !important;
      stroke-opacity: 1 !important;
    }

   .closed {
     stroke: red !important;
     opacity: 1 !important;
     stroke-opacity: 1 !important;
    }

   .unknown {
     opacity: 0.6 !important;
     stroke-opacity: 0.6 !important;
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
  svgDoc.querySelectorAll(".open, .closed, .unknown").forEach(el => {
    el.classList.remove("open", "closed", "unknown");
    el.style.opacity = "";
    el.style.strokeOpacity = "";
    el.style.fillOpacity = "";
    el.style.display = "";
  });
}

function applyState(el, state) {
  const target = getDrawableTarget(el);
  if (!target) return false;

  const safe = state === "open" || state === "closed" ? state : "unknown";

  // Always keep it visible (don't use display:none anymore)
  target.style.display = "";

  // Preserve original styling ONCE (first time we touch this element)
  if (!target.dataset.origStroke) {
    // Prefer attribute first, then computed style
    const attrStroke = target.getAttribute("stroke");
    const cssStroke = target.style.stroke;
    target.dataset.origStroke = attrStroke || cssStroke || "";
  }

  if (!target.dataset.origFill) {
    const attrFill = target.getAttribute("fill");
    const cssFill = target.style.fill;
    target.dataset.origFill = attrFill || cssFill || "";
  }

  // Mark state class (optional, for your own debugging)
  target.classList.remove("open", "closed", "unknown");
  target.classList.add(safe);

  if (safe === "closed") {
    // ✅ CLOSED: set red override, but do NOT touch opacity or other properties
    target.style.stroke = "red";
    // If the run is a filled shape instead of a stroked line, also force fill red
    // (harmless if fill is "none")
    target.style.fill = target.dataset.origFill === "none" ? "none" : "red";
  } else {
    // ✅ OPEN/UNKNOWN: restore original stroke/fill (remove our override)
    if (target.dataset.origStroke) target.style.stroke = target.dataset.origStroke;
    else target.style.removeProperty("stroke");

    if (target.dataset.origFill) target.style.fill = target.dataset.origFill;
    else target.style.removeProperty("fill");
  }

  return true;
}

// Force the <object> to reload the SVG each time (beats caching)
async function reloadSvgObject(obj, statusEl) {
  const base = "/norquay-map.svg";
  const bust = `?v=${Date.now()}`;
  const url = base + bust;

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

    // Always reload SVG on refresh so we apply to a known, fresh DOM
    const svgDoc = await reloadSvgObject(obj, statusEl);
    ensureSvgStyles(svgDoc);

    statusEl.textContent = "Fetching run status…";
    const live = await loadJSON("/.netlify/functions/norquay-runs", 20000);

    // Optional mapping overrides
    const runMapRaw = await loadJSON("/runMap.json", 8000).catch(() => ({}));
    const runMap = {};
    for (const [k, v] of Object.entries(runMapRaw || {})) {
      runMap[norm(k)] = (v ?? "").toString().trim();
    }

    clearPrevious(svgDoc);

    let applied = 0;
    let notFound = 0;

    for (const [runName, state] of Object.entries(live.runs || {})) {
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
      for (const c of candidates) {
        const found = svgDoc.getElementById(c);
        if (found) { el = found; break; }
      }

      if (!el) {
        notFound++;
        continue;
      }

      if (applyState(el, state)) applied++;
      else notFound++;
    }

    // Show Valley status explicitly so you can confirm
    const wiegeles = live.runs?.["Wiegele's"];
    statusEl.textContent =
      `Updated: ${new Date(live.updatedAt).toLocaleString()} — Applied: ${applied} — Not found: ${notFound} — Wiegele's: ${wiegeles ?? "missing"}`;

  } catch (err) {
    statusEl.textContent = `ERROR: ${err.message || err}`;
  }
}

// Run once on page load
refresh();

// And refresh every 2 minutes
setInterval(refresh, 120000);
