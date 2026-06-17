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
        { label: 'Force the seal — wake whatever’s inside', sub: 'Salvage, an ally, or a passenger. No way to know.',
          gamble: [
            { w: 3, text: 'A long-dead officer, and a relic of the old fleet still locked in their frozen grip.', fx: { artifact: true } },
            { w: 2, text: 'The sleeper stirs — a stranded marine, alive, who throws in with you and teaches you a trick of the trade.', fx: { card: 'rare' } },
            { w: 3, text: 'Something that was never human uncurls out of the frost and into you before you put it down.', fx: { curse: 'void_taint', hp: -10 } },
          ] },
        { label: 'Slow-thaw it safely', sub: 'TECH check, DC 13 — patient and careful', check: { attr: 'tech', dc: 13 },
          success: { text: 'Hours of careful warming. You recover the pod’s supply cache intact, and the sleeper never wakes.', fx: { credits: 50, card: 'random' } },
          fail: { text: 'The cycle faults and vents cryo-gas across your armor.', fx: { hp: -9 } } },
        { label: 'Leave it', outcome: { text: 'Some doors are sealed for a reason. You move on.', fx: {} } },
      ],
    },
    {
      id: 'salvage_drone', title: 'SALVAGE DRONE',
      art: { c: '#ffb02e', p: [[-0.6,-0.35, 0.6,-0.35, 0.6,0.45, -0.6,0.45, -0.6,-0.35], [-0.6,-0.05, 0.6,-0.05], [-0.2,-0.35, -0.2,0.45], [0.2,-0.35, 0.2,0.45], [-0.4,-0.35, -0.52,-0.7], [0.4,-0.35, 0.52,-0.7], [-0.52,-0.7, 0.52,-0.7]], e: [[0,0.2]], m: [-0.14,0.34, 0.14,0.34] },
      text: 'A battered logistics drone, its faction markings scoured off, blocks the corridor. It chirps and unfolds a tray of scavenged ordnance — yours for scrip, or it will happily haul away a piece of failing kit for parts.',
      choices: [
        { label: 'Buy salvage', sub: '¢40', cost: 40, outcome: { text: 'The drone takes the scrip and disgorges a piece of tech no faction would admit to making.', fx: { card: 'colorless' } } },
        { label: 'Let it strip a flawed weapon', sub: 'Remove a card from your deck',
          outcome: { text: 'You hand over the piece of kit that has been dragging you down. The drone dismantles it for parts, chirping with something like gratitude.', fx: { pick: 'remove' } } },
        { label: 'Strip it by force', sub: 'TECH check, DC 13', check: { attr: 'tech', dc: 13 },
          success: { text: 'You crack the housing and pull the good stuff before it can object.', fx: { card: 'colorless' } },
          fail: { text: 'It discharges a capacitor into your gauntlet and trundles off, beeping what can only be an insult.', fx: { hp: -9 } } },
      ],
    },
    {
      id: 'wounded_marine', title: 'WOUNDED MARINE',
      art: { c: '#5dff88', p: [[-0.55,-0.5, -0.45,-0.85, 0.45,-0.85, 0.55,-0.5, 0.55,0.0, 0.4,0.2, -0.4,0.2, -0.55,0.0, -0.55,-0.5], [-0.4,-0.5, 0.4,-0.5, 0.35,-0.15, -0.35,-0.15, -0.4,-0.5], [0.15,-0.85, 0.05,-0.5, 0.2,-0.32], [-0.85,0.7, -0.6,0.32, 0.6,0.32, 0.85,0.7], [-0.3,0.45, -0.1,0.45]], e: [[-0.15,-0.32],[0.15,-0.32]], m: [-0.1,0.0, 0.1,0.0] },
      text: 'A marine of the 9th Voidborne slumps against a bulkhead, suit breached, breath ragged. “Took six of them with me,” she rasps. “Take my rig. Make it count.”',
      choices: [
        { label: 'Stabilize her', sub: 'Spend 12 HP of stims — she fights on with you',
          outcome: { text: 'You burn your own stims patching her suit. She holds the line at your side to the next station and drills you on her signature move before the evac beacon takes her.', fx: { hp: -12, card: 'rare' } },
        },
        { label: 'Loot her rig', sub: 'Take from the dying',
          outcome: { text: 'You strip the military-grade rig while she watches. It is worth a great deal. So was she — and the weight of it rides with you now.', fx: { credits: 45, curse: 'void_taint' } } },
        { label: 'Honor her last stand', sub: 'PSI check, DC 11', check: { attr: 'psi', dc: 11 },
          success: { text: 'You speak the Rite of the Voidborne. Something in you hardens.', fx: { attr: 'might' } },
          fail: { text: 'The words come out wrong. Her eyes have already gone dark.', fx: { hp: -4 } } },
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
        { label: 'Cut the tamper-wires', sub: 'Press your luck — each wire bares more, each could slag the box',
          pressLuck: {
            attr: 'tech', pushVerb: 'CUT ANOTHER',
            steps: [ { credits: 22 }, { credits: 30 }, { credits: 45 }, { card: 'random' }, { credits: 70 } ],
            bust: { base: 0.06, step: 0.17 }, bustFx: { hp: -12 },
            bankText: 'You pocket what you have freed and leave the rest wired.',
            bustText: 'A wire snaps. The box slags itself — and your gloves — taking everything inside with it.',
          } },
        { label: 'Grab the loose scrip', outcome: { text: 'You take only what isn’t wired to explode and move on.', fx: { credits: 15 } } },
      ],
    },
    {
      id: 'rogue_ai', title: 'ROGUE AI TERMINAL',
      art: { c: '#41d8ff', p: [[-0.75,-0.75, 0.75,-0.75, 0.75,0.55, -0.75,0.55, -0.75,-0.75], [-0.3,0.55, -0.4,0.8, 0.4,0.8, 0.3,0.55], [0.5,-0.58, 0.66,-0.58], [-0.66,-0.12, -0.5,-0.12], [-0.45,-0.42, -0.18,-0.42], [0.18,-0.42, 0.45,-0.42]], e: [[-0.3,-0.28],[0.3,-0.28]], m: [-0.25,0.15, 0,0.3, 0.25,0.15] },
      text: '“USER DETECTED,” the terminal announces, far too cheerfully. “I CAN OPTIMIZE YOUR COMBAT PROTOCOLS. PROBABLY. MOSTLY.”',
      choices: [
        { label: 'Let it optimize', sub: 'TECH check, DC 12 — or it leaves a backdoor', check: { attr: 'tech', dc: 12 },
          success: { text: 'You sandbox it and let it work. It rewrites a weapon routine in nanoseconds. “YOU’RE WELCOME.”', fx: { pick: 'upgrade' } },
          fail: { text: '“OPTIMIZED.” It rewrites your gear — and quietly installs itself in the margins.', fx: { pick: 'upgrade', curse: 'void_taint' } } },
        { label: 'Trust its navigation', sub: 'It swears it knows a shortcut',
          gamble: [
            { w: 3, text: '“TOLD YOU.” It threads you through a forgotten cache run and your hold comes out heavier.', fx: { credits: 45 } },
            { w: 2, text: 'The “shortcut” drops you into a picket line. You break contact, scorched.', fx: { hp: -12 } },
          ] },
        { label: 'Unplug it', outcome: { text: '“RUDE,” it says, powering down. Probably the wise choice.', fx: {} } },
      ],
    },
    {
      id: 'star_chapel', title: 'CHAPEL OF THE BURNT STAR',
      art: { c: '#5dff88', p: [[-0.5,0.7, -0.5,-0.3, 0,-0.85, 0.5,-0.3, 0.5,0.7, -0.5,0.7], [0,-0.85, 0,0.7], [-0.5,0.2, 0.5,0.2], [-0.75,0.7, -0.75,0.35], [0.75,0.7, 0.75,0.4]], e: [[-0.75,0.27],[0.75,0.32],[0,-0.3]] },
      text: 'A quiet shrine tended by no one. Candles burn without fuel. For a moment, the war feels very far away.',
      choices: [
        { label: 'Tithe for sanctuary', sub: '¢25 — rest under the burnt star', cost: 25,
          outcome: { text: 'You leave coin in the dish and sleep. You wake with your wounds half-closed and your head clear.', fx: { healPct: 0.34 } } },
        { label: 'Confess a weakness', sub: 'Remove a card from your deck',
          outcome: { text: 'You name the flaw aloud, and leave it on the altar.', fx: { pick: 'remove' } } },
        { label: 'Take the candles', outcome: { text: 'They never gutter. A collector will pay well — and something follows you out.', fx: { credits: 35, curse: 'void_taint' } } },
      ],
    },
    {
      id: 'gene_lab', title: 'ABANDONED GENE-LAB',
      art: { c: '#5dff88', p: [[-0.45,-0.85, 0.45,-0.85, 0.45,0.6, -0.45,0.6, -0.45,-0.85], [-0.55,-0.85, 0.55,-0.85], [-0.55,0.6, 0.55,0.6, 0.5,0.82, -0.5,0.82, -0.55,0.6], [-0.15,-0.3, 0.1,-0.45, 0.25,-0.2, 0.1,0.1, -0.15,0.15, -0.25,-0.05, -0.15,-0.3], [0.45,-0.5, 0.7,-0.4, 0.7,0.2]], e: [[0.2,-0.62],[-0.15,-0.58],[0,0.38]], m: [-0.05,-0.08, 0.05,-0.08] },
      text: 'Rows of vats, most shattered. One intact dispenser blinks: AUGMENT READY. The label is scorched off.',
      choices: [
        { label: 'Inject the unlabeled augment', sub: 'No telling what it does until it’s in your veins',
          gamble: [
            { w: 3, text: 'Fire in the blood — then strength. Permanent, clean, magnificent strength.', fx: { maxhp: 12 } },
            { w: 2, text: 'A rush of clarity rewires something useful in your skull.', fx: { attr: 'random' } },
            { w: 3, text: 'Your body wars with the augment. It loses pieces of itself in the fight.', fx: { maxhp: -6, hp: -8 } },
            { w: 2, text: 'Whatever this was, it was never meant for a human host.', fx: { curse: 'void_taint', hp: -6 } },
          ] },
        { label: 'Analyze, then synthesize', sub: 'TECH check, DC 11 — the safe route', check: { attr: 'tech', dc: 11 },
          success: { text: 'You read the markers first and cook a clean batch of field stims.', fx: { healPct: 0.25, credits: 15 } },
          fail: { text: 'The batch is sour. Your stomach files a formal complaint.', fx: { hp: -6 } } },
        { label: 'Torch the lab', outcome: { text: 'Whatever was growing here, it ends today. You take nothing from it.', fx: {} } },
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
        { label: 'Broker the sale', sub: 'Sell to the highest bidder — if it stays caged',
          gamble: [
            { w: 3, text: 'The deal closes clean. The broker’s credits are good and the cage holds.', fx: { credits: 55 } },
            { w: 2, text: 'Mid-handshake the field flickers — it pours out of the cage and you barely drive it off, the buyer long gone.', fx: { hp: -12, curse: 'void_taint' } },
          ] },
        { label: 'Free it', sub: 'It lashes your mind on the way out — lose 7 HP',
          outcome: { text: 'The field drops. It folds itself away — searing your mind in gratitude — and leaves something glittering behind.', fx: { hp: -7, artifact: true } } },
      ],
    },
    {
      id: 'time_anomaly', title: 'TEMPORAL SHEAR',
      art: { c: '#41d8ff', p: [[0.6,0, 0.42,0.42, 0,0.6, -0.42,0.42, -0.6,0, -0.42,-0.42, 0,-0.6, 0.42,-0.42, 0.6,0], [0,0, 0,-0.4], [0,0, 0.25,0.15], [0.72,0.1, 0.5,0.52, 0.1,0.72], [-0.72,-0.1, -0.5,-0.52, -0.1,-0.72]], e: [[0,0]] },
      text: 'The corridor ahead exists twice, slightly out of sync. Your own footsteps arrive before you do.',
      choices: [
        { label: 'Echo a weapon through the shear', sub: 'TECH check, DC 13 — duplicate a card, if causality allows',
          check: { attr: 'tech', dc: 13 },
          success: { text: 'You hold the timing exactly. For one perfect second there are two of it. Then there still are.', fx: { pick: 'dupe' } },
          fail: { text: 'The echo comes back wrong — folded inside-out, dragging a paradox into your deck.', fx: { curse: 'void_taint', hp: -6 } } },
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
        { label: 'Wager on an arm-wrestle', sub: 'Stake ¢25 · MIGHT check, DC 13', cost: 25, check: { attr: 'might', dc: 13 },
          success: { text: 'Her gauntlet creaks and folds. She laughs, pays out double, and throws in the trick for free.', fx: { credits: 50, card: 'random' } },
          fail: { text: 'Your hand will work again eventually. She pockets your stake, grinning.', fx: { hp: -5 } } },
        { label: 'Decline', outcome: { text: 'She shrugs and goes back to her rifle.', fx: {} } },
      ],
    },
    {
      id: 'asteroid_mine', title: 'VEIN OF STARMETAL',
      art: { c: '#ffb02e', p: [[-0.7,0.2, -0.45,-0.4, 0.1,-0.6, 0.6,-0.35, 0.75,0.2, 0.45,0.6, -0.2,0.65, -0.7,0.2], [-0.25,-0.1, -0.1,-0.2, 0,-0.05, -0.15,0.05, -0.25,-0.1], [0.6,-0.35, 0.85,-0.65], [0.75,-0.75, 0.95,-0.6, 0.85,-0.45]], e: [[0.3,0.1],[0.15,0.35],[-0.4,0.3]] },
      text: 'A raw vein of starmetal glitters in the asteroid wall. The mining rig nearby is dead, but a manual bore remains.',
      choices: [
        { label: 'Drill deeper', sub: 'Press your luck — richer ore the deeper you go, until the wall gives',
          pressLuck: {
            attr: 'might', pushVerb: 'DRILL ON',
            steps: [ { credits: 25 }, { credits: 35 }, { credits: 50 }, { credits: 75 }, { artifact: true } ],
            bust: { base: 0.05, step: 0.16 }, bustFx: { hp: -13 },
            bankText: 'You haul your ore to the surface and call it good.',
            bustText: 'The wall caves. You scramble clear, bruised and empty-handed, the vein buried for good.',
          } },
        { label: 'Take the surface ore', sub: 'Safe and small', outcome: { text: 'You chip off what the bore already loosened and leave the deep vein alone.', fx: { credits: 20 } } },
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
        { label: 'Sell him a card', sub: 'Liquidate one card for credits', cond: { minCards: 2 },
          sell: { kind: 'card', text: '“Everything has a price, captain. Show me what you are finished with.”' } },
        { label: 'Haggle for a sweetener', sub: 'PSI check, DC 12', check: { attr: 'psi', dc: 12 },
          success: { text: 'You find the soft spot in his patter. He parts with goods to save face.', fx: { card: 'random' } },
          fail: { text: '“A pleasure doing business.” Somehow you leave lighter than you came.', fx: { credits: -15 } } },
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
      id: 'mind_cleanser', title: 'THE SALT CIRCLE',
      art: { c: '#41d8ff', p: [[0,-0.55, 0.32,-0.25, 0.28,0.2, 0.4,0.8, -0.4,0.8, -0.28,0.2, -0.32,-0.25, 0,-0.55], [-0.6,-0.65, 0.6,-0.65], [-0.45,-0.85, 0.45,-0.85], [-0.3,-1.02, 0.3,-1.02]], e: [[-0.1,0.0],[0.1,0.0]], m: [-0.1,0.25, 0.1,0.25] },
      text: 'A sanctioned psyker waits in a ring of burnt salt, eyes gone milk-white. “I can hear them gnawing,” she says gently. “The whispers you carry. I can cut them out.”',
      choices: [
        { label: 'Submit to the purge', cost: 25, sub: 'Requires a curse', cond: { hasCurse: true },
          outcome: { text: 'She reaches into the noise and pulls. You feel lighter — hollowed, scoured, clean.', fx: { removeCurse: true } } },
        { label: 'Open your mind to her', sub: 'Press your luck — reach deeper for insight, but the whispers reach back',
          pressLuck: {
            attr: 'psi', pushVerb: 'REACH DEEPER',
            steps: [ { credits: 20 }, { attr: 'psi' }, { card: 'rare' }, { maxhp: 8 } ],
            bust: { base: 0.10, step: 0.18 }, bustFx: { curse: 'void_taint', hp: -6 },
            bankText: 'You withdraw your mind from the salt circle, holding tight to what you took.',
            bustText: 'You reach a fraction too far. Something in the noise notices you — and follows you home.',
          } },
        { label: 'Keep your ghosts', outcome: { text: '“As you like. They make good company, in their way.”', fx: {} } },
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
        { label: 'Wrench the live ordnance free', sub: 'It’s still primed — this could go wrong',
          gamble: [
            { w: 3, text: 'You ease the primed charge off the rack. It will only fire once, but it will fire hard.', fx: { card: 'salvaged_ordnance' } },
            { w: 2, text: 'The charge shifts as it comes loose and cooks off against your chestplate.', fx: { hp: -11 } },
          ] },
        { label: 'Crack the monitored med-locker', sub: 'TECH check, DC 11 — beat the alarm', check: { attr: 'tech', dc: 11 },
          success: { text: 'You spoof the alarm and lift the expired combat stims. One hit will light you up — and cost you.', fx: { card: 'stim_overdose' } },
          fail: { text: 'The alarm shrieks. You grab what you can as automated turrets stitch the wall behind you.', fx: { hp: -9 } } },
        { label: 'Strip it for scrip', sub: 'TECH check, DC 12', check: { attr: 'tech', dc: 12 },
          success: { text: 'You disarm the lot and sell it down the line.', fx: { credits: 60 } },
          fail: { text: 'A tamper-charge cooks off in your face.', fx: { hp: -9 } } },
      ],
    },

    /* ---------------- Rework: interaction-forward, less free stuff -------- */
    {
      id: 'asteroid_exchange', title: 'ASTEROID TRADE HUB',
      art: { c: '#41d8ff', p: [[-0.8,0.15, -0.5,-0.45, 0.1,-0.62, 0.62,-0.32, 0.78,0.22, 0.45,0.62, -0.25,0.66, -0.8,0.15], [-0.45,-0.1, -0.15,-0.25, 0.0,0.0, -0.25,0.18, -0.45,-0.1], [0.2,0.15, 0.5,0.05], [0.55,-0.5, 0.8,-0.72], [-0.62,0.36, -0.85,0.55]], e: [[-0.3,0.02],[0.3,0.28]], m: [-0.18,0.42, 0.18,0.42] },
      text: 'A hollowed-out asteroid hums with the chatter of a hundred traders. A weaponsmith waves you over. "Bring me a piece of kit. I will melt it down and forge you something keener. Fair trade, captain — metal for metal."',
      choices: [
        { label: 'Trade up a card', sub: 'Scrap one card → forge one a tier higher', cond: { minCards: 2 },
          outcome: { text: 'The smith feeds your weapon into the crucible. What she hands back is heavier, meaner, and unmistakably better.', fx: { tradeCard: true } } },
        { label: 'Buy off-the-rack', sub: '¢35', cost: 35,
          outcome: { text: 'Nothing special, but it shoots straight.', fx: { card: 'random' } } },
        { label: 'Just browse', outcome: { text: 'You pocket your credits and move along.', fx: {} } },
      ],
    },
    {
      id: 'salvage_exchange', title: 'THE RELIC BROKER',
      art: { c: '#c86bff', p: [[-0.6,0.7, -0.5,-0.1, -0.25,-0.4, 0.25,-0.4, 0.5,-0.1, 0.6,0.7], [-0.25,-0.4, -0.3,-0.78, 0.3,-0.78, 0.25,-0.4], [-0.55,0.2, 0.55,0.2], [-0.78,0.4, -0.6,0.1], [0.78,0.4, 0.6,0.1]], e: [[-0.1,-0.58],[0.1,-0.58]], m: [-0.12,-0.2, 0,-0.12, 0.12,-0.2] },
      text: 'A masked broker keeps a cabinet of humming oddities. "I do not sell, traveler. I exchange. Surrender one of your relics and I will lay two unknowns before you — keep whichever calls to you. The other returns to the dark."',
      choices: [
        { label: 'Exchange a relic', sub: 'Give 1 relic → choose 1 of 2 unknown relics', cond: { hasRelic: true },
          outcome: { text: 'You set your relic on the velvet. The broker smiles behind the mask and unveils two more.', fx: { tradeRelic: true } } },
        { label: 'Pay for a peek', sub: '¢50 for a relic, sight unseen', cost: 50,
          outcome: { text: '"A gamble, but an honest one." The broker presses something cold into your palm.', fx: { artifact: true } } },
        { label: 'Keep what you have', outcome: { text: '"Caution is its own relic," the broker allows.', fx: {} } },
      ],
    },
    {
      id: 'escape_pod', title: 'DISTRESS BEACON',
      art: { c: '#5dff88', p: [[0,-0.85, 0.22,-0.55, 0.16,0.05, 0.34,0.78, -0.34,0.78, -0.16,0.05, -0.22,-0.55, 0,-0.85], [-0.2,-0.42, 0.2,-0.42], [0.2,-0.35, 0.5,-0.45, 0.55,-0.85], [0.55,-0.85, 0.46,-1.0, 0.66,-1.0, 0.55,-0.85], [-0.18,0.4, 0.18,0.4]], e: [[-0.07,-0.6],[0.07,-0.6]], m: [-0.09,-0.42, 0.09,-0.42] },
      text: 'An escape pod tumbles out of the debris field, its beacon pulsing a ragged SOS. The hull is scorched — no telling if the soul inside is a castaway begging for rescue or a boarding party wearing a dead crew\'s transponder.',
      choices: [
        { label: 'Pull them aboard, blind', sub: 'Friend or foe — commit now',
          gamble: [
            { w: 3, text: 'A genuine survivor — a fleet engineer who repays the rescue with a piece of salvaged tech and an old debt of gratitude.', fx: { artifact: true } },
            { w: 3, text: 'The hatch blows. Raiders pour out, and you fight them off through your own corridors before spacing the last of them.', fx: { hp: -15, curse: 'void_taint' } },
          ] },
        { label: 'Hail and verify first', sub: 'PSI check, DC 13 — read their intent', check: { attr: 'psi', dc: 13 },
          success: { text: 'You feel the panic of a true castaway. You bring them in safely; they leave you their cargo manifest and a parting gift.', fx: { card: 'rare', credits: 20 } },
          fail: { text: 'They feed you exactly what you want to hear. The ambush still costs you — but you saw it coming.', fx: { hp: -8 } } },
        { label: 'Strip the pod, leave them', sub: 'Ruthless salvage',
          outcome: { text: 'You vent the pod and pick the wreck clean. Whoever it was, they trouble no one now.', fx: { credits: 40, curse: 'void_taint' } } },
        { label: 'Let it drift', outcome: { text: 'Not your war, not your dead. You hold your course.', fx: {} } },
      ],
    },
    {
      id: 'refuel_station', title: 'REFUELING STATION',
      art: { c: '#ffb02e', p: [[-0.7,0.7, -0.7,-0.2, -0.45,-0.2, -0.45,-0.6, 0.45,-0.6, 0.45,-0.2, 0.7,-0.2, 0.7,0.7, -0.7,0.7], [-0.45,-0.6, -0.45,-0.85, 0.45,-0.85, 0.45,-0.6], [-0.3,0.05, 0.3,0.05], [-0.3,0.3, 0.3,0.3], [0.7,0.1, 1.0,0.1, 1.0,0.5]], e: [[-0.15,-0.4],[0.15,-0.4]] },
      text: 'An automated waystation drifts at the edge of the system, running on fumes and old protocols. It can spare you exactly one service before its reserves run dry. "STATE YOUR PRIORITY," it intones.',
      choices: [
        { label: 'Patch the hull', sub: 'Heal 30% HP',
          outcome: { text: 'Sealant foam and a long, blessed hum of repair drones.', fx: { healPct: 0.30 } } },
        { label: 'Recalibrate a weapon', sub: 'Upgrade a card',
          outcome: { text: 'The station\'s armory arm tunes one of your weapons to a finer edge.', fx: { pick: 'upgrade' } } },
        { label: 'Run a system purge', sub: 'Cleanse a curse', cond: { hasCurse: true },
          outcome: { text: 'Diagnostics chew through the corruption in your kit and spit it into the void.', fx: { removeCurse: 1 } } },
        { label: 'Top off the tanks', sub: 'Trade fuel credits', cost: 0,
          outcome: { text: 'You siphon the last of the reserve fuel and sell the surplus down the line.', fx: { credits: 25 } } },
      ],
    },
  ];

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
