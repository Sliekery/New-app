/* =========================================================================
   ELDERVALE — Thornveil Reach
   A GW1-style MMO-lite prototype. Vanilla JS, no dependencies.
   ========================================================================= */
'use strict';

/* ---------------- utils ---------------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rng = mulberry32(0xE1DE7A1E);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const dist=(ax,ay,bx,by)=>Math.hypot(bx-ax,by-ay);
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const irand=(a,b)=>Math.floor(rand(a,b+1));

/* ---------------- constants ---------------- */
const TILE=32, MAPW=96, MAPH=96;
const G_GRASS=0,G_PATH=1,G_WATER=2,G_TREE=3,G_DIRT=4,G_WALL=5,G_BRIDGE=6,G_ROCK=7;
const BLOCKED=new Set([G_WATER,G_TREE,G_WALL,G_ROCK]);
const MELEE_RANGE=46;
const AGGRO_R=175, SOCIAL_R=140, LEASH_R=400;
const OUTPOST={x:13.5*TILE,y:78*TILE,r:7.5*TILE};
const SHRINE={x:16*TILE,y:75*TILE};
const CAMP={x:78*TILE,y:20*TILE,r:8*TILE};

/* ---------------- map ---------------- */
const map=new Uint8Array(MAPW*MAPH);
const T=(x,y)=>(x<0||y<0||x>=MAPW||y>=MAPH)?G_ROCK:map[y*MAPW+x];
const setT=(x,y,v)=>{if(x>=0&&y>=0&&x<MAPW&&y<MAPH)map[y*MAPW+x]=v;};
const riverCX=y=>58+Math.sin(y*0.07)*7;

function buildMap(){
  // river
  for(let y=0;y<MAPH;y++){
    const cx=Math.round(riverCX(y));
    for(let x=cx-3;x<=cx+3;x++) setT(x,y,G_WATER);
  }
  // path (stamped over water becomes bridge)
  const wp=[[13,78],[22,72],[30,66],[40,60],[50,53],[58,48],[66,40],[71,31],[75,26]];
  for(let i=0;i<wp.length-1;i++){
    const [ax,ay]=wp[i],[bx,by]=wp[i+1];
    const steps=Math.ceil(dist(ax,ay,bx,by)*2);
    for(let s=0;s<=steps;s++){
      const px=lerp(ax,bx,s/steps),py=lerp(ay,by,s/steps);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const tx=Math.round(px+dx),ty=Math.round(py+dy);
        setT(tx,ty,T(tx,ty)===G_WATER?G_BRIDGE:G_PATH);
      }
    }
  }
  // outpost dirt
  stampCircle(13.5,78,7.5,G_DIRT);
  // bandit camp dirt + palisade ring with SW gap
  stampCircle(78,20,8,G_DIRT);
  for(let a=0;a<Math.PI*2;a+=0.04){
    const gapTo=Math.atan2(26-20,75-78); // toward path entrance
    let d=Math.abs(((a-gapTo+Math.PI*3)%(Math.PI*2))-Math.PI);
    if(d<0.55) continue; // gate gap
    const tx=Math.round(78+Math.cos(a)*8.5),ty=Math.round(20+Math.sin(a)*8.5);
    if(T(tx,ty)!==G_PATH) setT(tx,ty,G_WALL);
  }
  // forest patches
  const groves=[[30,30,11],[18,48,9],[44,20,10],[70,60,12],[40,84,9],[84,44,8],[58,72,8],[24,14,9]];
  for(const [gx,gy,gr] of groves){
    for(let y=gy-gr;y<=gy+gr;y++)for(let x=gx-gr;x<=gx+gr;x++){
      if(dist(x,y,gx,gy)<=gr&&T(x,y)===G_GRASS&&rng()<0.45) setT(x,y,G_TREE);
    }
  }
  // scattered trees
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++)
    if(T(x,y)===G_GRASS&&rng()<0.045) setT(x,y,G_TREE);
  // clear trees near path / dirt / bridge
  const clear=[];
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    if(T(x,y)!==G_TREE) continue;
    let near=false;
    for(let dy=-2;dy<=2&&!near;dy++)for(let dx=-2;dx<=2&&!near;dx++){
      const t=T(x+dx,y+dy);
      if(t===G_PATH||t===G_DIRT||t===G_BRIDGE) near=true;
    }
    if(near) clear.push([x,y]);
  }
  for(const [x,y] of clear) setT(x,y,G_GRASS);
  // rocky border
  for(let i=0;i<MAPW;i++)for(let b=0;b<2;b++){
    setT(i,b,G_ROCK);setT(i,MAPH-1-b,G_ROCK);setT(b,i,G_ROCK);setT(MAPW-1-b,i,G_ROCK);
  }
}
function stampCircle(cx,cy,r,v){
  for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++)
    if(dist(x,y,cx,cy)<=r) setT(x,y,v);
}

function blockedAt(x,y){
  const t=T(Math.floor(x/TILE),Math.floor(y/TILE));
  return BLOCKED.has(t);
}
function blockedCircle(x,y,r){
  if(x<r||y<r||x>MAPW*TILE-r||y>MAPH*TILE-r) return true;
  const o=r*0.7;
  return blockedAt(x,y)||blockedAt(x-o,y-o)||blockedAt(x+o,y-o)||blockedAt(x-o,y+o)||blockedAt(x+o,y+o);
}
function tryMove(e,dx,dy){
  if(dx&&!blockedCircle(e.x+dx,e.y,e.r)) e.x+=dx;
  if(dy&&!blockedCircle(e.x,e.y+dy,e.r)) e.y+=dy;
}
function findOpen(tx,ty){
  for(let r=0;r<10;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const x=(tx+dx+0.5)*TILE,y=(ty+dy+0.5)*TILE;
    if(!blockedCircle(x,y,14)) return {x,y};
  }
  return {x:(tx+0.5)*TILE,y:(ty+0.5)*TILE};
}
const inSafeZone=e=>dist(e.x,e.y,OUTPOST.x,OUTPOST.y)<OUTPOST.r;

