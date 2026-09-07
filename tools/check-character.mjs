import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARACTER_DEFS, MOTIONS } from '../src/characters/definitions.js';
import { MotionState } from '../src/characters/MotionState.js';

const def = CHARACTER_DEFS[process.argv[2] || 'mochi'];
assert.ok(def, 'Character must be registered');
const b = readFileSync(new URL(def.model));
assert.equal(b.readUInt32LE(0), 0x46546c67); assert.equal(b.readUInt32LE(4), 2);
assert.equal(b.readUInt32LE(8), b.length);
const g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
assert.equal(g.scenes.length, 1, 'Only the character scene may be exported');
assert.ok(g.skins?.length, 'Skinned character expected');
const clips = new Map(g.animations.map(a => [a.name, a]));
for (const [name, spec] of Object.entries(def.motions)) {
  const clip = clips.get(name); assert.ok(clip, `Missing ${name}`);
  const ends = clip.samplers.map(s => g.accessors[s.input].max[0]);
  assert.ok(Math.abs(Math.max(...ends) - spec.duration) < 0.04, `${name} duration mismatch`);
}
assert.equal(clips.size, Object.keys(def.motions).length);
assert.ok(g.nodes.some(n => n.name === 'root'));
assert.ok(g.nodes.some(n => n.name === 'socket_item'));
assert.ok(!g.cameras && !g.images, 'Mochi should have no studio cameras or external textures');
const motion = new MotionState(MOTIONS);
motion.play('attack'); assert.equal(motion.play('happy'), false);
assert.equal(motion.play('hit'), true); motion.update(0.21); assert.equal(motion.name, 'damage');
assert.equal(motion.play('attack'), false); motion.update(0.71, 'run'); assert.equal(motion.name, 'run');
motion.update(13, 'sleepy'); assert.equal(motion.name, 'sleepy'); motion.update(0.02, 'run'); assert.equal(motion.name, 'run');
motion.play('dead'); motion.update(10); assert.equal(motion.name, 'dead'); assert.equal(motion.play('jump'), false);
motion.play('idle', { force: true }); assert.equal(motion.busy, false);
console.log(`PASS: ${def.name}, ${clips.size} clips, ${g.meshes.length} meshes, ${(b.length / 1024).toFixed(0)} KiB; motion interruption/recovery/sleep/death.`);
