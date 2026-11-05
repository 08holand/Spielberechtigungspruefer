import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleHelp,
  CircleX,
  Clock3,
  Database,
  ExternalLink,
  FileCheck2,
  Hash,
  Info,
  Layers3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { LEAGUES, type AppearanceContext, type Club, type DataStatus, type EligibilityResult, type League, type RuleCheck, type Team } from '../shared/types';

const DEFAULT_CLUB = 'STP';
const RANK_PATTERN = /^\d+[a-z]?$/i;

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : `Anfrage fehlgeschlagen (${response.status}).`);
  }
  return payload as T;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Noch nicht verfügbar';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function RuleStatusIcon({ status }: { status: RuleCheck['status'] }) {
  if (status === 'pass') return <Check size={14} aria-hidden="true" />;
  if (status === 'fail') return <CircleX size={14} aria-hidden="true" />;
  return <CircleHelp size={14} aria-hidden="true" />;
}

function ResultCard({ result }: { result: EligibilityResult }) {
  const hasUnknown = result.checks.some((check) => check.status === 'unknown');
  const displayVerdict = result.verdict === 'eligible'
    ? 'Spielberechtigt'
    : result.verdict === 'ineligible'
      ? 'Nicht spielberechtigt'
      : hasUnknown
        ? 'Noch nicht abschließend geprüft'
        : 'Eingeschränkt spielberechtigt';
  const panelClass = result.verdict === 'eligible' ? 'eligible' : result.verdict === 'ineligible' ? 'ineligible' : 'conditional';
  const VerdictIcon = result.verdict === 'eligible' ? BadgeCheck : result.verdict === 'ineligible' ? CircleX : hasUnknown ? CircleHelp : AlertTriangle;
  const player = result.player;
  const target = result.targetTeam;

  return (
    <section className={`panel result-panel ${panelClass}`} aria-live="polite" aria-labelledby="result-title">
      <div className="result-top">
        <div className="verdict-mark"><VerdictIcon size={23} strokeWidth={1.8} aria-hidden="true" /></div>
        <div>
          <p className="result-kicker">Ergebnis der Prüfung</p>
          <h2 className="result-title" id="result-title">{displayVerdict}</h2>
          <p className="result-summary">{result.explanation}</p>
        </div>
        <div className="result-meta">Datenstand<br />{formatDate(result.fetchedAt)}</div>
      </div>
      <div className="result-body">
        <div className="player-summary">
          <div className="player-label">Geprüfte Person</div>
          <div className="player-name">{player.name}</div>
          <div className="player-details">
            <div className="player-line"><span>Ranglistennummer</span><strong>{player.ranking}</strong></div>
            <div className="player-line"><span>Verein</span><strong>{player.clubCode}</strong></div>
            <div className="player-line"><span>Ranglisten-Team</span><strong>{player.teamNumber ? `Mannschaft ${player.teamNumber}` : 'Nicht zugeordnet'}</strong></div>
            {target && <div className="player-line"><span>Zielmannschaft</span><strong>{target.number}. · {target.league}</strong></div>}
            {result.teamAppearances && (
              <div className="team-appearance">
                <div className="player-line">
                  <span>Einsätze in {result.teamAppearances.teamName}</span>
                  <strong>{result.teamAppearances.count === null ? 'Nicht verfügbar' : result.teamAppearances.count}</strong>
                </div>
                {result.teamAppearances.count !== null && (
                  <div className="appearance-rounds">
                    {result.teamAppearances.rounds.length
                      ? `Gespielt in Runde ${result.teamAppearances.rounds.join(', ')}`
                      : 'Keine gespielten Runden gefunden'}
                    {result.teamAppearances.sourceDate ? ` · Datenstand ${result.teamAppearances.sourceDate}` : ''}
                  </div>
                )}
                {result.teamAppearances.error && <div className="appearance-error">{result.teamAppearances.error}</div>}
                {result.teamAppearances.sourceUrl && (
                  <a className="appearance-source" href={result.teamAppearances.sourceUrl} target="_blank" rel="noreferrer">
                    Offizielle HMM-Einzelergebnisse öffnen
                  </a>
                )}
              </div>
            )}
            {result.remainingSubstitutions !== null && (
              <div className="player-line"><span>Verbleibende Ersatzeinsätze</span><strong>{result.remainingSubstitutions}</strong></div>
            )}
          </div>
        </div>
        <div>
          <div className="checks-heading">Geprüfte Regeln <span>{result.checks.length} Prüfpunkte</span></div>
          <div className="checks-list">
            {result.checks.map((check, index) => (
              <div className={`rule-check ${check.status}`} key={`${check.paragraph}-${index}`}>
                <div className="check-icon"><RuleStatusIcon status={check.status} /></div>
                <div className="rule-copy">
                  <div className="rule-name">{check.title}<span className="rule-paragraph">{check.paragraph}</span></div>
                  <div className="rule-detail">{check.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {result.warnings.length > 0 && (
        <div className="result-warning">
          <strong>Bitte beachten:</strong> {result.warnings.join(' ')}
        </div>
      )}
    </section>
  );
}

function App() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [selectedClub, setSelectedClub] = useState(DEFAULT_CLUB);
  const [targetLeague, setTargetLeague] = useState<League>('Stadtliga');
  const [targetTeam, setTargetTeam] = useState('');
  const [ranking, setRanking] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [teamsError, setTeamsError] = useState('');
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyConfirmed, setHistoryConfirmed] = useState(false);
  const [higherAppearances, setHigherAppearances] = useState(0);
  const [substituteAppearances, setSubstituteAppearances] = useState(0);
  const [landesligaTotal, setLandesligaTotal] = useState(0);
  const [sameRoundHigher, setSameRoundHigher] = useState(false);
  const [sameWeekendHigher, setSameWeekendHigher] = useState(false);
  const [parallelTeamUsed, setParallelTeamUsed] = useState(false);
  const [latePermitConfirmed, setLatePermitConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.allSettled([
      apiRequest<Club[]>('/api/clubs'),
      apiRequest<DataStatus>('/api/data/status'),
    ]).then(([clubResponse, statusResponse]) => {
      if (!active) return;
      const errors: string[] = [];
      if (clubResponse.status === 'fulfilled') setClubs(clubResponse.value);
      else errors.push(clubResponse.reason instanceof Error ? clubResponse.reason.message : 'Vereinsliste nicht verfügbar.');
      if (statusResponse.status === 'fulfilled') setDataStatus(statusResponse.value);
      else errors.push(statusResponse.reason instanceof Error ? statusResponse.reason.message : 'Datenstatus nicht verfügbar.');
      setLoadError(errors.join(' '));
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setTeams([]);
    setTargetTeam('');
    setTeamsError('');
    if (!selectedClub) return () => { active = false; };
    setIsLoadingTeams(true);
    apiRequest<Team[]>(`/api/data/teams?clubCode=${encodeURIComponent(selectedClub)}`).then((teamData) => {
      if (!active) return;
      setTeams(teamData);
    }).catch((error: unknown) => {
      if (!active) return;
      setTeamsError(error instanceof Error ? error.message : 'Mannschaftsdaten konnten nicht geladen werden.');
    }).finally(() => {
      if (active) setIsLoadingTeams(false);
    });
    return () => { active = false; };
  }, [selectedClub]);

  const matchingTeams = useMemo(
    () => teams.filter((team) => team.league === targetLeague).sort((a, b) => a.number - b.number),
    [teams, targetLeague],
  );
  const selectedClubName = clubs.find((club) => club.code === selectedClub)?.name ?? selectedClub;

  async function handleRefresh() {
    setIsRefreshing(true);
    setLoadError('');
    try {
      const status = await apiRequest<DataStatus>('/api/data/refresh', { method: 'POST' });
      setDataStatus(status);
      setResult(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Die Daten konnten nicht aktualisiert werden.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setResult(null);
    const normalizedRanking = ranking.trim();
    if (!selectedClub) {
      setFormError('Bitte wählen Sie einen Verein aus.');
      return;
    }
    if (!RANK_PATTERN.test(normalizedRanking)) {
      setFormError('Bitte geben Sie eine Ranglistennummer ein, zum Beispiel 8 oder 2a.');
      return;
    }
    if (!LEAGUES.includes(targetLeague)) {
      setFormError('Bitte wählen Sie eine gültige Liga aus.');
      return;
    }
    const hasHistoryData = historyConfirmed || higherAppearances > 0 || substituteAppearances > 0 || landesligaTotal > 0
      || sameRoundHigher || sameWeekendHigher || parallelTeamUsed || latePermitConfirmed;
    const context: AppearanceContext | undefined = hasHistoryData ? {
      confirmed: historyConfirmed,
      higherAppearances,
      substituteAppearances,
      landesligaTotal,
      sameRoundHigher,
      sameWeekendHigher,
      parallelTeamUsed,
      latePermitConfirmed,
    } : undefined;
    const selectedNumber = targetTeam ? Number(targetTeam) : undefined;
    setIsChecking(true);
    try {
      const checked = await apiRequest<EligibilityResult>('/api/check', {
        method: 'POST',
        body: JSON.stringify({
          clubCode: selectedClub,
          ranking: normalizedRanking,
          targetLeague,
          ...(selectedNumber !== undefined ? { targetTeam: selectedNumber } : {}),
          ...(context ? { context } : {}),
        }),
      });
      setResult(checked);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Die Prüfung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.');
    } finally {
      setIsChecking(false);
    }
  }

  const available = Boolean(dataStatus?.available);
  const dataWarningCount = dataStatus?.warnings.length ?? 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Layers3 size={18} strokeWidth={1.7} aria-hidden="true" /></div>
          <span>Hamburger Schachverband</span>
        </div>
        <div className="topbar-meta"><span className="meta-dot" /> <span>HMM 2026</span><span>· Spielberechtigung</span></div>
      </header>

      <main className="page-wrap">
        <section className="intro">
          <div>
            <p className="eyebrow">Mannschaftsmeisterschaft · Spielbetrieb</p>
            <h1>Wer darf<br />ans Brett?</h1>
            <p className="intro-copy">Prüfen Sie die Spielberechtigung eines Spielers für die HMM 2026. Wir zeigen, was die Rangliste belegt — und was noch bestätigt werden muss.</p>
          </div>
          <div className="season-stamp" aria-label="Saison HMM 2026">
            <span className="stamp-small">Hamburger</span>
            <span className="stamp-year">HMM</span>
            <span className="stamp-lower">SAISON · 2026</span>
          </div>
        </section>

        <div className="content-grid">
          <section className="panel form-panel" aria-labelledby="checker-title">
            <div className="panel-heading">
              <div>
                <h2 id="checker-title">Spieler prüfen</h2>
                <p>Verein, Ranglistenplatz und Einsatzliga eingeben.</p>
              </div>
              <span className="step-mark"><ShieldCheck size={13} aria-hidden="true" /> §13–§16</span>
            </div>

            {isLoading ? (
              <div className="initial-loading" aria-label="Daten werden geladen">
                <div className="skeleton skeleton-line" style={{ width: '24%' }} />
                <div className="skeleton skeleton-field" />
                <div className="skeleton skeleton-line" style={{ width: '30%' }} />
                <div className="skeleton skeleton-field" />
                <div className="skeleton skeleton-line" style={{ width: '22%' }} />
                <div className="skeleton skeleton-field" />
                <div className="skeleton skeleton-button" />
              </div>
            ) : (
              <form className="form-body" onSubmit={handleSubmit} noValidate>
                <div className="form-grid">
                  <div className="field full">
                    <label className="field-label" htmlFor="club"><Users size={14} aria-hidden="true" /> Verein <span className="required">Pflichtfeld</span></label>
                    <div className="input-wrap">
                      <select id="club" className="control select-control" value={selectedClub} onChange={(event) => { setSelectedClub(event.target.value); setResult(null); }} disabled={clubs.length === 0}>
                        {clubs.length === 0 && <option value="">Vereine nicht verfügbar</option>}
                        {clubs.map((club) => <option key={club.code} value={club.code}>{club.code} — {club.name}</option>)}
                      </select>
                      <ChevronDown className="select-chevron" size={15} aria-hidden="true" />
                    </div>
                    <span className="field-hint">{selectedClubName}</span>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="ranking"><Hash size={14} aria-hidden="true" /> Ranglistennummer <span className="required">Pflichtfeld</span></label>
                    <div className="input-wrap">
                      <input id="ranking" className="control rank-input" value={ranking} onChange={(event) => { setRanking(event.target.value); setResult(null); }} placeholder="z. B. 8 oder 2a" autoComplete="off" inputMode="text" aria-describedby="rank-hint" maxLength={8} />
                    </div>
                    <span className="field-hint" id="rank-hint">Nummer laut aktueller Vereinsrangliste.</span>
                    {ranking.toLowerCase().endsWith('a') && <span className="rank-note"><Info size={12} aria-hidden="true" /> Nachmeldung — Sonderregel §16</span>}
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="league"><Activity size={14} aria-hidden="true" /> Ziel-Liga <span className="required">Pflichtfeld</span></label>
                    <div className="input-wrap">
                      <select id="league" className="control select-control" value={targetLeague} onChange={(event) => { setTargetLeague(event.target.value as League); setTargetTeam(''); setResult(null); }}>
                        {LEAGUES.map((league) => <option key={league} value={league}>{league}</option>)}
                      </select>
                      <ChevronDown className="select-chevron" size={15} aria-hidden="true" />
                    </div>
                    <span className="field-hint">Liga, in der der Spieler eingesetzt werden soll.</span>
                  </div>

                  <div className="field full">
                    <label className="field-label" htmlFor="team"><Layers3 size={14} aria-hidden="true" /> Zielmannschaft <span className="field-hint">optional</span></label>
                    <div className="input-wrap">
                      <select id="team" className="control select-control" value={targetTeam} onChange={(event) => { setTargetTeam(event.target.value); setResult(null); }} disabled={isLoadingTeams || matchingTeams.length === 0}>
                        <option value="">{isLoadingTeams ? 'Mannschaften werden geladen …' : matchingTeams.length ? 'Keine bestimmte Mannschaft' : 'Keine Mannschaft in dieser Liga gefunden'}</option>
                        {matchingTeams.map((team) => <option key={`${team.number}-${team.division}`} value={team.number}>Mannschaft {team.number} · {team.league} · {team.division}</option>)}
                      </select>
                      <ChevronDown className="select-chevron" size={15} aria-hidden="true" />
                    </div>
                    <span className="field-hint">{teamsError ? `Mannschaftsliste nicht verfügbar: ${teamsError}` : 'Nur nötig, wenn die Prüfung für ein bestimmtes Team erfolgen soll.'}</span>
                  </div>

                  <div className="divider" />
                  <button className="details-toggle" type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>
                    <span>
                      <span className="details-title"><Clock3 size={16} aria-hidden="true" /> Einsatzhistorie ergänzen</span>
                      <span className="details-subtitle">Optional · für Regeln zu Ersatz- und Höherklasseneinsätzen</span>
                    </span>
                    <ChevronDown size={17} className={`chevron-rotate ${historyOpen ? 'open' : ''}`} aria-hidden="true" />
                  </button>

                  {historyOpen && (
                    <div className="history-fields">
                      <p className="history-intro"><Info size={14} aria-hidden="true" /> Diese Angaben stammen nicht zwingend aus der Rangliste. Nur ergänzen, wenn die Einsätze bekannt sind.</p>
                      <label className="confirm-row">
                        <input type="checkbox" checked={historyConfirmed} onChange={(event) => setHistoryConfirmed(event.target.checked)} />
                        <span className="confirm-copy"><strong>Meine Angaben sind vollständig und bestätigt</strong><span>Ohne Bestätigung behandelt die Prüfung diese Angaben als unsicher.</span></span>
                      </label>
                      <div className="history-grid">
                        <div className="history-number">
                          <label htmlFor="higher-appearances">Einsätze in höheren Ligen</label>
                          <input id="higher-appearances" className="small-number" type="number" min="0" max="99" value={higherAppearances} onChange={(event) => setHigherAppearances(Math.max(0, Number(event.target.value)))} />
                        </div>
                        <div className="history-number">
                          <label htmlFor="substitute-appearances">Davon als Ersatzspieler</label>
                          <input id="substitute-appearances" className="small-number" type="number" min="0" max="99" value={substituteAppearances} onChange={(event) => setSubstituteAppearances(Math.max(0, Number(event.target.value)))} />
                        </div>
                        <div className="history-number">
                          <label htmlFor="landesliga-total">Einsätze Landesliga + höher</label>
                          <input id="landesliga-total" className="small-number" type="number" min="0" max="99" value={landesligaTotal} onChange={(event) => setLandesligaTotal(Math.max(0, Number(event.target.value)))} />
                        </div>
                      </div>
                      <div className="history-checks">
                        <label className="check-option"><input type="checkbox" checked={sameRoundHigher} onChange={(event) => setSameRoundHigher(event.target.checked)} /> In dieser Runde bereits in einer höheren Liga eingesetzt</label>
                        <label className="check-option"><input type="checkbox" checked={sameWeekendHigher} onChange={(event) => setSameWeekendHigher(event.target.checked)} /> Am selben Spieltagswochenende bereits höher eingesetzt</label>
                        <label className="check-option"><input type="checkbox" checked={parallelTeamUsed} onChange={(event) => setParallelTeamUsed(event.target.checked)} /> Bereits für ein Team derselben oder parallelen Klasse eingesetzt</label>
                        <label className="check-option"><input type="checkbox" checked={latePermitConfirmed} onChange={(event) => setLatePermitConfirmed(event.target.checked)} /> Erforderliche Spielgenehmigung für Nachmeldung liegt vor</label>
                      </div>
                    </div>
                  )}
                </div>

                {loadError && (
                  <div className="form-error" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{loadError} <button type="button" className="retry-link" onClick={() => window.location.reload()}>Erneut laden</button></span></div>
                )}
                {formError && <div className="form-error" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{formError}</span></div>}

                <div className="submit-row">
                  <span className="submit-hint"><ShieldCheck size={14} aria-hidden="true" /> Keine Entscheidung ohne Ranglistendaten.</span>
                  <button className="primary-button" type="submit" disabled={isChecking || clubs.length === 0}>
                    {isChecking ? <><LoaderCircle size={16} className="spin" aria-hidden="true" /> Prüfung läuft</> : <>Spielberechtigung prüfen <ArrowRight size={15} aria-hidden="true" /></>}
                  </button>
                </div>
              </form>
            )}
          </section>

          <aside className="side-column" aria-label="Datenstand und Hinweise">
            <section className="data-card">
              <div className="data-head">
                <h3>Datenlage</h3>
                <div className="data-icon"><Database size={16} aria-hidden="true" /></div>
              </div>
              <div className={`data-status ${available ? '' : 'offline'}`}>
                <span className="status-led" />
                {dataStatus ? available ? dataStatus.sourceMode === 'bundled' ? 'Lokale Ranglisten-Kopie' : 'Live-Ranglistendaten' : 'Daten derzeit nicht verfügbar' : loadError ? 'Verbindung nicht möglich' : 'Datenstatus wird geladen'}
              </div>
              <p className="data-description">
                {dataStatus?.error || (available
                  ? 'Die Prüfung stützt sich auf den abgerufenen Ranglistenstand. Angaben zur Einsatzhistorie können zusätzliche Bestätigung erfordern.'
                  : 'Ohne verfügbare Ranglistendaten kann keine verlässliche Spielberechtigung ermittelt werden.')}
              </p>
              <div className="data-stats">
                <div className="data-stat"><strong>{dataStatus?.playerCount ?? '—'}</strong><span>Spieler erfasst</span></div>
                <div className="data-stat"><strong>{dataStatus?.teamCount ?? '—'}</strong><span>Mannschaften</span></div>
                <div className="data-stat"><strong>{dataStatus?.sourceClubCount ?? '—'}</strong><span>Vereine in Quelle</span></div>
              </div>
              <div className="data-metadata">
                <div className="metadata-row"><span>Letzter Abruf</span><strong>{formatDate(dataStatus?.fetchedAt)}</strong></div>
                <div className="metadata-row"><span>Stand der Quelle</span><strong>{dataStatus?.sourceDate ?? 'Nicht angegeben'}</strong></div>
                <div className="metadata-row"><span>Datensatz</span><strong>HMM 2026 Ranglisten</strong></div>
                {dataStatus?.sourceUrl && (
                  <div className="metadata-row"><span>Quelle</span><a href={dataStatus.sourceUrl} target="_blank" rel="noreferrer">HSchV öffnen <ExternalLink size={10} aria-hidden="true" /></a></div>
                )}
              </div>
              {(dataWarningCount > 0 || loadError) && (
                <div className="data-warning"><AlertTriangle size={13} aria-hidden="true" />
                  <span>{loadError ? 'Der Status konnte nicht vollständig abgerufen werden.' : `${dataWarningCount} Hinweis${dataWarningCount === 1 ? '' : 'e'} zur Datenquelle.`} {dataStatus?.warnings.join(' ')}</span>
                </div>
              )}
              <button className="secondary-button" type="button" onClick={handleRefresh} disabled={isRefreshing} style={{ marginTop: 16 }}>
                <RefreshCw size={12} className={isRefreshing ? 'spin' : ''} aria-hidden="true" />
                {isRefreshing ? 'Daten werden aktualisiert …' : 'Daten aktualisieren'}
              </button>
            </section>

            <section className="guide-card">
              <div className="guide-title"><FileCheck2 size={17} aria-hidden="true" /> So lesen Sie das Ergebnis</div>
              <p>Die Prüfung ordnet Daten und Regeln ein. Sie macht sichtbar, wo eine Entscheidung belastbar ist und wo es noch Rückfragen braucht.</p>
              <div className="guide-steps">
                <div className="guide-step"><span className="guide-step-num">01</span><div><strong>Rangliste</strong><span>Verein und Nummer müssen zum HMM-Datensatz passen.</span></div></div>
                <div className="guide-step"><span className="guide-step-num">02</span><div><strong>Einsatzregeln</strong><span>§13–§16 werden für die gewählte Liga berücksichtigt.</span></div></div>
                <div className="guide-step"><span className="guide-step-num">03</span><div><strong>Offene Punkte</strong><span>Unbekanntes bleibt als offen markiert — nicht als Freigabe.</span></div></div>
              </div>
            </section>
          </aside>
        </div>

        {result && <ResultCard result={result} />}

        <footer className="page-footer">
          <div className="footer-source"><ShieldCheck size={14} aria-hidden="true" /><span>Orientierung für Mannschaftsführer · Hamburger Mannschaftsmeisterschaft 2026</span></div>
          <div className="footer-note">Bei ungeklärten Fällen bitte die Turnierleitung kontaktieren.</div>
        </footer>
      </main>
    </div>
  );
}

export default App;
