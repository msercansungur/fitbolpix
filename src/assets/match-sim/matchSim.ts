// ─── Pure Canvas 2D Match Simulator WebView ──────────────────────────────────
// Zero external dependencies. Config baked as first <script> in <head>.
// Canvas fills full WebView viewport; all geometry derived from window dimensions.

export interface MatchSimConfig {
  homeId:        string;
  homeName:      string;
  homeCode:      string;
  homeColor:     number;
  homeStrength:  number;
  homeFormation: string;
  awayId:        string;
  awayName:      string;
  awayCode:      string;
  awayColor:     number;
  awayStrength:  number;
  awayFormation: string;
  events: Array<{ type: string; teamId: string; minute: number }>;
  seed: number;
}

export function getMatchSimHTML(config: MatchSimConfig): string {
  const configScript = `<script>window.MATCH_CONFIG = ${JSON.stringify(config)};</script>`;

  // IMPORTANT: No template literals or ${} inside the html string below —
  // only the configScript substitution above is a TS template expression.
  const html = `<!DOCTYPE html>
<html>
<head>
${configScript}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#00292A;touch-action:none}
canvas{display:block;position:absolute;top:0;left:0}
#spd{
  position:absolute;bottom:90px;right:8px;
  background:#0F2129;color:#FACE43;border:1px solid #FACE43;
  font:bold 12px monospace;
  padding:4px 10px;border-radius:4px;cursor:pointer;z-index:10;
  -webkit-tap-highlight-color:transparent;
}
</style>
</head>
<body>
<canvas id="c"></canvas>
<button id="spd">⚡ SPEED: 1x</button>
<script>
(function(){
'use strict';

// ── Config ───────────────────────────────────────────────────────────────────
var cfg = window.MATCH_CONFIG || {
  homeId:'tur',homeName:'Turkiye',homeCode:'TUR',homeColor:0xE30A17,homeStrength:1606,homeFormation:'4-2-3-1',
  awayId:'ger',awayName:'Germany',awayCode:'GER',awayColor:0x333333,awayStrength:1730,awayFormation:'4-2-3-1',
  events:[],seed:99999
};

// ── Canvas ───────────────────────────────────────────────────────────────────
var canvas = document.getElementById('c');
var spdBtn = document.getElementById('spd');
var W = window.innerWidth;
var H = window.innerHeight;
var dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width  = W * dpr;
canvas.height = H * dpr;
canvas.style.width  = W + 'px';
canvas.style.height = H + 'px';
var ctx = canvas.getContext('2d');
ctx.scale(dpr, dpr);

// ── Layout zones ─────────────────────────────────────────────────────────────
// [Score bar 50] [Top ad 20] [Pitch ...] [Bottom ad 20] [Possession bar 30]
var SCORE_H = 50;
var AD_H    = 20;
var POSS_H  = 30;
var GRASS_Y = SCORE_H + AD_H;          // 70
var GRASS_B = H - POSS_H - AD_H;       // H-50
var GRASS_H = GRASS_B - GRASS_Y;       // fills viewport
var MIDPY   = GRASS_Y + GRASS_H / 2;
var BM      = 10;
var PX = BM, PY = GRASS_Y + BM, PW = W - BM*2, PH = GRASS_H - BM*2;

// ── roundRect polyfill ───────────────────────────────────────────────────────
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    r = Math.min(r, w/2, h/2);
    this.beginPath();
    this.moveTo(x+r,y); this.lineTo(x+w-r,y);
    this.arcTo(x+w,y,  x+w,y+r,  r); this.lineTo(x+w,y+h-r);
    this.arcTo(x+w,y+h,x+w-r,y+h,r); this.lineTo(x+r,y+h);
    this.arcTo(x,y+h,  x,y+h-r,  r); this.lineTo(x,y+r);
    this.arcTo(x,y,    x+r,y,    r);
    this.closePath(); return this;
  };
}

// ── Color helpers ────────────────────────────────────────────────────────────
function n2rgb(n) {
  var v = (n >>> 0) & 0xFFFFFF;
  return '#' + ('000000' + v.toString(16)).slice(-6);
}
function n2rgba(n, a) {
  var v = (n >>> 0) & 0xFFFFFF;
  return 'rgba(' + ((v>>16)&255) + ',' + ((v>>8)&255) + ',' + (v&255) + ',' + a + ')';
}

// ── PRNG ─────────────────────────────────────────────────────────────────────
var _s = ((cfg.seed || 54321) >>> 0) || 1;
function rng() {
  _s ^= _s << 13; _s ^= _s >> 17; _s ^= _s << 5;
  return (_s >>> 0) / 4294967296;
}

// ── Formations (0-640 logical space; Y=0 top, Y=640 = home GK end) ──────────
// Home attacks UPWARD (forwards near y~160), Away attacks DOWNWARD (~y480)
var FMTS = {
  '4-3-3':{
    home:[[320,600],[120,490],[245,510],[395,510],[520,490],[195,345],[320,318],[445,345],[175,165],[320,148],[465,165]],
    away:[[320,40], [120,150],[245,130],[395,130],[520,150],[195,295],[320,322],[445,295],[175,475],[320,492],[465,475]]
  },
  '4-4-2':{
    home:[[320,600],[100,495],[225,515],[415,515],[540,495],[100,348],[242,365],[398,365],[540,348],[225,175],[415,175]],
    away:[[320,40], [100,145],[225,125],[415,125],[540,145],[100,292],[242,275],[398,275],[540,292],[225,465],[415,465]]
  },
  '4-2-3-1':{
    home:[[320,600],[112,492],[232,515],[408,515],[528,492],[238,395],[402,395],[148,272],[320,252],[492,272],[320,155]],
    away:[[320,40], [112,148],[232,125],[408,125],[528,148],[238,245],[402,245],[148,368],[320,388],[492,368],[320,485]]
  },
  '3-5-2':{
    home:[[320,600],[188,502],[320,522],[452,502],[82,368],[208,362],[320,342],[432,362],[558,368],[222,178],[418,178]],
    away:[[320,40], [188,138],[320,118],[452,138],[82,272],[208,278],[320,298],[432,278],[558,272],[222,462],[418,462]]
  }
};
var SX = W / 640;
var SY = GRASS_H / 640;
function f2c(px, py) { return [px * SX, GRASS_Y + py * SY]; }

// ── Pitch geometry constants ──────────────────────────────────────────────────
var paW  = PW * 0.50;                          // penalty area width
var paH  = PH * 0.16;                          // penalty area height (from goal line inward)
var paX  = PX + PW * 0.25;                     // penalty area left edge
var gaW  = PW * 0.28;                          // goal area (6-yard box) width
var gaH  = PH * 0.06;                          // goal area height
var gaX  = PX + PW * 0.36;                     // goal area left edge
var penSpotY = PH * 0.11;                      // penalty spot distance from goal line
var dArcR    = PH * 0.1;                       // D-arc radius
var circleR  = Math.min(44, PH * 0.085);       // centre circle radius
var goalPostW = PW * 0.12;                     // goalpost width
var goalPostX = PX + PW/2 - goalPostW/2;       // goalpost left edge

// ── Possession (derived from strength ratio) ─────────────────────────────────
var totalStr = (cfg.homeStrength || 1600) + (cfg.awayStrength || 1600);
var homePoss = Math.round((cfg.homeStrength || 1600) / totalStr * 100);
var awayPoss = 100 - homePoss;

// ── Game state ────────────────────────────────────────────────────────────────
var phase = 'boot';  // boot|kickoff|playing|halftime|fulltime
var halftimeDone = false;
var currentMinute = 0, minuteAccum = 0;
var speed = 1;
var SPEEDS = [1, 2, 3, 6];
var spdIdx = 0;
var homeScore = 0, awayScore = 0;

var timeline = (cfg.events || []).slice().sort(function(a,b){ return a.minute - b.minute; });
var nextEvt  = 0;

var bx = W/2, by = MIDPY, btx = W/2, bty = MIDPY;
var trail = [];
var homeP = [], awayP = [];

var ovText = '', ovType = 'neutral', ovAlpha = 0, ovTimer = 0;
var flashAlpha = 0, flashColor = 0;
var confetti = [];
var bannerText = '', bannerAlpha = 0, bannerTimer = 0;
var bootProg = 0, bootFade = 1.0;
var wanderTimer = 0;
var lastTick = performance.now();
var ftSent = false;

// ── Speed button (HTML) ───────────────────────────────────────────────────────
spdBtn.addEventListener('click', function() {
  spdIdx = (spdIdx + 1) % SPEEDS.length;
  speed  = SPEEDS[spdIdx];
  spdBtn.textContent = '⚡ SPEED: ' + SPEEDS[spdIdx] + 'x';
});

// ── Pitch drawing ─────────────────────────────────────────────────────────────
function drawPitch() {
  // Pitch stripes
  var SW = Math.ceil(W / 14);
  for (var si = 0; si < 15; si++) {
    ctx.fillStyle = si % 2 === 0 ? '#1a5c1a' : '#1e6a1e';
    ctx.fillRect(si * SW, GRASS_Y, SW, GRASS_H);
  }

  // Goalposts — extend OUTSIDE the pitch boundary
  // Net fill behind goalposts
  ctx.fillStyle = 'rgba(50,50,50,0.7)';
  ctx.fillRect(goalPostX, PY - 8, goalPostW, 8);        // top net area
  ctx.fillRect(goalPostX, PY + PH, goalPostW, 8);       // bottom net area
  // Net crosshatch
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 0.5;
  for (var nc = 1; nc < 6; nc++) {
    var nx = goalPostX + nc * goalPostW / 6;
    ctx.beginPath(); ctx.moveTo(nx, PY-8);   ctx.lineTo(nx, PY);      ctx.stroke();
    ctx.beginPath(); ctx.moveTo(nx, PY+PH);  ctx.lineTo(nx, PY+PH+8); ctx.stroke();
  }
  for (var nr = 1; nr < 3; nr++) {
    var nyt = PY - 8 + nr * 8/3;
    var nyb = PY + PH + nr * 8/3;
    ctx.beginPath(); ctx.moveTo(goalPostX, nyt); ctx.lineTo(goalPostX+goalPostW, nyt); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(goalPostX, nyb); ctx.lineTo(goalPostX+goalPostW, nyb); ctx.stroke();
  }
  // Goalpost outlines
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.strokeRect(goalPostX, PY - 8, goalPostW, 8);      // top goalpost
  ctx.strokeRect(goalPostX, PY + PH, goalPostW, 8);     // bottom goalpost

  // White pitch markings
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.82)'; ctx.lineWidth = 1.5;
  // Boundary
  ctx.strokeRect(PX, PY, PW, PH);
  // Halfway line
  ctx.beginPath(); ctx.moveTo(PX, MIDPY); ctx.lineTo(PX+PW, MIDPY); ctx.stroke();
  // Centre circle
  ctx.beginPath(); ctx.arc(W/2, MIDPY, circleR, 0, Math.PI*2); ctx.stroke();
  // Penalty areas (anchored to goal line, extending inward)
  ctx.strokeRect(paX, PY,        paW, paH);             // top PA
  ctx.strokeRect(paX, PY+PH-paH, paW, paH);             // bottom PA
  // Goal areas (6-yard box, anchored to goal line, inside PA)
  ctx.strokeRect(gaX, PY,        gaW, gaH);             // top GA
  ctx.strokeRect(gaX, PY+PH-gaH, gaW, gaH);             // bottom GA
  // D-arcs (only the portion OUTSIDE the penalty area)
  // Top D: arc bulges downward (outside PA bottom edge at PY+paH)
  ctx.beginPath(); ctx.arc(W/2, PY+penSpotY,    dArcR, Math.PI*0.35, Math.PI*0.65, false); ctx.stroke();
  // Bottom D: arc bulges upward (outside PA top edge at PY+PH-paH)
  ctx.beginPath(); ctx.arc(W/2, PY+PH-penSpotY, dArcR, Math.PI*1.35, Math.PI*1.65, false); ctx.stroke();
  // Corner arcs (quarter circles at each corner)
  ctx.beginPath(); ctx.arc(PX,    PY,    8, 0,             Math.PI/2,    false); ctx.stroke();  // top-left
  ctx.beginPath(); ctx.arc(PX+PW, PY,    8, Math.PI/2,     Math.PI,      false); ctx.stroke();  // top-right
  ctx.beginPath(); ctx.arc(PX+PW, PY+PH, 8, Math.PI,       Math.PI*1.5,  false); ctx.stroke();  // bottom-right
  ctx.beginPath(); ctx.arc(PX,    PY+PH, 8, Math.PI*1.5,   Math.PI*2,    false); ctx.stroke();  // bottom-left
  // Dots
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.beginPath(); ctx.arc(W/2, MIDPY,           2.5, 0, Math.PI*2); ctx.fill();  // centre spot
  ctx.beginPath(); ctx.arc(W/2, PY+penSpotY,     2.5, 0, Math.PI*2); ctx.fill();  // top pen spot
  ctx.beginPath(); ctx.arc(W/2, PY+PH-penSpotY,  2.5, 0, Math.PI*2); ctx.fill();  // bottom pen spot
  ctx.restore();

  // Ad boards — top (just below score bar) and bottom (just above possession bar)
  var ADS = ['FITBOLPIX', 'CUP 26', '2026', 'FITBOLPIX', 'CUP 26', '2026'];
  var adY1 = SCORE_H, adY2 = GRASS_B;
  var asp = W / ADS.length;
  // Draw both ad strips
  var adYs = [adY1, adY2];
  for (var si = 0; si < 2; si++) {
    var ay = adYs[si];
    // Base fill
    ctx.fillStyle = '#0a1f0a';
    ctx.fillRect(0, ay, W, AD_H);
    // Alternating panel backgrounds + separators
    for (var ai = 0; ai < ADS.length; ai++) {
      ctx.fillStyle = ai % 2 === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)';
      ctx.fillRect(ai * asp, ay, asp, AD_H);
      // Vertical separator between panels
      if (ai > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(ai * asp, ay, 1, AD_H);
      }
    }
    // Horizontal borders top and bottom
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, ay, W, 1);
    ctx.fillRect(0, ay + AD_H - 1, W, 1);
    // Text labels
    ctx.fillStyle = 'rgba(200,255,200,0.50)';
    ctx.font = 'bold 7px "Courier New", monospace'; ctx.textAlign = 'center';
    for (var aj = 0; aj < ADS.length; aj++) {
      ctx.fillText(ADS[aj], aj * asp + asp/2, ay + 13);
    }
  }
}

// ── Init players ──────────────────────────────────────────────────────────────
function initPlayers() {
  var hf = FMTS[cfg.homeFormation] ? cfg.homeFormation : '4-4-2';
  var af = FMTS[cfg.awayFormation] ? cfg.awayFormation : '4-4-2';
  homeP = FMTS[hf].home.map(function(p) {
    var c = f2c(p[0], p[1]);
    return { x:c[0], y:c[1], tx:c[0], ty:c[1], bx:c[0], by:c[1] };
  });
  awayP = FMTS[af].away.map(function(p) {
    var c = f2c(p[0], p[1]);
    return { x:c[0], y:c[1], tx:c[0], ty:c[1], bx:c[0], by:c[1] };
  });
}

// ── Wander ────────────────────────────────────────────────────────────────────
function doWander() {
  var J = 14;
  homeP.forEach(function(p) {
    p.tx = Math.max(PX+5, Math.min(PX+PW-5, p.bx + (rng()-0.5)*J*2));
    p.ty = Math.max(PY+5, Math.min(PY+PH-5, p.by + (rng()-0.5)*J*2));
  });
  awayP.forEach(function(p) {
    p.tx = Math.max(PX+5, Math.min(PX+PW-5, p.bx + (rng()-0.5)*J*2));
    p.ty = Math.max(PY+5, Math.min(PY+PH-5, p.by + (rng()-0.5)*J*2));
  });
  var all = homeP.concat(awayP);
  var pick = all[Math.floor(rng() * all.length)];
  btx = Math.max(PX+5, Math.min(PX+PW-5, pick.tx + (rng()-0.5)*22));
  bty = Math.max(PY+5, Math.min(PY+PH-5, pick.ty + (rng()-0.5)*22));
}

// ── Process event ─────────────────────────────────────────────────────────────
function processEvt(evt) {
  var isHome = evt.teamId === cfg.homeId;
  if (evt.type === 'goal') {
    if (isHome) homeScore++; else awayScore++;
    btx = W/2 + (rng()-0.5)*20;
    bty = isHome ? (PY - 4) : (PY + PH + 4);
    var att = isHome ? homeP : awayP;
    att.forEach(function(p, i) {
      if (i > 0) { p.tx = W/2 + (rng()-0.5)*80; p.ty = isHome ? PY+50 : PY+PH-50; }
    });
    setOv('GOAL!', 'goal', 2600);
    flashAlpha = 0.55; flashColor = isHome ? cfg.homeColor : cfg.awayColor;
    spawnConfetti(isHome ? cfg.homeColor : cfg.awayColor);
  } else if (evt.type === 'yellow_card') { setOv('YELLOW CARD', 'yellow', 1800);
  } else if (evt.type === 'red_card')    { setOv('RED CARD!',   'red',    2200);
  } else if (evt.type === 'save')        {
    setOv('GREAT SAVE!', 'save', 1600);
    btx = W/2 + (rng()-0.5)*35;
    bty = isHome ? PY+60 : PY+PH-60;
  } else if (evt.type === 'var_check')   { setOv('VAR REVIEW', 'var',     2200);
  } else if (evt.type === 'foul')        { setOv('FOUL!',       'neutral', 1100);
  } else if (evt.type === 'injury')      { setOv('INJURY',      'neutral', 1400);
  }
}
function setOv(text, type, dur) { ovText=text; ovType=type; ovAlpha=1; ovTimer=dur; }

// ── Confetti ──────────────────────────────────────────────────────────────────
function spawnConfetti(col) {
  var COLS = [col, 0xffffff, 0xffd700, 0xff5555, 0x55ff99];
  for (var i = 0; i < 72; i++) {
    confetti.push({
      x:  W/2 + (rng()-0.5)*110, y: MIDPY - 40 + (rng()-0.5)*60,
      vx: (rng()-0.5)*6.5,       vy: -(2 + rng()*5.5),
      col: COLS[Math.floor(rng()*COLS.length)],
      w: 3+rng()*6, h: 2+rng()*4, rot: rng()*Math.PI*2,
      rv: (rng()-0.5)*0.26, a: 1.0
    });
  }
}

// ── Banner ────────────────────────────────────────────────────────────────────
function showBanner(txt, dur) { bannerText=txt; bannerAlpha=1; bannerTimer=dur; }

// ── Main update ───────────────────────────────────────────────────────────────
function update(ts) {
  var delta = Math.min(ts - lastTick, 100);
  lastTick = ts;

  if (phase === 'boot') {
    bootProg = Math.min(1.0, bootProg + delta / 1500);
    if (bootProg >= 1.0) {
      phase = 'kickoff';
      initPlayers();
      showBanner('KICK OFF!', 2400);
      setTimeout(function() { if (phase === 'kickoff') phase = 'playing'; }, 2500);
    }
  } else {
    bootFade = Math.max(0, bootFade - delta / 500);
  }

  if (phase === 'playing') {
    minuteAccum += delta * speed;
    while (minuteAccum >= 1000) { minuteAccum -= 1000; if (currentMinute < 90) currentMinute++; }
    while (nextEvt < timeline.length && timeline[nextEvt].minute <= currentMinute) {
      processEvt(timeline[nextEvt]); nextEvt++;
    }
    if (currentMinute >= 45 && !halftimeDone) {
      halftimeDone = true; phase = 'halftime';
      showBanner('HALF TIME  ' + homeScore + ' - ' + awayScore, 3200);
      setTimeout(function() { if (phase === 'halftime') phase = 'playing'; }, 3400);
    }
    if (currentMinute >= 90) {
      phase = 'fulltime';
      showBanner('FULL TIME  ' + homeScore + ' - ' + awayScore, 8000);
      if (!ftSent) {
        ftSent = true;
        setTimeout(function() {
          try {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({ type:'MATCH_RESULT', homeScore:homeScore, awayScore:awayScore, homeId:cfg.homeId, awayId:cfg.awayId })
            );
          } catch(e) {}
        }, 4800);
      }
    }
    wanderTimer += delta * speed;
    if (wanderTimer > 1350) { wanderTimer = 0; doWander(); }
  }

  // Lerp players
  var lf = Math.min(1, delta * 0.0075);
  homeP.forEach(function(p) { p.x += (p.tx-p.x)*lf; p.y += (p.ty-p.y)*lf; });
  awayP.forEach(function(p) { p.x += (p.tx-p.x)*lf; p.y += (p.ty-p.y)*lf; });

  // Ball + trail
  trail.push({ x:bx, y:by, a:0.38 });
  if (trail.length > 8) trail.shift();
  trail.forEach(function(t) { t.a *= 0.80; });
  var bf = Math.min(1, delta * 0.013);
  bx += (btx-bx)*bf; by += (bty-by)*bf;

  // Overlay fade
  if (ovAlpha > 0) { ovTimer -= delta; if (ovTimer <= 0) { ovAlpha -= delta/320; if (ovAlpha<0) ovAlpha=0; } }
  if (flashAlpha > 0)   { flashAlpha  -= delta/1300; if (flashAlpha<0)  flashAlpha=0;  }
  if (bannerAlpha > 0)  { bannerTimer -= delta; if (bannerTimer<=0) { bannerAlpha -= delta/480; if (bannerAlpha<0) bannerAlpha=0; } }

  // Confetti physics
  var dt = delta / 16;
  confetti = confetti.filter(function(p) { return p.a > 0.04; });
  confetti.forEach(function(p) {
    p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 0.13*dt; p.vx *= 0.992; p.rot += p.rv*dt; p.a -= 0.007*dt;
  });

  draw();
  requestAnimationFrame(update);
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawPitch();

  if (phase !== 'boot') {
    drawPlayers();
    drawTrail();
    drawBall();
    drawFlash();
    drawConfetti();
  }

  // UI bars drawn before overlays so overlays float on top
  drawScoreBar();
  drawPossessionBar();

  // Overlays always on top of everything
  if (phase !== 'boot') {
    drawOverlay();
    drawBanner();
  }

  if (bootFade > 0) drawBoot();
}

// ── Players ───────────────────────────────────────────────────────────────────
function drawPlayers() {
  function dp(p, isHome, idx) {
    var isGK = idx === 0, r = isGK ? 7 : 5;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(p.x+2, p.y+3, r*1.4, r*0.48, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = n2rgb(isHome ? cfg.homeColor : cfg.awayColor);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = isGK ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.68)';
    ctx.lineWidth   = isGK ? 1.8 : 1.2; ctx.stroke();
    if (isGK) { ctx.fillStyle='#ffd700'; ctx.beginPath(); ctx.arc(p.x,p.y,2.5,0,Math.PI*2); ctx.fill(); }
  }
  homeP.forEach(function(p,i){ dp(p,true, i); });
  awayP.forEach(function(p,i){ dp(p,false,i); });
}

// ── Ball ──────────────────────────────────────────────────────────────────────
function drawTrail() {
  trail.forEach(function(t) {
    ctx.globalAlpha = t.a; ctx.fillStyle = '#ccc';
    ctx.beginPath(); ctx.arc(t.x, t.y, 2.5, 0, Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}
function drawBall() {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(bx+2, by+3, 7.2, 2.8, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.9;
  for (var bi = 0; bi < 5; bi++) {
    var ang = (bi/5)*Math.PI*2 - Math.PI/2;
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+Math.cos(ang)*3.3, by+Math.sin(ang)*3.3); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(90,90,90,0.6)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI*2); ctx.stroke();
}

// ── Flash ─────────────────────────────────────────────────────────────────────
function drawFlash() {
  if (flashAlpha <= 0) return;
  ctx.fillStyle = n2rgba(flashColor, flashAlpha * 0.30);
  ctx.fillRect(0, GRASS_Y, W, GRASS_H);
  ctx.strokeStyle = n2rgba(flashColor, flashAlpha * 0.85);
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W/2, MIDPY, 40 + (1-flashAlpha)*110, 0, Math.PI*2); ctx.stroke();
}
function drawConfetti() {
  confetti.forEach(function(p) {
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = p.a; ctx.fillStyle = n2rgb(p.col);
    ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function drawScoreBar() {
  // BG
  ctx.fillStyle = '#00292A';
  ctx.fillRect(0, 0, W, SCORE_H);
  // Subtle color washes
  ctx.fillStyle = n2rgba(cfg.homeColor, 0.18);
  ctx.fillRect(0, 0, W/2, SCORE_H);
  ctx.fillStyle = n2rgba(cfg.awayColor, 0.18);
  ctx.fillRect(W/2, 0, W/2, SCORE_H);
  // Bottom border
  ctx.fillStyle = '#1a3a3a';
  ctx.fillRect(0, SCORE_H-1, W, 1);

  // Home code
  ctx.fillStyle = '#FACE43';
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(cfg.homeCode, 10, 22);
  // Home name
  ctx.fillStyle = '#aaa';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText((cfg.homeName || '').substring(0, 13), 10, 34);
  // Home formation
  ctx.fillStyle = '#556';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText(cfg.homeFormation || '', 10, 45);

  // Away code
  ctx.fillStyle = '#FACE43';
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(cfg.awayCode, W-10, 22);
  // Away name
  ctx.fillStyle = '#aaa';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText((cfg.awayName || '').substring(0, 13), W-10, 34);
  // Away formation
  ctx.fillStyle = '#556';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText(cfg.awayFormation || '', W-10, 45);

  // Score — center, large, #FACE43
  ctx.fillStyle = '#FACE43';
  ctx.font = 'bold 28px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(homeScore + '  -  ' + awayScore, W/2, SCORE_H/2 - 4);
  ctx.textBaseline = 'alphabetic';

  // Minute — below score
  var ms = (phase==='playing'||phase==='halftime') ? (currentMinute + "'")
         : (phase==='fulltime'||phase==='kickoff')  ? 'FT' : '--';
  ctx.fillStyle = '#778';
  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(ms, W/2, SCORE_H - 5);
}

// ── Possession bar ────────────────────────────────────────────────────────────
function drawPossessionBar() {
  var Y = GRASS_B + AD_H;  // below bottom ad board
  // BG
  ctx.fillStyle = '#00292A';
  ctx.fillRect(0, Y, W, POSS_H);
  ctx.fillStyle = '#1a3a3a';
  ctx.fillRect(0, Y, W, 1); // top border

  // Split colored bar — top portion of the zone
  var barH = 8, barY = Y + 7;
  var homeBarW = Math.floor(W * homePoss / 100);
  ctx.fillStyle = n2rgb(cfg.homeColor);
  ctx.fillRect(0, barY, homeBarW, barH);
  ctx.fillStyle = n2rgb(cfg.awayColor);
  ctx.fillRect(homeBarW, barY, W - homeBarW, barH);
  // Centre divider
  ctx.fillStyle = '#00292A';
  ctx.fillRect(homeBarW - 1, barY - 1, 2, barH + 2);

  // Labels — all at same y, below the bar
  var textY = Y + 24;
  ctx.font = '9px "Courier New", monospace';
  ctx.fillStyle = '#94B0C0';
  ctx.textAlign = 'left';
  ctx.fillText(cfg.homeCode + ' ' + homePoss + '%', 8, textY);
  ctx.textAlign = 'center';
  ctx.fillText('POSSESSION', W/2, textY);
  ctx.textAlign = 'right';
  ctx.fillText(awayPoss + '% ' + cfg.awayCode, W-8, textY);
}

// ── Event overlay ─────────────────────────────────────────────────────────────
function drawOverlay() {
  if (ovAlpha <= 0) return;
  ctx.save(); ctx.globalAlpha = ovAlpha;
  var bg, tc, fs;
  if      (ovType === 'goal')   { bg='rgba(0,0,0,0.78)';       tc='#FACE43'; fs=48; }
  else if (ovType === 'yellow') { bg='rgba(185,140,0,0.88)';   tc='#fff';    fs=20; }
  else if (ovType === 'red')    { bg='rgba(200,0,0,0.88)';     tc='#fff';    fs=20; }
  else if (ovType === 'save')   { bg='rgba(0,60,200,0.88)';    tc='#fff';    fs=20; }
  else if (ovType === 'var')    { bg='rgba(5,5,5,0.92)';       tc='#00e0ff'; fs=20; }
  else                          { bg='rgba(20,20,20,0.82)';    tc='#ddd';    fs=17; }

  // GOAL gets a full-width dark band across the pitch center
  var OH = ovType === 'goal' ? 80 : 46;
  var OY = MIDPY - OH/2;
  ctx.fillStyle = bg;
  if (ovType === 'goal') {
    ctx.fillRect(0, OY, W, OH);
    // Accent lines top and bottom
    ctx.fillStyle = '#FACE43'; ctx.fillRect(0, OY, W, 2); ctx.fillRect(0, OY+OH-2, W, 2);
  } else {
    ctx.roundRect(W/2-130, OY, 260, OH, 7); ctx.fill();
  }
  ctx.fillStyle = tc;
  ctx.font = 'bold ' + fs + 'px Courier New';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ovText, W/2, MIDPY);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ── Banner ────────────────────────────────────────────────────────────────────
function drawBanner() {
  if (bannerAlpha <= 0) return;
  ctx.save(); ctx.globalAlpha = bannerAlpha;
  var BW = Math.min(W - 20, 360), BH = 56;
  var BX = W/2 - BW/2, BY = MIDPY - BH/2 - 40;
  ctx.fillStyle = 'rgba(0,0,0,0.94)';
  ctx.roundRect(BX, BY, BW, BH, 8); ctx.fill();
  ctx.strokeStyle = '#FACE43'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#FACE43';
  ctx.font = 'bold 19px Courier New';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(bannerText, W/2, BY + BH/2);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ── Boot screen ───────────────────────────────────────────────────────────────
function drawBoot() {
  ctx.save(); ctx.globalAlpha = bootFade;
  ctx.fillStyle = '#00292A'; ctx.fillRect(0, 0, W, H);
  // Glow title
  ctx.shadowColor = '#FACE43'; ctx.shadowBlur = Math.floor(bootProg * 30);
  ctx.fillStyle = '#FACE43'; ctx.font = 'bold 30px Courier New'; ctx.textAlign = 'center';
  ctx.fillText('FITBOLPIX', W/2, H*0.26);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#556'; ctx.font = '10px Courier New';
  ctx.fillText('MATCH SIMULATOR', W/2, H*0.26 + 22);

  // VS
  var vy = H * 0.46;
  ctx.textAlign = 'right'; ctx.fillStyle = n2rgb(cfg.homeColor);
  ctx.font = 'bold 22px Courier New'; ctx.fillText(cfg.homeCode, W/2 - 18, vy);
  ctx.textAlign = 'center'; ctx.fillStyle = '#334'; ctx.font = 'bold 15px Courier New';
  ctx.fillText('VS', W/2, vy);
  ctx.textAlign = 'left'; ctx.fillStyle = n2rgb(cfg.awayColor);
  ctx.font = 'bold 22px Courier New'; ctx.fillText(cfg.awayCode, W/2 + 18, vy);
  // Names
  ctx.fillStyle = '#778'; ctx.font = '9px Courier New';
  ctx.textAlign = 'right'; ctx.fillText((cfg.homeName||'').substring(0,13), W/2-18, vy+16);
  ctx.textAlign = 'left';  ctx.fillText((cfg.awayName||'').substring(0,13), W/2+18, vy+16);

  // Progress bar
  var PBW = Math.min(280, W-80), PBH = 6, PBX = W/2-PBW/2, PBY = H*0.67;
  ctx.fillStyle = '#0e2b2b'; ctx.roundRect(PBX, PBY, PBW, PBH, 3); ctx.fill();
  if (bootProg > 0.01) {
    ctx.fillStyle = '#FACE43'; ctx.roundRect(PBX, PBY, Math.max(2, PBW*bootProg), PBH, 3); ctx.fill();
  }
  ctx.fillStyle = '#445'; ctx.font = '8px Courier New'; ctx.textAlign = 'center';
  ctx.fillText('LOADING MATCH...', W/2, PBY + 18);
  ctx.restore();
}

// ── Go ────────────────────────────────────────────────────────────────────────
requestAnimationFrame(update);
})();
</script>
</body>
</html>`;

  console.log('[matchSim HTML start]', html.substring(0, 300));
  return html;
}
