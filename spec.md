# Spec: HSV Spielberechtigung Checker

## Problem Statement

Chess players in the Hamburger Schachverband (HSV) need to know whether they are eligible to play for a specific team in a given round of the Hamburger Mannschaftsmeisterschaft (HMM). The eligibility rules in §13–§16 of the HSV Turnierordnung are complex and error-prone to apply manually. This app provides a form where a user enters a player's ranking list number and selects a club and target league, and the app determines eligibility based on the current season's ranking list data scraped from the HSV website.

---

## Requirements

### Functional Requirements

#### Form Fields

1. **Ranglistennummer** — numeric input. The player's position number on their club's ranking list (e.g. `3` for the 3rd player of a team).
2. **Mannschaft** — dropdown of all 39 HSV member clubs, default value: `FC St. Pauli von 1910 e.V., Schachabteilung`. Sorted alphabetically.
3. **Liga** — dropdown of the target league the player wants to play in. Values (per §11):
   - Landesliga
   - Stadtliga
   - Bezirksliga
   - Kreisliga
   - Kreisklasse
   - Basisklasse

#### Data Source

- Player ranking list data is scraped from the HSV HMM 2026 ranking list page:  
  `https://www.hamburger-schachverband.de/hmm2026/hmm2026_ranglisten.htm`
- Scraped data is fetched at app startup (or on demand via a "Daten aktualisieren" button) and cached in memory.
- The scraper runs server-side (Next.js API route or similar) to avoid CORS issues.

#### Eligibility Rules (§13–§16)

The app evaluates the following rules in order and returns a verdict with an explanation.

**§13 — Ranglisten (Ranking List Order)**
- A player must be registered in the ranking list of the selected club.
- The ranking list number determines the board order. A player may only play at their designated board position; no board swaps are permitted.
- The 1st team of a club holds positions 1–8 (+ up to 2 substitutes: 9, 10).
- The 2nd team holds positions 11–18 (+ 19, 20), and so on in increments of 10.
- Youth players (≤20 years at registration deadline) may extend a team's roster at positions 17 and 18.
- In the Landesliga, only players registered specifically for the Landesliga team may play; no late registrations (Nachmeldungen) are possible.

**§14 — Einsatz von Spielern der Bundesligen, Oberliga-Nord und Landesliga**
- A player who has been used as a substitute in the Bundesliga, Oberliga-Nord, or Landesliga loses eligibility for the same round number in all lower-ranked teams.
- A player who has been used as a substitute **three times** in the Bundesliga, Oberliga-Nord, or Landesliga may no longer play in any lower-ranked team from that round onward.
- For leagues with double match-day weekends: the restriction applies to the entire weekend, not just the same round number.
- A Landesliga player who has not yet played 3 times in higher leagues may still play in the Landesliga, but their combined appearances in the Landesliga and higher leagues must not exceed 9 total.

