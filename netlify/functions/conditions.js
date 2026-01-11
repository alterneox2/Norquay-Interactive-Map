export default async () => {
  try {
    // This endpoint is what the site uses internally
    const res = await fetch(
      "https://banffnorquay.com/wp-json/wp/v2/pages?slug=conditions",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      }
    );

    if (!res.ok) {
      throw new Error("Failed to fetch WP JSON");
    }

    const pages = await res.json();
    if (!pages.length) throw new Error("No page data");

    const content = pages[0].content.rendered;

    // Strip HTML to text
    const text = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // ---- CURRENT TEMP ----
    const tempMatch = text.match(/Current Temp\s*(-?\d+)\s*°\s*C/i);
    const tempC = tempMatch ? Number(tempMatch[1]) : null;

    // ---- WEATHER NOTE ----
    const noteMatch = text.match(/Weather Note:\s*(.*?)(New Snow|Snow Base)/i);
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

    return new Response(
      JSON.stringify({
        source: "banffnorquay.com (WP JSON)",
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
