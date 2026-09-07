import { Block, OneWayPlatform } from '../entities/Terrain.js';

/**
 * ASCII 레이아웃으로 지형을 빠르게 만든다.
 *   '#' 단단한 지형(가로로 이어진 칸을 하나의 박스로 합침)
 *   '=' 한쪽 방향(위→아래) 발판
 *   '.' 또는 ' ' 빈 칸
 *   그 외 문자 → legend[문자](x, y, stage) 콜백 또는 marks 로 반환
 *
 * 예)
 *   buildFromAscii(this, `
 *   ..........P.....E....
 *   ####....######...####
 *   `, { tile: 1, legend: { P: (x, y) => this.spawnPlayer(x, y) } });
 *
 * 반환: { width, height, marks: { 문자: [{x, y}] } }
 */
export function buildFromAscii(stage, ascii, { tile = 1, originX = 0, originY = 0, legend = {}, blockOpts = {}, visual = true } = {}) {
  const rows = ascii.replace(/^\n+|\n+$/g, '').split('\n');
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const marks = {};
  const cellX = (c) => originX + c * tile + tile / 2;
  const cellY = (r) => originY + (H - 1 - r) * tile + tile / 2;

  for (let r = 0; r < H; r++) {
    const row = rows[r].padEnd(W, '.');
    let c = 0;
    while (c < W) {
      const ch = row[c];
      if (ch === '#' || ch === '=') {
        let end = c; while (end + 1 < W && row[end + 1] === ch) end++;
        const w = (end - c + 1) * tile, x = originX + c * tile + w / 2, y = cellY(r);
        if (ch === '#') stage.add(new Block({ x, y, w, h: tile, visual, ...blockOpts }));
        else stage.add(new OneWayPlatform({ x, y, w, h: tile * 0.3, visual }));
        c = end + 1;
        continue;
      }
      if (ch !== '.' && ch !== ' ') {
        const x = cellX(c), y = cellY(r);
        (marks[ch] ||= []).push({ x, y });
        legend[ch]?.(x, y, stage);
      }
      c++;
    }
  }
  return { width: W * tile, height: H * tile, marks };
}
