import {
  Liga,
  LIGA_RANK,
  RankingEntry,
  RanglistenData,
  EligibilityResult,
  VerdictType,
} from "./types";

export interface CheckInput {
  ranglistennummer: string; // e.g. "3", "2a", "11"
  clubKuerzel: string;
  targetLiga: Liga;
}

/**
 * Returns true if leagueA is strictly higher (more competitive) than leagueB.
 */
function isHigherLeague(a: Liga, b: Liga): boolean {
  return LIGA_RANK[a] < LIGA_RANK[b];
}

/**
 * Returns true if leagueA is at the same level or higher than leagueB.
 */
function isHigherOrEqual(a: Liga, b: Liga): boolean {
  return LIGA_RANK[a] <= LIGA_RANK[b];
}

/**
 * The top three leagues where §14 restrictions apply.
 */
const UPPER_LEAGUES: Liga[] = ["Bundesliga", "Oberliga-Nord", "Landesliga"];

function isUpperLeague(liga: Liga): boolean {
  return UPPER_LEAGUES.includes(liga);
}

/**
 * Check player eligibility per §13–§16 of the HSV Turnierordnung.
 *
 * Because the static ranking list page does not include per-round or
 * per-player substitute usage counts, §14 and §15 usage-count checks
 * (3× limits) are evaluated based on the `higherLeagueEinsaetze` and
 * `higherClassEinsaetze` fields on the RankingEntry. These default to 0
 * when scraped from the static page, so the engine will note the limitation.
 */
