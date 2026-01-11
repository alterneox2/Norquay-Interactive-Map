export default async (req, context) => {
  try {
    const url = "https://banffnorquay.com/winter/conditions/";
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Netlify Function)"
      }
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream ${res.status} ${res.statusText}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const html = await res.text();

    // Parse runs from the HTML using the same signals you inspected:
    // - open icon uses:  bi bi-check-circle-fill open-icon
    // - closed icon uses: bi bi-x-circle-fill close-icon
    //
    // We'll parse table rows and capture the run name + status.
    const runs = {};

    // crude but effective HTML parsing without external libs:
    // Find each trail row containing open/close icon and a trail name cell.
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    const rows = html.match(rowRegex) || [];

    for (const row of rows) {
      const isOpen = /open-icon/.test(row);
      const isClosed = /close-icon/.test(row);

      if (!isOpen && !isClosed) continue;
	  
	  const isGroomed =
        /icons-snow-plow-truck\.svg/i.test(row) ||
        /snow-plow-truck/i.test(row);

      // Trail name is typically in the trail_name cell
      // e.g. <td class="trail_name"> ... <div>Valley of 10</div> ...
      const nameMatch =
        row.match(/class="trail_name"[\s\S]*?<div[^>]*>([^<]+)<\/div>/i) ||
        row.match(/class="trail_name"[\s\S]*?>([^<]+)<\/td>/i);

      if (!nameMatch) continue;

      const name = nameMatch[1].trim();
	   
	  runs[name] = {
		 status: isOpen ? "open" : "closed",
		 groomed: isGroomed
    };

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
          // small cache to reduce hits to Norquay site
          "Cache-Control": "public, max-age=60"
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
