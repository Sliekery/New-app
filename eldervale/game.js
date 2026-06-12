/* =========================================================================
   ELDERVALE — Thornveil Reach
   A GW1-style MMO-lite prototype. Low-poly 3D (Three.js), no build step.
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

/* ---------------- minimap prerender ---------------- */
let miniCv;
function buildMinimap(){
  miniCv=document.createElement('canvas'); miniCv.width=MAPW; miniCv.height=MAPH;
  const m=miniCv.getContext('2d');
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    const t=T(x,y);
    m.fillStyle=t===G_WATER?'#1e4a68':t===G_PATH||t===G_BRIDGE?'#8a7350':t===G_TREE?'#1d3a18':
      t===G_DIRT?'#6e5a3e':t===G_WALL?'#4a3418':t===G_ROCK?'#555':'#33502a';
    m.fillRect(x,y,1,1);
  }
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
  npcAldra={kind:'npc', name:'Captain Aldra', x:np.x, y:np.y, r:13, face:0.4};
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

function condActive(e,c){return (e.cond[c]||0)>now;}
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
  ftext(e.x,e.y,'-'+amt,color||'#ff7050',14);
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
  applyDamage(a,d,dmg, a.team===0?'#ffd870':'#ff7050');
  if(onHit&&!d.dead) onHit(d);
}

function fireProjectile(a,d,dmg,color,onHit){
  a.face=Math.atan2(d.y-a.y,d.x-a.x);
  a.nextAtk=Math.max(a.nextAtk,now); // keep lunge anim sane
  projectiles.push({x:a.x,y:a.y,target:d,src:a,dmg,color,speed:380,onHit});
}