/* ---------------- terrain prerender ---------------- */
let terraCv, miniCv;
function renderTerrain(){
  terraCv=document.createElement('canvas');
  terraCv.width=MAPW*TILE; terraCv.height=MAPH*TILE;
  const c=terraCv.getContext('2d');
  const vr=mulberry32(77);
  const trees=[];
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    const t=T(x,y),px=x*TILE,py=y*TILE,v=vr()*10-5;
    let col;
    switch(t){
      case G_PATH: col=`rgb(${138+v},${115+v},${80+v})`; break;
      case G_WATER: col=`rgb(${26+v*0.5},${72+v},${105+v})`; break;
      case G_DIRT: col=`rgb(${110+v},${90+v},${62+v})`; break;
      case G_BRIDGE: col=`rgb(${122+v},${90+v},${51+v})`; break;
      case G_ROCK: col=`rgb(${82+v},${82+v},${86+v})`; break;
      default: col=`rgb(${64+v},${96+v},${52+v})`;
    }
    c.fillStyle=col; c.fillRect(px,py,TILE,TILE);
    if(t===G_GRASS&&vr()<0.3){
      c.strokeStyle='rgba(40,70,30,.55)'; c.lineWidth=1; c.beginPath();
      const gx=px+vr()*TILE,gy=py+vr()*TILE;
      c.moveTo(gx,gy); c.lineTo(gx+2,gy-5); c.stroke();
    }
    if(t===G_WATER&&vr()<0.16){
      c.strokeStyle='rgba(180,220,240,.28)'; c.beginPath();
      c.arc(px+vr()*TILE,py+vr()*TILE,4+vr()*3,Math.PI*0.1,Math.PI*0.6); c.stroke();
    }
    if(t===G_BRIDGE){
      c.strokeStyle='rgba(60,40,18,.6)';
      for(let i=0;i<3;i++){c.beginPath();c.moveTo(px,py+5+i*11);c.lineTo(px+TILE,py+5+i*11);c.stroke();}
    }
    if(t===G_PATH&&vr()<0.12){
      c.fillStyle='rgba(90,75,52,.7)'; c.beginPath();
      c.arc(px+vr()*TILE,py+vr()*TILE,2.5,0,7); c.fill();
    }
    if(t===G_ROCK){
      c.fillStyle=`rgb(${100+v},${100+v},${106+v})`; c.beginPath();
      c.arc(px+TILE/2,py+TILE/2,12,0,7); c.fill();
      c.fillStyle='rgba(255,255,255,.08)'; c.beginPath();
      c.arc(px+TILE/2-3,py+TILE/2-4,6,0,7); c.fill();
    }
    if(t===G_WALL){
      c.fillStyle='#4a3418'; c.fillRect(px+6,py+2,8,TILE-2); c.fillRect(px+18,py+2,8,TILE-2);
      c.fillStyle='#6e5226'; c.fillRect(px+6,py+2,8,5); c.fillRect(px+18,py+2,8,5);
    }
    if(t===G_TREE) trees.push([px+TILE/2,py+TILE/2,vr()]);
  }
  // tree canopies (after base pass so they overlap)
  for(const [tx,ty,s] of trees){
    c.fillStyle='rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(tx+3,ty+6,13,7,0,0,7); c.fill();
    c.fillStyle='#4a3217'; c.fillRect(tx-2,ty-2,5,10);
    const r=13+s*6;
    c.fillStyle=`rgb(${30+s*18},${74+s*22},${32+s*12})`;
    c.beginPath(); c.arc(tx,ty-4,r,0,7); c.fill();
    c.fillStyle='rgba(255,255,255,.07)';
    c.beginPath(); c.arc(tx-r*0.3,ty-4-r*0.3,r*0.55,0,7); c.fill();
  }
  // shrine
  c.fillStyle='#9a96a8'; c.beginPath(); c.arc(SHRINE.x,SHRINE.y,22,0,7); c.fill();
  c.fillStyle='#b8b4c4'; c.beginPath(); c.arc(SHRINE.x,SHRINE.y,15,0,7); c.fill();
  c.fillStyle='#6a667a'; c.fillRect(SHRINE.x-4,SHRINE.y-26,8,26);
  c.fillStyle='#dfe8ff'; c.beginPath(); c.arc(SHRINE.x,SHRINE.y-28,6,0,7); c.fill();
  // outpost tents + flag
  drawTent(c,10*TILE,80*TILE,'#7a4a2a'); drawTent(c,17*TILE,80.5*TILE,'#5a6a3a');
  c.fillStyle='#3a2a14'; c.fillRect(13.5*TILE-2,74.5*TILE-40,4,40);
  c.fillStyle='#b03030'; c.beginPath();
  c.moveTo(13.5*TILE+2,74.5*TILE-40); c.lineTo(13.5*TILE+26,74.5*TILE-33); c.lineTo(13.5*TILE+2,74.5*TILE-26); c.fill();
  // camp tents + fire pit
  drawTent(c,75*TILE,17*TILE,'#5a4434'); drawTent(c,81*TILE,17*TILE,'#5a4434'); drawTent(c,81*TILE,23*TILE,'#4a3a44');
  c.fillStyle='#332'; c.beginPath(); c.arc(78*TILE,20*TILE,9,0,7); c.fill();
  c.fillStyle='#e88030'; c.beginPath(); c.arc(78*TILE,20*TILE,5,0,7); c.fill();

  // minimap
  miniCv=document.createElement('canvas'); miniCv.width=MAPW; miniCv.height=MAPH;
  const m=miniCv.getContext('2d');
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    const t=T(x,y);
    m.fillStyle=t===G_WATER?'#1e4a68':t===G_PATH||t===G_BRIDGE?'#8a7350':t===G_TREE?'#1d3a18':
      t===G_DIRT?'#6e5a3e':t===G_WALL?'#4a3418':t===G_ROCK?'#555':'#33502a';
    m.fillRect(x,y,1,1);
  }
}
function drawTent(c,x,y,col){
  c.fillStyle='rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x,y+14,26,8,0,0,7); c.fill();
  c.fillStyle=col; c.beginPath();
  c.moveTo(x-24,y+14); c.lineTo(x,y-18); c.lineTo(x+24,y+14); c.fill();
  c.fillStyle='rgba(0,0,0,.35)'; c.beginPath();
  c.moveTo(x-8,y+14); c.lineTo(x,y-2); c.lineTo(x+8,y+14); c.fill();
}

/* ---------------- skills ---------------- */
const SKILLS=[
  {name:'Sever Artery', icon:'🩸', en:5,  rc:4,  cast:0,   type:'melee', desc:'Sword attack: +8 damage and inflicts Bleeding for 12s.'},
  {name:'Final Thrust', icon:'🗡️', en:10, rc:8,  cast:0,   type:'melee', desc:'Sword attack: +18 damage; doubled bonus if the foe is below 50% health.'},
  {name:'Cyclone Slash',icon:'🌀', en:8,  rc:10, cast:0,   type:'pbaoe', desc:'Whirl your blade, striking all adjacent foes.'},
  {name:'Hamstring',    icon:'🦶', en:7,  rc:12, cast:0,   type:'melee', desc:'Sword attack: +5 damage and Cripples the foe (slowed) for 8s.'},
  {name:'Healing Signet',icon:'✚', en:0,  rc:20, cast:2,   type:'self',  desc:'Signet (2s): heal yourself for 45% of max health. Moving cancels it.'},
  {name:'Sprint',       icon:'💨', en:5,  rc:15, cast:0,   type:'self',  desc:'Stance: move 40% faster for 6 seconds.'},
  {name:'Fire Bolt',    icon:'🔥', en:10, rc:5,  cast:0.8, type:'ranged',range:300, desc:'Spell (0.8s): hurl fire for 35 damage and Burning for 3s.'},
  {name:'Restore Ally', icon:'💫', en:0,  rc:90, cast:3,   type:'res',   desc:'Signet (3s): resurrect Lyra at 50% health. Stand near her body.'},
];

/* ---------------- entities ---------------- */
const enemies=[], drops=[], projectiles=[], effects=[], ftexts=[];
let player, hench, npcAldra;

function makePlayer(){
  const p=findOpen(13,77);
  return {
    kind:'player', name:'Kaelen', team:0, x:p.x, y:p.y, r:13, face:0,
    lvl:1, xp:0, gold:0, dp:0,
    baseHp:100, baseEn:30, hp:100, en:30,
    dmgMin:12, dmgMax:18, atkInt:1.2, range:MELEE_RANGE, speed:130,
    nextAtk:0, target:null, engaged:false, moveTo:null, approach:null,
    cond:{}, buffs:{}, dead:false, lastCombat:-99,
    skillReady:new Array(8).fill(0),
  };
}
const pMaxHp=()=>Math.round(player.baseHp*(1-player.dp));
const pMaxEn=()=>Math.round(player.baseEn*(1-player.dp));

function makeHench(){
  const p=findOpen(12,79);
  return {
    kind:'hench', name:'Lyra', team:0, x:p.x, y:p.y, r:12, face:0, lvl:2,
    maxHp:110, hp:110, dmgMin:9, dmgMax:14, atkInt:1.5, range:240, speed:145,
    nextAtk:0, nextHeal:0, target:null, cond:{}, dead:false, deadAt:0, lastCombat:-99,
  };
}

