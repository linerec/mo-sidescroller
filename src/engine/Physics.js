/**
 * Physics — XY 평면 위의 AABB(축 정렬 박스) 물리.
 * 3D로 그리지만 게임플레이는 2D 횡스크롤이므로 Z는 물리에서 다루지 않는다.
 *
 * Body 타입
 *  - static    : 지형. 움직이지 않음. solid.
 *  - kinematic : 이동 플랫폼. 코드가 vx/vy로 움직임. 위에 올라탄 dynamic을 함께 이동시킴.
 *  - dynamic   : 플레이어/적/NPC. 중력, 충돌 해소.
 *  - sensor    : 트리거/아이템/함정. 충돌 해소 없이 겹침(overlap)만 감지.
 * dynamic 끼리는 서로 밀지 않고 overlap 콜백만 발생한다 (마리오식).
 */
export class Body {
  constructor({ x = 0, y = 0, w = 1, h = 1, type = 'dynamic', owner = null, gravity = true, oneWay = false, solid = true, gravityScale = 1 } = {}) {
    this.x = x; this.y = y;               // 중심 좌표
    this.hw = w / 2; this.hh = h / 2;
    this.vx = 0; this.vy = 0;
    this.type = type; this.owner = owner;
    this.gravity = gravity && type === 'dynamic';
    this.gravityScale = gravityScale;
    this.oneWay = oneWay;                 // 아래에서 위로 통과 가능한 발판
    this.solid = solid;
    this.enabled = true;
    // 접촉 상태 (매 스텝 갱신)
    this.onGround = false; this.groundBody = null;
    this.blockedLeft = false; this.blockedRight = false; this.hitCeiling = false;
    this.dx = 0; this.dy = 0;             // kinematic 이동량
    this.dropThrough = false;             // true면 이번 스텝 oneWay 무시(아래로 내려가기)
  }
  get left() { return this.x - this.hw; }  get right() { return this.x + this.hw; }
  get bottom() { return this.y - this.hh; } get top() { return this.y + this.hh; }
  get w() { return this.hw * 2; } get h() { return this.hh * 2; }
  setSize(w, h) { this.hw = w / 2; this.hh = h / 2; }
  overlaps(o) {
    return Math.abs(this.x - o.x) < this.hw + o.hw && Math.abs(this.y - o.y) < this.hh + o.hh;
  }
}

/**
 * SurfaceBody — 폴리라인(높이 곡선) 지형. 격자 AABB로는 못 만드는 비정규 지형용:
 * 완만한 언덕, 가파른 절벽, 괴물의 등처럼 굽은 표면.
 *
 *  points : [[x,y], ...] 로컬 좌표. x가 증가해야 한다(한 x에 높이 하나 = 높이 함수).
 *           그래서 오버행/동굴은 표현할 수 없다 — 그런 곳은 AABB 블록과 섞어 쓰면 된다.
 *  maxSlopeDeg : 이 각도보다 가파르면 설 수 없다 → 미끄러지고, 옆에서는 벽처럼 막힌다.
 *  움직이는 지형(괴물 등)은 type:'kinematic' + moveTo(x,y) 로 옮기면 위에 탄 몸이 함께 실려간다.
 */
export class SurfaceBody {
  constructor({ points, type = 'static', owner = null, maxSlopeDeg = 50, enabled = true } = {}) {
    this.pts = points.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0]);
    this.type = type; this.owner = owner; this.enabled = enabled;
    this.maxSlopeTan = Math.tan(maxSlopeDeg * Math.PI / 180);
    this.ox = 0; this.oy = 0;        // 위치 오프셋
    this.dx = 0; this.dy = 0;        // 이번 스텝 이동량 (탑승체 운반용)
    this.isSurface = true;
  }
  get minX() { return this.pts[0][0] + this.ox; }
  get maxX() { return this.pts[this.pts.length - 1][0] + this.ox; }

  #seg(x) {                          // x를 포함하는 구간 인덱스 (이진 탐색)
    const p = this.pts;
    let lo = 0, hi = p.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m][0] <= x) lo = m; else hi = m; }
    return lo;
  }
  /** 월드 x에서의 표면 높이. 범위 밖이면 null */
  heightAt(worldX) {
    const p = this.pts, x = worldX - this.ox;
    if (x < p[0][0] || x > p[p.length - 1][0]) return null;
    const i = this.#seg(x), [x0, y0] = p[i], [x1, y1] = p[i + 1];
    const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
    return y0 + (y1 - y0) * t + this.oy;
  }
  /** 월드 x에서의 기울기 dy/dx */
  slopeAt(worldX) {
    const p = this.pts, x = worldX - this.ox;
    if (x <= p[0][0] || x >= p[p.length - 1][0]) return 0;
    const i = this.#seg(x), [x0, y0] = p[i], [x1, y1] = p[i + 1];
    return x1 === x0 ? 0 : (y1 - y0) / (x1 - x0);
  }
  /** 발 범위[left,right]에서 가장 높은 지지 높이 (오르막에 파묻히지 않도록) */
  supportHeight(left, right) {
    let best = null;
    const take = (h) => { if (h !== null && (best === null || h > best)) best = h; };
    take(this.heightAt(left)); take(this.heightAt(right));
    for (const [px, py] of this.pts) {           // 구간 안의 봉우리
      const wx = px + this.ox;
      if (wx > left && wx < right) take(py + this.oy);
    }
    return best;
  }
  /** 처음 배치 — 이동량을 남기지 않는다 (남기면 위에 탄 몸이 그만큼 튕겨나간다) */
  setPosition(x, y) { this.ox = x; this.oy = y; this.dx = 0; this.dy = 0; }
  /** 지형을 옮긴다 (위에 탄 몸이 함께 움직이도록 이동량을 기록) */
  moveTo(x, y) { this.dx = x - this.ox; this.dy = y - this.oy; this.ox = x; this.oy = y; }
}

