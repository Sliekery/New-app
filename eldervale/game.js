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
const G_GRASS=0,G_PATH=1,G_WATER=2,G_TREE=3,G_DIRT=4,G_WALL=5,G_BRIDGE=6,G_ROCK=7,G_SAND=8;
const BLOCKED=new Set([G_WATER,G_TREE,G_WALL,G_ROCK]);
const MELEE_RANGE=46;
const AGGRO_R=175, SOCIAL_R=140, LEASH_R=400;
// zone state (set by buildZone)
let MAPID='town';
let SHRINE={x:48*TILE,y:58*TILE};
let SAFE={x:48*TILE,y:52*TILE,r:99999}; // town: everywhere is safe
let GATES=[];

/* ---------------- settings & persistence ---------------- */
const SETTINGS={quality:'medium', zoom:'normal', vignette:true};
const QUAL_DPR={low:1.0, medium:1.3, high:1.6};
const CAMVIEWS={close:{h:90,back:150,look:-60}, normal:{h:125,back:200,look:-80}, far:{h:185,back:275,look:-100}};
const SAVE_KEY='eldervale.save.v2', SET_KEY='eldervale.settings.v1';
const hasLS=(()=>{try{return typeof localStorage!=='undefined';}catch(e){return false;}})();
function loadSettings(){
  if(!hasLS) return;
  try{ const s=JSON.parse(localStorage.getItem(SET_KEY)); if(s) Object.assign(SETTINGS,s); }catch(e){}
}
function saveSettings(){ if(hasLS) try{ localStorage.setItem(SET_KEY,JSON.stringify(SETTINGS)); }catch(e){} }
let saveTimer=0;
function saveGame(){
  if(!hasLS||!player) return;
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify({
      cls:player.cls, lvl:player.lvl, xp:player.xp, gold:player.gold, dp:player.dp,
      attrs:player.attrs, attrPts:player.attrPts, equip:player.equip, inv:player.inv,
      builds:player.builds||[], known:player.known, bars:player.bars, skillPts:player.skillPts,
      promo:player.promo||0, bounty:player.bounty||null, vault:player.vault||[],
      hero:{recruited:hench&&hench.recruited, stance:hench&&hench.stance},
      zone:MAPID, qs,
    }));
  }catch(e){}
}
function loadSaveData(){ if(!hasLS) return null; try{ return JSON.parse(localStorage.getItem(SAVE_KEY)); }catch(e){ return null; } }
function wipeSave(){ if(hasLS) try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

/* ---------------- map ---------------- */
const map=new Uint8Array(MAPW*MAPH);
const T=(x,y)=>(x<0||y<0||x>=MAPW||y>=MAPH)?G_ROCK:map[y*MAPW+x];
const setT=(x,y,v)=>{if(x>=0&&y>=0&&x<MAPW&&y<MAPH)map[y*MAPW+x]=v;};
const riverCX=y=>58+Math.sin(y*0.07)*7;

function stampCircle(cx,cy,r,v){
  for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++)
    if(dist(x,y,cx,cy)<=r) setT(x,y,v);
}
function road(wp,rad){
  rad=rad||1;
  for(let i=0;i<wp.length-1;i++){
    const [ax,ay]=wp[i],[bx,by]=wp[i+1];
    const steps=Math.ceil(dist(ax,ay,bx,by)*2);
    for(let s=0;s<=steps;s++){
      const px=lerp(ax,bx,s/steps),py=lerp(ay,by,s/steps);
      for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){
        const tx=Math.round(px+dx),ty=Math.round(py+dy);
        setT(tx,ty,T(tx,ty)===G_WATER?G_BRIDGE:G_PATH);
      }
    }
  }
}
function clearTreesNearPaths(){
  const clear=[];
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    if(T(x,y)!==G_TREE) continue;
    let near=false;
    for(let dy=-2;dy<=2&&!near;dy++)for(let dx=-2;dx<=2&&!near;dx++){
      const t=T(x+dx,y+dy);
      if(t===G_PATH||t===G_DIRT||t===G_BRIDGE||t===G_SAND) near=true;
    }
    if(near) clear.push([x,y]);
  }
  for(const [x,y] of clear) setT(x,y,G_GRASS);
}
function borderRocks(){
  for(let i=0;i<MAPW;i++)for(let b=0;b<2;b++){
    setT(i,b,G_ROCK);setT(i,MAPH-1-b,G_ROCK);setT(b,i,G_ROCK);setT(MAPW-1-b,i,G_ROCK);
  }
}

/* ---- Sunmere, Jewel of the Coast: the great port city (Kamadan-scale) ---- */
function buildTown(){
  map.fill(G_PATH);                                  // a fully paved sandstone city
  // the sea along the south, a sand quay above it
  for(let y=82;y<MAPH;y++)for(let x=0;x<MAPW;x++) setT(x,y,G_WATER);
  for(let y=78;y<82;y++)for(let x=0;x<MAPW;x++) setT(x,y,G_SAND);
  // three timber piers reaching into the harbor
  for(const px of [20,48,74]){
    for(let y=79;y<=92;y++)for(let x=px-1;x<=px+1;x++) setT(x,y,G_BRIDGE);
  }
  // outer city wall just inside the map, with three gates
  for(let i=3;i<MAPW-3;i++){ setT(i,3,G_WALL); setT(i,4,G_WALL); }      // north wall
  for(let j=3;j<78;j++){ setT(3,j,G_WALL); setT(4,j,G_WALL); setT(MAPW-4,j,G_WALL); setT(MAPW-5,j,G_WALL); }
  for(let y=46;y<=50;y++){ setT(MAPW-4,y,G_PATH); setT(MAPW-5,y,G_PATH); } // east land gate (to the Dunereach)
  for(let x=44;x<=52;x++){ setT(x,3,G_PATH); setT(x,4,G_PATH); }          // north gate (sealed)
  for(let y=46;y<=50;y++){ setT(3,y,G_PATH); setT(4,y,G_PATH); }          // west gate (sealed)
  // grand plaza with the fountain at its heart
  stampCircle(46,46,11,G_PATH);
  setT(46,46,G_WALL);                                // fountain plinth (solid)
  // boulevards: cardinal avenues from the plaza, lined later with palms
  road([[46,46],[46,8]],1);    // to the Hall of the Sun (north court)
  road([[46,46],[88,48]],1);   // to the east land gate
  road([[46,46],[8,46]],1);    // to the west market
  road([[46,57],[46,79]],1);   // to the central pier
  road([[40,52],[20,79]],1);   // to the west pier
  road([[52,52],[74,79]],1);   // to the east pier
  // Hall of the Sun: a walled court at the north (quest-givers, hero, trainers)
  stampCircle(46,14,8,G_DIRT);
  for(let a=0;a<Math.PI*2;a+=0.035){
    const d=Math.abs(((a-Math.PI/2+Math.PI*3)%(Math.PI*2))-Math.PI);
    if(d<0.5) continue;                              // south gate toward the plaza
    const tx=Math.round(46+Math.cos(a)*8.5),ty=Math.round(14+Math.sin(a)*8.5);
    if(T(tx,ty)!==G_PATH) setT(tx,ty,G_WALL);
  }
  // the Grand Bazaar (west): merchant, traders, collectors — a market square of stalls
  for(let y=40;y<=52;y++)for(let x=10;x<=24;x++) setT(x,y,G_DIRT);
  // the Artisans' Row (east of plaza): armorer, weaponsmith, crafter
  for(let y=40;y<=46;y++)for(let x=58;x<=72;x++) setT(x,y,G_DIRT);
  // the Vault & storage court (south-east)
  for(let y=58;y<=66;y++)for(let x=60;x<=70;x++) setT(x,y,G_DIRT);
  // residential blocks (building footprints become solid; props draw domes atop)
  const blocks=[[16,20,5,4],[30,16,4,4],[64,18,5,4],[74,30,4,5],[18,62,5,4],[34,64,4,4],[72,52,4,4],[28,30,3,3]];
  for(const [bx,by,bw,bh] of blocks){
    for(let y=by;y<by+bh;y++)for(let x=bx;x<bx+bw;x++) setT(x,y,G_WALL);
  }
  // palms lining the avenues and dotting the squares
  for(let y=6;y<78;y++)for(let x=6;x<MAPW-6;x++)
    if(T(x,y)===G_PATH&&rng()<0.012) setT(x,y,G_TREE);
  for(let x=8;x<MAPW-8;x+=4) if(T(x,77)===G_PATH&&rng()<0.6) setT(x,77,G_TREE);
  clearTreesNearPaths();
  borderRocks();
  SHRINE={x:46*TILE,y:30*TILE};                      // statue-of-rebirth at the plaza's north steps (cosmetic in town)
  SAFE={x:46*TILE,y:46*TILE,r:99999};                // the whole city is safe
  GATES=[
    {x:93*TILE,y:48*TILE,to:'wilds',label:'The Dunereach'},
    {x:46*TILE,y:3*TILE,locked:'The northern road is sealed — for now.',label:'Northern Road'},
    {x:3*TILE,y:48*TILE,locked:'The Astralarium gate is barred.',label:'Astralarium Way'},
  ];
}

/* ---- The Dunereach: first explorable area (Plains of Jarin) ----
   rolling green hills & a foliaged lake to the NORTH, dry red desert to the
   SOUTH; a river threads down the middle. Several portals ring the edges. */
function buildWilds(){
  map.fill(G_GRASS);
  // the south half is arid desert (sand/red earth); the north stays green
  for(let y=54;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    if(T(x,y)===G_GRASS) setT(x,y, rng()<0.5?G_SAND:(rng()<0.4?G_DIRT:G_GRASS));
  }
  // the great lake in the north, foliage all around it
  stampCircle(40,14,12,G_WATER);
  stampCircle(40,14,15,G_GRASS===G_GRASS?G_GRASS:G_GRASS); // (lakeshore stays green; no-op guard)
  // a river spilling from the lake down through the plain to the south dunes
  const rcx=y=>40+Math.round(Math.sin(y*0.08)*8)+Math.round((y-14)*0.18);
  for(let y=14;y<MAPH;y++){ const cx=rcx(y); for(let x=cx-2;x<=cx+2;x++) setT(x,y,G_WATER); }
  // roads: west gate ⇄ central crossroads ⇄ east gate (to the city)
  road([[5,48],[18,46],[30,48],[44,50],[58,48],[72,46],[90,48]],1);
  // spur north to the lake shrine, spur south into the dunes
  road([[44,50],[40,30],[38,18]],1);
  road([[58,48],[64,62],[70,78]],1);
  // green rolling groves in the north, sparse acacias in the south desert
  const groves=[[22,20,9],[58,18,9],[30,38,7],[70,30,8],[14,60,6],[80,64,7]];
  for(const [gx,gy,gr] of groves){
    for(let y=gy-gr;y<=gy+gr;y++)for(let x=gx-gr;x<=gx+gr;x++){
      const dns = gy<40?0.5:0.18; // north is lush, south is sparse
      if(dist(x,y,gx,gy)<=gr&&T(x,y)===G_GRASS&&rng()<dns) setT(x,y,G_TREE);
    }
  }
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++)
    if(T(x,y)===G_GRASS&&rng()<(y<40?0.05:0.02)) setT(x,y,G_TREE);
  // a rocky outcrop in the south where the sand-stalkers den, and the lurker boss hides
  stampCircle(78,72,5,G_ROCK); stampCircle(78,72,3,G_DIRT);
  clearTreesNearPaths();
  borderRocks();
  // gate corridors
  for(let y=46;y<=50;y++){ for(let x=0;x<=5;x++) setT(x,y,G_PATH); for(let x=90;x<MAPW;x++) setT(x,y,G_PATH); }
  for(let x=36;x<=40;x++)for(let y=0;y<=4;y++) setT(x,y,G_PATH); // north portal stub (sealed)
  SHRINE={x:90*TILE,y:48*TILE};                      // resurrection shrine by the east (city) gate
  SAFE={x:92*TILE,y:48*TILE,r:5*TILE};
  GATES=[
    {x:94*TILE,y:48*TILE,to:'town',label:'Sunmere'},
    {x:3*TILE,y:48*TILE,locked:'Champion\'s Dawn lies beyond — not yet open.',label:"Champion's Dawn"},
    {x:38*TILE,y:3*TILE,locked:'The Astralarium road is impassable.',label:'The Astralarium'},
  ];
}

const ZONES={
  town: {name:'Sunmere', sub:'jewel of the coast', safe:true,  build:buildTown,  spawn:spawnTown,  enterFrom:{wilds:[88,48], start:[46,40]}},
  wilds:{name:'The Dunereach', sub:'explorable — plains of jarin', safe:false, build:buildWilds, spawn:spawnWilds, enterFrom:{town:[8,48], start:[8,48]}},
};
function buildZone(){ ZONES[MAPID].build(); }