function die(e,src){
  e.dead=true; e.target=null; e.cond={};
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
  player.xp+=x; ftext(player.x,player.y,'+'+x+' XP','#d8c069',12);
  let need=xpNeed();
  while(player.xp>=need){
    player.xp-=need; player.lvl++;
    player.baseHp+=20; player.baseEn+=2; player.dmgMin+=2; player.dmgMax+=2;
    clearDp(); player.hp=pMaxHp(); player.en=pMaxEn();
    effects.push({type:'levelup',x:player.x,y:player.y,t:now,dur:1.2});
    ftext(player.x,player.y,'LEVEL UP!','#ffe680',20);
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
  const t=player.target;
  switch(i){
    case 0: meleeAttack(player,t,8,d=>{addCond(d,'bleed',12); ftext(d.x,d.y,'Bleeding!','#e05050',11);}); break;
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
    case 3: meleeAttack(player,t,5,d=>{addCond(d,'cripple',8); ftext(d.x,d.y,'Crippled!','#e3a23c',11);}); break;
    case 4:{
      const heal=Math.round(pMaxHp()*0.45);
      player.hp=Math.min(pMaxHp(),player.hp+heal);
      ftext(player.x,player.y,'+'+heal,'#70e070',15);
      effects.push({type:'heal',x:player.x,y:player.y,t:now,dur:0.6});
      break;
    }
    case 5: player.buffs.sprint=now+6; effects.push({type:'heal',x:player.x,y:player.y,t:now,dur:0.3}); break;
    case 6:
      if(t&&!t.dead) fireProjectile(player,t,35,'#ff8830',d=>{addCond(d,'burn',3); ftext(d.x,d.y,'Burning!','#ff8830',11);});
      break;
    case 7:
      if(hench.dead){
        hench.dead=false; hench.hp=Math.round(hench.maxHp*0.5); hench.cond={};
        effects.push({type:'res',x:hench.x,y:hench.y,t:now,dur:0.8});
        ftext(hench.x,hench.y,'Restored!','#a0c8ff',14);
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
      ftext(low.x,low.y,'+'+heal,'#70e070',14);
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
      ftext(player.x,player.y,'+'+g.gold+'g','#f0d97a',13);
      drops.splice(i,1);
    } else if(now-g.t>60) drops.splice(i,1);
  }
}

/* ---------------- projectiles ---------------- */
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

/* =========================================================================
   LOW-POLY 3D WORLD (Three.js)
   World mapping: logic (x, y) → scene (x, h, z). 1 unit = 1 “px”.
   ========================================================================= */
const HAS3D = typeof THREE !== 'undefined';
let renderer, scene, camera, terrainMesh, waterMesh, raycaster;
let selRing, moveRing;
const heights=new Float32Array((MAPW+1)*(MAPH+1));
const matCache={};

function mat(c,extra){
  const key=c+JSON.stringify(extra||{});
  if(!matCache[key]) matCache[key]=new THREE.MeshPhongMaterial({color:c,flatShading:true,shininess:6,...(extra||{})});
  return matCache[key];
}
function prim(geo,c,extra){return new THREE.Mesh(geo,mat(c,extra));}
const box3=(w,h,d,c)=>prim(new THREE.BoxGeometry(w,h,d),c);
const cyl3=(rt,rb,h,c,seg)=>prim(new THREE.CylinderGeometry(rt,rb,h,seg||6),c);
const cone3=(r,h,c,seg)=>prim(new THREE.ConeGeometry(r,h,seg||5),c);
const ico3=(r,c,det)=>prim(new THREE.IcosahedronGeometry(r,det||0),c);

function vHeight(vx,vy){
  let water=false, flat=false;
  for(const [tx,ty] of [[vx-1,vy-1],[vx,vy-1],[vx-1,vy],[vx,vy]]){
    const t=T(clamp(tx,0,MAPW-1),clamp(ty,0,MAPH-1));
    if(t===G_WATER||t===G_BRIDGE) water=true;
    else if(t===G_PATH||t===G_DIRT) flat=true;
  }
  if(water) return -13;
  if(flat) return 0;
  return Math.sin(vx*0.35)*Math.cos(vy*0.3)*3.5+Math.sin(vx*0.13+1.7)*Math.cos(vy*0.17+0.6)*7;
}
function heightAt(x,z){
  const t=T(Math.floor(x/TILE),Math.floor(z/TILE));
  if(t===G_BRIDGE) return 2.5;
  if(t===G_PATH||t===G_DIRT) return 0;
  const gx=clamp(x/TILE,0,MAPW), gz=clamp(z/TILE,0,MAPH);
  const x0=Math.floor(Math.min(gx,MAPW-0.001)), z0=Math.floor(Math.min(gz,MAPH-0.001));
  const fx=gx-x0, fz=gz-z0;
  const H=(a,b)=>heights[b*(MAPW+1)+a];
  return lerp(lerp(H(x0,z0),H(x0+1,z0),fx), lerp(H(x0,z0+1),H(x0+1,z0+1),fx), fz);
}

function buildTerrain(){
  const W=MAPW*TILE;
  const geo=new THREE.PlaneGeometry(W,W,MAPW,MAPH);
  const pos=geo.attributes.position;
  const colors=new Float32Array(pos.count*3);
  const col=new THREE.Color();
  const vr=mulberry32(77);
  for(let i=0;i<pos.count;i++){
    const ix=i%(MAPW+1), iy=Math.floor(i/(MAPW+1));
    const h=vHeight(ix,iy);
    heights[iy*(MAPW+1)+ix]=h;
    pos.setZ(i,h);
    // color from the tile this vertex belongs to (painterly jitter)
    const t=T(Math.min(ix,MAPW-1),Math.min(iy,MAPH-1));
    const j=(vr()-0.5)*0.05;
    if(t===G_PATH) col.setRGB(0.55+j,0.45+j,0.30+j);
    else if(t===G_DIRT) col.setRGB(0.45+j,0.36+j,0.24+j);
    else if(t===G_WATER||t===G_BRIDGE) col.setRGB(0.16,0.25,0.22);
    else if(t===G_ROCK) col.setRGB(0.34+j,0.34+j,0.36+j);
    else if(t===G_WALL) col.setRGB(0.42+j,0.34+j,0.22+j);
    else { const g=0.30+vr()*0.10; col.setRGB(g*0.55+j,g+j,g*0.5+j); } // grass / tree floor
    colors[i*3]=col.r; colors[i*3+1]=col.g; colors[i*3+2]=col.b;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geo.rotateX(-Math.PI/2);
  geo.translate(W/2,0,W/2);
  geo.computeVertexNormals();
  terrainMesh=new THREE.Mesh(geo,new THREE.MeshPhongMaterial({vertexColors:true,flatShading:true,shininess:2}));
  scene.add(terrainMesh);

  // water
  const wgeo=new THREE.PlaneGeometry(W,W,1,1);
  wgeo.rotateX(-Math.PI/2); wgeo.translate(W/2,-5,W/2);
  waterMesh=new THREE.Mesh(wgeo,new THREE.MeshPhongMaterial({color:0x2e6e96,transparent:true,opacity:0.82,shininess:80,specular:0x88aacc}));
  scene.add(waterMesh);
}

function buildProps(){
  const W=MAPW*TILE;
  const vr=mulberry32(1234);
  // collect prop tiles
  const treeP=[], wallP=[], rockP=[], bridgeP=[];
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    const t=T(x,y), wx=(x+0.5)*TILE, wz=(y+0.5)*TILE;
    if(t===G_TREE) treeP.push([wx,wz]);
    else if(t===G_WALL) wallP.push([wx,wz]);
    else if(t===G_ROCK){ if(vr()<0.30) rockP.push([wx,wz]); }
    else if(t===G_BRIDGE) bridgeP.push([wx,wz]);
  }
  const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), up=new THREE.Vector3(0,1,0);
  const vS=new THREE.Vector3(), vP=new THREE.Vector3();
  const inst=(geo,material,list,fy,fscale)=>{
    const im=new THREE.InstancedMesh(geo,material,list.length);
    list.forEach((p,i)=>{
      const s=fscale(p,i);
      vS.set(s,s,s); vP.set(p[0],fy(p,s),p[1]);
      q.setFromAxisAngle(up,vr()*Math.PI*2);
      m4.compose(vP,q,vS);
      im.setMatrixAt(i,m4);
    });
    scene.add(im); return im;
  };
  // trunks + canopies
  inst(new THREE.CylinderGeometry(2.6,4,16,5),mat(0x5a4020),treeP,
    p=>heightAt(p[0],p[1])+8, ()=>0.9+vr()*0.4);
  const canopies=inst(new THREE.IcosahedronGeometry(17,0),
    new THREE.MeshPhongMaterial({flatShading:true,shininess:4,color:0xffffff}),treeP,
    p=>heightAt(p[0],p[1])+26, ()=>0.85+vr()*0.5);
  const cc=new THREE.Color();
  treeP.forEach((p,i)=>{ cc.setHSL(0.27+vr()*0.06,0.45+vr()*0.2,0.26+vr()*0.10); canopies.setColorAt(i,cc); });
  if(canopies.instanceColor) canopies.instanceColor.needsUpdate=true;
  // palisade posts
  inst(new THREE.CylinderGeometry(3.4,4.2,30,5),mat(0x6a4a22),wallP,
    ()=>13, ()=>0.9+vr()*0.25);
  // border crags
  inst(new THREE.DodecahedronGeometry(16,0),mat(0x6a6a72),rockP,
    p=>heightAt(p[0],p[1])+6, ()=>0.8+vr()*1.6);
  // bridge planks
  for(const [wx,wz] of bridgeP){
    const b=box3(TILE,3,TILE,0x7a5a30); b.position.set(wx,1.5,wz); scene.add(b);
  }

  // tents
  const tent=(x,z,c,s)=>{
    const t=cone3(26*(s||1),30*(s||1),c,4);
    t.position.set(x,heightAt(x,z)+14*(s||1),z); t.rotation.y=vr()*Math.PI; scene.add(t);
  };
  tent(10*TILE,80*TILE,0x7a4a2a); tent(17*TILE,80.5*TILE,0x5a6a3a);
  tent(75*TILE,17*TILE,0x5a4434); tent(81*TILE,17*TILE,0x5a4434); tent(81*TILE,23*TILE,0x4a3a44,1.15);

  // shrine: dais + pillar + glowing orb
  const dais=cyl3(26,30,6,0x9a96a8,8); dais.position.set(SHRINE.x,3,SHRINE.y); scene.add(dais);
  const pil=box3(8,30,8,0x8a8698); pil.position.set(SHRINE.x,21,SHRINE.y); scene.add(pil);
  const orb=ico3(6,0xcfe0ff,{emissive:0x88aaff,emissiveIntensity:0.9}); orb.position.set(SHRINE.x,42,SHRINE.y); scene.add(orb);
  const shrineLight=new THREE.PointLight(0x88aaff,0.8,180); shrineLight.position.set(SHRINE.x,46,SHRINE.y); scene.add(shrineLight);

  // outpost flag
  const pole=cyl3(1.5,1.5,46,0x3a2a14,5); pole.position.set(13.5*TILE,23,74.5*TILE); scene.add(pole);
  const flag=prim(new THREE.PlaneGeometry(20,12),0xb03030,{side:THREE.DoubleSide});
  flag.position.set(13.5*TILE+11,40,74.5*TILE); scene.add(flag);

  // campfire
  const fire=cone3(6,12,0xff8830,5); fire.material=new THREE.MeshPhongMaterial({color:0xff8830,emissive:0xff5510,emissiveIntensity:1,flatShading:true});
  fire.position.set(78*TILE,6,20*TILE); scene.add(fire);
  const fireLight=new THREE.PointLight(0xff7020,1.1,240); fireLight.position.set(78*TILE,22,20*TILE); scene.add(fireLight);

  // selection + move rings
  const ringGeo=new THREE.RingGeometry(0.82,1,28); ringGeo.rotateX(-Math.PI/2);
  selRing=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:0xffd870,transparent:true,opacity:0.9}));
  selRing.visible=false; scene.add(selRing);
  moveRing=new THREE.Mesh(ringGeo.clone(),new THREE.MeshBasicMaterial({color:0xf0d97a,transparent:true,opacity:0.7}));
  moveRing.visible=false; scene.add(moveRing);
}