export class Physics {
  gravity = -34;
  maxFall = -45;
  bodies = [];
  surfaces = [];          // 폴리라인 지형
  slideAccel = 26;        // 설 수 없는 경사에서 미끄러지는 가속

  add(body) { if (!this.bodies.includes(body)) this.bodies.push(body); return body; }
  remove(body) { const i = this.bodies.indexOf(body); if (i >= 0) this.bodies.splice(i, 1); }
  clear() { this.bodies.length = 0; this.surfaces.length = 0; }

  addSurface(s) { if (!this.surfaces.includes(s)) this.surfaces.push(s); return s; }
  removeSurface(s) { const i = this.surfaces.indexOf(s); if (i >= 0) this.surfaces.splice(i, 1); }

  #solids() { return this.bodies.filter((b) => b.enabled && b.solid && (b.type === 'static' || b.type === 'kinematic')); }

  step(dt) {
    const solids = this.#solids();
    const movers = this.bodies.filter((b) => b.enabled && (b.type === 'dynamic' || b.type === 'sensor'));

    // 1) kinematic 이동
    for (const b of this.bodies) {
      if (b.type !== 'kinematic' || !b.enabled) continue;
      b.dx = b.vx * dt; b.dy = b.vy * dt;
      b.x += b.dx; b.y += b.dy;
    }

    // 2) dynamic 이동 + 충돌 해소
    for (const b of movers) {
      if (b.type !== 'dynamic') continue;
      if (b.gravity) b.vy = Math.max(this.maxFall, b.vy + this.gravity * b.gravityScale * dt);
      // 올라탄 플랫폼과 함께 이동
      if (b.groundBody?.type === 'kinematic') { b.x += b.groundBody.dx; b.y += b.groundBody.dy; }

      const prevBottom = b.bottom, prevX = b.x, wasGround = b.onGround;
      b.blockedLeft = b.blockedRight = b.hitCeiling = false;
      // X축
      b.x += b.vx * dt;
      for (const s of solids) {
        if (s.oneWay || !b.overlaps(s)) continue;
        // 프레임 시작 시 이 지형의 윗면 위에 서 있었거나 그보다 높았다면, 이번 겹침은
        // 옆면 충돌이 아니라 "위에서 착지/정지" 상황이다. X축에서 옆으로 밀어내면 안 되고
        // (그러면 발판 밖으로 튕겨 떨어짐) Y축이 발판 위에 안착시키도록 건너뛴다.
        if (prevBottom >= s.top - 0.02) continue;
        if (b.vx > 0) { b.x = s.left - b.hw; b.blockedRight = true; }
        else if (b.vx < 0) { b.x = s.right + b.hw; b.blockedLeft = true; }
        b.vx = 0;
      }
      // 곡면 절벽: 진행 방향 앞이 오를 수 없을 만큼 높고 가파르면 벽처럼 막는다
      if (this.surfaces.length && b.vx !== 0) {
        const dir = Math.sign(b.vx), lead = dir > 0 ? b.right : b.left;
        for (const s of this.surfaces) {
          if (!s.enabled) continue;
          const h = s.heightAt(lead);
          if (h === null) continue;
          if (h > prevBottom + 0.6 && Math.abs(s.slopeAt(lead)) > s.maxSlopeTan) {
            b.x = prevX; b.vx = 0;
            if (dir > 0) b.blockedRight = true; else b.blockedLeft = true;
            break;
          }
        }
      }
      // Y축
      b.y += b.vy * dt;
      b.onGround = false; b.groundBody = null; b.groundSlope = 0;   // 평지 기본값(경사 지형이 덮어씀)
      for (const s of solids) {
        if (!b.overlaps(s)) continue;
        if (s.oneWay) {
          // 아래로 떨어지는 중이고, 이전 프레임에 발판 위에 있었을 때만 충돌
          if (b.vy > 0 || b.dropThrough || prevBottom < s.top - 0.05) continue;
        }
        if (b.vy <= 0) { b.y = s.top + b.hh; b.vy = 0; b.onGround = true; b.groundBody = s; }
        else { b.y = s.bottom - b.hh; b.vy = 0; b.hitCeiling = true; }
      }
      // 2-b) 폴리라인 곡면 지형 (언덕·절벽·괴물 등)
      if (this.surfaces.length) this.#resolveSurface(b, prevBottom, wasGround, dt);
      b.dropThrough = false;
    }

    // 지형 이동량은 이번 스텝에서 소비했으므로 초기화 (계속 실려가지 않도록)
    for (const s of this.surfaces) { s.dx = 0; s.dy = 0; }

    // 3) 겹침 감지 (dynamic↔dynamic, dynamic↔sensor)
    for (let i = 0; i < movers.length; i++) {
      for (let j = i + 1; j < movers.length; j++) {
        const a = movers[i], c = movers[j];
        if (a.type === 'sensor' && c.type === 'sensor') continue;
        if (!a.overlaps(c)) continue;
        a.owner?.onOverlap?.(c.owner, c);
        c.owner?.onOverlap?.(a.owner, a);
      }
    }
  }