function travelTo(zid,fromId){
  const from=fromId||MAPID;
  // clear transient world state
  if(HAS3D&&scene){
    for(const f of effects) fxKill(f);
    for(const e of enemies) if(e.av){ scene.remove(e.av); e.av=null; }
    for(const n of npcs) if(n.av){ scene.remove(n.av); n.av=null; }
  }
  effects.length=0; ftexts.length=0; projectiles.length=0; drops.length=0;
  enemies.length=0; npcs.length=0;
  MAPID=zid;
  buildZone();
  buildMinimap();
  if(HAS3D&&renderer) rebuildWorld3D();
  ZONES[zid].spawn();
  const ent=ZONES[zid].enterFrom[from]||ZONES[zid].enterFrom.start;
  const p=findOpen(ent[0],ent[1]);
  player.x=p.x; player.y=p.y;
  player.moveTo=null; player.target=null; player.engaged=false; player.approach=null;
  cancelCast();
  hench.dead=false; hench.hp=hench.maxHp;
  const hp2=findOpen(ent[0],ent[1]+1); hench.x=hp2.x; hench.y=hp2.y;
  banner(ZONES[zid].name.toUpperCase(),ZONES[zid].sub);
  saveGame();
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
const inSafeZone=e=>ZONES[MAPID].safe||dist(e.x,e.y,SAFE.x,SAFE.y)<SAFE.r;

/* ---------------- minimap prerender ---------------- */
let miniCv;
function buildMinimap(){
  miniCv=document.createElement('canvas'); miniCv.width=MAPW; miniCv.height=MAPH;
  const m=miniCv.getContext('2d');
  for(let y=0;y<MAPH;y++)for(let x=0;x<MAPW;x++){
    const t=T(x,y);
    m.fillStyle=t===G_WATER?'#1a7ea0':t===G_PATH?'#c0a06a':t===G_BRIDGE?'#a8845a':t===G_TREE?'#2f5e22':
      t===G_DIRT?'#96664a':t===G_WALL?'#5a4020':t===G_ROCK?'#75716a':t===G_SAND?'#e0cc9c':'#4f7c38';
    m.fillRect(x,y,1,1);
  }
}

/* ---------------- skills & professions (GW1-style) ----------------
   Each profession has a POOL of skills. You start knowing 8; the rest are
   bought from the skill trainer (gold + skill points), and you compose your
   own 8-slot bar — editable only in town, GW1 outpost rule. ---------------- */
// Everyone carries a res signet, GW1 tradition.
const RES_SKILL={id:'res', name:'Restore Ally', icon:'💫', en:0, rc:90, cast:3, type:'res',
  desc:'Signet (3s): resurrect Lyra at 50% health. Stand near her body.',
  fx(){ if(hench.dead){
    hench.dead=false; hench.hp=Math.round(hench.maxHp*0.5); hench.cond={};
    effects.push({type:'res',x:hench.x,y:hench.y,t:now,dur:0.8});
    ftext(hench.x,hench.y,'Restored!','#a0c8ff',14);
  }}};

const WARRIOR_POOL=[
  {id:'w_sever', name:'Sever Artery', icon:'🩸', en:0, adr:4, rc:1, cast:0, type:'melee', desc:'Adrenaline (4 strikes): sword attack, +5 damage, Bleeding for 15s.',
    fx(t){ meleeAttack(player,t,strMod(5),d=>{addCond(d,'bleed',15); ftext(d.x,d.y,'Bleeding!','#e05050',11);}); }},
  {id:'w_gash', name:'Gash',         icon:'🗡️', en:0, adr:6, rc:1, cast:0, type:'melee', desc:'Adrenaline (6): +7 damage. A Bleeding foe suffers a Deep Wound (−20% max HP, 15s).',
    fx(t){ meleeAttack(player,t,strMod(7),d=>{
      if(condActive(d,'bleed')){ addCond(d,'deepwound',15); ftext(d.x,d.y,'Deep Wound!','#b050d0',11); }
    }); }},
  {id:'w_final', name:'Final Thrust', icon:'⚔️', en:0, adr:9, rc:1, cast:0, type:'melee', drainAll:true, desc:'Adrenaline (9): +20 damage, +40 if the foe is below half health. Drains ALL adrenaline.',
    fx(t){ meleeAttack(player,t,strMod(t.hp<maxHpOf(t)*0.5?40:20)); }},
  {id:'w_ham', name:'Hamstring',    icon:'🦶', en:7,  rc:12, cast:0, type:'melee', desc:'Sword attack: +5 damage and Cripples the foe (slowed) for 8s.',
    fx(t){ meleeAttack(player,t,5,d=>{addCond(d,'cripple',8); ftext(d.x,d.y,'Crippled!','#e3a23c',11);}); }},
  {id:'w_sig', name:'Healing Signet',icon:'✚', en:0,  rc:20, cast:2, type:'self',  desc:'Signet (2s): heal for 45% of max health (more with Tactics). Moving cancels it.',
    fx(){
      const heal=Math.round(pMaxHp()*(0.45+0.02*attr('Tactics')));
      player.hp=Math.min(pMaxHp(),player.hp+heal);
      ftext(player.x,player.y,'+'+heal,'#70e070',15);
      effects.push({type:'heal',x:player.x,y:player.y,t:now,dur:0.6});
    }},
  {id:'w_frenzy', name:'Frenzy',       icon:'😤', en:5,  rc:15, cast:0, type:'self',  desc:'Stance (6s): attack 33% faster, but you take double damage. GW1 classic.',
    fx(){ player.buffs.frenzy=now+6; ftext(player.x,player.y,'Frenzy!','#ff9050',13); }},
  {id:'w_fbolt', name:'Fire Bolt',    icon:'🔥', en:10, rc:5,  cast:0.8, type:'ranged', range:300, desc:'Spell (0.8s): hurl fire for 35 damage and Burning for 3s (Elementalist secondary).',
    fx(t){ if(t&&!t.dead) fireProjectile(player,t,fireMod(35),'#ff8830',d=>{addCond(d,'burn',3); ftext(d.x,d.y,'Burning!','#ff8830',11);}); }},
  RES_SKILL,
];

const ELE_POOL=[
  {id:'e_flare', name:'Flare',        icon:'🔥', en:5,  rc:2,  cast:1, type:'ranged', range:290, desc:'Spell (1s): bolt of fire for 26 damage. Your bread-and-butter — spam it.',
    fx(t){ if(t&&!t.dead) fireProjectile(player,t,fireMod(26),'#ff9840'); }},
  {id:'e_fball', name:'Fireball',     icon:'☄️', en:10, rc:7,  cast:2, type:'ranged', range:300, desc:'Spell (2s): explodes on your target for 45 damage to all foes near it.',
    fx(t){
      if(!t||t.dead) return;
      const cx=t.x, cy=t.y;
      effects.push({type:'aoe',x:cx,y:cy,t:now,dur:0.45,r:88,color:'#ff7030'});
      for(const e of enemies){
        if(!e.dead&&dist(cx,cy,e.x,e.y)<88+e.r) applyDamage(player,e,fireMod(45),'#ff9040');
      }
    }},
  {id:'e_light', name:'Lightning Strike',icon:'⚡', en:5, rc:4, cast:0.75, type:'ranged', range:310, desc:'Spell (0.75s): instant lightning for 35 damage.',
    fx(t){
      if(!t||t.dead) return;
      effects.push({type:'beam',x:player.x,y:player.y,x2:t.x,y2:t.y,t:now,dur:0.25});
      applyDamage(player,t,stormMod(35),'#ffe860');
    }},
  {id:'e_ice', name:'Ice Shard',    icon:'❄️', en:10, rc:8,  cast:1, type:'ranged', range:290, desc:'Spell (1s): 30 cold damage and Chills (slows) the foe for 6s.',
    fx(t){ if(t&&!t.dead) fireProjectile(player,t,stormMod(30),'#8ad8ff',d=>{addCond(d,'cripple',6); ftext(d.x,d.y,'Chilled!','#8ad8ff',11);}); }},
  {id:'e_immo', name:'Immolate',     icon:'🌋', en:10, rc:6,  cast:1, type:'ranged', range:290, desc:'Spell (1s): 30 fire damage and Burning for 4s.',
    fx(t){ if(t&&!t.dead) fireProjectile(player,t,fireMod(30),'#ff7030',d=>{addCond(d,'burn',4); ftext(d.x,d.y,'Burning!','#ff8830',11);}); }},
  {id:'e_earth', name:'Armor of Earth',icon:'🪨', en:10, rc:25, cast:0.75, type:'self', desc:'Spell: skin of stone — you take 40% less damage for 10 seconds.',
    fx(){
      player.buffs.stone=now+10;
      ftext(player.x,player.y,'Armor of Earth!','#c8a060',13);
      effects.push({type:'aoe',x:player.x,y:player.y,t:now,dur:0.4,r:40,color:'#c8a060'});
    }},
  {id:'e_aura', name:'Aura of Restoration',icon:'💞', en:5, rc:20, cast:1.5, type:'self', desc:'Spell (1.5s): heal 40% of max health and gain 8 energy (Monk secondary).',
    fx(){
      const heal=Math.round(pMaxHp()*0.40);
      player.hp=Math.min(pMaxHp(),player.hp+heal);
      player.en=Math.min(pMaxEn(),player.en+8);
      ftext(player.x,player.y,'+'+heal,'#70e070',15);
      effects.push({type:'heal',x:player.x,y:player.y,t:now,dur:0.6});
    }},
  RES_SKILL,
];


// trainable skills (skill trainer in town: gold + 1 skill point each)
WARRIOR_POOL.push(
  {id:'w_cyclone', name:'Cyclone Slash', icon:'🌀', en:0, adr:5, rc:1, cast:0, type:'pbaoe', desc:'Adrenaline (5): whirl your blade, striking all adjacent foes.',
    fx(){
      effects.push({type:'aoe',x:player.x,y:player.y,t:now,dur:0.35,r:78});
      for(const e of enemies){
        if(!e.dead&&dist(player.x,player.y,e.x,e.y)<78+e.r) applyDamage(player,e,strMod(rollDmg(player)),'#ffd870');
      }
      player.nextAtk=now+player.atkInt;
    }},
  {id:'w_power', name:'Power Attack', icon:'💥', en:5, rc:5, cast:0, type:'melee', desc:'Sword attack: +12 damage. Simple, honest, effective.',
    fx(t){ meleeAttack(player,t,12); }},
  {id:'w_bash', name:'Shield Bash', icon:'🛡️', en:8, rc:20, cast:0, type:'melee', desc:'Slam your shield: +8 damage and the foe is Stunned for 2.5s.',
    fx(t){ meleeAttack(player,t,8,d=>{addCond(d,'stun',2.5); ftext(d.x,d.y,'Stunned!','#ffd870',11);}); }},
  {id:'w_sprint', name:'Sprint', icon:'💨', en:5, rc:15, cast:0, type:'self', desc:'Stance: move 40% faster for 6 seconds.',
    fx(){ player.buffs.sprint=now+6; ftext(player.x,player.y,'Sprint!','#c8e8ff',12); }},
  {id:'w_stand', name:'Stand Firm', icon:'🗿', en:10, rc:25, cast:0, type:'self', desc:'Stance: plant your feet — you take 30% less damage for 8 seconds.',
    fx(){ player.buffs.brace=now+8; ftext(player.x,player.y,'Stand Firm!','#c8a060',12); }},
);
ELE_POOL.push(
  {id:'e_stone', name:'Stone Daggers', icon:'🪨', en:5, rc:2, cast:1, type:'ranged', range:290, desc:'Spell (1s): fling shards of stone for 24 earth damage. Spammable.',
    fx(t){ if(t&&!t.dead) fireProjectile(player,t,24,'#c8a060'); }},
  {id:'e_chain', name:'Chain Gale', icon:'🌪️', en:10, rc:8, cast:1, type:'ranged', range:300, desc:'Spell (1s): lightning leaps to your target and one nearby foe for 28 damage each.',
    fx(t){
      if(!t||t.dead) return;
      effects.push({type:'beam',x:player.x,y:player.y,x2:t.x,y2:t.y,t:now,dur:0.25});
      applyDamage(player,t,stormMod(28),'#ffe860');
      let n2=null,bd=120;
      for(const e of enemies){ if(!e.dead&&e!==t){const d=dist(t.x,t.y,e.x,e.y); if(d<bd){n2=e;bd=d;}} }
      if(n2){ effects.push({type:'beam',x:t.x,y:t.y,x2:n2.x,y2:n2.y,t:now,dur:0.25}); applyDamage(player,n2,stormMod(28),'#ffe860'); }
    }},
  {id:'e_nova', name:'Frost Nova', icon:'❄️', en:12, rc:15, cast:0.75, type:'pbaoe', desc:'Spell: a ring of frost — 30 cold damage and Chills all adjacent foes for 4s.',
    fx(){
      effects.push({type:'aoe',x:player.x,y:player.y,t:now,dur:0.4,r:74,color:'#8ad8ff'});
      for(const e of enemies){
        if(!e.dead&&dist(player.x,player.y,e.x,e.y)<74+e.r){
          applyDamage(player,e,stormMod(30),'#8ad8ff'); addCond(e,'cripple',4);
        }
      }
    }},
  {id:'e_meteor', name:'Meteor', icon:'☄️', en:15, rc:25, cast:3, type:'ranged', range:300, desc:'Spell (3s): a falling star — 80 fire damage to foes near your target, and they are Stunned for 2s.',
    fx(t){
      if(!t||t.dead) return;
      const cx=t.x, cy=t.y;
      effects.push({type:'aoe',x:cx,y:cy,t:now,dur:0.6,r:92,color:'#ff5030'});
      for(const e of enemies){
        if(!e.dead&&dist(cx,cy,e.x,e.y)<92+e.r){ applyDamage(player,e,fireMod(80),'#ff7030'); addCond(e,'stun',2); }
      }
    }},
  {id:'e_mend', name:'Mending Touch', icon:'💖', en:10, rc:12, cast:1.5, type:'self', desc:'Spell (1.5s): mend the most wounded of you and Lyra for 40% of their health (Monk secondary).',
    fx(){
      let low=player, lp=player.hp/pMaxHp();
      if(!hench.dead&&hench.hp/hench.maxHp<lp) low=hench;
      const heal=Math.round(maxHpOf(low)*0.40);
      low.hp=Math.min(maxHpOf(low),low.hp+heal);
      ftext(low.x,low.y,'+'+heal,'#70e070',15);
      effects.push({type:'heal',x:low.x,y:low.y,t:now,dur:0.6});
    }},
);
// Signet of Capture + the three capturable boss elites (any profession may slot them).
const EXTRA_SKILLS=[
  {id:'cap', name:'Signet of Capture', icon:'📜', en:0, rc:2, cast:2, type:'capture',
    desc:'Signet (2s): used beside a slain boss, learn its elite skill. Slot the elite at the trainer afterward.',
    fx(){ tryCapture(); }},
  {id:'el_aegis', name:'Duneshaper\'s Aegis', icon:'🪨', en:5, rc:30, cast:0, type:'self', elite:true,
    desc:'Elite Stance (10s): a carapace of sand — you take 50% less damage and cannot be knocked down.',
    fx(){ player.buffs.aegis=now+10; ftext(player.x,player.y,'Aegis!','#c8a060',13); effects.push({type:'aoe',x:player.x,y:player.y,t:now,dur:0.45,r:44,color:'#c8a060'}); }},
  {id:'el_storm', name:'Galewither\'s Wrath', icon:'🌩️', en:15, rc:12, cast:1.5, type:'ranged', range:300, elite:true,
    desc:'Elite Spell (1.5s): call the storm — 70 lightning damage to your target and every foe near it.',
    fx(t){ if(!t||t.dead) return; const cx=t.x,cy=t.y;
      effects.push({type:'aoe',x:cx,y:cy,t:now,dur:0.5,r:96,color:'#ffe860'});
      for(const e of enemies) if(!e.dead&&dist(cx,cy,e.x,e.y)<96+e.r){ effects.push({type:'beam',x:player.x,y:player.y,x2:e.x,y2:e.y,t:now,dur:0.22}); applyDamage(player,e,stormMod(70),'#ffe860'); } }},
  {id:'el_rake', name:'Reaper\'s Rake', icon:'🌾', en:0, adr:8, rc:1, cast:0, type:'melee', elite:true,
    desc:'Elite adrenaline (8): a scything blow for +24 damage that inflicts Bleeding and a Deep Wound.',
    fx(t){ meleeAttack(player,t,strMod(24),d=>{ addCond(d,'bleed',12); addCond(d,'deepwound',12); ftext(d.x,d.y,'Rake!','#b050d0',12); }); }},
];
const SKILL_BY_ID={};
for(const s of [...WARRIOR_POOL,...ELE_POOL,RES_SKILL,...EXTRA_SKILLS]) SKILL_BY_ID[s.id]=s;
const DEFAULT_BARS={
  warrior:['w_sever','w_gash','w_final','w_ham','w_sig','w_frenzy','w_fbolt','res'],
  elementalist:['e_flare','e_fball','e_light','e_ice','e_immo','e_earth','e_aura','res'],
};
const skillCost=()=>100+60*Math.max(0,(player.known[player.cls]||[]).length-8);
function learnSkill(id){
  const sk=SKILL_BY_ID[id]; if(!sk) return;
  const known=player.known[player.cls];
  if(known.includes(id)){ toast('Already known'); return; }
  const cost=skillCost();
  if((player.skillPts||0)<1){ toast('Need a skill point (earn them by leveling and from quests)'); return; }
  if(player.gold<cost){ toast('Not enough gold ('+cost+'g)'); return; }
  player.gold-=cost; player.skillPts--;
  known.push(id);
  toast('Learned: '+sk.name+' — equip it in Skills & Builds');
  saveGame();
}
function applyBar(){
  SKILLS=player.bars[player.cls].map(id=>SKILL_BY_ID[id]||RES_SKILL);
  player.skillReady.fill(0);
  buildSkillbar();
  if(ui&&ui.pAdrBar) ui.pAdrBar.style.display=SKILLS.some(s=>s.adr)?'block':'none';
}
function setBarSlot(slot,id){
  if(!ZONES[MAPID].safe){ toast('Builds can only be changed in town (GW1 rule)'); return false; }
  const bar=player.bars[player.cls];
  if(!player.known[player.cls].includes(id)){ toast('You have not learned that skill'); return false; }
  const j=bar.indexOf(id);
  if(j>=0) bar[j]=bar[slot]; // swap if already slotted
  bar[slot]=id;
  applyBar(); saveGame();
  return true;
}
const CLASSES={
  warrior:{label:'Warrior (W/E)', icon:'⚔️',
    blurb:'Heavy melee. Sword chains, conditions and a self-heal, with a touch of fire from your Elementalist secondary.',
    pool:WARRIOR_POOL, baseHp:100, baseEn:30, enRegen:1.33, dmgMin:12, dmgMax:18, atkInt:1.2, range:MELEE_RANGE},
  elementalist:{label:'Elementalist (E/Mo)', icon:'🔥',
    blurb:'Glass-cannon caster. Fire, air and earth magic at range — a wand auto-attack, and Monk restoration as your secondary.',
    pool:ELE_POOL, baseHp:90, baseEn:45, enRegen:1.75, dmgMin:8, dmgMax:13, atkInt:1.5, range:280},
};
let SKILLS=DEFAULT_BARS.warrior.map(id=>SKILL_BY_ID[id]); // rebound by applyBar()

/* ---------------- attributes & items (GW1-style) ---------------- */
const CLASS_ATTRS={
  warrior:['Strength','Swordsmanship','Tactics'],
  elementalist:['Energy Storage','Fire Magic','Storm Magic'],
};
const ATTR_DESC={
  'Strength':'+1.5% adrenaline skill damage and +1 armor per rank',
  'Swordsmanship':'+2% sword damage per rank',
  'Tactics':'Healing Signet heals +2% per rank',
  'Energy Storage':'+3 maximum energy per rank',
  'Fire Magic':'+4% fire spell & wand damage per rank',
  'Storm Magic':'+4% lightning and cold damage per rank',
};
const attr=n=>player.attrs[n]||0;
const fireMod=d=>Math.round(d*(1+0.04*attr('Fire Magic')));
const stormMod=d=>Math.round(d*(1+0.04*attr('Storm Magic')));
const strMod=d=>Math.round(d*(1+0.015*attr('Strength')));

const RARITY_COLORS=['#e8e8e8','#7ab0ff','#c080ff','#ffd34d'];
const RARITY_PREFIX=['Worn','Istani','Sunspear',"Blackmaw's"];
function genW(wt,lvl,rar){
  const base=wt==='sword'?['Sword','Cutlass','Blade']:['Wand','Scepter','Cane'];
  const mn=Math.round((wt==='sword'?8:6)+1.8*lvl+2.5*rar);
  return {kind:'weapon',wtype:wt,rarity:rar,name:RARITY_PREFIX[rar]+' '+base[irand(0,2)],
    dmgMin:mn,dmgMax:mn+6+2*rar,value:12+6*lvl+25*rar};
}
function genOff(ot,lvl,rar){
  if(ot==='shield') return {kind:'off',otype:'shield',rarity:rar,name:RARITY_PREFIX[rar]+' Shield',armor:8+2*lvl+4*rar,value:10+5*lvl+20*rar};
  return {kind:'off',otype:'focus',rarity:rar,name:RARITY_PREFIX[rar]+' Focus',energy:4+Math.round(lvl/2)+3*rar,value:10+5*lvl+20*rar};
}
function makeEquip(lvl,rarity){
  const rar=rarity!==undefined?rarity:(Math.random()<0.12?2:Math.random()<0.45?1:0);
  const r=Math.random();
  if(r<0.4) return genW(player.cls==='warrior'?'sword':'wand',lvl,rar); // bias to your class
  if(r<0.65) return genW(Math.random()<0.5?'sword':'wand',lvl,rar);
  return genOff(Math.random()<0.5?'shield':'focus',lvl,rar);
}
function makeTrophy(e){return {kind:'trophy',rarity:0,name:e.trophy,value:4+2*e.lvl};}
function makeMat(name){return {kind:'mat',rarity:0,name,value:6};}
function giveItem(it){
  if(player.inv.length<20){ player.inv.push(it); toast('Received: '+it.name); }
  else drops.push({x:player.x,y:player.y,item:it,t:now});
}

/* unique boss drops (GW1 "greens") */
const UNIQUES={
  duneshaper:()=>({kind:'weapon',wtype:'sword',rarity:3,unique:true,name:"Duneshaper's Pincer",dmgMin:18,dmgMax:30,armor:6,value:520,lore:'Hewn from the claw that moved the sand.'}),
  galewither:()=>({kind:'weapon',wtype:'wand',rarity:3,unique:true,name:'Galewither Branch',dmgMin:15,dmgMax:24,energy:8,value:520,lore:'A storm still sleeps in the grain of it.'}),
  sicklemaw:()=>(Math.random()<0.5
    ?{kind:'weapon',wtype:'sword',rarity:3,unique:true,name:"Sicklemaw's Edge",dmgMin:20,dmgMax:32,value:560,lore:'It reaps. That is all it has ever done.'}
    :{kind:'off',otype:'shield',rarity:3,unique:true,name:'Carapace Bulwark',armor:18,value:560,lore:'Plate that grew, rather than was forged.'}),
};

/* crafting (Nightfall-style: materials + gold at the armorer / weaponsmith) */
const RECIPES=[
  {name:'Istani Blade',     wt:'sword',  off:false, gold:140, mats:{'Chitin Fragment':3,'Bone':2}, icon:'🗡️', desc:'A keen service sword fitted to your level.'},
  {name:'Istani Scepter',   wt:'wand',   off:false, gold:140, mats:{'Plant Fiber':3,'Scale':1}, icon:'🪄', desc:'A channeling rod bound in river-cured scale.'},
  {name:'Dunereach Shield', ot:'shield', off:true,  gold:110, mats:{'Drake Scale':1,'Chitin Fragment':2}, icon:'🛡️', desc:'Drake-scale over chitin plate.'},
  {name:'Tidewater Focus',  ot:'focus',  off:true,  gold:110, mats:{'Scale':2,'Plant Fiber':1}, icon:'🔮', desc:'Hums faintly when the tide turns.'},
];
const matCount=n=>player.inv.filter(i=>i.kind==='mat'&&i.name===n).length;
function takeMats(n,c){ for(let k=0;k<c;k++){ const i=player.inv.findIndex(it=>it.kind==='mat'&&it.name===n); if(i>=0) player.inv.splice(i,1); } }
function craftRecipe(i){
  const r=RECIPES[i]; if(!r) return false;
  if(player.gold<r.gold){ toast('Not enough gold'); return false; }
  for(const m in r.mats) if(matCount(m)<r.mats[m]){ toast('Missing materials: '+m); return false; }
  player.gold-=r.gold;
  for(const m in r.mats) takeMats(m,r.mats[m]);
  const it=r.off?genOff(r.ot,player.lvl,2):genW(r.wt,player.lvl,2);
  it.name=r.name;
  giveItem(it);
  saveGame();
  return true;
}

/* ---------------- entities ---------------- */
const enemies=[], drops=[], projectiles=[], effects=[], ftexts=[];
const npcs=[];
let player, hench, npcAldra, npcSuki; // npcAldra/npcSuki kept as aliases into npcs

function makePlayer(){
  const p=findOpen(13,77);
  return {
    kind:'player', name:'Kaelen', team:0, x:p.x, y:p.y, r:13, face:0,
    cls:'warrior', enRegen:1.33, adr:0,
    inv:[], equip:{weapon:{kind:'weapon',wtype:'sword',rarity:0,name:'Training Sword',dmgMin:10,dmgMax:16,value:0}, off:null},
    attrs:{}, attrPts:0, skillPts:1,
    promo:0, bounty:null, vault:[],
    known:{warrior:[...DEFAULT_BARS.warrior,'cap'], elementalist:[...DEFAULT_BARS.elementalist,'cap']},
    bars:{warrior:[...DEFAULT_BARS.warrior], elementalist:[...DEFAULT_BARS.elementalist]},
    lvl:1, xp:0, gold:0, dp:0,
    baseHp:100, baseEn:30, hp:100, en:30,
    dmgMin:12, dmgMax:18, atkInt:1.2, range:MELEE_RANGE, speed:130,
    nextAtk:0, target:null, engaged:false, moveTo:null, approach:null,
    cond:{}, buffs:{}, dead:false, lastCombat:-99,
    skillReady:new Array(8).fill(0),
  };
}
const pMaxHp=()=>Math.round(player.baseHp*(1-player.dp));
const pMaxEn=()=>Math.round((player.baseEn+3*(player.attrs['Energy Storage']||0)
  +((player.equip.off&&player.equip.off.energy)||0)
  +(player.equip.weapon.energy||0))*(1-player.dp));

function makeHench(){
  const p=findOpen(12,79);
  return {
    kind:'hench', name:'Lyra', team:0, x:p.x, y:p.y, r:12, face:0, lvl:2,
    maxHp:110, hp:110, dmgMin:9, dmgMax:14, atkInt:1.5, range:240, speed:145,
    nextAtk:0, nextHeal:0, target:null, cond:{}, dead:false, deadAt:0, lastCombat:-99,
    recruited:false,        // joins as a Hero during the primary chain
    stance:'guard',         // guard | aggressive | passive
    flag:null,              // {x,y} hold-position flag, or null to follow
  };
}
const heroActive=()=>hench.recruited&&!hench.dead;
const heroOrPlayer=f=>f===player||(f===hench&&hench.recruited&&!hench.dead);
const party=()=>heroActive()?[player,hench]:[player];

/* Plains-of-Jarin bestiary, grouped into GW1 creature families.
   family is used by Sunward Hunt bounties and collectors. */
const ENEMY_TYPES={
  // --- Skales (amphibious river reptiles) ---
  skale:   {name:'Ridgeback Skale', family:'skale', lvl:2, hp:70, dmgMin:7,dmgMax:11, atkInt:1.5, range:MELEE_RANGE, speed:90, r:12, color:'#3a8a7a', gold:[3,9], trophy:'Skale Fin', mat:'Scale'},
  skaleCaster:{name:'Skale Blighter', family:'skale', lvl:4, hp:95, dmgMin:9,dmgMax:14, atkInt:2.0, range:280, speed:90, r:12, color:'#2a7a86', gold:[6,14], trophy:'Skale Fin', mat:'Scale', caster:true, healer:true},
  skaleLasher:{name:'Skale Lasher', family:'skale', lvl:6, hp:140, dmgMin:13,dmgMax:19, atkInt:1.2, range:MELEE_RANGE, speed:120, r:13, color:'#1f6a78', gold:[8,16], trophy:'Skale Fin', mat:'Scale'},
  // --- Insects ---
  termite: {name:'Bladed Termite', family:'insect', lvl:4, hp:85, dmgMin:10,dmgMax:15, atkInt:0.9, range:MELEE_RANGE, speed:170, r:11, color:'#6a5a30', gold:[4,10], trophy:'Insect Carapace', mat:'Chitin Fragment'},
  spider:  {name:'Stalking Nephila', family:'insect', lvl:3, hp:75, dmgMin:8,dmgMax:12, atkInt:1.6, range:250, speed:130, r:12, color:'#3a2a3a', gold:[4,10], trophy:'Insect Carapace', mat:'Chitin Fragment', caster:true, poison:true},
  lance:   {name:'Preying Lance', family:'insect', lvl:6, hp:130, dmgMin:13,dmgMax:20, atkInt:1.3, range:MELEE_RANGE, speed:150, r:13, color:'#7a6a28', gold:[7,15], trophy:'Insect Carapace', mat:'Chitin Fragment'},
  // --- Mandragors (burrowing sand-stalkers) ---
  lurker:  {name:'Mandragor Slither', family:'mandragor', lvl:4, hp:110, dmgMin:11,dmgMax:17, atkInt:1.2, range:MELEE_RANGE, speed:140, r:13, color:'#9a7a4a', gold:[5,12], trophy:'Mandragor Pincer', mat:'Bone', burrow:true},
  lurkerImp:{name:'Mandragor Imp', family:'mandragor', lvl:4, hp:90, dmgMin:9,dmgMax:14, atkInt:1.9, range:270, speed:120, r:12, color:'#b89860', gold:[5,12], trophy:'Mandragor Pincer', mat:'Bone', caster:true, burrow:true},
  // --- Plants ---
  iboga:   {name:'Fanged Iboga', family:'plant', lvl:5, hp:120, dmgMin:11,dmgMax:16, atkInt:1.5, range:MELEE_RANGE, speed:0, r:14, color:'#7a3a4a', gold:[5,12], trophy:'Iboga Petal', mat:'Plant Fiber', rooted:true, poison:true},
  jacaranda:{name:'Stormseed Jacaranda', family:'plant', lvl:5, hp:115, dmgMin:12,dmgMax:18, atkInt:2.1, range:300, speed:0, r:14, color:'#4a5ac8', gold:[6,14], trophy:'Iboga Petal', mat:'Plant Fiber', rooted:true, caster:true, beam:true},
  // --- Drakes ---
  drake:   {name:'Irontooth Drake', family:'drake', lvl:8, hp:280, dmgMin:16,dmgMax:24, atkInt:1.4, range:MELEE_RANGE, speed:120, r:16, color:'#5a6a3a', gold:[14,28], trophy:'Drake Tooth', mat:'Drake Scale', firebreath:true},
  // --- field bosses (green drops + capturable elite via Signet of Capture) ---
  lurkerBoss:{name:'Karesh Duneshaper', family:'mandragor', lvl:7, hp:420, dmgMin:16,dmgMax:24, atkInt:1.1, range:MELEE_RANGE, speed:150, r:16, color:'#b07838', gold:[80,140], boss:true, unique:'duneshaper', elite:'el_aegis', mat:'Bone', burrow:true},
  jacarandaBoss:{name:'Old Galewither', family:'plant', lvl:5, hp:360, dmgMin:14,dmgMax:22, atkInt:1.7, range:300, speed:0, r:16, color:'#5a4ad8', gold:[80,140], boss:true, unique:'galewither', elite:'el_storm', mat:'Plant Fiber', rooted:true, caster:true, beam:true},
  lanceBoss:{name:'Sicklemaw the Reaper', family:'insect', lvl:6, hp:400, dmgMin:16,dmgMax:24, atkInt:1.1, range:MELEE_RANGE, speed:160, r:15, color:'#a08828', gold:[80,140], boss:true, unique:'sicklemaw', elite:'el_rake', mat:'Chitin Fragment'},
};

function spawnEnemy(type,tx,ty){
  const t=ENEMY_TYPES[type], p=findOpen(tx,ty);
  const e={
    kind:'enemy', type, ...t, team:1, x:p.x, y:p.y, sx:p.x, sy:p.y, face:0,
    maxHp:t.hp, nextAtk:0, target:null, state:t.burrow?'burrowed':'idle', hidden:!!t.burrow,
    wx:p.x, wy:p.y, wanderT:rand(1,4), cond:{}, dead:false, respawnAt:0,
    nextAoe:0, lastCombat:-99,
  };
  enemies.push(e); return e;
}

function spawnGroup(list,cx,cy){
  list.forEach((type,i)=>{
    const a=i/list.length*Math.PI*2;
    spawnEnemy(type,Math.round(cx+Math.cos(a)*2),Math.round(cy+Math.sin(a)*2));
  });
}
function spawnNpc(id,name,style,tx,ty,face){
  const p=findOpen(tx,ty);
  const n={kind:'npc', id, name, style, x:p.x, y:p.y, r:13, face:face||0.4};
  npcs.push(n); return n;
}

function spawnTown(){
  // Hall of the Sun (north court): the Order's officers, trainer
  npcAldra=spawnNpc('marshal','Marshal Oyin','aldra',46,11,1.6);
  spawnNpc('trainer','Blademaster Henko','trainer',50,13,2.2);
  spawnNpc('dockmaster','Dockmaster Ahlar','aldra',49,77,2.2);
  // the Grand Bazaar (west)
  npcSuki=spawnNpc('merchant','Merchant Suki','merchant',13,43,-0.4);
  spawnNpc('trader','Trader Kahli','merchant',20,49,-1.4);
  spawnNpc('vault','Vault-keeper Jueh','inn',64,62,-1.6);
  // Artisans' Row (east)
  spawnNpc('smith','Armorer Joska','crafter',64,43,-2.4);
  // plaza flavor
  spawnNpc('noble','Lady Mehana','inn',52,50,-1.6);
}

function spawnWilds(){
  // the resurrection shrine & Order scout (Sunward Hunt bounties + blessing)
  spawnNpc('scout','Sunward Scout','scout',88,46,3.0);
  spawnNpc('collector','Collector Poturi','crafter',84,51,2.6);
  spawnNpc('beastmaster','Beastmaster Yapo','scout',45,44,1.4);

  // --- NORTH: green lakeshore — skales, insects, and rooted plants ---
  spawnGroup(['skale','skale','skaleCaster'],34,24);
  spawnGroup(['skale','skaleLasher','skaleCaster'],46,28);
  spawnGroup(['skale','skale'],30,34);
  spawnGroup(['termite','termite','spider'],58,22);
  spawnGroup(['lance','termite','spider'],62,30);
  spawnEnemy('lanceBoss',64,24);                       // Sicklemaw the Reaper (insect boss)
  spawnGroup(['iboga','jacaranda'],22,18);
  spawnGroup(['iboga','iboga','jacaranda'],18,12);
  spawnEnemy('jacarandaBoss',16,16);                   // Old Galewither (plant boss)

  // --- MID: the river crossroads — mixed skale/insect ---
  spawnGroup(['skale','skaleCaster'],40,44);
  spawnGroup(['termite','lance','spider'],52,40);

  // --- SOUTH: dry dunes — burrowing mandragors and drakes ---
  spawnGroup(['lurker','lurker','lurkerImp'],50,66);
  spawnGroup(['lurker','lurkerImp'],62,70);
  spawnGroup(['lurker','lurker','lurker'],40,72);
  spawnEnemy('drake',26,66);
  spawnEnemy('drake',84,58);
  // the hidden den at the southern rock outcrop: Karesh Duneshaper and guard
  spawnGroup(['lurker','lurker','lurkerImp','lurker'],78,72);
  spawnEnemy('lurkerBoss',78,72);
}

/* ---------------- quests ----------------
   A web of quests: a grounded story chain (someone is strangling Sunmere's
   trade) plus side work from the townsfolk. State in `qs`:
   qs[id] = {st:'a'(active)|'r'(ready)|'t'(turned in), n, seen[]}      ---- */
const qs={};
const anyFoe=e=>true;
const QDEFS=[
  // ---- primary chain: THE DUNEREACH ----
  {id:'s1', story:1, giver:'marshal', name:'Answer the Summons', kind:'talk', targets:['dockmaster','merchant'], need:2,
   offer:'Welcome to Sunmere, recruit — Jewel of the Coast, and the last calm harbor before the deep desert. Before the Order spends you on the Dunereach, learn the city. Speak with Dockmaster Ahlar on the pier and Merchant Suki in the bazaar, then report back.',
   prog:'Dockmaster Ahlar is on the central pier; Merchant Suki keeps the west bazaar.',
   turnin:'Ahlar says the caravans out of the Dunereach have stopped, and Suki\'s shelves show it. The plain has grown teeth again. Time you grew some too.', xp:120, gold:60},
  {id:'s2', story:2, giver:'marshal', prereq:['s1'], name:'Honing Your Skills', kind:'talk', targets:['trainer'], need:1,
   offer:'No one walks the Dunereach alone and unproven. Train your forms with Blademaster Henko at the board, then return — I have someone for you to meet.',
   prog:'Speak with Blademaster Henko in the Hall of the Sun.',
   turnin:'Henko says you\'ll do. Good — because you won\'t be going out there alone. This is Lyra, a Mender of the Order and the first of your Heroes. She answers to you now: set her stance and her flag from the Party panel. Take her, and take the east gate to the Dunereach.',
   xp:200, gold:80, sp:1, recruit:true},
  {id:'s3', story:3, giver:'marshal', prereq:['s2'], name:'Trial by Fire', kind:'kill', match:e=>true, need:6,
   offer:'The Dunereach lies east. Skale haunt the lake in the north; mandragors burrow the southern dunes; insects and plants between. Cut down six of anything out there and prove you can hold the road.',
   prog:'Slay any six creatures in the Dunereach (east gate).',
   turnin:'Six, and back on your feet. The Order can use you. Speak with the Scout at the shrine out there — she keeps the Sunward Hunts, and the honor that comes with them.', xp:350, gold:140, sp:1},
  {id:'s4', story:4, giver:'marshal', prereq:['s3'], name:'The Reaper in the Reeds', kind:'kill', match:e=>e.type==='lanceBoss', need:1,
   offer:'A great mantis the scouts call Sicklemaw has nested in the northern reeds and the lake road is shut for it. End it. And bring your Signet of Capture — a beast like that knows a technique worth taking.',
   prog:'Sicklemaw the Reaper nests in the northern reeds of the Dunereach.',
   turnin:'The lake road breathes again. If you struck it with the Signet, that elite form is yours to learn — wear it well.', xp:450, gold:220, sp:1},
  {id:'s5', story:5, giver:'marshal', prereq:['s4'], name:'The Storm in the Grove', kind:'kill', match:e=>e.type==='jacarandaBoss', need:1,
   offer:'An ancient stormseed — Old Galewither — has rooted in the west grove and throws lightning at anything that moves. Burn it out before it spreads.',
   prog:'Old Galewither is rooted in the western grove of the Dunereach.',
   turnin:'Good. The grove cools. One trouble left, and it is the worst of them — under the south dunes.', xp:500, gold:260, sp:1},
  {id:'s6', story:6, giver:'marshal', prereq:['s5'], name:'What Moves the Sand', kind:'kill', match:e=>e.type==='lurkerBoss', need:1,
   offer:'The caravans didn\'t stop for skale or thorns. Something *moves the dunes* — a mandragor the size of a wagon the diggers name Karesh Duneshaper, denned in the southern rocks. It will erupt from under you. End it, and the road to the desert opens.',
   prog:'Karesh Duneshaper dens beneath the southern rock outcrop. Mind the ground.',
   turnin:'Slain — and the sand lies still. The Dunereach is the Order\'s again, and so is the road beyond. Kneel, recruit. Rise, Spear of the Sun.',
   xp:900, gold:450, sp:2, item:()=>makeEquip(10,3), final:true},
  // ---- side work ----
  {id:'b1', giver:'beastmaster', name:'Thin the Drakes', kind:'kill', match:e=>e.type==='drake', need:2,
   offer:'Irontooth drakes are coming up out of the south dunes and they cook a man in his armor. Put two of them down and the herders will sing your name.',
   prog:'Irontooth Drakes roam the southern dunes of the Dunereach.',
   turnin:'Two drakes! Hah — the dunes are quieter already. Here, with the herders\' thanks.', xp:300, gold:200},
  {id:'d1', giver:'dockmaster', name:'Lost Shipment', kind:'kill', match:e=>e.family==='skale', need:5,
   offer:'A barge of dye and cloth went down at the lake mouth and skale have nested in the wreck. Clear five of them and I can send divers for the crates.',
   prog:'Skale haunt the northern lake of the Dunereach.',
   turnin:'Divers are away. You\'ll see that cloth in Suki\'s stall within the week — at a markup, knowing her.', xp:240, gold:160},
  {id:'n1', giver:'noble', name:'A Matter of Pride', kind:'kill', match:e=>e.family==='insect', need:6,
   offer:'My family\'s estate on the lakeshore is overrun with bladed termites — they\'re eating the *furniture*. Six of the horrid things, and you\'ll have a noble\'s gratitude.',
   prog:'Bladed termites and their kin swarm the northern Dunereach.',
   turnin:'The estate is saveable, thank the gods. A noble pays her debts — take it.', xp:240, gold:200},
  {id:'h1', giver:'trainer', name:'Prove Your Form', kind:'kill', match:e=>true, need:3,
   offer:'Forms in a courtyard prove nothing. Put down three real creatures in the Dunereach, then come back and we\'ll talk like professionals.',
   prog:'Slay any three creatures in the Dunereach.',
   turnin:'Acceptable. Rough, but acceptable. Here — a skill point. Spend it at my board.', xp:180, gold:60, sp:1},
];
const QBY={}; for(const q of QDEFS) QBY[q.id]=q;
const qTurned=id=>qs[id]&&qs[id].st==='t';
const qAvailable=q=>!qs[q.id]&&(q.prereq||[]).every(qTurned);
const qActive=q=>qs[q.id]&&qs[q.id].st==='a';
const qReady=q=>qs[q.id]&&qs[q.id].st==='r';

function acceptQuest(q){
  qs[q.id]={st:q.need>0?'a':'r', n:0, seen:[]};
  toast('Quest accepted: '+q.name);
  saveGame();
}
function completeQuest(q){
  qs[q.id].st='t';
  giveXp(q.xp||0); player.gold+=q.gold||0;
  if(q.sp){ player.skillPts=(player.skillPts||0)+q.sp; toast('+'+q.sp+' skill point'+(q.sp>1?'s':'')); }
  if(q.item) giveItem(q.item());
  if(q.recruit&&!hench.recruited){ recruitHero(); }
  clearDp();
  if(q.final) banner('SPEAR OF THE SUN','the dunereach is yours');
  saveGame();
}
function recruitHero(){
  hench.recruited=true; hench.dead=false; hench.hp=hench.maxHp; hench.stance='guard';
  const p=findOpen(Math.floor(player.x/TILE),Math.floor(player.y/TILE)+1);
  hench.x=p.x; hench.y=p.y;
  toast('Lyra has joined you as a Hero — set her stance in the Party panel (👥).');
  if(HAS3D&&hench.av){ scene.remove(hench.av); hench.av=null; }
}
function questCredit(e){
  for(const q of QDEFS){
    if(q.kind!=='kill'||!qActive(q)||!q.match(e)) continue;
    const st=qs[q.id];
    st.n++;
    if(st.n>=q.need){
      st.st='r';
      toast(q.name+' — return to '+npcName(q.giver));
    } else toast(`${q.name}: ${st.n}/${q.need}`);
  }
}
function talkCredit(npcId){
  for(const q of QDEFS){
    if(q.kind!=='talk'||!qActive(q)) continue;
    const st=qs[q.id];
    if(q.targets.includes(npcId)&&!st.seen.includes(npcId)){
      st.seen.push(npcId); st.n=st.seen.length;
      if(st.n>=q.need){ st.st='r'; toast(q.name+' — report to '+npcName(q.giver)); }
      else toast(`${q.name}: ${st.n}/${q.need}`);
    }
  }
}
const NPC_NAMES={marshal:'Marshal Oyin',trainer:'Blademaster Henko',dockmaster:'Dockmaster Ahlar',merchant:'Merchant Suki',trader:'Trader Kahli',vault:'Vault-keeper Jueh',smith:'Armorer Joska',noble:'Lady Mehana',scout:'Sunward Scout',collector:'Collector Poturi',beastmaster:'Beastmaster Yapo'};
const npcName=id=>{const n=npcs.find(n=>n.id===id); return n?n.name:(NPC_NAMES[id]||id);};

function npcMarker(n){
  for(const q of QDEFS) if(q.giver===n.id&&qReady(q)) return '!';
  for(const q of QDEFS) if(q.giver===n.id&&qAvailable(q)) return '!';
  for(const q of QDEFS) if(q.giver===n.id&&qActive(q)) return '?';
  return '';
}
function questTrackerText(){
  const lines=[];
  for(const q of QDEFS){
    if(qReady(q)) lines.push(`<span class="qtitle">${q.name}</span><br>Return to ${npcName(q.giver)} in town.`);
    else if(qActive(q)) lines.push(`<span class="qtitle">${q.name}</span><br>${q.kind==='kill'?`${qs[q.id].n}/${q.need} — `:''}${q.prog}`);
    if(lines.length>=2) break;
  }
  if(!lines.length){
    if(qTurned('s6')) return '<span class="qtitle">The Dunereach</span><br>The plain is yours, Spear of the Sun. Hunt the bounties or explore at will.';
    return '<span class="qtitle">Sunmere</span><br>Speak with Marshal Oyin in the Hall of the Sun.';
  }
  return lines.join('<br>');
}

/* per-NPC dialog: turn-ins first, then offers, then services/flavor */
function npcDialog(n){
  talkCredit(n.id);
  for(const q of QDEFS){
    if(q.giver!==n.id) continue;
    if(qReady(q)) return {text:q.turnin,
      btn:`Turn in (+${q.xp} XP, +${q.gold}g${q.sp?', +'+q.sp+' SP':''})`,
      act(){ completeQuest(q); }};
  }
  for(const q of QDEFS){
    if(q.giver!==n.id||!qAvailable(q)) continue;
    if(q.kind==='final') continue; // auto-accepted by the chain
    return {text:q.offer, btn:'Accept: '+q.name, act(){ acceptQuest(q); }};
  }
  for(const q of QDEFS){
    if(q.giver===n.id&&qActive(q)) return {text:q.prog, btn:`${q.name}: ${qs[q.id].n}/${q.need}`, act(){}};
  }
  // services & flavor
  switch(n.id){
    case 'merchant': return {text:'Finest goods in Sunmere, traveler. I buy trophies and salvage at a fair price, and sell what the caravans bring — when they bring it.', btn:'Browse wares', act(){ openModal('merch'); }};
    case 'smith': return {text:'Bring me chitin, scale, bone and good drake-hide and I\'ll forge you something the armory would envy. Materials come off the beasts of the Dunereach.', btn:'Crafting', act(){ openModal('craft'); }};
    case 'trainer': return {text:'Every spear of the Order learns eight forms and masters the few that fit. Gold and a skill point per technique. Elite forms you must take from the beasts themselves — with a Signet of Capture.', btn:'Learn skills', act(){ openModal('train'); }};
    case 'trader': return {text:'Crafting stock, by weight. I buy your raw materials and sell what the artisans need — no haggling.', btn:'Trade materials', act(){ openModal('trade'); }};
    case 'vault': return {text:'The Order keeps a strongbox for its spears — yours travels with you to any city. Store what you can\'t carry.', btn:'Open vault', act(){ openModal('vault'); }};
    case 'dockmaster': return {text:'Caravans out of the Dunereach? Stopped cold, a month past. Whatever\'s out there, it eats merchants.', btn:'Farewell', act(){}};
    case 'noble': return {text:'A new spear, how quaint. Do be careful in the desert — the Order keeps losing them.', btn:'Farewell', act(){}};
    case 'collector': return {text:'I trade fair gear for the spoils of the plain — fins, carapace, pincers, petals, drake-teeth. Show me what you\'ve gathered.', btn:'Collector trades', act(){ openModal('collect'); }};
    case 'beastmaster': return {text:'The Dunereach is mine to know — every burrow and nest. Watch the south dunes; the ground there is a lie. The shrine behind me will catch you if you fall.', btn:'Farewell', act(){}};
    case 'scout': return scoutDialog();
    default: return {text:'The Order holds, recruit.', btn:'Farewell', act(){}};
  }
}

/* ---------------- Sunward Hunts (bounties) & promotion rank ---------------- */
const BOUNTIES={
  skale:    {name:'Skale Hunt',     goal:8},
  insect:   {name:'Insect Hunt',    goal:8},
  mandragor:{name:'Mandragor Hunt', goal:8},
  plant:    {name:'Plant Hunt',     goal:6},
  drake:    {name:'Drake Hunt',     goal:4},
};
const RANKS=[[0,'Recruit'],[150,'Spearbearer'],[450,'Vanguard'],[1000,'Castellan'],[2200,'Champion of the Sun']];
function rankTitle(){ let t=RANKS[0][1]; for(const [n,nm] of RANKS) if((player.promo||0)>=n) t=nm; return t; }
function rankNext(){ for(const [n,nm] of RANKS) if((player.promo||0)<n) return {at:n,name:nm}; return null; }
function startBounty(fam){
  player.bounty={family:fam,n:0,goal:BOUNTIES[fam].goal};
  toast(BOUNTIES[fam].name+' begun — slay '+BOUNTIES[fam].goal+' for Sunward Honor'); saveGame();
}
function bountyCredit(e){
  const b=player.bounty;
  if(!b||!b.family||e.family!==b.family) return;
  b.n++;
  const pts=8+e.lvl*2; player.promo=(player.promo||0)+pts;
  ftext(player.x,player.y-14,'+'+pts+' Honor','#ffd34d',12);
  if(b.n>=b.goal){
    player.promo+=80; giveXp(60);
    toast(BOUNTIES[b.family].name+' complete! +80 Sunward Honor');
    player.bounty=null;
  }
  saveGame();
}
function scoutDialog(){
  const b=player.bounty;
  if(b&&b.family) return {text:`Your ${BOUNTIES[b.family].name} stands at ${b.n}/${b.goal}. Honor to the Order. You are ranked: ${rankTitle()}.`,
    btn:'Abandon this hunt', act(){ player.bounty=null; toast('Hunt abandoned'); saveGame(); }};
  return {text:`The Order rewards those who cull the Dunereach. Take a Sunward Hunt — every kill of the named kind earns Honor toward your rank. You are: ${rankTitle()}.`,
    btn:'Choose a hunt', act(){ openModal('bounty'); }};
}

/* ---------------- elite skill capture ---------------- */
function tryCapture(){
  let best=null,bd=220;
  for(const e of enemies){
    if(e.dead&&e.boss&&e.elite&&!e.captured){
      const d=dist(player.x,player.y,e.x,e.y);
      if(d<bd){best=e;bd=d;}
    }
  }
  if(!best){ toast('No fallen boss near enough to capture from'); return false; }
  best.captured=true;
  const id=best.elite, sk=SKILL_BY_ID[id];
  for(const cls of ['warrior','elementalist']) if(!player.known[cls].includes(id)) player.known[cls].push(id);
  effects.push({type:'res',x:player.x,y:player.y,t:now,dur:0.9});
  banner('ELITE CAPTURED',sk.name);
  toast('Learned elite: '+sk.name+' — slot it in town (✨ Skills).');
  saveGame(); return true;
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
function maxHpOf(e){
  let m=e===player?pMaxHp():e.maxHp;
  if(condActive(e,'deepwound')) m=Math.round(m*0.8); // GW1 Deep Wound
  return m;
}

function rollDmg(a){
  if(a===player){
    const w=player.equip.weapon;
    const wAttr=player.cls==='warrior'?'Swordsmanship':'Fire Magic';
    return Math.round(irand(w.dmgMin,w.dmgMax)*(1+0.02*attr(wAttr)));
  }
  return irand(a.dmgMin,a.dmgMax);
}

function applyDamage(src,e,amt,color){
  if(e.dead) return;
  if(e===player){
    if((player.buffs.frenzy||0)>now) amt*=2;            // Frenzy downside
    if((player.buffs.stone||0)>now) amt*=0.6;           // Armor of Earth
    if((player.buffs.brace||0)>now) amt*=0.7;           // Stand Firm
    if((player.buffs.aegis||0)>now) amt*=0.5;           // Duneshaper's Aegis (elite)
    const armor=((player.equip.off&&player.equip.off.armor)||0)+(player.equip.weapon.armor||0)+attr('Strength');
    amt*=Math.max(0.45,1-armor/140);                    // shield + Strength armor
    amt=Math.max(1,Math.round(amt));
    player.adr=Math.min(10,player.adr+0.5);             // adrenaline when struck
  }
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
  const frenzied=a===player&&(player.buffs.frenzy||0)>now;
  a.nextAtk=now+(frenzied?a.atkInt*0.67:a.atkInt);
  if(a===player) player.adr=Math.min(10,player.adr+1); // adrenaline per strike
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
    e.respawnAt=now+(e.boss?150:35);
    if(e.boss){ banner(e.name.toUpperCase(),'has been defeated');
      if(e.elite&&!e.captured) toast('It carried an elite form — strike it with Signet of Capture (📜).'); }
    questCredit(e);
    bountyCredit(e);
    // xp + loot
    giveXp(18+e.lvl*10);
    if(Math.random()<0.65||e.boss){
      drops.push({x:e.x+rand(-10,10),y:e.y+rand(-10,10),gold:irand(e.gold[0],e.gold[1]),t:now});
    }
    if(e.boss){
      // bosses: 35% chance at their unique "green", otherwise a rare
      const it=(e.unique&&Math.random()<0.35)?UNIQUES[e.unique]():makeEquip(e.lvl,2);
      drops.push({x:e.x+rand(-14,14),y:e.y+rand(-14,14),item:it,t:now});
    }
    else if(e.trophy&&Math.random()<0.30) drops.push({x:e.x+rand(-14,14),y:e.y+rand(-14,14),item:makeTrophy(e),t:now});
    else if(e.mat&&Math.random()<0.45) drops.push({x:e.x+rand(-14,14),y:e.y+rand(-14,14),item:makeMat(e.mat),t:now});
    else if(Math.random()<0.08) drops.push({x:e.x+rand(-14,14),y:e.y+rand(-14,14),item:makeEquip(e.lvl),t:now});
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
  if(player.lvl>=10){ player.xp=Math.min(player.xp+x,xpNeed()); return; } // GW1-style cap (10 for this campaign)
  player.xp+=x; ftext(player.x,player.y,'+'+x+' XP','#d8c069',12);
  let need=xpNeed();
  while(player.xp>=need&&player.lvl<10){
    player.xp-=need; player.lvl++;
    player.baseHp+=20; player.baseEn+=2;
    player.attrPts+=3; // spend in the Hero panel
    player.skillPts=(player.skillPts||0)+1; // spend at Master Henko
    // Lyra levels with you
    hench.lvl=player.lvl;
    hench.maxHp=110+18*Math.max(0,player.lvl-2);
    hench.dmgMin=9+2*Math.max(0,player.lvl-2); hench.dmgMax=hench.dmgMin+5;
    clearDp(); player.hp=pMaxHp(); player.en=pMaxEn();
    effects.push({type:'levelup',x:player.x,y:player.y,t:now,dur:1.2});
    ftext(player.x,player.y,'LEVEL UP!','#ffe680',20);
    banner('LEVEL '+player.lvl,'+3 attribute points');
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
  if(sk.adr&&player.adr<sk.adr){ toast('Not enough adrenaline — keep swinging'); return; }
  if(player.en<sk.en){ toast('Not enough energy'); return; }
  const t=player.target;
  if(sk.type==='melee'){
    if(!t||t.dead){ toast('Select a target first (tap a foe)'); return; }
    if(dist(player.x,player.y,t.x,t.y)>MELEE_RANGE+t.r+6){ toast('Out of range — get closer'); return; }
  }
  if(sk.type==='ranged'){
    if(!t||t.dead){ toast('Select a target first (tap a foe)'); return; }
    if(dist(player.x,player.y,t.x,t.y)>(sk.range||300)){ toast('Out of range'); return; }
  }
  if(sk.type==='res'){
    if(!hench.dead){ toast('Lyra is alive and well'); return; }
    if(dist(player.x,player.y,hench.x,hench.y)>220){ toast('Move closer to Lyra\'s body'); return; }
  }
  player.en-=sk.en;
  if(sk.adr) player.adr=sk.drainAll?0:player.adr-sk.adr;
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
  SKILLS[i].fx(player.target);
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
      e.dead=false; e.hp=e.maxHp; e.x=e.sx; e.y=e.sy; e.cond={}; e.captured=false;
      if(e.burrow){ e.state='burrowed'; e.hidden=true; } else e.state='idle';
    }
    return;
  }
  tickConds(e,dt); if(e.dead) return;
  if(condActive(e,'stun')) return;

  // burrowing sand-stalkers (mandragors): hidden until the party strays close, then erupt
  if(e.state==='burrowed'){
    e.hidden=true;
    for(const f of party()){
      if(!f.dead&&!inSafeZone(f)&&heroOrPlayer(f)&&dist(e.x,e.y,f.x,f.y)<140){
        e.hidden=false; e.state='chase'; e.target=f;
        effects.push({type:'aoe',x:e.x,y:e.y,t:now,dur:0.45,r:54,color:'#c8a060'});
        for(const o of enemies){ if(o!==e&&!o.dead&&o.state==='burrowed'&&dist(o.x,o.y,e.x,e.y)<SOCIAL_R){ o.hidden=false; o.state='chase'; o.target=f; } }
        break;
      }
    }
    return;
  }

  const leashDist=dist(e.x,e.y,e.sx,e.sy);

  if(e.state==='return'){
    e.hp=Math.min(e.maxHp,e.hp+e.maxHp*0.25*dt);
    moveToward(e,e.sx,e.sy,dt);
    if(dist(e.x,e.y,e.sx,e.sy)<12){ e.hp=e.maxHp; if(e.burrow){e.state='burrowed';e.hidden=true;} else e.state='idle'; }
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
    for(const f of party()){
      if(!f.dead&&!inSafeZone(f)&&dist(e.x,e.y,f.x,f.y)<AGGRO_R){ aggro(e,f); break; }
    }
    return;
  }

  // chase / fight
  const t=e.target;
  if(!t||t.dead||inSafeZone(t)||leashDist>LEASH_R){
    e.target=null; e.state='return'; return;
  }
  // caster support: Skale Mystics (and Ssraja) mend their wounded group, GW1-style
  if(e.healer&&now>=(e.nextHeal||0)){
    let low=null,pct=0.8;
    for(const o of enemies){
      if(o.dead||o===e||o.healer) continue;
      const p2=o.hp/o.maxHp;
      if(p2<pct&&dist(e.x,e.y,o.x,o.y)<280){low=o;pct=p2;}
    }
    if(low){
      e.nextHeal=now+8;
      const heal=35+e.lvl*5;
      low.hp=Math.min(low.maxHp,low.hp+heal);
      ftext(low.x,low.y,'+'+heal,'#70e070',13);
      effects.push({type:'heal',x:low.x,y:low.y,t:now,dur:0.6});
      effects.push({type:'beam',x:e.x,y:e.y,x2:low.x,y2:low.y,t:now,dur:0.35});
      e.nextAtk=Math.max(e.nextAtk,now+1); // casting takes the beat
    }
  }
  const d=dist(e.x,e.y,t.x,t.y);
  const reach=e.range+t.r;
  if(d>reach) moveToward(e,t.x,t.y,dt);
  else if(now>=e.nextAtk){
    e.nextAtk=now+e.atkInt;
    if(e.beam){ // Windcaller: instant lightning, periodic crippling gale
      e.face=Math.atan2(t.y-e.y,t.x-e.x);
      effects.push({type:'beam',x:e.x,y:e.y,x2:t.x,y2:t.y,t:now,dur:0.25});
      applyDamage(e,t,rollDmg(e),'#ffe860');
      if(now>=(e.nextGale||0)&&!t.dead){
        e.nextGale=now+9;
        addCond(t,'cripple',5);
        ftext(t.x,t.y,'Gale!','#8ad8ff',12);
      }
    } else if(e.range>MELEE_RANGE){ // archers & skale bolts
      e.face=Math.atan2(t.y-e.y,t.x-e.x);
      fireProjectile(e,t,rollDmg(e),e.caster?'#6ad8d0':'#d8c069');
    } else {
      meleeAttack(e,t,0);
    }
  }
  // boss whirl (melee bosses)
  if(e.boss&&!e.rooted&&!e.beam&&now>=e.nextAoe&&d<110){
    e.nextAoe=now+8;
    e.whirlT=now; // drives the spin animation
    effects.push({type:'aoe',x:e.x,y:e.y,t:now,dur:0.4,r:95,color:'#ff5030'});
    for(const f of party()){
      if(!f.dead&&dist(e.x,e.y,f.x,f.y)<95+f.r) applyDamage(e,f,30,'#ff5030');
    }
  }
  // Irontooth Drakes: a periodic gout of fire that scorches everyone near
  if(e.firebreath&&now>=e.nextAoe&&d<170){
    e.nextAoe=now+6;
    effects.push({type:'aoe',x:e.x,y:e.y,t:now,dur:0.5,r:110,color:'#ff7020'});
    for(const f of party()){
      if(!f.dead&&dist(e.x,e.y,f.x,f.y)<110+f.r){ applyDamage(e,f,e.lvl*3,'#ff7020'); addCond(f,'burn',3); }
    }
  }
}

function updateHench(dt){
  if(!hench.recruited) return;       // joins as a Hero during the primary chain
  if(hench.dead){
    // a fallen Hero recovers when you reach a safe zone (or use Restore Ally)
    if(inSafeZone(player)&&now-hench.deadAt>3){
      hench.dead=false; hench.hp=hench.maxHp;
      const p=findOpen(Math.floor(player.x/TILE),Math.floor(player.y/TILE)+1);
      hench.x=p.x; hench.y=p.y;
      effects.push({type:'res',x:hench.x,y:hench.y,t:now,dur:0.8});
    }
    return;
  }
  tickConds(hench,dt); if(hench.dead) return;

  // heal (priority — Lyra is a Mender, regardless of stance she always heals)
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

  // anchor: a flag holds position; otherwise the Hero follows the player
  const anchor=hench.flag||player;
  const ax=hench.flag?hench.flag.x:player.x, ay=hench.flag?hench.flag.y:player.y;

  // pick target per AI stance (GW1 Hero behaviour)
  let t=null;
  if(hench.stance!=='passive'){
    if(player.engaged&&player.target&&!player.target.dead) t=player.target;          // assist the player's called target
    else if(hench.target&&!hench.target.dead&&hench.target.kind==='enemy') t=hench.target;
    else if(hench.stance==='aggressive'){                                            // hunt the nearest foe
      let best=null,bd=AGGRO_R;
      for(const e of enemies){ if(e.dead||e.hidden) continue; const d=dist(hench.x,hench.y,e.x,e.y); if(d<bd){best=e;bd=d;} }
      t=best;
    }
    // guard/aggressive won't chase far from their anchor
    if(t&&dist(t.x,t.y,ax,ay)>(hench.stance==='aggressive'?LEASH_R:300)) t=null;
  }
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
  // move to anchor (flag or player)
  const dp=dist(hench.x,hench.y,ax,ay);
  if(dp>(hench.flag?14:90)) moveToward(hench,ax+(hench.flag?0:rand(-20,20)),ay+(hench.flag?0:rand(-20,20)),dt);
  // out-of-combat regen
  if(now-hench.lastCombat>6) hench.hp=Math.min(hench.maxHp,hench.hp+8*dt);
}

/* ---------------- player update ---------------- */
const input={jx:0,jy:0,active:false,keys:{}};

function updatePlayer(dt){
  if(player.dead) return;
  tickConds(player,dt); if(player.dead) return;

  // energy regen (GW1 pips; Elementalist gets extra, energy-storage flavor)
  player.en=Math.min(pMaxEn(),player.en+(player.enRegen||1.33)*dt);
  // adrenaline fades out of combat
  if(now-player.lastCombat>5) player.adr=Math.max(0,player.adr-1.5*dt);
  // out-of-combat hp regen; fast in outpost
  if(inSafeZone(player)) player.hp=Math.min(pMaxHp(),player.hp+15*dt);
  else if(now-player.lastCombat>6) player.hp=Math.min(pMaxHp(),player.hp+8*dt);

  // keyboard
  let kx=0,ky=0;
  if(input.keys[keyFor('up')]||input.keys['arrowup'])ky-=1;
  if(input.keys[keyFor('down')]||input.keys['arrowdown'])ky+=1;
  if(input.keys[keyFor('left')]||input.keys['arrowleft'])kx-=1;
  if(input.keys[keyFor('right')]||input.keys['arrowright'])kx+=1;
  if(input.keys[keyFor('rotL')]) camYaw+=1.7*dt;     // keyboard camera rotate
  if(input.keys[keyFor('rotR')]) camYaw-=1.7*dt;

  // WASD is camera-relative so movement matches the rotated view
  const cs=Math.sin(camYaw), cc=Math.cos(camYaw);
  let mx=ky*cs+kx*cc, my=ky*cc-kx*cs; // keyboard only — touch is tap-to-move
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
    if(dist(player.x,player.y,n.x,n.y)<80){
      player.approach=null;
      if(n.to) travelTo(n.to,MAPID); else openDialog(n);
    }
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
      if(player.range>MELEE_RANGE){ // wand auto-attack (Elementalist)
        player.nextAtk=now+player.atkInt;
        player.face=Math.atan2(t.y-player.y,t.x-player.x);
        fireProjectile(player,t,rollDmg(player),'#d8b8ff');
      } else meleeAttack(player,t,0);
    }
  }

  // pick up loot
  for(let i=drops.length-1;i>=0;i--){
    const g=drops[i];
    if(dist(player.x,player.y,g.x,g.y)<26){
      if(g.gold){
        player.gold+=g.gold;
        ftext(player.x,player.y,'+'+g.gold+'g','#f0d97a',13);
      } else if(g.item){
        if(player.inv.length>=20){
          if(!g.warned){ toast('Inventory full — sell trophies to Suki'); g.warned=true; }
          continue;
        }
        player.inv.push(g.item);
        ftext(player.x,player.y,g.item.name,RARITY_COLORS[g.item.rarity],13);
      }
      drops.splice(i,1);
    } else if(now-g.t>90) drops.splice(i,1);
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
let renderer, scene, camera, terrainMesh, waterMesh, raycaster, worldGroup;
let selRing, moveRing;
const heights=new Float32Array((MAPW+1)*(MAPH+1));
const matCache={};

/* ---------------- character models (KayKit Adventurers, CC0) ---------------- */
const CHAR_MODELS={
  knight:'models/Knight.glb', mage:'models/Mage.glb', barbarian:'models/Barbarian.glb',
  rogue:'models/Rogue.glb', rogueh:'models/Rogue_Hooded.glb',
};
const charLib={};
let modelsReady=false;
function loadCharacterModels(){
  if(!HAS3D||typeof THREE.GLTFLoader==='undefined') return;
  const ldr=new THREE.GLTFLoader();
  let left=Object.keys(CHAR_MODELS).length;
  const done=()=>{ if(--left===0&&Object.keys(charLib).length){
    modelsReady=true; refreshAvatars(); toast('High-detail characters loaded');
  } };
  for(const k of Object.keys(CHAR_MODELS)){
    ldr.load(CHAR_MODELS[k],g=>{
      const box=new THREE.Box3().setFromObject(g.scene);
      charLib[k]={scene:g.scene, clips:g.animations, scale:30/Math.max(1e-3,box.max.y-box.min.y)};
      done();
    },undefined,done); // on error: that model just stays procedural
  }
}
function refreshAvatars(){ // rebuild avatars so they pick up the loaded models
  for(const e of [player,hench,...npcs,...enemies]){
    if(e&&e.av){ scene.remove(e.av); e.av=null; }
  }
}
function gltfAvatar(key,tint,scaleMul){
  const lib=charLib[key];
  if(!lib||!THREE.SkeletonUtils) return null;
  const root=THREE.SkeletonUtils.clone(lib.scene);
  const g=new THREE.Group();
  const inner=new THREE.Group(); g.add(inner); g.userData.inner=inner;
  root.rotation.y=Math.PI/2; // KayKit faces +Z; our forward is +X
  root.scale.setScalar(lib.scale*(scaleMul||1));
  inner.add(root);
  if(tint){
    const t=new THREE.Color(tint);
    root.traverse(o=>{ if(o.isMesh&&o.material){
      o.material=o.material.clone();
      if(o.material.color) o.material.color.lerp(t,0.35);
    }});
  }
  const mixer=new THREE.AnimationMixer(root);
  const find=res=>{ for(const r of res){ const c=lib.clips.find(c=>r.test(c.name)); if(c) return c; } return null; };
  const acts={};
  const def=(n,res)=>{ const c=find(res); if(c) acts[n]=mixer.clipAction(c); };
  def('idle',[/^Idle$/i,/idle/i]);
  def('walk',[/^Walking_A$/i,/walking/i]);
  def('run',[/^Running_A$/i,/running/i]);
  def('attack',[/1H_Melee_Attack_Slice_Diagonal/i,/1H_Melee_Attack/i,/Dualwield_Melee_Attack/i,/2H_Melee_Attack_Chop/i]);
  def('shoot',[/1H_Ranged_Shoot$/i,/Ranged_Shoot/i,/Throw/i]);
  def('cast',[/Spellcast_Shoot/i,/Spellcast_Long/i]);
  def('castLoop',[/Spellcast_Raise/i,/Spellcasting/i]);
  def('spin',[/2H_Melee_Attack_Spin$/i,/Spinning/i]);
  def('death',[/^Death_A$/i,/Death/i]);
  g.userData.gltf={mixer,acts,cur:null,curA:null};
  return g;
}
function playAct(G2,name,once){
  const a=G2.acts[name];
  if(!a||G2.cur===name) return;
  const prev=G2.curA;
  a.reset();
  a.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat, once?1:Infinity);
  a.clampWhenFinished=!!once;
  a.play();
  if(prev&&prev!==a) prev.crossFadeTo(a,0.18,false);
  G2.cur=name; G2.curA=a;
}
function syncGltfAvatar(e,g,ud){
  const gy=heightAt(e.x,e.y);
  const moved=dist(e.x,e.y,ud.lx??e.x,ud.ly??e.y);
  ud.lx=e.x; ud.ly=e.y;
  g.position.set(e.x,gy,e.y);
  g.rotation.y=-e.face;
  const G2=ud.gltf;
  let state;
  const sw=e.nextAtk?e.nextAtk-now:0;
  if(e.dead) state='death';
  else if(e===player&&cast) state=G2.acts.castLoop?'castLoop':'cast';
  else if(e.boss&&e.whirlT&&now-e.whirlT<0.9) state='spin';
  else if(sw>0&&sw>e.atkInt-0.55&&now-e.lastCombat<2){
    state=e.range>MELEE_RANGE
      ? (e.kind==='enemy'&&G2.acts.shoot&&!e.caster?'shoot':(G2.acts.cast?'cast':'attack'))
      : 'attack';
  } else {
    const spd=moved/Math.max(frameDt,0.001);
    state=spd>12?(spd>108?'run':'walk'):'idle';
  }
  if(!G2.acts[state]) state=G2.acts.idle?'idle':G2.cur;
  if(state) playAct(G2,state,state==='death'||state==='attack'||state==='shoot'||state==='cast'||state==='spin');
  G2.mixer.update(frameDt);
  if(ud.aura){
    const p=0.5+Math.sin(now*4)*0.2;
    ud.aura.material.opacity=0.35*p+0.2;
    ud.aura.scale.setScalar(1+Math.sin(now*4)*0.08);
  }
}

