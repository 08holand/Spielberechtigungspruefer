import express from 'express';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import { CLUBS } from '../shared/clubs';
import { LEAGUES, type DataStatus, type RankingData } from '../shared/types';
import { evaluateEligibility } from './eligibility';
import { fetchRankingData, SOURCE_URL } from './scraper';

const app = express();
const port = Number(process.env.PORT) || 5000;
const production = process.env.NODE_ENV === 'production';
const leagueSchema = z.enum(LEAGUES);
let cache: RankingData | null = JSON.parse(
  readFileSync(new URL('./data/hmm2026-seed.json', import.meta.url), 'utf8'),
) as RankingData;
let sourceMode: DataStatus['sourceMode'] = 'bundled';
let refreshError: string | null = null;
let refreshPromise: Promise<RankingData> | null = null;

app.use(express.json({ limit: '20kb' }));

function status(): DataStatus {
  return {
    available: cache !== null,
    sourceMode,
    fetchedAt: cache?.fetchedAt ?? null,
    sourceDate: cache?.sourceDate ?? null,
    playerCount: cache?.players.length ?? 0,
    teamCount: cache?.teams.length ?? 0,
    sourceClubCount: cache?.sourceClubCount ?? 0,
    sourceUrl: SOURCE_URL,
    warnings: [
      sourceMode === 'bundled'
        ? 'Offline-Kopie der HMM-Rangliste, Quellenstand 19. Juni 2026. Die Live-Aktualisierung ist derzeit nicht erreichbar.'
        : 'Die Rangliste ist auf dem Stand vom 19. Juni 2026 und enthält keine Spielberichte oder Einsatzhistorien.',
      'Die Rangliste enthält keine Spielberichte oder Einsatzhistorien.',
      'Landesliga- und überregionale Mannschaftsaufstellungen sind in der Quelle nicht enthalten.',
    ],
    error: refreshError,
  };
}

async function refresh(): Promise<RankingData> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetchRankingData()
    .then((data) => {
      cache = data;
      sourceMode = 'live';
      refreshError = null;
      return data;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : '';
      refreshError = message.includes('fetch failed') || message.includes('ECONNREFUSED')
        ? 'Der Live-Abruf ist derzeit nicht erreichbar. Die lokale HMM-Rangliste steht weiterhin zur Verfügung.'
        : message || 'Die Ranglistendaten konnten nicht geladen werden.';
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/clubs', (_req, res) => res.json(CLUBS));
app.get('/api/data/status', (_req, res) => res.json(status()));
app.get('/api/data/teams', (req, res) => {
  const clubCode = String(req.query.clubCode ?? '').toUpperCase();
  if (!CLUBS.some(({ code }) => code === clubCode)) {
    res.status(400).json({ error: 'Bitte wähle einen gültigen Verein aus.' });
    return;
  }
  res.json(cache?.teams.filter((team) => team.clubCode === clubCode) ?? []);
});

app.post('/api/data/refresh', async (_req, res) => {
  try {
    await refresh();
    res.json(status());
  } catch {
    res.status(cache ? 200 : 502).json({ ...status(), error: refreshError ?? 'Die Rangliste konnte nicht abgerufen werden.' });
  }
});

const requestSchema = z.object({
  clubCode: z.string().length(3),
  ranking: z.string().trim().min(1).max(6).regex(/^\d{1,3}\s*[aA]?$/),
  targetLeague: leagueSchema,
  targetTeam: z.number().int().positive().optional(),
  context: z.object({
    confirmed: z.boolean(),
    higherAppearances: z.number().int().min(0).max(20),
    substituteAppearances: z.number().int().min(0).max(20),
    landesligaTotal: z.number().int().min(0).max(30),
    sameRoundHigher: z.boolean(),
    sameWeekendHigher: z.boolean(),
    parallelTeamUsed: z.boolean(),
    latePermitConfirmed: z.boolean(),
  }).optional(),
});

app.post('/api/check', (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success || !CLUBS.some(({ code }) => code === parsed.data?.clubCode)) {
    res.status(400).json({ error: 'Bitte prüfe Ranglistennummer, Verein und Liga.' });
    return;
  }
  if (!cache) {
    res.status(503).json({ error: refreshError
      ? `Die Rangliste ist derzeit nicht verfügbar: ${refreshError}`
      : 'Die Rangliste wird noch geladen. Bitte versuche es gleich erneut.' });
    return;
  }
  const result = evaluateEligibility(cache, parsed.data);
  if (!result) {
    res.status(404).json({ error: `Ranglistennummer ${parsed.data.ranking} wurde beim gewählten Verein nicht gefunden.` });
    return;
  }
  res.json(result);
});

if (!production) {
  const vite = await createViteServer({ server: { middlewareMode: true, allowedHosts: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  app.use(express.static('dist'));
  app.get('*', (_req, res) => res.sendFile('index.html', { root: 'dist' }));
}

app.listen(port, '0.0.0.0', () => {
  console.log(`HMM Check läuft auf Port ${port}.`);
  void refresh().catch((error) => console.error('Ranglisten-Refresh fehlgeschlagen:', error));
});
