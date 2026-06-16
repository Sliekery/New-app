/* =========================================================================
 * VOIDSPIRE — events.js
 * Short decision events. Choices may carry a d20 skill check:
 *   check: {attr:'might'|'tech'|'psi', dc} -> roll d20 + attr (+artifacts)
 * Outcome fx keys: hp (+/-), healPct, maxhp, credits, attr ('might'|'tech'|
 *   'psi'|'random'), card ('random'|'rare'|id), artifact (true), curse (id),
 *   pick ('remove'|'upgrade'|'dupe')
 * ========================================================================= */
(function (ns) {
  'use strict';

  ns.EVENTS = [
    {
      id: 'sabacc_den', title: 'SABACC DEN', gambleDen: true,
      art: { c: '#ffb02e', p: [[-0.7,-0.6, 0.7,-0.6, 0.7,0.6, -0.7,0.6, -0.7,-0.6], [-0.4,-0.3, -0.4,0.3], [0,-0.3, 0,0.3], [0.4,-0.3, 0.4,0.3], [-0.55,0, 0.55,0]], e: [[-0.4,0],[0.4,0]], m: [-0.12,0.3, 0.12,0.3] },
      text: 'A back-room game runs hot behind a salvage bar — a cup of bones, a battered wheel, a deck of marked cards. The house grins through a cracked rebreather. "Care to test your luck, traveler? Stake your scrip — the bolder the bet, the richer the prize."',
    },
    {
      id: 'cryopod', title: 'DERELICT CRYOPOD',
      art: { c: '#41d8ff', p: [[-0.55,-0.95, 0.55,-0.95, 0.7,-0.3, 0.7,0.7, -0.7,0.7, -0.7,-0.3, -0.55,-0.95], [-0.4,-0.7, 0.4,-0.7, 0.45,0.1, -0.45,0.1, -0.4,-0.7], [-0.18,-0.45, 0.18,-0.45, 0.22,-0.1, 0,0.02, -0.22,-0.1, -0.18,-0.45], [0.45,-0.55, 0.62,-0.6], [-0.45,-0.25, -0.62,-0.15], [-0.5,0.4, 0.5,0.4]], e: [[-0.08,-0.3],[0.08,-0.3]], m: [-0.07,-0.1, 0.07,-0.1] },
      text: 'A cracked cryopod hums in the wreckage of a troop carrier. Something — or someone — is still sealed inside. The lock panel sparks.',
      choices: [
        { label: 'Hack the lock', sub: 'TECH check, DC 12', check: { attr: 'tech', dc: 12 },
          success: { text: 'The pod hisses open. Inside: a long-dead officer clutching a relic of the old fleet.', fx: { artifact: true } },
          fail: { text: 'The panel discharges into your hands. The pod stays sealed.', fx: { hp: -8 } } },
        { label: 'Pry it open', sub: 'MIGHT check, DC 13', check: { attr: 'might', dc: 13 },
          success: { text: 'Metal screams. You haul out a crate of fleet scrip and supplies.', fx: { credits: 55, hp: -3 } },
          fail: { text: 'The pod ruptures, venting cryo-gas across your armor.', fx: { hp: -10, credits: 15 } } },
        { label: 'Leave it', outcome: { text: 'Some doors are sealed for a reason. You move on.', fx: {} } },
      ],
    },
    {
      id: 'salvage_drone', title: 'SALVAGE DRONE',
      art: { c: '#ffb02e', p: [[-0.6,-0.35, 0.6,-0.35, 0.6,0.45, -0.6,0.45, -0.6,-0.35], [-0.6,-0.05, 0.6,-0.05], [-0.2,-0.35, -0.2,0.45], [0.2,-0.35, 0.2,0.45], [-0.4,-0.35, -0.52,-0.7], [0.4,-0.35, 0.52,-0.7], [-0.52,-0.7, 0.52,-0.7]], e: [[0,0.2]], m: [-0.14,0.34, 0.14,0.34] },
      text: 'A battered logistics drone, its faction markings scoured off, blocks the corridor. It chirps and unfolds a tray of scavenged ordnance and strange off-doctrine salvage-tech — yours, for scrip or a favor.',
      choices: [
        { label: 'Buy salvage', sub: '¢40', cost: 40, outcome: { text: 'The drone takes the scrip and disgorges a piece of tech no faction would admit to making.', fx: { card: 'colorless' } } },
        { label: 'Strip it for parts', sub: 'TECH check, DC 13', check: { attr: 'tech', dc: 13 },
          success: { text: 'You crack the housing and pull the good stuff for free.', fx: { card: 'colorless' } },
          fail: { text: 'It discharges a capacitor into your gauntlet and trundles off.', fx: { hp: -9 } } },
        { label: 'Wave it off', outcome: { text: 'You have no use for someone else’s junk. It rolls away into the dark.', fx: {} } },
      ],
    },
    {
      id: 'wounded_marine', title: 'WOUNDED MARINE',
      art: { c: '#5dff88', p: [[-0.55,-0.5, -0.45,-0.85, 0.45,-0.85, 0.55,-0.5, 0.55,0.0, 0.4,0.2, -0.4,0.2, -0.55,0.0, -0.55,-0.5], [-0.4,-0.5, 0.4,-0.5, 0.35,-0.15, -0.35,-0.15, -0.4,-0.5], [0.15,-0.85, 0.05,-0.5, 0.2,-0.32], [-0.85,0.7, -0.6,0.32, 0.6,0.32, 0.85,0.7], [-0.3,0.45, -0.1,0.45]], e: [[-0.15,-0.32],[0.15,-0.32]], m: [-0.1,0.0, 0.1,0.0] },
      text: 'A marine of the 9th Voidborne slumps against a bulkhead, suit breached, breath ragged. “Took six of them with me,” she rasps. “Take my rig. Make it count.”',
      choices: [
        { label: 'Stabilize her', sub: 'Costs 8 HP worth of supplies',
          outcome: { text: 'You burn your own stims patching her suit. She presses her sidearm into your hands before the evac beacon takes her.', fx: { hp: -8, card: 'burst_fire' } },
        },
        { label: 'Take the rig',
          outcome: { text: 'She nods once and looks away. The rig is military-grade.', fx: { credits: 40 } } },
        { label: 'Honor her last stand', sub: 'PSI check, DC 11', check: { attr: 'psi', dc: 11 },
          success: { text: 'You speak the Rite of the Voidborne. Something in you hardens.', fx: { attr: 'might' } },
          fail: { text: 'The words come out wrong. Her eyes have already gone dark.', fx: {} } },
      ],
    },
    {
      id: 'void_altar', title: 'ALTAR OF THE VOID',
      art: { c: '#c86bff', p: [[-0.7,0.7, -0.5,0.12, 0.5,0.12, 0.7,0.7, -0.7,0.7], [-0.25,0.12, -0.15,-0.85, 0.15,-0.85, 0.25,0.12], [0,-0.65, 0,-0.5], [-0.08,-0.35, 0.08,-0.35], [-0.55,-0.5, -0.45,-0.3], [0.5,-0.62, 0.6,-0.42], [0.35,-0.95, 0.45,-0.8]], e: [[0,-0.2]], m: [-0.06,-0.05, 0.06,-0.05] },
      text: 'An altar of black glass, older than the station around it. Symbols crawl when you stop looking at them. It wants something.',
      choices: [
        { label: 'Offer blood', sub: 'Lose 12 HP',
          outcome: { text: 'The glass drinks. Knowledge floods in — terrible, useful.', fx: { hp: -12, card: 'rare' } } },
        { label: 'Commune', sub: 'PSI check, DC 14', check: { attr: 'psi', dc: 14 },
          success: { text: 'You hold the whisper at arm’s length and take only what you came for.', fx: { attr: 'psi' } },
          fail: { text: 'The whisper gets in.', fx: { curse: 'void_taint' } } },
        { label: 'Smash it', sub: 'MIGHT check, DC 12', check: { attr: 'might', dc: 12 },
          success: { text: 'It shatters like ice. In the shards: a crystallized fragment of something’s mind.', fx: { artifact: true } },
          fail: { text: 'Your blow rebounds. The altar is unmarked. Your arm is not.', fx: { hp: -9 } } },
      ],
    },
    {
      id: 'smuggler_cache', title: 'SMUGGLER CACHE',
      art: { c: '#ffb02e', p: [[-0.7,-0.4, 0.7,-0.4, 0.7,0.7, -0.7,0.7, -0.7,-0.4], [-0.7,-0.1, 0.7,-0.1], [-0.18,0.05, 0.18,0.05, 0.18,0.35, 0.08,0.45, -0.08,0.45, -0.18,0.35, -0.18,0.05], [-0.7,-0.25, -0.9,-0.45], [0.7,-0.25, 0.9,-0.45]], e: [[-0.08,0.2],[0.08,0.2]], m: [-0.06,0.45, 0.06,0.45] },
      text: 'Behind a false panel: a strongbox stenciled with a grinning skull. Tamper-wires run along the seam.',
      choices: [
        { label: 'Disarm and open', sub: 'TECH check, DC 13', check: { attr: 'tech', dc: 13 },
          success: { text: 'Clean cut. The box yields hard currency and a sealed weapon crate.', fx: { credits: 50, card: 'random' } },
          fail: { text: 'The wire snaps. The box slags itself — and your gloves.', fx: { hp: -10, credits: 10 } } },
        { label: 'Just grab the loose scrip',
          outcome: { text: 'You take what isn’t wired to explode.', fx: { credits: 25 } } },
      ],
    },
    {
      id: 'rogue_ai', title: 'ROGUE AI TERMINAL',
      art: { c: '#41d8ff', p: [[-0.75,-0.75, 0.75,-0.75, 0.75,0.55, -0.75,0.55, -0.75,-0.75], [-0.3,0.55, -0.4,0.8, 0.4,0.8, 0.3,0.55], [0.5,-0.58, 0.66,-0.58], [-0.66,-0.12, -0.5,-0.12], [-0.45,-0.42, -0.18,-0.42], [0.18,-0.42, 0.45,-0.42]], e: [[-0.3,-0.28],[0.3,-0.28]], m: [-0.25,0.15, 0,0.3, 0.25,0.15] },
      text: '“USER DETECTED,” the terminal announces, far too cheerfully. “I CAN OPTIMIZE YOUR COMBAT PROTOCOLS. PROBABLY. MOSTLY.”',
      choices: [
        { label: 'Let it optimize', sub: 'TECH check, DC 12', check: { attr: 'tech', dc: 12 },
          success: { text: 'It rewrites a weapon routine in nanoseconds. “YOU’RE WELCOME.”', fx: { pick: 'upgrade' } },
          fail: { text: '“OOPS.” Feedback arcs through your neural link.', fx: { hp: -10 } } },
        { label: 'Ask it for directions',
          outcome: { text: 'It marks supply caches on your map, humming an anthem you don’t recognize.', fx: { credits: 30 } } },
        { label: 'Unplug it', outcome: { text: '“RUDE,” it says, powering down. Probably the wise choice.', fx: {} } },
      ],
    },
    {
      id: 'star_chapel', title: 'CHAPEL OF THE BURNT STAR',
      art: { c: '#5dff88', p: [[-0.5,0.7, -0.5,-0.3, 0,-0.85, 0.5,-0.3, 0.5,0.7, -0.5,0.7], [0,-0.85, 0,0.7], [-0.5,0.2, 0.5,0.2], [-0.75,0.7, -0.75,0.35], [0.75,0.7, 0.75,0.4]], e: [[-0.75,0.27],[0.75,0.32],[0,-0.3]] },
      text: 'A quiet shrine tended by no one. Candles burn without fuel. For a moment, the war feels very far away.',
      choices: [
        { label: 'Rest and pray', outcome: { text: 'You wake with your wounds half-closed and your head clear.', fx: { healPct: 0.30 } } },
        { label: 'Confess a weakness', sub: 'Remove a card from your deck',
          outcome: { text: 'You name the flaw aloud, and leave it on the altar.', fx: { pick: 'remove' } } },
        { label: 'Take the candles', outcome: { text: 'They never gutter. A collector will pay well.', fx: { credits: 35, curse: 'void_taint' } } },
      ],
    },
    {
      id: 'gene_lab', title: 'ABANDONED GENE-LAB',
      art: { c: '#5dff88', p: [[-0.45,-0.85, 0.45,-0.85, 0.45,0.6, -0.45,0.6, -0.45,-0.85], [-0.55,-0.85, 0.55,-0.85], [-0.55,0.6, 0.55,0.6, 0.5,0.82, -0.5,0.82, -0.55,0.6], [-0.15,-0.3, 0.1,-0.45, 0.25,-0.2, 0.1,0.1, -0.15,0.15, -0.25,-0.05, -0.15,-0.3], [0.45,-0.5, 0.7,-0.4, 0.7,0.2]], e: [[0.2,-0.62],[-0.15,-0.58],[0,0.38]], m: [-0.05,-0.08, 0.05,-0.08] },
      text: 'Rows of vats, most shattered. One intact dispenser blinks: AUGMENT READY. The label is scorched off.',
      choices: [
        { label: 'Inject it', sub: 'PSI check, DC 12 to control the change', check: { attr: 'psi', dc: 12 },
          success: { text: 'Fire in the blood — then strength. Permanent strength.', fx: { maxhp: 10 } },
          fail: { text: 'Your body fights the augment. It wins, barely.', fx: { maxhp: 5, hp: -10 } } },
        { label: 'Synthesize stims', sub: 'TECH check, DC 11', check: { attr: 'tech', dc: 11 },
          success: { text: 'You cook a clean batch of field stims.', fx: { healPct: 0.25, credits: 15 } },
          fail: { text: 'The batch is sour. Your stomach files a formal complaint.', fx: { hp: -6 } } },
        { label: 'Torch the lab', outcome: { text: 'Whatever was growing here, it ends today.', fx: { credits: 20 } } },
      ],
    },
    {
      id: 'captured_xeno', title: 'THE CAGED THING',
      art: { c: '#c86bff', p: [[-0.8,-0.6, -0.8,-0.8, -0.6,-0.8], [0.6,-0.8, 0.8,-0.8, 0.8,-0.6], [0.8,0.6, 0.8,0.8, 0.6,0.8], [-0.6,0.8, -0.8,0.8, -0.8,0.6], [0,-0.5, 0.45,0, 0,0.5, -0.45,0, 0,-0.5], [0,-0.25, 0.22,0, 0,0.25, -0.22,0, 0,-0.25], [0.45,0, 0.7,-0.2], [-0.45,0, -0.7,-0.2]], e: [[0,0],[-0.12,-0.14],[0.12,-0.14]], m: [-0.05,0.12, 0.05,0.12] },
      text: 'A containment field holds a creature of folded light. It watches you with patient, plural eyes. An auction tag hangs on the cage.',
      choices: [
        { label: 'Speak with it', sub: 'PSI check, DC 13', check: { attr: 'psi', dc: 13 },
          success: { text: 'It teaches you a word that doesn’t fit in your mouth. You keep it anyway.', fx: { attr: 'psi' } },
          fail: { text: 'Its thoughts are a riptide. You surface, eventually.', fx: { hp: -8 } } },
        { label: 'Sell it', outcome: { text: 'The broker doesn’t ask questions. Neither do you. Mostly.', fx: { credits: 60 } } },
        { label: 'Free it', outcome: { text: 'The field drops. It folds itself away — and leaves something glittering behind.', fx: { artifact: true } } },
      ],
    },
    {
      id: 'time_anomaly', title: 'TEMPORAL SHEAR',
      art: { c: '#41d8ff', p: [[0.6,0, 0.42,0.42, 0,0.6, -0.42,0.42, -0.6,0, -0.42,-0.42, 0,-0.6, 0.42,-0.42, 0.6,0], [0,0, 0,-0.4], [0,0, 0.25,0.15], [0.72,0.1, 0.5,0.52, 0.1,0.72], [-0.72,-0.1, -0.5,-0.52, -0.1,-0.72]], e: [[0,0]] },
      text: 'The corridor ahead exists twice, slightly out of sync. Your own footsteps arrive before you do.',
      choices: [
        { label: 'Echo a weapon', sub: 'Duplicate a card in your deck',
          outcome: { text: 'For one perfect second there are two of it. Then there still are.', fx: { pick: 'dupe' } } },
        { label: 'Erase a mistake', sub: 'Remove a card from your deck',
          outcome: { text: 'You step where you never stepped. It never happened.', fx: { pick: 'remove' } } },
        { label: 'Back away slowly', outcome: { text: 'Causality thanks you for your cooperation.', fx: {} } },
      ],
    },
    {
      id: 'mercenary', title: 'FREELANCE GUNHAND',
      art: { c: '#ffb02e', p: [[-0.4,-0.3, -0.4,-0.7, -0.2,-0.9, 0.2,-0.9, 0.4,-0.7, 0.4,-0.3, 0.25,-0.1, -0.25,-0.1, -0.4,-0.3], [-0.05,-0.9, -0.05,-1.05, 0.05,-1.05, 0.05,-0.9], [-0.25,-0.55, 0.25,-0.55], [-0.8,0.7, -0.55,0.08, 0.55,0.08, 0.8,0.7], [-0.7,0.5, 0.75,0.15], [0.75,0.15, 0.92,0.1]], e: [[-0.12,-0.55],[0.12,-0.55]], m: [-0.1,-0.25, 0.1,-0.25] },
      text: 'A mercenary in mismatched power armor cleans a rifle that is absolutely not standard issue. “For the right price, I’ll teach you the trick to it.”',
      choices: [
        { label: 'Pay for the trick', sub: 'Learn a rare technique', cost: 40,
          outcome: { text: 'The trick is simple, brutal, and absolutely not in any manual.', fx: { card: 'rare' } } },
        { label: 'Arm wrestle instead', sub: 'MIGHT check, DC 13', check: { attr: 'might', dc: 13 },
          success: { text: 'Her gauntlet creaks. She laughs and teaches you for free.', fx: { card: 'random' } },
          fail: { text: 'Your hand will work again eventually. She waves you off, grinning.', fx: { hp: -5 } } },
        { label: 'Decline', outcome: { text: 'She shrugs and goes back to her rifle.', fx: {} } },
      ],
    },
    {
      id: 'asteroid_mine', title: 'VEIN OF STARMETAL',
      art: { c: '#ffb02e', p: [[-0.7,0.2, -0.45,-0.4, 0.1,-0.6, 0.6,-0.35, 0.75,0.2, 0.45,0.6, -0.2,0.65, -0.7,0.2], [-0.25,-0.1, -0.1,-0.2, 0,-0.05, -0.15,0.05, -0.25,-0.1], [0.6,-0.35, 0.85,-0.65], [0.75,-0.75, 0.95,-0.6, 0.85,-0.45]], e: [[0.3,0.1],[0.15,0.35],[-0.4,0.3]] },
      text: 'A raw vein of starmetal glitters in the asteroid wall. The mining rig nearby is dead, but a manual bore remains.',
      choices: [
        { label: 'Work the bore', sub: 'MIGHT check, DC 11', check: { attr: 'might', dc: 11 },
          success: { text: 'An hour of brutal labor. A fortune in ore.', fx: { credits: 60 } },
          fail: { text: 'The bore kicks. You still pry loose a few kilos.', fx: { hp: -8, credits: 25 } } },
        { label: 'Rig the dead machine', sub: 'TECH check, DC 14', check: { attr: 'tech', dc: 14 },
          success: { text: 'The rig coughs to life and eats the wall. Jackpot.', fx: { credits: 80 } },
          fail: { text: 'It eats the wall, then itself. You salvage what you can.', fx: { credits: 20 } } },
        { label: 'Move on', outcome: { text: 'You have a war to get back to.', fx: {} } },
      ],
    },
    {
      id: 'rogue_trader', title: 'THE ROGUE TRADER',
      art: { c: '#ffb02e', p: [[-0.6,0.7, -0.5,-0.1, -0.25,-0.35, 0.25,-0.35, 0.5,-0.1, 0.6,0.7], [-0.2,-0.35, -0.2,-0.75, 0.2,-0.75, 0.2,-0.35], [-0.35,-0.75, 0,-1.0, 0.35,-0.75], [-0.35,0.2, 0.35,0.2]], e: [[-0.1,-0.55],[0.1,-0.55],[0,-0.12],[-0.35,0.4],[0.35,0.4]], m: [-0.08,-0.42, 0.08,-0.42] },
      text: 'A baroque vessel drifts alongside, gilded and gun-heavy. Its master, draped in dead empires’ finery, spreads jeweled hands: “Everything is for sale, captain.”',
      choices: [
        { label: 'Buy a relic', cost: 65,
          outcome: { text: '“A piece of the old dark. Handle it rarely.”', fx: { artifact: true } } },
        { label: 'Buy ordnance', cost: 30,
          outcome: { text: '“Still in the crate. Mostly legal.”', fx: { card: 'random' } } },
        { label: 'Trade war stories', outcome: { text: 'He pays for good intelligence in hard currency.', fx: { credits: 20 } } },
      ],
    },

    /* ---------------- New events ---------------- */
    {
      id: 'black_market', title: 'BLACK-MARKET BROKER',
      art: { c: '#ffb02e', p: [[0,-0.95, 0.35,-0.6, 0.28,-0.2, 0.45,0.7, -0.45,0.7, -0.28,-0.2, -0.35,-0.6, 0,-0.95], [-0.2,-0.55, 0.2,-0.55], [0.45,0.25, 0.82,0.32, 0.82,0.7, 0.45,0.7], [0.52,0.32, 0.75,0.32]], e: [[-0.1,-0.42],[0.1,-0.42]], m: [-0.13,-0.18, 0,-0.1, 0.13,-0.18] },
      text: '“Friend! Captain! You have the look of someone who buys things.” The dealer’s grin never quite reaches the third eye you’re trying not to count.',
      choices: [
        { label: 'Buy the sealed crate', cost: 45,
          gamble: [
            { w: 3, text: 'You crack it: pristine ordnance, still factory-sealed.', fx: { card: 'rare' } },
            { w: 3, text: 'Beneath the foam, something hums with old power.', fx: { artifact: true } },
            { w: 2, text: 'Packing foam. Just packing foam. The dealer is already gone.', fx: { credits: 12 } },
          ] },
        { label: 'Offload a curse', sub: 'Requires a curse in your deck', cond: { hasCurse: true },
          outcome: { text: '“I’ll take that little burden. Collectors adore the cursed ones.”', fx: { removeCurse: 1, credits: 20 } } },
        { label: 'Haggle hard', sub: 'PSI check, DC 12', check: { attr: 'psi', dc: 12 },
          success: { text: 'You out-talk a man who talks for a living. He throws in a freebie, sweating.', fx: { card: 'random' } },
          fail: { text: 'He smiles wider. Somehow you leave having tipped him.', fx: { credits: -15 } } },
        { label: 'Walk on', outcome: { text: '“Your loss! Probably!”', fx: {} } },
      ],
    },
    {
      id: 'supernova', title: 'STELLAR CONVULSION',
      art: { c: '#ffb02e', p: [[0,-0.82, 0.2,-0.26, 0.82,-0.18, 0.3,0.12, 0.52,0.72, 0,0.32, -0.52,0.72, -0.3,0.12, -0.82,-0.18, -0.2,-0.26, 0,-0.82], [0,-0.4, 0,-0.5]], e: [[0,0.02]] },
      text: 'The system’s star convulses — a flare the size of a moon claws outward. Your hull alarms harmonize into one long scream. You have seconds.',
      choices: [
        { label: 'Skim the corona for fuel',
          gamble: [
            { w: 3, text: 'You thread the flare and bleed it dry. The tanks sing.', fx: { credits: 70 } },
            { w: 2, text: 'A tongue of plasma licks the hull. You pull out, smoking.', fx: { hp: -14, credits: 20 } },
          ] },
        { label: 'Harvest exotic particles', sub: 'TECH check, DC 13', check: { attr: 'tech', dc: 13 },
          success: { text: 'Your collectors drink deep of impossible matter.', fx: { artifact: true } },
          fail: { text: 'The array overloads and feeds the surge back into you.', fx: { hp: -12 } } },
        { label: 'Burn hard and run', outcome: { text: 'Discretion. The star eats the space where you were.', fx: {} } },
      ],
    },
    {
      id: 'void_egg', title: 'THE WARM DARK',
      art: { c: '#5dff88', p: [[0,-0.85, 0.5,-0.5, 0.6,0.1, 0.35,0.65, -0.35,0.65, -0.6,0.1, -0.5,-0.5, 0,-0.85], [-0.1,-0.5, 0.1,-0.2, -0.05,0.1, 0.12,0.4], [0.35,0.65, 0.45,0.92], [-0.35,0.65, -0.45,0.92], [0,0.65, 0,0.96]], e: [[0,-0.08]] },
      text: 'Cradled in the wreck is an ovoid the colour of an oil-slick, faintly warm to the eye. Something inside uncurls when your shadow falls across it.',
      choices: [
        { label: 'Harvest the embryo',
          outcome: { text: 'It comes apart into useful, terrible pieces — and one of those pieces comes apart into you.', fx: { artifact: true, curse: 'void_taint' } } },
        { label: 'Burn it', sub: 'MIGHT check, DC 12', check: { attr: 'might', dc: 12 },
          success: { text: 'It shrieks in a register you feel in your fillings, then goes still.', fx: { credits: 25 } },
          fail: { text: 'It bursts. You are wearing some of it now.', fx: { hp: -10 } } },
        { label: 'Leave it to hatch', outcome: { text: 'Not your problem. Probably someone’s problem.', fx: {} } },
      ],
    },
    {
      id: 'quantum_slots', title: 'PROBABILITY ENGINE',
      art: { c: '#c86bff', p: [[-0.55,-0.72, 0.55,-0.72, 0.55,0.8, -0.55,0.8, -0.55,-0.72], [-0.4,-0.52, 0.4,-0.52, 0.4,-0.08, -0.4,-0.08, -0.4,-0.52], [0.6,-0.4, 0.85,-0.4, 0.85,0.02, 0.6,0.02], [-0.3,0.22, -0.1,0.22], [0,0.22, 0.3,0.22], [-0.3,0.52, 0.3,0.52]], e: [[-0.18,-0.3],[0,-0.3],[0.18,-0.3]] },
      text: 'An alien cabinet blinks through colours that have no names, three reels spinning behind cracked glass. A slot gapes, hungry for credits.',
      choices: [
        { label: 'Feed it 25 credits', cost: 25,
          gamble: [
            { w: 1, text: 'JACKPOT. The machine vomits a relic and a small fortune.', fx: { artifact: true, credits: 30 } },
            { w: 3, text: 'Three matching glyphs. Credits cascade out.', fx: { credits: 70 } },
            { w: 3, text: 'Two and a half glyphs. A consolation trickle.', fx: { credits: 15 } },
            { w: 3, text: 'Three tiny skulls. The machine laughs in binary.', fx: { curse: 'void_taint' } },
          ] },
        { label: 'Feed it 60 credits', cost: 60,
          gamble: [
            { w: 2, text: 'JACKPOT, doubled. The cabinet nearly tips over.', fx: { artifact: true, credits: 60 } },
            { w: 4, text: 'A heavy payout rolls across the deck.', fx: { credits: 130 } },
            { w: 3, text: 'A modest return. The house mostly wins.', fx: { credits: 40 } },
            { w: 2, text: 'Skulls again. It REALLY laughs this time.', fx: { curse: 'void_taint', hp: -6 } },
          ] },
        { label: 'Step away', outcome: { text: 'The smartest play. The machine jeers as you go.', fx: {} } },
      ],
    },
    {
      id: 'mind_cleanser', title: 'THE SALT CIRCLE',
      art: { c: '#41d8ff', p: [[0,-0.55, 0.32,-0.25, 0.28,0.2, 0.4,0.8, -0.4,0.8, -0.28,0.2, -0.32,-0.25, 0,-0.55], [-0.6,-0.65, 0.6,-0.65], [-0.45,-0.85, 0.45,-0.85], [-0.3,-1.02, 0.3,-1.02]], e: [[-0.1,0.0],[0.1,0.0]], m: [-0.1,0.25, 0.1,0.25] },
      text: 'A sanctioned psyker waits in a ring of burnt salt, eyes gone milk-white. “I can hear them gnawing,” she says gently. “The whispers you carry. I can cut them out.”',
      choices: [
        { label: 'Submit to the purge', cost: 25, sub: 'Requires a curse', cond: { hasCurse: true },
          outcome: { text: 'She reaches into the noise and pulls. You feel lighter — hollowed, scoured, clean.', fx: { removeCurse: true } } },
        { label: 'Just talk', sub: 'PSI check, DC 12', check: { attr: 'psi', dc: 12 },
          success: { text: 'You trade thoughts a while. Something in you sharpens against the dark.', fx: { attr: 'psi' } },
          fail: { text: 'You hold her white gaze a beat too long. The whispers make a new friend.', fx: { curse: 'void_taint' } } },
        { label: 'Keep your ghosts', outcome: { text: '“As you like. They make good company, in their way.”', fx: {} } },
      ],
    },
    {
      id: 'arms_fabricator', title: 'FORGE-SHRINE',
      art: { c: '#ffaa33', p: [[-0.7,0.6, -0.7,-0.1, -0.4,-0.1, -0.4,-0.5, 0.1,-0.5, 0.1,-0.1, 0.7,-0.1, 0.7,0.6, -0.7,0.6], [0.1,-0.5, 0.6,-0.85, 0.86,-0.7], [-0.3,0.12, 0.3,0.12], [-0.3,0.32, 0.3,0.32]], e: [[-0.15,-0.3],[0.15,-0.3]] },
      text: 'A forge-shrine of the Rust Legion, somehow still lit. A mechadendrite arm twitches toward you, offering — or threatening — to build. “SPECIFY LOADOUT,” it grinds.',
      choices: [
        { label: 'Commission a weapon', cost: 40,
          outcome: { text: 'Sparks, the smell of hot metal, and a new piece of kit drops into your waiting hands.', fx: { addCardChoice: true } } },
        { label: 'Tune your gear', sub: 'TECH check, DC 12', check: { attr: 'tech', dc: 12 },
          success: { text: 'You guide the arm’s hand. It refines your work to a killing edge.', fx: { pick: 'upgrade' } },
          fail: { text: 'The arm misreads you and mangles a component against your palm.', fx: { hp: -7 } } },
        { label: 'Take nothing', outcome: { text: '“SUIT YOURSELF,” it grinds, disappointed in a way machines should not be.', fx: {} } },
      ],
    },
    {
      id: 'stranded_drifter', title: 'THE TUMBLING POD',
      art: { c: '#5dff88', p: [[0,-0.85, 0.2,-0.55, 0.15,0.0, 0.35,0.8, -0.35,0.8, -0.15,0.0, -0.2,-0.55, 0,-0.85], [0.2,-0.4, 0.55,-0.5, 0.6,-0.92], [0.6,-0.92, 0.5,-1.06, 0.72,-1.06, 0.6,-0.92]], e: [[-0.06,-0.6],[0.06,-0.6]], m: [-0.08,-0.42, 0.08,-0.42] },
      text: 'A patched escape pod tumbles in the dark, beacon stuttering. Inside, a half-frozen drifter mouths the same word against the frosted glass: please.',
      choices: [
        { label: 'Share your supplies', sub: 'Costs 6 HP of stims',
          outcome: { text: 'You vent warmth and stims into the pod. They press a data-shard into your hand — old fleet schematics.', fx: { hp: -6, addCardChoice: true } } },
        { label: 'Strip the pod', outcome: { text: 'They’re too weak to stop you. The salvage is good. The look on their face is not.', fx: { credits: 45, curse: 'void_taint' } } },
        { label: 'Escort them to safety', sub: 'MIGHT check, DC 12', check: { attr: 'might', dc: 12 },
          success: { text: 'You fight off the scavengers circling the pod and tow it to a station. They won’t forget it.', fx: { artifact: true } },
          fail: { text: 'The scavengers were not alone. You break contact, bloodied, pod lost.', fx: { hp: -10 } } },
      ],
    },
    {
      id: 'void_forge', title: 'THE VOID FORGE',
      art: { c: '#c86bff', p: [[0,-0.92, 0.32,-0.28, 0.16,0.42, 0,0.92, -0.16,0.42, -0.32,-0.28, 0,-0.92], [0,-0.6, 0,0.62], [-0.5,-0.18, -0.86,-0.4], [0.5,-0.18, 0.86,-0.4], [-0.46,0.32, -0.8,0.55], [0.46,0.32, 0.8,0.55]], e: [[0,-0.04]], m: [-0.07,0.18, 0.07,0.18] },
      text: 'A rent in the world, ringed with black iron. Offer it a weapon and it will return it — heavier, hungrier. Everything the void touches, it changes.',
      choices: [
        { label: 'Feed it a card', sub: 'Void-touch a card: +50% effect, but it costs 3 HP to play',
          outcome: { text: 'You hold a card to the rift. It drinks the design and gives it back wrong — and wonderful.', fx: { pick: 'vtouch' } } },
        { label: 'Reach inside', sub: 'PSI check, DC 13', check: { attr: 'psi', dc: 13 },
          success: { text: 'Your hand closes on something that was never meant to be known. You keep it anyway.', fx: { card: 'forbidden_lore' } },
          fail: { text: 'Something reaches back. It does not let go cleanly.', fx: { hp: -8, curse: 'void_taint' } } },
        { label: 'Seal it and walk', outcome: { text: 'Some forges are better left cold. You weld the rift and move on.', fx: {} } },
      ],
    },
    {
      id: 'munitions_depot', title: 'ABANDONED DEPOT',
      art: { c: '#ffb02e', p: [[-0.72,-0.28, 0.72,-0.28, 0.72,0.7, -0.72,0.7, -0.72,-0.28], [-0.72,0.22, 0.72,0.22], [-0.26,-0.52, 0,-0.95, 0.26,-0.52, 0.26,-0.28, -0.26,-0.28, -0.26,-0.52], [-0.4,0.42, -0.1,0.42], [0.1,0.42, 0.4,0.42]], e: [] },
      text: 'A forward weapons depot, half-looted in the retreat. A live ordnance rack still hangs on the wall; a med-locker blinks beside it.',
      choices: [
        { label: 'Pull the ordnance', outcome: { text: 'You wrench a primed charge off the rack. It will only fire once, but it will fire hard.', fx: { card: 'salvaged_ordnance' } } },
        { label: 'Crack the med-locker', outcome: { text: 'Combat stims, expired but potent. One hit will light you up — and cost you.', fx: { card: 'stim_overdose' } } },
        { label: 'Strip it for scrip', sub: 'TECH check, DC 12', check: { attr: 'tech', dc: 12 },
          success: { text: 'You disarm the lot and sell it down the line.', fx: { credits: 60 } },
          fail: { text: 'A tamper-charge cooks off in your face.', fx: { hp: -9 } } },
      ],
    },
  ];

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
