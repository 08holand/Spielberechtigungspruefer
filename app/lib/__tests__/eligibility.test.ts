import { describe, it, expect } from "vitest";
import { checkEligibility } from "../eligibility";
import { RanglistenData, RankingEntry } from "../types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<RankingEntry>): RankingEntry {
  return {
    ranglistennummer: "1",
    ranglistennummerBase: 1,
    isANummer: false,
    name: "Mustermann, Max",
    teamNummer: 1,
    liga: "Stadtliga",
    clubKuerzel: "STP",
    higherLeagueEinsaetze: 0,
    higherClassEinsaetze: 0,
    totalHigherEinsaetze: 0,
    isReserve: false,
    ...overrides,
  };
}

function makeData(entries: RankingEntry[]): RanglistenData {
  return { fetchedAt: new Date().toISOString(), entries };
}

// ── §13 Tests ─────────────────────────────────────────────────────────────────

describe("§13 – Ranglisten", () => {
  it("returns nicht-spielberechtigt when club has no entries", () => {
    const data = makeData([]);
    const result = checkEligibility(
      { ranglistennummer: "1", clubKuerzel: "STP", targetLiga: "Stadtliga" },
      data
    );
    expect(result.verdict).toBe("nicht-spielberechtigt");
    expect(result.explanation).toMatch(/keine Ranglisten-Einträge/);
  });

  it("returns nicht-spielberechtigt when Ranglistennummer not found", () => {
    const data = makeData([makeEntry({ ranglistennummer: "1" })]);
    const result = checkEligibility(
      { ranglistennummer: "99", clubKuerzel: "STP", targetLiga: "Stadtliga" },
      data
    );
    expect(result.verdict).toBe("nicht-spielberechtigt");
    expect(result.explanation).toMatch(/nicht gefunden/);
  });

  it("returns nicht-spielberechtigt when non-Landesliga player targets Landesliga", () => {
    const data = makeData([makeEntry({ liga: "Stadtliga" })]);
    const result = checkEligibility(
      { ranglistennummer: "1", clubKuerzel: "STP", targetLiga: "Landesliga" },
      data
    );
    expect(result.verdict).toBe("nicht-spielberechtigt");
    expect(result.explanation).toMatch(/Landesliga/);
    expect(result.checkedParagraphs).toContain("§13");
  });

  it("allows a Landesliga-registered player to play in Landesliga", () => {
    const data = makeData([makeEntry({ liga: "Landesliga" })]);
    const result = checkEligibility(
      { ranglistennummer: "1", clubKuerzel: "STP", targetLiga: "Landesliga" },
      data
    );
    expect(result.verdict).toBe("spielberechtigt");
  });

  it("is case-insensitive for Ranglistennummer lookup", () => {
    const data = makeData([makeEntry({ ranglistennummer: "2a", isANummer: true, liga: "Stadtliga" })]);
    const result = checkEligibility(
      { ranglistennummer: "2A", clubKuerzel: "STP", targetLiga: "Stadtliga" },
      data
    );
    // a-number player is only eligible for their registered team's liga
    expect(result.verdict).toBe("spielberechtigt");
  });
});

// ── §14 Tests ─────────────────────────────────────────────────────────────────

