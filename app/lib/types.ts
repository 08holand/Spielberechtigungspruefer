// League levels per §11 Turnierordnung, ordered highest to lowest
export type Liga =
  | "Bundesliga"
  | "Oberliga-Nord"
  | "Landesliga"
  | "Stadtliga"
  | "Bezirksliga"
  | "Kreisliga"
  | "Kreisklasse"
  | "Basisklasse";

// Leagues selectable in the form (excludes Bundesliga / Oberliga-Nord which are national)
export const SELECTABLE_LIGEN: Liga[] = [
  "Landesliga",
  "Stadtliga",
  "Bezirksliga",
  "Kreisliga",
  "Kreisklasse",
  "Basisklasse",
];

// Numeric rank for comparison (lower = higher league)
export const LIGA_RANK: Record<Liga, number> = {
  Bundesliga: 0,
  "Oberliga-Nord": 1,
  Landesliga: 2,
  Stadtliga: 3,
  Bezirksliga: 4,
  Kreisliga: 5,
  Kreisklasse: 6,
  Basisklasse: 7,
};

export interface Club {
  kuerzel: string;
  name: string;
}

/**
 * A single entry in a club's ranking list.
 * Ranglistennummer may include an "a" suffix (e.g. "2a") for late registrations.
 */
export interface RankingEntry {
  /** e.g. "1", "2a", "11", "19" */
  ranglistennummer: string;
  /** Numeric base (e.g. 2 for "2a", 11 for "11") */
  ranglistennummerBase: number;
  /** true if this is an a-number late registration */
  isANummer: boolean;
  name: string;
  /** Which team number within the club (1 = first team, 2 = second, …) */
  teamNummer: number;
  /** The league this team plays in */
  liga: Liga;
  /** Club identifier */
  clubKuerzel: string;
  /**
   * How many times this player has been used as a substitute
   * in Bundesliga / Oberliga-Nord / Landesliga (for §14 checks).
   */
  higherLeagueEinsaetze: number;
  /**
   * How many times this player has been used as a substitute
   * in a higher class than their registered team (for §15 checks).
   */
  higherClassEinsaetze: number;
  /** Total appearances across Landesliga + higher leagues (for §14 9× cap) */
  totalHigherEinsaetze: number;
  /** true if this player is a reserve player (Reservespieler) per §13 */
  isReserve: boolean;
}

export type VerdictType = "spielberechtigt" | "nicht-spielberechtigt" | "eingeschraenkt";

export interface EligibilityResult {
  verdict: VerdictType;
  /** German-language explanation with paragraph citation */
  explanation: string;
  /** Which paragraphs were checked */
  checkedParagraphs: string[];
}

export interface RanglistenData {
  /** ISO timestamp of last fetch */
  fetchedAt: string;
  /** All ranking entries across all clubs */
  entries: RankingEntry[];
}
