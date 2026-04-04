// ─── Penalty Shootout — Phaser 3 Self-Contained Game ─────────────────────────
// Injected config: window.GAME_CONFIG (set via injectedJavaScriptBeforeContentLoaded)
// postMessage protocol:
//   Game → RN: { type:'result', homeScore, awayScore, winnerId }
//               { type:'restart' }
//               { type:'back' }

export const PENALTY_GAME_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=no"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000;overflow:hidden;touch-action:none}
canvas{display:block;touch-action:none}
</style>
</head>
<body>
<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
<script>
// ═══════════════════════════════════════════════════════════════════
// DEFAULT CONFIG (dev fallback when not injected by React Native)
// ═══════════════════════════════════════════════════════════════════
var DEFAULT_CONFIG = {
  homeTeam:{ id:'tur', name:'Turkiye', flag:'🇹🇷', kitColor:0xe74c3c, penalty_skill:77, goalkeeper_rating:72 },
  awayTeam:{ id:'eng', name:'England', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', kitColor:0x3333cc, penalty_skill:52, goalkeeper_rating:78 },
  mode:'best_of_5',
  userTeam:'home'
};

// ═══════════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════════════
var W=414, H=736;

var SKY_H    = 105;
var STANDS_Y = 105;
var STANDS_H = 48;
var AD_Y     = 153;
var AD_H     = 17;
var PITCH_Y  = 170;

var GOAL_W   = 240;
var GOAL_H   = 184;
var GOAL_X   = Math.round((W-GOAL_W)/2);   // 87
var GOAL_Y   = 175;
var POST_W   = 8;
var CBAR_H   = 8;

var INNER_X  = GOAL_X + POST_W;            // 95
var INNER_Y  = GOAL_Y + CBAR_H;            // 183
var INNER_W  = GOAL_W - POST_W*2;          // 224
var INNER_H  = GOAL_H - CBAR_H;            // 176
var ZONE_W   = INNER_W/3;                  // ~74.7
var ZONE_H   = INNER_H/3;                  // ~58.7

var SPOT_X   = W/2;                        // 207
var SPOT_Y   = 430;
var KICKER_X = W/2;
var KICKER_Y = 488;
var GK_X     = W/2;
var GK_Y     = GOAL_Y + Math.round(GOAL_H*0.42); // ~252

var CTRL_Y   = 510;   // controls start below this line

// Accuracy ring radii
var RING_MAX  = INNER_W/2;   // ~112
var RING_MIN  = 16;

// ═══════════════════════════════════════════════════════════════════
// HELPER: ZONE → WORLD CENTER
// ═══════════════════════════════════════════════════════════════════
function zoneCenter(z) {
  var col = z%3, row = Math.floor(z/3);
  return {
    x: INNER_X + col*ZONE_W + ZONE_W/2,
    y: INNER_Y + row*ZONE_H + ZONE_H/2
  };
}
function aimToZone(ax, ay) {
  var col = Math.floor((ax - INNER_X) / ZONE_W);
  var row = Math.floor((ay - INNER_Y) / ZONE_H);
  col = Math.max(0, Math.min(2, col));
  row = Math.max(0, Math.min(2, row));
  return row*3 + col;
}
function zoneCovers(gkDive, zone) {
  var col = zone%3;
  if (gkDive==='left')   return col===0;
  if (gkDive==='right')  return col===2;
  if (gkDive==='center') return col===1;
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// SHOT RESOLUTION
// ═══════════════════════════════════════════════════════════════════
function generateGKDive(gkRating) {
  var centerProb = 0.05 + gkRating*0.0017;
  var r = Math.random();
  if (r < centerProb) return 'center';
  if (r < centerProb + (1-centerProb)/2) return 'left';
  return 'right';
}
function resolveUserShot(zone, power, accuracy, technique, gkDive, gkRating) {
  if (technique==='panenka') {
    if (gkDive!=='center') return 'goal';
    return Math.random() < gkRating*0.5/100 ? 'saved' : 'goal';
  }
  if (accuracy<15) return 'miss';
  if (power<20) return 'saved';
  var covers = zoneCovers(gkDive, zone);
  var saveProb = covers ? 0.25+gkRating*0.006 : 0.04;
  return Math.random()<saveProb ? 'saved' : 'goal';
}
function resolveCPUShot(penaltySkill, gkRating) {
  var gkDive = generateGKDive(gkRating);
  var goalProb = 0.50 + penaltySkill*0.004;
  var isGoal = Math.random()<goalProb;
  var zones = [0,1,2,3,4,5,6,7,8];
  var preferred = isGoal
    ? zones.filter(function(z){return !zoneCovers(gkDive,z);})
    : zones.filter(function(z){return  zoneCovers(gkDive,z);});
  if (!preferred.length) preferred = zones;
  var zone = preferred[Math.floor(Math.random()*preferred.length)];
  var tech = Math.random()<0.05 ? 'panenka' : Math.random()<0.25 ? 'power' : 'regular';
  var power    = isGoal ? 60+Math.random()*40 : 30+Math.random()*40;
  var accuracy = isGoal ? 60+Math.random()*40 : 10+Math.random()*40;
  var outcome  = resolveUserShot(zone,power,accuracy,tech,gkDive,gkRating);
  return { zone:zone, power:power, accuracy:accuracy, technique:tech, gkDive:gkDive, outcome:outcome };
}
function checkShootoutEnd(kicks, mode, homeId, awayId) {
  var hk=kicks.filter(function(k){return k.teamId===homeId;});
  var ak=kicks.filter(function(k){return k.teamId===awayId;});
  var hs=hk.filter(function(k){return k.outcome==='goal';}).length;
  var as=ak.filter(function(k){return k.outcome==='goal';}).length;
  var ht=hk.length, at=ak.length, MAX=5;
  if (mode==='sudden_death') {
    if (ht===at && ht>=1 && hs!==as) return { ended:true, winner:hs>as?homeId:awayId, tieBreaker:false };
    return { ended:false, winner:null, tieBreaker:false };
  }
  if (ht===at) {
    var done=ht, rem=MAX-done;
    if (done===MAX) {
      if (hs!==as) return { ended:true, winner:hs>as?homeId:awayId, tieBreaker:false };
      return { ended:true, winner:null, tieBreaker:true };
    }
    if (hs-as>rem) return { ended:true, winner:homeId, tieBreaker:false };
    if (as-hs>rem) return { ended:true, winner:awayId, tieBreaker:false };
  }
  if (ht===at+1) {
    var rem2=MAX-ht;
    if (hs>as+rem2+(at<MAX?1:0)) return { ended:true, winner:homeId, tieBreaker:false };
    if (as>hs+rem2) return { ended:true, winner:awayId, tieBreaker:false };
  }
  return { ended:false, winner:null, tieBreaker:false };
}

// ═══════════════════════════════════════════════════════════════════
// COMMENTARY
// ═══════════════════════════════════════════════════════════════════
var LINES = {
  goal:  ['GOL!! ⚽','GOLAZO!!','Inanilmaz gol!','Muhtesem!','SIUUUU! 🔥','EVET EVET EVET!','FILE HAVALANIYOOR!','Penaltilarda her sey olur!'],
  saved: ['Kaleci cuval olmadi! 🧤','SAVED! 🧤','Yakaladi!','Yok artik! Muhtis kurtaris!','Kaleci efsane!','Eldiven kayalara carpti!'],
  miss:  ['Direkten dondu! 😬','MISS! 😬','Yok artik!','Kel kaleye cakti!','Acik kaleye kacirdi!!','Felaket miss! Tribunlere gitti!']
};
function pickLine(outcome) {
  var pool=LINES[outcome]||LINES.miss;
  return pool[Math.floor(Math.random()*pool.length)];
}

// ═══════════════════════════════════════════════════════════════════
// POSTMESSAGE
// ═══════════════════════════════════════════════════════════════════
function postToRN(data) {
  var msg = JSON.stringify(data);
  try {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    else window.parent.postMessage(msg,'*');
  } catch(e){}
}

// ═══════════════════════════════════════════════════════════════════
// COLOR HELPERS
// ═══════════════════════════════════════════════════════════════════
function lighten(hex, amt) {
  var r=Math.min(255,((hex>>16)&0xff)+amt);
  var g=Math.min(255,((hex>>8)&0xff)+amt);
  var b=Math.min(255,(hex&0xff)+amt);
  return (r<<16)|(g<<8)|b;
}
function darken(hex, amt) { return lighten(hex,-amt); }

// ═══════════════════════════════════════════════════════════════════
// PRELOAD SCENE
// ═══════════════════════════════════════════════════════════════════
var PreloadScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function PreloadScene() { Phaser.Scene.call(this,{key:'PreloadScene'}); },
  create: function() { this.scene.start('GameScene'); }
});

