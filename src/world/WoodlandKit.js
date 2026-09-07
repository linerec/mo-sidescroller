import * as THREE from 'three';
import { nocturneMaterial } from './NocturneMaterial.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let loading;
export function loadWoodlandKit() {
  if (!loading) loading = load().catch(error => { loading = null; throw error; });
  return loading;
}
async function load() {
  const manifestURL=new URL('../../assets/environment/woodland/manifest.json',import.meta.url);
  const response=await fetch(manifestURL);
  if(!response.ok) throw new Error('Blender 숲 키트 설정을 불러오지 못했습니다.');
  const manifest=await response.json();
  if(manifest.version!==1 || manifest.grid!==1) throw new Error('Unsupported woodland kit');
  const gltf=await new GLTFLoader().loadAsync(new URL(manifest.library,manifestURL).href);
  gltf.scene.updateMatrixWorld(true);
  const templates=new Map(),painted=new Map();
  gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    const source=o.material;
    if(!painted.has(source))painted.set(source,nocturneMaterial(source));
    o.material=painted.get(source);
  });
  for(const source of painted.keys())source.dispose();
  gltf.scene.traverse(root=>{
    const id=root.userData.asset_id;
    if(!id)return;
    const inverse=root.matrixWorld.clone().invert(), parts=[];
    root.traverse(o=>{
      if(o.isMesh) parts.push({ geometry:o.geometry, material:o.material, matrix:inverse.clone().multiply(o.matrixWorld) });
    });
    if(!parts.length) throw new Error(`Empty kit module ${id}`);
    templates.set(id,parts);
  });
  for(const asset of manifest.assets) if(!templates.has(asset.id)) throw new Error(`Missing Blender module: ${asset.id}`);
  // The library intentionally owns shared GPU resources for the app lifetime.
  return {manifest,templates};
}

/** Convert module placements to instanced GLB primitives, never rebuild model shapes in JS. */
export function assembleKit(kit, placements, { name='Blender woodland modules' } = {}) {
  const group=new THREE.Group();group.name=name;
  const batches=new Map(), dummy=new THREE.Object3D();
  for(const p of placements) {
    const template=kit.templates.get(p.asset);
    if(!template)throw new Error(`Unknown woodland module ${p.asset}`);
    dummy.position.set(p.x,p.y,p.z??0);dummy.rotation.set(0,p.yaw??0,0);
    const s=p.scale??1;dummy.scale.set(s*(p.scaleX??1),s*(p.scaleY??1),s);dummy.updateMatrix();
    for(const part of template) {
      const key=part.geometry.uuid+':'+part.material.uuid+':'+(p.tint||'original');
      if(!batches.has(key))batches.set(key,{part,tint:p.tint,transforms:[]});
      batches.get(key).transforms.push(dummy.matrix.clone().multiply(part.matrix));
    }
  }
  for(const {part,tint,transforms} of batches.values()) {
    let material=part.material;
    if(tint) material=new THREE.MeshBasicMaterial({color:tint});
    const mesh=new THREE.InstancedMesh(part.geometry,material,transforms.length);
    mesh.name='Blender module instances';mesh.userData.sharedKit=true;
    if(tint)mesh.userData.ownedKitMaterial=true;
    transforms.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();
    mesh.castShadow=false;mesh.receiveShadow=!tint;group.add(mesh);
  }
  group.userData.moduleCount=placements.length;
  return group;
}

export function disposeKitGroup(group) {
  group.traverse(o=>{
    if(o.isInstancedMesh)o.dispose();
    if(o.userData.ownedKitMaterial)o.material.dispose();
    if(!o.userData.sharedKit){o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();}
  });
  group.removeFromParent();group.clear();
}