/* ---------------- avatars ---------------- */
function humanoid(o){
  const g=new THREE.Group();
  const s=o.scale||1;
  const inner=new THREE.Group(); g.add(inner); g.userData.inner=inner;
  // legs / lower
  if(o.robe){
    const robe=cone3(8,17,o.robe,7); robe.position.y=8.5; inner.add(robe);
  } else {
    const l1=box3(3.4,9,4,o.pants); l1.position.set(0,4.5,-2.6); inner.add(l1);
    const l2=box3(3.4,9,4,o.pants); l2.position.set(0,4.5,2.6); inner.add(l2);
  }
  // torso
  const torso=box3(8,11,10,o.armor); torso.position.y=14.5; inner.add(torso);
  // shoulders
  const sh1=box3(4,3.5,4.5,o.trim); sh1.position.set(0,19.5,-6.5); inner.add(sh1);
  const sh2=box3(4,3.5,4.5,o.trim); sh2.position.set(0,19.5,6.5); inner.add(sh2);
  // head
  const head=ico3(4.6,o.skin||0xd8b08a,1); head.position.y=24.5; inner.add(head);
  if(o.helm){ const helm=cone3(5,6,o.trim,6); helm.position.y=28.6; inner.add(helm); }
  if(o.hood){ const hood=cone3(5.4,8,o.robe,6); hood.position.y=27.5; inner.add(hood); }
  // weapon arm (pivot at shoulder, weapon hangs down then swings forward)
  const arm=new THREE.Group(); arm.position.set(2,19.5,6.5); inner.add(arm);
  g.userData.arm=arm;
  if(o.weapon==='sword'||o.weapon==='cleaver'){
    const big=o.weapon==='cleaver';
    const grip=cyl3(0.9,0.9,5,0x3a2a14,5); grip.position.y=-6; arm.add(grip);
    const guard=box3(1.6,1.2,(big?7:5),0x8a7340); guard.position.y=-8.5; arm.add(guard);
    const blade=box3(1.4,(big?20:14),(big?5:2.6),0xc8ccd8); blade.position.y=-8.5-(big?10:7); blade.position.x=0.0; arm.add(blade);
    arm.rotation.x=Math.PI; // blade up at rest, chop rotates it forward
  } else if(o.weapon==='bow'){
    const bow=prim(new THREE.TorusGeometry(8,0.8,5,10,Math.PI*1.15),0x6a4a22);
    bow.position.y=-6; bow.rotation.z=Math.PI/2-0.6; arm.add(bow);
  } else if(o.weapon==='staff'){
    const staff=cyl3(0.9,0.9,28,0x6a4a22,5); staff.position.y=-2; arm.add(staff);
    const tip=ico3(2.6,0xb8a0ff,{emissive:0x7a55ff,emissiveIntensity:0.9}); tip.position.y=12; arm.add(tip);
  } else if(o.weapon==='banner'){
    const pole=cyl3(0.9,0.9,34,0x3a2a14,5); pole.position.y=0; arm.add(pole);
    const fl=prim(new THREE.PlaneGeometry(11,7),0xb03030,{side:THREE.DoubleSide}); fl.position.set(0,13,5.5); fl.rotation.y=Math.PI/2; arm.add(fl);
  }
  inner.scale.setScalar(s);
  return g;
}
function wolfAvatar(){
  const g=new THREE.Group(); const inner=new THREE.Group(); g.add(inner); g.userData.inner=inner;
  const c=0x7a7d85, cd=0x5d6068;
  const body=box3(17,9,9,c); body.position.y=9.5; inner.add(body);
  const chest=box3(8,10,10,cd); chest.position.set(5,10,0); inner.add(chest);
  const head=box3(7,6.5,6.5,c); head.position.set(11.5,13,0); inner.add(head);
  const snout=box3(4.5,3.2,3.6,cd); snout.position.set(15.5,11.6,0); inner.add(snout);
  const e1=cone3(1.5,3.4,cd,4); e1.position.set(10,17.4,-2.2); inner.add(e1);
  const e2=cone3(1.5,3.4,cd,4); e2.position.set(10,17.4,2.2); inner.add(e2);
  const tail=box3(8,2.4,2.4,cd); tail.position.set(-11,12,0); tail.rotation.z=0.5; inner.add(tail);
  for(const [lx,lz] of [[5,-3],[5,3],[-5,-3],[-5,3]]){
    const leg=box3(2.4,7,2.4,cd); leg.position.set(lx,3.5,lz); inner.add(leg);
  }
  return g;
}
function skaleAvatar(){
  const g=new THREE.Group(); const inner=new THREE.Group(); g.add(inner); g.userData.inner=inner;
  const c=0x3a8a7a, cd=0x2a6a5e;
  const body=ico3(9,c,0); body.scale.set(1.35,0.75,1); body.position.y=7; inner.add(body);
  const head=cone3(4.5,9,cd,5); head.position.set(13,7,0); head.rotation.z=-Math.PI/2; inner.add(head);
  const tail=cone3(3.4,13,cd,5); tail.position.set(-13,6,0); tail.rotation.z=Math.PI/2; inner.add(tail);
  const fin=cone3(3,6,cd,4); fin.position.set(0,14,0); inner.add(fin);
  return g;
}
function makeAvatar(e){
  let g;
  if(e.kind==='player') g=humanoid({armor:0x4a7ab5,trim:0x9aa8c0,pants:0x39414f,weapon:'sword',helm:true});
  else if(e.kind==='hench') g=humanoid({robe:0x3f8a62,armor:0x2f6a4a,trim:0x7ad0a0,weapon:'staff',hood:true});
  else if(e.kind==='npc') g=humanoid({armor:0xb59a4a,trim:0xe8d290,pants:0x4a4438,weapon:'banner'});
  else if(e.type==='wolf') g=wolfAvatar();
  else if(e.type==='skale') g=skaleAvatar();
  else if(e.type==='archer') g=humanoid({armor:0x9a6a3a,trim:0x6a4a26,pants:0x4a3a28,weapon:'bow',hood:true,robe:0});
  else if(e.type==='chief') g=humanoid({armor:0x5a2e2e,trim:0xb03838,pants:0x3a2424,weapon:'cleaver',helm:true,scale:1.45});
  else g=humanoid({armor:0x8a4a3a,trim:0x5a3326,pants:0x42302a,weapon:'sword'});
  // blob shadow
  const sh=new THREE.Mesh(new THREE.CircleGeometry(e.r*0.95,14),
    new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28,depthWrite:false}));
  sh.rotation.x=-Math.PI/2; sh.position.y=0.4; g.add(sh);
  // boss aura
  if(e.boss){
    const aura=new THREE.Mesh(new THREE.RingGeometry(20,26,24),
      new THREE.MeshBasicMaterial({color:0xff4030,transparent:true,opacity:0.5,depthWrite:false}));
    aura.rotation.x=-Math.PI/2; aura.position.y=0.6; g.add(aura);
    g.userData.aura=aura;
  }
  scene.add(g);
  return g;
}

