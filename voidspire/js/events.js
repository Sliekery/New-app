/* =========================================================================
 * VOIDSPIRE — events.js
 *
 * THE EVENT ROLLS THE DIE IN YOUR POCKET.
 *
 * The old set of 25 is gone. Underneath their prose they were three shapes —
 * a hidden attribute check, a weighted gamble, a press-your-luck — and all
 * three resolved on a flat 1-20 that had nothing to do with the die the player
 * had spent the whole run cutting. There were zero references to run.die in the
 * entire resolver: the centrepiece of the game was not invited to its own
 * events. Worse, the attributes those checks read (MIGHT/TECH/PSI) were written
 * once at class creation and never moved again, so "TECH check, DC 13" mostly
 * resolved to "did you pick Technomancer".
 *
 * They also paid in the wrong currency. Credits, a random card, HP, a relic —
 * every one of those already falls out of fights, rests and the shop. The one
 * thing nothing else in the game trades in is ENGRAVINGS, FACES and SCARS.
 * That is the gap these fill.
 *
 * ---- schema ------------------------------------------------------------
 *   choices[]:
 *     label, sub, cost, cond          as before — credits and prerequisites
 *     die: { read, ... }              a DIE CHECK. `read` is one of:
 *          'cut'    -> onCut / onBlank, by whether the landed face is engraved
 *          'region' -> low / mid / high, by where it landed
 *          'face'   -> the landed faces FIRE, paid out as goods
 *     op: { k, ... }                  needs a second input from the player
 *     outcome: { text, fx }           resolves immediately
 *
 *   fx keys are the old set (credits, hp, maxhp, card, artifact, curse, pick)
 *   plus the die verbs — see applyOutcome in engine.js.
 * ========================================================================= */