const ENEMY_TYPES={
  skale:  {name:'River Skale',   lvl:1, hp:55,  dmgMin:6, dmgMax:10, atkInt:1.6, range:MELEE_RANGE, speed:80,  r:12, color:'#3a8a7a', gold:[3,8]},
  wolf:   {name:'Grey Wolf',     lvl:2, hp:80,  dmgMin:8, dmgMax:13, atkInt:1.1, range:MELEE_RANGE, speed:155, r:12, color:'#7a7d85', gold:[4,10]},
  raider: {name:'Bandit Raider', lvl:3, hp:120, dmgMin:11,dmgMax:17, atkInt:1.3, range:MELEE_RANGE, speed:135, r:13, color:'#8a4a3a', gold:[8,18]},
  archer: {name:'Bandit Archer', lvl:3, hp:90,  dmgMin:10,dmgMax:15, atkInt:1.8, range:265, speed:120, r:12, color:'#9a6a3a', gold:[8,18]},
  chief:  {name:'Korr Blackmaw', lvl:5, hp:420, dmgMin:16,dmgMax:26, atkInt:1.4, range:MELEE_RANGE, speed:140, r:17, color:'#b03838', gold:[120,180], boss:true},
};

function spawnEnemy(type,tx,ty){
  const t=ENEMY_TYPES[type], p=findOpen(tx,ty);
  const e={
    kind:'enemy', type, ...t, team:1, x:p.x, y:p.y, sx:p.x, sy:p.y, face:0,
    maxHp:t.hp, nextAtk:0, target:null, state:'idle',
    wx:p.x, wy:p.y, wanderT:rand(1,4), cond:{}, dead:false, respawnAt:0,
    nextAoe:0, lastCombat:-99,
  };
  enemies.push(e); return e;
}

function spawnAll(){
  // river skales — west bank, south stretch
  for(const [x,y] of [[50,62],[48,68],[52,72],[46,57],[51,66]]) spawnEnemy('skale',x,y);
  // wolf packs
  for(const [x,y] of [[35,49],[37,52],[33,52]]) spawnEnemy('wolf',x,y);
  for(const [x,y] of [[63,35],[66,37],[64,33]]) spawnEnemy('wolf',x,y);
  for(const [x,y] of [[44,70],[46,73]]) spawnEnemy('wolf',x,y);
  // bandit patrol on the road
  spawnEnemy('raider',69,33); spawnEnemy('raider',71,35); spawnEnemy('archer',70,31);
  // camp garrison
  spawnEnemy('raider',74,22); spawnEnemy('raider',82,22); spawnEnemy('raider',78,24);
  spawnEnemy('archer',75,17); spawnEnemy('archer',81,17);
  spawnEnemy('chief',78,20);
  // NPC
  const np=findOpen(11,76);
  npcAldra={kind:'npc', name:'Captain Aldra', x:np.x, y:np.y, r:13, face:0.4, cond:{}};
}

/* ---------------- quest ---------------- */
const quest={stage:0, wolves:0};
const QUEST_NEED_WOLVES=4;
function questTrackerText(){
  switch(quest.stage){
    case 0: return '<span class="qtitle">Thornveil Reach</span><br>Speak with Captain Aldra at the outpost.';
    case 1: return `<span class="qtitle">Wolves at the Gates</span><br>Slay grey wolves: ${quest.wolves}/${QUEST_NEED_WOLVES}`;
    case 2: return '<span class="qtitle">Wolves at the Gates</span><br>Return to Captain Aldra.';
    case 3: return '<span class="qtitle">The Blackmaw Gang</span><br>Defeat Korr Blackmaw in the bandit camp (north-east, across the bridge).';
    case 4: return '<span class="qtitle">The Blackmaw Gang</span><br>Korr is slain! Return to Captain Aldra.';
    default: return '<span class="qtitle">Thornveil Reach</span><br>Zone complete. Explore at will, adventurer.';
  }
}
function aldraDialog(){
  switch(quest.stage){
    case 0: return {text:'Welcome to Thornveil Reach, recruit. The wilds grow bolder by the day — grey wolves prowl right up to our road. Thin their numbers: slay four of them, then report back.', btn:'Accept: Wolves at the Gates', act(){quest.stage=1; toast('Quest accepted: Wolves at the Gates');}};
    case 1: return {text:`The wolves still prowl. You've felled ${quest.wolves} of ${QUEST_NEED_WOLVES}. They roam the meadows along the road and beyond the river.`, btn:'I\'m on it', act(){}};
    case 2: return {text:'Four pelts — fine work. But wolves are the least of it. The Blackmaw gang has dug into the old camp north-east, across the bridge. Their chief, Korr Blackmaw, must fall. Take Lyra and end him.', btn:'Turn in (+250 XP, +100g) & accept', act(){giveXp(250); player.gold+=100; clearDp(); quest.stage=3; toast('Quest accepted: The Blackmaw Gang');}};
    case 3: return {text:'Korr Blackmaw still draws breath. His camp lies north-east along the road, past the bridge. Watch his cleaver — when he spins, step away.', btn:'For Eldervale!', act(){}};
    case 4: return {text:'Blackmaw is dead?! Ha! The Reach breathes easier tonight, and your name will be known in Eldervale. Take this — you\'ve more than earned it.', btn:'Turn in (+600 XP, +300g)', act(){giveXp(600); player.gold+=300; clearDp(); quest.stage=5; banner('THORNVEIL REACH','zone complete');}};
    default: return {text:'The Reach is quiet, thanks to you. Rest at the shrine, or wander where you will — the next gate to Eldervale opens soon.', btn:'Farewell', act(){}};
  }
}

/* ---------------- combat ---------------- */
let now=0;

function condActive(e,c){return ((e.cond&&e.cond[c])||0)>now;}
function addCond(e,c,dur){e.cond[c]=Math.max(e.cond[c]||0,now+dur);}
function speedOf(e){
  let s=e.speed;
  if(condActive(e,'cripple')) s*=0.5;
  if(e===player&&(player.buffs.sprint||0)>now) s*=1.4;
  return s;
}
function maxHpOf(e){return e===player?pMaxHp():e.maxHp;}

function rollDmg(a){return irand(a.dmgMin,a.dmgMax);}

function applyDamage(src,e,amt,color){
  if(e.dead) return;
  e.hp-=amt; e.lastCombat=now;
  if(src) src.lastCombat=now;
  ftext(e.x,e.y-e.r-8,'-'+amt,color||'#ff7050',14);
  effects.push({type:'hit',x:e.x,y:e.y,t:now,dur:0.18});
  if(e.kind==='enemy'&&src&&src.team===0){
    if(e.state==='idle'||!e.target) aggro(e,src);
  }
  if(e.kind==='hench'&&src) e.target=src;
  if(e===player&&src&&!player.target){ player.target=src; }
  if(e.hp<=0) die(e,src);
}

function aggro(e,target){
  if(e.state==='return') return;
  e.target=target; e.state='chase';
  for(const o of enemies){
    if(o!==e&&!o.dead&&o.state==='idle'&&dist(o.x,o.y,e.x,e.y)<SOCIAL_R){
      o.target=target; o.state='chase';
    }
  }
}

function meleeAttack(a,d,bonus,onHit){
  a.face=Math.atan2(d.y-a.y,d.x-a.x);
  a.nextAtk=now+a.atkInt;
  const dmg=rollDmg(a)+(bonus||0);
  effects.push({type:'swing',x:a.x,y:a.y,ang:a.face,t:now,dur:0.2,r:a.range===MELEE_RANGE?34:24});
  applyDamage(a,d,dmg, a.team===0?'#ffd870':'#ff7050');
  if(onHit&&!d.dead) onHit(d);
}

