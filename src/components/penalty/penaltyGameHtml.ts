/**
 * Inline HTML for the Phaser 3 penalty goal animation WebView.
 *
 * Communication (postMessage):
 *   RN → WebView:  { type: 'shoot', zone: 0-8, gkDir: 'left'|'center'|'right',
 *                    gkHeight: 'high'|'low', outcome: 'goal'|'saved'|'miss' }
 *   RN → WebView:  { type: 'reset' }
 *   WebView → RN:  { type: 'ready' }
 *   WebView → RN:  { type: 'animDone', outcome: string }
 */

export const PENALTY_GAME_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; background:#0a5c1a; overflow:hidden; }
  canvas { display:block; }
</style>
</head>
<body>
<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
<script>
// ─── Constants ───────────────────────────────────────────────────────────────
const W = window.innerWidth;
const H = window.innerHeight;

// Goal layout (matches React Native GoalView proportions)
const GOAL_W = W * 0.86;
const GOAL_H = H * 0.58;
const GOAL_X = (W - GOAL_W) / 2;  // left edge
const GOAL_Y = H * 0.08;           // top of goal interior
const POST   = 6;

// Zone centers (3×3 grid, row-major 0–8)
function zoneCentre(zone) {
  const col = zone % 3;
  const row = Math.floor(zone / 3);
  const cellW = (GOAL_W - POST * 2) / 3;
  const cellH = (GOAL_H - POST) / 3;
  return {
    x: GOAL_X + POST + cellW * col + cellW / 2,
    y: GOAL_Y + POST + cellH * row + cellH / 2,
  };
}

// GK positions (relative to goal interior)
const GK_COL = { left: 0.18, center: 0.50, right: 0.82 };
const GK_ROW = { high: 0.20, low: 0.62 };

// Crowd palette
const CROWD_COLS = [0xe63946, 0xffd700, 0x2dc653, 0x60b4ff, 0xf4a261, 0xc084fc, 0xffffff];

// ─── Phaser Scene ─────────────────────────────────────────────────────────────
class PenaltyScene extends Phaser.Scene {
  constructor() { super({ key: 'PenaltyScene' }); }

