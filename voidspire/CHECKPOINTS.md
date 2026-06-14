# VOIDSPIRE — Save Points

Known-good versions you can always return to. To roll back, just tell Claude
**"restore checkpoint &lt;name&gt;"** (or paste the commit hash) and it will reset
the game code to exactly that version.

Each entry is a permanent snapshot: the commit lives in the branch history on
GitHub forever, so it can't be lost even if later changes break something. The
"Play (frozen)" link is that exact version, playable in a browser, forever.

| Checkpoint | Commit | Date | What's in it |
|---|---|---|---|
| **v1.7-events** | `9ccf04c` | 2026-06-14 | Events show your credits/HP and preview each choice's cost & reward; adds gambles, conditional "blue" options, curse removal, card-acquisition, and 7 new space-themed events. |
| **v1.6-augments** | `bc4db5f` | 2026-06-14 | Level-up redesigned as an Augment Protocol draft: random 3-of-~22, rarity-weighted & class-flavored, with modules, deck ops, and risk/reward pacts. Fixes the boring/OP fixed-stat menu. |
| **v1.5-relics** | `c412c50` | 2026-06-14 | 12 new artifacts incl. quest relics (complete a task → unlock a reward) and tradeoff/reactive relics. Map jump confirmation removed (single tap). |
| **v1.4-confirm** | `6c4056c` | 2026-06-14 | Tap → preview → confirm for every irreversible action (card purge/refine/dupe, reward, shop, level-up, relic, rest, map jumps). No more accidental one-tap commits. |
| **v1.3-mapart** | `2f8ea51` | 2026-06-14 | Restyles the star-chart map to the CRT/space aesthetic: translucent live backdrop, glowing hex nodes, sonar-ping reachable rings, constellation flight-path edges. |
| **v1.2-map** | `1acede5` | 2026-06-14 | Branching star-chart map per sector (pick your path through fights/events/shops/rests/elites/treasure to the boss), with distinct node icons. Retuned to hold the StS difficulty. |
| **v1.1-builds** | `316d309` | 2026-06-14 | Adds Slay-the-Spire-style build archetypes (Might/Exhaust, Shield/Echo, Burn/spam) and build-defining rares for "god runs". Fixes the power-reuse bug (powers are now consumed). |
| **v1.0-stable** | `9583880` | 2026-06-14 | Swipe-to-play combat, Slay-the-Spire-tuned balance, faction world-building, animated screen transitions, talking event portraits, artifact icons. First fully-polished version. |

### v1.7-events
- **Play (frozen):** https://rawcdn.githack.com/Sliekery/New-app/9ccf04c0613ec89405317fa08f479eca6c2ee3e0/voidspire/voidspire.html
- **Restore command (for reference):** `git checkout 9ccf04c -- voidspire`

### v1.6-augments
- **Play (frozen):** https://rawcdn.githack.com/Sliekery/New-app/bc4db5f682fec4b5ad4a93e5e9f22535a6993b39/voidspire/voidspire.html
- **Restore command (for reference):** `git checkout bc4db5f -- voidspire`

### v1.5-relics
- **Play (frozen):** https://rawcdn.githack.com/Sliekery/New-app/c412c5010439ae4009af1c76cb06e08e5129639e/voidspire/voidspire.html
- **Restore command (for reference):** `git checkout c412c50 -- voidspire`

### v1.4-confirm
- **Play (frozen):** https://rawcdn.githack.com/Sliekery/New-app/6c4056ccf7b9153cb34d5d15d66f59b6f47f9f4b/voidspire/voidspire.html
- **Restore command (for reference):** `git checkout 6c4056c -- voidspire`

### v1.3-mapart
- **Play (frozen):** https://rawcdn.githack.com/Sliekery/New-app/2f8ea51464485eb2667a8dfac5871e92377d6127/voidspire/voidspire.html
- **Restore command (for reference):** `git checkout 2f8ea51 -- voidspire`

### v1.2-map
- **Play (frozen):** https://rawcdn.githack.com/Sliekery/New-app/1acede579558862244bf3587df8cbabc2bb180fa/voidspire/voidspire.html
- **Restore command (for reference):** `git checkout 1acede5 -- voidspire`

### v1.1-builds
- **Play (frozen):** https://rawcdn.githack.com/Sliekery/New-app/316d30953976c376816e88644f137b8c926fe849/voidspire/voidspire.html
- **Restore command (for reference):** `git checkout 316d309 -- voidspire`

### v1.0-stable
- **Play (frozen):** https://rawcdn.githack.com/Sliekery/New-app/95838809c08f72988d31c899436f5d4d86986fce/voidspire/voidspire.html
- **Restore command (for reference):** `git checkout 9583880 -- voidspire`

---

#### How this works (plain version)
- Every time we finish something good, Claude saves it as a commit and adds a
  row here. That row is a bookmark to a frozen version.
- If a future change ruins the game, you lose **nothing** — say "go back to
  v1.0-stable" and the code returns to that exact state.
- The frozen Play link never changes, so you always have a working copy to
  compare against, even mid-experiment.
