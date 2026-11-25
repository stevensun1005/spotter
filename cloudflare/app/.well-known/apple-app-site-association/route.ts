export const dynamic = "force-static";

export function GET() {
  return Response.json({ applinks: { details: [
    { appIDs: ["ZJ853N22CA.app.spotter.health"], components: [{ "/": "/invite/*" }] },
  ] } }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
