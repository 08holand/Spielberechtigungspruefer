import * as cheerio from 'cheerio';
import { CLUBS } from '../shared/clubs';
import { LEAGUES, type League, type Player, type RankingData, type Team } from '../shared/types';

export const SOURCE_URL = 'https://www.hamburger-schachverband.de/hmm2026/hmm2026_ranglisten.htm';

const leaguePattern = new RegExp(`(${LEAGUES.join('|')})`, 'i');

export function parseRankingPage(html: string, fetchedAt = new Date().toISOString()): RankingData {
  const $ = cheerio.load(html);
  const players: Player[] = [];
  const teams: Team[] = [];
  const knownCodes = new Set(CLUBS.map(({ code }) => code));

  $('a[id]').each((_, element) => {
    const clubCode = $(element).attr('id')?.toUpperCase();
    if (!clubCode || !knownCodes.has(clubCode)) return;
    const section = $(element).closest('div');
    let currentTeam: Team | null = null;
    let reserveList = false;

    section.find('pre').each((_, pre) => {
      const lines = $(pre).text().split(/\r?\n/).map((line) => line.replace(/\u00a0/g, ' '));
      for (const line of lines) {
        if (/Reserveliste/i.test(line)) {
          reserveList = true;
          currentTeam = null;
          continue;
        }

        const teamMatch = line.match(/^\s*([A-Z]{3})\s+(\d+)\s+(.+)$/);
        const foundLeague = line.match(leaguePattern);
        if (teamMatch?.[1] === clubCode && foundLeague) {
          const league = LEAGUES.find((item) => item.toLowerCase() === foundLeague[1].toLowerCase()) as League;
          const leagueIndex = teamMatch[3].toLowerCase().indexOf(foundLeague[1].toLowerCase());
          currentTeam = {
            clubCode,
            number: Number(teamMatch[2]),
            league,
            division: teamMatch[3].slice(leagueIndex + foundLeague[1].length).trim(),
          };
          teams.push(currentTeam);
          reserveList = false;
          continue;
        }

        const playerMatch = line.match(/^\s*(\d{1,3})(a?)\s*(.+?)\s*$/);
        if (!playerMatch) continue;
        const ranking = `${playerMatch[1]}${playerMatch[2]}`;
        let nameAndRating = playerMatch[3].trim();
        const ratingMatch = nameAndRating.match(/\s{2,}(\d+)\s+-/);
        let rating: number | null = null;
        if (ratingMatch?.index !== undefined) {
          rating = Number(ratingMatch[1]);
          nameAndRating = nameAndRating.slice(0, ratingMatch.index).trim();
        }
        if (!nameAndRating || /^\d{4,}$/.test(nameAndRating)) continue;

        players.push({
          clubCode,
          ranking,
          name: nameAndRating,
          teamNumber: currentTeam?.number ?? null,
          league: currentTeam?.league ?? null,
          reserve: reserveList || !currentTeam,
          lateRegistration: playerMatch[2] === 'a',
          inactive: false,
          rating,
        });
      }
    });
  });

  const sourceDate = $('small').toArray()
    .map((el) => $(el).text().trim())
    .find((value) => /Stand:/i.test(value))
    ?.replace(/^Stand:\s*/i, '') ?? null;

  if (players.length === 0 || teams.length === 0) {
    throw new Error('Die HMM-Ranglistenseite konnte nicht gelesen werden. Das Format der Quelle könnte sich geändert haben.');
  }

  return {
    players,
    teams: teams.sort((a, b) => a.clubCode.localeCompare(b.clubCode) || a.number - b.number),
    fetchedAt,
    sourceDate,
    sourceUrl: SOURCE_URL,
    sourceClubCount: new Set(teams.map(({ clubCode }) => clubCode)).size,
  };
}

export async function fetchRankingData(): Promise<RankingData> {
  const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Der HMM-Server antwortet mit HTTP ${response.status}.`);
  const bytes = await response.arrayBuffer();
  // The federation page is served in the legacy Windows-1252 encoding.
  const html = new TextDecoder('windows-1252').decode(bytes);
  return parseRankingPage(html);
}
