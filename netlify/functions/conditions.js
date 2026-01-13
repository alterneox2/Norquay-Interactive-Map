export default async () => {
  try {
    // --- Part 1: Get conditions content (WP JSON) ---
    const wpRes = await fetch(
      "https://banffnorquay.com/wp-json/wp/v2/pages?slug=conditions",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      }
    );

    if (!wpRes.ok) throw new Error("Failed to fetch WP JSON");

    const pages = await wpRes.json();
    if (!pages.length) throw new Error("No page data");

    const contentHtml = pages[0].content?.rendered || "";

    // Strip HTML to text (for temp/snow parsing)
    const text = contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // ---- CURRENT TEMP ----
    const tempMatch = text.match(/Current Temp\s*(-?\d+)\s*°\s*C/i);
    const tempC = tempMatch ? Number(tempMatch[1]) : null;

    // ---- WEATHER NOTE ----
    const noteMatch = text.match(/Weather Note:\s*(.*?)(New Snow|Snow Base|Lift Status)/i);
    const note = noteMatch ? noteMatch[1].trim() : null;

    // ---- NEW SNOW ----
    const overnightMatch = text.match(/(\d+)\s*cm\s*Overnight/i);
    const last24Match = text.match(/(\d+)\s*cm\s*Last 24 hours/i);
    const last7Match = text.match(/(\d+)\s*cm\s*Last 7 days/i);

    // ---- SNOW BASE ----
    const lowerMatch = text.match(/(\d+)\s*cm\s*Lower Mountain/i);
    const upperMatch = text.match(/(\d+)\s*cm\s*Upper Mountain/i);

    const ytdMatches = [...text.matchAll(/(\d+)\s*cm\s*Year to Date Snowfall/gi)]
      .map(m => Number(m[1]));

    // --- Part 2: Get Lift Status from the live conditions page (HTML) ---
    const url = "https://banffnorquay.com/winter/conditions/";
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Netlify Function)" }
    });

    if (!pageRes.ok) {
      throw new Error(`Failed to fetch conditions page HTML: ${pageRes.status} ${pageRes.statusText}`);
    }

    const html = await pageRes.text();

    // We'll scan all table rows and pick out the lift ones.
    // This uses the same "open-icon"/"close-icon" pattern as your runs scraper.
    const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

    // Only lifts we care about (use the same names you’ll map in app.js)
    const KNOWN_LIFTS = new Set([
      "North American Chair",
      "Cascade Lift",
      "Spirit Chair",
      "Mystic Chair",
      "Sundance Carpet",
      "Rundle Conveyor",
      "Tube Park Carpet"
    ]);

    const lifts = {};

    for (const row of rows) {
      const isOpen = /open-icon/i.test(row);
      const isClosed = /close-icon/i.test(row);
      if (!isOpen && !isClosed) continue;

      // Try a few likely cell class names (site markup can vary)
      const nameMatch =
        row.match(/class="lift_name"[\s\S]*?<div[^>]*>([^<]+)<\/div>/i) ||
        row.match(/class="lift_name"[\s\S]*?>([^<]+)<\/td>/i) ||
        row.match(/class="trail_name"[\s\S]*?<div[^>]*>([^<]+)<\/div>/i) ||
        row.match(/class="trail_name"[\s\S]*?>([^<]+)<\/td>/i) ||
        row.match(/<td[^>]*>\s*([^<]{2,60})\s*<\/td>/i);

      if (!nameMatch) continue;

      const name = nameMatch[1].trim();

      // Only store known lifts
      if (!KNOWN_LIFTS.has(name)) continue;

      lifts[name] = isOpen ? "open" : "closed";
    }

    return new Response(
      JSON.stringify({
        source: "banffnorquay.com (WP JSON + /winter/conditions/ HTML)",
        tempC,
        note,
        newSnow: {
          overnightCm: overnightMatch ? Number(overnightMatch[1]) : null,
          last24Cm: last24Match ? Number(last24Match[1]) : null,
          last7DaysCm: last7Match ? Number(last7Match[1]) : null
        },
        snowBase: {
          lowerCm: lowerMatch ? Number(lowerMatch[1]) : null,
          upperCm: upperMatch ? Number(upperMatch[1]) : null,
          ytdSnowfallCm: ytdMatches[0] ?? null
        },
        lifts, // <---- NEW
        updated: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=600"
        }
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
};