(function (ns) {
  'use strict';

  // Compact vector glyphs in the house style. p: polylines, e: eyes, m: mouth.
  var ART = {
    wheel:   { c: '#ffb02e', p: [[0,-0.85, 0.74,-0.42, 0.74,0.42, 0,0.85, -0.74,0.42, -0.74,-0.42, 0,-0.85], [0,-0.5, 0,0.5], [-0.43,-0.25, 0.43,0.25], [-0.43,0.25, 0.43,-0.25]], e: [[0,0]] },
    scales:  { c: '#5dff88', p: [[0,-0.8, 0,0.7], [-0.7,-0.5, 0.7,-0.5], [-0.7,-0.5, -0.85,0.05, -0.55,0.05, -0.7,-0.5], [0.7,-0.5, 0.55,0.05, 0.85,0.05, 0.7,-0.5], [-0.35,0.7, 0.35,0.7]] },
    seam:    { c: '#41d8ff', p: [[-0.8,-0.6, -0.15,-0.6, -0.15,0.6, -0.8,0.6], [0.8,-0.6, 0.15,-0.6, 0.15,0.6, 0.8,0.6], [-0.15,-0.3, 0.15,-0.1], [-0.15,0.1, 0.15,0.3]] },
    hand:    { c: '#ffb02e', p: [[-0.45,0.75, -0.5,-0.1, -0.35,-0.15, -0.28,0.2], [-0.28,0.2, -0.22,-0.6, -0.05,-0.62, 0,0.2], [0,0.2, 0.08,-0.7, 0.25,-0.68, 0.28,0.2], [0.28,0.2, 0.4,-0.4, 0.55,-0.32, 0.45,0.75], [-0.45,0.75, 0.45,0.75]] },
    eye:     { c: '#c86bff', p: [[-0.85,0, -0.4,-0.5, 0.4,-0.5, 0.85,0, 0.4,0.5, -0.4,0.5, -0.85,0], [0,-0.28, 0.28,0, 0,0.28, -0.28,0, 0,-0.28]], e: [[0,0]] },
    bore:    { c: '#ffb02e', p: [[-0.3,-0.85, 0.3,-0.85, 0.3,0.1, 0,0.85, -0.3,0.1, -0.3,-0.85], [-0.3,-0.45, 0.3,-0.45], [-0.3,-0.05, 0.3,-0.05], [-0.6,-0.7, -0.3,-0.7], [0.6,-0.7, 0.3,-0.7]] },
    stone:   { c: '#5dff88', p: [[-0.75,0.4, -0.5,-0.5, 0.2,-0.75, 0.75,-0.2, 0.6,0.5, -0.75,0.4], [-0.5,-0.5, 0.15,0.0, 0.6,0.5], [0.2,-0.75, 0.15,0.0]] },
    ledger:  { c: '#ff4a5e', p: [[-0.6,-0.75, 0.6,-0.75, 0.6,0.75, -0.6,0.75, -0.6,-0.75], [-0.35,-0.45, 0.35,-0.45], [-0.35,-0.1, 0.35,-0.1], [-0.35,0.25, 0.1,0.25]] },
    ward:    { c: '#41d8ff', p: [[0,-0.85, 0.7,-0.45, 0.7,0.3, 0,0.85, -0.7,0.3, -0.7,-0.45, 0,-0.85], [0,-0.5, 0.38,-0.28, 0.38,0.15, 0,0.5, -0.38,0.15, -0.38,-0.28, 0,-0.5]] },
    frame:   { c: '#41d8ff', p: [[-0.75,-0.5, 0.75,-0.5, 0.75,0.5, -0.75,0.5, -0.75,-0.5], [-0.25,-0.5, -0.25,0.5], [0.25,-0.5, 0.25,0.5], [-0.75,0, 0.75,0]] },
    census:  { c: '#c86bff', p: [[-0.55,-0.8, 0.55,-0.8, 0.55,0.8, -0.55,0.8, -0.55,-0.8], [-0.3,-0.5, 0.3,-0.5], [-0.3,-0.15, 0.3,-0.15], [-0.3,0.2, 0.3,0.2], [-0.3,0.55, 0.0,0.55]] },
    twin:    { c: '#c86bff', p: [[-0.4,0, -0.4,-0.6, 0.4,-0.6, 0.4,0], [-0.4,0, -0.4,0.6, 0.4,0.6, 0.4,0], [-0.75,0, 0.75,0]], e: [[-0.15,-0.3],[0.15,0.3]] },
    toll:    { c: '#ff4a5e', p: [[-0.8,0.6, 0.8,0.6], [-0.5,0.6, -0.5,-0.6, 0.5,-0.6, 0.5,0.6], [-0.5,-0.2, 0.5,-0.2], [0,-0.6, 0,-0.85]] },
    engine:  { c: '#ff4a5e', p: [[-0.7,-0.35, 0.7,-0.35, 0.7,0.55, -0.7,0.55, -0.7,-0.35], [-0.4,-0.35, -0.4,-0.7, 0.4,-0.7, 0.4,-0.35], [-0.35,0.0, 0.35,0.0], [-0.35,0.28, 0.35,0.28]], e: [[-0.35,-0.52],[0.35,-0.52]] },
    market:  { c: '#ffb02e', p: [[-0.8,-0.35, 0.8,-0.35, 0.65,0.65, -0.65,0.65, -0.8,-0.35], [-0.8,-0.35, -0.5,-0.75, 0.5,-0.75, 0.8,-0.35], [-0.25,-0.35, -0.25,0.65], [0.25,-0.35, 0.25,0.65]] },
    proving: { c: '#ffb02e', p: [[0,-0.8, 0.7,-0.35, 0.7,0.4, 0,0.85, -0.7,0.4, -0.7,-0.35, 0,-0.8], [-0.35,0, 0.35,0], [0,-0.35, 0,0.35], [-0.2,-0.2, 0.2,0.2], [-0.2,0.2, 0.2,-0.2]] },
    student: { c: '#5dff88', p: [[-0.55,-0.15, 0,-0.55, 0.55,-0.15, 0,0.25, -0.55,-0.15], [0.55,-0.15, 0.55,0.3], [-0.35,0.05, -0.35,0.5, 0,0.7, 0.35,0.5, 0.35,0.05]] },
  };

  ns.EVENTS = [

    /* ================= THE REFORGE — the good events ==================== */
    {
      id: 'pattern_shop', title: 'THE PATTERN SHOP', art: ART.wheel,
      text: "A long bench under a single lamp, and a woman who does not look up. “I do not cut new work,” she says. “I rewrite old work. Put it down and roll — I will take whatever the die is proudest of today.”",
      choices: [
        { label: 'Roll, and let her rewrite it', sub: 'A cut face is rewritten three ways — you choose',
          die: { read: 'cut',
            onCut:   { text: 'She turns the face to the lamp and reads it back to you three different ways.', fx: { reforge: 'rolled' } },
            onBlank: { text: 'Blank. She sighs and lets you name a face instead. “I am not here to watch you waste an afternoon.”', fx: { reforge: 'pick' } } } },
        { label: 'Name the face yourself', sub: '¢45 — no roll, your choice', cost: 45,
          outcome: { text: 'She takes the scrip without comment and waits for you to point.', fx: { reforge: 'pick' } } },
        { label: 'Leave the bench', outcome: { text: 'She goes back to whatever she was doing before you were there.', fx: {} } },
      ],
    },
    {
      id: 'tuning_fork', title: 'THE TUNING FORK', art: ART.scales,
      cond: { hasBand: true },
      text: "He strikes a fork against the bench and holds it near your die. One band answers — three faces humming together. “That,” he says, “is the wrong shape. Not wrong work. Wrong SHAPE.”",
      choices: [
        { label: 'Let him reshape it', sub: 'Rewrite a band — three ways, your pick', cond: { hasBand: true },
          outcome: { text: 'He works the whole run of it at once, which is not how anyone else does this.', fx: { reforge: 'band' } } },
        { label: 'Ask for the narrow cut', sub: 'Collapse a band into one face at full strength', cond: { hasBand: true },
          outcome: { text: 'Three faces of quiet work, poured into one.', fx: { bandCollapse: true } } },
        { label: 'Leave it humming', outcome: { text: 'The fork goes quiet on its own eventually.', fx: {} } },
      ],
    },
    {
      id: 'listeners_guild', title: 'THE LISTENERS’ GUILD', art: ART.ward,
      text: "Nobody in this room is talking. They are all waiting for something and they have been trained to wait for different things. “A face that fires on a number,” one signs at you, “fires on one number in twenty. We can do better than a number.”",
      choices: [
        { label: 'Have a face taught to listen', sub: 'It fires on a trigger you pick, at reduced strength',
          outcome: { text: 'They take the face apart and put it back with an ear on it.', fx: { reforge: 'listen' } } },
        { label: 'Have a listener taught to shut up', sub: 'A listener becomes a plain face at +60%', cond: { hasListener: true },
          outcome: { text: 'It stops waiting for permission. It just goes off.', fx: { unlisten: true } } },
        { label: 'Say nothing', outcome: { text: 'You leave the way you came, quietly, which they appreciate.', fx: {} } },
      ],
    },

    /* ================= THE BARGAIN — three evils ======================== */
    {
      id: 'the_toll', title: 'THE TOLL', art: ART.toll,
      text: "The corridor narrows to a booth, and the booth is occupied, and the occupant has a ledger with your name already in it. “Everyone pays,” it says, without malice. “The only choice is the column.”",
      choices: [
        { label: 'Pay in blood', sub: 'Lose a quarter of your health — and grow',
          outcome: { text: 'It takes what it needs and writes something in the margin. You feel it settle, and then you feel larger.', fx: { hpPct: -0.25, maxhp: 8 } } },
        { label: 'Pay in craft', sub: 'A cut face takes Rust — and ¢120',
          outcome: { text: 'It reaches past you to the die and puts one finger on a face. The scrip arrives before the damage does.', fx: { scarRandom: 'rust', credits: 120 } } },
        { label: 'Pay in time', sub: 'Skip the next reward — the one after is doubled',
          outcome: { text: 'You lose an afternoon you will not get back, and arrive somewhere far more generous than you deserved.', fx: { skipRewards: 1, doubleNextReward: true } } },
      ],
    },
    {
      id: 'the_inquisitor', title: 'THE INQUISITOR', art: ART.eye,
      text: "It has already read your die. It did not need to hold it. “Three faces,” it says, “are doing most of the work. I am going to take one of them, and you are going to tell me which, because I would rather you knew.”",
      choices: [
        { label: 'The strongest', sub: 'Your highest-tier engraving goes blank',
          outcome: { text: 'It takes the best thing on the die and does not explain what for.', fx: { blankBest: true } } },
        { label: 'The busiest', sub: 'Your most-fired face takes Cold Weld',
          outcome: { text: 'The face you have leaned on all run seizes closed. It will not open again this sector.', fx: { scarMostFired: 'cold_weld' } } },
        { label: 'The best-placed', sub: 'Your best-paying face stops bleeding to its neighbours',
          outcome: { text: 'It severs something you cannot see, and the face goes quiet at the edges.', fx: { scarBest: 'dead_short' } } },
        { label: 'Refuse, and fight it', sub: 'An elite, now — no reward but the face you kept',
          outcome: { text: 'You put your hand flat over the die. It seems almost pleased.', fx: { fightElite: true } } },
      ],
    },
    {
      id: 'the_quarantine', title: 'THE QUARANTINE', art: ART.engine,
      text: "Something came aboard at the last stop and the seals have already made their decision. A panel is counting down in a language with no word for negotiation. Three compartments. You keep two.",
      choices: [
        { label: 'Burn the hold', sub: 'Lose all credits — take a relic out of the ash',
          outcome: { text: 'Everything liquid goes up. What is left is solid, and yours.', fx: { creditsAll: true, artifact: true } } },
        { label: 'Burn the deck', sub: 'Take 2 curses — and a rare card',
          outcome: { text: 'You decide personally what gets to stay wrong with you. It is not a comfort, exactly.', fx: { curse: 'void_taint', curse2: 'void_taint', card: 'rare' } } },
        { label: 'Burn the die', sub: 'Every scar spreads — every scarred face gains a tier',
          outcome: { text: 'The rot walks outward one face in every direction, and everything it has already touched comes back harder.', fx: { scarSpread: true, tierUpScarred: true } } },
      ],
    },
    {
      id: 'starving_engine', title: 'THE STARVING ENGINE', art: ART.bore,
      text: "It is not a machine that does anything. It is a machine that is hungry, bolted to a wall that has been repaired around it many times. The plate says FEED, and then a word somebody scratched out.",
      choices: [
        { label: 'Feed it a face', sub: 'Blank one — it comes back at +2 tiers next sector',
          outcome: { text: 'The face goes smooth under your thumb. Something in the wall starts working on it.', fx: { blankPick: 1, returnUpgraded: 2 } } },
        { label: 'Feed it your body', sub: '−30% max HP this sector · +2 Energy every combat',
          outcome: { text: 'You are lighter afterwards in every sense, and something is running that was not running before.', fx: { sectorMaxHpPct: -0.3, sectorEnergy: 2 } } },
        { label: 'Feed it your future', sub: 'Skip the next 2 events — ¢250 now',
          outcome: { text: 'It pays in old scrip, immediately, and takes two things that had not happened yet.', fx: { credits: 250, skipEvents: 2 } } },
      ],
    },

    /* ================= THE PURSE — credits, on your die ================= */
    {
      id: 'honest_gambler', title: 'THE HONEST GAMBLER', art: ART.hand,
      text: "He does not touch your die. That is the whole pitch and he makes it before you have sat down. “You roll it. I only say what it was worth. If I ever touch it, walk away from me.”",
      choices: [
        { label: 'Take the wager', sub: 'Stake ¢30 — a cut face pays ¢90 and fires', cost: 30,
          die: { read: 'cut',
            onCut:   { text: 'The face lands lit. He counts it out without looking at the die once.', fx: { credits: 90, fireFace: true } },
            onBlank: { text: 'Blank. He does not gloat, which is somehow worse.', fx: {} } } },
        { label: 'Ask what he sees', sub: 'Free — he counts your blanks, then offers one for ¢45',
          outcome: { text: '“That many still asking. It is not a criticism, it is a number.”', fx: { countBlanks: true, offerCut: 45 } } },
        { label: 'Refuse the roll', sub: 'He tells you the count anyway',
          outcome: { text: '“Wise. You do not know your own numbers yet. Most do not, and most keep rolling.”', fx: { countBlanks: true } } },
      ],
    },
    {
      id: 'long_odds', title: 'THE LONG ODDS', art: ART.market,
      text: "A felt table and a chalked board, and a house that is scrupulously, boringly fair. This is not your die. Nothing you have built matters here, and that is exactly the appeal.",
      choices: [
        { label: 'Call a region', sub: 'Stake ¢40 · name LOW, MID or HIGH · pays 3:1', cost: 40,
          op: { k: 'betRegion', pay: 3, stake: 40 } },
        { label: 'Call a face', sub: 'Stake ¢25 · name one number · pays 20:1', cost: 25,
          op: { k: 'betFace', pay: 20, stake: 25 } },
        { label: 'Watch a few hands', outcome: { text: 'The board is honest. You watch it be honest for a while and then leave.', fx: {} } },
      ],
    },
    {
      id: 'face_market', title: 'THE FACE MARKET', art: ART.market,
      text: "A trading floor for work nobody should be able to sell. Prices are chalked by tier and they move while you watch. Two lots a visitor, and the men here mean it.",
      choices: [
        { label: 'Sell up to two faces', sub: 'Tier 1 ¢40 · tier 2 ¢85 · tier 3 ¢150',
          outcome: { text: 'The lots go up. Somebody bids without looking. The faces go smooth.', fx: { sellFaces: 2 } } },
        { label: 'Sell a scarred one', sub: 'Half price — but the scar leaves with it', cond: { hasScar: true },
          outcome: { text: 'They take it at a discount and seem relieved to have it off the floor.', fx: { sellScarred: 1 } } },
        { label: 'Nothing is for sale', outcome: { text: '“Everything is. You are quoting us a price of infinity.”', fx: {} } },
      ],
    },

    /* ================= THE TABLE — swap and fuse ======================== */
    {
      id: 'the_pivot', title: 'THE PIVOT', art: ART.frame,
      cond: { minEngravings: 2 },
      text: "Two clamps on a turntable, and a machinist who charges nothing because she is not doing you a favour. “Same work. Different seats. You would be amazed how much that is worth.”",
      choices: [
        { label: 'Swap two faces', sub: 'Exchange the engravings on any two — free',
          outcome: { text: 'She lifts both at once and sets them down the other way round.', fx: { swapFaces: true } } },
        { label: 'Swap across the table', sub: 'One low, one high — and ¢50 for rebalancing it', cond: { canCrossSwap: true },
          outcome: { text: '“You had all your weight at one end. That is worth paying to fix.”', fx: { swapFaces: 'cross', credits: 50 } } },
        { label: 'Let the table choose', sub: 'Two at random swap — ¢90 for the nerve',
          outcome: { text: 'She spins it, lets it stop where it stops, and pays you for not flinching.', fx: { swapRandom: true, credits: 90 } } },
      ],
    },
    {
      id: 'the_crucible', title: 'THE CRUCIBLE', art: ART.stone,
      cond: { minEngravings: 2 },
      text: "The pot is already lit and has been for a long time. “Two in,” says the smith without turning round. “One out. What comes out depends entirely on what you put in, so think about it, or do not.”",
      choices: [
        { label: 'Fuse two engravings', sub: 'Two in, one out — the pairing decides what',
          outcome: { text: 'They go in separately and stop being separate.', fx: { fuseFaces: true } } },
        { label: 'Ask what a pairing makes', sub: 'Free — she names the rule before you commit',
          outcome: { text: '“Two shields make a wall. Two blades make a longer blade. One of each makes something I do not have a name for.”', fx: { fusePreview: true } } },
        { label: 'Keep them apart', outcome: { text: 'She shrugs at the fire. The fire does not care either.', fx: {} } },
      ],
    },
    {
      id: 'the_migration', title: 'THE MIGRATION', art: ART.frame,
      cond: { minEngravings: 1 },
      text: "A quiet room with a jig in it and a note pinned to the wall: ONE MOVE, NO CHARGE, DO NOT ASK WHY. There is nobody here. The jig works anyway.",
      choices: [
        { label: 'Move one engraving', sub: 'Any face to any face — free, no catch',
          outcome: { text: 'It lifts clean and seats clean, which almost never happens.', fx: { migrateFace: true } } },
        { label: 'Leave the note alone', outcome: { text: 'You have a feeling about rooms like this. You keep it.', fx: {} } },
      ],
    },
    {
      id: 'the_mirror', title: 'THE MIRROR CELL', art: ART.twin,
      cond: { minEngravings: 1 },
      text: "Two plates facing each other with your die between them, and a technician who talks about faces as though they came in pairs and always had. “Ten apart is not far. Ten apart is across the room.”",
      choices: [
        { label: 'Copy a face to its opposite', sub: 'Face n also lands on n+10 — both drop a tier',
          outcome: { text: 'The work appears on the far side thinner than it went in, but it is unmistakably the same work.', fx: { mirrorFace: true } } },
        { label: 'Ask about your pairs', sub: 'Free — she names your emptiest opposite pair',
          outcome: { text: 'She reads both sides at once and tells you where you have been building on one leg.', fx: { reportPairs: true } } },
        { label: 'Take it out of the frame', outcome: { text: 'The plates go on facing each other without you.', fx: {} } },
      ],
    },

    /* ================= THE FRAME and the floor ========================== */
    {
      id: 'the_fitter', title: 'THE FITTER', art: ART.frame,
      text: "She fits cores. She has an opinion about how many you ought to be carrying, it is not the same as yours, and she is going to tell you which of you is wrong.",
      choices: [
        { label: 'Take the extra seat', sub: '+1 Core slot — two faces of your choice go blank',
          cond: { minEngravings: 2, coreRoom: true },
          outcome: { text: 'She makes the room by taking it out of somewhere else. That is what room is.', fx: { coreSlots: 1, blankPick: 2 } } },
        { label: 'Give up a seat', sub: '−1 Core slot · a tier-3 cut where you like it · ¢60',
          cond: { freeCoreSlot: true },
          outcome: { text: 'She pulls the seat, hands you the scrip, and cuts you something good with the spare weight.', fx: { coreSlots: -1, grantEngraving: 3, credits: 60 } } },
        { label: 'Leave the frame alone', outcome: { text: '“Suit yourself. It is your back.”', fx: {} } },
      ],
    },
    {
      id: 'blank_census', title: 'THE BLANK CENSUS', art: ART.census,
      text: "The census does not count what you have. It counts what you do not, which it says is the only honest way to count anything. “Twenty faces,” it reads off the form. “How many are still asking?”",
      choices: [
        { label: 'Answer honestly', sub: '¢14 for every blank face',
          outcome: { text: 'It writes the number down and pays out against it without a flicker.', fx: { creditsPerBlank: 14 } } },
        { label: 'Ask them to fill one', sub: 'A free tier-1 cut for every 6 blanks you carry',
          outcome: { text: 'A clerk is dispatched. The clerk is very fast and does not ask what you wanted.', fx: { cutPerBlanks: 6 } } },
        { label: 'Refuse the count', sub: 'Roll — a cut face pays ¢60, a blank costs you Rust',
          die: { read: 'cut',
            onCut:   { text: 'It reads the face, decides you are not worth the paperwork, and pays you to go.', fx: { credits: 60 } },
            onBlank: { text: 'It writes something down. Something on the die goes slightly wrong in the days after.', fx: { scarRandom: 'rust' } } } },
      ],
    },
    {
      id: 'the_understudy', title: 'THE UNDERSTUDY', art: ART.student,
      cond: { minEngravings: 1 },
      text: "Someone your size, carrying your die. Not one like it — it. Twenty faces with entirely different work done on them, by somebody who made every decision you did not.",
      choices: [
        { label: 'Take one of its faces', sub: 'Its work replaces yours on a face you pick',
          outcome: { text: 'You take the road you did not take, and it seats as though it had always been there.', fx: { stealFace: true } } },
        { label: 'Let it take one of yours', sub: 'It pays ¢140 for the privilege',
          outcome: { text: 'It studies your work for a long time before choosing, and pays without haggling.', fx: { giveFace: 140 } } },
        { label: 'Compare tables', sub: 'Free — it names the weakest region of your die',
          outcome: { text: '“There,” it says, pointing at nothing you can see. “That is where you have been getting away with it.”', fx: { reportWeakRegion: true } } },
      ],
    },
    {
      id: 'the_apprentice', title: 'THE APPRENTICE', art: ART.student,
      cond: { minEngravings: 2 },
      text: "A kid with good hands and no die of their own, which is the situation everyone was in once. They want to be taught one thing. They are quite specific that it should be a thing you are good at.",
      choices: [
        { label: 'Teach one away', sub: 'It leaves your die — every engraving of the same kind gains a tier',
          outcome: { text: 'Explaining it out loud does something to the rest of the work. It always does.', fx: { teachAway: true } } },
        { label: 'Teach the basics instead', sub: '¢80 for an afternoon',
          outcome: { text: 'You show them how to hold the tool. They pay from a purse that is clearly all of it.', fx: { credits: 80 } } },
        { label: 'You have somewhere to be', outcome: { text: 'They say they understand. They are being polite.', fx: {} } },
      ],
    },
    {
      id: 'proving_ground', title: 'THE PROVING GROUND', art: ART.proving,
      text: "A range, a target, and a rack of dice belonging to people who tried. “Three rolls,” says the marshal. “Whatever your faces do, they do it at that. Beat the number and the rack stays as it is.”",
      choices: [
        { label: 'Take the three rolls', sub: 'Each cut face fires at the target — beat it for a relic',
          die: { read: 'face', rolls: 3,
            onWin:  { text: 'The marshal walks the distance, looks, and comes back with something off the rack.', fx: { artifact: true } },
            onLose: { text: 'It is not close enough. The marshal is kind about it, which is worse.', fx: { credits: 25 } } } },
        { label: 'Ask what the number is', sub: 'Free — and whether your die can make it',
          outcome: { text: 'The marshal reads the target aloud, then reads your die, then says nothing for a moment.', fx: { reportProving: true } } },
        { label: 'Leave the rack alone', outcome: { text: 'Somebody else will try it today. Somebody does every day.', fx: {} } },
      ],
    },
    {
      id: 'the_seam', title: 'THE SEAM', art: ART.seam,
      text: "Where twenty touches one there is a join. The join is old, and something has been working at it from the other side for a long time, and tonight it is close enough to hear.",
      choices: [
        { label: 'Weld it shut', sub: 'Either of 20 or 1 fires both — both take Feedback',
          outcome: { text: 'The two faces stop being two faces. Something on the other side stops working and starts listening.', fx: { weldSeam: true } } },
        { label: 'Prise it open', sub: 'Roll — land on 20 or 1 and the work copies clean',
          die: { read: 'seam',
            onWin:  { text: 'It comes open exactly where you wanted. The work stands on both sides of the join, clean.', fx: { seamCopy: true } },
            onLose: { text: 'It comes open somewhere else instead, and something reaches through the gap.', fx: { scarRandom: 'rust' } } } },
        { label: 'Leave the seam alone', outcome: { text: 'You put the die away. The sound does not entirely stop.', fx: {} } },
      ],
    },
  ];

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