  create() {
    this.cameras.main.setBackgroundColor('#0a5c1a');

    // Draw static scene
    this._drawCrowd();
    this._drawAdBoards();
    this._drawPitch();
    this._drawNet();
    this._drawPosts();

    // GK sprite (graphics object, repositioned on shoot)
    this.gkGfx = this.add.graphics();
    this._drawGK(this.gkGfx, 'center', 'low');

    // Ball (starts at penalty spot)
    this.ballSpot = { x: W / 2, y: GOAL_Y + GOAL_H + H * 0.12 };
    this.ball = this.add.graphics();
    this._drawBall(this.ball, this.ballSpot.x, this.ballSpot.y, 10);

    // Outcome text (hidden initially)
    this.outcomeText = this.add.text(W / 2, GOAL_Y + GOAL_H / 2, '', {
      fontFamily: 'monospace',
      fontSize: Math.round(H * 0.09) + 'px',
      fontStyle: 'bold',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center',
    }).setOrigin(0.5).setDepth(10).setAlpha(0);

    // Listen for messages from React Native
    const onMsg = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'shoot') this._handleShoot(data);
        if (data.type === 'reset') this._reset();
      } catch(e) {}
    };
    window.addEventListener('message', onMsg);
    document.addEventListener('message', onMsg); // Android WebView

    // Signal ready to RN
    this._postToRN({ type: 'ready' });
  }

  // ── Shoot animation ──────────────────────────────────────────────────────────
  _handleShoot({ zone, gkDir, gkHeight, outcome }) {
    const target = zoneCentre(zone);

    // Animate GK dive
    const gkX = GOAL_X + GK_COL[gkDir] * GOAL_W;
    const gkY = GOAL_Y + GK_ROW[gkHeight] * GOAL_H;

    // Ball trajectory
    const ballStartX = this.ballSpot.x;
    const ballStartY = this.ballSpot.y;
    let ballEndX, ballEndY;

    if (outcome === 'miss') {
      // Off to the side or over the bar
      const missDir = Math.random() < 0.5 ? 1 : -1;
      ballEndX = target.x + missDir * GOAL_W * 0.4;
      ballEndY = GOAL_Y - GOAL_H * 0.2;
    } else {
      ballEndX = target.x;
      ballEndY = target.y;
    }

    // Tween ball
    this.tweens.add({
      targets: {},
      t: 1,
      duration: 380,
      ease: 'Quad.easeIn',
      onUpdate: (tween) => {
        const t = tween.getValue();
        const bx = Phaser.Math.Linear(ballStartX, ballEndX, t);
        const by = Phaser.Math.Linear(ballStartY, ballEndY, t);
        const s  = Phaser.Math.Linear(10, outcome === 'miss' ? 5 : 7, t);
        this.ball.clear();
        this._drawBall(this.ball, bx, by, s);
      },
      onComplete: () => {
        // Move GK
        this.gkGfx.clear();
        this._drawGK(this.gkGfx, gkDir, gkHeight);

        // Show outcome
        const label  = outcome === 'goal' ? 'GOAL!' : outcome === 'saved' ? 'SAVED!' : 'MISS!';
        const colour = outcome === 'goal' ? '#ffd700' : outcome === 'saved' ? '#60b4ff' : '#e63946';
        this.outcomeText.setText(label).setColor(colour).setAlpha(1);

        // Flash + fade
        this.tweens.add({
          targets: this.outcomeText,
          alpha: 0,
          delay: 1000,
          duration: 600,
          onComplete: () => {
            this._postToRN({ type: 'animDone', outcome });
          },
        });
      },
    });
  }

  _reset() {
    this.tweens.killAll();
    this.ball.clear();
    this._drawBall(this.ball, this.ballSpot.x, this.ballSpot.y, 10);
    this.gkGfx.clear();
    this._drawGK(this.gkGfx, 'center', 'low');
    this.outcomeText.setAlpha(0).setText('');
  }

  // ── Drawing helpers ──────────────────────────────────────────────────────────

  _drawCrowd() {
    const g = this.add.graphics();
    const standH = H * 0.14;
    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 0, W, standH);
    const dotSize = 5;
    const gap = 7;
    for (let row = 0; row < 3; row++) {
      const y = 5 + row * (dotSize + gap);
      let x = 4;
      let ci = row * 3;
      while (x < W) {
        g.fillStyle(CROWD_COLS[ci % CROWD_COLS.length]);
        g.fillRect(x, y, dotSize, dotSize);
        x += dotSize + gap;
        ci++;
      }
    }
  }

  _drawAdBoards() {
    const g = this.add.graphics();
    const boardY = H * 0.14;
    const boardH = H * 0.05;
    const labels = ['FITBOLPIX', 'WC 2026', '⚽', 'GOOOL!', 'FITBOLPIX', 'WC 2026'];
    const bw = W / labels.length;
    labels.forEach((lbl, i) => {
      const col = i % 2 === 0 ? 0x1a3d28 : 0x0d2818;
      g.fillStyle(col);
      g.fillRect(i * bw, boardY, bw, boardH);
      g.lineStyle(1, 0x000000);
      g.strokeRect(i * bw, boardY, bw, boardH);
    });
    // Ad text
    labels.forEach((lbl, i) => {
      this.add.text(i * bw + bw / 2, boardY + boardH / 2, lbl, {
        fontFamily: 'monospace',
        fontSize: Math.round(boardH * 0.55) + 'px',
        fontStyle: 'bold',
        color: '#ffd700',
      }).setOrigin(0.5);
    });
  }

  _drawPitch() {
    const g = this.add.graphics();
    const pitchTop = H * 0.19;
    // Green stripes
    for (let i = 0; i < 6; i++) {
      g.fillStyle(i % 2 === 0 ? 0x0a5c1a : 0x0c6b1e);
      g.fillRect(i * (W / 6), pitchTop, W / 6, H - pitchTop);
    }
    // Penalty spot line
    g.lineStyle(1, 0xffffff, 0.25);
    g.strokeRect(W / 2 - 30, GOAL_Y + GOAL_H + H * 0.04, 60, 1);
    // Penalty spot
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(W / 2, this.ballSpot ? this.ballSpot.y : GOAL_Y + GOAL_H + H * 0.12, 4);
  }

  _drawNet() {
    const g = this.add.graphics();
    const cols = 10;
    const rows = 6;
    const netX = GOAL_X + POST;
    const netY = GOAL_Y + POST;
    const netW = GOAL_W - POST * 2;
    const netH = GOAL_H - POST;
    g.lineStyle(1, 0xffffff, 0.10);
    // Vertical lines
    for (let c = 0; c <= cols; c++) {
      const x = netX + (netW / cols) * c;
      g.beginPath();
      g.moveTo(x, netY);
      g.lineTo(x, netY + netH);
      g.strokePath();
    }
    // Horizontal lines
    for (let r = 0; r <= rows; r++) {
      const y = netY + (netH / rows) * r;
      g.beginPath();
      g.moveTo(netX, y);
      g.lineTo(netX + netW, y);
      g.strokePath();
    }
    // Slightly opaque net background
    g.fillStyle(0x000000, 0.15);
    g.fillRect(netX, netY, netW, netH);
  }

  _drawPosts() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff);
    // Left post
    g.fillRect(GOAL_X, GOAL_Y, POST, GOAL_H);
    // Right post
    g.fillRect(GOAL_X + GOAL_W - POST, GOAL_Y, POST, GOAL_H);
    // Crossbar
    g.fillRect(GOAL_X, GOAL_Y, GOAL_W, POST);
    // Post shadows
    g.fillStyle(0xcccccc, 0.4);
    g.fillRect(GOAL_X + POST, GOAL_Y, 3, GOAL_H);
    g.fillRect(GOAL_X + GOAL_W - POST - 3, GOAL_Y, 3, GOAL_H);
  }

  _drawGK(gfx, dir, height) {
    const cx = GOAL_X + GK_COL[dir] * GOAL_W;
    const cy = GOAL_Y + GK_ROW[height] * GOAL_H;
    const s  = Math.round(H * 0.055); // sprite scale

    // Body (orange kit)
    gfx.fillStyle(0xf4a261);
    gfx.fillRect(cx - s * 0.35, cy, s * 0.70, s * 0.55);
    // Head
    gfx.fillStyle(0xf4c07a);
    gfx.fillCircle(cx, cy - s * 0.18, s * 0.22);
    // Arms (stretched)
    gfx.fillStyle(0xf4a261);
    gfx.fillRect(cx - s * 0.85, cy + s * 0.05, s * 0.50, s * 0.20);
    gfx.fillRect(cx + s * 0.35, cy + s * 0.05, s * 0.50, s * 0.20);
    // Gloves
    gfx.fillStyle(0xffffff);
    gfx.fillCircle(cx - s * 0.85, cy + s * 0.15, s * 0.14);
    gfx.fillCircle(cx + s * 0.85, cy + s * 0.15, s * 0.14);
    // Shorts
    gfx.fillStyle(0x1a3d28);
    gfx.fillRect(cx - s * 0.30, cy + s * 0.55, s * 0.25, s * 0.25);
    gfx.fillRect(cx + s * 0.05, cy + s * 0.55, s * 0.25, s * 0.25);
  }

  _drawBall(gfx, x, y, r) {
    // White circle
    gfx.fillStyle(0xffffff);
    gfx.fillCircle(x, y, r);
    // Black pentagon patches (simplified)
    gfx.fillStyle(0x222222);
    gfx.fillCircle(x, y - r * 0.35, r * 0.28);
    gfx.fillCircle(x - r * 0.45, y + r * 0.20, r * 0.22);
    gfx.fillCircle(x + r * 0.45, y + r * 0.20, r * 0.22);
    // Border
    gfx.lineStyle(1, 0x999999, 0.6);
    gfx.strokeCircle(x, y, r);
  }

  _postToRN(data) {
    const msg = JSON.stringify(data);
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(msg);
      } else {
        window.parent.postMessage(msg, '*');
      }
    } catch(e) {}
  }
}

// ─── Launch Phaser ─────────────────────────────────────────────────────────────
const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: '#0a5c1a',
  parent: document.body,
  scene: [PenaltyScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  transparent: false,
};
new Phaser.Game(config);
</script>
</body>
</html>`;
