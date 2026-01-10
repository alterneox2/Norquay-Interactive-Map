var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/norquay-runs.js
var norquay_runs_exports = {};
__export(norquay_runs_exports, {
  default: () => norquay_runs_default
});
module.exports = __toCommonJS(norquay_runs_exports);
var norquay_runs_default = async (req, context) => {
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
    const runs = {};
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    const rows = html.match(rowRegex) || [];
    for (const row of rows) {
      const isOpen = /open-icon/.test(row);
      const isClosed = /close-icon/.test(row);
      if (!isOpen && !isClosed) continue;
      const nameMatch = row.match(/class="trail_name"[\s\S]*?<div[^>]*>([^<]+)<\/div>/i) || row.match(/class="trail_name"[\s\S]*?>([^<]+)<\/td>/i);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();
      runs[name] = isOpen ? "open" : "closed";
    }
    return new Response(
      JSON.stringify({
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvbm9ycXVheS1ydW5zLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJleHBvcnQgZGVmYXVsdCBhc3luYyAocmVxLCBjb250ZXh0KSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHVybCA9IFwiaHR0cHM6Ly9iYW5mZm5vcnF1YXkuY29tL3dpbnRlci9jb25kaXRpb25zL1wiO1xyXG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoTmV0bGlmeSBGdW5jdGlvbilcIlxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAoIXJlcy5vaykge1xyXG4gICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFxyXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGBVcHN0cmVhbSAke3Jlcy5zdGF0dXN9ICR7cmVzLnN0YXR1c1RleHR9YCB9KSxcclxuICAgICAgICB7IHN0YXR1czogNTAyLCBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0gfVxyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGh0bWwgPSBhd2FpdCByZXMudGV4dCgpO1xyXG5cclxuICAgIC8vIFBhcnNlIHJ1bnMgZnJvbSB0aGUgSFRNTCB1c2luZyB0aGUgc2FtZSBzaWduYWxzIHlvdSBpbnNwZWN0ZWQ6XHJcbiAgICAvLyAtIG9wZW4gaWNvbiB1c2VzOiAgYmkgYmktY2hlY2stY2lyY2xlLWZpbGwgb3Blbi1pY29uXHJcbiAgICAvLyAtIGNsb3NlZCBpY29uIHVzZXM6IGJpIGJpLXgtY2lyY2xlLWZpbGwgY2xvc2UtaWNvblxyXG4gICAgLy9cclxuICAgIC8vIFdlJ2xsIHBhcnNlIHRhYmxlIHJvd3MgYW5kIGNhcHR1cmUgdGhlIHJ1biBuYW1lICsgc3RhdHVzLlxyXG4gICAgY29uc3QgcnVucyA9IHt9O1xyXG5cclxuICAgIC8vIGNydWRlIGJ1dCBlZmZlY3RpdmUgSFRNTCBwYXJzaW5nIHdpdGhvdXQgZXh0ZXJuYWwgbGliczpcclxuICAgIC8vIEZpbmQgZWFjaCB0cmFpbCByb3cgY29udGFpbmluZyBvcGVuL2Nsb3NlIGljb24gYW5kIGEgdHJhaWwgbmFtZSBjZWxsLlxyXG4gICAgY29uc3Qgcm93UmVnZXggPSAvPHRyW1xcc1xcU10qPzxcXC90cj4vZ2k7XHJcbiAgICBjb25zdCByb3dzID0gaHRtbC5tYXRjaChyb3dSZWdleCkgfHwgW107XHJcblxyXG4gICAgZm9yIChjb25zdCByb3cgb2Ygcm93cykge1xyXG4gICAgICBjb25zdCBpc09wZW4gPSAvb3Blbi1pY29uLy50ZXN0KHJvdyk7XHJcbiAgICAgIGNvbnN0IGlzQ2xvc2VkID0gL2Nsb3NlLWljb24vLnRlc3Qocm93KTtcclxuXHJcbiAgICAgIGlmICghaXNPcGVuICYmICFpc0Nsb3NlZCkgY29udGludWU7XHJcblxyXG4gICAgICAvLyBUcmFpbCBuYW1lIGlzIHR5cGljYWxseSBpbiB0aGUgdHJhaWxfbmFtZSBjZWxsXHJcbiAgICAgIC8vIGUuZy4gPHRkIGNsYXNzPVwidHJhaWxfbmFtZVwiPiAuLi4gPGRpdj5WYWxsZXkgb2YgMTA8L2Rpdj4gLi4uXHJcbiAgICAgIGNvbnN0IG5hbWVNYXRjaCA9XHJcbiAgICAgICAgcm93Lm1hdGNoKC9jbGFzcz1cInRyYWlsX25hbWVcIltcXHNcXFNdKj88ZGl2W14+XSo+KFtePF0rKTxcXC9kaXY+L2kpIHx8XHJcbiAgICAgICAgcm93Lm1hdGNoKC9jbGFzcz1cInRyYWlsX25hbWVcIltcXHNcXFNdKj8+KFtePF0rKTxcXC90ZD4vaSk7XHJcblxyXG4gICAgICBpZiAoIW5hbWVNYXRjaCkgY29udGludWU7XHJcblxyXG4gICAgICBjb25zdCBuYW1lID0gbmFtZU1hdGNoWzFdLnRyaW0oKTtcclxuICAgICAgcnVuc1tuYW1lXSA9IGlzT3BlbiA/IFwib3BlblwiIDogXCJjbG9zZWRcIjtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFxyXG4gICAgICBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgdXBkYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgc291cmNlOiB1cmwsXHJcbiAgICAgICAgcnVuc1xyXG4gICAgICB9KSxcclxuICAgICAge1xyXG4gICAgICAgIHN0YXR1czogMjAwLFxyXG4gICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxyXG4gICAgICAgICAgLy8gc21hbGwgY2FjaGUgdG8gcmVkdWNlIGhpdHMgdG8gTm9ycXVheSBzaXRlXHJcbiAgICAgICAgICBcIkNhY2hlLUNvbnRyb2xcIjogXCJwdWJsaWMsIG1heC1hZ2U9NjBcIlxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgKTtcclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXHJcbiAgICAgIEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGVycj8ubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSB9KSxcclxuICAgICAgeyBzdGF0dXM6IDUwMCwgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9IH1cclxuICAgICk7XHJcbiAgfVxyXG59O1xyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQU8sdUJBQVEsT0FBTyxLQUFLLFlBQVk7QUFDckMsTUFBSTtBQUNGLFVBQU0sTUFBTTtBQUNaLFVBQU0sTUFBTSxNQUFNLE1BQU0sS0FBSztBQUFBLE1BQzNCLFNBQVM7QUFBQSxRQUNQLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0YsQ0FBQztBQUVELFFBQUksQ0FBQyxJQUFJLElBQUk7QUFDWCxhQUFPLElBQUk7QUFBQSxRQUNULEtBQUssVUFBVSxFQUFFLE9BQU8sWUFBWSxJQUFJLE1BQU0sSUFBSSxJQUFJLFVBQVUsR0FBRyxDQUFDO0FBQUEsUUFDcEUsRUFBRSxRQUFRLEtBQUssU0FBUyxFQUFFLGdCQUFnQixtQkFBbUIsRUFBRTtBQUFBLE1BQ2pFO0FBQUEsSUFDRjtBQUVBLFVBQU0sT0FBTyxNQUFNLElBQUksS0FBSztBQU81QixVQUFNLE9BQU8sQ0FBQztBQUlkLFVBQU0sV0FBVztBQUNqQixVQUFNLE9BQU8sS0FBSyxNQUFNLFFBQVEsS0FBSyxDQUFDO0FBRXRDLGVBQVcsT0FBTyxNQUFNO0FBQ3RCLFlBQU0sU0FBUyxZQUFZLEtBQUssR0FBRztBQUNuQyxZQUFNLFdBQVcsYUFBYSxLQUFLLEdBQUc7QUFFdEMsVUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFVO0FBSTFCLFlBQU0sWUFDSixJQUFJLE1BQU0scURBQXFELEtBQy9ELElBQUksTUFBTSwyQ0FBMkM7QUFFdkQsVUFBSSxDQUFDLFVBQVc7QUFFaEIsWUFBTSxPQUFPLFVBQVUsQ0FBQyxFQUFFLEtBQUs7QUFDL0IsV0FBSyxJQUFJLElBQUksU0FBUyxTQUFTO0FBQUEsSUFDakM7QUFFQSxXQUFPLElBQUk7QUFBQSxNQUNULEtBQUssVUFBVTtBQUFBLFFBQ2IsWUFBVyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLFFBQ2xDLFFBQVE7QUFBQSxRQUNSO0FBQUEsTUFDRixDQUFDO0FBQUEsTUFDRDtBQUFBLFFBQ0UsUUFBUTtBQUFBLFFBQ1IsU0FBUztBQUFBLFVBQ1AsZ0JBQWdCO0FBQUE7QUFBQSxVQUVoQixpQkFBaUI7QUFBQSxRQUNuQjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRixTQUFTLEtBQUs7QUFDWixXQUFPLElBQUk7QUFBQSxNQUNULEtBQUssVUFBVSxFQUFFLE9BQU8sS0FBSyxXQUFXLE9BQU8sR0FBRyxFQUFFLENBQUM7QUFBQSxNQUNyRCxFQUFFLFFBQVEsS0FBSyxTQUFTLEVBQUUsZ0JBQWdCLG1CQUFtQixFQUFFO0FBQUEsSUFDakU7QUFBQSxFQUNGO0FBQ0Y7IiwKICAibmFtZXMiOiBbXQp9Cg==