// ═══════════════════════════════════════════════════════════════════
// GAME SCENE
// ═══════════════════════════════════════════════════════════════════
var GameScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function GameScene() { Phaser.Scene.call(this,{key:'GameScene'}); },

  // ─────────────────────────────────────────────────────────────────
  create: function() {
    var self = this;
    this.cfg  = window.GAME_CONFIG || DEFAULT_CONFIG;

    // Ensure kitColor is a number
    if (typeof this.cfg.homeTeam.kitColor === 'string')
      this.cfg.homeTeam.kitColor = parseInt(this.cfg.homeTeam.kitColor);
    if (typeof this.cfg.awayTeam.kitColor === 'string')
      this.cfg.awayTeam.kitColor = parseInt(this.cfg.awayTeam.kitColor);

    // ── Game state ──────────────────────────────────────────────────
    this.phase       = 'intro';
    this.mode        = this.cfg.mode || 'best_of_5';
    this.userTeam    = this.cfg.userTeam || 'home';
    this.kicks       = [];
    this.homeScore   = 0;
    this.awayScore   = 0;
    this.round       = 1;
    this.currentSide = 'home';
    this.shootoutDone = false;

    // ── Shot build-up ───────────────────────────────────────────────
    this.pendingTech  = 'regular';
    this.pendingZone  = 4;
    this.pendingPower = 0;
    this.pendingGKDive= null;
    this.aimX = W/2;
    this.aimY = INNER_Y + INNER_H/2;

    // ── Power bar ───────────────────────────────────────────────────
    this.holdingPower = false;
    this.powerFillPct = 0;

    // ── Accuracy ring ───────────────────────────────────────────────
    this.ringData  = { radius: RING_MAX };
    this.ringTween = null;

    // ── Build scene ─────────────────────────────────────────────────
    this._buildSky();
    this._buildCrowd();
    this._buildAdBoards();
    this._buildPitch();
    this._buildNet();
    this._buildPosts();
    this._buildGK();
    this._buildKicker();
    this._buildBall();
    this._buildUI();

    // ── Global input ────────────────────────────────────────────────
    this.input.on('pointermove', function(p){ self._onPointerMove(p); });
    this.input.on('pointerdown', function(p){ self._onPointerDown(p); });
    this.input.on('pointerup',   function(p){ self._onPointerUp(p); });

    this._startIntro();
  },

  // ─────────────────────────────────────────────────────────────────
  // BACKGROUND: SKY + STARS + FLOODLIGHT GLOW
  // ─────────────────────────────────────────────────────────────────
  _buildSky: function() {
    var g = this.add.graphics().setDepth(0);

    // Night sky gradient (two rectangles approximation)
    g.fillGradientStyle(0x0a0a2e, 0x0a0a2e, 0x1a1a4e, 0x1a1a4e, 1);
    g.fillRect(0, 0, W, SKY_H);

    // Stars
    g.fillStyle(0xffffff, 0.7);
    var rand = new Phaser.Math.RandomDataGenerator(['penalty-stars']);
    for (var i=0;i<55;i++) {
      var sx = rand.integerInRange(0, W);
      var sy = rand.integerInRange(0, SKY_H-10);
      var ss = rand.realInRange(0.5, 1.5);
      g.fillRect(sx, sy, ss, ss);
    }

    // Floodlight glow blobs at top corners
    g.fillStyle(0xffff88, 0.18);
    g.fillCircle(20, 8,  45);
    g.fillCircle(W-20, 8, 45);
    g.fillStyle(0xffff44, 0.10);
    g.fillCircle(20, 8,  75);
    g.fillCircle(W-20, 8, 75);

    // Floodlight poles (depth 2)
    var pg = this.add.graphics().setDepth(2);
    pg.fillStyle(0x888888);
    pg.fillRect(8,  20, 5, SKY_H-20);
    pg.fillRect(W-13, 20, 5, SKY_H-20);
    // Light housings
    pg.fillStyle(0xdddd55);
    pg.fillRect(4,  16, 13, 7);
    pg.fillRect(W-17, 16, 13, 7);
    // Extra pole arms
    pg.fillStyle(0x777777);
    pg.fillRect(10, 22, 30, 3);
    pg.fillRect(W-40, 22, 30, 3);
  },

  // ─────────────────────────────────────────────────────────────────
  // CROWD (depth 1)
  // ─────────────────────────────────────────────────────────────────
  _buildCrowd: function() {
    var homeKit = this.cfg.homeTeam.kitColor;
    var awayKit = this.cfg.awayTeam.kitColor;

    // Stand backgrounds
    var bg = this.add.graphics().setDepth(1);
    bg.fillStyle(0x1c1010);
    bg.fillRect(0, STANDS_Y, W/2, STANDS_H);
    bg.fillStyle(0x10101c);
    bg.fillRect(W/2, STANDS_Y, W/2, STANDS_H);

    this.homeCrowd = [];
    this.awayCrowd = [];

    var ROWS=4, FIGS=24;
    var FW=6, FH=9, HR=3;

    for (var row=0;row<ROWS;row++) {
      var rowY = STANDS_Y + 4 + row*(STANDS_H/ROWS);
      for (var fi=0;fi<FIGS;fi++) {
        // Deterministic jitter using fi+row as seed
        var jx = ((fi*7+row*13)%9 - 4) * 0.8;
        var jy = ((fi*3+row*11)%7 - 3) * 0.5;

        // HOME (left half)
        var hx = 4 + fi*((W/2-8)/FIGS) + jx;
        var hy = rowY + jy;
        var hColor = fi%3===0 ? homeKit : lighten(homeKit, 35);
        var hg = this.add.graphics().setDepth(1);
        hg.fillStyle(hColor);
        hg.fillRect(-FW/2, 0, FW, FH);
        hg.fillStyle(0xf4c07a);
        hg.fillCircle(0, -HR-1, HR);
        hg.setPosition(hx, hy);
        this.homeCrowd.push({ gfx:hg, baseY:hy });

        // AWAY (right half)
        var ax = W/2+4 + fi*((W/2-8)/FIGS) + jx;
        var ay = rowY + jy;
        var aColor = fi%3===0 ? awayKit : lighten(awayKit, 35);
        var ag = this.add.graphics().setDepth(1);
        ag.fillStyle(aColor);
        ag.fillRect(-FW/2, 0, FW, FH);
        ag.fillStyle(0xf4c07a);
        ag.fillCircle(0, -HR-1, HR);
        ag.setPosition(ax, ay);
        this.awayCrowd.push({ gfx:ag, baseY:ay });
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────
  // AD BOARDS (depth 3)
  // ─────────────────────────────────────────────────────────────────
  _buildAdBoards: function() {
    var panels = [
      {c:0xbb1111, t:'FITBOLPIX'},
      {c:0xaa8800, t:'WC 2026'},
      {c:0x116611, t:'GOL! ⚽'},
      {c:0x1144aa, t:'FITBOLPIX'},
      {c:0xbb1111, t:'WC 2026'},
    ];
    var pw = W/panels.length;
    var g = this.add.graphics().setDepth(3);
    for (var i=0;i<panels.length;i++) {
      g.fillStyle(panels[i].c);
      g.fillRect(i*pw, AD_Y, pw-1, AD_H);
      this.add.text(i*pw+pw/2, AD_Y+AD_H/2, panels[i].t,
        {fontFamily:'monospace',fontSize:'7px',color:'#ffffff',fontStyle:'bold'}
      ).setOrigin(0.5).setDepth(3);
    }
    // Border
    g.lineStyle(1, 0x000000, 0.5);
    g.strokeRect(0, AD_Y, W, AD_H);
  },

  // ─────────────────────────────────────────────────────────────────
  // PITCH (depth 4)
  // ─────────────────────────────────────────────────────────────────
  _buildPitch: function() {
    var g = this.add.graphics().setDepth(4);
    var sw = W/6;
    // Alternating stripe rows
    for (var i=0;i<6;i++) {
      g.fillStyle(i%2===0 ? 0x2d7a3a : 0x266b32);
      g.fillRect(i*sw, PITCH_Y, sw, H-PITCH_Y);
    }
    // Goal line
    g.lineStyle(2, 0xffffff, 0.45);
    g.beginPath(); g.moveTo(GOAL_X-4, GOAL_Y+GOAL_H); g.lineTo(GOAL_X+GOAL_W+4, GOAL_Y+GOAL_H); g.strokePath();
    // Penalty box
    var PBW=GOAL_W*1.5, PBH=100, PBX=(W-PBW)/2, PBY=GOAL_Y+GOAL_H;
    g.lineStyle(2, 0xffffff, 0.55);
    g.strokeRect(PBX, PBY, PBW, PBH);
    // Six-yard box
    var SBW=GOAL_W*0.68, SBH=38, SBX=(W-SBW)/2;
    g.strokeRect(SBX, PBY, SBW, SBH);
    // Penalty arc
    g.lineStyle(2, 0xffffff, 0.4);
    g.beginPath();
    g.arc(SPOT_X, SPOT_Y, 68, -Math.PI*0.85, -Math.PI*0.15, false);
    g.strokePath();
    // Penalty spot
    g.fillStyle(0xffffff, 0.75);
    g.fillCircle(SPOT_X, SPOT_Y, 4);
  },

  // ─────────────────────────────────────────────────────────────────
  // NET (depth 5)
  // ─────────────────────────────────────────────────────────────────
  _buildNet: function() {
    this.netGfx = this.add.graphics().setDepth(5);
    this._drawNet(1.0);
  },
  _drawNet: function(scaleX) {
    var g = this.netGfx;
    g.clear();
    var nx=INNER_X, ny=INNER_Y, nw=INNER_W, nh=INNER_H;
    // Net background
    g.fillStyle(0x000000, 0.20);
    g.fillRect(nx, ny, nw, nh);
    // Grid vertical lines
    g.lineStyle(1, 0xcccccc, 0.18);
    var step = 18;
    for (var x=nx; x<=nx+nw; x+=step) {
      g.beginPath(); g.moveTo(x,ny); g.lineTo(x,ny+nh); g.strokePath();
    }
    // Grid horizontal lines
    for (var y=ny; y<=ny+nh; y+=13) {
      g.beginPath(); g.moveTo(nx,y); g.lineTo(nx+nw,y); g.strokePath();
    }
    // Net depth shading (darker at back)
    g.fillStyle(0x000000, 0.12);
    g.fillRect(nx, ny, nw, nh*0.3);
  },

  // ─────────────────────────────────────────────────────────────────
  // GOAL POSTS (depth 6) — 3-D cube look
  // ─────────────────────────────────────────────────────────────────
  _buildPosts: function() {
    var g = this.add.graphics().setDepth(6);
    // 3-D shadows
    g.fillStyle(0x444444);
    g.fillRect(GOAL_X+POST_W+3,        GOAL_Y+3, POST_W-2, GOAL_H);
    g.fillRect(GOAL_X+GOAL_W-POST_W+3, GOAL_Y+3, POST_W-2, GOAL_H);
    g.fillRect(GOAL_X+3,               GOAL_Y+CBAR_H+3, GOAL_W, CBAR_H-2);
    // White posts
    g.fillStyle(0xffffff);
    g.fillRect(GOAL_X,                GOAL_Y, POST_W, GOAL_H);
    g.fillRect(GOAL_X+GOAL_W-POST_W,  GOAL_Y, POST_W, GOAL_H);
    g.fillRect(GOAL_X,                GOAL_Y, GOAL_W, CBAR_H);
    // Subtle inner edge highlight
    g.fillStyle(0xdddddd, 0.5);
    g.fillRect(GOAL_X+POST_W-2,       GOAL_Y+CBAR_H, 2, GOAL_H-CBAR_H);
    g.fillRect(GOAL_X+GOAL_W-POST_W,  GOAL_Y+CBAR_H, 2, GOAL_H-CBAR_H);
  },

  // ─────────────────────────────────────────────────────────────────
  // GK SPRITE (depth 7) — pixel-art from Graphics
  // ─────────────────────────────────────────────────────────────────
  _buildGK: function() {
    this.gkContainer = this.add.container(GK_X, GK_Y).setDepth(7);
    this.gkParts = {};

    // Create one Graphics per part so we can tween them individually
    var parts = ['body','shorts','legL','legR','bootL','bootR',
                 'armL','armR','gloveL','gloveR','head','hair','number'];
    var self = this;
    parts.forEach(function(name) {
      var g = self.add.graphics();
      self.gkParts[name] = g;
      self.gkContainer.add(g);
    });
    this._redrawGK('idle');
    this._startGKIdle();
  },

  _redrawGK: function(pose) {
    var p = this.gkParts;
    var kit = this.cfg.awayTeam.kitColor;
    // GKs usually wear a contrasting colour — darken if white, otherwise use kit
    var gkKit = (kit > 0xe0e0e0) ? 0x00aa55 : kit;
    var skin  = 0xf5cba7;

    Object.keys(p).forEach(function(k){ p[k].clear(); });

    // Body (kit)
    p.body.fillStyle(gkKit);
    p.body.fillRect(-13,-10,26,20);
    // Kit number stripe
    p.body.fillStyle(0xffffff,0.4);
    p.body.fillRect(-4,-8,8,2);
    // Shorts
    p.shorts.fillStyle(0x1a1a33);
    p.shorts.fillRect(-12,10,24,12);

    if (pose==='idle'||pose==='standing') {
      // Legs
      p.legL.fillStyle(skin); p.legL.fillRect(-11,22,9,18);
      p.legR.fillStyle(skin); p.legR.fillRect(2,22,9,18);
      // Boots
      p.bootL.fillStyle(0x111111); p.bootL.fillRect(-12,38,11,6);
      p.bootR.fillStyle(0x111111); p.bootR.fillRect(1,38,11,6);
      // Arms (slightly out — GK ready stance)
      p.armL.fillStyle(gkKit); p.armL.fillRect(-26,-7,13,7);
      p.armR.fillStyle(gkKit); p.armR.fillRect(13,-7,13,7);
      // Gloves
      p.gloveL.fillStyle(0xffffff); p.gloveL.fillRect(-30,-9,9,9);
      p.gloveR.fillStyle(0xffffff); p.gloveR.fillRect(21,-9,9,9);
    } else if (pose==='diveL') {
      p.legL.fillStyle(skin); p.legL.fillRect(-18,18,9,16);
      p.legR.fillStyle(skin); p.legR.fillRect(4,8,9,22);
      p.bootL.fillStyle(0x111111); p.bootL.fillRect(-19,32,11,6);
      p.bootR.fillStyle(0x111111); p.bootR.fillRect(3,28,11,6);
      p.armL.fillStyle(gkKit); p.armL.fillRect(-38,-16,16,7);
      p.armR.fillStyle(gkKit); p.armR.fillRect(14,2,12,7);
      p.gloveL.fillStyle(0xffffff); p.gloveL.fillRect(-42,-18,10,10);
      p.gloveR.fillStyle(0xffffff); p.gloveR.fillRect(20,1,9,9);
    } else if (pose==='diveR') {
      p.legL.fillStyle(skin); p.legL.fillRect(-13,8,9,22);
      p.legR.fillStyle(skin); p.legR.fillRect(9,18,9,16);
      p.bootL.fillStyle(0x111111); p.bootL.fillRect(-14,28,11,6);
      p.bootR.fillStyle(0x111111); p.bootR.fillRect(8,32,11,6);
      p.armL.fillStyle(gkKit); p.armL.fillRect(-26,2,12,7);
      p.armR.fillStyle(gkKit); p.armR.fillRect(22,-16,16,7);
      p.gloveL.fillStyle(0xffffff); p.gloveL.fillRect(-30,1,9,9);
      p.gloveR.fillStyle(0xffffff); p.gloveR.fillRect(32,-18,10,10);
    } else if (pose==='save') {
      // arms extended, triumphant
      p.legL.fillStyle(skin); p.legL.fillRect(-11,22,9,18);
      p.legR.fillStyle(skin); p.legR.fillRect(2,22,9,18);
      p.bootL.fillStyle(0x111111); p.bootL.fillRect(-12,38,11,6);
      p.bootR.fillStyle(0x111111); p.bootR.fillRect(1,38,11,6);
      p.armL.fillStyle(gkKit); p.armL.fillRect(-34,-12,16,7);
      p.armR.fillStyle(gkKit); p.armR.fillRect(18,-12,16,7);
      p.gloveL.fillStyle(0xffffff); p.gloveL.fillRect(-38,-14,10,10);
      p.gloveR.fillStyle(0xffffff); p.gloveR.fillRect(28,-14,10,10);
    } else if (pose==='beaten') {
      // slumped
      p.legL.fillStyle(skin); p.legL.fillRect(-11,22,9,18);
      p.legR.fillStyle(skin); p.legR.fillRect(2,22,9,18);
      p.bootL.fillStyle(0x111111); p.bootL.fillRect(-12,38,11,6);
      p.bootR.fillStyle(0x111111); p.bootR.fillRect(1,38,11,6);
      p.armL.fillStyle(gkKit); p.armL.fillRect(-18,4,12,7);
      p.armR.fillStyle(gkKit); p.armR.fillRect(6,4,12,7);
      p.gloveL.fillStyle(0xffffff); p.gloveL.fillRect(-20,3,9,9);
      p.gloveR.fillStyle(0xffffff); p.gloveR.fillRect(11,3,9,9);
    }

    // Head (all poses — position adjusted per pose)
    p.head.fillStyle(skin);
    p.head.fillCircle(0,-22,11);
    // Hair
    p.hair.fillStyle(0x443322);
    p.hair.fillRect(-11,-33,22,10);
  },

  _startGKIdle: function() {
    var self = this;
    this.gkIdleTween = this.tweens.add({
      targets: this.gkContainer,
      x: GK_X+18, yoyo:true, repeat:-1,
      duration:620, ease:'Sine.easeInOut'
    });
  },

  // ─────────────────────────────────────────────────────────────────
  // KICKER SPRITE (depth 8)
  // ─────────────────────────────────────────────────────────────────
  _buildKicker: function() {
    this.kickerContainer = this.add.container(KICKER_X, KICKER_Y).setDepth(8);
    this.kickerParts = {};
    var self = this;
    ['body','shorts','legL','legR','bootL','bootR','armL','armR','head','hair'].forEach(function(n){
      var g = self.add.graphics();
      self.kickerParts[n] = g;
      self.kickerContainer.add(g);
    });
    this._redrawKicker('idle');
    this._startKickerIdle();
  },

  _redrawKicker: function(pose) {
    var p = this.kickerParts;
    var kit = this.cfg.homeTeam.kitColor;
    var skin= 0xf5cba7;
    Object.keys(p).forEach(function(k){ p[k].clear(); });

    p.body.fillStyle(kit); p.body.fillRect(-14,-11,28,22);
    // Kit side stripe
    p.body.fillStyle(0xffffff,0.25); p.body.fillRect(-14,-11,3,22); p.body.fillRect(11,-11,3,22);
    p.shorts.fillStyle(0x111133); p.shorts.fillRect(-13,11,26,13);

    if (pose==='idle'||pose==='standing') {
      p.legL.fillStyle(skin); p.legL.fillRect(-12,24,10,20);
      p.legR.fillStyle(skin); p.legR.fillRect(2,24,10,20);
      p.bootL.fillStyle(0x111111); p.bootL.fillRect(-13,42,13,7);
      p.bootR.fillStyle(0x111111); p.bootR.fillRect(0,42,13,7);
      p.armL.fillStyle(kit); p.armL.fillRect(-24,-9,10,9);
      p.armR.fillStyle(kit); p.armR.fillRect(14,-9,10,9);
    } else if (pose==='runup') {
      p.legL.fillStyle(skin); p.legL.fillRect(-12,16,10,22);
      p.legR.fillStyle(skin); p.legR.fillRect(2,24,10,15);
      p.bootL.fillStyle(0x111111); p.bootL.fillRect(-13,36,13,7);
      p.bootR.fillStyle(0x111111); p.bootR.fillRect(0,37,13,7);
      p.armL.fillStyle(kit); p.armL.fillRect(-24,-3,10,9);
      p.armR.fillStyle(kit); p.armR.fillRect(14,-14,10,9);
    } else if (pose==='kick') {
      // Plant left leg, right leg swings up
      p.legL.fillStyle(skin); p.legL.fillRect(-12,24,10,22);
      p.legR.fillStyle(skin); p.legR.fillRect(4,8,10,18);
      p.bootL.fillStyle(0x111111); p.bootL.fillRect(-13,44,13,7);
      p.bootR.fillStyle(0x111111); p.bootR.fillRect(4,24,13,7);
      p.armL.fillStyle(kit); p.armL.fillRect(-28,-16,10,9);
      p.armR.fillStyle(kit); p.armR.fillRect(14,-4,10,9);
    } else if (pose==='celebrate') {
      p.legL.fillStyle(skin); p.legL.fillRect(-12,24,10,20);
      p.legR.fillStyle(skin); p.legR.fillRect(2,24,10,20);
      p.bootL.fillStyle(0x111111); p.bootL.fillRect(-13,42,13,7);
      p.bootR.fillStyle(0x111111); p.bootR.fillRect(0,42,13,7);
      p.armL.fillStyle(kit); p.armL.fillRect(-28,-26,10,9);  // arms raised
      p.armR.fillStyle(kit); p.armR.fillRect(18,-26,10,9);
    } else if (pose==='despair') {
      p.legL.fillStyle(skin); p.legL.fillRect(-12,28,10,20);
      p.legR.fillStyle(skin); p.legR.fillRect(2,28,10,20);
      p.bootL.fillStyle(0x111111); p.bootL.fillRect(-13,46,13,7);
      p.bootR.fillStyle(0x111111); p.bootR.fillRect(0,46,13,7);
      p.armL.fillStyle(kit); p.armL.fillRect(-16,-4,10,9);   // hands to face
      p.armR.fillStyle(kit); p.armR.fillRect(6,-4,10,9);
    }

    p.head.fillStyle(skin); p.head.fillCircle(0,-23,12);
    p.hair.fillStyle(0x221100); p.hair.fillRect(-12,-35,24,11);
  },

  _startKickerIdle: function() {
    this.kickerBreathTween = this.tweens.add({
      targets: this.kickerContainer,
      scaleX:1.02, scaleY:1.02,
      yoyo:true, repeat:-1, duration:800, ease:'Sine.easeInOut'
    });
    this.kickerShiftTween = this.tweens.add({
      targets: this.kickerContainer,
      x: KICKER_X+3, yoyo:true, repeat:-1,
      duration:1300, ease:'Sine.easeInOut'
    });
  },

  // ─────────────────────────────────────────────────────────────────
  // BALL (depth 9)
  // ─────────────────────────────────────────────────────────────────
  _buildBall: function() {
    this.ballGfx    = this.add.graphics().setDepth(9);
    this.ballShadow = this.add.graphics().setDepth(8);
    this.ballPos    = { x:SPOT_X, y:SPOT_Y };
    this.ballScale  = 1.0;
    this._redrawBall();
  },
  _redrawBall: function() {
    var x=this.ballPos.x, y=this.ballPos.y, s=this.ballScale, r=10*s;
    // Shadow
    this.ballShadow.clear();
    this.ballShadow.fillStyle(0x000000,0.28);
    this.ballShadow.fillEllipse(x, SPOT_Y+6, 22*s, 8*s);
    // Ball
    this.ballGfx.clear();
    this.ballGfx.fillStyle(0xffffff);
    this.ballGfx.fillCircle(x, y, r);
    // Patches
    this.ballGfx.fillStyle(0x1a1a1a);
    this.ballGfx.fillCircle(x,      y-r*0.36, r*0.28);
    this.ballGfx.fillCircle(x-r*0.42, y+r*0.22, r*0.22);
    this.ballGfx.fillCircle(x+r*0.42, y+r*0.22, r*0.22);
    // Seam
    this.ballGfx.lineStyle(0.8, 0x888888, 0.5);
    this.ballGfx.strokeCircle(x, y, r);
  },

  // ─────────────────────────────────────────────────────────────────
  // UI LAYER
  // ─────────────────────────────────────────────────────────────────
  _buildUI: function() {
    this._buildScoreTracker();
    this._buildTechniqueButtons();
    this._buildAimUI();
    this._buildPowerBarUI();
    this._buildAccuracyRingUI();
    this._buildCommentaryUI();
    this._buildTurnBanner();
    this._buildIntroUI();
    this._buildResultUI();
  },

  // ── SCORE TRACKER ─────────────────────────────────────────────────
  _buildScoreTracker: function() {
    var D=10;
    this.scoreBg = this.add.graphics().setDepth(D);
    this.scoreBg.fillStyle(0x000000,0.72);
    this.scoreBg.fillRoundedRect(8,5,W-16,96,10);
    this.scoreBg.lineStyle(1,0x334455,0.5);
    this.scoreBg.strokeRoundedRect(8,5,W-16,96,10);

    // Team names
    this.scoreHomeName = this.add.text(18,12,'',{
      fontFamily:'monospace',fontSize:'11px',color:'#ffffff',fontStyle:'bold'
    }).setDepth(D);
    this.scoreAwayName = this.add.text(W-18,12,'',{
      fontFamily:'monospace',fontSize:'11px',color:'#ffffff',fontStyle:'bold'
    }).setOrigin(1,0).setDepth(D);

    // Score
    this.scoreTxt = this.add.text(W/2,10,'0 – 0',{
      fontFamily:'monospace',fontSize:'22px',color:'#fbbf24',fontStyle:'bold'
    }).setOrigin(0.5,0).setDepth(D);

    // Round label
    this.roundTxt = this.add.text(W/2,36,'ROUND 1',{
      fontFamily:'monospace',fontSize:'9px',color:'#aaaaaa',letterSpacing:2
    }).setOrigin(0.5,0).setDepth(D);

    // Kick dots — 5 per side
    this.homeDotGfx = [];
    this.awayDotGfx = [];
    for (var i=0;i<5;i++) {
      var hg = this.add.graphics().setDepth(D);
      hg.fillStyle(0x555555); hg.fillCircle(22+i*22, 76, 7);
      this.homeDotGfx.push(hg);

      var ag = this.add.graphics().setDepth(D);
      ag.fillStyle(0x555555); ag.fillCircle(W-22-i*22, 76, 7);
      this.awayDotGfx.push(ag);
    }

    this._refreshScoreTracker();
  },

  _refreshScoreTracker: function() {
    var cfg=this.cfg;
    this.scoreHomeName.setText(cfg.homeTeam.flag+' '+cfg.homeTeam.name);
    this.scoreAwayName.setText(cfg.awayTeam.name+' '+cfg.awayTeam.flag);
    this.scoreTxt.setText(this.homeScore+' – '+this.awayScore);

    var maxRound = this.mode==='sudden_death' ? this.round : Math.min(this.round,5);
    this.roundTxt.setText(this.mode==='sudden_death' && this.round>5 ? 'SUDDEN DEATH' : 'ROUND '+maxRound);

    // Dots
    var hKicks = this.kicks.filter(function(k){return k.teamId===cfg.homeTeam.id;});
    var aKicks = this.kicks.filter(function(k){return k.teamId===cfg.awayTeam.id;});
    var self=this;
    for (var i=0;i<5;i++) {
      // Home
      self.homeDotGfx[i].clear();
      if (i<hKicks.length) {
        var hOut = hKicks[i].outcome;
        self.homeDotGfx[i].fillStyle(hOut==='goal'?0xfbbf24:0xef4444);
        self.homeDotGfx[i].fillCircle(22+i*22,76,7);
        if (hOut!=='goal') {
          self.homeDotGfx[i].lineStyle(2,0xffffff,0.8);
          self.homeDotGfx[i].beginPath();
          self.homeDotGfx[i].moveTo(18+i*22,72); self.homeDotGfx[i].lineTo(26+i*22,80);
          self.homeDotGfx[i].moveTo(26+i*22,72); self.homeDotGfx[i].lineTo(18+i*22,80);
          self.homeDotGfx[i].strokePath();
        }
      } else {
        self.homeDotGfx[i].lineStyle(1,0x555555);
        self.homeDotGfx[i].strokeCircle(22+i*22,76,7);
      }
      // Away
      self.awayDotGfx[i].clear();
      if (i<aKicks.length) {
        var aOut = aKicks[i].outcome;
        self.awayDotGfx[i].fillStyle(aOut==='goal'?0xfbbf24:0xef4444);
        self.awayDotGfx[i].fillCircle(W-22-i*22,76,7);
        if (aOut!=='goal') {
          self.awayDotGfx[i].lineStyle(2,0xffffff,0.8);
          self.awayDotGfx[i].beginPath();
          self.awayDotGfx[i].moveTo(W-26-i*22,72); self.awayDotGfx[i].lineTo(W-18-i*22,80);
          self.awayDotGfx[i].moveTo(W-18-i*22,72); self.awayDotGfx[i].lineTo(W-26-i*22,80);
          self.awayDotGfx[i].strokePath();
        }
      } else {
        self.awayDotGfx[i].lineStyle(1,0x555555);
        self.awayDotGfx[i].strokeCircle(W-22-i*22,76,7);
      }
    }
  },

  // ── TURN BANNER (who's kicking) ───────────────────────────────────
  _buildTurnBanner: function() {
    var D=10;
    this.turnBannerBg = this.add.graphics().setDepth(D).setAlpha(0);
    this.turnBannerBg.fillStyle(0x000000,0.6);
    this.turnBannerBg.fillRoundedRect(W/2-115,105,230,28,6);
    this.turnBannerTxt = this.add.text(W/2,119,'',{
      fontFamily:'monospace',fontSize:'11px',color:'#eeeeee',fontStyle:'bold'
    }).setOrigin(0.5).setDepth(D).setAlpha(0);
  },
  _showTurnBanner: function() {
    var side    = this.currentSide;
    var team    = side==='home' ? this.cfg.homeTeam : this.cfg.awayTeam;
    var isUser  = side===this.userTeam;
    var label   = team.flag+' '+team.name+(isUser?' — YOUR KICK':' — CPU');
    this.turnBannerTxt.setText(label).setAlpha(1);
    this.turnBannerBg.setAlpha(1);
  },
  _hideTurnBanner: function() {
    this.turnBannerTxt.setAlpha(0);
    this.turnBannerBg.setAlpha(0);
  },

  // ── TECHNIQUE BUTTONS ────────────────────────────────────────────
  _buildTechniqueButtons: function() {
    var D=10;
    this.techPanel  = this.add.container(0,0).setDepth(D).setAlpha(0);
    this.techBtnGfx = [];
    this.techBtnTxt = [];

    var btnData = [
      {key:'regular', label:'⚽  Regular',   sub:'Balanced — safe choice'},
      {key:'power',   label:'💥  Power Shot', sub:'Hard & fast, less control'},
      {key:'panenka', label:'🪄  Panenka',    sub:'Chip it — genius or disaster'},
    ];
    var BW=310, BH=58, BX=(W-BW)/2, startY=CTRL_Y+8;

    var self=this;
    btnData.forEach(function(bd,i) {
      var by = startY + i*(BH+8);
      var bg = self.add.graphics();
      bg.fillStyle(0x1a2a3a,0.92);
      bg.fillRoundedRect(BX,by,BW,BH,10);
      bg.lineStyle(1.5,0x3a5a7a,0.7);
      bg.strokeRoundedRect(BX,by,BW,BH,10);
      bg.setInteractive(new Phaser.Geom.Rectangle(BX,by,BW,BH),Phaser.Geom.Rectangle.Contains);
      bg.on('pointerover',  function(){ bg.clear(); bg.fillStyle(0x2a3a4a,0.95); bg.fillRoundedRect(BX,by,BW,BH,10); bg.lineStyle(2,0x5a8abc,1); bg.strokeRoundedRect(BX,by,BW,BH,10); });
      bg.on('pointerout',   function(){ bg.clear(); bg.fillStyle(0x1a2a3a,0.92); bg.fillRoundedRect(BX,by,BW,BH,10); bg.lineStyle(1.5,0x3a5a7a,0.7); bg.strokeRoundedRect(BX,by,BW,BH,10); });
      bg.on('pointerdown',  function(){ self._onTechniqueSelect(bd.key); });

      var mainTxt = self.add.text(BX+18, by+10, bd.label,{
        fontFamily:'monospace',fontSize:'15px',color:'#ffffff',fontStyle:'bold'
      });
      var subTxt = self.add.text(BX+18, by+32, bd.sub,{
        fontFamily:'monospace',fontSize:'10px',color:'#aabbcc'
      });

      self.techPanel.add([bg, mainTxt, subTxt]);
      self.techBtnGfx.push(bg);
      self.techBtnTxt.push(mainTxt);
    });

    // "CHOOSE YOUR SHOT" label
    var label = this.add.text(W/2, CTRL_Y-2,'CHOOSE YOUR SHOT',{
      fontFamily:'monospace',fontSize:'11px',color:'#fbbf24',fontStyle:'bold',letterSpacing:2
    }).setOrigin(0.5,1);
    this.techPanel.add(label);
  },

  // ── AIM SYSTEM ───────────────────────────────────────────────────
  _buildAimUI: function() {
    var D=10;
    this.aimGfx    = this.add.graphics().setDepth(D).setAlpha(0);
    this.aimCursor = this.add.graphics().setDepth(D).setAlpha(0);

    // Pulsing tween for cursor
    this.aimPulseTween = this.tweens.add({
      targets: this.aimCursor,
      alpha: 0.4, yoyo:true, repeat:-1, duration:350, ease:'Sine.easeInOut'
    });
    this.aimPulseTween.pause();

    // SHOOT button (bottom center)
    var self=this;
    this.shootBtnGfx = this.add.graphics().setDepth(D).setAlpha(0);
    this._drawShootButton(this.shootBtnGfx);
    this.shootBtnGfx.setInteractive(
      new Phaser.Geom.Rectangle(W/2-80,H-68,160,52),
      Phaser.Geom.Rectangle.Contains
    );
    this.shootBtnGfx.on('pointerdown', function(){ self._onShootAim(); });
    this.shootBtnTxt = this.add.text(W/2,H-42,'SHOOT ▶',{
      fontFamily:'monospace',fontSize:'18px',color:'#ffffff',fontStyle:'bold'
    }).setOrigin(0.5).setDepth(D).setAlpha(0);

    // Drag instruction
    this.aimHintTxt = this.add.text(W/2,CTRL_Y-2,'DRAG TO AIM — TAP SHOOT',{
      fontFamily:'monospace',fontSize:'11px',color:'#fbbf24',letterSpacing:1
    }).setOrigin(0.5,1).setDepth(D).setAlpha(0);
  },
  _drawShootButton: function(g) {
    g.clear();
    g.fillStyle(0xcc1111,0.92);
    g.fillRoundedRect(W/2-80,H-68,160,52,12);
    g.lineStyle(2,0xff4444,0.8);
    g.strokeRoundedRect(W/2-80,H-68,160,52,12);
  },
  _redrawAimLine: function() {
    var g = this.aimGfx;
    g.clear();
    // Dotted line: small circles from kicker to aim point
    var dx = this.aimX - KICKER_X;
    var dy = this.aimY - KICKER_Y;
    var dist = Math.sqrt(dx*dx+dy*dy);
    var steps = Math.floor(dist/14);
    g.fillStyle(0xffd700, 0.55);
    for (var s=2;s<steps;s++) {
      var t = s/steps;
      var cx = KICKER_X + dx*t;
      var cy = KICKER_Y + dy*t;
      var r  = 2.5 - t*1.5;   // thinner toward goal
      g.fillCircle(cx, cy, Math.max(0.8,r));
    }
    // Aim cursor
    this.aimCursor.clear();
    this.aimCursor.lineStyle(2.5,0xffd700,1);
    this.aimCursor.strokeCircle(this.aimX,this.aimY,14);
    this.aimCursor.lineStyle(1.5,0xffd700,0.6);
    this.aimCursor.strokeCircle(this.aimX,this.aimY,22);
    this.aimCursor.fillStyle(0xffd700,0.8);
    this.aimCursor.fillCircle(this.aimX,this.aimY,4);
  },

  // ── POWER BAR ────────────────────────────────────────────────────
  _buildPowerBarUI: function() {
    var D=10;
    this.powerBarContainer = this.add.container(0,0).setDepth(D).setAlpha(0);

    var PBX=W-52, PBY=PITCH_Y+30, PBW=24, PBH=200;
    this.pbX=PBX; this.pbY=PBY; this.pbW=PBW; this.pbH=PBH;

    var bg = this.add.graphics();
    bg.fillStyle(0x000000,0.7); bg.fillRoundedRect(PBX-4,PBY-28,PBW+8,PBH+50,8);
    bg.lineStyle(1,0x334455); bg.strokeRoundedRect(PBX-4,PBY-28,PBW+8,PBH+50,8);
    // Track
    bg.fillStyle(0x222222); bg.fillRect(PBX,PBY,PBW,PBH);
    bg.lineStyle(1,0x444444); bg.strokeRect(PBX,PBY,PBW,PBH);
    // Tick marks at 25/50/75%
    bg.lineStyle(1,0xffffff,0.3);
    [25,50,75].forEach(function(pct){
      var ty = PBY+PBH - (PBH*pct/100);
      bg.beginPath(); bg.moveTo(PBX,ty); bg.lineTo(PBX+PBW,ty); bg.strokePath();
    });

    this.pbLabelTxt = this.add.text(PBX+PBW/2, PBY-20,'POWER',{
      fontFamily:'monospace',fontSize:'8px',color:'#aaaaaa',fontStyle:'bold',letterSpacing:1
    }).setOrigin(0.5,1);
    this.pbValueTxt = this.add.text(PBX+PBW/2, PBY+PBH+6,'0%',{
      fontFamily:'monospace',fontSize:'11px',color:'#ffffff',fontStyle:'bold'
    }).setOrigin(0.5,0);
    this.pbFillGfx  = this.add.graphics();

    // HOLD SHOOT button in power phase
    var self=this;
    this.holdShootBtnGfx = this.add.graphics();
    this._drawHoldButton(this.holdShootBtnGfx, false);
    this.holdShootBtnGfx.setInteractive(
      new Phaser.Geom.Rectangle(W/2-90,H-72,180,56),
      Phaser.Geom.Rectangle.Contains
    );
    this.holdShootBtnGfx.on('pointerdown', function(){
      if (self.phase==='power') { self.holdingPower=true; self._drawHoldButton(self.holdShootBtnGfx,true); }
    });
    this.holdShootBtnTxt = this.add.text(W/2,H-44,'HOLD TO POWER',{
      fontFamily:'monospace',fontSize:'15px',color:'#ffffff',fontStyle:'bold'
    }).setOrigin(0.5);

    this.powerBarContainer.add([bg,this.pbLabelTxt,this.pbValueTxt,this.pbFillGfx,
                                 this.holdShootBtnGfx,this.holdShootBtnTxt]);
    this.pbHintTxt = this.add.text(W/2,CTRL_Y-2,'HOLD & RELEASE',{
      fontFamily:'monospace',fontSize:'11px',color:'#fbbf24',letterSpacing:1
    }).setOrigin(0.5,1).setDepth(D).setAlpha(0);
    this.powerBarContainer.add(this.pbHintTxt);
  },
  _drawHoldButton: function(g, pressed) {
    g.clear();
    g.fillStyle(pressed?0x882200:0xaa2200, 0.95);
    g.fillRoundedRect(W/2-90,H-72,180,56,12);
    g.lineStyle(2,pressed?0xcc4400:0xff4422,0.9);
    g.strokeRoundedRect(W/2-90,H-72,180,56,12);
  },
  _updatePowerBarFill: function() {
    var pct  = this.powerFillPct;
    var g    = this.pbFillGfx;
    var fillH= (pct/100)*this.pbH;
    var color= pct<40 ? 0x4ade80 : pct<70 ? 0xfbbf24 : 0xef4444;
    g.clear();
    g.fillStyle(color,0.95);
    g.fillRect(this.pbX, this.pbY+this.pbH-fillH, this.pbW, fillH);
    this.pbValueTxt.setText(Math.round(pct)+'%');
    this.pbValueTxt.setStyle({color: pct<40?'#4ade80':pct<70?'#fbbf24':'#ef4444'});
  },

  // ── ACCURACY RING ─────────────────────────────────────────────────
  _buildAccuracyRingUI: function() {
    var D=10;
    this.ringGfx = this.add.graphics().setDepth(D).setAlpha(0);
    this.ringHintTxt = this.add.text(W/2,CTRL_Y-2,'TAP ANYWHERE',{
      fontFamily:'monospace',fontSize:'13px',color:'#fbbf24',fontStyle:'bold',letterSpacing:2
    }).setOrigin(0.5,1).setDepth(D).setAlpha(0);
  },
  _drawRing: function() {
    var g = this.ringGfx;
    g.clear();
    var r = this.ringData.radius;
    var cx= GOAL_X+GOAL_W/2, cy=GOAL_Y+GOAL_H/2;
    // Color: large=green, small=red
    var frac = (r-RING_MIN)/(RING_MAX-RING_MIN);  // 1=large=green,0=small=red
    var red  = Math.round(Phaser.Math.Linear(0xef,0x4a,frac));
    var grn  = Math.round(Phaser.Math.Linear(0x44,0xde,frac));
    var color= (red<<16)|(grn<<8)|0x44;
    g.lineStyle(3,color,0.9);
    g.strokeCircle(cx,cy,r);
    g.lineStyle(1.5,color,0.35);
    g.strokeCircle(cx,cy,r+8);
    // Center target cross
    g.lineStyle(1.5,0xffffff,0.7);
    g.beginPath(); g.moveTo(cx-6,cy); g.lineTo(cx+6,cy); g.strokePath();
    g.beginPath(); g.moveTo(cx,cy-6); g.lineTo(cx,cy+6); g.strokePath();
  },

  // ── COMMENTARY ────────────────────────────────────────────────────
  _buildCommentaryUI: function() {
    var D=10;
    this.commBg = this.add.graphics().setDepth(D).setAlpha(0);
    this.commTxt= this.add.text(W/2,GOAL_Y+GOAL_H+55,'',{
      fontFamily:'monospace',fontSize:'18px',color:'#ffd700',fontStyle:'bold',
      stroke:'#000000',strokeThickness:4,align:'center',wordWrap:{width:350}
    }).setOrigin(0.5).setDepth(D+1).setAlpha(0);
  },
  _showCommentary: function(text) {
    var self=this;
    this.commTxt.setText(text).setAlpha(1);
    this.commBg.clear();
    this.commBg.fillStyle(0x000000,0.6);
    this.commBg.fillRoundedRect(this.commTxt.x-this.commTxt.width/2-12,
      this.commTxt.y-14, this.commTxt.width+24, 38,8);
    this.commBg.setAlpha(1);
    this.tweens.killTweensOf(this.commTxt);
    this.tweens.killTweensOf(this.commBg);
    this.tweens.add({
      targets:[this.commTxt,this.commBg], alpha:0,
      delay:1800, duration:500,
      onComplete:function(){self.commBg.clear();}
    });
  },

  // ── INTRO OVERLAY ─────────────────────────────────────────────────
  _buildIntroUI: function() {
    var D=11;
    this.introContainer = this.add.container(0,0).setDepth(D);
    var overlay = this.add.graphics();
    overlay.fillStyle(0x000000,0.80);
    overlay.fillRect(0,0,W,H);
    var heading = this.add.text(W/2,H/2-90,'PENALTY',{
      fontFamily:'monospace',fontSize:'42px',color:'#ffd700',fontStyle:'bold',
      stroke:'#000',strokeThickness:5,letterSpacing:6
    }).setOrigin(0.5);
    var heading2= this.add.text(W/2,H/2-42,'SHOOTOUT',{
      fontFamily:'monospace',fontSize:'36px',color:'#ffffff',fontStyle:'bold',
      stroke:'#000',strokeThickness:4,letterSpacing:4
    }).setOrigin(0.5);
    this.introHomeText  = this.add.text(W/2-20,H/2+10,'',{
      fontFamily:'monospace',fontSize:'20px',color:'#ffffff',fontStyle:'bold'
    }).setOrigin(1,0.5);
    var vs = this.add.text(W/2,H/2+10,'VS',{
      fontFamily:'monospace',fontSize:'16px',color:'#aaaaaa',fontStyle:'bold'
    }).setOrigin(0.5);
    this.introAwayText  = this.add.text(W/2+20,H/2+10,'',{
      fontFamily:'monospace',fontSize:'20px',color:'#ffffff',fontStyle:'bold'
    }).setOrigin(0,0.5);
    this.introContainer.add([overlay,heading,heading2,this.introHomeText,vs,this.introAwayText]);
  },

  // ── RESULT SCREEN ─────────────────────────────────────────────────
  _buildResultUI: function() {
    var D=12;
    this.resultContainer = this.add.container(0,0).setDepth(D).setAlpha(0);
    var overlay = this.add.graphics();
    overlay.fillStyle(0x000000,0.88);
    overlay.fillRect(0,0,W,H);
    this.resultTitle = this.add.text(W/2,H*0.2,'',{
      fontFamily:'monospace',fontSize:'36px',color:'#ffd700',fontStyle:'bold',
      stroke:'#000',strokeThickness:5,letterSpacing:3
    }).setOrigin(0.5);
    this.resultWinner= this.add.text(W/2,H*0.36,'',{
      fontFamily:'monospace',fontSize:'22px',color:'#ffffff',fontStyle:'bold'
    }).setOrigin(0.5);
    this.resultScore = this.add.text(W/2,H*0.48,'',{
      fontFamily:'monospace',fontSize:'28px',color:'#fbbf24',fontStyle:'bold'
    }).setOrigin(0.5);

    var self=this;
    // Play Again button
    var paBg = this.add.graphics();
    paBg.fillStyle(0x1a7a1a,0.95); paBg.fillRoundedRect(W/2-120,H*0.63,240,54,12);
    paBg.lineStyle(2,0x4ada4a); paBg.strokeRoundedRect(W/2-120,H*0.63,240,54,12);
    paBg.setInteractive(new Phaser.Geom.Rectangle(W/2-120,H*0.63,240,54),Phaser.Geom.Rectangle.Contains);
    paBg.on('pointerdown',function(){ self._onPlayAgain(); });
    var paTxt=this.add.text(W/2,H*0.63+27,'⚽  PLAY AGAIN',{
      fontFamily:'monospace',fontSize:'16px',color:'#ffffff',fontStyle:'bold'
    }).setOrigin(0.5);

    // Back button
    var bkBg=this.add.graphics();
    bkBg.fillStyle(0x333344,0.9); bkBg.fillRoundedRect(W/2-100,H*0.73,200,46,10);
    bkBg.lineStyle(1,0x555566); bkBg.strokeRoundedRect(W/2-100,H*0.73,200,46,10);
    bkBg.setInteractive(new Phaser.Geom.Rectangle(W/2-100,H*0.73,200,46),Phaser.Geom.Rectangle.Contains);
    bkBg.on('pointerdown',function(){ self._onBack(); });
    var bkTxt=this.add.text(W/2,H*0.73+23,'← BACK',{
      fontFamily:'monospace',fontSize:'13px',color:'#aaaaaa'
    }).setOrigin(0.5);

    this.resultContainer.add([overlay,this.resultTitle,this.resultWinner,this.resultScore,paBg,paTxt,bkBg,bkTxt]);
  },

  // ─────────────────────────────────────────────────────────────────
  // STATE MACHINE
  // ─────────────────────────────────────────────────────────────────
  _startIntro: function() {
    var cfg=this.cfg;
    this.introHomeText.setText(cfg.homeTeam.flag+' '+cfg.homeTeam.name);
    this.introAwayText.setText(cfg.awayTeam.flag+' '+cfg.awayTeam.name);
    this.introContainer.setAlpha(1);
    this._bounceCrowd('both');
    var self=this;
    this.time.delayedCall(1700, function() {
      self.tweens.add({
        targets:self.introContainer, alpha:0, duration:500,
        onComplete:function(){
          self.introContainer.setAlpha(0);
          self._beginNextKick();
        }
      });
    });
  },

  _beginNextKick: function() {
    this._showTurnBanner();
    var isUser = this.currentSide===this.userTeam;
    var self=this;
    this.time.delayedCall(700, function(){
      if (isUser) self._enterPhase('technique_select');
      else        self._startCPUKick();
    });
  },

  _enterPhase: function(phase) {
    this._hideAllControls();
    this.phase = phase;

    if (phase==='technique_select') {
      this.tweens.add({targets:this.techPanel, alpha:1, duration:200});
    }
    else if (phase==='aiming') {
      this.aimGfx.setAlpha(1); this.aimCursor.setAlpha(1);
      this.aimHintTxt.setAlpha(1); this.shootBtnGfx.setAlpha(1); this.shootBtnTxt.setAlpha(1);
      this.aimPulseTween.resume();
      this._redrawAimLine();
    }
    else if (phase==='power') {
      this.powerFillPct=0; this.holdingPower=false;
      this._updatePowerBarFill();
      this.tweens.add({targets:this.powerBarContainer, alpha:1, duration:200});
      this.pbHintTxt.setAlpha(1);
    }
    else if (phase==='accuracy') {
      this.ringData.radius = RING_MAX;
      var skill   = (this.currentSide==='home'
        ? this.cfg.homeTeam.penalty_skill
        : this.cfg.awayTeam.penalty_skill) || 65;
      var cycleDur= 900 + skill*13;
      var self=this;
      this.ringGfx.setAlpha(1); this.ringHintTxt.setAlpha(1);
      this._drawRing();
      if (this.ringTween) { this.ringTween.stop(); this.ringTween=null; }
      this.ringTween = this.tweens.add({
        targets: this.ringData,
        radius: RING_MIN,
        yoyo:true, repeat:-1, duration:cycleDur/2,
        ease:'Linear',
        onUpdate: function(){ self._drawRing(); }
      });
    }
  },

  _hideAllControls: function() {
    this.techPanel.setAlpha(0);
    this.aimGfx.setAlpha(0); this.aimCursor.setAlpha(0);
    this.aimHintTxt.setAlpha(0); this.shootBtnGfx.setAlpha(0); this.shootBtnTxt.setAlpha(0);
    this.aimPulseTween.pause();
    this.powerBarContainer.setAlpha(0); this.pbHintTxt.setAlpha(0);
    this.ringGfx.setAlpha(0); this.ringHintTxt.setAlpha(0);
    if (this.ringTween){ this.ringTween.stop(); this.ringTween=null; }
  },

  // ─────────────────────────────────────────────────────────────────
  // INPUT HANDLERS
  // ─────────────────────────────────────────────────────────────────
  _onPointerMove: function(p) {
    if (this.phase!=='aiming') return;
    var margin=25;
    this.aimX = Phaser.Math.Clamp(p.x, INNER_X-margin, INNER_X+INNER_W+margin);
    this.aimY = Phaser.Math.Clamp(p.y, INNER_Y-margin, INNER_Y+INNER_H+margin);
    this._redrawAimLine();
  },
  _onPointerDown: function(p) {
    if (this.phase==='accuracy') this._onAccuracyTap();
  },
  _onPointerUp: function(p) {
    if (this.phase==='power' && this.holdingPower) {
      this.holdingPower=false;
      this._drawHoldButton(this.holdShootBtnGfx, false);
      this.pendingPower = this.powerFillPct;
      this._enterPhase('accuracy');
    }
  },

  _onTechniqueSelect: function(tech) {
    if (this.phase!=='technique_select') return;
    this.pendingTech = tech;
    this.pendingGKDive = generateGKDive(this.cfg.awayTeam.goalkeeper_rating||65);
    // Run-up then aiming
    this._animateKickerRunUp();
    var self=this;
    this.time.delayedCall(650, function(){ self._enterPhase('aiming'); });
  },
  _onShootAim: function() {
    if (this.phase!=='aiming') return;
    this.pendingZone = aimToZone(this.aimX, this.aimY);
    this._enterPhase('power');
  },
  _onAccuracyTap: function() {
    if (this.phase!=='accuracy') return;
    var r   = this.ringData.radius;
    var acc = Math.round(100 - (r-RING_MIN)/(RING_MAX-RING_MIN)*100);
    acc = Math.max(0, Math.min(100, acc));
    if (this.ringTween){ this.ringTween.stop(); this.ringTween=null; }
    this._hideAllControls();
    this._resolveUserKick(this.pendingZone, this.pendingPower, acc, this.pendingTech, this.pendingGKDive);
  },

  // ─────────────────────────────────────────────────────────────────
  // KICK RESOLUTION
  // ─────────────────────────────────────────────────────────────────
  _resolveUserKick: function(zone, power, accuracy, technique, gkDive) {
    this.phase='resolving';
    this._hideTurnBanner();
    var gkRating = this.cfg.awayTeam.goalkeeper_rating||65;
    var outcome  = resolveUserShot(zone,power,accuracy,technique,gkDive,gkRating);
    this._executeKick(zone, technique, gkDive, outcome);
  },
  _startCPUKick: function() {
    this.phase='cpu_kick';
    var self=this;
    // Show "CPU kicking" text
    this._showCommentary(this.currentSide==='home'
      ? this.cfg.homeTeam.flag+' Taking the penalty...'
      : this.cfg.awayTeam.flag+' Taking the penalty...');
    this.time.delayedCall(900, function(){
      self._hideTurnBanner();
      var skill    = self.currentSide==='home' ? self.cfg.homeTeam.penalty_skill : self.cfg.awayTeam.penalty_skill;
      var gkRating = self.currentSide==='home' ? self.cfg.awayTeam.goalkeeper_rating : self.cfg.homeTeam.goalkeeper_rating;
      var cpu = resolveCPUShot(skill||65, gkRating||65);
      self._executeKick(cpu.zone, cpu.technique, cpu.gkDive, cpu.outcome);
    });
  },

  _executeKick: function(zone, technique, gkDive, outcome) {
    this.phase='resolving';
    var target = zoneCenter(zone);
    var self=this;

    // Animate kicker kick pose
    this._redrawKicker('kick');
    this.tweens.add({
      targets:this.kickerContainer, y:KICKER_Y-12,
      duration:180, ease:'Power2.easeOut', yoyo:true
    });

    // Reset ball to spot
    this.ballPos.x=SPOT_X; this.ballPos.y=SPOT_Y; this.ballScale=1.0;
    this._redrawBall();

    // Launch ball + GK dive simultaneously
    this._animateBall(target.x, target.y, technique, outcome, function(){
      self._onBallArrived(zone, outcome);
    });
    this.time.delayedCall(100, function(){
      self._animateGKDive(gkDive, outcome);
    });
  },

  _onBallArrived: function(zone, outcome) {
    var self=this;
    // Record kick
    var teamId = this.currentSide==='home' ? this.cfg.homeTeam.id : this.cfg.awayTeam.id;
    this.kicks.push({ teamId:teamId, outcome:outcome });
    if (outcome==='goal') {
      if (this.currentSide==='home') this.homeScore++;
      else                            this.awayScore++;
    }
    this._refreshScoreTracker();
    this._showCommentary(pickLine(outcome));

    // Outcome animations
    if (outcome==='goal') {
      this._animateNetJiggle();
      this._redrawKicker('celebrate');
      this._animateKickerCelebrate();
      this._bounceCrowd(this.currentSide);
      this._redrawGK('beaten');
      this.tweens.add({ targets:this.gkContainer, y:GK_Y+18, duration:400 });
    } else {
      this._redrawKicker('despair');
      this._animateKickerDespair();
      if (outcome==='saved') {
        this._animateGKSave();
        var saveTeam = this.currentSide==='home' ? 'away' : 'home';
        this._bounceCrowd(saveTeam);
      }
    }

    // Advance after delay
    this.time.delayedCall(2200, function(){ self._advanceGame(); });
  },

  _advanceGame: function() {
    var cfg=this.cfg, homeId=cfg.homeTeam.id, awayId=cfg.awayTeam.id;
    var check = checkShootoutEnd(this.kicks, this.mode, homeId, awayId);

    if (check.tieBreaker) {
      // Switch to sudden death
      this.mode='sudden_death';
    }
    if (check.ended) {
      this._showResult(check.winner);
      return;
    }

    // Advance turn
    if (this.currentSide==='home') {
      this.currentSide='away';
    } else {
      this.currentSide='home';
      this.round++;
    }

    // Reset GK + kicker + ball
    var self=this;
    this.tweens.killTweensOf(this.gkContainer);
    this.gkContainer.setPosition(GK_X, GK_Y);
    this.gkContainer.setRotation(0);
    this._redrawGK('idle');
    this._startGKIdle();

    this.tweens.killTweensOf(this.kickerContainer);
    this.kickerContainer.setPosition(KICKER_X, KICKER_Y);
    this.kickerContainer.setRotation(0);
    this.kickerContainer.setScale(1,1);
    this._redrawKicker('idle');
    this._startKickerIdle();

    this.ballPos.x=SPOT_X; this.ballPos.y=SPOT_Y; this.ballScale=1.0;
    this._redrawBall();

    this.time.delayedCall(300, function(){ self._beginNextKick(); });
  },

  _showResult: function(winnerId) {
    this.phase='result';
    this.shootoutDone=true;
    var cfg=this.cfg;
    var homeName=cfg.homeTeam.name, awayName=cfg.awayTeam.name;

    if (!winnerId) {
      this.resultTitle.setText('ITS A DRAW').setStyle({color:'#ffffff'});
      this.resultWinner.setText('Remarkable — level after shootout!');
    } else {
      var wTeam = winnerId===cfg.homeTeam.id ? cfg.homeTeam : cfg.awayTeam;
      this.resultTitle.setText('FULL TIME!').setStyle({color:'#ffd700'});
      this.resultWinner.setText(wTeam.flag+' '+wTeam.name+' WIN!');
    }
    this.resultScore.setText(cfg.homeTeam.flag+' '+this.homeScore+' – '+this.awayScore+' '+cfg.awayTeam.flag);
    this.tweens.add({targets:this.resultContainer, alpha:1, duration:600});

    postToRN({type:'result', homeScore:this.homeScore, awayScore:this.awayScore, winnerId:winnerId||null});
  },

  _onPlayAgain: function() {
    this.tweens.add({
      targets:this.resultContainer, alpha:0, duration:300,
      onComplete:function(){ postToRN({type:'restart'}); }
    });
  },
  _onBack: function() { postToRN({type:'back'}); },

  // ─────────────────────────────────────────────────────────────────
  // ANIMATIONS
  // ─────────────────────────────────────────────────────────────────
  _animateBall: function(tx, ty, technique, outcome, onComplete) {
    var self=this;
    var dur = technique==='panenka' ? 1050 : technique==='power' ? 440 : 700;
    var arcH= technique==='panenka' ? 160 : technique==='power' ? 35 : 85;
    var sx=SPOT_X, sy=SPOT_Y;

    // Handle miss — ball goes wide/over
    var endX=tx, endY=ty;
    if (outcome==='miss') {
      var missOff = (Math.random()<0.5?1:-1)*(30+Math.random()*40);
      endX = tx+missOff;
      endY = GOAL_Y - 20 - Math.random()*40;
    }

    var progress={t:0};
    this.tweens.add({
      targets:progress, t:1, duration:dur, ease:'Linear',
      onUpdate: function(){
        var t=progress.t;
        var bx = sx+(endX-sx)*t;
        var by = sy+(endY-sy)*t - arcH*Math.sin(Math.PI*t);
        // perspective scale: 1→0.55
        var s  = 1 - t*0.45;
        self.ballPos.x=bx; self.ballPos.y=by; self.ballScale=s;
        self._redrawBall();
      },
      onComplete: onComplete
    });
  },

  _animateGKDive: function(gkDive, outcome) {
    var self=this;
    if (this.gkIdleTween){ this.gkIdleTween.stop(); this.gkIdleTween=null; }

    var targetX=GK_X, targetY=GK_Y, targetRot=0;
    var pose='idle';
    if (gkDive==='left') {
      targetX=GOAL_X+GOAL_W*0.22; targetY=GK_Y-20; targetRot=-0.4; pose='diveL';
    } else if (gkDive==='right') {
      targetX=GOAL_X+GOAL_W*0.78; targetY=GK_Y-20; targetRot=0.4; pose='diveR';
    } else {
      targetY=GK_Y-8; pose='idle'; // stay center, slight step back
    }
    this._redrawGK(pose);
    this.tweens.add({
      targets:this.gkContainer,
      x:targetX, y:targetY, rotation:targetRot,
      duration:280, ease:'Power2.easeOut'
    });
  },

  _animateGKSave: function() {
    var self=this;
    this._redrawGK('save');
    this.tweens.add({
      targets:this.gkContainer,
      scaleX:1.15, scaleY:1.15,
      duration:180, yoyo:true, repeat:1,
      ease:'Power2.easeOut'
    });
  },

  _animateKickerRunUp: function() {
    this._redrawKicker('runup');
    var self=this;
    this.tweens.killTweensOf(this.kickerContainer);
    this.kickerContainer.y = KICKER_Y+60;
    this.tweens.add({
      targets:this.kickerContainer, y:KICKER_Y,
      duration:580, ease:'Power2.easeOut',
      onComplete:function(){ self._redrawKicker('standing'); }
    });
  },

  _animateKickerCelebrate: function() {
    var self=this;
    this.tweens.add({
      targets:this.kickerContainer, y:KICKER_Y-38,
      duration:380, ease:'Power2.easeOut', yoyo:true,
      repeat:2,
      onComplete:function(){ self._redrawKicker('idle'); }
    });
  },
  _animateKickerDespair: function() {
    this.tweens.add({
      targets:this.kickerContainer,
      scaleX:0.94, y:KICKER_Y+10,
      duration:350, ease:'Power2.easeIn'
    });
  },

  _animateNetJiggle: function() {
    this.tweens.add({
      targets:this.netGfx,
      scaleX:1.045, yoyo:true, repeat:5,
      duration:55, ease:'Linear'
    });
  },

  _bounceCrowd: function(side) {
    var crowd = side==='home' ? this.homeCrowd
              : side==='away' ? this.awayCrowd
              : this.homeCrowd.concat(this.awayCrowd);
    var self=this;
    crowd.forEach(function(fig, i) {
      self.tweens.add({
        targets: fig.gfx,
        y: fig.baseY-9,
        yoyo:true, repeat:2, duration:180,
        ease:'Power2.easeOut',
        delay: i*18
      });
    });
  },

  // ─────────────────────────────────────────────────────────────────
  // UPDATE LOOP
  // ─────────────────────────────────────────────────────────────────
  update: function() {
    if (this.phase==='power' && this.holdingPower) {
      // Fill at 100% per 1.5s = ~1.11%/frame at 60fps
      this.powerFillPct = Math.min(100, this.powerFillPct + 100/90);
      this._updatePowerBarFill();
      if (this.powerFillPct>=100) {
        // Auto-lock at max
        this.holdingPower=false;
        this.pendingPower=100;
        this._enterPhase('accuracy');
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
// LAUNCH
// ═══════════════════════════════════════════════════════════════════
var phaserConfig = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: '#0a0a1e',
  parent: document.body,
  scene: [PreloadScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};
new Phaser.Game(phaserConfig);
</script>
</body>
</html>`;
