import { NextRequest, NextResponse } from "next/server";
import { fetchRanglisten } from "@/lib/scraper";
import { checkEligibility } from "@/lib/eligibility";
import { Liga, SELECTABLE_LIGEN } from "@/lib/types";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const { ranglistennummer, clubKuerzel, targetLiga } = body as {
    ranglistennummer?: string;
    clubKuerzel?: string;
    targetLiga?: string;
  };

  if (!ranglistennummer || !clubKuerzel || !targetLiga) {
    return NextResponse.json(
      { error: "Fehlende Pflichtfelder: ranglistennummer, clubKuerzel, targetLiga" },
      { status: 400 }
    );
  }

  if (!SELECTABLE_LIGEN.includes(targetLiga as Liga)) {
    return NextResponse.json(
      { error: `Ungültige Liga: ${targetLiga}` },
      { status: 400 }
    );
  }

  try {
    const data = await fetchRanglisten();
    const result = checkEligibility(
      { ranglistennummer, clubKuerzel, targetLiga: targetLiga as Liga },
      data
    );
    return NextResponse.json({ ...result, fetchedAt: data.fetchedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