function syncAvatar(e){
  if(!e.av) e.av=makeAvatar(e);
  const g=e.av;
  // hide fully-faded corpses awaiting respawn
  if(e.kind==='enemy'&&e.dead&&now>=e.respawnAt-20){ g.visible=false; return; }
  g.visible=true;
  const gy=heightAt(e.x,e.y);
  const moved=dist(e.x,e.y,g.userData.lx??e.x,g.userData.ly??e.y);
  g.userData.lx=e.x; g.userData.ly=e.y;
  const inner=g.userData.inner;
  if(e.dead){
    g.position.set(e.x,gy+3,e.y);
    inner.rotation.z=Math.PI/2; inner.position.y=2;
    return;
  }
  inner.rotation.z=0; inner.position.y=0;
  const bob=moved>0.05?Math.abs(Math.sin(now*9+e.x))*1.8:0;
  g.position.set(e.x,gy+bob,e.y);
  g.rotation.y=-e.face;
  // walk lean
  inner.rotation.x=moved>0.05?Math.sin(now*9+e.x)*0.06:0;
  // attack chop
  const arm=g.userData.arm;
  if(arm&&e.nextAtk){
    const sw=e.nextAtk-now-(e.atkInt-0.3);
    const k=sw>0?sw/0.3:0; // 1 → 0 right after the hit
    arm.rotation.z=-Math.sin(k*Math.PI)*1.5;
  }
  if(g.userData.aura){
    const p=0.5+Math.sin(now*4)*0.2;
    g.userData.aura.material.opacity=0.35*p+0.2;
    g.userData.aura.scale.setScalar(1+Math.sin(now*4)*0.08);
  }
}