function mat(c,extra){
  const key=c+JSON.stringify(extra||{});
  if(!matCache[key]){
    const e=extra||{};
    matCache[key]=new THREE.MeshStandardMaterial({
      color:c, flatShading:e.flat===true, roughness:e.roughness??0.82, metalness:e.metalness??0.0,
      emissive:e.emissive??0x000000, emissiveIntensity:e.emissiveIntensity??1, side:e.side, transparent:e.transparent, opacity:e.opacity});
  }
  return matCache[key];
}
function prim(geo,c,extra){return new THREE.Mesh(geo,mat(c,extra));}
const box3=(w,h,d,c)=>prim(new THREE.BoxGeometry(w,h,d),c);
const cyl3=(rt,rb,h,c,seg)=>prim(new THREE.CylinderGeometry(rt,rb,h,seg||12),c);
const cone3=(r,h,c,seg)=>prim(new THREE.ConeGeometry(r,h,seg||10),c);
const ico3=(r,c,det)=>prim(new THREE.IcosahedronGeometry(r,det??1),c);

function vHeight(vx,vy){
  let water=false, flat=false;
  for(const [tx,ty] of [[vx-1,vy-1],[vx,vy-1],[vx-1,vy],[vx,vy]]){
    const t=T(clamp(tx,0,MAPW-1),clamp(ty,0,MAPH-1));
    if(t===G_WATER||t===G_BRIDGE) water=true;
    else if(t===G_PATH||t===G_DIRT||t===G_SAND) flat=true;
  }
  if(water) return -13;
  if(flat) return 0;
  return Math.sin(vx*0.35)*Math.cos(vy*0.3)*3.5+Math.sin(vx*0.13+1.7)*Math.cos(vy*0.17+0.6)*7;
}
function heightAt(x,z){
  const t=T(Math.floor(x/TILE),Math.floor(z/TILE));
  if(t===G_BRIDGE) return 2.5;
  if(t===G_PATH||t===G_DIRT||t===G_SAND) return 0;
  const gx=clamp(x/TILE,0,MAPW), gz=clamp(z/TILE,0,MAPH);
  const x0=Math.floor(Math.min(gx,MAPW-0.001)), z0=Math.floor(Math.min(gz,MAPH-0.001));
  const fx=gx-x0, fz=gz-z0;
  const H=(a,b)=>heights[b*(MAPW+1)+a];
  return lerp(lerp(H(x0,z0),H(x0+1,z0),fx), lerp(H(x0,z0+1),H(x0+1,z0+1),fx), fz);
}

