import { NextRequest, NextResponse } from "next/server";
import { fetchRanglisten } from "@/lib/scraper";

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    const data = await fetchRanglisten(forceRefresh);
    return NextResponse.json({
      fetchedAt: data.fetchedAt,
      count: data.entries.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
