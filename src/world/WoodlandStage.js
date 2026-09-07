import * as THREE from 'three';
import { seeded } from '../entities/Decor.js';
import { loadWoodlandKit, assembleKit } from './WoodlandKit.js';
import { tilePlacements, LAYERS, cell } from './MapData.js';
import { woodlandAtmosphere } from './ForestAtmosphere.js';

export function sceneryPlacements(map) {
  const result=[],width=map.rows[0].length,rnd=seeded(map.seed);
  const add=(asset,x,y,z,scale=1,tint=null)=>result.push({asset,x,y,z,scale,tint});
  if(map.autoForest) {
    const deep=map.mood==='glade';
    // Atmospheric distances compress contrast while silhouettes grow above the frame.
    for(let x=-110;x<width+120;x+=28) add('hill',x,-8,-90,5,deep?0x092b43:0x0b354a);
    for(let x=-90;x<width+100;x+=16+rnd()*10) add('distant_tree',x,-4,-60-rnd()*12,4+rnd()*2,deep?0x083444:0x0b3e4b);
    for(let x=-40;x<width+50;x+=18+rnd()*12) {
      add(['tree_oak','tree_birch','tree_willow'][Math.floor(rnd()*3)],x,-3,-30-rnd()*9,3+rnd()*1.8);
    }
    // A few monumental forms frame clear breathing spaces instead of an even wall of trees.
    add('ancient_tree',deep?25:30,-4,deep?-22:-26,deep?1.65:1.45);
    for(let x=-18;x<width+40;x+=65) add('root_arch',x,-2,-10,1.3+rnd()*.5);
    for(let x=-15;x<width+20;x+=5+rnd()*6) {
      add(rnd()<.5?'bush_0':'bush_1',x,.6,-5-rnd()*3,1+rnd()*.8);
      if(rnd()<.4)add('fern',x+.5,1.5,-3,.8);
    }
  }
  // Surface dressing obeys exposed-cell rules and never fills a gap.
  for(let y=0;y<map.rows.length;y++) for(let x=0;x<width;x++) {
    if(cell(map.rows,x,y)==='#' && cell(map.rows,x,y+1)!=='#') {
      const n=Math.abs(Math.imul(x+7,1249)^Math.imul(y+3,437)^map.seed);
      if(n%13===0)add('glow_reeds',x+.5,y+1,-.7,.65);
      else if(n%7===0)add('grass',x+.5,y+1,-.65,.85);
      else if(n%17===0)add('mushrooms',x+.5,y+1,-.70,.5);
    }
  }
  for(const p of map.decorations)add(p.asset,p.x,p.y,LAYERS[p.layer],p.scale);
  return result;
}

export async function mountWoodland(stage,map) {
  const kit=await loadWoodlandKit(), forest=new THREE.Group();forest.name='Blender woodland world';
  const terrain=assembleKit(kit,tilePlacements(map),{name:'Autotiled Blender terrain'});
  const scenery=assembleKit(kit,sceneryPlacements(map),{name:'Placed Blender scenery'});
  const atmosphere=woodlandAtmosphere({width:map.rows[0].length,mood:map.mood,seed:map.seed});
  forest.add(terrain,scenery,atmosphere);forest.update=t=>atmosphere.update(t);
  forest.userData.theme=map.mood;forest.userData.kitVersion=kit.manifest.version;
  stage.kit=kit;stage.mapData=map;stage.forest=stage.addObject(forest);
  return forest;
}

export function dressMovingPlatform(entity,kit) {
  const b=entity.body,parts=[];
  if(!Number.isInteger(b.w))throw new Error('Woodland platforms must use whole grid widths');
  for(let i=0;i<b.w;i++)parts.push({asset:b.w===1?'platform_single':i===0?'platform_left':i===b.w-1?'platform_right':'platform_middle',x:-b.hw+i,y:b.hh,z:0,scaleY:b.h/.3});
  entity.object.add(assembleKit(kit,parts,{name:'Blender moving platform'}));
}

/** Keep the NPC's dialogue, body and walk controller; replace only its visual rig. */
export function dressForestKeeper(npc,kit) {
  const old=npc.rig;
  old.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
  old.removeFromParent();
  npc.rig=new THREE.Group();npc.rig.add(assembleKit(kit,[{asset:'keeper',x:0,y:-npc.body.hh,z:0,scale:npc.body.h/1.5}]));
  npc.object.add(npc.rig);npc.frontFacing=true;
}
