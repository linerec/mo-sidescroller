import * as THREE from 'three';
import { Entity } from '../engine/Entity.js';
import { SurfaceBody } from '../engine/Physics.js';

/**
 * TerrainSurface — 폴리라인 윤곽선으로 만드는 비정규 지형.
 * 격자 블록으로는 못 만드는 언덕·절벽·괴물의 등 같은 굽은 표면을 표현한다.
 *
 *   import * as T from '../../world/TerrainShapes.js';
 *   this.add(new TerrainSurface({ points: T.creatureBack({ length: 18, height: 4 }), x: 30, y: 2 }));
 *
 *  points       : [[x,y],...] 로컬 윤곽선 (x 오름차순)
 *  maxSlopeDeg  : 이보다 가파르면 설 수 없다 → 미끄러지고 옆에서는 막힌다 (기본 50°)
 *  kinematic    : true면 움직이는 지형 (moveTo/bob 으로 이동, 위에 탄 것을 함께 옮김)
 *  visual:false : 충돌만 담당하고 그림은 다른 아트 레이어가 그린다
 */
export class TerrainSurface extends Entity {
  constructor({
    points, x = 0, y = 0, z = 0, name = 'terrain-surface',
    maxSlopeDeg = 50, kinematic = false,
    depth = 4.5, color = 0x584a37, grass = 0x6f8f4e, grassThickness = 0.24,
    baseDrop = 8, visual = true, bob = null,       // bob: { amp, speed }
  } = {}) {
    super({ name, x, y, z, tags: ['terrain', 'surface'] });
    this.points = points;
    this.visual = visual;
    this.bob = bob; this.baseX = x; this.baseY = y;
    this.surface = new SurfaceBody({
      points, owner: this, maxSlopeDeg,
      type: (kinematic || bob) ? 'kinematic' : 'static',
    });
    this.surface.setPosition(x, y);   // 초기 배치는 이동량 없이
    if (visual) this.#buildMesh({ depth, color, grass, grassThickness, baseDrop });
  }

  onSpawn() { this.game.physics.addSurface(this.surface); }
  onDestroy() { this.game?.physics.removeSurface(this.surface); }

  /** 지형을 옮긴다 — 위에 올라탄 몸이 함께 실려간다 */
  moveTo(x, y) { this.surface.moveTo(x, y); }

  update(dt) {
    if (this.bob) {
      const t = this.stage ? this.stage.time : 0;
      this.moveTo(this.baseX, this.baseY + Math.sin(t * (this.bob.speed ?? 1)) * (this.bob.amp ?? 0.3));
    }
    this.object.position.set(this.surface.ox, this.surface.oy, this.z);
  }

  /** 윤곽선을 아래로 닫아 3D 덩어리로 압출 + 윗면에 잔디 띠 */
  #buildMesh({ depth, color, grass, grassThickness, baseDrop }) {
    const pts = this.points;
    if (!pts || pts.length < 2) return;
    const baseY = Math.min(...pts.map((p) => p[1])) - baseDrop;
    const zFront = -depth / 2 + 0.6;

    const body = new THREE.Shape();
    body.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) body.lineTo(pts[i][0], pts[i][1]);
    body.lineTo(pts[pts.length - 1][0], baseY);
    body.lineTo(pts[0][0], baseY);
    body.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(body, { depth, bevelEnabled: false });
    bodyGeo.translate(0, 0, zFront);
    const bodyMesh = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
    bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
    this.object.add(bodyMesh);

    // 윗면 잔디 띠 — 윤곽선을 따라가다 살짝 아래로 되돌아오는 닫힌 띠
    const band = new THREE.Shape();
    band.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) band.lineTo(pts[i][0], pts[i][1]);
    for (let i = pts.length - 1; i >= 0; i--) band.lineTo(pts[i][0], pts[i][1] - grassThickness);
    band.closePath();
    const bandGeo = new THREE.ExtrudeGeometry(band, { depth: depth + 0.04, bevelEnabled: false });
    bandGeo.translate(0, 0, zFront - 0.02);
    const bandMesh = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({ color: grass, roughness: 0.9 }));
    bandMesh.castShadow = true; bandMesh.receiveShadow = true;
    this.object.add(bandMesh);
  }
}