export function checkEligibility(
  input: CheckInput,
  data: RanglistenData
): EligibilityResult {
  const { ranglistennummer, clubKuerzel, targetLiga } = input;
  const checkedParagraphs: string[] = [];

  // ── §13: Find the player in the ranking list ──────────────────────────────
  checkedParagraphs.push("§13");

  const clubEntries = data.entries.filter((e) => e.clubKuerzel === clubKuerzel);

  if (clubEntries.length === 0) {
    return {
      verdict: "nicht-spielberechtigt",
      explanation: `§13: Für den Verein „${clubKuerzel}" wurden keine Ranglisten-Einträge gefunden. Bitte Daten aktualisieren.`,
      checkedParagraphs,
    };
  }

  const player = clubEntries.find(
    (e) => e.ranglistennummer.toLowerCase() === ranglistennummer.toLowerCase()
  );

  if (!player) {
    return {
      verdict: "nicht-spielberechtigt",
      explanation: `§13: Ranglistennummer „${ranglistennummer}" wurde in der Rangliste von ${clubKuerzel} nicht gefunden.`,
      checkedParagraphs,
    };
  }

  // §13: Landesliga is a closed roster — no substitutes from outside
  if (targetLiga === "Landesliga" && player.liga !== "Landesliga") {
    return {
      verdict: "nicht-spielberechtigt",
      explanation: `§13: In der Landesliga dürfen nur die für die Landesliga gemeldeten Spieler eingesetzt werden. ${player.name} ist nicht für die Landesliga gemeldet.`,
      checkedParagraphs,
    };
  }

  // §13: a-number player is only eligible for their registered team
  if (player.isANummer) {
    checkedParagraphs.push("§16");
    const registeredLiga = player.liga;
    if (registeredLiga !== targetLiga) {
      return {
        verdict: "nicht-spielberechtigt",
        explanation: `§16: Spieler mit a-Nummer (${player.ranglistennummer}) ist nur für die gemeldete Mannschaft (${registeredLiga}) spielberechtigt, nicht für die ${targetLiga}.`,
        checkedParagraphs,
      };
    }
  }

  // §13: Late registrations (Nachmeldungen) are excluded for Landesliga
  if (targetLiga === "Landesliga" && player.isANummer) {
    checkedParagraphs.push("§16");
    return {
      verdict: "nicht-spielberechtigt",
      explanation: `§16: Nachmeldungen (a-Nummern) sind für die Landesliga ausgeschlossen.`,
      checkedParagraphs,
    };
  }

  // ── §14: Upper league substitute restrictions ─────────────────────────────
  checkedParagraphs.push("§14");

  const playerRegisteredInUpperLeague = isUpperLeague(player.liga);

  if (playerRegisteredInUpperLeague || player.higherLeagueEinsaetze > 0) {
    // §14: Player used 3× in Bundesliga/Oberliga-Nord/Landesliga →
    // no longer eligible in any lower team
    if (player.higherLeagueEinsaetze >= 3 && isHigherLeague(player.liga, targetLiga)) {
      return {
        verdict: "nicht-spielberechtigt",
        explanation: `§14: ${player.name} wurde bereits ${player.higherLeagueEinsaetze}× in einer höheren Liga (${player.liga}) als Ersatzspieler eingesetzt und ist daher in der ${targetLiga} nicht mehr spielberechtigt.`,
        checkedParagraphs,
      };
    }

    // §14: Landesliga player — combined appearances in Landesliga + higher ≤ 9
    if (player.liga === "Landesliga" && targetLiga === "Landesliga") {
      if (player.totalHigherEinsaetze >= 9) {
        return {
          verdict: "nicht-spielberechtigt",
          explanation: `§14: ${player.name} hat bereits ${player.totalHigherEinsaetze} Einsätze in der Landesliga und höheren Ligen (Maximum: 9).`,
          checkedParagraphs,
        };
      }
      if (player.totalHigherEinsaetze >= 7) {
        return {
          verdict: "eingeschraenkt",
          explanation: `§14: ${player.name} hat ${player.totalHigherEinsaetze} von maximal 9 Einsätzen in der Landesliga und höheren Ligen verbraucht. Noch ${9 - player.totalHigherEinsaetze} Einsatz/Einsätze möglich.`,
          checkedParagraphs,
        };
      }
    }
  }

  // ── §15: Substitute rules for Stadtliga and below ─────────────────────────
  checkedParagraphs.push("§15");

  const playerIsFromLowerClass = isHigherLeague(targetLiga, player.liga);
  const playerIsReserve = player.isReserve;

  if (playerIsFromLowerClass || playerIsReserve) {
    // §15: Reserve players may play in the lowest-ranked team without limit
    // but only 3× in higher-ranked teams
    if (playerIsReserve) {
      // Find the lowest team of this club (highest LIGA_RANK value)
      const clubTeams = clubEntries
        .filter((e) => !e.isReserve)
        .map((e) => e.liga);
      const lowestTeamLiga = clubTeams.reduce<Liga | null>((lowest, liga) => {
        if (!lowest) return liga;
        return LIGA_RANK[liga] > LIGA_RANK[lowest] ? liga : lowest;
      }, null);

      // isLowestTeam: target is at or below the club's lowest registered team
      const isLowestTeam =
        lowestTeamLiga !== null &&
        LIGA_RANK[targetLiga] >= LIGA_RANK[lowestTeamLiga];

      if (!isLowestTeam) {
        if (player.higherClassEinsaetze >= 3) {
          return {
            verdict: "nicht-spielberechtigt",
            explanation: `§15: ${player.name} ist Reservespieler und wurde bereits ${player.higherClassEinsaetze}× in einer höheren Klasse eingesetzt (Maximum: 3×).`,
            checkedParagraphs,
          };
        }
        if (player.higherClassEinsaetze === 2) {
          return {
            verdict: "eingeschraenkt",
            explanation: `§15: ${player.name} ist Reservespieler und hat bereits 2 von maximal 3 Einsätzen in höheren Klassen verbraucht. Noch 1 Einsatz möglich.`,
            checkedParagraphs,
          };
        }
      }
    } else {
      // §15: Player from lower class — at most 3× as substitute in higher class
      if (player.higherClassEinsaetze >= 3) {
        return {
          verdict: "nicht-spielberechtigt",
          explanation: `§15: ${player.name} wurde bereits ${player.higherClassEinsaetze}× als Ersatzspieler in einer höheren Klasse eingesetzt (Maximum: 3×).`,
          checkedParagraphs,
        };
      }
      if (player.higherClassEinsaetze === 2) {
        return {
          verdict: "eingeschraenkt",
          explanation: `§15: ${player.name} hat bereits 2 von maximal 3 Einsätzen als Ersatzspieler in höheren Klassen verbraucht. Noch 1 Einsatz möglich.`,
          checkedParagraphs,
        };
      }
    }

    // §15: No player may be fielded for multiple teams in the same or parallel classes
    // (This check requires knowledge of the current match lineup — noted as limitation)
  }

  // §15: Player playing in a lower class than their registered team
  // is not eligible to play in a class lower than their own
  if (isHigherLeague(player.liga, targetLiga)) {
    // Player's registered league is higher than target — this is a downward move
    // §15 allows playing down only as a substitute from a lower class
    // If the player is registered in a higher class, they cannot play in a lower one
    // unless they are being used as a substitute (which is the normal case here)
    // This is allowed per §15 — no restriction on playing down
  }

  // ── All checks passed ─────────────────────────────────────────────────────
  const paragraphList = checkedParagraphs.join(", ");

  // Note if usage counts are unavailable (scraped from static page)
  const usageNote =
    player.higherLeagueEinsaetze === 0 && player.higherClassEinsaetze === 0
      ? " Hinweis: Einsatzzahlen (§14/§15 Limits) konnten nicht aus der Rangliste ermittelt werden und wurden mit 0 angenommen."
      : "";

  return {
    verdict: "spielberechtigt",
    explanation: `${player.name} ist für die ${targetLiga} spielberechtigt (geprüft: ${paragraphList}).${usageNote}`,
    checkedParagraphs,
  };
}