**§15 — Einsatz von Ersatzspielern in der Stadtliga bis zur letzten Spielklasse**
- A substitute player from a lower-ranked team or reserve list may be used in a higher-ranked team.
- Each such player must be inserted according to their ranking list number.
- A player from a lower class or the reserve list may be used as a substitute in a higher class **at most 3 times total**.
- No player may be fielded for multiple teams playing in the same class or parallel classes.
- Reserve players (§13 Abs. 2) may play in the lowest-ranked team without limit, but only 3 times in higher-ranked teams.
- Special rule when multiple teams of the same club play in the same or parallel classes (and are the club's last teams): substitute eligibility is calculated as if the teams were in different classes according to their numerical order.

**§16 — Nachmeldungen (Late Registrations)**
- Each club may register one player per team with an "a-number" (e.g. `2a`), provided a preliminary play permit has been requested from the Landesturnierleiter, or the player holds a valid DSB play permit.
- The a-number player is inserted directly behind the player with the same base number (e.g. `2a` behind `2`).
- An a-number player is only eligible for the specific team they were registered for.
- Late registrations are excluded for Landesliga teams.
- If a player on a Stadtliga–Kreisklasse team dies during the season, the club may register one additional a-number player below the deceased player's position.
- Any number of reserve players may be added at any time; they are appended to the end of the ranking list.
- Late registrations must be submitted no later than the day of the player's first appearance.

#### Verdict Output

After submitting the form, the app displays:

- ✅ **Spielberechtigt** — the player is eligible, with a brief explanation of which rules were checked.
- ❌ **Nicht spielberechtigt** — the player is not eligible, with a specific reason citing the relevant paragraph (e.g. "§14: Spieler wurde bereits 3× in der Landesliga eingesetzt").
- ⚠️ **Eingeschränkt spielberechtigt** — eligible with conditions (e.g. "§15: Darf höchstens noch 1× als Ersatzspieler eingesetzt werden").

The explanation is shown in German.

---

## Acceptance Criteria

1. The form renders with all three fields; Mannschaft defaults to `FC St. Pauli von 1910 e.V., Schachabteilung`.
2. The Mannschaft dropdown lists all 39 HSV member clubs, sorted alphabetically.
3. The Liga dropdown lists all 6 league levels from §11.
4. Submitting the form with a valid Ranglistennummer, Mannschaft, and Liga returns a verdict within 3 seconds.
5. The verdict correctly applies all rules from §13–§16 based on the scraped ranking list data.
6. If the player's Ranglistennummer is not found in the selected club's ranking list, the app shows an appropriate error message.
7. The scraper successfully parses the HMM 2026 ranking list page and extracts player positions, team assignments, and substitute usage counts.
8. A "Daten aktualisieren" button allows the user to re-fetch the latest ranking list data.
9. The app is in German (labels, verdicts, error messages).
10. The app is responsive and usable on mobile.

---

## Implementation Approach

1. **Project setup** — Initialize a React + TypeScript app (Vite or Next.js). If Next.js: use API routes for the scraper to avoid CORS.
2. **HSV scraper** — Write a server-side scraper that fetches and parses `hmm2026_ranglisten.htm`. Extract per-club ranking lists: player name, Ranglistennummer, team number, league, substitute usage count. Cache result in memory with a timestamp.
3. **Data model** — Define TypeScript types: `Club`, `Player`, `RankingEntry`, `EligibilityResult`.
4. **Club list** — Hard-code the 39 HSV clubs (from `vereine.htm`) as a static array for the dropdown.
5. **Eligibility engine** — Implement a pure function `checkEligibility(player, targetLeague, allData): EligibilityResult` that applies §13–§16 rules in sequence.
6. **Form component** — Build the form with the three fields (Ranglistennummer, Mannschaft, Liga), validation, and submit handler.
7. **Result component** — Display the verdict (✅/❌/⚠️) with the German explanation text.
8. **Styling** — Clean, minimal UI. Use HSV colors (green/white) as accent.
9. **Testing** — Unit tests for the eligibility engine covering key rule scenarios from each paragraph.
10. **Integration** — Wire form → scraper API → eligibility engine → result display.

---

## HSV Club List (39 clubs)

| Kürzel | Name |
|--------|------|
| ALT | Altonaer Schachklub v. 1873 e. V. |
| BAR | Stadtpark Barrio 1996 e. V. |
| BBK | Barmbeker Schachklub von 1926 e. V. |
| BGD | Bergedorfer Schachverein von 1909 e. V. |
| BIL | Spvg. Billstedt-Horn v. 1891 e. V., Schachabteilung |
| BLA | Schachvereinigung Blankenese von 1923 e. V. |
| BSC | Bille Schach-Club von 1924 e. V. |
| BSG | TSG Bergedorf von 1860 e. V. |
| BSK | Bramfelder Schachklub von 1947 e. V. |
| BST | Bergstedter Schachklub von 1962 |
| CON | Wandsbeker TSV Concordia e. V. |
| DIA | Schachverein Diagonale Harburg e. V. |
| DIO | Schachclub Diogenes von 1977 e. V. |
| FAR | Schach-Club Farmsen e. V. |
| FBK | Schachgrp. Süderelbe im TV Fischbek v. 1921 e. V. |
| GEH | Hamburger Gehörlosen Sportverein v. 1904 e. V. |
| GHD | SV Großhansdorf, Schachabteilung |
| HBG | Schachclub Schwarz-Weiß Harburg e. V. |
| HSK | Hamburger Schachklub von 1830 e. V. |
| KSP | Schachclub Königsspringer Hamburg v. 1984 e. V. |
| LGH | Langenhorner Schachfreunde von 1928 e. V. |
| LUP | Sportverein Lurup v. 1923 e. V., Schachabteilung |
| MAT | Schachklub Marmstorf im SV Grün-Weiß Harburg e. V. |
| MUE | Mümmelmannsberger SV v. 1974 e. V., Schachabteilung |
| NIE | Niendorfer TSV v. 1919 e. V., Schachabteilung |
| PIN | Pinneberger Schachclub von 1932 e. V. |
| ROE | SC Rösselsprung e. V. |
| SAS | Schachfreunde Sasel von 1947 e. V. |
| SFR | Schachfreunde Hamburg von 1934 e. V. |
| SKJ | Schachklub Johanneum Eppendorf e. V. |
| SSH | Schachclub Schachelschweine e. V. |
| STE | SC Sternschanze v. 1911 e. V. |
| STP | FC St. Pauli von 1910 e. V., Schachabteilung *(default)* |
| SVE | SV Eidelstedt von 1880 e. V. |
| UNE | Schachklub Union Eimsbüttel von 1871 e. V. |
| VDF | Volksdorfer Schachklub von 1948 e. V. |
| WDF | Walddörfer SV v. 1924 e. V. |
| WED | Schachfreunde Wedel e. V. |
| WEI | Schachklub Weisse Dame Hamburg |
| WIC | SGM Wichernschule |