/* ---------------- procedural textures & PBR materials ---------------- */
const texCache={};
const hx=n=>'#'+(n>>>0).toString(16).padStart(6,'0').slice(-6);
function canvasTex(key,size,draw,rep){
  if(key&&texCache[key]) return texCache[key];
  try{
    const cv=document.createElement('canvas'); cv.width=cv.height=size;
    draw(cv.getContext('2d'),size);
    const t=new THREE.CanvasTexture(cv);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4;
    if(rep) t.repeat.set(rep,rep);
    if(renderer) t.encoding=THREE.sRGBEncoding;
    if(key) texCache[key]=t;
    return t;
  }catch(e){ return null; }
}
// near-white grain that multiplies onto terrain vertex colors
function detailMap(){ return canvasTex('detail',256,(c,s)=>{
  // subtle: heavy speckle hurt readability
  c.fillStyle='#d8d8d8'; c.fillRect(0,0,s,s);
  for(let i=0;i<1400;i++){ const v=185+Math.random()*55|0; c.fillStyle=`rgba(${v},${v},${v},.28)`;
    c.fillRect(Math.random()*s,Math.random()*s,1+Math.random()*2,1+Math.random()*2); }
  for(let i=0;i<160;i++){ c.strokeStyle='rgba(120,120,120,.14)'; c.beginPath();
    const x=Math.random()*s,y=Math.random()*s; c.moveTo(x,y); c.lineTo(x+Math.random()*4-2,y-3-Math.random()*5); c.stroke(); }
},22); }
// tiling normal map from soft random bumps
function bumpNormal(key,size,bumps,strength,rep){ return canvasTex(key,size,(c,s)=>{
  const h=new Float32Array(s*s);
  for(let b=0;b<bumps;b++){ const bx=Math.random()*s,by=Math.random()*s,br=3+Math.random()*13,sg=Math.random()<.5?1:-1;
    for(let y=-br;y<=br;y++)for(let x=-br;x<=br;x++){ const d=Math.hypot(x,y); if(d>br)continue;
      const px=(((bx+x)|0)%s+s)%s, py=(((by+y)|0)%s+s)%s; h[py*s+px]+=sg*(1-d/br); } }
  const H=(x,y)=>h[(((y%s)+s)%s)*s+(((x%s)+s)%s)];
  const img=c.createImageData(s,s), d=img.data;
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){
    const nx=(H(x-1,y)-H(x+1,y))*strength, ny=(H(x,y-1)-H(x,y+1))*strength;
    const len=Math.hypot(nx,ny,1), i=(y*s+x)*4;
    d[i]=(nx/len*.5+.5)*255; d[i+1]=(ny/len*.5+.5)*255; d[i+2]=255/len; d[i+3]=255;
  }
  c.putImageData(img,0,0);
},rep); }
function clothTex(col){ return canvasTex('cloth'+col,128,(c,s)=>{
  c.fillStyle=hx(col); c.fillRect(0,0,s,s);
  c.globalAlpha=.10; for(let i=0;i<s;i+=3){ c.fillStyle='#000'; c.fillRect(i,0,1,s); c.fillStyle='#fff'; c.fillRect(i+1,0,1,s); }
  c.globalAlpha=.07; for(let i=0;i<s;i+=3){ c.fillStyle='#000'; c.fillRect(0,i,s,1); }
  c.globalAlpha=.14; for(let i=0;i<70;i++){ c.fillStyle=Math.random()<.5?'#000':'#fff'; c.fillRect(Math.random()*s,Math.random()*s,2,2); }
  c.globalAlpha=1;
}); }
function metalTex(col){ return canvasTex('metal'+col,128,(c,s)=>{
  c.fillStyle=hx(col); c.fillRect(0,0,s,s);
  for(let i=0;i<s;i+=2){ const a=Math.random()*0.16; c.fillStyle=`rgba(255,255,255,${a})`; c.fillRect(i,0,1,s); }
  c.fillStyle='rgba(255,255,255,.5)'; c.fillRect(0,s*0.18,s,2);
  c.globalAlpha=.2; for(let i=0;i<30;i++){ c.fillStyle='#000'; c.fillRect(Math.random()*s,Math.random()*s,1,2+Math.random()*4); } c.globalAlpha=1;
}); }
function skinTex(col){ return canvasTex('skin'+col,64,(c,s)=>{
  c.fillStyle=hx(col); c.fillRect(0,0,s,s);
  c.globalAlpha=.12; for(let i=0;i<140;i++){ c.fillStyle=Math.random()<.5?'#7a4a2a':'#ffd9b0'; c.beginPath(); c.arc(Math.random()*s,Math.random()*s,1+Math.random()*2,0,7); c.fill(); } c.globalAlpha=1;
}); }
function barkTex(){ return canvasTex('bark',64,(c,s)=>{
  c.fillStyle='#6a4a28'; c.fillRect(0,0,s,s);
  for(let i=0;i<s;i+=2){ const v=70+Math.random()*60|0; c.fillStyle=`rgb(${v},${v*0.7|0},${v*0.4|0})`; c.fillRect(i,0,1+Math.random(),s); }
},1); }
function leafTex(col){ return canvasTex('leaf'+col,128,(c,s)=>{
  c.fillStyle=hx(col); c.fillRect(0,0,s,s);
  for(let i=0;i<260;i++){ const v=Math.random(); c.fillStyle=v<.5?'rgba(0,0,0,.18)':'rgba(255,255,160,.18)';
    c.beginPath(); c.ellipse(Math.random()*s,Math.random()*s,3+Math.random()*5,1.5+Math.random()*2,Math.random()*3,0,7); c.fill(); }
},1); }
// alpha grass card
function grassCardTex(){ return canvasTex('grasscard',128,(c,s)=>{
  c.clearRect(0,0,s,s);
  for(let b=0;b<18;b++){
    const x=10+Math.random()*(s-20), h=s*(0.45+Math.random()*0.5);
    const grad=c.createLinearGradient(0,s,0,s-h);
    grad.addColorStop(0,'#2e5618'); grad.addColorStop(1,'#8cc455');
    c.strokeStyle=grad; c.lineWidth=4+Math.random()*3; c.lineCap='round';
    c.beginPath(); c.moveTo(x,s);
    c.quadraticCurveTo(x+Math.random()*14-7,s-h*0.55,x+Math.random()*22-11,s-h);
    c.stroke();
  }
}); }
function adobeTex(){ return canvasTex('adobe',128,(c,s)=>{
  c.fillStyle='#e8d0a2'; c.fillRect(0,0,s,s);
  c.globalAlpha=.12; for(let i=0;i<200;i++){ c.fillStyle=Math.random()<.5?'#8a6a40':'#fff2d8'; c.fillRect(Math.random()*s,Math.random()*s,2,2); } c.globalAlpha=1;
}); }
function tentTex(col){ return canvasTex('tent'+col,128,(c,s)=>{
  c.fillStyle=hx(col); c.fillRect(0,0,s,s);
  c.globalAlpha=.18; for(let i=0;i<s;i+=10){ c.fillStyle=i%20?'#000':'#fff'; c.fillRect(i,0,5,s); } c.globalAlpha=1;
}); }
function smat(map,o){ o=o||{}; return new THREE.MeshStandardMaterial({
  map:map||null, normalMap:o.normal||null, color:o.color??0xffffff,
  roughness:o.rough??0.82, metalness:o.metal??0.0, flatShading:false,
  emissive:o.emissive??0x000000, emissiveIntensity:o.emissiveIntensity??1,
  transparent:o.transparent, opacity:o.opacity, alphaTest:o.alphaTest,
  side:o.side, vertexColors:o.vertexColors }); }
const CAP=HAS3D&&THREE.CapsuleGeometry?(r,len)=>new THREE.CapsuleGeometry(r,len,6,12):HAS3D?(r,len)=>new THREE.CylinderGeometry(r,r,len+r*2,12):null;

function buildTerrain(){
  worldGroup=new THREE.Group(); scene.add(worldGroup);
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
    const j=(vr()-0.5)*0.025; // tiny jitter only — big readable patches instead of speckle
    if(t===G_PATH){
      if(MAPID==='town'){ col.setHSL(0.10,0.16,0.66+j); if((ix+iy)&1) col.multiplyScalar(0.92); } // pale sandstone paving
      else col.setHSL(0.09,0.46,0.50+j);                         // ochre desert road
    }
    else if(t===G_DIRT) col.setHSL(0.05,0.50,0.36+j);           // Istan red-brown earth
    else if(t===G_WATER||t===G_BRIDGE) col.setHSL(0.55,0.62,0.13); // deep blue seabed
    else if(t===G_ROCK) col.setHSL(0.08,0.10,0.42+j);           // grey crags, cool against the green
    else if(t===G_WALL) col.setHSL(0.09,0.45,0.36+j);
    else if(t===G_SAND) col.setHSL(0.115,0.45,0.66+j);          // warm harbor sand
    else {
      // savanna: smooth large-scale gold↔green patches (value noise, ~8-tile features)
      const n0=0.5+0.5*Math.sin(ix*0.16+Math.sin(iy*0.11)*2.2)*Math.cos(iy*0.13+Math.sin(ix*0.09)*1.8);
      const n=Math.pow(n0,1.7); // green-dominant: Istan is lush, gold is the accent
      col.setHSL(lerp(0.30,0.14,n), lerp(0.55,0.60,n), lerp(0.30,0.42,n)+j);
      // darken grass that borders a road/sand — outlines the paths for readability
      let edge=false;
      for(const [dx2,dy2] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const t2=T(Math.min(ix,MAPW-1)+dx2,Math.min(iy,MAPH-1)+dy2);
        if(t2===G_PATH||t2===G_SAND||t2===G_DIRT){edge=true;break;}
      }
      if(edge) col.multiplyScalar(0.75);
    }
    colors[i*3]=col.r; colors[i*3+1]=col.g; colors[i*3+2]=col.b;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geo.rotateX(-Math.PI/2);
  geo.translate(W/2,0,W/2);
  geo.computeVertexNormals();
  terrainMesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
    vertexColors:true, flatShading:false, roughness:0.95, metalness:0.0,
    normalMap:bumpNormal('terrN',256,900,0.7,40)})); // fine + faint: no visible blotches
  terrainMesh.receiveShadow=true;
  worldGroup.add(terrainMesh);

  // animated water (subdivided, gentle swell)
  const seg=48;
  const wgeo=new THREE.PlaneGeometry(W,W,seg,seg);
  wgeo.rotateX(-Math.PI/2); wgeo.translate(W/2,-5,W/2);
  waterBase=Float32Array.from(wgeo.attributes.position.array);
  waterMesh=new THREE.Mesh(wgeo,new THREE.MeshStandardMaterial({
    color:0x1ea4cc, transparent:true, opacity:0.88, roughness:0.07, metalness:0.5,
    emissive:0x06425e, emissiveIntensity:0.45,
    normalMap:bumpNormal('waterN',128,320,3,40)}));
  waterMesh.receiveShadow=true;
  worldGroup.add(waterMesh);
}
let waterBase;
function animateWater(){
  if(!waterMesh) return;
  const p=waterMesh.geometry.attributes.position, a=p.array, t=now;
  for(let i=0;i<a.length;i+=3){
    const x=waterBase[i], z=waterBase[i+2];
    a[i+1]=waterBase[i+1]+Math.sin(x*0.03+t*1.4)*1.5+Math.cos(z*0.045+t*1.1)*1.5;
  }
  p.needsUpdate=true;
  waterMesh.geometry.computeVertexNormals();
}