describe("§14 – Bundesliga/Oberliga-Nord/Landesliga substitute limits", () => {
  it("blocks player with 3 higher-league appearances from lower team", () => {
    const data = makeData([
      makeEntry({
        liga: "Landesliga",
        higherLeagueEinsaetze: 3,
        totalHigherEinsaetze: 3,
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "1", clubKuerzel: "STP", targetLiga: "Stadtliga" },
      data
    );
    expect(result.verdict).toBe("nicht-spielberechtigt");
    expect(result.explanation).toMatch(/3×/);
    expect(result.checkedParagraphs).toContain("§14");
  });

  it("allows player with 2 higher-league appearances in lower team", () => {
    const data = makeData([
      makeEntry({
        liga: "Landesliga",
        higherLeagueEinsaetze: 2,
        totalHigherEinsaetze: 2,
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "1", clubKuerzel: "STP", targetLiga: "Stadtliga" },
      data
    );
    expect(result.verdict).toBe("spielberechtigt");
  });

  it("blocks Landesliga player who reached 9 total appearances", () => {
    const data = makeData([
      makeEntry({
        liga: "Landesliga",
        higherLeagueEinsaetze: 0,
        totalHigherEinsaetze: 9,
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "1", clubKuerzel: "STP", targetLiga: "Landesliga" },
      data
    );
    expect(result.verdict).toBe("nicht-spielberechtigt");
    expect(result.explanation).toMatch(/9/);
  });

  it("warns Landesliga player with 7 total appearances (eingeschränkt)", () => {
    const data = makeData([
      makeEntry({
        liga: "Landesliga",
        higherLeagueEinsaetze: 0,
        totalHigherEinsaetze: 7,
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "1", clubKuerzel: "STP", targetLiga: "Landesliga" },
      data
    );
    expect(result.verdict).toBe("eingeschraenkt");
    expect(result.explanation).toMatch(/2 Einsatz/);
  });

  it("allows Landesliga player with 6 total appearances without restriction", () => {
    const data = makeData([
      makeEntry({
        liga: "Landesliga",
        higherLeagueEinsaetze: 0,
        totalHigherEinsaetze: 6,
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "1", clubKuerzel: "STP", targetLiga: "Landesliga" },
      data
    );
    expect(result.verdict).toBe("spielberechtigt");
  });
});

// ── §15 Tests ─────────────────────────────────────────────────────────────────

describe("§15 – Ersatzspieler Stadtliga abwärts", () => {
  it("blocks lower-class player with 3 higher-class appearances", () => {
    const data = makeData([
      makeEntry({
        liga: "Kreisliga",
        higherClassEinsaetze: 3,
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "1", clubKuerzel: "STP", targetLiga: "Stadtliga" },
      data
    );
    expect(result.verdict).toBe("nicht-spielberechtigt");
    expect(result.explanation).toMatch(/3×/);
    expect(result.checkedParagraphs).toContain("§15");
  });

  it("warns lower-class player with 2 higher-class appearances (eingeschränkt)", () => {
    const data = makeData([
      makeEntry({
        liga: "Kreisliga",
        higherClassEinsaetze: 2,
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "1", clubKuerzel: "STP", targetLiga: "Stadtliga" },
      data
    );
    expect(result.verdict).toBe("eingeschraenkt");
    expect(result.explanation).toMatch(/1 Einsatz/);
  });

  it("allows lower-class player with 1 higher-class appearance", () => {
    const data = makeData([
      makeEntry({
        liga: "Kreisliga",
        higherClassEinsaetze: 1,
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "1", clubKuerzel: "STP", targetLiga: "Stadtliga" },
      data
    );
    expect(result.verdict).toBe("spielberechtigt");
  });

  it("blocks reserve player with 3 higher-class appearances when targeting above lowest team", () => {
    // Club has two teams: Stadtliga (team 1) and Kreisklasse (team 2, lowest).
    // Reserve player has already been used 3× in higher classes.
    // Targeting Stadtliga (above the lowest Kreisklasse) → blocked.
    const data = makeData([
      makeEntry({
        ranglistennummer: "1",
        liga: "Stadtliga",
        isReserve: false,
        teamNummer: 1,
      }),
      makeEntry({
        ranglistennummer: "11",
        ranglistennummerBase: 11,
        liga: "Kreisklasse",
        isReserve: false,
        teamNummer: 2,
      }),
      makeEntry({
        ranglistennummer: "21",
        ranglistennummerBase: 21,
        liga: "Kreisklasse",
        isReserve: true,
        higherClassEinsaetze: 3,
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "21", clubKuerzel: "STP", targetLiga: "Stadtliga" },
      data
    );
    expect(result.verdict).toBe("nicht-spielberechtigt");
    expect(result.explanation).toMatch(/Reservespieler/);
  });

  it("allows reserve player unlimited appearances in lowest team", () => {
    const data = makeData([
      makeEntry({
        ranglistennummer: "1",
        liga: "Kreisklasse",
        isReserve: false,
        teamNummer: 1,
      }),
      makeEntry({
        ranglistennummer: "11",
        ranglistennummerBase: 11,
        liga: "Kreisklasse",
        isReserve: true,
        higherClassEinsaetze: 99,
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "11", clubKuerzel: "STP", targetLiga: "Kreisklasse" },
      data
    );
    expect(result.verdict).toBe("spielberechtigt");
  });
});

// ── §16 Tests ─────────────────────────────────────────────────────────────────

describe("§16 – Nachmeldungen", () => {
  it("blocks a-number player from playing in a different liga than registered", () => {
    const data = makeData([
      makeEntry({
        ranglistennummer: "2a",
        isANummer: true,
        liga: "Bezirksliga",
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "2a", clubKuerzel: "STP", targetLiga: "Stadtliga" },
      data
    );
    expect(result.verdict).toBe("nicht-spielberechtigt");
    expect(result.explanation).toMatch(/a-Nummer/);
    expect(result.checkedParagraphs).toContain("§16");
  });

  it("allows a-number player to play in their registered liga", () => {
    const data = makeData([
      makeEntry({
        ranglistennummer: "2a",
        isANummer: true,
        liga: "Stadtliga",
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "2a", clubKuerzel: "STP", targetLiga: "Stadtliga" },
      data
    );
    expect(result.verdict).toBe("spielberechtigt");
  });

  it("blocks a-number player from playing in Landesliga", () => {
    const data = makeData([
      makeEntry({
        ranglistennummer: "2a",
        isANummer: true,
        liga: "Landesliga",
      }),
    ]);
    const result = checkEligibility(
      { ranglistennummer: "2a", clubKuerzel: "STP", targetLiga: "Landesliga" },
      data
    );
    expect(result.verdict).toBe("nicht-spielberechtigt");
    expect(result.explanation).toMatch(/Nachmeldungen.*Landesliga/);
  });
});

// ── Scraper parser tests ───────────────────────────────────────────────────────

describe("parseRanglisten – scraper", () => {
  it("parses a minimal ranking list HTML block", async () => {
    const { parseRanglisten } = await import("../scraper");

    const html = `
<a id='STP'></a><H3>STP</H3>
Vereinslokal<br>
<PRE>

STP 1                    Stadtliga A		Di</pre><HR class='hr1'><pre>
   1	Mustermann, Max                2000 - 50	1950		Mannschaftsführer:
   2	Musterfrau, Erika              1800 - 30	1780		Max Mustermann
   3	Spieler, Drei                  1700 - 20	
   9	Ersatz, Einer                  1500 - 10	

Reserveliste</pre><HR class='hr1'><pre>
  11	Reserve, Spieler               1400 -  5	
</PRE>
`;

    const entries = parseRanglisten(html);
    const stpEntries = entries.filter((e) => e.clubKuerzel === "STP");

    expect(stpEntries.length).toBeGreaterThanOrEqual(4);

    const player1 = stpEntries.find((e) => e.ranglistennummer === "1");
    expect(player1).toBeDefined();
    expect(player1?.name).toBe("Mustermann, Max");
    expect(player1?.liga).toBe("Stadtliga");
    expect(player1?.isReserve).toBe(false);

    const reserve = stpEntries.find((e) => e.ranglistennummer === "11");
    expect(reserve).toBeDefined();
    expect(reserve?.isReserve).toBe(true);
  });

  it("parses a-number entries correctly", async () => {
    const { parseRanglisten } = await import("../scraper");

    const html = `
<a id='STP'></a><H3>STP</H3>
<PRE>

STP 1                    Bezirksliga A		Di</pre><HR class='hr1'><pre>
   1	Spieler, Eins                  1800 - 20	1780
   2	Spieler, Zwei                  1750 - 15	
   2a	Nachmeldung, Peter             1700 - 10	
</PRE>
`;

    const entries = parseRanglisten(html);
    const aEntry = entries.find(
      (e) => e.clubKuerzel === "STP" && e.isANummer
    );
    expect(aEntry).toBeDefined();
    expect(aEntry?.ranglistennummer).toBe("2a");
    expect(aEntry?.ranglistennummerBase).toBe(2);
    expect(aEntry?.isANummer).toBe(true);
  });
});
