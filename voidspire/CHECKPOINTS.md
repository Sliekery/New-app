# VOIDSPIRE — Save Points

Known-good versions you can always return to. To roll back, just tell Claude
**"restore checkpoint &lt;name&gt;"** (or paste the commit hash) and it will reset
the game code to exactly that version.

Each entry is a permanent snapshot: the commit lives in the branch history on
GitHub forever, so it can't be lost even if later changes break something. The
"Play (frozen)" link is that exact version, playable in a browser, forever.

| Checkpoint | Commit | Date | What's in it |
|---|---|---|---|
| **v1.1-builds** | `316d309` | 2026-06-14 | Adds Slay-the-Spire-style build archetypes (Might/Exhaust, Shield/Echo, Burn/spam) and build-defining rares for "god runs". Fixes the power-reuse bug (powers are now consumed). |
| **v1.0-stable** | `9583880` | 2026-06-14 | Swipe-to-play combat, Slay-the-Spire-tuned balance, faction world-building, animated screen transitions, talking event portraits, artifact icons. First fully-polished version. |

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