function fireProjectile(a,d,dmg,color,onHit){
  a.face=Math.atan2(d.y-a.y,d.x-a.x);
  projectiles.push({x:a.x,y:a.y,target:d,src:a,dmg,color,speed:380,onHit});
}

function die(e,src){
  e.dead=true; e.target=null; delete e.cond; e.cond={};
  if(e.kind==='enemy'){
    e.respawnAt=now+(e.boss?120:30);
    // quest credit
    if(e.type==='wolf'&&quest.stage===1){
      quest.wolves++;
      toast(`Grey Wolf slain (${quest.wolves}/${QUEST_NEED_WOLVES})`);
      if(quest.wolves>=QUEST_NEED_WOLVES) quest.stage=2;
    }
    if(e.type==='chief'&&quest.stage===3){ quest.stage=4; banner('KORR BLACKMAW','has been defeated'); }
    // xp + gold
    giveXp(18+e.lvl*10);
    if(Math.random()<0.65||e.boss){
      drops.push({x:e.x+rand(-10,10),y:e.y+rand(-10,10),gold:irand(e.gold[0],e.gold[1]),t:now});
    }
    if(player.target===e){player.target=null;player.engaged=false;}
  } else if(e===player){
    player.engaged=false; player.target=null; player.moveTo=null;
    player.dp=Math.min(0.6,player.dp+0.15);
    deathOverlay(true);
    setTimeout(()=>{
      const p=findOpen(Math.floor(SHRINE.x/TILE),Math.floor(SHRINE.y/TILE)+2);
      player.x=p.x; player.y=p.y; player.dead=false;
      player.hp=pMaxHp(); player.en=pMaxEn(); cancelCast();
      deathOverlay(false);
      effects.push({type:'res',x:player.x,y:player.y,t:now,dur:0.8});
      if(player.dp>0) toast(`Death penalty: -${Math.round(player.dp*100)}% max HP/energy (cleared at quest turn-in or level up)`);
    },4000);
  } else if(e===hench){
    hench.deadAt=now;
    toast('Lyra has fallen! Use Restore Ally (💫) near her body.');
  }
}

function giveXp(x){
  player.xp+=x; ftext(player.x,player.y-30,'+'+x+' XP','#d8c069',12);
  let need=xpNeed();
  while(player.xp>=need){
    player.xp-=need; player.lvl++;
    player.baseHp+=20; player.baseEn+=2; player.dmgMin+=2; player.dmgMax+=2;
    clearDp(); player.hp=pMaxHp(); player.en=pMaxEn();
    effects.push({type:'levelup',x:player.x,y:player.y,t:now,dur:1.2});
    ftext(player.x,player.y-44,'LEVEL UP!','#ffe680',20);
    banner('LEVEL '+player.lvl,'your power grows');
    need=xpNeed();
  }
}
const xpNeed=()=>100+(player.lvl-1)*80;
function clearDp(){ if(player.dp>0){player.dp=0; toast('Death penalty removed.');} }

/* ---------------- skill use / casting ---------------- */
let cast=null; // {idx, t0, dur}

function useSkill(i){
  if(player.dead||cast) return;
  const sk=SKILLS[i];
  if(now<player.skillReady[i]){ return; }
  if(player.en<sk.en){ toast('Not enough energy'); return; }
  const t=player.target;
  if(sk.type==='melee'){
    if(!t||t.dead){ toast('Select a target first (tap a foe)'); return; }
    if(dist(player.x,player.y,t.x,t.y)>MELEE_RANGE+t.r+6){ toast('Out of range — get closer'); return; }
  }
  if(sk.type==='ranged'){
    if(!t||t.dead){ toast('Select a target first (tap a foe)'); return; }
    if(dist(player.x,player.y,t.x,t.y)>sk.range){ toast('Out of range'); return; }
  }
  if(sk.type==='res'){
    if(!hench.dead){ toast('Lyra is alive and well'); return; }
    if(dist(player.x,player.y,hench.x,hench.y)>220){ toast('Move closer to Lyra\'s body'); return; }
  }
  player.en-=sk.en;
  if(sk.cast>0){
    cast={idx:i,t0:now,dur:sk.cast};
    return;
  }
  resolveSkill(i);
  player.skillReady[i]=now+sk.rc;
}

function cancelCast(){
  if(!cast) return;
  player.en=Math.min(pMaxEn(),player.en+SKILLS[cast.idx].en); // refund
  cast=null;
}

function resolveSkill(i){
  const sk=SKILLS[i], t=player.target;
  switch(i){
    case 0: meleeAttack(player,t,8,d=>{addCond(d,'bleed',12); ftext(d.x,d.y-d.r-22,'Bleeding!','#e05050',11);}); break;
    case 1:{
      const low=t.hp<maxHpOf(t)*0.5;
      meleeAttack(player,t,low?36:18);
      break;
    }
    case 2:{
      effects.push({type:'aoe',x:player.x,y:player.y,t:now,dur:0.35,r:78});
      for(const e of enemies){
        if(!e.dead&&dist(player.x,player.y,e.x,e.y)<78+e.r) applyDamage(player,e,rollDmg(player),'#ffd870');
      }
      player.nextAtk=now+player.atkInt;
      break;
    }
    case 3: meleeAttack(player,t,5,d=>{addCond(d,'cripple',8); ftext(d.x,d.y-d.r-22,'Crippled!','#e3a23c',11);}); break;
    case 4:{
      const heal=Math.round(pMaxHp()*0.45);
      player.hp=Math.min(pMaxHp(),player.hp+heal);
      ftext(player.x,player.y-30,'+'+heal,'#70e070',15);
      effects.push({type:'heal',x:player.x,y:player.y,t:now,dur:0.6});
      break;
    }
    case 5: player.buffs.sprint=now+6; effects.push({type:'heal',x:player.x,y:player.y,t:now,dur:0.3}); break;
    case 6:
      if(t&&!t.dead) fireProjectile(player,t,35,'#ff8830',d=>{addCond(d,'burn',3); ftext(d.x,d.y-d.r-22,'Burning!','#ff8830',11);});
      break;
    case 7:
      if(hench.dead){
        hench.dead=false; hench.hp=Math.round(hench.maxHp*0.5); hench.cond={};
        effects.push({type:'res',x:hench.x,y:hench.y,t:now,dur:0.8});
        ftext(hench.x,hench.y-30,'Restored!','#a0c8ff',14);
      }
      break;
  }
}

/* ---------------- AI ---------------- */
function moveToward(e,tx,ty,dt,mul){
  const d=dist(e.x,e.y,tx,ty);
  if(d<2) return;
  const s=speedOf(e)*(mul||1)*dt;
  e.face=Math.atan2(ty-e.y,tx-e.x);
  tryMove(e,(tx-e.x)/d*s,(ty-e.y)/d*s);
}

function tickConds(e,dt){
  if(condActive(e,'bleed')) e.hp-=3*dt;
  if(condActive(e,'burn')) e.hp-=6*dt;
  if(e.hp<=0&&!e.dead) die(e,null);
}