// Render the city's G_WALL tiles as sandstone: a continuous perimeter wall,
// blocky buildings for the residential footprints, and domed roofs on the
// interior of each block. Turns the "fenced lot" into a walled port city.
function buildCity(wallP,m4,vr){
  const sand=smat(adobeTex(),{rough:0.92});
  const sandDk=smat(adobeTex(),{color:0xcaa676,rough:0.92});
  const isW=(tx,ty)=>T(tx,ty)===G_WALL;
  const perim=[], bldg=[], domes=[];
  for(const [wx,wz] of wallP){
    const tx=Math.floor(wx/TILE), ty=Math.floor(wz/TILE);
    if(tx===46&&ty===46) continue;                       // fountain plinth handled separately
    if(tx<=4||tx>=MAPW-5||ty<=4){ perim.push([wx,wz]); continue; }
    bldg.push([wx,wz]);
    if(isW(tx-1,ty)&&isW(tx+1,ty)&&isW(tx,ty-1)&&isW(tx,ty+1)) domes.push([wx,wz]);
  }
  const place=(list,geo,mat,y)=>{ if(!list.length) return; const im=new THREE.InstancedMesh(geo,mat,list.length);
    list.forEach((p,i)=>{ m4.makeTranslation(p[0],y,p[1]); im.setMatrixAt(i,m4); }); worldGroup.add(im); return im; };
  place(perim,new THREE.BoxGeometry(TILE+1,26,TILE+1),sand,13);          // city wall
  place(bldg, new THREE.BoxGeometry(TILE+1,34,TILE+1),sandDk,17);        // building masses
  place(domes,new THREE.SphereGeometry(TILE*0.82,12,7,0,Math.PI*2,0,Math.PI/2),
    smat(adobeTex(),{color:0xd8b878,rough:0.9}),34);                     // domed roofs
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
    worldGroup.add(im); return im;
  };
  // trees: palms hug the river, flat-top acacias dot the savanna
  const palmP=[], acaciaP=[];
  for(const p of treeP) (Math.abs(p[0]/TILE-riverCX(p[1]/TILE))<11?palmP:acaciaP).push(p);
  const cc=new THREE.Color();
  const lumpify=(geo,amt)=>{ // displace canopy vertices for a foliage silhouette
    const p=geo.attributes.position; const lr=mulberry32(4242);
    for(let i=0;i<p.count;i++){
      const m2=1+(lr()-0.5)*2*amt;
      p.setXYZ(i,p.getX(i)*m2,p.getY(i)*m2,p.getZ(i)*m2);
    }
    geo.computeVertexNormals(); return geo;
  };
  // acacia: textured bark trunk, dense flattened leaf canopy
  inst(new THREE.CylinderGeometry(1.8,3.4,24,7),smat(barkTex(),{rough:0.95}),acaciaP,
    p=>heightAt(p[0],p[1])+12, ()=>0.9+vr()*0.35);
  const aGeo=lumpify(new THREE.IcosahedronGeometry(18,2),0.22); aGeo.scale(1.4,0.45,1.4);
  const aCan=inst(aGeo,smat(leafTex(0x6aa848),{rough:0.9}),acaciaP,
    p=>heightAt(p[0],p[1])+27, ()=>0.85+vr()*0.45);
  acaciaP.forEach((p,i)=>{ cc.setHSL(0.285+vr()*0.04,0.48,0.44+vr()*0.14); aCan.setColorAt(i,cc); });
  if(aCan.instanceColor) aCan.instanceColor.needsUpdate=true;
  // palm: slim pale trunk, bright spread fronds
  inst(new THREE.CylinderGeometry(1.4,2.4,28,7),smat(barkTex(),{color:0xddc8a8,rough:0.95}),palmP,
    p=>heightAt(p[0],p[1])+14, ()=>0.9+vr()*0.4);
  const pGeo=lumpify(new THREE.IcosahedronGeometry(14,2),0.3); pGeo.scale(1.6,0.32,1.6);
  const pCan=inst(pGeo,smat(leafTex(0x7cc455),{rough:0.85}),palmP,
    p=>heightAt(p[0],p[1])+29, ()=>0.9+vr()*0.4);
  palmP.forEach((p,i)=>{ cc.setHSL(0.315+vr()*0.04,0.52,0.50+vr()*0.14); pCan.setColorAt(i,cc); });
  if(pCan.instanceColor) pCan.instanceColor.needsUpdate=true;
  // G_WALL: sandstone city walls & buildings in town; rough palisade timber elsewhere
  if(MAPID==='town') buildCity(wallP,m4,vr);
  else inst(new THREE.CylinderGeometry(3.4,4.2,30,7),smat(barkTex(),{color:0xc09868,rough:0.95}),wallP,
    ()=>13, ()=>0.9+vr()*0.25);
  // border crags (normal-mapped stone)
  inst(new THREE.DodecahedronGeometry(16,1),
    smat(null,{color:0x8a8276,normal:bumpNormal('rockN',128,220,2.6,3),rough:0.96}),rockP,
    p=>heightAt(p[0],p[1])+6, ()=>0.8+vr()*1.6);
  // bridge planks (single instanced mesh, wood grain)
  if(bridgeP.length){
    const bim=new THREE.InstancedMesh(new THREE.BoxGeometry(TILE,3,TILE),
      smat(barkTex(),{color:0xc89a60,rough:0.9}),bridgeP.length);
    bridgeP.forEach((p,i)=>{ m4.makeTranslation(p[0],1.5,p[1]); bim.setMatrixAt(i,m4); });
    worldGroup.add(bim);
  }

  // shared prop builders
  const tent=(x,z,c,s)=>{
    const t=new THREE.Mesh(new THREE.ConeGeometry(26*(s||1),30*(s||1),11),smat(tentTex(c),{rough:0.92}));
    t.position.set(x,heightAt(x,z)+14*(s||1),z); t.rotation.y=vr()*Math.PI; worldGroup.add(t);
  };
  const hut=(tx,tz,s)=>{
    s=s||1;
    const ax=tx*TILE, az=tz*TILE;
    const adobeM=smat(adobeTex(),{rough:0.95});
    const wall=new THREE.Mesh(new THREE.CylinderGeometry(26*s,28*s,24*s,14),adobeM); wall.position.set(ax,12*s,az); worldGroup.add(wall);
    const dome=new THREE.Mesh(new THREE.SphereGeometry(26*s,14,8,0,Math.PI*2,0,Math.PI/2),smat(adobeTex(),{color:0xe0b888,rough:0.95}));
    dome.position.set(ax,24*s,az); worldGroup.add(dome);
    const door=box3(10*s,14*s,4,0x1f6e7a); door.position.set(ax,7*s,az+26*s); worldGroup.add(door); // teal door, Kamadan accent
  };
  const flagpole=(x,z)=>{
    const pole=cyl3(1.5,1.5,46,0x3a2a14,5); pole.position.set(x,23,z); worldGroup.add(pole);
    const flag=prim(new THREE.PlaneGeometry(20,12),0xb03030,{side:THREE.DoubleSide});
    flag.position.set(x+11,40,z); worldGroup.add(flag);
  };
  const campfire=(x,z)=>{
    const fire=cone3(6,12,0xff8830,5); fire.material=new THREE.MeshPhongMaterial({color:0xff8830,emissive:0xff5510,emissiveIntensity:1,flatShading:true});
    fire.position.set(x,6,z); worldGroup.add(fire);
    const fireLight=new THREE.PointLight(0xff7020,1.1,240); fireLight.position.set(x,22,z); worldGroup.add(fireLight);
  };
  // gate arches (zone exits)
  for(const g of GATES){
    const py=heightAt(g.x,g.y);
    for(const dz of [-52,52]){
      const pl=cyl3(5,6.5,56,0xc8b088,8); pl.position.set(g.x,py+26,g.y+dz); worldGroup.add(pl);
    }
    const lintel=box3(16,8,128,0xb89868); lintel.position.set(g.x,py+56,g.y); worldGroup.add(lintel);
    const glow=new THREE.Mesh(new THREE.RingGeometry(34,42,28),
      new THREE.MeshBasicMaterial({color:0x9fd0ff,transparent:true,opacity:0.45,depthWrite:false}));
    glow.rotation.x=-Math.PI/2; glow.position.set(g.x,py+0.7,g.y); worldGroup.add(glow);
  }

  // resurrection shrine (the respawn point)
  {
    const dais=cyl3(26,30,6,0x7e7a86,12); dais.position.set(SHRINE.x,3,SHRINE.y); worldGroup.add(dais);
    const pil=box3(8,30,8,0x6e6a7a); pil.position.set(SHRINE.x,21,SHRINE.y); worldGroup.add(pil);
    const orb=ico3(6,0xcfe0ff,{emissive:0x88aaff,emissiveIntensity:0.9}); orb.position.set(SHRINE.x,42,SHRINE.y); worldGroup.add(orb);
    const sl=new THREE.PointLight(0x88aaff,0.8,180); sl.position.set(SHRINE.x,46,SHRINE.y); worldGroup.add(sl);
  }

  if(MAPID==='town'){
    // central plaza fountain (on the blocked plinth tile at 46,46)
    const fx2=46.5*TILE, fz2=46.5*TILE;
    const basin=cyl3(24,27,9,0xd8c0a0,16); basin.position.set(fx2,4.5,fz2); worldGroup.add(basin);
    const waterDisc=new THREE.Mesh(new THREE.CircleGeometry(20,18),
      new THREE.MeshStandardMaterial({color:0x1a8aa8,roughness:0.12,metalness:0.4,emissive:0x06323e,emissiveIntensity:0.5}));
    waterDisc.rotation.x=-Math.PI/2; waterDisc.position.set(fx2,9.2,fz2); worldGroup.add(waterDisc);
    const spout=cyl3(3,4,28,0xc8a868,8); spout.position.set(fx2,19,fz2); worldGroup.add(spout);
    const orb=ico3(4,0x9fe0ff,{emissive:0x4aa0d0,emissiveIntensity:0.7}); orb.position.set(fx2,34,fz2); worldGroup.add(orb);
    // the Hall of the Sun: a grand domed hall in the north court (46,14)
    {
      const hx2=46*TILE, hz2=14*TILE, hall=smat(adobeTex(),{rough:0.9});
      const body=new THREE.Mesh(new THREE.BoxGeometry(7*TILE,42,5*TILE),hall); body.position.set(hx2,21,hz2); worldGroup.add(body);
      const dome=new THREE.Mesh(new THREE.SphereGeometry(3.2*TILE,18,10,0,Math.PI*2,0,Math.PI/2),smat(adobeTex(),{color:0xd0b070,rough:0.9}));
      dome.position.set(hx2,42,hz2); worldGroup.add(dome);
      const fin=cone3(5,18,0xc8a020,8); fin.position.set(hx2,42+3.2*TILE,hz2); worldGroup.add(fin);
      for(const dx of [-3.2*TILE,3.2*TILE]) for(const dz of [-2.2*TILE,2.2*TILE]){ // corner columns
        const colmn=cyl3(5,6,46,0xe0caa4,10); colmn.position.set(hx2+dx,23,hz2+dz); worldGroup.add(colmn);
      }
      const door=box3(20,26,4,0x1f6e7a); door.position.set(hx2,13,hz2+2.5*TILE); worldGroup.add(door);
    }
    flagpole(40*TILE,8*TILE); flagpole(52*TILE,8*TILE);
    // the Grand Bazaar: a row of bright market stalls (west)
    const stallC=[0xc83838,0x2a8a96,0xd8b860,0x4858a8,0xc87838,0x6aa848];
    for(let i=0;i<6;i++) tent((11+i*2.3)*TILE,(41+(i%2)*4)*TILE,stallC[i],0.66);
    // Artisans' Row braziers (east)
    campfire(60*TILE,42*TILE); campfire(70*TILE,44*TILE);
    // the three piers: crates, barrels and moored skiffs
    for(const px of [20,48,74]){
      for(let k=0;k<3;k++){ const cr=box3(11,11,11,0x9a7a4a); cr.position.set((px-1+ (k%2?1:-1))*TILE,7,(80+k)*TILE); cr.rotation.y=vr(); worldGroup.add(cr); }
      const boat=new THREE.Mesh(new THREE.SphereGeometry(16,10,6,0,Math.PI*2,0,Math.PI/2),smat(barkTex(),{color:0x8a6a40,rough:0.9}));
      boat.scale.set(0.5,0.4,1.2); boat.rotation.x=Math.PI; boat.position.set(px*TILE+24,5,90*TILE); worldGroup.add(boat);
    }
    // a scatter of potted palms around the plaza rim is handled by the tree pass
  } else {
    // corsair camp dressing + the headwater sluice (Marr's poison works)
    tent(75*TILE,17*TILE,0x5a4434); tent(81*TILE,17*TILE,0x5a4434); tent(81*TILE,23*TILE,0x4a3a44,1.15);
    campfire(78*TILE,20*TILE);
    const sx=85*TILE, sz=11.5*TILE;
    for(const dx of [-20,20]){
      const post=cyl3(3,4,40,0x6a4a22,7); post.position.set(sx+dx,20,sz); worldGroup.add(post);
    }
    const beam=box3(52,6,8,0x6a4a22); beam.position.set(sx,38,sz); worldGroup.add(beam);
    for(let i=0;i<3;i++){
      const barrel=cyl3(7,8,16,0x4a5a3a,10); barrel.position.set(sx-18+i*18,8,sz+16); worldGroup.add(barrel);
    }
    const ooze=new THREE.PointLight(0x70c040,0.7,150); ooze.position.set(sx,20,sz); worldGroup.add(ooze);
  }

  // grass tufts for foreground richness (one instanced draw call)
  const grassP=[];
  for(let y=2;y<MAPH-2;y++)for(let x=2;x<MAPW-2;x++){
    if(T(x,y)===G_GRASS&&vr()<0.16) grassP.push([(x+vr())*TILE,(y+vr())*TILE]);
  }
  const blade=new THREE.PlaneGeometry(14,11); blade.translate(0,5,0);
  const gmesh=new THREE.InstancedMesh(blade,
    smat(grassCardTex(),{alphaTest:0.35,side:THREE.DoubleSide,rough:1}),grassP.length);
  const gcc=new THREE.Color();
  grassP.forEach((p,i)=>{
    const s=0.7+vr()*0.8; vS.set(s*(0.7+vr()*0.6),s,s); vP.set(p[0],heightAt(p[0],p[1]),p[1]);
    q.setFromAxisAngle(up,vr()*6.28); m4.compose(vP,q,vS); gmesh.setMatrixAt(i,m4);
    gcc.setHSL(0.27+vr()*0.06,0.35,0.55+vr()*0.12); gmesh.setColorAt(i,gcc);
  });
  if(gmesh.instanceColor) gmesh.instanceColor.needsUpdate=true;
  worldGroup.add(gmesh);

  // tag larger props as shadow casters (used on High quality)
  scene.traverse(o=>{
    if(o.isMesh&&o!==terrainMesh&&o!==waterMesh&&o!==gmesh) o.userData.shadowCaster=true;
  });

  // selection + move rings
  const ringGeo=new THREE.RingGeometry(0.82,1,28); ringGeo.rotateX(-Math.PI/2);
  selRing=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:0xffd870,transparent:true,opacity:0.9}));
  selRing.visible=false; worldGroup.add(selRing);
  moveRing=new THREE.Mesh(ringGeo.clone(),new THREE.MeshBasicMaterial({color:0xf0d97a,transparent:true,opacity:0.7}));
  moveRing.visible=false; worldGroup.add(moveRing);
}

