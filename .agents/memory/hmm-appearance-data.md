---
name: HMM appearance data
description: How to retrieve HMM 2026 player appearances when individual Karteikarte links are blank.
---

The HMM 2026 player-specific `hmmkarteikarte.php` link can return HTTP 200 with only newlines, including when linked from the federation's own team results page. Do not interpret an empty response as zero appearances. The official `hmmeinzelspieler.php` team page contains the player's per-round results and is a working source for the count; count populated round cells and treat a missing player row as unavailable.

The checker intentionally excludes Landesliga from selectable leagues and from its §14 calculations.

**Why:** The direct card endpoint was blank for the supplied STP 6 example, while the official FC St. Pauli VI individual-results page showed six rounds for ranking 51. The user also explicitly excluded Landesliga from this checker and its §14 calculations.

**How to apply:** Resolve the team to its HMM results-page label and class code, parse the player row from its team page, and keep unavailable distinct from zero. Keep the supported league list and §14 scope aligned with the checker’s current rules.
