export default async (req, context) => {
  try {
    const url = "https://banffnorquay.com/winter/conditions/";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Netlify Function)" }
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream ${res.status} ${res.statusText}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const html = await res.text();

    const runs = {};
    const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

    for (const row of rows) {
      const isOpen = /open-icon/.test(row);
      const isClosed = /close-icon/.test(row);
      if (!isOpen && !isClosed) continue;

      const isGroomed =
        /icons-snow-plow-truck\.svg/i.test(row) ||
        /snow-plow-truck/i.test(row);

      const nameMatch =
        row.match(/class="trail_name"[\s\S]*?<div[^>]*>([^<]+)<\/div>/i) ||
        row.match(/class="trail_name"[\s\S]*?>([^<]+)<\/td>/i);

      if (!nameMatch) continue;

      const name = nameMatch[1].trim();

      runs[name] = {
        status: isOpen ? "open" : "closed",
        groomed: isGroomed
      };
    }

    // IMPORTANT: return AFTER the loop so all runs are included
    return new Response(
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        source: url,
        runs
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          // 10 minutes, to match your desired update interval
          "Cache-Control": "public, max-age=600"
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