/* ---------------- avatars (smooth, textured, GW1-leaning) ---------------- */
function humanoid(o){
  const g=new THREE.Group();
  const s=o.scale||1;
  const inner=new THREE.Group(); g.add(inner); g.userData.inner=inner;
  const M=(geo,m)=>new THREE.Mesh(geo,m);
  // materials: woven cloth, brushed metal, mottled skin
  const metal=!!o.metalArmor;
  const armorM=metal?smat(metalTex(o.armor),{rough:0.34,metal:0.72}):smat(clothTex(o.armor),{rough:0.86});
  const trimM=smat(metalTex(o.trim),{rough:0.4,metal:0.6});
  const pantsM=smat(clothTex(o.pants||0x3a2f1c),{rough:0.92});
  const skinM=smat(skinTex(o.skin||0xd8b08a),{rough:0.62});
  const robeM=o.robe?smat(clothTex(o.robe),{rough:0.9}):null;
  // legs / lower
  if(o.robe){
    const robe=M(new THREE.CylinderGeometry(3.0,8.8,18,14),robeM); robe.position.y=9; inner.add(robe);
    g.userData.robe=robe;
  } else {
    g.userData.legs=[];
    for(const z of [-2.7,2.7]){ // hip pivot for the walk cycle
      const lg=CAP(2.0,6.5); lg.translate(0,-5,0);
      const l=M(lg,pantsM); l.position.set(0,10,z); inner.add(l); g.userData.legs.push(l);
      const boot=M(new THREE.SphereGeometry(2.2,8,6),trimM);
      boot.position.set(1.0,-9.6,0); boot.scale.set(1.5,0.8,1); l.add(boot);
    }
  }
  // torso: smooth capsule with a metal/cloth read
  const torso=M(CAP(5.5,7.5),armorM); torso.scale.set(1,1,0.82); torso.position.y=15; inner.add(torso);
  const belt=M(new THREE.CylinderGeometry(5.1,5.5,2.2,14),trimM); belt.position.y=9.9; inner.add(belt);
  // rounded pauldrons
  for(const z of [-6.6,6.6]){
    const sh=M(new THREE.SphereGeometry(3.3,10,8),metal?trimM:armorM);
    sh.position.set(0,20.4,z); sh.scale.set(1.15,0.85,1.15); inner.add(sh);
  }
  // head with a simple face
  const head=M(new THREE.SphereGeometry(4.9,14,12),skinM); head.position.y=25.4; inner.add(head);
  const eyeM=smat(null,{color:0x1a1410,rough:0.3});
  for(const z of [-1.7,1.7]){
    const eye=M(new THREE.SphereGeometry(0.55,6,6),eyeM); eye.position.set(4.2,26.2,z); inner.add(eye);
  }
  if(!o.helm&&!o.hood){ // hair cap
    const hair=M(new THREE.SphereGeometry(5.05,12,8,0,Math.PI*2,0,Math.PI*0.55),
      smat(clothTex(o.hair||0x4a3220),{rough:0.97}));
    hair.position.y=25.8; inner.add(hair);
  }
  if(o.helm){
    const helm=M(new THREE.SphereGeometry(5.35,12,8,0,Math.PI*2,0,Math.PI*0.62),trimM);
    helm.position.y=25.9; inner.add(helm);
    const crest=M(new THREE.BoxGeometry(1.2,4.5,8),smat(clothTex(0xa83030),{rough:0.85}));
    crest.position.y=31.2; inner.add(crest);
  }
  if(o.hood){
    const hood=M(new THREE.ConeGeometry(6.1,9,12),robeM||armorM); hood.position.y=28.3; inner.add(hood);
  }
  // weapon arm (pivot at shoulder, weapon hangs down then swings forward)
  const arm=new THREE.Group(); arm.position.set(2,19.5,6.5); inner.add(arm);
  g.userData.arm=arm;
  const ag=CAP(1.7,6); ag.translate(0,-4.5,0);
  arm.add(M(ag,metal?armorM:skinM));
  if(o.weapon==='sword'||o.weapon==='cleaver'){
    const big=o.weapon==='cleaver';
    const grip=M(new THREE.CylinderGeometry(0.9,0.9,5,8),smat(clothTex(0x3a2a14),{rough:0.9})); grip.position.y=-6; arm.add(grip);
    const guard=M(new THREE.BoxGeometry(1.6,1.2,(big?7:5)),trimM); guard.position.y=-8.5; arm.add(guard);
    const blade=M(new THREE.BoxGeometry(1.2,(big?20:14),(big?5:2.6)),
      smat(metalTex(0xdde2ec),{rough:0.22,metal:0.85}));
    blade.position.y=-8.5-(big?10:7); arm.add(blade);
    arm.rotation.x=Math.PI; // blade up at rest, chop rotates it forward
  } else if(o.weapon==='bow'){
    const bow=M(new THREE.TorusGeometry(8,0.8,6,14,Math.PI*1.15),smat(barkTex(),{color:0xa8854a,rough:0.9}));
    bow.position.y=-6; bow.rotation.z=Math.PI/2-0.6; arm.add(bow);
  } else if(o.weapon==='staff'){
    const staff=M(new THREE.CylinderGeometry(0.9,0.9,28,8),smat(barkTex(),{color:0xa8854a,rough:0.9}));
    staff.position.y=-2; arm.add(staff);
    const tip=M(new THREE.SphereGeometry(2.6,10,8),smat(null,{color:0xb8a0ff,emissive:0x7a55ff,emissiveIntensity:0.9}));
    tip.position.y=12; arm.add(tip);
  } else if(o.weapon==='banner'){
    const pole=M(new THREE.CylinderGeometry(0.9,0.9,34,8),smat(barkTex(),{color:0x6a4a24,rough:0.9})); arm.add(pole);
    const fl=M(new THREE.PlaneGeometry(11,7),smat(clothTex(0xb03030),{side:THREE.DoubleSide,rough:0.9}));
    fl.position.set(0,13,5.5); fl.rotation.y=Math.PI/2; arm.add(fl);
  }
  // off-hand arm (pivot at the shoulder)
  const offArm=new THREE.Group(); offArm.position.set(0,19.5,-6.5); inner.add(offArm);
  const og=CAP(1.7,6); og.translate(0,-4.5,0);
  offArm.add(M(og,metal?armorM:skinM));
  g.userData.offArm=offArm;
  inner.scale.setScalar(s);
  return g;
}
function wolfAvatar(scale){ // sand jackal (scaled up: Greyfang)
  const g=new THREE.Group(); const inner=new THREE.Group(); g.add(inner); g.userData.inner=inner;
  if(scale) inner.scale.setScalar(scale);
  const c=scale?0x8a8a96:0xb09a70, cd=scale?0x6a6a78:0x8a7350;
  const furM=smat(skinTex(c),{rough:0.95}), furD=smat(skinTex(cd),{rough:0.95});
  const M=(geo,m)=>new THREE.Mesh(geo,m);
  const bg=CAP(4.6,9); bg.rotateZ(Math.PI/2);
  const body=M(bg,furM); body.position.y=9.5; inner.add(body);
  const chest=M(new THREE.SphereGeometry(5.4,10,8),furD); chest.position.set(5,10,0); inner.add(chest);
  const head=M(new THREE.SphereGeometry(3.9,10,8),furM); head.position.set(11.5,13,0); inner.add(head);
  const sg=CAP(1.6,3); sg.rotateZ(Math.PI/2);
  const snout=M(sg,furD); snout.position.set(15.5,11.6,0); inner.add(snout);
  const eyeM=smat(null,{color:0x181008,rough:0.3});
  for(const z of [-1.6,1.6]){ const eye=M(new THREE.SphereGeometry(0.5,6,6),eyeM); eye.position.set(14.4,13.8,z); inner.add(eye); }
  const e1=cone3(1.5,3.4,cd,6); e1.position.set(10,17.4,-2.2); inner.add(e1);
  const e2=cone3(1.5,3.4,cd,6); e2.position.set(10,17.4,2.2); inner.add(e2);
  const tg=CAP(1.1,6); tg.rotateZ(Math.PI/2);
  const tail=M(tg,furD); tail.position.set(-11,12,0); tail.rotation.z=0.5; inner.add(tail);
  g.userData.tail=tail;
  g.userData.legs=[];
  for(const [lx,lz] of [[5,-3],[5,3],[-5,-3],[-5,3]]){
    const leg=box3(2.4,7,2.4,cd); leg.geometry.translate(0,-3.5,0);
    leg.position.set(lx,7,lz); inner.add(leg); g.userData.legs.push(leg);
  }
  return g;
}
function skaleAvatar(scale){
  const g=new THREE.Group(); const inner=new THREE.Group(); g.add(inner); g.userData.inner=inner;
  if(scale) inner.scale.setScalar(scale);
  const c=scale?0x1a9a8a:0x3a8a7a, cd=scale?0x14776a:0x2a6a5e;
  const hideM=smat(skinTex(c),{rough:0.45}), hideD=smat(skinTex(cd),{rough:0.5}); // wet sheen
  const M=(geo,m)=>new THREE.Mesh(geo,m);
  const body=M(new THREE.SphereGeometry(9,14,10),hideM);
  body.scale.set(1.35,0.75,1); body.position.y=7; inner.add(body);
  const head=M(new THREE.ConeGeometry(4.5,9,10),hideD); head.position.set(13,7,0); head.rotation.z=-Math.PI/2; inner.add(head);
  const eyeM=smat(null,{color:0xffe080,emissive:0x806020,rough:0.3});
  for(const z of [-2.4,2.4]){ const eye=M(new THREE.SphereGeometry(0.7,6,6),eyeM); eye.position.set(11.5,9.4,z); inner.add(eye); }
  const tail=M(new THREE.ConeGeometry(3.4,13,10),hideD); tail.position.set(-13,6,0); tail.rotation.z=Math.PI/2; inner.add(tail);
  g.userData.tail=tail;
  const fin=M(new THREE.ConeGeometry(3,6,8),hideD); fin.position.set(0,14,0); inner.add(fin);
  return g;
}
function bugAvatar(kind,scale){
  const g=new THREE.Group(); const inner=new THREE.Group(); g.add(inner); g.userData.inner=inner;
  if(scale) inner.scale.setScalar(scale);
  const c=kind==='spider'?0x352338:kind==='lance'?0x7a6a28:0x6a5a30, cd=kind==='spider'?0x201620:0x46390f;
  const M=(geo,col)=>new THREE.Mesh(geo,smat(skinTex(col),{rough:0.5,metal:0.25}));
  const ab=M(new THREE.SphereGeometry(7,12,10),c); ab.scale.set(1.1,0.8,1.2); ab.position.set(-6,7,0); inner.add(ab);
  const th=M(new THREE.SphereGeometry(5,12,10),cd); th.position.set(4,7,0); inner.add(th);
  const hd=M(new THREE.SphereGeometry(3.4,10,8),c); hd.position.set(11,7,0); inner.add(hd);
  if(kind==='lance'){ const l=M(new THREE.ConeGeometry(1.3,13,6),cd); l.position.set(19,8,0); l.rotation.z=-Math.PI/2; inner.add(l); }
  else for(const z of [-1.8,1.8]){ const md=M(new THREE.ConeGeometry(1,4,5),cd); md.position.set(14,7,z); md.rotation.z=-Math.PI/2; inner.add(md); }
  const eyeM=smat(null,{color:0xff3030,emissive:0x801010,rough:0.3});
  for(const z of [-1.6,1.6]){ const eye=new THREE.Mesh(new THREE.SphereGeometry(0.6,6,6),eyeM); eye.position.set(12.6,8.4,z); inner.add(eye); }
  g.userData.legs=[];
  for(const lx of [-2,4]) for(const z of [-5.5,5.5]){
    const leg=box3(1.1,7,1.1,cd); leg.geometry.translate(0,-3.5,0); leg.position.set(lx,7,z); inner.add(leg); g.userData.legs.push(leg);
  }
  return g;
}
function mandragorAvatar(scale){
  const g=new THREE.Group(); const inner=new THREE.Group(); g.add(inner); g.userData.inner=inner;
  if(scale) inner.scale.setScalar(scale);
  const c=0x9a7a4a, cd=0x6a5230;
  const M=(geo,col)=>new THREE.Mesh(geo,smat(skinTex(col),{rough:0.88}));
  const body=M(new THREE.SphereGeometry(9,12,10),c); body.scale.set(1.3,0.7,1.1); body.position.y=7; inner.add(body);
  const head=M(new THREE.SphereGeometry(4,10,8),cd); head.position.set(9,7,0); inner.add(head);
  const arm=new THREE.Group(); arm.position.set(8,7,6); inner.add(arm); g.userData.arm=arm;
  const claw=M(new THREE.ConeGeometry(3,10,6),cd); claw.position.set(5,0,0); claw.rotation.z=-Math.PI/2; arm.add(claw);
  const claw2=M(new THREE.ConeGeometry(3,10,6),cd); claw2.position.set(9,7,-6); claw2.rotation.z=-Math.PI/2; inner.add(claw2);
  g.userData.legs=[];
  for(const lx of [-4,4]) for(const z of [-7,7]){ const leg=box3(1.6,6,1.6,cd); leg.geometry.translate(0,-3,0); leg.position.set(lx,6,z); inner.add(leg); g.userData.legs.push(leg); }
  return g;
}
function plantAvatar(kind,scale){
  const g=new THREE.Group(); const inner=new THREE.Group(); g.add(inner); g.userData.inner=inner;
  if(scale) inner.scale.setScalar(scale);
  const bloom=kind==='storm'?0x4a5ac8:0x9a3a5a;
  const M=(geo,col,opt)=>new THREE.Mesh(geo,smat(null,Object.assign({color:col,rough:0.8},opt||{})));
  const base=M(new THREE.ConeGeometry(9,9,8),0x5a4a2a); base.position.y=4.5; base.rotation.x=Math.PI; inner.add(base);
  const stalk=M(new THREE.CylinderGeometry(2.6,4,18,7),0x3a6a2a); stalk.position.y=13; inner.add(stalk); g.userData.robe=stalk;
  const head=M(new THREE.IcosahedronGeometry(7,0),bloom,{emissive:kind==='storm'?0x2030a0:0x3a1020,emissiveIntensity:0.55}); head.position.y=24; inner.add(head);
  for(let i=0;i<6;i++){ const a=i/6*6.28; const petal=M(new THREE.ConeGeometry(2,8,5),bloom); petal.position.set(Math.cos(a)*6,24,Math.sin(a)*6); petal.rotation.x=Math.cos(a)*0.9; petal.rotation.z=-Math.sin(a)*0.9; inner.add(petal); }
  return g;
}
function drakeAvatar(scale){
  const g=new THREE.Group(); const inner=new THREE.Group(); g.add(inner); g.userData.inner=inner;
  if(scale) inner.scale.setScalar(scale);
  const c=0x5a6a3a, cd=0x3e4a28;
  const M=(geo,col)=>new THREE.Mesh(geo,smat(skinTex(col),{rough:0.6}));
  const body=M(new THREE.SphereGeometry(11,14,10),c); body.scale.set(1.5,0.9,1.0); body.position.y=11; inner.add(body);
  const neck=M(new THREE.CylinderGeometry(4,5,10,8),c); neck.position.set(12,15,0); neck.rotation.z=-0.7; inner.add(neck);
  const head=M(new THREE.ConeGeometry(5,13,8),cd); head.position.set(21,18,0); head.rotation.z=-Math.PI/2.2; inner.add(head);
  const tail=M(new THREE.ConeGeometry(5,22,8),c); tail.position.set(-16,9,0); tail.rotation.z=Math.PI/2; inner.add(tail); g.userData.tail=tail;
  g.userData.legs=[];
  for(const lx of [-6,8]) for(const z of [-8,8]){ const leg=box3(3,11,3,cd); leg.geometry.translate(0,-5.5,0); leg.position.set(lx,9,z); inner.add(leg); g.userData.legs.push(leg); }
  return g;
}
const NPC_STYLES={
  aldra:{m:'knight',tint:0xd8b860},   trainer:{m:'barbarian',tint:0xc8a060},
  merchant:{m:'rogueh',tint:0x8a68c8},crafter:{m:'rogue',tint:0xc87840},
  fisher:{m:'rogue',tint:0x4a88b8},   inn:{m:'mage',tint:0xc86a78},
  scout:{m:'rogue',tint:0xd8b860},
};
function makeAvatar(e){
  let g=null;
  // humanoids (player / Hero / NPCs) use the modeled+animated characters once loaded
  if(modelsReady){
    if(e.kind==='player') g=gltfAvatar(e.cls==='elementalist'?'mage':'knight',null);
    else if(e.kind==='hench') g=gltfAvatar('mage',0x3f8a62);
    else if(e.kind==='npc'){ const s=NPC_STYLES[e.style]||NPC_STYLES.aldra; g=gltfAvatar(s.m,s.tint); }
  }
  if(!g&&(e.kind==='player'||e.kind==='hench'||e.kind==='npc')){
    if(e.kind==='player') g=e.cls==='elementalist'
      ? humanoid({robe:0x8a3838,armor:0x6a2c2c,trim:0xe8b050,weapon:'staff',hair:0x2a1c10})
      : humanoid({armor:0x4a7ab5,trim:0x9aa8c0,pants:0x39414f,weapon:'sword',helm:true,metalArmor:true});
    else if(e.kind==='hench') g=humanoid({robe:0x3f8a62,armor:0x2f6a4a,trim:0x7ad0a0,weapon:'staff',hood:true});
    else g=(e.style==='merchant'||e.style==='inn'||e.style==='crafter')
      ? humanoid({robe:0x6a4a8a,armor:0x5a3a7a,trim:0xd8b860,hood:true})
      : humanoid({armor:0xb59a4a,trim:0xe8d290,pants:0x4a4438,weapon:'banner',metalArmor:true});
  }
  if(!g){ // creatures of the Dunereach — always procedural
    const fam=e.family, bs=e.boss;
    if(fam==='skale') g=skaleAvatar(bs?1.6:0);
    else if(fam==='insect') g=bugAvatar(e.type==='spider'?'spider':(e.type==='lance'||e.type==='lanceBoss')?'lance':'termite', bs?1.5:0);
    else if(fam==='mandragor') g=mandragorAvatar(bs?1.6:0);
    else if(fam==='plant') g=plantAvatar((e.type==='jacaranda'||e.type==='jacarandaBoss')?'storm':'fang', bs?1.5:0);
    else if(fam==='drake') g=drakeAvatar(bs?1.4:0);
    else g=skaleAvatar(0);
  }
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
  const hi=SETTINGS.quality==='high';
  g.traverse(o=>{ if(o.isMesh&&o!==sh&&!o.userData.aura){ o.userData.shadowCaster=true; o.castShadow=hi; } });
  scene.add(g);
  return g;
}

function syncAvatar(e){
  // burrowed sand-stalkers, and the Hero before she's recruited, aren't shown
  if(e.hidden||(e===hench&&!hench.recruited)){ if(e.av) e.av.visible=false; return; }
  if(!e.av) e.av=makeAvatar(e);
  const g=e.av;
  // distance cull: far-off characters cost draw calls but are lost in the fog anyway.
  // The low GW1 camera sees much farther north, so cull a bit later to avoid pop-in.
  if(e!==player&&dist(e.x,e.y,player.x,player.y)>1450){ g.visible=false; return; }
  // hide fully-faded corpses awaiting respawn
  if(e.kind==='enemy'&&e.dead&&now>=e.respawnAt-20){ g.visible=false; return; }
  g.visible=true;
  const ud=g.userData;
  if(ud.gltf){ syncGltfAvatar(e,g,ud); return; }
  const gy=heightAt(e.x,e.y);
  const moved=dist(e.x,e.y,ud.lx??e.x,ud.ly??e.y);
  ud.lx=e.x; ud.ly=e.y;
  const inner=ud.inner;
  if(e.dead){ // topple over instead of snapping flat
    ud.dk=Math.min(1,(ud.dk||0)+frameDt*2.5);
    g.position.set(e.x,gy+1,e.y);
    inner.rotation.z=ud.dk*Math.PI/2; inner.position.y=2*ud.dk;
    return;
  }
  ud.dk=0;
  inner.rotation.z=0; inner.position.y=0;
  const mv=moved>0.05;
  const ph=now*9+e.x*0.05; // gait phase, desynced per entity
  const bob=mv?Math.abs(Math.sin(ph))*1.8:0;
  g.position.set(e.x,gy+bob,e.y);
  g.rotation.y=-e.face;
  // walk: lean + leg/arm swing
  inner.rotation.x=mv?Math.sin(ph)*0.06:0;
  if(ud.legs) ud.legs.forEach((l,i)=>{ l.rotation.z=mv?Math.sin(ph+(i%2)*Math.PI)*0.55:0; });
  if(ud.offArm) ud.offArm.rotation.z=mv?Math.sin(ph)*0.45:0;
  if(ud.robe) ud.robe.rotation.x=mv?Math.sin(ph)*0.07:0;
  if(ud.tail) ud.tail.rotation.y=Math.sin(now*6+e.x)*0.35; // idle tail wag
  // attack chop
  const arm=ud.arm;
  if(arm&&e.nextAtk){
    const sw=e.nextAtk-now-(e.atkInt-0.3);
    const k=sw>0?sw/0.3:0; // 1 → 0 right after the hit
    arm.rotation.z=-Math.sin(k*Math.PI)*1.5;
  }
  // casting pose: weapon arm raised, trembling with power
  if(e===player&&cast&&arm) arm.rotation.z=-2.2-Math.sin(now*12)*0.12;
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

let sunLight;
const HAZE=0xbdd4e6; // bluish atmospheric perspective, GW1-style
function initThree(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.0;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();
  scene.background=new THREE.Color(HAZE); // warm Istani haze
  scene.fog=new THREE.Fog(HAZE,1050,2400); // pushed out — nearby world stays crisp
  camera=new THREE.PerspectiveCamera(50,1,10,3400);
  raycaster=new THREE.Raycaster();
  // stylized 3-point rig: warm sky / cool ground bounce, cool rim, warm key
  scene.add(new THREE.HemisphereLight(0xcfe2ff,0x4a5a3c,0.5)); // kept low so the sun does the shaping
  const amb=new THREE.AmbientLight(0xe8f0ff,0.08); scene.add(amb);
  const rim=new THREE.DirectionalLight(0x88b6ff,0.55); // cool back-rim to pop silhouettes
  rim.position.set(-360,420,-520); scene.add(rim);
  sunLight=new THREE.DirectionalLight(0xfff2d8,1.7); // strong warm key against the cool sky
  sunLight.position.set(420,760,300);
  sunLight.target.position.set(0,0,0); scene.add(sunLight.target);
  // shadow camera follows the player (High quality only)
  sunLight.shadow.mapSize.set(2048,2048);
  sunLight.shadow.camera.near=10; sunLight.shadow.camera.far=1500;
  const sc=sunLight.shadow.camera; sc.left=-480; sc.right=480; sc.top=480; sc.bottom=-480;
  sunLight.shadow.bias=-0.0006;
  scene.add(sunLight);
  buildSky();
  buildTerrain();
  buildProps();
  applyQuality();
}

function rebuildWorld3D(){
  if(worldGroup){
    worldGroup.traverse(o=>{ if(o.isMesh&&o.geometry) o.geometry.dispose(); });
    scene.remove(worldGroup); worldGroup=null;
  }
  buildTerrain();
  buildProps();
  applyQuality();
}

function buildSky(){
  const geo=new THREE.SphereGeometry(2900,20,14);
  const pos=geo.attributes.position, cols=new Float32Array(pos.count*3), c=new THREE.Color();
  // deeper, more saturated stylized gradient
  const top=new THREE.Color(0x2c6cc4), mid=new THREE.Color(0x9fc8e8), low=new THREE.Color(0xe8f2f4);
  for(let i=0;i<pos.count;i++){
    const h=clamp(pos.getY(i)/2900,-1,1);
    if(h>0.14) c.copy(mid).lerp(top,Math.pow(clamp((h-0.14)/0.7,0,1),0.8));
    else c.copy(low).lerp(mid,clamp((h+0.22)/0.36,0,1));
    cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(cols,3));
  const sky=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));
  scene.add(sky);
  // bright stylized sun with a soft halo
  const sunDir=new THREE.Vector3(820,1400,640);
  const halo=new THREE.Mesh(new THREE.CircleGeometry(280,28),
    new THREE.MeshBasicMaterial({map:spriteTexture('rgba(255,236,180,1)'),fog:false,transparent:true,opacity:0.85,depthWrite:false}));
  halo.position.copy(sunDir); halo.lookAt(0,0,0); scene.add(halo);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(130,28),
    new THREE.MeshBasicMaterial({color:0xfff6dc,fog:false,transparent:true,opacity:0.96,depthWrite:false}));
  disc.position.copy(sunDir); disc.lookAt(0,0,0); scene.add(disc);
  // a few flat stylized clouds drifting high
  const cloudMat=new THREE.MeshBasicMaterial({color:0xfdf6e8,fog:false,transparent:true,opacity:0.9});
  const cr=mulberry32(909);
  for(let i=0;i<9;i++){
    const cl=new THREE.Group();
    const lobes=2+Math.floor(cr()*3);
    for(let j=0;j<lobes;j++){
      const lo=new THREE.Mesh(new THREE.IcosahedronGeometry(70+cr()*70,0),cloudMat);
      lo.scale.set(1+cr(),0.4,0.7+cr()*0.5); lo.position.set(j*90-lobes*30,cr()*20,cr()*30);
      cl.add(lo);
    }
    const ang=cr()*6.28, rad=1400+cr()*900;
    cl.position.set(Math.cos(ang)*rad, 760+cr()*340, Math.sin(ang)*rad);
    cl.rotation.y=cr()*6.28; scene.add(cl); skyClouds.push(cl);
  }
}
const skyClouds=[];

function applyQuality(){
  if(!renderer) return;
  const q=SETTINGS.quality;
  const shadows=q!=='low'; // shadows ground the scene, GW1-style
  if(sunLight){
    const ms=q==='high'?2048:1024;
    if(sunLight.shadow.mapSize.x!==ms){
      sunLight.shadow.mapSize.set(ms,ms);
      if(sunLight.shadow.map){ sunLight.shadow.map.dispose(); sunLight.shadow.map=null; }
    }
  }
  renderer.shadowMap.enabled=shadows;
  if(sunLight) sunLight.castShadow=shadows;
  scene.traverse(o=>{
    if(o.isMesh){
      if(o===terrainMesh||o===waterMesh) o.receiveShadow=shadows;
      else if(o.userData.shadowCaster){ o.castShadow=shadows; o.receiveShadow=shadows; }
    }
  });
  resize(); // re-applies pixel ratio for the quality tier
}

function resize(){
  DPR=Math.min(QUAL_DPR[SETTINGS.quality]||1.3,window.devicePixelRatio||1);
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
  // low camera: a tap toward/above the horizon gives a near-horizontal or upward
  // ray (t<=0 or absurdly large) — don't send the player behind the camera; walk
  // that compass direction a capped distance instead.
  if(!(t>0&&t<4000)){
    const hl=Math.hypot(d.x,d.z)||1;
    return {x:player.x+d.x/hl*600, y:player.y+d.z/hl*600};
  }
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
      const m=d.item
        ? new THREE.Mesh(new THREE.BoxGeometry(7,7,7),mat(parseInt(RARITY_COLORS[d.item.rarity].slice(1),16),{emissive:0x222222}))
        : new THREE.Mesh(new THREE.IcosahedronGeometry(4.5,0),mat(0xf0d97a,{emissive:0x8a6d1f,emissiveIntensity:0.5}));
      scene.add(m); dropMeshes.set(d,m);
    }
    const m=dropMeshes.get(d);
    m.position.set(d.x,heightAt(d.x,d.y)+6+Math.sin(now*3+d.x)*1.5,d.y);
    m.rotation.y=now*2.5;
  }
  for(const [d,m] of dropMeshes) if(!drops.includes(d)){ scene.remove(m); dropMeshes.delete(d); }
}

