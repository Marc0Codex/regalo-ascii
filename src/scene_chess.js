import * as THREE from '../vendor/three.module.js';
import { C, toon, addLights, fitFov } from './palette.js';
import { clamp, lerp, ease, easeInOut, easeOutBack, easeOutCubic } from './util.js';
import { LOOP, BAR } from './audio.js';

// Partida de la Ópera (Morphy – Duque de Brunswick y Conde Isouard, París 1858), primeras 14 jugadas
const MOVES = 'e2e4 e7e5 g1f3 d7d6 d2d4 c8g4 d4e5 g4f3 d1f3 d6e5 f1c4 g8f6 f3b3 d8e7'.split(' ');
export const CH = { appear: LOOP - BAR, moves: LOOP + 2 * BAR, ply: BAR / 2, diveEnd: 2 * LOOP - .28 };
CH.diveStart = CH.moves + MOVES.length * CH.ply;

const sq = s => [s.charCodeAt(0) - 97, +s[1] - 1];
const xz = ([f, r]) => [f - 3.5, 3.5 - r];
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const PROFILE = {
  p: [[0, 0], [.32, 0], [.34, .06], [.26, .12], [.14, .4], [.2, .46], [.12, .5], [.18, .6], [.22, .72], [.18, .84], [.1, .9], [0, .92]],
  r: [[0, 0], [.36, 0], [.38, .08], [.28, .16], [.22, .6], [.32, .7], [.32, .92], [.24, .92], [.24, .84], [0, .84]],
  b: [[0, 0], [.34, 0], [.36, .08], [.24, .16], [.14, .5], [.22, .56], [.14, .62], [.24, .8], [.2, 1], [.1, 1.15], [0, 1.22]],
  q: [[0, 0], [.36, 0], [.38, .08], [.26, .16], [.14, .6], [.24, .68], [.14, .74], [.28, 1], [.3, 1.16], [.16, 1.14], [0, 1.14]],
  k: [[0, 0], [.36, 0], [.38, .08], [.26, .16], [.14, .6], [.24, .68], [.14, .74], [.3, 1], [.28, 1.2], [.14, 1.18], [0, 1.18]],
  n: [[0, 0], [.34, 0], [.36, .08], [.26, .16], [.2, .5], [.28, .56], [0, .58]],
};
const G = Object.fromEntries(Object.entries(PROFILE).map(([k, v]) => [k, lathe(v)]));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = r => new THREE.SphereGeometry(r, 10, 8);

function makePiece(type, mat, face) {
  const g = new THREE.Group(), add = (geo, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(G[type]);
  if (type === 'r') for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; add(box(.14, .16, .14), Math.cos(a) * .26, .98, Math.sin(a) * .26); }
  if (type === 'b') add(sph(.07), 0, 1.25);
  if (type === 'q') { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(sph(.07), Math.cos(a) * .24, 1.2, Math.sin(a) * .24); } add(sph(.1), 0, 1.24); }
  if (type === 'k') { add(box(.09, .34, .09), 0, 1.38); add(box(.26, .09, .09), 0, 1.4); }
  if (type === 'n') {
    const h = add(box(.3, .6, .4), 0, .85, face * .02); h.rotation.x = -face * .25;
    const s = add(box(.22, .22, .32), 0, .98, -face * .3); s.rotation.x = face * .35;
    add(box(.08, .16, .08), -.08, 1.2, face * .1); add(box(.08, .16, .08), .08, 1.2, face * .1);
  }
  g.scale.setScalar(1.2);
  return g;
}

export function makeChess() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(33, 1.7, .05, 100);
  addLights(scene);
  const board = new THREE.Group(); scene.add(board);
  const sqs = new THREE.InstancedMesh(box(.96, .2, .96), toon(0xffffff), 64);
  const d = new THREE.Object3D(), col = new THREE.Color();
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    const [x, z] = xz([f, r]); d.position.set(x, -.1, z); d.updateMatrix(); sqs.setMatrixAt(r * 8 + f, d.matrix);
    sqs.setColorAt(r * 8 + f, col.set((f + r) % 2 ? 0x8F7BC4 : 0x2D2352));
  }
  board.add(sqs);
  const frame = new THREE.Mesh(box(8.7, .3, 8.7), toon(C.lilaOsc)); frame.position.y = -.28; board.add(frame);

  // piezas
  const white = toon(0xFFB8D2), black = toon(0xBFE8D8), pieces = [], at = {};
  const back = 'rnbqkbnr';
  for (let f = 0; f < 8; f++) {
    [[back[f], 0, 1], ['p', 1, 1], ['p', 6, -1], [back[f], 7, -1]].forEach(([t, r, face]) => {
      const m = makePiece(t, face > 0 ? white : black, face); m.rotation.y = t === 'n' && face < 0 ? Math.PI : 0;
      board.add(m);
      const p = { m, t, face, sq0: [f, r], events: [], capturedAt: Infinity, delay: Math.random() };
      pieces.push(p); at[f + ',' + r] = p;
    });
  }
  // simula la partida para saber quién se mueve y quién cae
  MOVES.forEach((mv, i) => {
    const a = sq(mv.slice(0, 2)), b = sq(mv.slice(2)), p = at[a], cap = at[b];
    if (cap) cap.capturedAt = i; delete at[a]; at[b] = p; p.events.push({ i, a, b });
  });
  pieces.forEach((p, k) => p.delay = ((p.sq0[1] < 4 ? p.sq0[1] * 8 + p.sq0[0] : (7 - p.sq0[1]) * 8 + p.sq0[0]) / 32) * 2 * BAR * .9 + (p.sq0[1] < 4 ? 0 : .15));

  const setAspect = a => fitFov(camera, a, 33, .75);
  return {
    scene, camera, setAspect,
    update(t) {
      const rise = easeOutCubic((t - CH.appear) / (BAR * 1.2)); board.position.y = lerp(-7, 0, rise);
      pieces.forEach(p => {
        let [f, r] = p.sq0, y = 0, s = easeOutBack((t - LOOP - p.delay) / .5);
        for (const e of p.events) {
          const u = (t - CH.moves - e.i * CH.ply) / (CH.ply * .85);
          if (u >= 1) { [f, r] = e.b; continue; }
          if (u > 0) { const k = ease(u); f = lerp(e.a[0], e.b[0], k); r = lerp(e.a[1], e.b[1], k); y = Math.sin(Math.PI * u) * (p.t === 'n' ? 1 : .6); }
          break;
        }
        const cu = (t - CH.moves - p.capturedAt * CH.ply) / (CH.ply * .5);
        if (cu > .55) s *= 1 - clamp((cu - .55) * 2.2);
        const [x, z] = xz([f, r]); p.m.position.set(x, y, z); p.m.scale.setScalar(1.2 * clamp(s, 0, 1.2));
      });
      // órbita y descenso hacia la casilla d5
      const rel = t - LOOP, ph = .6 + rel * .3, R = 12.6 - .6 * Math.sin(rel * .3), h = 11.5 - 1.2 * Math.sin(rel * .35 + 1);
      const o = new THREE.Vector3(Math.sin(ph) * R, h, Math.cos(ph) * R), tgt = new THREE.Vector3(0, .3, 0);
      const u = easeInOut((t - CH.diveStart) / (CH.diveEnd - CH.diveStart));
      camera.position.copy(o).lerp(new THREE.Vector3(-.5, .9, -.15), u);
      camera.lookAt(tgt.lerp(new THREE.Vector3(-.5, 0, -.5), u));
    },
  };
}
