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
  landesligaTotal: 0,
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
  const hasSubstituteLimitReached = recordedSubstituteAppearances >= 3
    || (context.confirmed && context.substituteAppearances >= 3);
  const parallelTeamUsed = recordedParallelTeamUse || (context.confirmed && context.parallelTeamUsed);
  const rules: RuleCheck[] = [];
  const warnings: string[] = appearanceHistory
    ? [
      historyComplete
        ? `Die Saison-Einsatzhistorie wurde für alle ${appearanceHistory.checkedTeams} HMM-Mannschaften dieses Vereins geladen.`
        : `Die Saison-Einsatzhistorie ist unvollständig (${appearanceHistory.availableTeams} von ${appearanceHistory.checkedTeams} Mannschaftsseiten geladen).`,
      ...(appearanceHistory.unavailableTeams.length
        ? [`Nicht abrufbar: ${appearanceHistory.unavailableTeams.join(', ')}.`]
        : []),
      'Landesliga- und überregionale Mannschaftsaufstellungen sind in der Quelle nicht enthalten.',
    ]
    : [
      'Die Rangliste enthält keine vereinsweite Einsatzhistorie. Bisherige Einsätze müssen bestätigt werden.',
      'Landesliga- und überregionale Mannschaftsaufstellungen sind in der Quelle nicht enthalten.',
    ];

  if (player.lateRegistration && input.targetLeague === 'Landesliga') {
    rules.push(check('§16', 'Nachmeldung in der Landesliga', 'Nachmeldungen sind für Landesliga-Mannschaften ausgeschlossen.', 'fail'));
  } else if (player.lateRegistration && !context.latePermitConfirmed) {
    rules.push(check('§16', 'Nachmeldung und Spielberechtigung', 'Die a-Nummer ist in der Rangliste. Ob die erforderliche Spielgenehmigung vorliegt, muss noch bestätigt werden.', 'unknown'));
  } else if (player.lateRegistration) {
    rules.push(check('§16', 'Nachmeldung und Spielberechtigung', 'Die notwendige Spielgenehmigung wurde als vorhanden angegeben.', 'pass'));
  } else {
    rules.push(check('§16', 'Nachmeldung', 'Keine a-Nummer erkannt; für diesen Spieler ist die Nachmelderegel nicht einschlägig.', 'pass'));
  }

  if (!player.reserve && player.league === 'Landesliga' && input.targetLeague !== 'Landesliga') {
    if (context.confirmed && context.higherAppearances >= 3) {
      rules.push(check('§14', 'Einsätze in höheren Spielklassen', 'Mindestens drei höhere Einsätze angegeben: Einsätze in niedrigeren Klassen sind nicht mehr zulässig.', 'fail'));
    } else if (context.confirmed && (context.sameRoundHigher || context.sameWeekendHigher)) {
      rules.push(check('§14', 'Einsatz in derselben Runde bzw. am selben Wochenende', 'Ein Einsatz in einer höheren Spielklasse schließt die parallele Aufstellung in einer niedrigeren Klasse aus.', 'fail'));
    } else if (context.confirmed) {
      rules.push(check('§14', 'Einsätze in höheren Spielklassen', 'Die bestätigte Einsatzhistorie erfüllt die abgefragten Sperren nicht.', 'pass'));
    } else {
      rules.push(check('§14', 'Einsätze in höheren Spielklassen', 'Vorherige Einsätze, Rundennummern und gegebenenfalls das gesamte Doppelspiel-Wochenende sind nicht in der Rangliste enthalten.', 'unknown'));
    }
  } else if (!player.reserve && leagueIndex(player.league) >= 0 && leagueIndex(player.league) < leagueIndex(input.targetLeague)) {
    if (context.confirmed && context.higherAppearances >= 3) {
      rules.push(check('§14', 'Einsätze in höheren Spielklassen', 'Mindestens drei höhere Einsätze angegeben: Einsätze in niedrigeren Klassen sind nicht mehr zulässig.', 'fail'));
    } else if (context.confirmed && (context.sameRoundHigher || context.sameWeekendHigher)) {
      rules.push(check('§14', 'Einsatz in derselben Runde bzw. am selben Wochenende', 'Ein Einsatz in einer höheren Spielklasse schließt die parallele Aufstellung in einer niedrigeren Klasse aus.', 'fail'));
    } else if (!context.confirmed) {
      rules.push(check('§14', 'Einsätze in höheren Spielklassen', 'Runden- und Wochenend-Einsätze sind aus der Rangliste nicht ersichtlich.', 'unknown'));
    } else {
      rules.push(check('§14', 'Einsätze in höheren Spielklassen', 'Die angegebenen höheren Einsätze begründen keine bekannte Sperre.', 'pass'));
    }
  } else if (context.confirmed) {
    rules.push(check('§14', 'Einsätze in höheren Spielklassen', 'Keine sperrenden Einsätze in höheren Spielklassen, derselben Runde oder am selben Wochenende angegeben.', 'pass'));
  } else {
    rules.push(check('§14', 'Einsätze in höheren Spielklassen', 'Die Rangliste weist keinen Einsatz in einer höheren Spielklasse aus. Frühere Spielberichte bleiben separat zu prüfen.', 'unknown'));
  }

  if (input.targetLeague === 'Landesliga') {
    const publishedLandesligaTeams = data.teams.some((team) => team.league === 'Landesliga');
    if (player.lateRegistration) {
      rules.push(check('§13', 'Landesliga-Aufstellung', 'Die Landesliga-Rangliste führt diese a-Nummer als Nachmeldung auf; Nachmeldungen sind dort ausgeschlossen.', 'fail'));
    } else if (!publishedLandesligaTeams) {
      rules.push(check('§13', 'Landesliga-Aufstellung', 'Die veröffentlichte Datenquelle enthält keine vollständige Landesliga-Aufstellung. Eine Registrierung für diese Klasse kann hier nicht bestätigt werden.', 'unknown'));
    } else if (player.league !== 'Landesliga' || player.reserve) {
      rules.push(check('§13', 'Landesliga-Aufstellung', 'Die vollständige Rangliste belegt keine reguläre Registrierung für eine Landesliga-Mannschaft.', 'fail'));
    } else if (context.confirmed && context.landesligaTotal + context.higherAppearances > 9) {
      rules.push(check('§14', 'Neun-Einsätze-Grenze', 'Mehr als neun kombinierte Einsätze in Landesliga und höheren Klassen angegeben.', 'fail'));
    } else if (context.confirmed) {
      rules.push(check('§14', 'Neun-Einsätze-Grenze', 'Die angegebene Gesamtzahl überschreitet neun Einsätze nicht.', 'pass'));
    } else {
      rules.push(check('§14', 'Neun-Einsätze-Grenze', 'Die Zahl kombinierter Einsätze in der Landesliga und höheren Klassen muss anhand der Spielberichte bestätigt werden.', 'unknown'));
    }
  } else if (!targetTeam) {
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
      rules.push(check('§15', 'Parallele Mannschaften', 'Es wurde angegeben, dass der Spieler bereits für eine andere Mannschaft derselben oder einer parallelen Klasse eingesetzt wurde.', 'fail'));
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
    rules.push(check('§15', 'Mehrfachaufstellung', 'Eine Aufstellung für dieselbe oder eine parallele Klasse wurde angegeben.', 'fail'));
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
      ? 'Die geprüften Angaben zeigen keine Sperre. Bitte gleiche die Einsatzhistorie vor dem Aufstellen mit den offiziellen Spielberichten ab.'
      : verdict === 'ineligible'
        ? 'Mindestens eine angegebene oder aus der Rangliste erkennbare Regel steht dem Einsatz entgegen.'
        : 'Die Rangliste allein reicht für eine sichere Entscheidung nicht aus. Ergänze die Einsatzhistorie und gleiche sie mit den offiziellen Spielberichten ab.',
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