/* ---------------- overlay (bars, names, floating text) ---------------- */
function drawOverlay(){
  fctx.clearRect(0,0,VW,VH);
  // stylized warm color-grade wash over the 3D scene (HUD text is drawn after, stays crisp)
  if(SETTINGS.vignette){
    fctx.fillStyle='rgba(255,228,190,0.035)'; fctx.fillRect(0,0,VW,VH);
  }
  // entity bars / labels
  const seen=heroActive()?[...enemies,hench]:[...enemies];
  for(const e of seen){
    if(e.dead||e.hidden) continue;
    if(dist(e.x,e.y,player.x,player.y)>900) continue;
    if(e.kind==='enemy'&&e.hp>=e.maxHp-0.5&&player.target!==e) continue;
    if(e.kind!=='enemy'&&e.hp>=maxHpOf(e)-0.5) continue;
    const h=heightAt(e.x,e.y)+(e.boss?54:38);
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
    if(condActive(e,'deepwound'))pip('#b050d0');
  }
  // npc labels + quest markers
  for(const n of npcs){
    if(dist(n.x,n.y,player.x,player.y)>900) continue;
    const p=project(n.x,heightAt(n.x,n.y)+44,n.y);
    if(p.behind) continue;
    fctx.textAlign='center';
    const m=npcMarker(n);
    if(m){
      fctx.font='bold 22px Georgia'; fctx.fillStyle='#f0d97a';
      fctx.fillText(m,p.x,p.y-8-Math.abs(Math.sin(now*3))*5);
    }
    fctx.font='12px Georgia'; fctx.fillStyle='#e8dfc8';
    fctx.fillText(n.name,p.x,p.y+10);
  }
  // gate labels
  for(const g of GATES){
    if(dist(g.x,g.y,player.x,player.y)>900) continue;
    const p=project(g.x,heightAt(g.x,g.y)+52,g.y);
    if(p.behind) continue;
    fctx.textAlign='center';
    fctx.font='bold 13px Georgia'; fctx.fillStyle='#9fd0ff';
    fctx.fillText('⇢ '+g.label,p.x,p.y);
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
  // cinematic vignette
  if(SETTINGS.vignette){
    if(!vignetteGrad||vignetteGrad._w!==VW||vignetteGrad._h!==VH){
      vignetteGrad=fctx.createRadialGradient(VW/2,VH*0.46,Math.min(VW,VH)*0.35,VW/2,VH*0.5,Math.max(VW,VH)*0.72);
      vignetteGrad.addColorStop(0,'rgba(0,0,0,0)');
      vignetteGrad.addColorStop(1,'rgba(20,14,6,0.42)');
      vignetteGrad._w=VW; vignetteGrad._h=VH;
    }
    fctx.fillStyle=vignetteGrad; fctx.fillRect(0,0,VW,VH);
  }
}
let vignetteGrad=null;

/* ---------------- main 3D render ---------------- */
let camYaw=0, rotHold=0; // orbit yaw — 0 looks north (GW1 default); rotHold from on-screen arrows
function render(){
  if(!HAS3D||!renderer) return;
  if(rotHold) camYaw+=rotHold*1.7*frameDt;
  const ph=heightAt(player.x,player.y);
  const cv=CAMVIEWS[SETTINGS.zoom]||CAMVIEWS.normal;
  const s=Math.sin(camYaw), c=Math.cos(camYaw);
  camera.position.set(player.x+cv.back*s, ph+cv.h, player.y+cv.back*c);
  camera.lookAt(player.x+cv.look*s, ph+26, player.y+cv.look*c);
  // sun + shadow frustum follow the player
  if(sunLight){
    sunLight.position.set(player.x+420,ph+760,player.y+300);
    sunLight.target.position.set(player.x,ph,player.y);
  }
  if(frameNo%2===0) animateWater();
  for(let i=0;i<skyClouds.length;i++){ const cl=skyClouds[i]; cl.position.x+=(6+i)*frameDt; if(cl.position.x>2600) cl.position.x=-2600; }

  for(const e of enemies) syncAvatar(e);
  for(const n of npcs) syncAvatar(n);
  syncAvatar(player); syncAvatar(hench);

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
  // sprint shimmer: a slight forward lean (procedural avatar only — syncAvatar
  // resets its inner.rotation.x each frame; glTF avatars don't, so adding there
  // would accumulate and tip the model face-down).
  if(player.av&&!player.av.userData.gltf&&(player.buffs.sprint||0)>now)
    player.av.userData.inner.rotation.x+=0.12;

  syncPools();
  updateEffects();
  renderer.render(scene,camera);
  drawOverlay();
}

/* ---------------- input: GW1 mouse-style tap-to-move + drag-to-rotate ---------------- */
let tapId=null, tapX=0, tapY=0, tapT=0, dragLastX=0, dragged=false;

canvas.addEventListener('pointerdown',ev=>{
  if(uiBlocking()) return;        // a menu/dialog is open — let the UI handle it
  ev.preventDefault();
  if(tapId===null){ tapId=ev.pointerId; tapX=dragLastX=ev.clientX; tapY=ev.clientY; tapT=performance.now(); dragged=false; }
});
window.addEventListener('pointermove',ev=>{
  if(ev.pointerId!==tapId) return;
  const moved=dist(ev.clientX,ev.clientY,tapX,tapY);
  if(moved>18 && SETTINGS.dragRotate!==false){   // a drag spins the camera (tap still moves)
    dragged=true;
    camYaw-=(ev.clientX-dragLastX)*0.006;
    dragLastX=ev.clientX;
  }
});
window.addEventListener('pointerup',ev=>{
  if(ev.pointerId===tapId){
    tapId=null;
    if(uiBlocking()) return;
    const moved=dist(ev.clientX,ev.clientY,tapX,tapY);
    if(!dragged&&moved<18&&performance.now()-tapT<500) handleTap(tapX,tapY);
  }
});
window.addEventListener('pointercancel',ev=>{
  if(ev.pointerId===tapId)tapId=null;
});

// remappable keys (persisted in SETTINGS.keys); skills accept 1-8 by default too
const DEFAULT_KEYS={up:'w',down:'s',left:'a',right:'d',rotL:'q',rotR:'e',
  s1:'1',s2:'2',s3:'3',s4:'4',s5:'5',s6:'6',s7:'7',s8:'8'};
let keyListen=null;  // action id awaiting a rebind keypress
function keyFor(act){ return (SETTINGS.keys&&SETTINGS.keys[act])||DEFAULT_KEYS[act]; }
window.addEventListener('keydown',ev=>{
  const k=ev.key.toLowerCase();
  if(keyListen){ SETTINGS.keys=SETTINGS.keys||{}; SETTINGS.keys[keyListen]=k; keyListen=null; saveSettings(); if(openModalId==='settings') renderSettings(); ev.preventDefault(); return; }
  input.keys[k]=true;
  for(let i=1;i<=8;i++) if(k===keyFor('s'+i)) useSkill(i-1);
  if(k>='1'&&k<='8') useSkill(+k-1);     // numeric row always works
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
    if(e.dead||e.hidden) continue;
    const d=dist(wx,wy,e.x,e.y);
    if(d<bd+e.r){best=e;bd=d;}
  }
  if(best){
    player.target=best; player.engaged=true; player.moveTo=null; player.approach=null;
    return;
  }
  // npc?
  for(const n of npcs){
    if(dist(wx,wy,n.x,n.y)<45){
      if(dist(player.x,player.y,n.x,n.y)<90) openDialog(n);
      else { player.approach=n; player.target=null; player.engaged=false; }
      return;
    }
  }
  // gate to another zone?
  for(const g of GATES){
    if(dist(wx,wy,g.x,g.y)<60){
      if(g.locked){ toast(g.locked); return; }
      if(dist(player.x,player.y,g.x,g.y)<90) travelTo(g.to,MAPID);
      else { player.approach=g; player.target=null; player.engaged=false; }
      return;
    }
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
  pAdr:$('pAdr'),pAdrBar:$('pAdrBar'),
  hHp:$('hHp'),henchFrame:$('henchFrame'),
  targetFrame:$('targetFrame'),tName:$('tName'),tLvl:$('tLvl'),tHp:$('tHp'),tConds:$('tConds'),
  quest:$('questTracker'),gold:$('goldTxt'),
  castbar:$('castbar'),castFill:$('castFill'),castName:$('castName'),
  dialog:$('dialog'),dlgName:$('dlgName'),dlgText:$('dlgText'),dlgBtn:$('dlgBtn'),
  banner:$('banner'),toast:$('toast'),death:$('deathOverlay'),deathSub:$('deathSub'),
  compass:$('compass'),
};
const skillBtns=[];

/* ---------------- modal system ---------------- */
const MODALS={
  hero:    {el:$('heroPanel'),    body:$('heroBody'),    render:renderHero},
  skills:  {el:$('skillsPanel'),  body:$('skillsBody'),  render:renderSkills},
  inv:     {el:$('invPanel'),     body:$('invBody'),     render:renderInv},
  quest:   {el:$('questPanel'),   body:$('questBody'),   render:renderQuestLog},
  settings:{el:$('settingsPanel'),body:$('settingsBody'),render:renderSettings},
  craft:   {el:$('craftPanel'),   body:$('craftBody'),   render:renderCraft},
  merch:   {el:$('merchPanel'),   body:$('merchBody'),   render:renderMerch},
  train:   {el:$('trainPanel'),   body:$('trainBody'),   render:renderTrain},
  map:     {el:$('mapPanel'),     body:$('mapBody'),     render:renderMap},
  party:   {el:$('partyPanel'),   body:$('partyBody'),   render:renderParty},
  bounty:  {el:$('bountyPanel'),  body:$('bountyBody'),  render:renderBounty},
  collect: {el:$('collectPanel'), body:$('collectBody'), render:renderCollect},
  trade:   {el:$('tradePanel'),   body:$('tradeBody'),   render:renderTrade},
  vault:   {el:$('vaultPanel'),   body:$('vaultBody'),   render:renderVault},
};

/* ---------------- full-screen zone map ---------------- */
const ZONE_LABELS={
  town:[[48,50,'The Plaza'],[48,15,'Sunspear Keep'],[15,42,'Market Row'],[44,82,'The Docks'],[88,45,'East Gate ⇢']],
  wilds:[[55,46,'River Bridge'],[78,22,'Corsair Camp'],[84,6,'The Spring'],[6,45,'⇠ Town Gate'],[49,73,'South Pool'],[24,36,'Open Savanna']],
};
function renderMap(){
  let cv=$('mapCanvas');
  if(!cv) return;
  const S=cv.width, sc=S/MAPW; // map canvas is square, 1 tile = sc px
  const c=cv.getContext('2d');
  c.clearRect(0,0,S,S);
  // terrain
  c.imageSmoothingEnabled=false;
  c.drawImage(miniCv,0,0,S,S);
  c.imageSmoothingEnabled=true;
  // soft parchment wash
  c.fillStyle='rgba(40,32,16,.18)'; c.fillRect(0,0,S,S);
  const px=x=>x/TILE*sc, py=y=>y/TILE*sc;
  // shrine + gates
  c.font='bold 16px Georgia'; c.textAlign='center';
  c.fillStyle='#b8c8ff'; c.fillText('✚',px(SHRINE.x),py(SHRINE.y)+5);
  for(const g of GATES){
    c.fillStyle='#9fd0ff';
    c.beginPath(); c.arc(px(g.x),py(g.y),6,0,7); c.fill();
  }
  // enemies (only rough presence: dots, bosses as skull-rings)
  for(const e of enemies){
    if(e.dead) continue;
    if(e.boss){
      c.strokeStyle='#ff5040'; c.lineWidth=2;
      c.beginPath(); c.arc(px(e.x),py(e.y),5.5,0,7); c.stroke();
    } else {
      c.fillStyle='rgba(224,80,64,.8)';
      c.beginPath(); c.arc(px(e.x),py(e.y),2.4,0,7); c.fill();
    }
  }
  // npcs with quest markers
  for(const n of npcs){
    c.fillStyle='#f0d97a';
    c.beginPath(); c.arc(px(n.x),py(n.y),4,0,7); c.fill();
    const m=npcMarker(n);
    if(m){ c.font='bold 13px Georgia'; c.fillStyle='#fff4c0'; c.fillText(m,px(n.x),py(n.y)-6); }
  }
  // Lyra + player arrow
  if(!hench.dead){ c.fillStyle='#50c878'; c.beginPath(); c.arc(px(hench.x),py(hench.y),3.5,0,7); c.fill(); }
  c.save();
  c.translate(px(player.x),py(player.y));
  c.rotate(player.face+Math.PI/2);
  c.fillStyle='#ffffff'; c.strokeStyle='#000'; c.lineWidth=2;
  c.beginPath(); c.moveTo(0,-9); c.lineTo(6.5,7); c.lineTo(-6.5,7); c.closePath();
  c.stroke(); c.fill();
  c.restore();
  // place names
  c.font='bold 13px Georgia'; c.textAlign='center';
  for(const [tx,ty,label] of (ZONE_LABELS[MAPID]||[])){
    c.fillStyle='rgba(0,0,0,.75)'; c.fillText(label,tx*sc+1,ty*sc+1);
    c.fillStyle='#f0e6c8'; c.fillText(label,tx*sc,ty*sc);
  }
  // legend
  const mEl=$('mapLegend');
  if(mEl) mEl.innerHTML=`<b style="color:#f0d97a">${ZONES[MAPID].name}</b> — ${ZONES[MAPID].sub}<br>
    <span class="dim">▲ you · <span style="color:#50c878">●</span> Lyra · <span style="color:#f0d97a">●</span> people · <span style="color:#e05040">●</span> foes · <span style="color:#ff5040">○</span> bosses · <span style="color:#9fd0ff">●</span> gates · <span style="color:#b8c8ff">✚</span> shrine</span>`;
}
let openModalId=null;
const backdrop=$('backdrop');
function anyModalOpen(){ return openModalId!==null || !ui.dialog.classList.contains('hidden') || !$('classPick').classList.contains('hidden'); }
function uiBlocking(){ return anyModalOpen(); }
function closeModal(){
  if(openModalId){ MODALS[openModalId].el.classList.add('hidden'); openModalId=null; }
  ui.dialog.classList.add('hidden');
  backdrop.classList.add('hidden');
}
function openModal(id){
  closeModal();
  const m=MODALS[id]; if(!m) return;
  invSel=-1; skillsSel=-1;
  m.render();
  m.el.classList.remove('hidden');
  backdrop.classList.remove('hidden');
  openModalId=id;
}
function closePanels(){ closeModal(); }

function buildSkillbar(){
  const bar=$('skillbar');
  bar.innerHTML=''; skillBtns.length=0;
  SKILLS.forEach((sk,i)=>{
    const b=document.createElement('button');
    b.className='skill';
    b.innerHTML=`<span>${sk.icon}</span><span class="cost${sk.adr?' adr':''}">${sk.adr?sk.adr:(sk.en>0?sk.en:'')}</span><span class="key">${i+1}</span><div class="cd"></div><div class="cdt"></div>`;
    b.addEventListener('pointerdown',ev=>{ev.stopPropagation();ev.preventDefault();useSkill(i);});
    bar.appendChild(b);
    skillBtns.push(b);
  });
}

let uiWired=false;
function wireUI(){
  if(uiWired) return; uiWired=true;
  // menu buttons
  document.querySelectorAll('.menuBtn').forEach(b=>{
    b.addEventListener('pointerdown',ev=>{
      ev.stopPropagation();
      const id=b.getAttribute('data-modal');
      if(openModalId===id) closeModal(); else openModal(id);
    });
  });
  // backdrop taps close
  backdrop.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); closeModal(); });
  // close buttons
  document.querySelectorAll('[data-close]').forEach(b=>
    b.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); closeModal(); }));
  // swallow taps inside any modal so they never reach the world
  document.querySelectorAll('.modal').forEach(m=>
    m.addEventListener('pointerdown',ev=>ev.stopPropagation()));
  // dialog action button
  ui.dlgBtn.addEventListener('pointerdown',ev=>{
    ev.stopPropagation();
    if(currentDlg) currentDlg.act();
    closeModal();
  });
  // on-screen camera rotate (hold to spin)
  const rl=$('rotLeft'), rr=$('rotRight');
  if(rl&&rr){
    const hold=(d)=>ev=>{ ev.stopPropagation(); ev.preventDefault(); rotHold=d; };
    const release=()=>{ rotHold=0; };
    rl.addEventListener('pointerdown',hold(1)); rr.addEventListener('pointerdown',hold(-1));
    for(const el of [rl,rr]){ el.addEventListener('pointerup',release); el.addEventListener('pointerleave',release); el.addEventListener('pointercancel',release); }
  }
  // delegated handler for buttons inside panel bodies
  for(const id of Object.keys(MODALS)){
    MODALS[id].body.addEventListener('pointerdown',ev=>{ ev.stopPropagation(); onPanelTap(ev,id); });
  }
}

function onPanelTap(ev,panel){
  let t=ev.target;
  while(t&&t!==ev.currentTarget&&!t.dataset?.act) t=t.parentElement;
  if(!t||!t.dataset||!t.dataset.act) return;
  const act=t.dataset.act, v=t.dataset.v;
  if(act==='attr'&&player.attrPts>0&&(player.attrs[v]||0)<12){
    player.attrs[v]=(player.attrs[v]||0)+1; player.attrPts--; saveGame(); renderHero();
  } else if(act==='attrminus'&&(player.attrs[v]||0)>0){
    player.attrs[v]--; player.attrPts++; saveGame(); renderHero();
  } else if(act==='selitem'){
    invSel=+v; renderInv();
  } else if(act==='equip'){
    equipItem(+v); saveGame(); renderInv();
  } else if(act==='drop'){
    player.inv.splice(+v,1); invSel=-1; saveGame(); renderInv();
  } else if(act==='sellone'){
    const it=player.inv[+v]; if(it){ player.gold+=Math.round(it.value*0.5); player.inv.splice(+v,1); invSel=-1; saveGame(); renderInv(); toast('Sold for '+Math.round(it.value*0.5)+'g'); }
  } else if(act==='savebuild'){
    saveBuild(); renderSkills();
  } else if(act==='loadbuild'){
    loadBuild(+v); renderSkills();
  } else if(act==='delbuild'){
    (player.builds||[]).splice(+v,1); saveGame(); renderSkills();
  } else if(act==='slot'){
    skillsSel=(+v===skillsSel)?-1:+v; renderSkills();
  } else if(act==='assign'){
    if(skillsSel>=0&&setBarSlot(skillsSel,v)) skillsSel=-1;
    renderSkills();
  } else if(act==='learn'){
    learnSkill(v); renderTrain();
  } else if(act==='craft'){
    if(craftRecipe(+v)) renderCraft();
  } else if(act==='buyitem'){
    buyMerch(+v);
  } else if(act==='selltrophies'){
    sellTrophies(); renderMerch();
  } else if(act==='respec'){
    player.attrs={}; player.attrPts=3*(player.lvl-1); saveGame(); renderSkills(); toast('Attributes refunded');
  } else if(act==='quality'){ SETTINGS.quality=v; applyQuality(); saveSettings(); renderSettings(); }
  else if(act==='zoom'){ SETTINGS.zoom=v; saveSettings(); renderSettings(); }
  else if(act==='vignette'){ SETTINGS.vignette=!SETTINGS.vignette; saveSettings(); renderSettings(); }
  else if(act==='fullscreen'){ toggleFullscreen(); }
  else if(act==='dragrot'){ SETTINGS.dragRotate=!(SETTINGS.dragRotate!==false); saveSettings(); renderSettings(); }
  else if(act==='recenter'){ camYaw=0; }
  else if(act==='rebind'){ keyListen=v; renderSettings(); }
  else if(act==='resetkeys'){ SETTINGS.keys={}; keyListen=null; saveSettings(); renderSettings(); }
  else if(act==='newgame'){ wipeSave(); location.reload(); }
  else if(act==='stance'){ hench.stance=v; saveGame(); renderParty(); }
  else if(act==='flag'){ if(hench.flag){ hench.flag=null; } else { hench.flag={x:hench.x,y:hench.y}; } saveGame(); renderParty(); }
  else if(act==='hunt'){ startBounty(v); closeModal(); }
  else if(act==='collect'){ doCollect(+v); renderCollect(); }
  else if(act==='buymat'){ buyMat(v); renderTrade(); }
  else if(act==='sellmat'){ sellMat(v); renderTrade(); }
  else if(act==='store'){ moveToVault(+v); renderVault(); }
  else if(act==='withdraw'){ moveFromVault(+v); renderVault(); }
}

function equipItem(i){
  const it=player.inv[i]; if(!it) return;
  if(it.kind==='weapon'){
    if(it.wtype!==(player.cls==='warrior'?'sword':'wand')){ toast('Wrong weapon for your profession'); return; }
    const old=player.equip.weapon; player.equip.weapon=it;
    if(old&&old.value>0) player.inv[i]=old; else player.inv.splice(i,1);
  } else if(it.kind==='off'){
    if((it.otype==='shield')!==(player.cls==='warrior')){ toast("Can't use that off-hand"); return; }
    const old=player.equip.off; player.equip.off=it;
    if(old) player.inv[i]=old; else player.inv.splice(i,1);
  } else { toast('That cannot be equipped'); return; }
  player.en=Math.min(player.en,pMaxEn());
  invSel=-1;
}

/* ---------------- panel renderers ---------------- */
const rc=it=>RARITY_COLORS[it.rarity||0];
const MAT_ICONS={'Scale':'🐚','Chitin Fragment':'🪲','Bone':'🦴','Plant Fiber':'🌿','Drake Scale':'🐲'};
const itemIcon=it=> it.kind==='weapon' ? (it.wtype==='sword'?'🗡️':'🪄')
  : it.kind==='off' ? (it.otype==='shield'?'🛡️':'🔮')
  : it.kind==='mat' ? (MAT_ICONS[it.name]||'📦') : '🦴';
const itemStat=it=> it.kind==='weapon'?`${it.dmgMin}–${it.dmgMax} dmg${it.armor?' · +'+it.armor+' armor':''}${it.energy?' · +'+it.energy+' energy':''}`
  : it.kind==='off'?(it.armor?'+'+it.armor+' armor':'+'+it.energy+' energy')
  : it.kind==='mat'?'crafting material'
  : `sells ~${Math.round(it.value*0.5)}g`;

/* ---------------- merchant / crafter / trainer panels ---------------- */
let merchStock=null;
function sellTrophies(){
  const tro=player.inv.filter(i=>i.kind==='trophy');
  const sum=tro.reduce((s,i)=>s+i.value,0);
  if(!sum){ toast('No trophies to sell'); return; }
  player.inv=player.inv.filter(i=>i.kind!=='trophy');
  player.gold+=sum; saveGame(); toast('+'+sum+' gold');
}
function renderMerch(){
  if(!merchStock){
    merchStock=[
      genW(player.cls==='warrior'?'sword':'wand',player.lvl,1),
      genW(player.cls==='warrior'?'wand':'sword',player.lvl,1),
      genOff('shield',player.lvl,1),
      genOff('focus',player.lvl,1),
    ];
  }
  const tro=player.inv.filter(i=>i.kind==='trophy');
  const sum=tro.reduce((s,i)=>s+i.value,0);
  let h=`<div class="dim">Your gold: <b style="color:#f0d97a">${player.gold}</b></div>`;
  h+=`<div class="sectTitle">Sell</div>
      <button class="btn sm" data-act="selltrophies">Sell ${tro.length} trophies (+${sum}g)</button>
      <div class="dim">Weapons and salvage can be sold from the Inventory panel.</div>`;
  h+=`<div class="sectTitle">Buy</div>`;
  merchStock.forEach((it,i)=>{
    if(!it) { h+=`<div class="attrRow"><span class="an dim">— sold —</span></div>`; return; }
    const price=Math.round(it.value*1.8);
    h+=`<div class="attrRow"><span class="an" style="color:${rc(it)}">${itemIcon(it)} ${it.name}</span>
        <span class="dim" style="font-size:11px">${itemStat(it)}</span>
        <button class="mini" data-act="buyitem" data-v="${i}">${price}g</button></div>`;
  });
  MODALS.merch.body.innerHTML=h;
}
function buyMerch(i){
  const it=merchStock[i]; if(!it) return;
  const price=Math.round(it.value*1.8);
  if(player.gold<price){ toast('Not enough gold'); return; }
  if(player.inv.length>=20){ toast('Inventory full'); return; }
  player.gold-=price; player.inv.push(it); merchStock[i]=null;
  saveGame(); renderMerch(); toast('Bought: '+it.name);
}
function renderCraft(){
  let h=`<div class="dim">Armorer Joska crafts to your level. Materials drop from the creatures of the Dunereach.</div>`;
  h+=`<div class="sectTitle">Your materials</div><div class="dim">`;
  h+=TRADE_MATS.map(m=>`${MAT_ICONS[m]} ${m}: <b>${matCount(m)}</b>`).join(' · ');
  h+=`</div><div class="sectTitle">Recipes</div>`;
  RECIPES.forEach((r,i)=>{
    const mats=Object.entries(r.mats).map(([m,c])=>`${c}× ${m}`).join(', ');
    const can=player.gold>=r.gold&&Object.entries(r.mats).every(([m,c])=>matCount(m)>=c);
    h+=`<div class="skRow"><div class="si">${r.icon}</div><div class="sd">
        <b>${r.name}</b> <i>${r.gold}g + ${mats}</i><br><span class="dim">${r.desc}</span><br>
        <button class="mini" data-act="craft" data-v="${i}" ${can?'':'disabled style="opacity:.45"'}>Craft</button></div></div>`;
  });
  MODALS.craft.body.innerHTML=h;
}
function renderTrain(){
  const known=player.known[player.cls];
  let h=`<div class="dim">Skill points: <b style="color:#f0d97a">${player.skillPts||0}</b> · gold: <b style="color:#f0d97a">${player.gold}</b><br>
      Earn skill points by leveling up and from Henko's quests. Equip learned skills in ✨ Skills & Builds.</div>`;
  h+=`<div class="sectTitle">${CLASSES[player.cls].label} techniques</div>`;
  for(const s of CLASSES[player.cls].pool){
    const have=known.includes(s.id);
    const cost=skillCost();
    h+=`<div class="skRow"><div class="si">${s.icon}</div><div class="sd">
        <b>${s.name}</b> <i>${s.adr?s.adr+' adr':(s.en>0?s.en+'e':'free')}${s.cast?` · ${s.cast}s`:''} · ${s.rc}s rc</i><br>
        <span class="dim">${s.desc}</span><br>
        ${have?'<span class="dim" style="color:#7ac77a">✓ known</span>'
             :`<button class="mini" data-act="learn" data-v="${s.id}">Learn — ${cost}g + 1 SP</button>`}</div></div>`;
  }
  MODALS.train.body.innerHTML=h;
}

/* ---------------- Party (Heroes), Bounties, Collector, Material trader, Vault ---------------- */
function renderParty(){
  let h=`<div class="sectTitle">Your party</div>`;
  if(!hench.recruited){
    h+=`<div class="dim">You travel alone for now. Complete <b>Honing Your Skills</b> for Marshal Oyin to gain your first Hero.</div>`;
  } else {
    const flag=hench.flag?'Holding position':'Following you';
    h+=`<div class="skRow"><div class="si">✚</div><div class="sd">
        <b>Lyra</b> <i>Hero · Mender</i><br>
        <span class="dim">Heals the party and fights to your orders. HP ${Math.ceil(hench.hp)}/${hench.maxHp}.</span></div></div>`;
    h+=`<div class="sectTitle">AI stance</div><div class="btnRow">
        <button class="chip${hench.stance==='aggressive'?' on':''}" data-act="stance" data-v="aggressive">Aggressive</button>
        <button class="chip${hench.stance==='guard'?' on':''}" data-act="stance" data-v="guard">Guard</button>
        <button class="chip${hench.stance==='passive'?' on':''}" data-act="stance" data-v="passive">Passive</button></div>
        <div class="dim">Aggressive hunts nearby foes · Guard assists your target and stays close · Passive only heals.</div>`;
    h+=`<div class="sectTitle">Position</div>
        <button class="btn sm" data-act="flag">${hench.flag?'↩ Recall to my side':'⚑ Hold this position'}</button>
        <div class="dim">Currently: ${flag}.</div>`;
  }
  MODALS.party.body.innerHTML=h;
}

function renderBounty(){
  const nx=rankNext();
  let h=`<div class="sectTitle">Sunward rank: ${rankTitle()}</div>
    <div class="dim">Sunward Honor: <b style="color:#ffd34d">${player.promo||0}</b>${nx?` · next rank "${nx.name}" at ${nx.at}`:' · highest rank reached'}</div>`;
  const b=player.bounty;
  if(b&&b.family) h+=`<div class="dim" style="color:#f0d97a;margin-top:6px">Active: ${BOUNTIES[b.family].name} — ${b.n}/${b.goal}</div>`;
  h+=`<div class="sectTitle">Take a hunt</div><div class="dim">Each kill of the named kind earns Honor. Only one hunt at a time.</div>`;
  for(const fam of Object.keys(BOUNTIES)){
    const on=b&&b.family===fam;
    h+=`<div class="attrRow"><span class="an">${BOUNTIES[fam].name} <span class="dim">(${BOUNTIES[fam].goal})</span></span>
        ${on?'<span class="dim" style="color:#f0d97a">active</span>':`<button class="mini" data-act="hunt" data-v="${fam}">Begin</button>`}</div>`;
  }
  MODALS.bounty.body.innerHTML=h;
}

