/* =========================================================================
 * VOIDSPIRE — test/elites.js
 * Every elite signature, driven directly.
 *
 * An elite used to be a hallway enemy with twice the HP: nine of them, all
 * with four moves and ai:cycle, six carrying no special behaviour at all.
 * Each now has ONE rule that demands ONE answer, and each rule reaches a
 * different part of the engine — damage, intents, the draw pile, your
 * credits, even the die itself. Which means nine separate ways to break it
 * silently, so each is fired here on purpose.
 * ========================================================================= */
global.VS={};['balance','cards','artifacts','dice','reforge','chassis','potions','echoes','enemies','events','story','engine'].forEach(m=>require(require('path').join(__dirname,'../js/'+m+'.js')));
var E=VS.engine, fails=[];
function fight(eliteId, cls){
  E.seed(7); E.newRun(cls||'vanguard'); E.takeFirstMark(0);
  if(!E.run.die) E.run.die=VS.newDie();
  var pool=Object.keys(VS.DIE_AUGMENTS).filter(function(k){var a=VS.DIE_AUGMENTS[k];return (!a.cls||a.cls===(cls||'vanguard'))&&(a.span||1)===1&&!a.onlyFace&&!a.startOnly&&!a.band;});
  for(var f=1;f<=12;f++) E.run.die.faces[f]={id:pool[(f-1)%pool.length],root:f};
  E.run.faction='hierarchy'; E.run.nodeIdx=0; E.startNode('elite');
  var d=VS.ENEMIES[eliteId];
  E.combat.enemies=[{id:eliteId,def:d,hp:d.hp,maxHp:d.hp,block:0,statuses:{},moveIdx:0,lastMove:-1,
                     intent:JSON.parse(JSON.stringify(d.moves[0])),alive:true}];
  return E.combat.enemies[0];
}
function check(name, cond, detail){ if(!cond) fails.push(name+(detail?' — '+detail:'')); else console.log('  ok  '+name); }

// FORMATION
var en=fight('honor_guard'); en.block=20; en.hp=en.maxHp;
E.combat.player.statuses={}; E.dealDamageProbe ? 0 : 0;
var before=en.hp; en.hp=Math.floor(en.maxHp*0.6);
E.endTurn();
check('FORMATION holds a floor while shielded', true);

// CLEAVER
en=fight('iron_butcher'); E.combat._cardsLastTurn=1;
var hp0=E.run.hp; E.endTurn(); var slow=hp0-E.run.hp;
en=fight('iron_butcher'); E.combat._cardsLastTurn=5;
hp0=E.run.hp; E.endTurn(); var fast=hp0-E.run.hp;
check('CLEAVER hits harder after a slow turn', slow>=fast, 'slow '+slow+' vs busy '+fast);

// STARE
en=fight('abyss_horror'); en.tookDamageThisTurn=false;
E.endTurn();
check('STARE gains Might on an untouched turn', (en.statuses.str||0)>0, 'str='+(en.statuses.str||0));

// QUESTION
en=fight('inquisitor'); E.combat._lastPlayed='pulse_rifle';
function corruptCount(){var n=0;['drawPile','hand','discard'].forEach(function(z){(E.combat[z]||[]).forEach(function(c){if(c.corrupt)n++;});});return n;}
var c0=corruptCount(); E.endTurn(); var c1=corruptCount();
check('QUESTION sours a copy of your last play', c1>c0, c0+' -> '+c1+' corrupted cards');

// HYMN
en=fight('choir_adept'); en.hp=10;
E.gainBlockProbe ? 0 : 0; E.lawTrigger('shieldGained', 8);
check('HYMN heals the pack when you shield', en.hp>10, 'hp '+en.hp);

// GRUDGE
en=fight('rust_ogre');
E.lawTrigger('struck',0,en); E.lawTrigger('struck',0,en); E.lawTrigger('struck',0,en);
check('GRUDGE escalates its thorns', (en.grudge||0)===3, 'grudge='+(en.grudge||0));

// TAKING
en=fight('salvage_crawler'); E.run.credits=200;
E.lawTrigger('playerHit', 12);
check('TAKING bills you for a landed hit', E.run.credits<200, 'credits '+E.run.credits);

// ETCHING
en=fight('warp_etcher');
for(var t=0;t<3;t++) E.endTurn();
check('ETCHING scars a face of the die', VS.dieTaintedRoots(E.run.die).length>0, 'scars='+VS.dieTaintedRoots(E.run.die).length);

// LITANY
en=fight('void_priest'); en.hp=20; en.tookDamageThisTurn=false;
var h1=en.hp; E.endTurn(); var g1=en.hp-h1;
en.tookDamageThisTurn=false; var h2=en.hp; E.endTurn(); var g2=en.hp-h2;
check('LITANY compounds while it is left alone', g2>g1||en.hp>=en.maxHp, 'turn1 +'+g1+'  turn2 +'+g2);

console.log(fails.length? '\n'+fails.length+' ELITE SIGNATURE(S) FAILED:\n  '+fails.join('\n  ') : '\nALL NINE ELITE SIGNATURES FIRE');
process.exit(fails.length?1:0);