/* ---------------- three init ---------------- */
const canvas=document.getElementById('game');
const fxCanvas=document.getElementById('fx');
const fctx=fxCanvas.getContext('2d');
let VW=0,VH=0,DPR=1;

function initThree(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.outputEncoding=THREE.sRGBEncoding;
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0xb8cfdf);
  scene.fog=new THREE.Fog(0xb8cfdf,650,1750);
  camera=new THREE.PerspectiveCamera(50,1,10,2600);
  raycaster=new THREE.Raycaster();
  scene.add(new THREE.HemisphereLight(0xd8e8ff,0x4a5a38,0.85));
  const sun=new THREE.DirectionalLight(0xffe8c8,1.0);
  sun.position.set(500,800,250); scene.add(sun);
  buildTerrain();
  buildProps();
}

function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  VW=window.innerWidth; VH=window.innerHeight;
  fxCanvas.width=VW*DPR; fxCanvas.height=VH*DPR;
  fxCanvas.style.width=VW+'px'; fxCanvas.style.height=VH+'px';
  fctx.setTransform(DPR,0,0,DPR,0,0);
  if(HAS3D&&renderer){
    renderer.setPixelRatio(DPR);
    renderer.setSize(VW,VH);
    camera.aspect=VW/VH; camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize',resize);

const _pv=HAS3D?new THREE.Vector3():null;
function project(x,y,z){
  _pv.set(x,y,z).project(camera);
  return {x:(_pv.x+1)/2*VW, y:(-_pv.y+1)/2*VH, behind:_pv.z>1};
}
function screenToWorld(sx,sy){
  raycaster.setFromCamera({x:sx/VW*2-1,y:-(sy/VH*2-1)},camera);
  const hit=raycaster.intersectObject(terrainMesh);
  if(hit.length) return {x:hit[0].point.x,y:hit[0].point.z};
  const o=raycaster.ray.origin,d=raycaster.ray.direction;
  const t=-o.y/d.y;
  return {x:o.x+d.x*t,y:o.z+d.z*t};
}

/* ---------------- effects / overlay rendering ---------------- */
const sprTex={};
function spriteTexture(color){
  if(sprTex[color]) return sprTex[color];
  const cv=document.createElement('canvas'); cv.width=cv.height=64;
  const c=cv.getContext('2d');
  const g=c.createRadialGradient(32,32,2,32,32,30);
  g.addColorStop(0,color); g.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=g; c.fillRect(0,0,64,64);
  const tx=new THREE.CanvasTexture(cv);
  sprTex[color]=tx; return tx;
}
const RING_GEO_FLAT=HAS3D?(()=>{const g=new THREE.RingGeometry(0.86,1,28);g.rotateX(-Math.PI/2);return g;})():null;

function fxSpawnMesh(f){
  if(f.type==='aoe'||f.type==='res'||f.type==='levelup'||f.type==='movetick'){
    const c=f.type==='aoe'?(f.color||'#ffd870'):f.type==='movetick'?'#f0d97a':f.type==='res'?'#aac8ff':'#ffe680';
    const m=new THREE.Mesh(RING_GEO_FLAT,new THREE.MeshBasicMaterial({color:new THREE.Color(c),transparent:true,depthWrite:false}));
    m.position.set(f.x,heightAt(f.x,f.y)+0.8,f.y);
    scene.add(m); return m;
  }
  if(f.type==='hit'||f.type==='heal'){
    const col=f.type==='hit'?'rgba(255,255,255,1)':'rgba(110,230,110,1)';
    const m=new THREE.Sprite(new THREE.SpriteMaterial({map:spriteTexture(col),transparent:true,depthWrite:false}));
    m.position.set(f.x,heightAt(f.x,f.y)+16,f.y);
    m.scale.setScalar(18);
    scene.add(m); return m;
  }
  if(f.type==='beam'){
    const g=new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(f.x,heightAt(f.x,f.y)+18,f.y),
      new THREE.Vector3(f.x2,heightAt(f.x2,f.y2)+14,f.y2)]);
    const m=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x8ce6a0,transparent:true}));
    scene.add(m); return m;
  }
  return null;
}
function fxKill(f){
  if(f._m){ scene.remove(f._m); if(f._m.material) f._m.material.dispose(); if(f._m.geometry&&f.type==='beam') f._m.geometry.dispose(); f._m=null; }
}
function updateEffects(){
  for(let i=effects.length-1;i>=0;i--){
    const f=effects[i], k=(now-f.t)/f.dur;
    if(k>=1){ fxKill(f); effects.splice(i,1); continue; }
    if(f._m===undefined) f._m=fxSpawnMesh(f);
    const m=f._m; if(!m) continue;
    if(f.type==='aoe'){ m.scale.setScalar(Math.max(0.01,f.r*k)); m.material.opacity=0.85*(1-k); }
    else if(f.type==='movetick'){ m.scale.setScalar(Math.max(0.01,16*(1-k))); m.material.opacity=0.8*(1-k); }
    else if(f.type==='res'||f.type==='levelup'){ m.scale.setScalar(10+k*52); m.material.opacity=1-k; }
    else if(f.type==='hit'){ m.material.opacity=0.7*(1-k); m.scale.setScalar(14+k*14); }
    else if(f.type==='heal'){ m.material.opacity=0.9*(1-k); m.position.y+=0.6; }
    else if(f.type==='beam'){ m.material.opacity=0.8*(1-k); }
  }
}

