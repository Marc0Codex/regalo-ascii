import * as THREE from '../vendor/three.module.js';
import { C, toon, addLights, fitFov } from './palette.js';
import { rng, easeIn } from './util.js';
import { LOOP } from './audio.js';

const BEAT = 60 / 143, PI2 = Math.PI * 2;

const SURF_V = `uniform float uT; varying vec3 vN; varying float vD; varying vec3 vP;
float H(vec2 p){return .35*sin(p.x*.35+uT*.9)+.25*sin(p.y*.5-uT*.7+p.x*.2)+.12*sin(p.x*.9+p.y*.8+uT*1.7);}
void main(){vec3 p=position;vec2 q=p.xz;float h=H(q),e=.1;p.y+=h;
 vN=normalize(vec3((H(q+vec2(e,0.))-h)/e,-1.,(H(q+vec2(0.,e))-h)/e));
 vP=(modelMatrix*vec4(p,1.)).xyz;vec4 mv=modelViewMatrix*vec4(p,1.);vD=-mv.z;gl_Position=projectionMatrix*mv;}`;
const SURF_F = `uniform float uT; varying vec3 vN; varying float vD; varying vec3 vP;
void main(){float s=length(vN.xz);float b=smoothstep(.06,.5,s);
 float band=.5+.5*sin(vP.x*1.3+vP.z*1.1+uT*1.2+s*6.);
 vec3 deep=vec3(.05,.09,.22),hi=vec3(.42,.65,.74);
 vec3 col=mix(deep,hi,clamp(b*.6+band*.18,0.,1.));
 col=mix(col,vec3(.03,.024,.043),smoothstep(5.,34.,vD));
 gl_FragColor=vec4(col,1.);}`;

function makeJelly(color, scale, seed) {
  const R = rng(seed), g = new THREE.Group(), tentColor = new THREE.Color(color).lerp(new THREE.Color(0xffffff), .35);
  const pts = []; for (let i = 0; i <= 12; i++) { const p = i / 12 * Math.PI * .5; pts.push(new THREE.Vector2(Math.sin(p), Math.cos(p) * .75)); }
  pts.push(new THREE.Vector2(1.08, -.1), new THREE.Vector2(1, -.2));
  const geo = new THREE.LatheGeometry(pts, 28), pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) if (pa.getY(i) < 0) pa.setY(i, pa.getY(i) + .07 * Math.sin(Math.atan2(pa.getZ(i), pa.getX(i)) * 8));
  geo.computeVertexNormals();
  const bell = new THREE.Mesh(geo, toon(color, { side: THREE.DoubleSide }));
  const inner = new THREE.Mesh(geo, toon(tentColor, { side: THREE.DoubleSide })); inner.scale.set(.74, .7, .74); inner.position.y = -.02;
  const bellG = new THREE.Group(); bellG.add(bell, inner); g.add(bellG);
  // tentáculos finos + brazos orales gruesos como esferas instanciadas
  const NT = 9, NS = 15, NA = 4, NAS = 9, total = NT * NS + NA * NAS;
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), toon(tentColor), total); g.add(im);
  const d = new THREE.Object3D(), ph = Array.from({ length: NT + NA }, () => R() * PI2);
  const update = (t, p) => {
    bellG.scale.set(1 - .09 * p, 1 + .14 * p, 1 - .09 * p);
    let n = 0;
    for (let k = 0; k < NT; k++) {
      const a = k / NT * PI2, r = .78;
      for (let i = 0; i < NS; i++) {
        const f = i / NS, sw = Math.sin(t * 1.7 - i * .55 + ph[k]) * .16 * f * 1.6;
        d.position.set(Math.cos(a) * r * (1 - f * .25) + sw, -.1 - i * .2 * (1 - .12 * p), Math.sin(a) * r * (1 - f * .25) + Math.cos(t * 1.3 - i * .5 + ph[k]) * .12 * f);
        d.scale.setScalar(.065 * (1 - f * .45)); d.updateMatrix(); im.setMatrixAt(n++, d.matrix);
      }
    }
    for (let k = 0; k < NA; k++) {
      const a = k / NA * PI2 + .4;
      for (let i = 0; i < NAS; i++) {
        const f = i / NAS, sw = Math.sin(t * 1.3 - i * .6 + ph[NT + k]) * .22 * f;
        d.position.set(Math.cos(a) * (.3 + sw), -.05 - i * .15, Math.sin(a) * (.3 - sw * .6));
        d.scale.setScalar(.12 * (1 - f * .5)); d.updateMatrix(); im.setMatrixAt(n++, d.matrix);
      }
    }
    im.instanceMatrix.needsUpdate = true;
  };
  g.scale.setScalar(scale * .62);
  return { g, update };
}

