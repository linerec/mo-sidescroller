import fs from 'node:fs';
import assert from 'node:assert/strict';
import {validateMap,tilePlacements,cell,PROP_IDS} from '../src/world/MapData.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../assets/environment/woodland/manifest.json',import.meta.url)));
const bytes=fs.readFileSync(new URL('../assets/environment/woodland/woodland-kit.glb',import.meta.url));
assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);
const g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
assert.equal(manifest.grid,1);assert.equal(manifest.assets.length,30);assert.equal(g.animations?.length||0,0);assert.equal(g.images?.length||0,0);
const roots=g.nodes.filter(n=>n.extras?.asset_id),ids=roots.map(n=>n.extras.asset_id);
assert.equal(new Set(ids).size,30);
const close=(a,b)=>assert.ok(Math.abs(a-b)<.0001,`${a} != ${b}`);
for(const a of manifest.assets){
 const root=roots.find(n=>n.extras.asset_id===a.id);assert.ok(root,a.id);assert.equal(root.extras.anchor,a.anchor);
 const primitives=[];
 function walk(i){const n=g.nodes[i];if(n.mesh!==undefined){assert.ok(!n.translation&&!n.rotation&&!n.scale&&!n.matrix,'Geometry transforms must be applied before export');primitives.push(...g.meshes[n.mesh].primitives);}for(const c of n.children||[])walk(c);}
 for(const c of root.children||[])walk(c);assert.ok(primitives.length);
 const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(const p of primitives){const accessor=g.accessors[p.attributes.POSITION];for(let i=0;i<3;i++){bounds.min[i]=Math.min(bounds.min[i],accessor.min[i]);bounds.max[i]=Math.max(bounds.max[i],accessor.max[i]);}}
 if(a.role==='solid'){close(bounds.min[0],0);close(bounds.max[0],1);close(bounds.min[1],0);close(bounds.max[1],1);assert.deepEqual(a.collision,{size:[1,1],offset:[.5,.5]});}
 if(a.role==='platform'){assert.ok(bounds.min[0]>=-.05&&bounds.max[0]<=1.05);assert.ok(bounds.min[1]>=-.301&&bounds.max[1]<=.04);assert.equal(a.collision.oneWay,true);}
 if(PROP_IDS.includes(a.id))assert.equal(a.collision,null);
}
const map={version:1,id:'stage-1-1',mood:'morning',seed:71,spawn:{x:1,y:3},autoForest:false,rows:['........','.#......','.###....','........'],decorations:[]};
assert.deepEqual(validateMap(map),map);
const placements=tilePlacements(map);assert.equal(placements.filter(p=>p.asset.startsWith('soil')).length,4);assert.equal(placements.filter(p=>p.asset.startsWith('top')).length,3);
assert.equal(placements.filter(p=>p.asset==='edge_left').length,2);assert.equal(placements.filter(p=>p.asset==='edge_right').length,2);
assert.ok(!placements.some(p=>p.x===0),'Empty cells must not acquire terrain');
assert.deepEqual(tilePlacements(map),placements,'Variant selection must be deterministic');
const plat=tilePlacements({...map,rows:['........','.===.=..','........','........']});
assert.deepEqual(plat.map(p=>p.asset),['platform_left','platform_middle','platform_right','platform_single']);
for(const p of plat)close(p.y,2.65);
const cases=[null,{...map,version:2},{...map,id:'bad'},{...map,rows:['........','...']},{...map,rows:['........','........','....x...','........']},{...map,spawn:{x:Infinity,y:2}},{...map,decorations:[{asset:'bad',x:1,y:1,scale:1,layer:'near'}]},{...map,decorations:[{asset:'fern',x:1,y:1,scale:4,layer:'near'}]}];
for(const invalid of cases)assert.throws(()=>validateMap(invalid));
for(const id of ['stage-1-1','stage-1-2']){const m=validateMap(JSON.parse(fs.readFileSync(new URL(`../maps/${id}.json`,import.meta.url))));for(const p of tilePlacements(m))assert.ok(ids.includes(p.asset));assert.equal(cell(m.rows,-1,0),'.');}
console.log('PASS: 30 exported Blender modules, applied geometry transforms, tile bounds and pivots, collision metadata, adjacency rules, platform caps, deterministic variants, map validation.');
