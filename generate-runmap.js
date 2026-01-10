import fs from "fs";
import * as cheerio from "cheerio";

const CONDITIONS_URL = "https://banffnorquay.com/winter/conditions/";
const SVG_PATH = "./public/norquay-map.svg";
const OUT_PATH = "./public/runMap.json";

function keyify(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[_-]+/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSvgIds(svgText) {
  const ids = new Set();
  const re = /\bid="([^"]+)"/g;
  let m;
  while ((m = re.exec(svgText)) !== null) ids.add(m[1]);
  return [...ids];
}

async function fetchRunNames() {
  const html = await fetch(CONDITIONS_URL, {
    headers: { "user-agent": "Mozilla/5.0" }
  }).then(r => r.text());

  const $ = cheerio.load(html);
  const names = [];

  $("tr").each((_, tr) => {
    const td = $(tr).find("td.trail_name");
    if (!td.length) return;

    const iconClass = (td.find("div.trail_open_status_icon i").attr("class") || "").toLowerCase();
    if (!iconClass.includes("open-icon") && !iconClass.includes("close-icon")) return;

    const name = td.children("div")
      .filter((_, d) => $(d).find("i").length === 0)
      .first()
      .text();

    const k = keyify(name);
    if (k) names.push(name.trim());
  });

  return names;
}

(async () => {
  const svgText = fs.readFileSync(SVG_PATH, "utf8");
  const svgIds = extractSvgIds(svgText);

  // Build lookup from normalized-id-key -> actual SVG id
  const idByKey = new Map();
  for (const id of svgIds) {
    const k = keyify(id);
    if (!k) continue;
    // keep first seen; if duplicates appear, you can refine later
    if (!idByKey.has(k)) idByKey.set(k, id);
  }

  const runNames = await fetchRunNames();

  const runMap = {};
  const missing = [];

  for (const name of runNames) {
    const k = keyify(name);

    // direct match
    if (idByKey.has(k)) {
      runMap[k] = idByKey.get(k);
      continue;
    }

    // try removing apostrophes (helps Asteroid's, Henderson's Turn, etc.)
    const k2 = k.replace(/'/g, "");
    const match2 = [...idByKey.entries()].find(([kk]) => kk.replace(/'/g, "") === k2);
    if (match2) {
      runMap[k] = match2[1];
      continue;
    }

    missing.push(name);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(runMap, null, 2));
  console.log(`Wrote ${Object.keys(runMap).length} mappings to ${OUT_PATH}`);
  if (missing.length) {
    console.log("\nMissing (need SVG IDs that match these names):");
    console.log(missing.join("\n"));
  }
})();