const projMeshes=new Map(), dropMeshes=new Map();
function syncPools(){
  for(const p of projectiles){
    if(!projMeshes.has(p)){
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(4,0),
        new THREE.MeshPhongMaterial({color:new THREE.Color(p.color),emissive:new THREE.Color(p.color),emissiveIntensity:0.8,flatShading:true}));
      scene.add(m); projMeshes.set(p,m);
    }
    const m=projMeshes.get(p);
    m.position.set(p.x,heightAt(p.x,p.y)+16,p.y);
    m.rotation.y=now*10;
  }
  for(const [p,m] of projMeshes) if(!projectiles.includes(p)){ scene.remove(m); m.material.dispose(); projMeshes.delete(p); }
  for(const d of drops){
    if(!dropMeshes.has(d)){
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(4.5,0),mat(0xf0d97a,{emissive:0x8a6d1f,emissiveIntensity:0.5}));
      scene.add(m); dropMeshes.set(d,m);
    }
    const m=dropMeshes.get(d);
    m.position.set(d.x,heightAt(d.x,d.y)+6+Math.sin(now*3+d.x)*1.5,d.y);
    m.rotation.y=now*2.5;
  }
  for(const [d,m] of dropMeshes) if(!drops.includes(d)){ scene.remove(m); dropMeshes.delete(d); }
}