function updateEnemy(e,dt){
  if(e.dead){
    if(now>=e.respawnAt&&dist(player.x,player.y,e.sx,e.sy)>360){
      e.dead=false; e.hp=e.maxHp; e.x=e.sx; e.y=e.sy; e.state='idle'; e.cond={};
    }
    return;
  }
  tickConds(e,dt); if(e.dead) return;
  if(condActive(e,'stun')) return;

  const leashDist=dist(e.x,e.y,e.sx,e.sy);

  if(e.state==='return'){
    e.hp=Math.min(e.maxHp,e.hp+e.maxHp*0.25*dt);
    moveToward(e,e.sx,e.sy,dt);
    if(dist(e.x,e.y,e.sx,e.sy)<12){e.state='idle';e.hp=e.maxHp;}
    return;
  }

  if(e.state==='idle'){
    // wander
    e.wanderT-=dt;
    if(e.wanderT<=0){
      e.wanderT=rand(2,5);
      e.wx=e.sx+rand(-70,70); e.wy=e.sy+rand(-70,70);
    }
    if(dist(e.x,e.y,e.wx,e.wy)>6) moveToward(e,e.wx,e.wy,dt,0.35);
    // out-of-combat regen
    e.hp=Math.min(e.maxHp,e.hp+e.maxHp*0.05*dt);
    // aggro check
    for(const f of [player,hench]){
      if(!f.dead&&!inSafeZone(f)&&dist(e.x,e.y,f.x,f.y)<AGGRO_R){ aggro(e,f); break; }
    }
    return;
  }

  // chase / fight
  const t=e.target;
  if(!t||t.dead||inSafeZone(t)||leashDist>LEASH_R){
    e.target=null; e.state='return'; return;
  }
  const d=dist(e.x,e.y,t.x,t.y);
  const reach=e.range+t.r;
  if(d>reach) moveToward(e,t.x,t.y,dt);
  else if(now>=e.nextAtk){
    if(e.range>MELEE_RANGE){ // archer
      e.nextAtk=now+e.atkInt;
      e.face=Math.atan2(t.y-e.y,t.x-e.x);
      fireProjectile(e,t,rollDmg(e),'#d8c069');
    } else {
      meleeAttack(e,t,0);
    }
  }
  // boss whirl
  if(e.boss&&now>=e.nextAoe&&d<110){
    e.nextAoe=now+8;
    effects.push({type:'aoe',x:e.x,y:e.y,t:now,dur:0.4,r:95,color:'#ff5030'});
    for(const f of [player,hench]){
      if(!f.dead&&dist(e.x,e.y,f.x,f.y)<95+f.r) applyDamage(e,f,30,'#ff5030');
    }
  }
}

function updateHench(dt){
  if(hench.dead){
    // auto-revive if player returns to the outpost
    if(inSafeZone(player)&&now-hench.deadAt>3){
      hench.dead=false; hench.hp=hench.maxHp;
      const p=findOpen(Math.floor(player.x/TILE),Math.floor(player.y/TILE)+1);
      hench.x=p.x; hench.y=p.y;
      effects.push({type:'res',x:hench.x,y:hench.y,t:now,dur:0.8});
    }
    return;
  }
  tickConds(hench,dt); if(hench.dead) return;

  // heal (priority)
  if(now>=hench.nextHeal){
    let low=null,lowPct=0.7;
    for(const a of [player,hench]){
      if(a.dead) continue;
      const pct=a.hp/maxHpOf(a);
      if(pct<lowPct&&dist(hench.x,hench.y,a.x,a.y)<260){low=a;lowPct=pct;}
    }
    if(low){
      hench.nextHeal=now+7;
      const heal=50;
      low.hp=Math.min(maxHpOf(low),low.hp+heal);
      ftext(low.x,low.y-30,'+'+heal,'#70e070',14);
      effects.push({type:'heal',x:low.x,y:low.y,t:now,dur:0.6});
      effects.push({type:'beam',x:hench.x,y:hench.y,x2:low.x,y2:low.y,t:now,dur:0.35});
    }
  }

  // pick target: assist player, else fight back
  let t=null;
  if(player.engaged&&player.target&&!player.target.dead) t=player.target;
  else if(hench.target&&!hench.target.dead&&hench.target.kind==='enemy') t=hench.target;
  hench.target=t;

  if(t){
    const d=dist(hench.x,hench.y,t.x,t.y);
    if(d>hench.range) moveToward(hench,t.x,t.y,dt);
    else if(now>=hench.nextAtk){
      hench.nextAtk=now+hench.atkInt;
      fireProjectile(hench,t,rollDmg(hench),'#a0c8ff');
    }
    return;
  }
  // follow
  const dp=dist(hench.x,hench.y,player.x,player.y);
  if(dp>90) moveToward(hench,player.x+rand(-20,20),player.y+rand(-20,20),dt);
  // out-of-combat regen
  if(now-hench.lastCombat>6) hench.hp=Math.min(hench.maxHp,hench.hp+8*dt);
}

/* ---------------- player update ---------------- */
const input={jx:0,jy:0,active:false,keys:{}};

function updatePlayer(dt){
  if(player.dead) return;
  tickConds(player,dt); if(player.dead) return;

  // energy regen (GW1: 4 pips ≈ 1.33/s)
  player.en=Math.min(pMaxEn(),player.en+1.33*dt);
  // out-of-combat hp regen; fast in outpost
  if(inSafeZone(player)) player.hp=Math.min(pMaxHp(),player.hp+15*dt);
  else if(now-player.lastCombat>6) player.hp=Math.min(pMaxHp(),player.hp+8*dt);

  // keyboard
  let kx=0,ky=0;
  if(input.keys['w']||input.keys['arrowup'])ky-=1;
  if(input.keys['s']||input.keys['arrowdown'])ky+=1;
  if(input.keys['a']||input.keys['arrowleft'])kx-=1;
  if(input.keys['d']||input.keys['arrowright'])kx+=1;

  let mx=input.active?input.jx:kx, my=input.active?input.jy:ky;
  const manual=Math.hypot(mx,my)>0.12;

  if(manual){
    if(cast) cancelCast();
    player.moveTo=null; player.approach=null;
    const m=Math.hypot(mx,my), s=speedOf(player)*dt*Math.min(1,m);
    player.face=Math.atan2(my,mx);
    tryMove(player,mx/m*s,my/m*s);
  } else if(player.moveTo){
    const d=dist(player.x,player.y,player.moveTo.x,player.moveTo.y);
    if(d<8) player.moveTo=null;
    else moveToward(player,player.moveTo.x,player.moveTo.y,dt);
  } else if(player.approach){
    const n=player.approach;
    if(dist(player.x,player.y,n.x,n.y)<80){ player.approach=null; openDialog(); }
    else moveToward(player,n.x,n.y,dt);
  }

  // casting
  if(cast){
    if(now-cast.t0>=cast.dur){
      const i=cast.idx; cast=null;
      resolveSkill(i);
      player.skillReady[i]=now+SKILLS[i].rc;
    }
  }

  // auto-attack / chase target
  const t=player.target;
  if(t&&t.dead){player.target=null;player.engaged=false;}
  else if(t&&player.engaged&&!cast){
    const d=dist(player.x,player.y,t.x,t.y);
    const reach=player.range+t.r;
    if(d>reach){
      if(!manual) moveToward(player,t.x,t.y,dt);
    } else if(now>=player.nextAtk){
      meleeAttack(player,t,0);
    }
  }

  // pick up gold
  for(let i=drops.length-1;i>=0;i--){
    const g=drops[i];
    if(dist(player.x,player.y,g.x,g.y)<26){
      player.gold+=g.gold;
      ftext(player.x,player.y-30,'+'+g.gold+'g','#f0d97a',13);
      drops.splice(i,1);
    } else if(now-g.t>60) drops.splice(i,1);
  }
}

/* ---------------- projectiles & effects ---------------- */
function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i], t=p.target;
    if(!t||t.dead){projectiles.splice(i,1);continue;}
    const d=dist(p.x,p.y,t.x,t.y);
    if(d<t.r+6){
      applyDamage(p.src,t,p.dmg,p.color);
      if(p.onHit&&!t.dead) p.onHit(t);
      projectiles.splice(i,1); continue;
    }
    p.x+=(t.x-p.x)/d*p.speed*dt;
    p.y+=(t.y-p.y)/d*p.speed*dt;
  }
}
function ftext(x,y,txt,color,size){ftexts.push({x,y,txt,color,size,t:now,dur:1.1});}

