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

export class Physics {
  gravity = -34;
  maxFall = -45;
  bodies = [];

  add(body) { if (!this.bodies.includes(body)) this.bodies.push(body); return body; }
  remove(body) { const i = this.bodies.indexOf(body); if (i >= 0) this.bodies.splice(i, 1); }
  clear() { this.bodies.length = 0; }

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

      const prevBottom = b.bottom;
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
      // Y축
      b.y += b.vy * dt;
      b.onGround = false; b.groundBody = null;
      for (const s of solids) {
        if (!b.overlaps(s)) continue;
        if (s.oneWay) {
          // 아래로 떨어지는 중이고, 이전 프레임에 발판 위에 있었을 때만 충돌
          if (b.vy > 0 || b.dropThrough || prevBottom < s.top - 0.05) continue;
        }
        if (b.vy <= 0) { b.y = s.top + b.hh; b.vy = 0; b.onGround = true; b.groundBody = s; }
        else { b.y = s.bottom - b.hh; b.vy = 0; b.hitCeiling = true; }
      }
      b.dropThrough = false;
    }

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
