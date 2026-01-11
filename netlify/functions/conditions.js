import cheerio from "cheerio";

export default async () => {
  try {
    const res = await fetch("https://banffnorquay.com/winter/conditions/", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html"
      }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch conditions" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const text = $("body").text().replace(/\s+/g, " ");

    // ---- CURRENT TEMP ----
    const tempMatch = text.match(/Current Temp\s*(-?\d+)\s*°\s*C/i);
    const tempC = tempMatch ? Number(tempMatch[1]) : null;

    // ---- WEATHER NOTE ----
    const noteMatch = text.match(/Weather Note:\s*(.*?)(New Snow|Snow Base)/i);
    const note = noteMatch ? noteMatch[1].trim() : null;

    // ---- NEW SNOW ----
    const overnightMatch = text.match(/New Snow\s*(\d+)\s*cm\s*Overnight/i);
    const last24Match = text.match(/Overnight\s*\d+\s*cm\s*Last 24 hours\s*(\d+)\s*cm/i);
    const last7Match = text.match(/Last 24 hours\s*\d+\s*cm\s*Last 7 days\s*(\d+)\s*cm/i);

    // ---- SNOW BASE ----
    const lowerMatch = text.match(/Snow Base\s*(\d+)\s*cm\s*Lower Mountain/i);
    const upperMatch = text.match(/Upper Mountain\s*(\d+)\s*cm/i);

    const ytdMatches = [...text.matchAll(/Year to Date Snowfall\s*(\d+)\s*cm/gi)]
      .map(m => Number(m[1]));

    const data = {
      source: "https://banffnorquay.com/winter/conditions/",
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
        ytdSnowfallCm: ytdMatches[0] ?? null,
        ytdSnowfall2Cm: ytdMatches[1] ?? null
      },
      updated: new Date().toISOString()
    };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