/* ---------------- input ---------------- */
const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
let VW=0,VH=0,DPR=1;
const cam={x:0,y:0};

function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  VW=window.innerWidth; VH=window.innerHeight;
  canvas.width=VW*DPR; canvas.height=VH*DPR;
  canvas.style.width=VW+'px'; canvas.style.height=VH+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize',resize);

let joyId=null, joyOX=0, joyOY=0, joyCX=0, joyCY=0;
let tapId=null, tapX=0, tapY=0, tapT=0;

canvas.addEventListener('pointerdown',ev=>{
  const x=ev.clientX,y=ev.clientY;
  // touch in the lower-left zone drives the joystick; mouse always taps (WASD to move)
  if(joyId===null&&ev.pointerType!=='mouse'&&x<VW*0.45&&y>VH*0.32){
    joyId=ev.pointerId; joyOX=joyCX=x; joyOY=joyCY=y;
    input.active=true; input.jx=0; input.jy=0;
  } else if(tapId===null){
    tapId=ev.pointerId; tapX=x; tapY=y; tapT=performance.now();
  }
});
window.addEventListener('pointermove',ev=>{
  if(ev.pointerId===joyId){
    joyCX=ev.clientX; joyCY=ev.clientY;
    let dx=joyCX-joyOX, dy=joyCY-joyOY;
    const m=Math.hypot(dx,dy), max=52;
    if(m>max){dx=dx/m*max;dy=dy/m*max;joyOX=joyCX-dx;joyOY=joyCY-dy;}
    input.jx=dx/max; input.jy=dy/max;
  }
});
window.addEventListener('pointerup',ev=>{
  if(ev.pointerId===joyId){joyId=null;input.active=false;input.jx=0;input.jy=0;}
  if(ev.pointerId===tapId){
    tapId=null;
    const moved=dist(ev.clientX,ev.clientY,tapX,tapY);
    if(moved<14&&performance.now()-tapT<400) handleTap(tapX,tapY);
  }
});
window.addEventListener('pointercancel',ev=>{
  if(ev.pointerId===joyId){joyId=null;input.active=false;input.jx=0;input.jy=0;}
  if(ev.pointerId===tapId)tapId=null;
});

window.addEventListener('keydown',ev=>{
  const k=ev.key.toLowerCase();
  input.keys[k]=true;
  if(k>='1'&&k<='8') useSkill(+k-1);
  if(k==='escape'){player.target=null;player.engaged=false;}
});
window.addEventListener('keyup',ev=>{input.keys[ev.key.toLowerCase()]=false;});

function handleTap(sx,sy){
  if(player.dead) return;
  closePanels();
  const wx=sx+cam.x, wy=sy+cam.y;
  // enemy?
  let best=null,bd=34;
  for(const e of enemies){
    if(e.dead) continue;
    const d=dist(wx,wy,e.x,e.y);
    if(d<bd+e.r){best=e;bd=d;}
  }
  if(best){
    player.target=best; player.engaged=true; player.moveTo=null; player.approach=null;
    return;
  }
  // npc?
  if(dist(wx,wy,npcAldra.x,npcAldra.y)<40){
    if(dist(player.x,player.y,npcAldra.x,npcAldra.y)<90) openDialog();
    else { player.approach=npcAldra; player.target=null; player.engaged=false; }
    return;
  }
  // ground: move there (GW1 click-to-move)
  if(!blockedCircle(wx,wy,player.r)){
    player.moveTo={x:wx,y:wy}; player.target=null; player.engaged=false; player.approach=null;
    if(cast) cancelCast();
    effects.push({type:'movetick',x:wx,y:wy,t:now,dur:0.5});
  }
}

/* ---------------- UI ---------------- */
const $=id=>document.getElementById(id);
const ui={
  pHp:$('pHp'),pEn:$('pEn'),pXp:$('pXp'),pLvl:$('pLvl'),pHpTxt:$('pHpTxt'),pEnTxt:$('pEnTxt'),
  hHp:$('hHp'),henchFrame:$('henchFrame'),
  targetFrame:$('targetFrame'),tName:$('tName'),tLvl:$('tLvl'),tHp:$('tHp'),tConds:$('tConds'),
  quest:$('questTracker'),gold:$('goldTxt'),
  castbar:$('castbar'),castFill:$('castFill'),castName:$('castName'),
  dialog:$('dialog'),dlgName:$('dlgName'),dlgText:$('dlgText'),dlgBtn:$('dlgBtn'),
  banner:$('banner'),toast:$('toast'),death:$('deathOverlay'),deathSub:$('deathSub'),
  skillInfo:$('skillInfo'),
  compass:$('compass'),
};
const skillBtns=[];

function buildSkillbar(){
  const bar=$('skillbar');
  SKILLS.forEach((sk,i)=>{
    const b=document.createElement('button');
    b.className='skill';
    b.innerHTML=`<span>${sk.icon}</span><span class="cost">${sk.en>0?sk.en:''}</span><span class="key">${i+1}</span><div class="cd"></div><div class="cdt"></div>`;
    b.addEventListener('pointerdown',ev=>{ev.stopPropagation();ev.preventDefault();useSkill(i);});
    bar.appendChild(b);
    skillBtns.push(b);
  });
  $('skillInfoBtn').addEventListener('pointerdown',ev=>{
    ev.stopPropagation();
    ui.skillInfo.classList.toggle('hidden');
    if(!ui.skillInfo.classList.contains('hidden')){
      ui.skillInfo.innerHTML='<b style="color:#f0d97a">Skill Bar</b><br><br>'+SKILLS.map((s,i)=>
        `<div class="sk"><b>${i+1}. ${s.icon} ${s.name}</b> <i>${s.en>0?s.en+'⚡':''} ${s.cast>0?s.cast+'s cast':''} ${s.rc}s recharge</i><br>${s.desc}</div>`).join('')
        +'<div style="margin-top:6px;color:#9a8f6f">Drag left side: move · Tap foe: attack · Tap ground: walk there</div>';
    }
  });
  ui.dlgBtn.addEventListener('pointerdown',ev=>{
    ev.stopPropagation();
    const d=aldraDialog(); d.act();
    ui.dialog.classList.add('hidden');
  });
}
function closePanels(){ui.dialog.classList.add('hidden');ui.skillInfo.classList.add('hidden');}
function openDialog(){
  const d=aldraDialog();
  ui.dlgName.textContent='Captain Aldra';
  ui.dlgText.textContent=d.text;
  ui.dlgBtn.textContent=d.btn;
  ui.dialog.classList.remove('hidden');
}

let toastTimer=null;
function toast(msg){
  ui.toast.textContent=msg; ui.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>ui.toast.classList.add('hidden'),2600);
}
function banner(title,sub){
  ui.banner.innerHTML=title+(sub?`<div class="sub">${sub}</div>`:'');
  ui.banner.classList.remove('hidden');
  ui.banner.style.animation='none'; void ui.banner.offsetWidth;
  ui.banner.style.animation='';
  setTimeout(()=>ui.banner.classList.add('hidden'),4000);
}
function deathOverlay(show){
  ui.death.classList.toggle('hidden',!show);
  if(show) ui.deathSub.textContent='Returning to the shrine…';
}

