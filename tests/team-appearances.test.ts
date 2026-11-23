import test from 'node:test';
import assert from 'node:assert/strict';
import type { Team } from '../shared/types';
import { getTeamResultsUrl, parseTeamAppearances } from '../server/team-appearances';

test('maps a roster team to the federation individual-results page', () => {
  const team: Team = { clubCode: 'STP', number: 6, league: 'Bezirksliga', division: 'DDi' };
  const result = getTeamResultsUrl(team);
  assert.ok(result);
  assert.equal(result.teamName, 'FC St. Pauli VI');
  assert.equal(result.classCode, 'ad');
  assert.match(result.url, /hmmeinzelspieler\.php\?/);
  assert.match(result.url, /m=FC\+St\.\+Pauli\+VI/);
});

test('counts only populated round cells, not totals or rating columns', () => {
  const html = `<html><body><p>Stand: 24.06.2026</p><table>
    <tr><td>Nr.</td><td>Name / Runde</td><td>1 VDF</td><td>2 SFR</td><td>3 BBK</td><td>Gesamt</td><td>DWZ Neu</td></tr>
    <tr><td>51</td><td>Schüttler, Thomas</td><td>½ (1875-95)</td><td></td><td>0 (1829-103)</td><td>0.5 (2)</td><td>1828 - 110</td></tr>
    <tr><td>52</td><td>Hefter, Thomas</td><td></td><td></td><td></td><td>0 (0)</td><td>1827 - 50</td></tr>
  </table></body></html>`;

  assert.deepEqual(parseTeamAppearances(html, '51'), {
    count: 2,
    rounds: [1, 3],
    sourceDate: '24.06.2026',
  });
  assert.deepEqual(parseTeamAppearances(html, '52'), {
    count: 0,
    rounds: [],
    sourceDate: '24.06.2026',
  });
});

test('reports zero only when a valid results table omits the player', () => {
  const html = `<table>
    <tr><td>Nr.</td><td>Name / Runde</td><td>1 VDF</td><td>Gesamt</td></tr>
    <tr><td>51</td><td>Schüttler, Thomas</td><td>½</td><td>0.5 (1)</td></tr>
  </table>`;
  assert.deepEqual(parseTeamAppearances(html, '999'), {
    count: 0,
    rounds: [],
    sourceDate: null,
  });
  assert.equal(parseTeamAppearances('\r\n\r\n', '999'), null);
});
