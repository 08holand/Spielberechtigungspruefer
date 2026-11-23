import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEligibility } from '../server/eligibility';
import { parseRankingPage } from '../server/scraper';
import { LEAGUES, type RankingData, type TeamAppearanceHistory } from '../shared/types';

const fixture: RankingData = {
  fetchedAt: '2026-10-23T10:00:00.000Z',
  sourceDate: '19. Juni 2026',
  sourceUrl: 'https://example.test',
  sourceClubCount: 1,
  teams: [
    { clubCode: 'STP', number: 2, league: 'Kreisliga', division: 'ADi' },
    { clubCode: 'STP', number: 3, league: 'Kreisklasse', division: 'BMi' },
  ],
  players: [
    { clubCode: 'STP', ranking: '11', name: 'Mara Test', teamNumber: 2, league: 'Kreisliga', reserve: false, lateRegistration: false, inactive: false, rating: 1500 },
    { clubCode: 'STP', ranking: '21', name: 'Timo Reserve', teamNumber: 3, league: 'Kreisklasse', reserve: false, lateRegistration: false, inactive: false, rating: null },
    { clubCode: 'STP', ranking: '31', name: 'Rita Reserve', teamNumber: null, league: null, reserve: true, lateRegistration: false, inactive: false, rating: null },
    { clubCode: 'STP', ranking: '12a', name: 'Anna Nachmeldung', teamNumber: 2, league: 'Kreisliga', reserve: false, lateRegistration: true, inactive: false, rating: null },
  ],
};

test('distinguishes roster eligibility from incomplete appearance history', () => {
  const result = evaluateEligibility(fixture, { clubCode: 'STP', ranking: '11', targetLeague: 'Kreisliga', targetTeam: 2 });
  assert.equal(result?.verdict, 'conditional');
  assert.ok(result?.checks.some((item) => item.paragraph === '§13' && item.status === 'pass'));
  assert.ok(result?.checks.some((item) => item.status === 'unknown'));
});

test('blocks a fourth reported substitute appearance', () => {
  const result = evaluateEligibility(fixture, {
    clubCode: 'STP', ranking: '21', targetLeague: 'Kreisliga', targetTeam: 2,
    context: { confirmed: true, higherAppearances: 0, substituteAppearances: 3, sameRoundHigher: false, sameWeekendHigher: false, parallelTeamUsed: false, latePermitConfirmed: false },
  });
  assert.equal(result?.verdict, 'ineligible');
  assert.ok(result?.checks.some((item) => item.paragraph === '§15' && item.status === 'fail'));
});

test('marks one remaining substitute appearance as restricted', () => {
  const result = evaluateEligibility(fixture, {
    clubCode: 'STP', ranking: '21', targetLeague: 'Kreisliga', targetTeam: 2,
    context: { confirmed: true, higherAppearances: 0, substituteAppearances: 2, sameRoundHigher: false, sameWeekendHigher: false, parallelTeamUsed: false, latePermitConfirmed: false },
  });
  assert.equal(result?.verdict, 'conditional');
  assert.equal(result?.remainingSubstitutions, 1);
  assert.match(result?.explanation ?? '', /höchstens einmal/);
});

test('returns null when a roster number is missing', () => {
  assert.equal(evaluateEligibility(fixture, { clubCode: 'STP', ranking: '999', targetLeague: 'Kreisliga' }), null);
});

test('parses team assignments and suffix ranks from legacy-encoded HMM HTML', () => {
  const html = `<html><body><p><small>Stand: 19. Juni 2026</small></p><div><a id="STP"></a><pre>
 STP 1 Stadtliga ADi
  1Müller, Anna                1800 - 100
</pre><pre>
STP 2 Kreisliga BDi
  11Meier, Jörg                 1500 - 10
  12aTest, Alex
</pre><pre>Reserveliste
  31Klein, Max
</pre></div></body></html>`;
  const parsed = parseRankingPage(html);
  assert.equal(parsed.teams.length, 2);
  assert.equal(parsed.players.find((player) => player.ranking === '12a')?.lateRegistration, true);
  assert.equal(parsed.players.find((player) => player.ranking === '31')?.reserve, true);
  assert.equal(parsed.players[0].name, 'Müller, Anna');
});

function appearanceHistory(rounds: number[], complete = true): TeamAppearanceHistory {
  return {
    assignments: rounds.map((round) => ({
      round,
      teamNumber: 2,
      teamName: 'FC St. Pauli II',
      league: 'Kreisliga',
    })),
    teams: [],
    checkedTeams: 2,
    availableTeams: complete ? 2 : 1,
    complete,
    unavailableTeams: complete ? [] : ['FC St. Pauli III'],
    sourceDate: '24.06.2026',
  };
}

test('uses team history to block a fourth substitute appearance', () => {
  const result = evaluateEligibility(
    fixture,
    { clubCode: 'STP', ranking: '21', targetLeague: 'Kreisliga', targetTeam: 2 },
    appearanceHistory([1, 3, 5]),
  );
  assert.equal(result?.verdict, 'ineligible');
  assert.equal(result?.remainingSubstitutions, 0);
  assert.ok(result?.checks.some((item) => item.paragraph === '§15' && item.status === 'fail'));
});

test('uses team history to report remaining substitute appearances', () => {
  const result = evaluateEligibility(
    fixture,
    { clubCode: 'STP', ranking: '21', targetLeague: 'Kreisliga', targetTeam: 2 },
    appearanceHistory([1, 3]),
  );
  assert.equal(result?.verdict, 'conditional');
  assert.equal(result?.remainingSubstitutions, 1);
  assert.ok(result?.checks.some((item) => item.paragraph === '§15' && item.status === 'pass'));
});

test('keeps §15 unknown when not all team pages could be checked', () => {
  const result = evaluateEligibility(
    fixture,
    { clubCode: 'STP', ranking: '21', targetLeague: 'Kreisliga', targetTeam: 2 },
    appearanceHistory([1], false),
  );
  assert.ok(result?.checks.some((item) => item.paragraph === '§15' && item.status === 'unknown'));
  assert.ok(result?.warnings.some((warning) => warning.includes('unvollständig')));
});

test('exposes only supported HMM target leagues', () => {
  assert.deepEqual(LEAGUES, ['Stadtliga', 'Bezirksliga', 'Kreisliga', 'Kreisklasse', 'Basisklasse']);
});

test('uses round assignments to detect another team in the same target league', () => {
  const history = appearanceHistory([2]);
  history.assignments[0] = {
    round: 2,
    teamNumber: 4,
    teamName: 'FC St. Pauli IV',
    league: 'Kreisliga',
  };
  const result = evaluateEligibility(
    fixture,
    { clubCode: 'STP', ranking: '11', targetLeague: 'Kreisliga', targetTeam: 2 },
    history,
  );
  assert.equal(result?.verdict, 'ineligible');
  assert.ok(result?.checks.some((item) => item.paragraph === '§15' && item.status === 'fail'));
});