const COLLECTOR_TRADES=[
  {trophy:'Skale Fin',        count:5, label:'Tidewater Focus',  make:()=>{const o=genOff('focus',player.lvl,1);o.name='Tidewater Focus';return o;}},
  {trophy:'Insect Carapace',  count:5, label:'Chitin Buckler',   make:()=>{const o=genOff('shield',player.lvl,1);o.name='Chitin Buckler';return o;}},
  {trophy:'Mandragor Pincer', count:5, label:'Pincer Shortblade',make:()=>{const o=genW('sword',player.lvl,1);o.name='Pincer Shortblade';return o;}},
  {trophy:'Iboga Petal',      count:5, label:'Bloomwood Scepter',make:()=>{const o=genW('wand',player.lvl,1);o.name='Bloomwood Scepter';return o;}},
  {trophy:'Drake Tooth',      count:3, label:'Drakescale Cuirass (rare)',make:()=>makeEquip(player.lvl,2)},
];
const trophyCount=n=>player.inv.filter(i=>i.kind==='trophy'&&i.name===n).length;
function takeTrophies(n,c){ for(let k=0;k<c;k++){ const i=player.inv.findIndex(it=>it.kind==='trophy'&&it.name===n); if(i>=0) player.inv.splice(i,1); } }
function doCollect(i){
  const t=COLLECTOR_TRADES[i]; if(!t) return;
  if(trophyCount(t.trophy)<t.count){ toast('Not enough '+t.trophy); return; }
  if(player.inv.length-t.count+1>20){ toast('Inventory too full'); return; }
  takeTrophies(t.trophy,t.count); giveItem(t.make()); saveGame();
}
function renderCollect(){
  let h=`<div class="dim">Collector Poturi trades fair gear for the spoils of the plain.</div>`;
  for(let i=0;i<COLLECTOR_TRADES.length;i++){
    const t=COLLECTOR_TRADES[i], have=trophyCount(t.trophy), can=have>=t.count;
    h+=`<div class="attrRow"><span class="an">${t.count}× ${t.trophy} <span class="dim">→ ${t.label}</span><br><span class="dim">you have ${have}</span></span>
        <button class="mini" data-act="collect" data-v="${i}" ${can?'':'disabled style="opacity:.45"'}>Trade</button></div>`;
  }
  MODALS.collect.body.innerHTML=h;
}

const TRADE_MATS=['Scale','Chitin Fragment','Bone','Plant Fiber','Drake Scale'];
const MAT_BUY=14, MAT_SELL=5;
function buyMat(n){ if(player.gold<MAT_BUY){toast('Not enough gold');return;} if(player.inv.length>=20){toast('Inventory full');return;} player.gold-=MAT_BUY; player.inv.push(makeMat(n)); saveGame(); }
function sellMat(n){ const i=player.inv.findIndex(it=>it.kind==='mat'&&it.name===n); if(i<0){toast('None to sell');return;} player.inv.splice(i,1); player.gold+=MAT_SELL; saveGame(); }
function renderTrade(){
  let h=`<div class="dim">Gold: <b style="color:#f0d97a">${player.gold}</b> · buy ${MAT_BUY}g · sell ${MAT_SELL}g</div>`;
  for(const m of TRADE_MATS){
    h+=`<div class="attrRow"><span class="an">${MAT_ICONS[m]||'📦'} ${m} <span class="dim">×${matCount(m)}</span></span>
        <button class="mini" data-act="buymat" data-v="${m}">Buy</button>
        <button class="mini" data-act="sellmat" data-v="${m}">Sell</button></div>`;
  }
  MODALS.trade.body.innerHTML=h;
}

function moveToVault(i){ const it=player.inv[i]; if(!it)return; if((player.vault||[]).length>=30){toast('Vault full');return;} player.inv.splice(i,1); (player.vault=player.vault||[]).push(it); saveGame(); }
function moveFromVault(i){ const it=player.vault[i]; if(!it)return; if(player.inv.length>=20){toast('Inventory full');return;} player.vault.splice(i,1); player.inv.push(it); saveGame(); }
function renderVault(){
  player.vault=player.vault||[];
  let h=`<div class="sectTitle">Inventory <span class="dim">${player.inv.length}/20 — tap to store</span></div><div class="invList">`;
  player.inv.forEach((it,i)=>{ h+=`<div class="attrRow" data-act="store" data-v="${i}" style="cursor:pointer"><span class="an" style="color:${rc(it)}">${itemIcon(it)} ${it.name}</span><span class="dim">store ▸</span></div>`; });
  if(!player.inv.length) h+=`<div class="dim">empty</div>`;
  h+=`</div><div class="sectTitle">Vault <span class="dim">${player.vault.length}/30 — tap to withdraw</span></div><div class="invList">`;
  player.vault.forEach((it,i)=>{ h+=`<div class="attrRow" data-act="withdraw" data-v="${i}" style="cursor:pointer"><span class="an" style="color:${rc(it)}">${itemIcon(it)} ${it.name}</span><span class="dim">◂ take</span></div>`; });
  if(!player.vault.length) h+=`<div class="dim">empty — the Order keeps it safe between cities</div>`;
  h+=`</div>`;
  MODALS.vault.body.innerHTML=h;
}

function renderHero(){
  const c=CLASSES[player.cls], w=player.equip.weapon, o=player.equip.off;
  const armor=((o&&o.armor)||0)+attr('Strength');
  let h=`<div class="sectTitle">Kaelen — Level ${player.lvl} ${player.lvl>=10?'(max)':''}</div>`;
  h+=`<div class="dim">${c.label} · ${player.gold} gold · XP ${Math.floor(player.xp)}/${xpNeed()}</div>`;
  h+=`<div class="statGrid" style="margin-top:8px">
      <div>Health <b>${pMaxHp()}</b></div><div>Energy <b>${pMaxEn()}</b></div>
      <div>Armor <b>${armor}</b></div><div>Weapon <b>${w.dmgMin}–${w.dmgMax}</b></div></div>`;
  if(player.dp>0) h+=`<div class="dim" style="color:#d98a6a">Death penalty −${Math.round(player.dp*100)}% (cleared on level-up / quest turn-in)</div>`;

  h+=`<div class="sectTitle">Attributes — <span style="color:#f0d97a">${player.attrPts}</span> points</div>`;
  for(const a of CLASS_ATTRS[player.cls]){
    const r=attr(a);
    h+=`<div class="attrRow"><span class="an">${a}</span>
        ${r>0?`<button class="mini" data-act="attrminus" data-v="${a}">−</button>`:''}
        <span class="av">${r}</span>
        ${player.attrPts>0&&r<12?`<button class="mini" data-act="attr" data-v="${a}">+</button>`:''}</div>
        <div class="attrDesc">${ATTR_DESC[a]}</div>`;
  }
  h+=`<div class="sectTitle">Equipment</div><div class="equipRow">
      <div class="eqSlot"><div class="el">WEAPON</div><span style="color:${rc(w)}">${itemIcon(w)} ${w.name}</span><br><span class="dim">${itemStat(w)}</span></div>
      <div class="eqSlot"><div class="el">OFF-HAND</div>${o?`<span style="color:${rc(o)}">${itemIcon(o)} ${o.name}</span><br><span class="dim">${itemStat(o)}</span>`:'<span class="dim">empty</span>'}</div>
      </div><div class="dim">Equip and swap gear in the Inventory (🎒).</div>`;
  MODALS.hero.body.innerHTML=h;
}

let invSel=-1;
function renderInv(){
  let h=`<div class="dim">${player.inv.length}/20 slots · tap an item</div><div class="invGrid">`;
  for(let i=0;i<20;i++){
    const it=player.inv[i];
    if(it) h+=`<div class="invSlot${invSel===i?' sel':''}" data-act="selitem" data-v="${i}"><span class="rq" style="--rc:${rc(it)}"></span>${itemIcon(it)}</div>`;
    else h+=`<div class="invSlot empty">·</div>`;
  }
  h+=`</div><div class="itemDetail">`;
  const sel=player.inv[invSel];
  if(sel){
    const equippable=sel.kind==='weapon'||sel.kind==='off';
    h+=`<b style="color:${rc(sel)}">${itemIcon(sel)} ${sel.name}</b><br><span class="dim">${itemStat(sel)}${sel.rarity?' · '+['common','uncommon','rare','unique'][sel.rarity]:''}</span>`;
    h+=`<div class="btnRow">`;
    if(equippable) h+=`<button class="btn sm" data-act="equip" data-v="${invSel}">Equip</button>`;
    h+=`<button class="btn sm" data-act="sellone" data-v="${invSel}">Sell ${Math.round(sel.value*0.5)}g</button>`;
    h+=`<button class="btn sm dn" data-act="drop" data-v="${invSel}">Drop</button></div>`;
  } else h+=`<span class="dim">Trophies sell to Merchant Suki at the outpost for full value.</span>`;
  h+=`</div>`;
  MODALS.inv.body.innerHTML=h;
}

let skillsSel=-1;
function renderSkills(){
  const editable=ZONES[MAPID].safe;
  const known=player.known[player.cls];
  let h=`<div class="sectTitle">${CLASSES[player.cls].label} — your bar</div>`;
  h+=`<div class="invGrid bar8">`;
  SKILLS.forEach((s,i)=>{
    h+=`<div class="invSlot${skillsSel===i?' sel':''}" data-act="slot" data-v="${i}">${s.icon}<span class="key">${i+1}</span></div>`;
  });
  h+=`</div>`;
  if(!editable) h+=`<div class="dim" style="color:#d9b06a">Builds can only be changed in town — the GW1 outpost rule.</div>`;
  else if(skillsSel>=0){
    h+=`<div class="sectTitle">Assign to slot ${skillsSel+1}</div>`;
    for(const id of known){
      const s=SKILL_BY_ID[id];
      const onBar=player.bars[player.cls].includes(id);
      h+=`<div class="attrRow" data-act="assign" data-v="${id}" style="cursor:pointer">
          <span class="an">${s.icon} ${s.name}${onBar?' <span class="dim">(on bar)</span>':''}</span>
          <span class="dim" style="font-size:11px">${s.adr?s.adr+' adr':(s.en>0?s.en+'e':'free')} · ${s.rc}s</span></div>`;
    }
    h+=`<div class="dim">Tap a skill to place it. ${known.length} known — learn more from Master Henko.</div>`;
  } else {
    h+=`<div class="dim">Tap a slot above to change it.</div>`;
    SKILLS.forEach((s,i)=>{
      const cost=s.adr?`${s.adr} adrenaline`:(s.en>0?`${s.en} energy`:'no cost');
      h+=`<div class="skRow"><div class="si">${s.icon}</div><div class="sd">
          <b>${i+1}. ${s.name}</b> <i>${cost}${s.cast?` · ${s.cast}s cast`:''} · ${s.rc}s recharge</i><br>
          <span class="dim">${s.desc}</span></div></div>`;
    });
  }
  h+=`<div class="sectTitle">Builds</div>
      <button class="btn sm" data-act="savebuild">💾 Save current build</button>
      <button class="btn sm" data-act="respec">↺ Refund attributes</button>`;
  const builds=player.builds||[];
  if(builds.length){
    h+=`<div style="margin-top:8px">`;
    builds.forEach((b,i)=>{
      h+=`<div class="attrRow"><span class="an">${b.name}</span>
          <button class="mini" data-act="loadbuild" data-v="${i}">Load</button>
          <button class="mini" data-act="delbuild" data-v="${i}">✕</button></div>`;
    });
    h+=`</div>`;
  } else h+=`<div class="dim" style="margin-top:6px">No saved builds yet. A build stores your skill bar and attribute spread.</div>`;
  MODALS.skills.body.innerHTML=h;
}

function renderQuestLog(){
  const row=q=>{
    let status,col;
    if(qTurned(q.id)){status='✓ complete';col='#7ac77a';}
    else if(qReady(q)){status='→ '+npcName(q.giver);col='#f0d97a';}
    else if(qActive(q)){status=q.need>1?`${qs[q.id].n}/${q.need}`:'in progress';col='#f0d97a';}
    else if(qAvailable(q)){status='see '+npcName(q.giver);col='#9fd0ff';}
    else {status='—';col='#7a715a';}
    let h2=`<div class="attrRow"><span class="an" style="color:${qActive(q)||qReady(q)?'#e8dfc8':'#9a8f6f'}">${q.name}</span>
        <span style="color:${col};font-size:12px">${status}</span></div>`;
    if(qActive(q)||qReady(q)) h2+=`<div class="attrDesc">${qReady(q)?('Return to '+npcName(q.giver)+'.'):q.prog}</div>`;
    return h2;
  };
  let h=`<div class="sectTitle">Clear Water — the story</div>`;
  for(const q of QDEFS) if(q.story) h+=row(q);
  h+=`<div class="sectTitle">Side work</div>`;
  for(const q of QDEFS) if(!q.story) h+=row(q);
  if(qTurned('s7')) h+=`<div class="dim" style="margin-top:8px">The water runs clear. Sunmere trades again — and you wear the First Watch crest.</div>`;
  MODALS.quest.body.innerHTML=h;
}

function renderSettings(){
  const chip=(act,v,label,on)=>`<button class="chip${on?' on':''}" data-act="${act}" data-v="${v}">${label}</button>`;
  let h=`<div class="sectTitle">Graphics quality</div><div class="btnRow">
      ${chip('quality','low','Low',SETTINGS.quality==='low')}
      ${chip('quality','medium','Medium',SETTINGS.quality==='medium')}
      ${chip('quality','high','High + shadows',SETTINGS.quality==='high')}</div>
      <div class="dim">Higher quality adds resolution, dynamic shadows and richer light. Lower it if the frame rate dips.</div>`;
  h+=`<div class="sectTitle">Camera</div><div class="btnRow">
      ${chip('zoom','close','Close',SETTINGS.zoom==='close')}
      ${chip('zoom','normal','Normal',SETTINGS.zoom==='normal')}
      ${chip('zoom','far','Far',SETTINGS.zoom==='far')}</div>
      <div class="btnRow">${chip('dragrot','x','Drag to rotate: '+(SETTINGS.dragRotate!==false?'on':'off'),SETTINGS.dragRotate!==false)}
      <button class="chip" data-act="recenter">⟳ Re-centre view (north)</button></div>
      <div class="dim">Drag the world to spin the camera, or use the on-screen ◀▶ by the compass, or Q/E on a keyboard.</div>`;
  h+=`<div class="sectTitle">Display</div><div class="btnRow">
      ${chip('vignette','x','Vignette: '+(SETTINGS.vignette?'on':'off'),SETTINGS.vignette)}
      <button class="chip" data-act="fullscreen">⛶ Fullscreen</button></div>
      <div class="dim">Rotate your device freely — the layout adapts to portrait or landscape.</div>`;
  // remappable controls
  const CTRLS=[['up','Move up'],['down','Move down'],['left','Move left'],['right','Move right'],
    ['rotL','Rotate camera left'],['rotR','Rotate camera right'],
    ['s1','Skill 1'],['s2','Skill 2'],['s3','Skill 3'],['s4','Skill 4'],['s5','Skill 5'],['s6','Skill 6'],['s7','Skill 7'],['s8','Skill 8']];
  h+=`<div class="sectTitle">Controls (keyboard)</div>`;
  for(const [act,label] of CTRLS){
    const key=keyListen===act?'press a key…':keyFor(act).toUpperCase();
    h+=`<div class="attrRow"><span class="an">${label}</span>
        <button class="mini" data-act="rebind" data-v="${act}">${key}</button></div>`;
  }
  h+=`<button class="btn sm" data-act="resetkeys">Reset to defaults</button>
      <div class="dim">Tap a key, then press the new key. Skills also always respond to the number row, and on mobile via the on-screen bar.</div>`;
  h+=`<div class="sectTitle">Character</div>
      <button class="btn sm dn" data-act="newgame">Delete save & restart</button>
      <div class="dim">Progress auto-saves to this device.</div>`;
  MODALS.settings.body.innerHTML=h;
}

function saveBuild(){
  player.builds=player.builds||[];
  if(player.builds.length>=6){ toast('Build slots full'); return; }
  player.builds.push({name:`${CLASSES[player.cls].icon} Build ${player.builds.length+1}`, cls:player.cls,
    attrs:{...player.attrs}, bar:[...player.bars[player.cls]]});
  saveGame(); toast('Build saved (bar + attributes)');
}
function loadBuild(i){
  const b=(player.builds||[])[i]; if(!b) return;
  if(b.cls!==player.cls){ toast('That build is for a different profession'); return; }
  const spent=Object.values(b.attrs).reduce((a,c)=>a+c,0);
  if(spent>3*(player.lvl-1)){ toast('Not enough points for that build yet'); return; }
  if(b.bar&&!ZONES[MAPID].safe){ toast('Builds can only be changed in town'); return; }
  player.attrs={...b.attrs}; player.attrPts=3*(player.lvl-1)-spent;
  if(b.bar){
    player.bars[player.cls]=b.bar.filter(id=>player.known[player.cls].includes(id));
    while(player.bars[player.cls].length<8) player.bars[player.cls].push('res');
    applyBar();
  }
  saveGame(); toast('Build loaded');
}
function toggleFullscreen(){
  try{
    if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }catch(e){}
}
function applyClass(key){
  const c=CLASSES[key];
  player.cls=key;
  player.baseHp=c.baseHp+20*(player.lvl-1); player.baseEn=c.baseEn+2*(player.lvl-1);
  player.enRegen=c.enRegen;
  player.atkInt=c.atkInt; player.range=c.range;
  player.equip.weapon=key==='warrior'
    ? {kind:'weapon',wtype:'sword',rarity:0,name:'Training Sword',dmgMin:10,dmgMax:16,value:0}
    : {kind:'weapon',wtype:'wand', rarity:0,name:'Training Wand', dmgMin:7, dmgMax:12,value:0};
  if(player.equip.off){ player.inv.push(player.equip.off); player.equip.off=null; }
  player.attrs={}; player.attrPts=3*(player.lvl-1);
  player.adr=0;
  player.hp=pMaxHp(); player.en=pMaxEn();
  if(!player.known[key]) player.known[key]=[...DEFAULT_BARS[key]];
  if(!player.bars[key]||player.bars[key].length!==8) player.bars[key]=[...DEFAULT_BARS[key]];
  applyBar();
  if(player.av&&HAS3D&&scene){ scene.remove(player.av); player.av=null; }
  const nameEl=$('pName'); if(nameEl) nameEl.textContent='Kaelen '+c.icon;
}

function showClassPick(){
  const el=$('classPick');
  el.innerHTML='<div class="cpTitle">ELDERVALE</div><div class="cpSub">choose your profession</div>';
  for(const key of Object.keys(CLASSES)){
    const c=CLASSES[key];
    const b=document.createElement('button');
    b.className='cpOpt';
    b.innerHTML=`<b>${c.icon} ${c.label}</b><br><span>${c.blurb}</span>`;
    b.addEventListener('pointerdown',ev=>{
      ev.stopPropagation(); ev.preventDefault();
      applyClass(key);
      saveGame();
      el.classList.add('hidden');
      banner('SUNMERE HARBOR','your story begins');
      setTimeout(()=>toast('Tap the ground to move · tap people to talk'),1000);
      setTimeout(()=>toast('Speak with Captain Aldra at the keep (gold ! on the compass)'),4600);
      setTimeout(()=>toast('The east gate leads to the Saltgrass Flats — the wilds'),8200);
    });
    el.appendChild(b);
  }
  el.classList.remove('hidden');
}

let currentDlg=null;
function openDialog(n){
  n=n||npcAldra;
  currentDlg=npcDialog(n);
  closeModal();
  ui.dlgName.textContent=n.name;
  ui.dlgText.textContent=currentDlg.text;
  ui.dlgBtn.textContent=currentDlg.btn;
  ui.dialog.classList.remove('hidden');
  backdrop.classList.remove('hidden');
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
  ui.pLvl.textContent='Lv '+player.lvl+(player.lvl>=10?' MAX':'')+(player.dp>0?` (−${Math.round(player.dp*100)}%)`:'');
  ui.gold.textContent=player.gold;
  if(SKILLS.some(s=>s.adr)) ui.pAdr.style.width=clamp(player.adr/10*100,0,100)+'%';
  if(heroBtn) heroBtn.style.boxShadow=player.attrPts>0?'0 0 10px #f0d97a, inset 0 1px 0 #ffffff14':'';

  ui.henchFrame.style.display=hench.recruited?'':'none';
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
    if(condActive(t,'deepwound'))conds.push('Deep Wound');
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
    if(sk.adr&&player.adr<sk.adr&&left<=0){
      // adrenaline skills: overlay recedes as adrenaline builds
      cd.style.height=((1-clamp(player.adr/sk.adr,0,1))*100)+'%';
      cdt.textContent='';
    } else if(left>0){
      cd.style.height=Math.min(100,left/sk.rc*100)+'%';
      cdt.textContent=left>0.3?Math.ceil(left):'';
    } else { cd.style.height='0%'; cdt.textContent=''; }
    const lack=sk.adr?player.adr<sk.adr:player.en<sk.en;
    b.classList.toggle('noEnergy',lack);
    b.classList.toggle('ready',!lack&&left<=0&&!cast);
    b.classList.toggle('casting',!!cast&&cast.idx===i);
  });
}
const heroBtn=document.querySelector('.menuBtn[data-modal="hero"]');

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
  for(const e of enemies) if(!e.dead&&!e.hidden) dot(e.x,e.y,e.boss?'#ff3030':'#e05040',e.boss?8:5);
  for(const n of npcs) dot(n.x,n.y,npcMarker(n)?'#f0d97a':'#d8b860',npcMarker(n)?6:5);
  for(const g of GATES) dot(g.x,g.y,g.locked?'#888':'#9fd0ff',6);
  dot(SHRINE.x,SHRINE.y,'#b8c8ff',5);
  if(heroActive()) dot(hench.x,hench.y,'#50c878',5);
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
let lastT=performance.now(), frameNo=0, frameDt=1/60;
function loop(tms){
  requestAnimationFrame(loop);
  let dt=(tms-lastT)/1000; lastT=tms;
  dt=Math.min(dt,0.05);
  now+=dt; frameNo++; frameDt=dt;

  updatePlayer(dt);
  updateHench(dt);
  for(const e of enemies) updateEnemy(e,dt);
  updateProjectiles(dt);

  render();
  // HUD redraws don't need 60fps
  if(frameNo%3===0) drawCompass();
  if(frameNo%2===0) syncUI();
  if(openModalId==='map'&&frameNo%30===0) renderMap(); // live map while open
  // autosave a few seconds after the last meaningful change
  saveTimer+=dt;
  if(saveTimer>8){ saveTimer=0; saveGame(); }
}

function applySave(s){
  if(s.known) player.known=s.known;
  if(s.bars) player.bars=s.bars;
  player.skillPts=s.skillPts??1;
  applyClass(s.cls||'warrior');
  player.lvl=s.lvl||1; player.xp=s.xp||0; player.gold=s.gold||0; player.dp=s.dp||0;
  player.baseHp=CLASSES[player.cls].baseHp+20*(player.lvl-1);
  player.baseEn=CLASSES[player.cls].baseEn+2*(player.lvl-1);
  player.attrs=s.attrs||{}; player.attrPts=s.attrPts??0;
  player.inv=Array.isArray(s.inv)?s.inv:[];
  player.builds=Array.isArray(s.builds)?s.builds:[];
  player.promo=s.promo||0; player.bounty=s.bounty||null;
  player.vault=Array.isArray(s.vault)?s.vault:[];
  if(s.equip&&s.equip.weapon) player.equip=s.equip;
  // everyone always knows the Signet of Capture
  for(const cls of ['warrior','elementalist']) if(player.known[cls]&&!player.known[cls].includes('cap')) player.known[cls].push('cap');
  if(s.qs) Object.assign(qs,s.qs);
  hench.lvl=player.lvl; hench.maxHp=110+18*Math.max(0,player.lvl-2); hench.hp=hench.maxHp;
  hench.dmgMin=9+2*Math.max(0,player.lvl-2); hench.dmgMax=hench.dmgMin+5;
  if(s.hero){ hench.recruited=!!s.hero.recruited; hench.stance=s.hero.stance||'guard'; }
  player.hp=pMaxHp(); player.en=pMaxEn();
}

/* ---------------- boot ---------------- */
loadSettings();
const _save=loadSaveData();
MAPID=(_save&&_save.zone&&ZONES[_save.zone])?_save.zone:'town';
buildZone();
buildMinimap();
player=makePlayer();
{ // place the new player at the zone start
  const st=ZONES[MAPID].enterFrom.start;
  const p0=findOpen(st[0],st[1]); player.x=p0.x; player.y=p0.y;
}
hench=makeHench();
{ const p1=findOpen(Math.floor(player.x/TILE),Math.floor(player.y/TILE)+1); hench.x=p1.x; hench.y=p1.y; }
ZONES[MAPID].spawn();
if(HAS3D){ initThree(); loadCharacterModels(); }
wireUI();
buildSkillbar();
resize();
if(_save&&_save.cls){
  applySave(_save);
  banner(ZONES[MAPID].name.toUpperCase(),ZONES[MAPID].sub);
  setTimeout(()=>toast('Welcome back, '+CLASSES[player.cls].label.split(' ')[0]),1000);
} else {
  showClassPick();
}
requestAnimationFrame(loop);
