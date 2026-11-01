/** Backward-compatible PNG endpoint using the same v2 identity as the app. */
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get("size");
  const size = requested === "512" ? 512 : requested === "180" ? 180 : 192;
  const png = await readFile(path.join(process.cwd(), "public", "branding", `oyama-crm-v2-icon-${size}.png`));
  return new NextResponse(new Uint8Array(png), {headers:{"Content-Type":"image/png","Cache-Control":"public, max-age=86400"}});
}