/* ---------------- overlay (bars, names, floating text, joystick) ---------------- */
let joyId=null, joyOX=0, joyOY=0;
function drawOverlay(){
  fctx.clearRect(0,0,VW,VH);
  // entity bars / labels
  const seen=[...enemies,hench];
  for(const e of seen){
    if(e.dead) continue;
    if(dist(e.x,e.y,player.x,player.y)>900) continue;
    if(e.kind==='enemy'&&e.hp>=e.maxHp-0.5&&player.target!==e) continue;
    if(e.kind!=='enemy'&&e.hp>=maxHpOf(e)-0.5) continue;
    const h=heightAt(e.x,e.y)+(e.type==='chief'?52:38);
    const p=project(e.x,h,e.y);
    if(p.behind) continue;
    const w=34,pct=clamp(e.hp/maxHpOf(e),0,1);
    fctx.fillStyle='rgba(0,0,0,.6)'; fctx.fillRect(p.x-w/2,p.y,w,5);
    fctx.fillStyle=e.team===0?'#50c878':'#e04030';
    fctx.fillRect(p.x-w/2,p.y,w*pct,5);
    // condition pips
    let ci=0;
    const pip=c=>{fctx.fillStyle=c;fctx.beginPath();fctx.arc(p.x-10+ci*8,p.y-6,3,0,7);fctx.fill();ci++;};
    if(condActive(e,'bleed'))pip('#e02020');
    if(condActive(e,'burn'))pip('#ff8830');
    if(condActive(e,'cripple'))pip('#e3a23c');
  }
  // npc label + quest marker
  {
    const p=project(npcAldra.x,heightAt(npcAldra.x,npcAldra.y)+44,npcAldra.y);
    if(!p.behind&&dist(npcAldra.x,npcAldra.y,player.x,player.y)<900){
      const m=(quest.stage===0||quest.stage===2||quest.stage===4)?'!':(quest.stage===1||quest.stage===3)?'?':'';
      fctx.textAlign='center';
      if(m){
        fctx.font='bold 22px Georgia'; fctx.fillStyle='#f0d97a';
        fctx.fillText(m,p.x,p.y-8-Math.abs(Math.sin(now*3))*5);
      }
      fctx.font='12px Georgia'; fctx.fillStyle='#e8dfc8';
      fctx.fillText('Captain Aldra',p.x,p.y+10);
    }
  }
  // floating combat text
  fctx.textAlign='center';
  for(let i=ftexts.length-1;i>=0;i--){
    const f=ftexts[i], k=(now-f.t)/f.dur;
    if(k>=1){ftexts.splice(i,1);continue;}
    const p=project(f.x,heightAt(f.x,f.y)+34+k*30,f.y);
    if(p.behind) continue;
    fctx.globalAlpha=1-k*k;
    fctx.font=`bold ${f.size}px Arial`;
    fctx.fillStyle='#000'; fctx.fillText(f.txt,p.x+1,p.y+1);
    fctx.fillStyle=f.color; fctx.fillText(f.txt,p.x,p.y);
    fctx.globalAlpha=1;
  }
  // joystick
  if(input.active){
    fctx.strokeStyle='rgba(255,255,255,.35)'; fctx.lineWidth=2;
    fctx.beginPath(); fctx.arc(joyOX,joyOY,52,0,7); fctx.stroke();
    fctx.fillStyle='rgba(255,255,255,.3)';
    fctx.beginPath(); fctx.arc(joyOX+input.jx*52,joyOY+input.jy*52,22,0,7); fctx.fill();
  }
}

