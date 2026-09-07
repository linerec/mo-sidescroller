import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CharacterVisual } from './CharacterVisual.js';
import { CHARACTER_DEFS } from './definitions.js';

const canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfffae9, 0x8b9a72, 2.5));
const key = new THREE.DirectionalLight(0xfff5e0, 3.2); key.position.set(-3, 5, 4); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -3; key.shadow.camera.right = 3;
key.shadow.camera.top = 3; key.shadow.camera.bottom = -3; key.shadow.normalBias = 0.02; scene.add(key);
const rim = new THREE.DirectionalLight(0xe0efc8, 1.5); rim.position.set(3, 3, -2); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: 0x62734e, opacity: 0.2 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.025; floor.receiveShadow = true; scene.add(floor);
const camera = new THREE.PerspectiveCamera(33, 1, 0.01, 100);
camera.position.set(0.25, 1.6, 4.8);
const orbit = new OrbitControls(camera, canvas); orbit.target.set(0, 0.55, 0); orbit.enableDamping = true;
orbit.minDistance = 2.3; orbit.maxDistance = 7; orbit.maxPolarAngle = Math.PI * 0.49; orbit.enablePan = false;
const character = new CharacterVisual(CHARACTER_DEFS.mochi); scene.add(character.object);
window.previewCharacter = character;
let chosen = 'idle', paused = false, speed = 1, facing = 1, replayTime = 0;
const status = document.querySelector('#status');
for (const [name, spec] of Object.entries(character.def.motions)) {
  const button = document.createElement('button'); button.textContent = spec.label;
  button.dataset.motion = name; button.setAttribute('aria-pressed', name === chosen);
  button.onclick = () => {
    chosen = name; replayTime = 0; character.play(name, { force: true });
    status.textContent = spec.label;
    document.querySelectorAll('[data-motion]').forEach(b => b.setAttribute('aria-pressed', b === button));
  };
  document.querySelector('#motions').append(button);
}
document.querySelector('#pause').onclick = e => { paused = !paused; e.target.textContent = paused ? '다시 움직이기' : '잠깐 멈추기'; };
document.querySelector('#speed').onchange = e => { speed = Number(e.target.value); };
document.querySelector('#turn').onclick = () => { facing *= -1; };
character.ready.then(ok => { status.textContent = ok ? '가만히 숨쉬기' : '모델을 불러오지 못했어요. 서버 연결을 확인해 주세요.'; });
new ResizeObserver(() => { const { width, height } = canvas.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }).observe(canvas.parentElement);
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (!paused) {
    replayTime += dt * speed;
    const spec = character.def.motions[chosen];
    if (!spec.loop && replayTime > spec.duration + 0.65) { character.play(chosen, { force: true }); replayTime = 0; }
    character.update(dt * speed, spec.loop ? chosen : 'idle', facing);
  }
  orbit.update(); renderer.render(scene, camera);
}
requestAnimationFrame(frame);
