export const LEAGUES = ['Landesliga', 'Stadtliga', 'Bezirksliga', 'Kreisliga', 'Kreisklasse', 'Basisklasse'] as const;
export type League = typeof LEAGUES[number];
export interface Club { code: string; name: string }
export interface Team { clubCode: string; number: number; league: League; division: string }
export interface Player {
  clubCode: string;
  ranking: string;
  name: string;
  teamNumber: number | null;
  league: League | null;
  reserve: boolean;
  lateRegistration: boolean;
  inactive: boolean;
  rating: number | null;
}
export interface RankingData {
  players: Player[];
  teams: Team[];
  fetchedAt: string;
  sourceDate: string | null;
  sourceUrl: string;
  sourceClubCount: number;
}
export interface DataStatus {
  available: boolean;
  sourceMode: 'live' | 'bundled';
  fetchedAt: string | null;
  sourceDate: string | null;
  playerCount: number;
  teamCount: number;
  sourceClubCount: number;
  sourceUrl: string;
  warnings: string[];
  error: string | null;
}
export interface AppearanceContext {
  confirmed: boolean;
  higherAppearances: number;
  substituteAppearances: number;
  landesligaTotal: number;
  sameRoundHigher: boolean;
  sameWeekendHigher: boolean;
  parallelTeamUsed: boolean;
  latePermitConfirmed: boolean;
}
export interface CheckInput {
  clubCode: string;
  ranking: string;
  targetLeague: League;
  targetTeam?: number;
  context?: AppearanceContext;
}
export interface RuleCheck { paragraph: string; title: string; detail: string; status: 'pass' | 'fail' | 'unknown' }
export interface TeamAppearance {
  teamNumber: number;
  teamName: string;
  league: League;
  count: number | null;
  rounds: number[];
  sourceUrl: string | null;
  sourceDate: string | null;
  error: string | null;
}
export interface TeamAppearanceAssignment {
  round: number;
  teamNumber: number;
  teamName: string;
  league: League;
}
export interface TeamAppearanceHistory {
  assignments: TeamAppearanceAssignment[];
  teams: TeamAppearance[];
  checkedTeams: number;
  availableTeams: number;
  complete: boolean;
  unavailableTeams: string[];
  sourceDate: string | null;
}
export interface EligibilityResult {
  verdict: 'eligible' | 'ineligible' | 'conditional';
  title: string;
  explanation: string;
  player: Player;
  targetTeam: Team | null;
  teamAppearances: TeamAppearance | null;
  appearanceHistory: TeamAppearanceHistory | null;
  remainingSubstitutions: number | null;
  checks: RuleCheck[];
  warnings: string[];
  fetchedAt: string;
}
