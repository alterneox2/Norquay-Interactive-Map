import express from "express";
import * as cheerio from "cheerio";

const app = express();
const PORT = 3000;
const CONDITIONS_URL = "https://banffnorquay.com/winter/conditions/";

app.use(express.static("public"));

function clean(s) {
  return (s ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Scrape run status from the Run Status table on the Conditions page. :contentReference[oaicite:1]{index=1}
app.get("/api/norquay-runs", async (req, res) => {
  try {
    const html = await fetch(CONDITIONS_URL, {
      headers: { "user-agent": "Mozilla/5.0" }
    }).then(r => r.text());

    const $ = cheerio.load(html);
    const runs = {};

    // Based on your Inspect: open-icon/close-icon live in an <i> class inside td.trail_name
    $("tr").each((_, tr) => {
      const td = $(tr).find("td.trail_name");
      if (!td.length) return;

      const iconClass = (td.find("div.trail_open_status_icon i").attr("class") || "").toLowerCase();

      let status = null;
      if (iconClass.includes("open-icon")) status = "open";
      else if (iconClass.includes("close-icon")) status = "closed";
      else return;

      const name = clean(
        td.children("div")
          .filter((_, d) => $(d).find("i").length === 0) // not the icon container
          .first()
          .text()
      );

      if (name) runs[name] = status;
    });

    res.setHeader("Cache-Control", "no-store");
    res.json({ updatedAt: new Date().toISOString(), source: CONDITIONS_URL, runs });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => console.log(`Open http://localhost:${PORT}`));
