// netlify/functions/conditions.js
import cheerio from "cheerio";

export default async (request, context) => {
  try {
    const url = "https://banffnorquay.com/winter/conditions/";

    const res = await fetch(url, {
      headers: {
        // Helps avoid getting a blocked/stripped response
        "User-Agent": "Mozilla/5.0 (Netlify Function)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Fetch failed", status: res.status }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // NOTE: selectors may need minor tweaks if Norquay changes their markup.
    // We’ll parse based on headings and the values that follow.

    const getSectionValues = (headingText) => {
      // Find an element that contains the heading text, then look forward for numbers/text
      const h = $(`*:contains("${headingText}")`).filter((_, el) => $(el).text().trim() === headingText).first();
      if (!h.length) return null;

      // Grab a reasonable chunk after the heading to parse
      const container = h.parent();
      return container.text().replace(/\s+/g, " ").trim();
    };

    // TEMP: look for "Current Temp" then the next "°C" value
    const pageText = $("body").text().replace(/\s+/g, " ");

    const tempMatch = pageText.match(/Current Temp\s*([-+]?\d+)\s*°\s*C/i);
    const tempC = tempMatch ? Number(tempMatch[1]) : null;

    // Weather Note: grab text after "Weather Note:"
    const noteMatch = pageText.match(/Weather Note:\s*([^]*?)(?:New Snow|Snow Base)/i);
    const note = noteMatch ? noteMatch[1].replace(/\s+/g, " ").trim() : null;

    // New Snow: Overnight, Last 24 hours, Last 7 days
    const overnightMatch = pageText.match(/New Snow\s*(\d+)\s*cm\s*Overnight/i);
    const last24Match = pageText.match(/Overnight\s*\d+\s*cm\s*Last 24 hours\s*(\d+)\s*cm/i);
    const last7Match = pageText.match(/Last 24 hours\s*\d+\s*cm\s*Last 7 days\s*(\d+)\s*cm/i);

    // Snow Base: Lower Mountain, Upper Mountain, YTD Snowfall values
    const lowerMatch = pageText.match(/Snow Base\s*(\d+)\s*cm\s*Lower Mountain/i);
    const upperMatch = pageText.match(/Upper Mountain\s*(\d+)\s*cm/i);
    const ytdMatches = [...pageText.matchAll(/Year to Date Snowfall\s*(\d+)\s*cm/gi)].map(m => Number(m[1]));

    const data = {
      source: url,
      tempC,
      note,
      newSnow: {
        overnightCm: overnightMatch ? Number(overnightMatch[1]) : null,
        last24Cm: last24Match ? Number(last24Match[1]) : null,
        last7DaysCm: last7Match ? Number(last7Match[1]) : null,
      },
      base: {
        lowerCm: lowerMatch ? Number(lowerMatch[1]) : null,
        upperCm: upperMatch ? Number(upperMatch[1]) : null,
        // Their page shows two “Year to Date Snowfall” values in the layout; keep both if present.
        ytdSnowfallCm: ytdMatches.length ? ytdMatches[0] : null,
        ytdSnowfall2Cm: ytdMatches.length > 1 ? ytdMatches[1] : null,
      },
      updated: new Date().toISOString(),
    };

    // Cache for 10 minutes at the edge/browser to reduce load
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
