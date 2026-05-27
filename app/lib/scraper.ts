import { Liga, RankingEntry, RanglistenData } from "./types";

const RANGLISTEN_URL =
  "https://www.hamburger-schachverband.de/hmm2026/hmm2026_ranglisten.htm";

let cache: RanglistenData | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

function parseLeague(raw: string): Liga {
  const s = raw.trim();
  if (s.startsWith("Landesliga")) return "Landesliga";
  if (s.startsWith("Stadtliga")) return "Stadtliga";
  if (s.startsWith("Bezirksliga")) return "Bezirksliga";
  if (s.startsWith("Kreisliga")) return "Kreisliga";
  if (s.startsWith("Kreisklasse")) return "Kreisklasse";
  if (s.startsWith("Basisklasse")) return "Basisklasse";
  return "Kreisklasse";
}

function parsePlayers(
  text: string,
  defaultTeamNummer: number,
  defaultLiga: Liga,
  clubKuerzel: string,
  isReserve: boolean,
  teamHeaders: Array<{ teamNummer: number; liga: Liga }>
): RankingEntry[] {
  const entries: RankingEntry[] = [];
  const seen = new Set<string>();

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("Mannschaftsführer") ||
      trimmed.startsWith("Reserveliste") ||
      /^[A-Z]{2,4}\s+\d+\s+/.test(trimmed)
    ) {
      continue;
    }

    const m = line.match(/^\s{1,4}(\d+)(a)?\s{1,3}([A-ZÄÖÜ][^\t\n]{2,}?)(?:\s{2,}.*)?$/);
    if (!m) continue;

    const base = parseInt(m[1], 10);
    const isANummer = m[2] === "a";
    const name = m[3].trim().replace(/\s{2,}.*$/, "").trim();
    const ranglistennummer = isANummer ? `${base}a` : `${base}`;

    if (seen.has(ranglistennummer)) continue;
    if (!name || name.length < 3) continue;

    const expectedTeam = Math.ceil(base / 10);
    const teamHeader = teamHeaders.find((t) => t.teamNummer === expectedTeam);
    const teamNummer = teamHeader ? teamHeader.teamNummer : defaultTeamNummer;
    const liga = teamHeader ? teamHeader.liga : defaultLiga;

    seen.add(ranglistennummer);
    entries.push({
      ranglistennummer,
      ranglistennummerBase: base,
      isANummer,
      name,
      teamNummer,
      liga,
      clubKuerzel,
      higherLeagueEinsaetze: 0,
      higherClassEinsaetze: 0,
      totalHigherEinsaetze: 0,
      isReserve,
    });
  }

  return entries;
}

/**
 * Parse the raw HTML of the HMM ranking list page.
 *
 * The page uses <PRE> blocks separated by <HR> tags. Each club section
 * starts with an anchor id. Team headers appear before the first <HR>
 * in each team block. "Reserveliste" marks the start of reserve players.
 */
export function parseRanglisten(html: string): RankingEntry[] {
  const allEntries: RankingEntry[] = [];

  const clubSectionRegex =
    /<a id='([A-Z]+)'><\/a><H3>[A-Z]+<\/H3>([\s\S]*?)(?=<a id='[A-Z]+'|$)/g;

  let clubMatch: RegExpExecArray | null;
  while ((clubMatch = clubSectionRegex.exec(html)) !== null) {
    const clubKuerzel = clubMatch[1];
    const clubContent = clubMatch[2];

    // Collect all team headers
    const teamHeaders: Array<{ teamNummer: number; liga: Liga }> = [];
    const headerRegex =
      /[A-Z]+\s+(\d+)\s+((?:Landesliga|Stadtliga|Bezirksliga|Kreisliga|Kreisklasse|Basisklasse)[^\n\t<]*)/g;
    let hm: RegExpExecArray | null;
    while ((hm = headerRegex.exec(clubContent)) !== null) {
      teamHeaders.push({
        teamNummer: parseInt(hm[1], 10),
        liga: parseLeague(hm[2]),
      });
    }

    if (teamHeaders.length === 0) continue;

    const maxTeamNum = Math.max(...teamHeaders.map((t) => t.teamNummer));

    // Split content into blocks separated by <HR>
    const blocks = clubContent.split(/<HR[^>]*>/i);

    let currentTeamNummer = teamHeaders[0].teamNummer;
    let currentLiga = teamHeaders[0].liga;
    // Track whether the previous block ended with a Reserveliste marker
    let nextBlockIsReserve = false;

    const clubSeen = new Set<string>();
    const clubEntries: RankingEntry[] = [];

    for (const block of blocks) {
      // Update current team if this block has a header
      const headerMatch = block.match(
        /[A-Z]+\s+(\d+)\s+((?:Landesliga|Stadtliga|Bezirksliga|Kreisliga|Kreisklasse|Basisklasse)[^\n\t<]*)/
      );
      if (headerMatch) {
        currentTeamNummer = parseInt(headerMatch[1], 10);
        currentLiga = parseLeague(headerMatch[2]);
        nextBlockIsReserve = false;
      }

      // Check if this block contains a Reserveliste marker
      const reserveIdx = block.search(/Reserveliste/i);
      const hasReserveMarker = reserveIdx >= 0;

      // Determine which part of this block is regular vs reserve
      const regularText = hasReserveMarker ? block.slice(0, reserveIdx) : block;
      const reserveText = hasReserveMarker ? block.slice(reserveIdx) : "";

      // If previous block ended with Reserveliste, this whole block is reserve
      const blockIsReserve = nextBlockIsReserve;

      const regularEntries = parsePlayers(
        blockIsReserve ? "" : regularText,
        currentTeamNummer,
        currentLiga,
        clubKuerzel,
        false,
        teamHeaders
      );

      // Reserve players: either from the reserve section of this block,
      // or the entire block if flagged from previous block
      const reserveEntries = parsePlayers(
        blockIsReserve ? block : reserveText,
        maxTeamNum,
        currentLiga,
        clubKuerzel,
        true,
        teamHeaders
      );

      for (const e of [...regularEntries, ...reserveEntries]) {
        if (!clubSeen.has(e.ranglistennummer)) {
          clubSeen.add(e.ranglistennummer);
          clubEntries.push(e);
        }
      }

      // If this block ended with a Reserveliste marker (and no players after it),
      // the next block contains the reserve players
      nextBlockIsReserve = hasReserveMarker && reserveText.trim().replace(/Reserveliste/i, "").trim().length < 10;
    }

    allEntries.push(...clubEntries);
  }

  return allEntries;
}

export async function fetchRanglisten(forceRefresh = false): Promise<RanglistenData> {
  if (
    !forceRefresh &&
    cache &&
    Date.now() - new Date(cache.fetchedAt).getTime() < CACHE_TTL_MS
  ) {
    return cache;
  }

  const response = await fetch(RANGLISTEN_URL, {
    headers: { "Accept-Charset": "iso-8859-1" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Fehler beim Laden der Ranglisten: HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const html = new TextDecoder("iso-8859-1").decode(buffer);
  const entries = parseRanglisten(html);

  cache = {
    fetchedAt: new Date().toISOString(),
    entries,
  };

  return cache;
}

export function clearCache(): void {
  cache = null;
}
