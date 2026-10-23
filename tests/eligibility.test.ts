import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEligibility } from '../server/eligibility';
import { parseRankingPage } from '../server/scraper';
import type { RankingData } from '../shared/types';

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
    context: { confirmed: true, higherAppearances: 0, substituteAppearances: 3, landesligaTotal: 0, sameRoundHigher: false, sameWeekendHigher: false, parallelTeamUsed: false, latePermitConfirmed: false },
  });
  assert.equal(result?.verdict, 'ineligible');
  assert.ok(result?.checks.some((item) => item.paragraph === '§15' && item.status === 'fail'));
});

test('marks one remaining substitute appearance as restricted', () => {
  const result = evaluateEligibility(fixture, {
    clubCode: 'STP', ranking: '21', targetLeague: 'Kreisliga', targetTeam: 2,
    context: { confirmed: true, higherAppearances: 0, substituteAppearances: 2, landesligaTotal: 0, sameRoundHigher: false, sameWeekendHigher: false, parallelTeamUsed: false, latePermitConfirmed: false },
  });
  assert.equal(result?.verdict, 'conditional');
  assert.equal(result?.remainingSubstitutions, 1);
  assert.match(result?.explanation ?? '', /höchstens einmal/);
});

test('respects the Landesliga a-number exclusion', () => {
  const result = evaluateEligibility(fixture, { clubCode: 'STP', ranking: '12A', targetLeague: 'Landesliga' });
  assert.equal(result?.verdict, 'ineligible');
  assert.ok(result?.checks.some((item) => item.paragraph === '§16' && item.status === 'fail'));
});

test('does not infer Landesliga ineligibility when the source omits its teams', () => {
  const result = evaluateEligibility(fixture, {
    clubCode: 'STP', ranking: '11', targetLeague: 'Landesliga',
    context: { confirmed: true, higherAppearances: 0, substituteAppearances: 0, landesligaTotal: 0, sameRoundHigher: false, sameWeekendHigher: false, parallelTeamUsed: false, latePermitConfirmed: false },
  });
  assert.equal(result?.verdict, 'conditional');
  assert.ok(result?.checks.some((item) => item.paragraph === '§13' && item.status === 'unknown'));
});

test('returns null when a roster number is missing', () => {
  assert.equal(evaluateEligibility(fixture, { clubCode: 'STP', ranking: '999', targetLeague: 'Kreisliga' }), null);
});

test('parses team assignments and suffix ranks from legacy-encoded HMM HTML', () => {
  const html = `<html><body><p><small>Stand: 19. Juni 2026</small></p><div><a id="STP"></a><pre>
STP 1 Landesliga ADi
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
