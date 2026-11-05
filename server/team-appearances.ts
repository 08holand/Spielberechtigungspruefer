import * as cheerio from 'cheerio';
import type { League, Team, TeamAppearance } from '../shared/types';

const SEASON = 2026;
const SOURCE_ROOT = 'https://www.hamburger-schachverband.de/hmmprog';
const PAGE_CACHE_TTL_MS = 15 * 60 * 1000;

// These are the team labels used by the HMM results pages, not the longer
// legal club names displayed in the roster download.
const TEAM_LABELS: Record<string, string> = {
  ALT: 'Altonaer SK',
  BAR: 'Stadtpark Barrio',
  BBK: 'Barmbeker SK',
  BGD: 'Bergedorfer SV',
  BIL: 'Billstedt-Horn',
  BLA: 'Blankenese',
  BSC: 'Bille SC',
  BSG: 'Bergedorf',
  BSK: 'Bramfeld',
  BST: 'Bergstedt',
  CON: 'Concordia/Palamedes',
  DIA: 'Diagonale Harburg',
  DIO: 'Diogenes',
  FAR: 'Farmsen',
  FBK: 'Fischbek',
  GEH: 'Gehörlosen SV',
  GHD: 'Großhansdorf',
  HBG: 'Schwarz-Weiss Harburg',
  HSK: 'Hamburger SK',
  KSP: 'Königsspringer',
  LGH: 'Langenhorn',
  LUP: 'Lurup',
  MAT: 'Marmstorf',
  MUE: 'Mümmelmannsberg',
  NIE: 'Niendorf',
  PIN: 'Pinneberg',
  ROE: 'Rösselsprung',
  SAS: 'Sasel',
  SFR: 'Schachfreunde',
  SKJ: 'SKJE',
  SSH: 'Schachelschweine',
  STE: 'Sternschanze',
  STP: 'FC St. Pauli',
  SVE: 'Eidelstedt',
  UNE: 'Union Eimsbüttel',
  VDF: 'Volksdorf',
  WDF: 'Walddörfer',
  WED: 'Wedel',
  WEI: 'Weiße Dame',
  WIC: 'Wichernschule',
};

const LEAGUE_CODES: Partial<Record<League, string>> = {
  Stadtliga: 's',
  Bezirksliga: 'a',
  Kreisliga: 'b',
  Kreisklasse: 'c',
  Basisklasse: 'd',
};

interface CachedPage {
  html: string;
  fetchedAt: number;
}

const pageCache = new Map<string, CachedPage>();

function toRoman(value: number): string {
  const numerals: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'],
    [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'],
    [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let remainder = value;
  let result = '';
  for (const [number, numeral] of numerals) {
    while (remainder >= number) {
      result += numeral;
      remainder -= number;
    }
  }
  return result;
}

export function getTeamResultsUrl(team: Team): { teamName: string; classCode: string; url: string } | null {
  const baseName = TEAM_LABELS[team.clubCode];
  const leagueCode = LEAGUE_CODES[team.league];
  const divisionLetter = team.division.trim().match(/^([A-Z])/i)?.[1]?.toLowerCase();
  if (!baseName || !leagueCode || !divisionLetter || !Number.isInteger(team.number) || team.number < 1) {
    return null;
  }

  const teamName = `${baseName} ${toRoman(team.number)}`;
  const classCode = `${leagueCode}${divisionLetter}`;
  const query = new URLSearchParams({ m: teamName, kl: classCode, j: String(SEASON), dwz: '1' });
  return {
    teamName,
    classCode,
    url: `${SOURCE_ROOT}/hmmeinzelspieler.php?${query.toString()}`,
  };
}

function normalizeRanking(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

export function parseTeamAppearances(html: string, ranking: string): { count: number; rounds: number[]; sourceDate: string | null } | null {
  const $ = cheerio.load(html);
  const rows = $('table tr');
  if (rows.length < 2) return null;

  const headerCells = rows.first().find('th,td');
  const summaryIndex = headerCells.toArray().findIndex((cell) => /\bGesamt\b/i.test($(cell).text()));
  if (summaryIndex <= 2) return null;
  const expectedRanking = normalizeRanking(ranking);

  for (const row of rows.slice(1).toArray()) {
    const cells = $(row).find('th,td');
    if (normalizeRanking($(cells[0]).text()) !== expectedRanking) continue;
    const roundCells = cells.slice(2, summaryIndex).toArray();
    const rounds = roundCells
      .map((cell, index) => ({ played: $(cell).text().replace(/\u00a0/g, ' ').trim().length > 0, round: index + 1 }))
      .filter(({ played }) => played)
      .map(({ round }) => round);
    const text = $('body').text().replace(/\s+/g, ' ');
    const dates = [...text.matchAll(/\bStand:\s*(\d{2}\.\d{2}\.\d{4})/g)];
    return { count: rounds.length, rounds, sourceDate: dates.at(-1)?.[1] ?? null };
  }
  return null;
}

function unavailable(team: Team, teamName: string, sourceUrl: string | null, error: string): TeamAppearance {
  return {
    teamNumber: team.number,
    teamName,
    count: null,
    rounds: [],
    sourceUrl,
    sourceDate: null,
    error,
  };
}

export async function fetchTeamAppearances(team: Team, ranking: string): Promise<TeamAppearance> {
  const query = getTeamResultsUrl(team);
  if (!query) {
    return unavailable(team, `Mannschaft ${team.number}`, null, 'Die Mannschaft konnte keiner offiziellen HMM-Ergebnisseite zugeordnet werden.');
  }

  const cacheKey = `${query.classCode}:${query.teamName}`;
  let cached = pageCache.get(cacheKey);
  let usedStaleCache = false;
  if (!cached || Date.now() - cached.fetchedAt >= PAGE_CACHE_TTL_MS) {
    try {
      const response = await fetch(query.url, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if (html.trim().length < 100) throw new Error('Die Ergebnisseite enthält keine Spielerdaten.');
      cached = { html, fetchedAt: Date.now() };
      pageCache.set(cacheKey, cached);
    } catch {
      if (!cached) {
        return unavailable(team, query.teamName, query.url, 'Die offiziellen Einzelergebnisse sind derzeit nicht erreichbar.');
      }
      usedStaleCache = true;
    }
  }

  const parsed = parseTeamAppearances(cached.html, ranking);
  if (!parsed) {
    return unavailable(team, query.teamName, query.url, 'Für diese Ranglistennummer wurde auf der Mannschaftsseite kein Spielergebnis gefunden.');
  }

  return {
    teamNumber: team.number,
    teamName: query.teamName,
    count: parsed.count,
    rounds: parsed.rounds,
    sourceUrl: query.url,
    sourceDate: parsed.sourceDate,
    error: usedStaleCache ? 'Die HMM-Seite war nicht erreichbar; angezeigt werden zwischengespeicherte Ergebnisse.' : null,
  };
}