  /**
   * 폴리라인 지형 위 안착/보행 처리.
   *  - 착지: 발이 표면을 파고들었고 위에서 내려온 경우 → 표면에 올려놓는다
   *  - 내리막 붙잡기: 직전에 접지였다면 약간 아래의 표면까지 끌어당겨, 내리막에서 통통 튀지 않게 한다
   *  - 급경사: maxSlope를 넘으면 설 수 없다 → 접지 아님(점프 불가) + 내리막으로 미끄러진다
   */
  #resolveSurface(b, prevBottom, wasGround, dt) {
    const eps = 0.03, stepUp = 0.6;
    const snapDown = (wasGround && b.vy <= 0.001) ? 0.5 + Math.abs(b.vx) * dt : 0;
    let ground = null, gh = -Infinity;
    for (const s of this.surfaces) {
      if (!s.enabled) continue;
      // 발 "중심"의 높이로 지지한다 — 발 범위의 최댓값을 쓰면 경사에서 폭×기울기만큼 떠 보인다
      const h = s.heightAt(b.x);
      if (h === null) continue;
      const landing = b.bottom <= h + eps && prevBottom >= h - stepUp;
      const gluing = snapDown > 0 && b.bottom > h && b.bottom - h <= snapDown;
      if ((landing || gluing) && b.vy <= 0.001 && h > gh) { gh = h; ground = s; }
    }
    if (!ground) return;
    const slope = ground.slopeAt(b.x);
    b.groundSlope = slope;
    b.y = gh + b.hh; b.vy = 0;
    if (Math.abs(slope) <= ground.maxSlopeTan) {
      b.onGround = true; b.groundBody = ground;      // 걸을 수 있는 경사
    } else {
      b.onGround = false; b.groundBody = null;       // 너무 가팔라 설 수 없음 → 미끄러짐
      b.vx += -Math.sign(slope) * this.slideAccel * dt;
    }
  }

  /** 영역 질의 — 공격 히트박스, 발밑 확인 등 */
  overlapBox(x, y, w, h, filter = () => true) {
    const hw = w / 2, hh = h / 2, out = [];
    for (const b of this.bodies) {
      if (!b.enabled) continue;
      if (Math.abs(b.x - x) < hw + b.hw && Math.abs(b.y - y) < hh + b.hh && filter(b)) out.push(b);
    }
    return out;
  }

  /** (x, y) 아래에 solid 지면이 있는지 — 적 AI의 낭떠러지 감지용 */
  groundBelow(x, y, depth = 0.6) {
    return this.overlapBox(x, y - depth / 2, 0.2, depth, (b) => b.solid && (b.type === 'static' || b.type === 'kinematic')).length > 0;
  }
}
