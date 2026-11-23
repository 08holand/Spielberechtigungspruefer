import { LEAGUES, type AppearanceContext, type CheckInput, type EligibilityResult, type League, type RankingData, type RuleCheck, type Team, type TeamAppearanceHistory } from '../shared/types';

function rankingKey(value: string): string {
  const match = value.trim().match(/^(\d+)\s*([aA]?)$/);
  return match ? `${Number(match[1])}${match[2].toLowerCase()}` : value.trim().toLowerCase();
}

function leagueIndex(league: League | null): number {
  return league ? LEAGUES.indexOf(league) : -1;
}

function check(paragraph: string, title: string, detail: string, status: RuleCheck['status']): RuleCheck {
  return { paragraph, title, detail, status };
}

const unknownContext: AppearanceContext = {
  confirmed: false,
  higherAppearances: 0,
  substituteAppearances: 0,
  sameRoundHigher: false,
  sameWeekendHigher: false,
  parallelTeamUsed: false,
  latePermitConfirmed: false,
};

export function evaluateEligibility(
  data: RankingData,
  input: CheckInput,
  appearanceHistory: TeamAppearanceHistory | null = null,
): EligibilityResult | null {
  const player = data.players.find(
    (entry) => entry.clubCode === input.clubCode && rankingKey(entry.ranking) === rankingKey(input.ranking),
  );
  if (!player) return null;

  const context = input.context ?? unknownContext;
  const targetTeam: Team | null = input.targetTeam === undefined
    ? null
    : data.teams.find(
      (team) => team.clubCode === input.clubCode
        && team.number === input.targetTeam
        && team.league === input.targetLeague,
    ) ?? null;
  const clubTeams = data.teams.filter((team) => team.clubCode === input.clubCode);
  const lowestTeamNumber = clubTeams.length ? Math.max(...clubTeams.map(({ number }) => number)) : null;
  const assignments = appearanceHistory?.assignments ?? [];
  const historyComplete = appearanceHistory?.complete ?? false;
  const recordedSubstituteAppearances = assignments.filter((appearance) => player.reserve
    ? appearance.teamNumber !== lowestTeamNumber
    : player.teamNumber !== null && appearance.teamNumber < player.teamNumber).length;
  const recordedParallelTeamUse = Boolean(targetTeam && assignments.some(
    (appearance) => appearance.teamNumber !== targetTeam.number && appearance.league === targetTeam.league,
  ));
  const substituteAppearances = historyComplete
    ? recordedSubstituteAppearances
    : Math.max(recordedSubstituteAppearances, context.substituteAppearances);
  const hasSubstituteLimitReached = historyComplete
    ? recordedSubstituteAppearances >= 3
    : recordedSubstituteAppearances >= 3 || (context.confirmed && context.substituteAppearances >= 3);
  const parallelTeamUsed = historyComplete
    ? recordedParallelTeamUse
    : recordedParallelTeamUse || (context.confirmed && context.parallelTeamUsed);
  const rules: RuleCheck[] = [];
  const warnings: string[] = appearanceHistory
    ? [
      historyComplete
        ? `Die Saison-Einsatzhistorie wurde für alle ${appearanceHistory.checkedTeams} HMM-Mannschaften dieses Vereins geladen.`
        : `Die Saison-Einsatzhistorie ist unvollständig (${appearanceHistory.availableTeams} von ${appearanceHistory.checkedTeams} Mannschaftsseiten geladen).`,
      ...(appearanceHistory.unavailableTeams.length
        ? [`Nicht abrufbar: ${appearanceHistory.unavailableTeams.join(', ')}.`]
        : []),
    ]
    : [
      'Die Rangliste enthält keine vereinsweite Einsatzhistorie. Bisherige Einsätze müssen bestätigt werden.',
    ];

  if (player.lateRegistration && !context.latePermitConfirmed) {
    rules.push(check('§16', 'Nachmeldung und Spielberechtigung', 'Die a-Nummer ist in der Rangliste. Ob die erforderliche Spielgenehmigung vorliegt, muss noch bestätigt werden.', 'unknown'));
  } else if (player.lateRegistration) {
    rules.push(check('§16', 'Nachmeldung und Spielberechtigung', 'Die notwendige Spielgenehmigung wurde als vorhanden angegeben.', 'pass'));
  } else {
    rules.push(check('§16', 'Nachmeldung', 'Keine a-Nummer erkannt; für diesen Spieler ist die Nachmelderegel nicht einschlägig.', 'pass'));
  }

  if (context.confirmed && context.higherAppearances >= 3) {
    rules.push(check('§14', 'Einsätze in höheren Spielklassen', 'Mindestens drei Einsätze in Bundesliga oder Oberliga-Nord angegeben; Einsätze in niedrigeren HMM-Ligen sind nicht zulässig.', 'fail'));
  } else if (context.confirmed && (context.sameRoundHigher || context.sameWeekendHigher)) {
    rules.push(check('§14', 'Einsatz in derselben Runde bzw. am selben Wochenende', 'Ein Einsatz in Bundesliga oder Oberliga-Nord schließt die parallele Aufstellung in einer niedrigeren HMM-Liga aus.', 'fail'));
  } else if (context.confirmed) {
    rules.push(check('§14', 'Einsätze in höheren Spielklassen', 'Die bestätigten Einsätze aus Bundesliga und Oberliga-Nord begründen keine bekannte Sperre.', 'pass'));
  } else {
    rules.push(check('§14', 'Einsätze in höheren Spielklassen', 'Einsätze in Bundesliga oder Oberliga-Nord stehen nicht in den HMM-Ergebnissen und müssen separat bestätigt werden.', 'unknown'));
  }

  if (!targetTeam) {
    rules.push(check('§13', 'Mannschaft und Brettfolge', 'Für diese Klasse ist keine Zielmannschaft in der veröffentlichten Rangliste verfügbar. Die Mannschaftszuordnung und Brettfolge lassen sich deshalb nicht bestätigen.', 'unknown'));
  } else if (player.reserve && lowestTeamNumber === targetTeam.number) {
    rules.push(check('§13', 'Reserveliste und Zielmannschaft', 'Die Reserveliste darf laut Regelung unbegrenzt in der niedrigsten Mannschaft eingesetzt werden.', 'pass'));
  } else if (player.reserve) {
    if (hasSubstituteLimitReached) {
      rules.push(check('§15', 'Ersatzeinsätze', `Bereits ${Math.max(recordedSubstituteAppearances, context.substituteAppearances)} Ersatzeinsätze erfasst; ein weiterer Einsatz in einer höheren Mannschaft ist nicht zulässig.`, 'fail'));
    } else if (!historyComplete && !context.confirmed) {
      rules.push(check('§15', 'Ersatzeinsätze', 'Die Einsatzhistorie ist nicht vollständig genug, um die bisherigen Ersatzeinsätze sicher zu zählen.', 'unknown'));
    } else {
      rules.push(check('§15', 'Ersatzeinsätze', `Noch ${Math.max(0, 3 - substituteAppearances)} von 3 Ersatzeinsätzen verfügbar.`, 'pass'));
    }
  } else if (!player.teamNumber || !player.league) {
    rules.push(check('§13', 'Mannschaftszuordnung', 'Für diesen Eintrag ist keine reguläre Mannschaftszuordnung in der Quelle erkennbar.', 'unknown'));
  } else if (targetTeam.number === player.teamNumber && targetTeam.league === player.league) {
    rules.push(check('§13', 'Mannschaftszuordnung', `Spieler ist für Mannschaft ${player.teamNumber} gemeldet; die Ranglistennummer ist maßgeblich für die Brettfolge.`, 'pass'));
  } else if (leagueIndex(targetTeam.league) > leagueIndex(player.league)) {
    rules.push(check('§13', 'Spiel in einer niedrigeren Mannschaft', `Die Meldung für Mannschaft ${player.teamNumber} belegt keine Spielberechtigung für die niedrigere Mannschaft ${targetTeam.number}.`, 'fail'));
  } else {
    const parallelClass = targetTeam.league === player.league;
    if (parallelClass && parallelTeamUsed) {
      rules.push(check('§15', 'Parallele Mannschaften', 'Die Einsatzhistorie zeigt einen Einsatz für eine andere Mannschaft derselben oder einer parallelen Klasse.', 'fail'));
    } else if (parallelClass && !historyComplete && !context.confirmed) {
      rules.push(check('§15', 'Parallele Mannschaften', 'Die Einsatzhistorie ist nicht vollständig genug, um parallele Mannschaftseinsätze auszuschließen.', 'unknown'));
    } else if (hasSubstituteLimitReached) {
      rules.push(check('§15', 'Ersatzeinsätze', `Bereits ${Math.max(recordedSubstituteAppearances, context.substituteAppearances)} Ersatzeinsätze aus einer niedrigeren Mannschaft erfasst.`, 'fail'));
    } else if (!historyComplete && !context.confirmed) {
      rules.push(check('§15', 'Ersatzeinsätze', 'Die Einsatzhistorie ist nicht vollständig genug, um die bisherigen Ersatzeinsätze sicher zu zählen.', 'unknown'));
    } else {
      rules.push(check('§15', 'Ersatzeinsätze', `Ersatz aus Mannschaft ${player.teamNumber}; noch ${Math.max(0, 3 - substituteAppearances)} von 3 Ersatzeinsätzen verfügbar.`, 'pass'));
    }
  }

  if (parallelTeamUsed && !rules.some((rule) => rule.paragraph === '§15' && rule.status === 'fail')) {
    rules.push(check('§15', 'Mehrfachaufstellung', 'Die Einsatzhistorie zeigt einen Einsatz für eine andere Mannschaft derselben oder einer parallelen Klasse.', 'fail'));
  } else if ((historyComplete || context.confirmed) && targetTeam && !parallelTeamUsed) {
    rules.push(check('§15', 'Mehrfachaufstellung', 'Kein Einsatz für eine weitere Mannschaft derselben oder parallelen Klasse angegeben.', 'pass'));
  }

  const hasFailure = rules.some((rule) => rule.status === 'fail');
  const hasUnknown = rules.some((rule) => rule.status === 'unknown');
  const isSubstitute = player.reserve || Boolean(targetTeam && player.teamNumber !== targetTeam.number);
  const substituteHistoryConfirmed = historyComplete || context.confirmed || recordedSubstituteAppearances >= 3;
  const remainingSubstitutions = substituteHistoryConfirmed && isSubstitute && !(player.reserve && lowestTeamNumber === targetTeam?.number)
    ? Math.max(0, 3 - substituteAppearances)
    : null;
  const restricted = remainingSubstitutions === 1;
  const verdict: EligibilityResult['verdict'] = hasFailure ? 'ineligible' : hasUnknown || restricted ? 'conditional' : 'eligible';
  return {
    verdict,
    title: verdict === 'eligible' ? 'Spielberechtigt' : verdict === 'ineligible' ? 'Nicht spielberechtigt' : 'Noch nicht abschließend prüfbar',
    explanation: restricted
      ? 'Der Einsatz ist laut den angegebenen bisherigen Einsätzen noch höchstens einmal als Ersatzspieler möglich (§15).'
      : verdict === 'eligible'
      ? 'Die Ranglisten- und erfassten HMM-Ergebnisdaten zeigen keine Sperre.'
      : verdict === 'ineligible'
        ? 'Mindestens eine angegebene oder aus der Rangliste erkennbare Regel steht dem Einsatz entgegen.'
        : appearanceHistory && historyComplete
          ? 'Alle erfassten HMM-Einsätze wurden berücksichtigt. Prüfen Sie noch die oben genannten offenen Angaben.'
          : appearanceHistory
            ? 'Die HMM-Einsatzhistorie konnte nicht vollständig geladen werden. Prüfen Sie die fehlenden Mannschaftsseiten und offenen Angaben.'
            : 'Die Rangliste allein reicht für eine sichere Entscheidung nicht aus. Ergänzen Sie die fehlende Einsatzhistorie.',
    player,
    targetTeam,
    teamAppearances: null,
    appearanceHistory,
    remainingSubstitutions,
    checks: rules,
    warnings,
    fetchedAt: data.fetchedAt,
  };
}