/* ---------------- main 3D render ---------------- */
function render(){
  if(!HAS3D||!renderer) return;
  // camera follows from the south, tilted down (fixed yaw — joystick up = north)
  const ph=heightAt(player.x,player.y);
  camera.position.set(player.x,ph+250,player.y+215);
  camera.lookAt(player.x,ph+5,player.y-25);

  for(const e of enemies) syncAvatar(e);
  syncAvatar(player); syncAvatar(hench); syncAvatar(npcAldra);

  // selection ring
  const t=player.target;
  if(t&&!t.dead){
    selRing.visible=true;
    selRing.position.set(t.x,heightAt(t.x,t.y)+0.7,t.y);
    selRing.scale.setScalar(t.r+7+Math.sin(now*5)*1.5);
  } else selRing.visible=false;
  // move marker
  if(player.moveTo){
    moveRing.visible=true;
    moveRing.position.set(player.moveTo.x,heightAt(player.moveTo.x,player.moveTo.y)+0.7,player.moveTo.y);
    moveRing.scale.setScalar(9+Math.sin(now*6)*2);
  } else moveRing.visible=false;
  // sprint shimmer: tilt the inner model slightly forward
  if(player.av) player.av.userData.inner.rotation.x+=((player.buffs.sprint||0)>now?0.12:0);

  syncPools();
  updateEffects();
  renderer.render(scene,camera);
  drawOverlay();
}

/* ---------------- input ---------------- */
let tapId=null, tapX=0, tapY=0, tapT=0;

canvas.addEventListener('pointerdown',ev=>{
  const x=ev.clientX,y=ev.clientY;
  // touch in the lower-left zone drives the joystick; mouse always taps (WASD to move)
  if(joyId===null&&ev.pointerType!=='mouse'&&x<VW*0.45&&y>VH*0.32){
    joyId=ev.pointerId; joyOX=x; joyOY=y;
    input.active=true; input.jx=0; input.jy=0;
  } else if(tapId===null){
    tapId=ev.pointerId; tapX=x; tapY=y; tapT=performance.now();
  }
});
window.addEventListener('pointermove',ev=>{
  if(ev.pointerId===joyId){
    let dx=ev.clientX-joyOX, dy=ev.clientY-joyOY;
    const m=Math.hypot(dx,dy), max=52;
    if(m>max){dx=dx/m*max;dy=dy/m*max;joyOX=ev.clientX-dx;joyOY=ev.clientY-dy;}
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
  if(player.dead||!HAS3D) return;
  closePanels();
  const w=screenToWorld(sx,sy);
  const wx=w.x, wy=w.y;
  // enemy?
  let best=null,bd=40;
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
  if(dist(wx,wy,npcAldra.x,npcAldra.y)<45){
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
buildMinimap();
player=makePlayer();
hench=makeHench();
spawnAll();
if(HAS3D) initThree();
buildSkillbar();
resize();
banner('ELDERVALE','thornveil reach');
setTimeout(()=>toast('Drag the left side of the screen to move'),1200);
setTimeout(()=>toast('Tap a foe to attack · skills 1–8 below'),4600);
setTimeout(()=>toast('Speak with Captain Aldra (gold dot on the compass)'),8200);
requestAnimationFrame(loop);