let lastQuestHtml='';
function syncUI(){
  ui.pHp.style.width=clamp(player.hp/pMaxHp()*100,0,100)+'%';
  ui.pEn.style.width=clamp(player.en/pMaxEn()*100,0,100)+'%';
  ui.pXp.style.width=clamp(player.xp/xpNeed()*100,0,100)+'%';
  ui.pHpTxt.textContent=Math.ceil(Math.max(0,player.hp))+' / '+pMaxHp();
  ui.pEnTxt.textContent=Math.floor(player.en)+' / '+pMaxEn();
  ui.pLvl.textContent='Lv '+player.lvl+(player.dp>0?` (−${Math.round(player.dp*100)}%)`:'');
  ui.gold.textContent=player.gold;

  ui.henchFrame.style.opacity=hench.dead?0.45:1;
  ui.hHp.style.width=(hench.dead?0:clamp(hench.hp/hench.maxHp*100,0,100))+'%';

  const t=player.target;
  if(t&&!t.dead){
    ui.targetFrame.classList.remove('hidden');
    ui.tName.textContent=t.name;
    ui.tLvl.textContent='Lv '+t.lvl;
    ui.tHp.style.width=clamp(t.hp/t.maxHp*100,0,100)+'%';
    const conds=[];
    if(condActive(t,'bleed'))conds.push('Bleeding');
    if(condActive(t,'burn'))conds.push('Burning');
    if(condActive(t,'cripple'))conds.push('Crippled');
    ui.tConds.textContent=conds.join(' · ');
  } else ui.targetFrame.classList.add('hidden');

  const qh=questTrackerText();
  if(qh!==lastQuestHtml){ui.quest.innerHTML=qh;lastQuestHtml=qh;}

  // cast bar
  if(cast){
    ui.castbar.classList.remove('hidden');
    ui.castFill.style.width=Math.min(100,(now-cast.t0)/cast.dur*100)+'%';
    ui.castName.textContent=SKILLS[cast.idx].name;
  } else ui.castbar.classList.add('hidden');

  // skill buttons
  SKILLS.forEach((sk,i)=>{
    const b=skillBtns[i];
    const left=player.skillReady[i]-now;
    const cd=b.children[3], cdt=b.children[4];
    if(left>0){
      cd.style.height=Math.min(100,left/sk.rc*100)+'%';
      cdt.textContent=left>0.3?Math.ceil(left):'';
    } else { cd.style.height='0%'; cdt.textContent=''; }
    b.classList.toggle('noEnergy',player.en<sk.en);
    b.classList.toggle('casting',!!cast&&cast.idx===i);
  });
}

/* ---------------- compass ---------------- */
function drawCompass(){
  const cv=ui.compass, c=cv.getContext('2d');
  const S=cv.width, R=S/2;
  c.clearRect(0,0,S,S);
  c.save();
  c.beginPath(); c.arc(R,R,R-3,0,7); c.clip();
  // terrain: show ~1000 world px around the player
  const range=1000;
  const px=player.x/TILE, py=player.y/TILE;
  const span=range*2/TILE;
  c.imageSmoothingEnabled=false;
  c.drawImage(miniCv, px-span/2, py-span/2, span, span, 0,0,S,S);
  c.fillStyle='rgba(8,10,6,.25)'; c.fillRect(0,0,S,S);
  const W2S=S/(range*2); // world px → compass px
  const dot=(x,y,col,r)=>{
    const cx=R+(x-player.x)*W2S, cy=R+(y-player.y)*W2S;
    if(cx<0||cy<0||cx>S||cy>S)return;
    c.fillStyle=col; c.beginPath(); c.arc(cx,cy,r||5,0,7); c.fill();
  };
  for(const e of enemies) if(!e.dead) dot(e.x,e.y,e.boss?'#ff3030':'#e05040',e.boss?8:5);
  dot(npcAldra.x,npcAldra.y,'#f0d97a',6);
  dot(SHRINE.x,SHRINE.y,'#b8c8ff',5);
  if(!hench.dead) dot(hench.x,hench.y,'#50c878',5);
  // aggro bubble (the GW1 danger circle)
  c.strokeStyle='rgba(255,255,255,.5)'; c.lineWidth=2;
  c.beginPath(); c.arc(R,R,AGGRO_R*W2S,0,7); c.stroke();
  // player arrow
  c.save(); c.translate(R,R); c.rotate(player.face+Math.PI/2);
  c.fillStyle='#fff'; c.beginPath();
  c.moveTo(0,-9); c.lineTo(6,7); c.lineTo(-6,7); c.fill();
  c.restore();
  c.restore();
  // N marker
  c.fillStyle='#c9b26a'; c.font='bold 18px Georgia'; c.textAlign='center';
  c.fillText('N',R,22);
}

/* ---------------- render ---------------- */
function drawEntity(e){
  const x=e.x,y=e.y;
  // shadow
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(x,y+e.r*0.7,e.r*0.95,e.r*0.45,0,0,7); ctx.fill();

  if(e.dead){
    ctx.save(); ctx.globalAlpha=0.55; ctx.translate(x,y); ctx.rotate(Math.PI/2);
    body(e,0,0,true); ctx.restore();
    return;
  }
  // boss aura
  if(e.boss){
    const p=0.5+Math.sin(now*4)*0.15;
    const g=ctx.createRadialGradient(x,y,4,x,y,34);
    g.addColorStop(0,`rgba(255,60,30,${0.35*p})`); g.addColorStop(1,'rgba(255,60,30,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,34,0,7); ctx.fill();
  }
  // target ring
  if(player.target===e){
    ctx.strokeStyle='#ffd870'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(x,y+e.r*0.6,e.r+6,0,7); ctx.stroke();
  }
  body(e,x,y,false);

  // conditions
  let ci=0;
  const cicon=(col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(x-8+ci*8,y-e.r-16,3,0,7);ctx.fill();ci++;};
  if(condActive(e,'bleed'))cicon('#e02020');
  if(condActive(e,'burn'))cicon('#ff8830');
  if(condActive(e,'cripple'))cicon('#e3a23c');

  // hp bar (foes & damaged allies)
  if(e.kind==='enemy'||e.hp<maxHpOf(e)-0.5){
    const w=30,pct=clamp(e.hp/maxHpOf(e),0,1);
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(x-w/2,y-e.r-11,w,4);
    ctx.fillStyle=e.team===0?'#50c878':'#e04030';
    ctx.fillRect(x-w/2,y-e.r-11,w*pct,4);
  }
  // sprint trail
  if(e===player&&(player.buffs.sprint||0)>now){
    ctx.strokeStyle='rgba(200,230,255,.4)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(x,y,e.r+4,now*8,now*8+2); ctx.stroke();
  }
}

function body(e,x,y,corpse){
  const r=e.r;
  let col = e.kind==='player' ? '#4a7ab5' : e.kind==='hench' ? '#4a9a5a' :
            e.kind==='npc' ? '#b59a4a' : e.color;
  if(corpse) col='#555';
  // body
  ctx.fillStyle=col;
  ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.45)'; ctx.lineWidth=1.5; ctx.stroke();
  // head
  ctx.fillStyle=e.kind==='enemy'&&e.type!=='raider'&&e.type!=='archer'&&e.type!=='chief' ? col : '#d8b08a';
  ctx.beginPath(); ctx.arc(x,y-r*0.45,r*0.5,0,7); ctx.fill();
  if(corpse) return;
  // weapon
  const a=e.face||0;
  ctx.strokeStyle='#c8c8d0'; ctx.lineWidth=3;
  const lunge=(e.nextAtk&&e.nextAtk-now>e.atkInt-0.15)?6:0;
  if(e.kind==='enemy'&&e.range>MELEE_RANGE){ // bow
    ctx.beginPath(); ctx.arc(x+Math.cos(a)*r,y+Math.sin(a)*r,8,a-1.2,a+1.2); ctx.stroke();
  } else if(e.kind==='hench'){
    ctx.strokeStyle='#8a6df0';
    ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*r*0.5,y+Math.sin(a)*r*0.5);
    ctx.lineTo(x+Math.cos(a)*(r+14),y+Math.sin(a)*(r+14)); ctx.stroke();
    ctx.fillStyle='#b8a0ff'; ctx.beginPath();
    ctx.arc(x+Math.cos(a)*(r+14),y+Math.sin(a)*(r+14),3,0,7); ctx.fill();
  } else if(e.kind!=='npc'&&e.type!=='skale'&&e.type!=='wolf'){
    ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*r*0.6,y+Math.sin(a)*r*0.6);
    ctx.lineTo(x+Math.cos(a)*(r+12+lunge),y+Math.sin(a)*(r+12+lunge)); ctx.stroke();
  } else if(e.type==='wolf'||e.type==='skale'){ // snout
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(x+Math.cos(a)*r*0.9,y+Math.sin(a)*r*0.9,r*0.4,0,7); ctx.fill();
  }
}