export function makeOcean() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1.7, .1, 100);
  scene.fog = new THREE.Fog(C.bg, 8, 26); addLights(scene);
  const sg = new THREE.PlaneGeometry(90, 90, 120, 120); sg.rotateX(Math.PI / 2);
  const surf = new THREE.Mesh(sg, new THREE.ShaderMaterial({ vertexShader: SURF_V, fragmentShader: SURF_F, uniforms: { uT: { value: 0 } }, side: THREE.DoubleSide }));
  surf.position.y = 12; scene.add(surf);
  // nieve marina
  const R = rng(7), N = 260, pp = new Float32Array(N * 3), base = [];
  for (let i = 0; i < N; i++) { base.push([(R() - .5) * 30, R() * 18 - 6, R() * 22 - 8, R() * PI2]); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const snow = new THREE.Points(pg, new THREE.PointsMaterial({ color: C.menta, size: 3, sizeAttenuation: false })); snow.frustumCulled = false; scene.add(snow);
  // medusas: [color, escala, radio de órbita, centro x, centro z, y base, vueltas por loop, fase]
  const defs = [
    [C.rosa, 1.5, 3.2, 0, 1.5, -.6, 1, 0], [C.lila, 1.2, 4.5, -1, -1, .8, -1, 2.1], [C.crema, .9, 3.8, 1.5, 0, 1.9, 1, 4.0],
    [C.menta, 1.0, 6, 0, -5, 0, 1, 1.0], [C.rosa, .7, 5, 2, -3, 2.6, -1, 5.2], [C.lila, 1.8, 7.5, 0, -9, 1, 1, 3.1], [C.mant, .6, 2.8, -2, 2.5, 1.2, -1, 0.7],
  ];
  const jellies = defs.map(([c, s, r, cx, cz, y, dir, ph], i) => {
    const j = makeJelly(c, s, 11 + i); scene.add(j.g); return { j, r, cx, cz, y, dir, ph };
  });
  const setAspect = a => fitFov(camera, a, 50, .5);
  return {
    scene, camera, setAspect,
    update(t) {
      surf.material.uniforms.uT.value = t;
      const rise = easeIn((t - 15) / 3.6) * 11;
      jellies.forEach((o, i) => {
        const ang = o.ph + o.dir * PI2 * t / LOOP; // una vuelta completa por loop
        o.j.g.position.set(o.cx + o.r * Math.cos(ang), o.y + 3.2 + .55 * Math.sin(t * .5 + i) + rise * (1 + i * .1), o.cz + o.r * .6 * Math.sin(ang));
        o.j.g.rotation.set(.12 * Math.sin(t * .6 + i), -ang * o.dir, .1 * Math.cos(t * .5 + i));
        o.j.update(t, Math.sin(PI2 * t / (BEAT * 2) + i * .35));
      });
      const a = snow.geometry.attributes.position;
      base.forEach((b, i) => a.setXYZ(i, b[0] + Math.sin(t * .3 + b[3]) * .4, ((b[1] + t * .35 + 6) % 18) - 6, b[2]));
      a.needsUpdate = true;
      camera.position.set(.9 * Math.sin(t * .22), -.4 + .25 * Math.sin(t * .31), 11);
      camera.lookAt(0, 1.8 + .3 * Math.sin(t * .2) + (t > 15 ? easeIn((t - 15) / 3.6) * 3 : 0), 0);
    },
  };
}
