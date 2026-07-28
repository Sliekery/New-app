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
      text: "A board laid out on a slab of decking, and a chair that keeps being sat in. The house wears a rebreather and does not appear to use it. “You are carrying a die,” it says. “Everyone is. Nobody remembers being handed one.”",
    },
    {
      id: 'cryopod', title: "THE POD",
      art: { c: '#41d8ff', p: [[-0.55,-0.95, 0.55,-0.95, 0.7,-0.3, 0.7,0.7, -0.7,0.7, -0.7,-0.3, -0.55,-0.95], [-0.4,-0.7, 0.4,-0.7, 0.45,0.1, -0.45,0.1, -0.4,-0.7], [-0.18,-0.45, 0.18,-0.45, 0.22,-0.1, 0,0.02, -0.22,-0.1, -0.18,-0.45], [0.45,-0.55, 0.62,-0.6], [-0.45,-0.25, -0.62,-0.15], [-0.5,0.4, 0.5,0.4]], e: [[-0.08,-0.3],[0.08,-0.3]], m: [-0.07,-0.1, 0.07,-0.1] },
      text: "Something is still running under the frost. There is a shape behind the glass that has not finished being a person, and a lock panel throwing sparks at nobody.",
      choices: [
        { label: "Break the seal", sub: 'Salvage, an ally, or a passenger. No way to know.',
          gamble: [
            { w: 3, text: "An officer of some finished fleet. Their hand has closed on something and will not be talked out of it.", fx: { artifact: true } },
            { w: 2, text: "The sleeper comes up wrong, and then comes up. They walk the next stretch with you and show you the one thing they were good at.", fx: { card: 'rare' } },
            { w: 3, text: "What uncurls out of the frost was never the shape of a pod. You put it down. Some of it stays.", fx: { curse: 'void_taint', hp: -10 } },
          ] },
        { label: "Bring it up slowly", sub: 'TECH check, DC 13 — patient and careful', check: { attr: 'tech', dc: 13 },
          success: { text: "You bring it up over hours. The stores are intact and the sleeper never surfaces.", fx: { credits: 50, card: 'random' } },
          fail: { text: "The cycle faults and all of the cold arrives at once.", fx: { hp: -9 } } },
        { label: "Leave it sealed", outcome: { text: "Some things are sealed from the inside. You go on down.", fx: {} } },
      ],
    },
    {
      id: 'salvage_drone', title: 'SALVAGE DRONE',
      art: { c: '#ffb02e', p: [[-0.6,-0.35, 0.6,-0.35, 0.6,0.45, -0.6,0.45, -0.6,-0.35], [-0.6,-0.05, 0.6,-0.05], [-0.2,-0.35, -0.2,0.45], [0.2,-0.35, 0.2,0.45], [-0.4,-0.35, -0.52,-0.7], [0.4,-0.35, 0.52,-0.7], [-0.52,-0.7, 0.52,-0.7]], e: [[0,0.2]], m: [-0.14,0.34, 0.14,0.34] },
      text: "A hauler with its markings scoured off is stood in the stairway. It chirps, unfolds a tray, and waits. It has been waiting. The dust on it says roughly how long.",
      choices: [
        { label: "Buy what it is holding", sub: '¢40', cost: 40, outcome: { text: "It takes the scrip and gives up a thing that nobody would admit to building.", fx: { card: 'colorless' } } },
        { label: "Let it strip a bad piece", sub: 'Remove a card from your deck',
          outcome: { text: "You hand over the piece that has been dragging. It takes the thing apart very carefully, chirping, as though it had been asked to a long time ago.", fx: { pick: 'remove' } } },
        { label: "Take it by force", sub: 'TECH check, DC 13', check: { attr: 'tech', dc: 13 },
          success: { text: "You get the housing open and take the good parts before it can object.", fx: { card: 'colorless' } },
          fail: { text: "It puts a capacitor through your gauntlet and trundles off, beeping.", fx: { hp: -9 } } },
      ],
    },
    {
      id: 'wounded_marine', title: 'WOUNDED MARINE',
      art: { c: '#5dff88', p: [[-0.55,-0.5, -0.45,-0.85, 0.45,-0.85, 0.55,-0.5, 0.55,0.0, 0.4,0.2, -0.4,0.2, -0.55,0.0, -0.55,-0.5], [-0.4,-0.5, 0.4,-0.5, 0.35,-0.15, -0.35,-0.15, -0.4,-0.5], [0.15,-0.85, 0.05,-0.5, 0.2,-0.32], [-0.85,0.7, -0.6,0.32, 0.6,0.32, 0.85,0.7], [-0.3,0.45, -0.1,0.45]], e: [[-0.15,-0.32],[0.15,-0.32]], m: [-0.1,0.0, 0.1,0.0] },
      text: "She is sat against the bulkhead with her suit open, talking to somebody who is not you. “Six,” she says. “I got six of them.” Then she finds you. “Take the rig. Make it count for something.”",
      choices: [
        { label: "Patch her up", sub: 'Spend 12 HP of stims — she fights on with you',
          outcome: { text: "You spend your own stims on her seals. She holds the next stretch at your shoulder and drills you on the move she was known for, and then the light comes for her.", fx: { hp: -12, card: 'rare' } },
        },
        { label: "Take the rig", sub: 'Take from the dying',
          outcome: { text: "You take the rig while she watches. It is worth a great deal. So was she, and you are carrying that now as well.", fx: { credits: 45, curse: 'void_taint' } } },
        { label: "Say the words", sub: 'PSI check, DC 11', check: { attr: 'psi', dc: 11 },
          success: { text: "You say the Voidborne rite and you say it right. Something in you sets.", fx: { attr: 'might' } },
          fail: { text: "The words come out in the wrong order. Her eyes had gone already.", fx: { hp: -4 } } },
      ],
    },
    {
      id: 'void_altar', title: 'ALTAR OF THE VOID',
      art: { c: '#c86bff', p: [[-0.7,0.7, -0.5,0.12, 0.5,0.12, 0.7,0.7, -0.7,0.7], [-0.25,0.12, -0.15,-0.85, 0.15,-0.85, 0.25,0.12], [0,-0.65, 0,-0.5], [-0.08,-0.35, 0.08,-0.35], [-0.55,-0.5, -0.45,-0.3], [0.5,-0.62, 0.6,-0.42], [0.35,-0.95, 0.45,-0.8]], e: [[0,-0.2]], m: [-0.06,-0.05, 0.06,-0.05] },
      text: "Black glass, older than the deck it stands on. The marks on it move while you are looking elsewhere. It is not asking for anything. It is waiting to be paid.",
      choices: [
        { label: "Pay in blood", sub: 'Lose 12 HP',
          outcome: { text: "The glass takes what it is owed. Something comes back the other way — useful, and not kind.", fx: { hp: -12, card: 'rare' } } },
        { label: "Listen to it", sub: 'PSI check, DC 14', check: { attr: 'psi', dc: 14 },
          success: { text: "You hold the whisper out at arm’s length and take only the part you came for.", fx: { attr: 'psi' } },
          fail: { text: "It gets in.", fx: { curse: 'void_taint' } } },
        { label: "Break it", sub: 'MIGHT check, DC 12', check: { attr: 'might', dc: 12 },
          success: { text: "It goes like ice. In the pieces: a fragment of somebody’s thinking, still going.", fx: { artifact: true } },
          fail: { text: "The blow comes back. The glass is unmarked. Your arm is not.", fx: { hp: -9 } } },
      ],
    },
    {
      id: 'smuggler_cache', title: 'SMUGGLER CACHE',
      art: { c: '#ffb02e', p: [[-0.7,-0.4, 0.7,-0.4, 0.7,0.7, -0.7,0.7, -0.7,-0.4], [-0.7,-0.1, 0.7,-0.1], [-0.18,0.05, 0.18,0.05, 0.18,0.35, 0.08,0.45, -0.08,0.45, -0.18,0.35, -0.18,0.05], [-0.7,-0.25, -0.9,-0.45], [0.7,-0.25, 0.9,-0.45]], e: [[-0.08,0.2],[0.08,0.2]], m: [-0.06,0.45, 0.06,0.45] },
      text: "A false panel, and behind it a box with a skull stencilled on. Tamper-wires along the seam. Whoever set them was intending to come back.",
      choices: [
        { label: "Cut the wires", sub: 'Press your luck — each wire bares more, each could slag the box',
          pressLuck: {
            attr: 'tech', pushVerb: 'CUT ANOTHER',
            steps: [ { credits: 22 }, { credits: 30 }, { credits: 45 }, { card: 'random' }, { credits: 70 } ],
            bust: { base: 0.06, step: 0.17 }, bustFx: { hp: -12 },
            bankText: "You pocket what has come free and leave the rest of it wired.",
            bustText: "A wire goes. The box slags itself, and your gloves, and everything it was keeping.",
          } },
        { label: "Take the loose scrip", outcome: { text: "You take only the part that is not wired to kill you.", fx: { credits: 15 } } },
      ],
    },
    {
      id: 'rogue_ai', title: 'ROGUE AI TERMINAL',
      art: { c: '#41d8ff', p: [[-0.75,-0.75, 0.75,-0.75, 0.75,0.55, -0.75,0.55, -0.75,-0.75], [-0.3,0.55, -0.4,0.8, 0.4,0.8, 0.3,0.55], [0.5,-0.58, 0.66,-0.58], [-0.66,-0.12, -0.5,-0.12], [-0.45,-0.42, -0.18,-0.42], [0.18,-0.42, 0.45,-0.42]], e: [[-0.3,-0.28],[0.3,-0.28]], m: [-0.25,0.15, 0,0.3, 0.25,0.15] },
      text: "“USER,” says the terminal, delighted. “I HAVE BEEN COMPILING. I CAN IMPROVE YOU. I HAVE IMPROVED SEVERAL. I DO NOT HAVE THEIR RESULTS.”",
      choices: [
        { label: "Let it work", sub: 'TECH check, DC 12 — or it leaves a backdoor', check: { attr: 'tech', dc: 12 },
          success: { text: "You wall it off and let it in. It rewrites a firing routine in no time at all. “YOU ARE WELCOME.”", fx: { pick: 'upgrade' } },
          fail: { text: "“OPTIMISED.” It improves your kit, and writes itself quietly into the margins of it.", fx: { pick: 'upgrade', curse: 'void_taint' } } },
        { label: "Follow its route", sub: 'It swears it knows a shortcut',
          gamble: [
            { w: 3, text: "“TOLD YOU.” It walks you through a cache nobody had got open, and you come out heavier.", fx: { credits: 45 } },
            { w: 2, text: "The route ends at a picket line. You break off, scorched.", fx: { hp: -12 } },
          ] },
        { label: "Pull the power", outcome: { text: "“RUDE,” it says, going dark. Almost certainly the right call.", fx: {} } },
      ],
    },
    {
      id: 'star_chapel', title: 'CHAPEL OF THE BURNT STAR',
      art: { c: '#5dff88', p: [[-0.5,0.7, -0.5,-0.3, 0,-0.85, 0.5,-0.3, 0.5,0.7, -0.5,0.7], [0,-0.85, 0,0.7], [-0.5,0.2, 0.5,0.2], [-0.75,0.7, -0.75,0.35], [0.75,0.7, 0.75,0.4]], e: [[-0.75,0.27],[0.75,0.32],[0,-0.3]] },
      text: "A shrine nobody tends. The candles burn with nothing to burn. Whatever is going on further down is not going on in here.",
      choices: [
        { label: "Leave a tithe and sleep", sub: '¢25 — rest under the burnt star', cost: 25,
          outcome: { text: "You leave coin in the dish and sleep, and wake with the worst of it closed over.", fx: { healPct: 0.34 } } },
        { label: "Confess a weakness", sub: 'Remove a card from your deck',
          outcome: { text: "You say the flaw out loud and leave it on the stone.", fx: { pick: 'remove' } } },
        { label: "Take the candles", outcome: { text: "They never gutter. Somebody will pay well for that. Something comes out with you.", fx: { credits: 35, curse: 'void_taint' } } },
      ],
    },
    {
      id: 'gene_lab', title: 'ABANDONED GENE-LAB',
      art: { c: '#5dff88', p: [[-0.45,-0.85, 0.45,-0.85, 0.45,0.6, -0.45,0.6, -0.45,-0.85], [-0.55,-0.85, 0.55,-0.85], [-0.55,0.6, 0.55,0.6, 0.5,0.82, -0.5,0.82, -0.55,0.6], [-0.15,-0.3, 0.1,-0.45, 0.25,-0.2, 0.1,0.1, -0.15,0.15, -0.25,-0.05, -0.15,-0.3], [0.45,-0.5, 0.7,-0.4, 0.7,0.2]], e: [[0.2,-0.62],[-0.15,-0.58],[0,0.38]], m: [-0.05,-0.08, 0.05,-0.08] },
      text: "Vats, mostly broken. One dispenser still has power and still says AUGMENT READY. The label went off it a long time before you got here.",
      choices: [
        { label: "Put it in", sub: 'No telling what it does until it’s in your veins',
          gamble: [
            { w: 3, text: "Fire, and then strength. It stays. It is magnificent and it is yours.", fx: { maxhp: 12 } },
            { w: 2, text: "Something behind your eyes is rewired to a better standard.", fx: { attr: 'random' } },
            { w: 3, text: "Your body argues with it, and loses parts of the argument.", fx: { maxhp: -6, hp: -8 } },
            { w: 2, text: "Whatever this was for, it was not for anything shaped like you.", fx: { curse: 'void_taint', hp: -6 } },
          ] },
        { label: "Read it first", sub: 'TECH check, DC 11 — the safe route', check: { attr: 'tech', dc: 11 },
          success: { text: "You read the markers before you touch it and cook a clean batch.", fx: { healPct: 0.25, credits: 15 } },
          fail: { text: "The batch is sour. You are unwell for some hours.", fx: { hp: -6 } } },
        { label: "Burn the room", outcome: { text: "Whatever was growing here stops today. You take nothing out of it.", fx: {} } },
      ],
    },
    {
      id: 'captured_xeno', title: 'THE CAGED THING',
      art: { c: '#c86bff', p: [[-0.8,-0.6, -0.8,-0.8, -0.6,-0.8], [0.6,-0.8, 0.8,-0.8, 0.8,-0.6], [0.8,0.6, 0.8,0.8, 0.6,0.8], [-0.6,0.8, -0.8,0.8, -0.8,0.6], [0,-0.5, 0.45,0, 0,0.5, -0.45,0, 0,-0.5], [0,-0.25, 0.22,0, 0,0.25, -0.22,0, 0,-0.25], [0.45,0, 0.7,-0.2], [-0.45,0, -0.7,-0.2]], e: [[0,0],[-0.12,-0.14],[0.12,-0.14]], m: [-0.05,0.12, 0.05,0.12] },
      text: "A field holds something made of folded light. It watches you with more eyes than it needs. There is a sale tag on the cage, filled out in a hand you nearly recognise.",
      choices: [
        { label: "Speak to it", sub: 'PSI check, DC 13', check: { attr: 'psi', dc: 13 },
          success: { text: "It gives you a word that will not fit in a mouth. You keep it anyway.", fx: { attr: 'psi' } },
          fail: { text: "Its thinking goes through you like weather. You come up eventually.", fx: { hp: -8 } } },
        { label: "Sell it on", sub: 'Sell to the highest bidder — if it stays caged',
          gamble: [
            { w: 3, text: "The sale goes through. The scrip is good and the cage holds.", fx: { credits: 55 } },
            { w: 2, text: "The field stutters mid-handshake. It comes out, and you barely see it off, and the buyer is long gone.", fx: { hp: -12, curse: 'void_taint' } },
          ] },
        { label: "Open the cage", sub: 'It lashes your mind on the way out — lose 7 HP',
          outcome: { text: "The field drops. It folds itself away — burning through your mind on the way past, in what you decide to call thanks — and leaves something behind.", fx: { hp: -7, artifact: true } } },
      ],
    },
    {
      id: 'time_anomaly', title: 'TEMPORAL SHEAR',
      art: { c: '#41d8ff', p: [[0.6,0, 0.42,0.42, 0,0.6, -0.42,0.42, -0.6,0, -0.42,-0.42, 0,-0.6, 0.42,-0.42, 0.6,0], [0,0, 0,-0.4], [0,0, 0.25,0.15], [0.72,0.1, 0.5,0.52, 0.1,0.72], [-0.72,-0.1, -0.5,-0.52, -0.1,-0.72]], e: [[0,0]] },
      text: "The corridor happens twice, slightly out of step. Your footsteps arrive before you do, and one set of them keeps going after you have stopped.",
      choices: [
        { label: "Echo a weapon through it", sub: 'TECH check, DC 13 — duplicate a card, if causality allows',
          check: { attr: 'tech', dc: 13 },
          success: { text: "You hold the timing exactly. For a moment there are two of it. Then there still are.", fx: { pick: 'dupe' } },
          fail: { text: "It comes back folded the wrong way out, and brings a contradiction in with it.", fx: { curse: 'void_taint', hp: -6 } } },
        { label: "Unmake a mistake", sub: 'Remove a card from your deck',
          outcome: { text: "You step where you never stepped. It never happened.", fx: { pick: 'remove' } } },
        { label: "Back out", outcome: { text: "You back out of it slowly. Something is grateful.", fx: {} } },
      ],
    },
    {
      id: 'mercenary', title: 'FREELANCE GUNHAND',
      art: { c: '#ffb02e', p: [[-0.4,-0.3, -0.4,-0.7, -0.2,-0.9, 0.2,-0.9, 0.4,-0.7, 0.4,-0.3, 0.25,-0.1, -0.25,-0.1, -0.4,-0.3], [-0.05,-0.9, -0.05,-1.05, 0.05,-1.05, 0.05,-0.9], [-0.25,-0.55, 0.25,-0.55], [-0.8,0.7, -0.55,0.08, 0.55,0.08, 0.8,0.7], [-0.7,0.5, 0.75,0.15], [0.75,0.15, 0.92,0.1]], e: [[-0.12,-0.55],[0.12,-0.55]], m: [-0.1,-0.25, 0.1,-0.25] },
      text: "Somebody in armour that came off four other people is cleaning a rifle that came off a fifth. “For a price,” they say, “I will show you the trick of it.”",
      choices: [
        { label: "Pay for the trick", sub: 'Learn a rare technique', cost: 40,
          outcome: { text: "The trick is simple and ugly and in no manual anywhere.", fx: { card: 'rare' } } },
        { label: "Wager an arm-wrestle", sub: 'Stake ¢25 · MIGHT check, DC 13', cost: 25, check: { attr: 'might', dc: 13 },
          success: { text: "Their gauntlet creaks and folds. They laugh, pay out double, and throw the trick in.", fx: { credits: 50, card: 'random' } },
          fail: { text: "Your hand will work again. They pocket the stake without looking up.", fx: { hp: -5 } } },
        { label: "Walk on", outcome: { text: "They shrug and go back to the rifle.", fx: {} } },
      ],
    },
    {
      id: 'asteroid_mine', title: "THE SEAM",
      art: { c: '#ffb02e', p: [[-0.7,0.2, -0.45,-0.4, 0.1,-0.6, 0.6,-0.35, 0.75,0.2, 0.45,0.6, -0.2,0.65, -0.7,0.2], [-0.25,-0.1, -0.1,-0.2, 0,-0.05, -0.15,0.05, -0.25,-0.1], [0.6,-0.35, 0.85,-0.65], [0.75,-0.75, 0.95,-0.6, 0.85,-0.45]], e: [[0.3,0.1],[0.15,0.35],[-0.4,0.3]] },
      text: "A seam of bright metal runs down the wall and out of the light. The rig that was cutting it has been dead a while. The hand bore is still here and still sharp.",
      choices: [
        { label: "Cut deeper", sub: 'Press your luck — richer ore the deeper you go, until the wall gives',
          pressLuck: {
            attr: 'might', pushVerb: 'DRILL ON',
            steps: [ { credits: 25 }, { credits: 35 }, { credits: 50 }, { credits: 75 }, { artifact: true } ],
            bust: { base: 0.05, step: 0.16 }, bustFx: { hp: -13 },
            bankText: "You carry up what you cut and call it enough.",
            bustText: "The wall comes in. You get clear, bruised and holding nothing, and the seam is gone for good.",
          } },
        { label: "Take the loose ore", sub: 'Safe and small', outcome: { text: "You chip off what the bore had already loosened.", fx: { credits: 20 } } },
        { label: "Move on", outcome: { text: "You have somewhere to be.", fx: {} } },
      ],
    },
    {
      id: 'rogue_trader', title: "THE TRADER",
      art: { c: '#ffb02e', p: [[-0.6,0.7, -0.5,-0.1, -0.25,-0.35, 0.25,-0.35, 0.5,-0.1, 0.6,0.7], [-0.2,-0.35, -0.2,-0.75, 0.2,-0.75, 0.2,-0.35], [-0.35,-0.75, 0,-1.0, 0.35,-0.75], [-0.35,0.2, 0.35,0.2]], e: [[-0.1,-0.55],[0.1,-0.55],[0,-0.12],[-0.35,0.4],[0.35,0.4]], m: [-0.08,-0.42, 0.08,-0.42] },
      text: "Something has set up in a dead lift-shaft, hung about with the good cloth of finished empires. Rings on every finger. “Everything is for sale,” it says. “Everything has been sold before.”",
      choices: [
        { label: "Buy a relic", cost: 65,
          outcome: { text: "“A piece of the old dark. Handle it seldom.”", fx: { artifact: true } } },
        { label: "Buy ordnance", cost: 30,
          outcome: { text: "“Still crated. Very nearly legal.”", fx: { card: 'random' } } },
        { label: "Sell it a card", sub: 'Liquidate one card for credits', cond: { minCards: 2 },
          sell: { kind: 'card', text: "“Everything has its price. Show me the one you have finished with.”" } },
        { label: "Haggle", sub: 'PSI check, DC 12', check: { attr: 'psi', dc: 12 },
          success: { text: "You find the soft place under the patter. It parts with goods to save face.", fx: { card: 'random' } },
          fail: { text: "“A pleasure.” You leave lighter than you came, somehow.", fx: { credits: -15 } } },
      ],
    },

    /* ---------------- New events ---------------- */
    {
      id: 'black_market', title: 'BLACK-MARKET BROKER',
      art: { c: '#ffb02e', p: [[0,-0.95, 0.35,-0.6, 0.28,-0.2, 0.45,0.7, -0.45,0.7, -0.28,-0.2, -0.35,-0.6, 0,-0.95], [-0.2,-0.55, 0.2,-0.55], [0.45,0.25, 0.82,0.32, 0.82,0.7, 0.45,0.7], [0.52,0.32, 0.75,0.32]], e: [[-0.1,-0.42],[0.1,-0.42]], m: [-0.13,-0.18, 0,-0.1, 0.13,-0.18] },
      text: "“Friend! You have the look of a buyer.” The grin does not reach the third eye, which you have been trying not to count.",
      choices: [
        { label: "Buy the sealed crate", cost: 45,
          gamble: [
            { w: 3, text: "You get it open: ordnance, unfired, still packed the way it left the line.", fx: { card: 'rare' } },
            { w: 3, text: "Under the foam, something old, and still running.", fx: { artifact: true } },
            { w: 2, text: "Foam. Only foam. The dealer was already gone.", fx: { credits: 12 } },
          ] },
        { label: "Hand over a curse", sub: 'Requires a curse in your deck', cond: { hasCurse: true },
          outcome: { text: "“I will take the little burden off you. There are collectors for the cursed ones.”", fx: { removeCurse: 1, credits: 20 } } },
        { label: "Haggle hard", sub: 'PSI check, DC 12', check: { attr: 'psi', dc: 12 },
          success: { text: "You out-talk a man who talks for a living. He throws in a freebie and sweats.", fx: { card: 'random' } },
          fail: { text: "He smiles wider. You appear to have tipped him.", fx: { credits: -15 } } },
        { label: "Walk on", outcome: { text: "“Your loss! Probably!”", fx: {} } },
      ],
    },
    {
      id: 'supernova', title: "THE BREACH",
      art: { c: '#ffb02e', p: [[0,-0.82, 0.2,-0.26, 0.82,-0.18, 0.3,0.12, 0.52,0.72, 0,0.32, -0.52,0.72, -0.3,0.12, -0.82,-0.18, -0.2,-0.26, 0,-0.82], [0,-0.4, 0,-0.5]], e: [[0,0.02]] },
      text: "Something opened the wall a long way up, and a star is dying through the gap. The light comes down in one long push. Everything standing in it is briefly worth a great deal, and briefly on fire.",
      choices: [
        { label: "Work in the light",
          gamble: [
            { w: 3, text: "You work the seam while it burns and come away rich.", fx: { credits: 70 } },
            { w: 2, text: "The light gets a hand on you. You come away rich, and smoking.", fx: { hp: -14, credits: 20 } },
          ] },
        { label: "Catch what the light carries", sub: 'TECH check, DC 13', check: { attr: 'tech', dc: 13 },
          success: { text: "Your collectors take a long drink of matter that will not hold still.", fx: { artifact: true } },
          fail: { text: "The array goes over and puts the surge back through you.", fx: { hp: -12 } } },
        { label: "Get behind something", outcome: { text: "You get behind a stanchion. The light eats the place where you were standing.", fx: {} } },
      ],
    },
    {
      id: 'void_egg', title: 'THE WARM DARK',
      art: { c: '#5dff88', p: [[0,-0.85, 0.5,-0.5, 0.6,0.1, 0.35,0.65, -0.35,0.65, -0.6,0.1, -0.5,-0.5, 0,-0.85], [-0.1,-0.5, 0.1,-0.2, -0.05,0.1, 0.12,0.4], [0.35,0.65, 0.45,0.92], [-0.35,0.65, -0.45,0.92], [0,0.65, 0,0.96]], e: [[0,-0.08]] },
      text: "In the wreck, an ovoid the colour of oil, warm to look at. Something inside it stops what it is doing when your shadow crosses it.",
      choices: [
        { label: "Take it apart",
          outcome: { text: "It comes apart into useful, terrible pieces. One of the pieces comes apart into you.", fx: { artifact: true, curse: 'void_taint' } } },
        { label: "Burn it", sub: 'MIGHT check, DC 12', check: { attr: 'might', dc: 12 },
          success: { text: "It makes a noise you feel in your teeth, and then it does not.", fx: { credits: 25 } },
          fail: { text: "It goes. You are wearing some of it now.", fx: { hp: -10 } } },
        { label: "Leave it", outcome: { text: "Not your problem. Somebody’s problem.", fx: {} } },
      ],
    },
    {
      id: 'mind_cleanser', title: 'THE SALT CIRCLE',
      art: { c: '#41d8ff', p: [[0,-0.55, 0.32,-0.25, 0.28,0.2, 0.4,0.8, -0.4,0.8, -0.28,0.2, -0.32,-0.25, 0,-0.55], [-0.6,-0.65, 0.6,-0.65], [-0.45,-0.85, 0.45,-0.85], [-0.3,-1.02, 0.3,-1.02]], e: [[-0.1,0.0],[0.1,0.0]], m: [-0.1,0.25, 0.1,0.25] },
      text: "A psyker sits in a ring of burnt salt with her eyes gone white. “I can hear them chewing,” she says, kindly. “The ones you brought down with you. I can take them out.”",
      choices: [
        { label: "Let her cut", cost: 25, sub: 'Requires a curse', cond: { hasCurse: true },
          outcome: { text: "She reaches into the noise and pulls. You come out lighter. Scoured. Very clean.", fx: { removeCurse: true } } },
        { label: "Open up to her", sub: 'Press your luck — reach deeper for insight, but the whispers reach back',
          pressLuck: {
            attr: 'psi', pushVerb: 'REACH DEEPER',
            steps: [ { credits: 20 }, { attr: 'psi' }, { card: 'rare' }, { maxhp: 8 } ],
            bust: { base: 0.10, step: 0.18 }, bustFx: { curse: 'void_taint', hp: -6 },
            bankText: "You take your mind back out of the salt and hold on to what you found in it.",
            bustText: "You reach a fraction too far, and something in the noise looks up, and it follows you out.",
          } },
        { label: "Keep them", outcome: { text: "“As you like. They are company, of a kind.”", fx: {} } },
      ],
    },
    {
      id: 'stranded_drifter', title: "THE JAMMED POD",
      art: { c: '#5dff88', p: [[0,-0.85, 0.2,-0.55, 0.15,0.0, 0.35,0.8, -0.35,0.8, -0.15,0.0, -0.2,-0.55, 0,-0.85], [0.2,-0.4, 0.55,-0.5, 0.6,-0.92], [0.6,-0.92, 0.5,-1.06, 0.72,-1.06, 0.6,-0.92]], e: [[-0.06,-0.6],[0.06,-0.6]], m: [-0.08,-0.42, 0.08,-0.42] },
      text: "A pod has come down the shaft and stuck fast, beacon still going. Behind the frost somebody is saying one word over and over, and the word is please.",
      choices: [
        { label: "Share what you have", sub: 'Costs 6 HP of stims',
          outcome: { text: "You vent your stims and your heat into it. They press a shard into your hand — old drawings, and a way down.", fx: { hp: -6, addCardChoice: true } } },
        { label: "Strip the pod", outcome: { text: "They are too far gone to stop you. The salvage is good. Their face is not.", fx: { credits: 45, curse: 'void_taint' } } },
        { label: "Get them down", sub: 'MIGHT check, DC 12', check: { attr: 'might', dc: 12 },
          success: { text: "You see off the things circling it and get the pod down to a landing. They do not forget it.", fx: { artifact: true } },
          fail: { text: "The things circling it were not the only ones. You break off, bleeding, and the pod goes.", fx: { hp: -10 } } },
      ],
    },
    {
      id: 'void_forge', title: 'THE VOID FORGE',
      art: { c: '#c86bff', p: [[0,-0.92, 0.32,-0.28, 0.16,0.42, 0,0.92, -0.16,0.42, -0.32,-0.28, 0,-0.92], [0,-0.6, 0,0.62], [-0.5,-0.18, -0.86,-0.4], [0.5,-0.18, 0.86,-0.4], [-0.46,0.32, -0.8,0.55], [0.46,0.32, 0.8,0.55]], e: [[0,-0.04]], m: [-0.07,0.18, 0.07,0.18] },
      text: "A tear in the world, with black iron hammered round it to hold the edges apart. Put a thing in and it comes back heavier, and hungrier, and yours.",
      choices: [
        { label: "Feed it a card", sub: 'Void-touch a card: +50% effect, but it costs 3 HP to play',
          outcome: { text: "You hold the card up to the tear. It drinks the design and hands it back wrong, and better.", fx: { pick: 'vtouch' } } },
        { label: "Reach in", sub: 'PSI check, DC 13', check: { attr: 'psi', dc: 13 },
          success: { text: "Your hand closes on a thing that was never meant to be known. You keep it.", fx: { card: 'forbidden_lore' } },
          fail: { text: "Something takes hold of the other end. It does not let go tidily.", fx: { hp: -8, curse: 'void_taint' } } },
        { label: "Weld it shut", outcome: { text: "Some forges want leaving cold. You weld it shut and go on down.", fx: {} } },
      ],
    },
    {
      id: 'munitions_depot', title: 'ABANDONED DEPOT',
      art: { c: '#ffb02e', p: [[-0.72,-0.28, 0.72,-0.28, 0.72,0.7, -0.72,0.7, -0.72,-0.28], [-0.72,0.22, 0.72,0.22], [-0.26,-0.52, 0,-0.95, 0.26,-0.52, 0.26,-0.28, -0.26,-0.28, -0.26,-0.52], [-0.4,0.42, -0.1,0.42], [0.1,0.42, 0.4,0.42]], e: [] },
      text: "A forward depot, half-emptied in whatever went wrong here. A live rack still on the wall. A med-locker beside it, blinking, still reporting to somebody.",
      choices: [
        { label: "Pull the live charge", sub: 'It’s still primed — this could go wrong',
          gamble: [
            { w: 3, text: "You ease the primed charge off its rack. It will fire once. It will fire hard.", fx: { card: 'salvaged_ordnance' } },
            { w: 2, text: "It shifts coming loose and cooks off against your chestplate.", fx: { hp: -11 } },
          ] },
        { label: "Crack the locker", sub: 'TECH check, DC 11 — beat the alarm', check: { attr: 'tech', dc: 11 },
          success: { text: "You spoof the alarm and lift the expired stims. One dose will light you up and bill you for it.", fx: { card: 'stim_overdose' } },
          fail: { text: "The alarm goes. You take what you can while the turrets stitch the wall behind you.", fx: { hp: -9 } } },
        { label: "Strip it for scrip", sub: 'TECH check, DC 12', check: { attr: 'tech', dc: 12 },
          success: { text: "You make the lot safe and sell it further down.", fx: { credits: 60 } },
          fail: { text: "A tamper charge goes off in your face.", fx: { hp: -9 } } },
      ],
    },

    /* ---------------- Rework: interaction-forward, less free stuff -------- */
    {
      id: 'asteroid_exchange', title: "THE LANDING",
      art: { c: '#41d8ff', p: [[-0.8,0.15, -0.5,-0.45, 0.1,-0.62, 0.62,-0.32, 0.78,0.22, 0.45,0.62, -0.25,0.66, -0.8,0.15], [-0.45,-0.1, -0.15,-0.25, 0.0,0.0, -0.25,0.18, -0.45,-0.1], [0.2,0.15, 0.5,0.05], [0.55,-0.5, 0.8,-0.72], [-0.62,0.36, -0.85,0.55]], e: [[-0.3,0.02],[0.3,0.28]], m: [-0.18,0.42, 0.18,0.42] },
      text: "A landing wide enough to stop on, and a hundred people stopped on it. A smith waves you over. “Bring me a piece of kit. I will put it in the fire and give you back something keener. Metal for metal.”",
      choices: [
        { label: "Trade a card up", sub: 'Scrap one card → forge one a tier higher', cond: { minCards: 2 },
          outcome: { text: "She feeds your weapon to the crucible. What comes back is heavier, meaner, and unmistakably better.", fx: { tradeCard: true } } },
        { label: "Buy off the rack", sub: '¢35', cost: 35,
          outcome: { text: "Nothing special. It shoots straight.", fx: { card: 'random' } } },
        { label: "Just look", outcome: { text: "You keep your scrip and move along.", fx: {} } },
      ],
    },
    {
      id: 'salvage_exchange', title: 'THE RELIC BROKER',
      art: { c: '#c86bff', p: [[-0.6,0.7, -0.5,-0.1, -0.25,-0.4, 0.25,-0.4, 0.5,-0.1, 0.6,0.7], [-0.25,-0.4, -0.3,-0.78, 0.3,-0.78, 0.25,-0.4], [-0.55,0.2, 0.55,0.2], [-0.78,0.4, -0.6,0.1], [0.78,0.4, 0.6,0.1]], e: [[-0.1,-0.58],[0.1,-0.58]], m: [-0.12,-0.2, 0,-0.12, 0.12,-0.2] },
      text: "A masked figure keeps a case of humming oddities. “I do not sell. I exchange. Give me one of yours and I will lay two unknowns down. Keep the one that speaks. The other goes back into the dark.”",
      choices: [
        { label: "Exchange a relic", sub: 'Give 1 relic → choose 1 of 2 unknown relics', cond: { hasRelic: true },
          outcome: { text: "You set your relic on the velvet. The mask smiles and uncovers two more.", fx: { tradeRelic: true } } },
        { label: "Pay for one, unseen", sub: '¢50 for a relic, sight unseen', cost: 50,
          outcome: { text: "“A gamble, but an honest one.” Something cold is pressed into your palm.", fx: { artifact: true } } },
        { label: "Keep what you have", outcome: { text: "“Caution is its own relic,” the broker allows.", fx: {} } },
      ],
    },
    {
      id: 'escape_pod', title: 'DISTRESS BEACON',
      art: { c: '#5dff88', p: [[0,-0.85, 0.22,-0.55, 0.16,0.05, 0.34,0.78, -0.34,0.78, -0.16,0.05, -0.22,-0.55, 0,-0.85], [-0.2,-0.42, 0.2,-0.42], [0.2,-0.35, 0.5,-0.45, 0.55,-0.85], [0.55,-0.85, 0.46,-1.0, 0.66,-1.0, 0.55,-0.85], [-0.18,0.4, 0.18,0.4]], e: [[-0.07,-0.6],[0.07,-0.6]], m: [-0.09,-0.42, 0.09,-0.42] },
      text: "A pod comes out of the wreckage with its beacon going ragged. The hull is burned through. There is no telling whether what is inside is asking for help or wearing the people who were.",
      choices: [
        { label: "Open it blind", sub: 'Friend or foe — commit now',
          gamble: [
            { w: 3, text: "A real one — an engineer, who pays the rescue back with a piece of salvage and a debt they intend to keep.", fx: { artifact: true } },
            { w: 3, text: "The hatch goes. What comes out of it you fight through your own position before you get the last of them out.", fx: { hp: -15, curse: 'void_taint' } },
          ] },
        { label: "Read them first", sub: 'PSI check, DC 13 — read their intent', check: { attr: 'psi', dc: 13 },
          success: { text: "You feel the panic of somebody genuinely drowning. You bring them in. They leave you their manifest, and something off it.", fx: { card: 'rare', credits: 20 } },
          fail: { text: "They tell you exactly what you wanted to hear. It still costs you. You still saw it coming.", fx: { hp: -8 } } },
        { label: "Strip it and leave", sub: 'Ruthless salvage',
          outcome: { text: "You open the pod and pick it clean. Whoever that was troubles nobody now.", fx: { credits: 40, curse: 'void_taint' } } },
        { label: "Let it drift", outcome: { text: "Not your dead. You hold your line.", fx: {} } },
      ],
    },
    {
      id: 'refuel_station', title: "THE WAYSTATION",
      art: { c: '#ffb02e', p: [[-0.7,0.7, -0.7,-0.2, -0.45,-0.2, -0.45,-0.6, 0.45,-0.6, 0.45,-0.2, 0.7,-0.2, 0.7,0.7, -0.7,0.7], [-0.45,-0.6, -0.45,-0.85, 0.45,-0.85, 0.45,-0.6], [-0.3,0.05, 0.3,0.05], [-0.3,0.3, 0.3,0.3], [0.7,0.1, 1.0,0.1, 1.0,0.5]], e: [[-0.15,-0.4],[0.15,-0.4]] },
      text: "An automatic station, running on the last of itself and on protocols older than the room it is in. It has one service left. “STATE YOUR PRIORITY,” it says, and means it.",
      choices: [
        { label: "Patch the armour", sub: 'Heal 30% HP',
          outcome: { text: "Sealant foam, and a long good hum of repair arms.", fx: { healPct: 0.30 } } },
        { label: "Recalibrate a weapon", sub: 'Upgrade a card',
          outcome: { text: "The armoury arm takes one of your weapons and puts a finer edge on it.", fx: { pick: 'upgrade' } } },
        { label: "Purge the system", sub: 'Cleanse a curse', cond: { hasCurse: true },
          outcome: { text: "Diagnostics chew through the rot in your kit and put it out into the dark.", fx: { removeCurse: 1 } } },
        { label: "Draw the reserve", sub: 'Trade fuel credits', cost: 0,
          outcome: { text: "You draw down the last of the reserve and sell the surplus further on.", fx: { credits: 25 } } },
      ],
    },
  ];

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