function render(){
  // camera
  cam.x=clamp(player.x-VW/2,0,MAPW*TILE-VW);
  cam.y=clamp(player.y-VH/2,0,MAPH*TILE-VH);
  if(MAPW*TILE<VW)cam.x=(MAPW*TILE-VW)/2;
  if(MAPH*TILE<VH)cam.y=(MAPH*TILE-VH)/2;

  ctx.fillStyle='#0b0e0a'; ctx.fillRect(0,0,VW,VH);
  ctx.save(); ctx.translate(-cam.x,-cam.y);
  ctx.drawImage(terraCv,cam.x,cam.y,VW,VH,cam.x,cam.y,VW,VH);

  // shrine glow
  const sg=0.25+Math.sin(now*2)*0.1;
  const g=ctx.createRadialGradient(SHRINE.x,SHRINE.y-28,2,SHRINE.x,SHRINE.y-28,40);
  g.addColorStop(0,`rgba(190,210,255,${sg})`); g.addColorStop(1,'rgba(190,210,255,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(SHRINE.x,SHRINE.y-28,40,0,7); ctx.fill();

  // drops
  for(const d of drops){
    ctx.fillStyle='#f0d97a'; ctx.beginPath(); ctx.arc(d.x,d.y,5,0,7); ctx.fill();
    ctx.strokeStyle='#8a6d1f'; ctx.lineWidth=1; ctx.stroke();
  }

  // move-to marker
  if(player.moveTo){
    ctx.strokeStyle='rgba(240,217,122,.7)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(player.moveTo.x,player.moveTo.y,7+Math.sin(now*6)*2,0,7); ctx.stroke();
  }

  // entities sorted by y
  const all=[npcAldra,...enemies.filter(e=>!e.dead||now<e.respawnAt-20),hench,player].filter(e=>!e.hide);
  all.sort((a,b)=>a.y-b.y);
  for(const e of all){
    if(e.x<cam.x-60||e.x>cam.x+VW+60||e.y<cam.y-60||e.y>cam.y+VH+60) continue;
    drawEntity(e);
    if(e===npcAldra){
      // quest marker
      const m=(quest.stage===0||quest.stage===2||quest.stage===4)?'!':(quest.stage===1||quest.stage===3)?'?':'';
      if(m){
        ctx.fillStyle='#f0d97a'; ctx.font='bold 20px Georgia'; ctx.textAlign='center';
        ctx.fillText(m,e.x,e.y-e.r-16-Math.abs(Math.sin(now*3))*4);
      }
      ctx.fillStyle='#e8dfc8'; ctx.font='11px Georgia';
      ctx.fillText('Captain Aldra',e.x,e.y+e.r+16);
    }
  }

  // projectiles
  for(const p of projectiles){
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,4,0,7); ctx.fill();
    ctx.strokeStyle=p.color; ctx.globalAlpha=0.4; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(p.x,p.y);
    const t=p.target; const d=dist(p.x,p.y,t.x,t.y)||1;
    ctx.lineTo(p.x-(t.x-p.x)/d*12,p.y-(t.y-p.y)/d*12); ctx.stroke();
    ctx.globalAlpha=1;
  }

  // effects
  for(let i=effects.length-1;i>=0;i--){
    const f=effects[i], k=(now-f.t)/f.dur;
    if(k>=1){effects.splice(i,1);continue;}
    ctx.save();
    if(f.type==='swing'){
      ctx.strokeStyle=`rgba(255,255,255,${0.7*(1-k)})`; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(f.x,f.y,f.r,f.ang-0.7+k*1.2,f.ang+0.1+k*1.2); ctx.stroke();
    } else if(f.type==='aoe'){
      ctx.strokeStyle=f.color||'#ffd870'; ctx.globalAlpha=0.8*(1-k); ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(f.x,f.y,f.r*k,0,7); ctx.stroke();
    } else if(f.type==='hit'){
      ctx.fillStyle=`rgba(255,255,255,${0.5*(1-k)})`;
      ctx.beginPath(); ctx.arc(f.x,f.y,10+k*8,0,7); ctx.fill();
    } else if(f.type==='heal'){
      ctx.strokeStyle=`rgba(110,230,110,${0.8*(1-k)})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(f.x,f.y-k*22,9,0,7); ctx.stroke();
    } else if(f.type==='beam'){
      ctx.strokeStyle=`rgba(140,230,160,${0.7*(1-k)})`; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(f.x2,f.y2); ctx.stroke();
    } else if(f.type==='res'||f.type==='levelup'){
      ctx.strokeStyle=f.type==='res'?`rgba(170,200,255,${1-k})`:`rgba(255,230,128,${1-k})`;
      ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(f.x,f.y,10+k*48,0,7); ctx.stroke();
    } else if(f.type==='movetick'){
      ctx.strokeStyle=`rgba(240,217,122,${0.8*(1-k)})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(f.x,f.y,14*(1-k),0,7); ctx.stroke();
    }
    ctx.restore();
  }

  // floating text
  ctx.textAlign='center';
  for(let i=ftexts.length-1;i>=0;i--){
    const f=ftexts[i], k=(now-f.t)/f.dur;
    if(k>=1){ftexts.splice(i,1);continue;}
    ctx.globalAlpha=1-k*k;
    ctx.font=`bold ${f.size}px Arial`;
    ctx.fillStyle='#000'; ctx.fillText(f.txt,f.x+1,f.y-k*34+1);
    ctx.fillStyle=f.color; ctx.fillText(f.txt,f.x,f.y-k*34);
    ctx.globalAlpha=1;
  }
  ctx.restore();

  // joystick overlay
  if(input.active){
    ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(joyOX,joyOY,52,0,7); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.3)';
    ctx.beginPath(); ctx.arc(joyOX+input.jx*52,joyOY+input.jy*52,22,0,7); ctx.fill();
  }
}

/* ---------------- main loop ---------------- */
let lastT=performance.now();
function loop(tms){
  requestAnimationFrame(loop);
  let dt=(tms-lastT)/1000; lastT=tms;
  dt=Math.min(dt,0.05);
  now+=dt;

  updatePlayer(dt);
  updateHench(dt);
  for(const e of enemies) updateEnemy(e,dt);
  updateProjectiles(dt);

  render();
  drawCompass();
  syncUI();
}

/* ---------------- boot ---------------- */
buildMap();
renderTerrain();
player=makePlayer();
hench=makeHench();
spawnAll();
buildSkillbar();
resize();
banner('ELDERVALE','thornveil reach');
setTimeout(()=>toast('Drag the left side of the screen to move'),1200);
setTimeout(()=>toast('Tap a foe to attack · skills 1–8 below'),4600);
setTimeout(()=>toast('Speak with Captain Aldra (gold dot on the compass)'),8200);
requestAnimationFrame(loop);
