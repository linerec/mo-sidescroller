import * as THREE from 'three';
import { CinematicRenderer } from '../render/CinematicRenderer.js';
import { FOREST_ENV, woodlandAtmosphere } from '../world/ForestAtmosphere.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadMap,validateMap,saveDraft,PROP_IDS,cell,tilePlacements } from '../world/MapData.js';
import { loadWoodlandKit,assembleKit,disposeKitGroup } from '../world/WoodlandKit.js';
import { sceneryPlacements } from '../world/WoodlandStage.js';
const $=s=>document.querySelector(s),canvas=$('#grid'),ctx=canvas.getContext('2d');
let map,kit,tool='#',zoom=24,undo=[],redo=[],drag=false,last=null,selected={x:3,y:2},previewGroup,previewAtmosphere,timer;
const workingMaps=new Map();
const controls=[...document.querySelectorAll('main button,main input,main select')];
controls.forEach(c=>c.disabled=true);
const status=text=>{$('#status').textContent=text;};
const markers={ 'stage-1-1':[[10,3,'노인'],[40,8.5,'레버'],[44.5,5.5,'문'],[67.5,2.8,'출구']], 'stage-1-2':[[4,2.75,'표지판'],[8,1.6,'이동 발판'],[28,2.8,'출구']] };
const renderer=new THREE.WebGLRenderer({canvas:$('#view'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xd8e4ca);scene.fog=new THREE.Fog(0xd8e4ca,28,85);
const hemi=new THREE.HemisphereLight();scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffedc1,2.5);sun.position.set(-8,20,15);scene.add(sun);
const camera=new THREE.PerspectiveCamera(43,1,.1,180);camera.position.set(11,9,22);
const cinematic=new CinematicRenderer(renderer,scene,camera);
const orbit=new OrbitControls(camera,$('#view'));orbit.target.set(10,4,0);orbit.enableDamping=true;
new ResizeObserver(()=>{const r=$('#view').getBoundingClientRect();renderer.setSize(r.width,r.height,false);cinematic.resize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe($('#view'));
function frame(){requestAnimationFrame(frame);orbit.update();previewAtmosphere?.update(performance.now()/1000);cinematic.render();}frame();
function history(){undo.push(JSON.stringify(map));if(undo.length>50)undo.shift();redo=[];}
function sync(){ $('#map').value=map.id;$('#mood').value=map.mood;$('#auto').checked=map.autoForest;$('#width').value=map.rows[0].length;$('#height').value=map.rows.length;draw();rebuild(); }
function rebuild(){
  clearTimeout(timer);timer=setTimeout(()=>{
    if(previewGroup)disposeKitGroup(previewGroup);
    previewGroup=assembleKit(kit,[...tilePlacements(map),...sceneryPlacements(map)]);scene.add(previewGroup);
    const env=FOREST_ENV[map.mood];scene.background.set(env.sky);scene.fog=new THREE.Fog(env.fogColor,env.fog.near,env.fog.far);
    hemi.color.set(env.hemi.sky);hemi.groundColor.set(env.hemi.ground);hemi.intensity=env.hemi.intensity;
    sun.color.set(env.sun.color);sun.intensity=env.sun.intensity;
    previewAtmosphere=woodlandAtmosphere({width:map.rows[0].length,mood:map.mood,seed:map.seed});previewGroup.add(previewAtmosphere);
    $('#selection').textContent=`${kit.manifest.assets.length}종 Blender 키트 · ${previewGroup.userData.moduleCount}개 조각`;
  },110);
}
function draw(){
  if(!map)return;
  const w=map.rows[0].length,h=map.rows.length;
  canvas.width=w*zoom;canvas.height=h*zoom;
  ctx.fillStyle='#0b202d';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const ch=cell(map.rows,x,y),px=x*zoom,py=(h-1-y)*zoom;
    if(ch==='#'){ctx.fillStyle='#142e3a';ctx.fillRect(px,py,zoom,zoom);if(cell(map.rows,x,y+1)!=='#'){ctx.fillStyle='#39776f';ctx.fillRect(px,py,zoom,Math.max(3,zoom*.2));}}
    else if(ch==='='){ctx.fillStyle='#75928a';ctx.fillRect(px,py+zoom*.35,zoom,zoom*.3);}
  }
  ctx.strokeStyle='#7ba6aa22';ctx.lineWidth=.5;ctx.beginPath();
  for(let x=0;x<=w;x++){ctx.moveTo(x*zoom,0);ctx.lineTo(x*zoom,h*zoom);}for(let y=0;y<=h;y++){ctx.moveTo(0,y*zoom);ctx.lineTo(w*zoom,y*zoom);}ctx.stroke();
  for(const p of map.decorations){
    const px=p.x*zoom,py=(h-p.y)*zoom;
    ctx.fillStyle=p.layer==='far'?'#9ebaae':p.layer==='mid'?'#69947a':'#416d49';
    ctx.beginPath();ctx.arc(px,py-zoom*.35,zoom*.25,0,Math.PI*2);ctx.fill();
    ctx.fillRect(px-1,py-zoom*.15,2,zoom*.15);
  }
  ctx.font=`${Math.max(9,zoom*.39)}px sans-serif`;ctx.textAlign='center';
  for(const [x,y,label] of markers[map.id]){ctx.fillStyle='#48534399';ctx.fillRect(x*zoom-3,(h-y)*zoom-3,6,6);ctx.fillText(label,x*zoom,(h-y)*zoom-7);}
  ctx.fillStyle='#fffdf0';ctx.strokeStyle='#66734f';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(map.spawn.x*zoom,(h-map.spawn.y)*zoom,zoom*.31,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#364734';ctx.fillText('모찌',map.spawn.x*zoom,(h-map.spawn.y)*zoom-zoom*.48);
  ctx.strokeStyle='#d09c4f';ctx.lineWidth=2;ctx.strokeRect(selected.x*zoom+1,(h-1-selected.y)*zoom+1,zoom-2,zoom-2);
  $('#undo').disabled=!undo.length;$('#redo').disabled=!redo.length;
}
function position(e){const r=canvas.getBoundingClientRect();return{x:Math.floor((e.clientX-r.left)/zoom),y:map.rows.length-1-Math.floor((e.clientY-r.top)/zoom)};}
function paint(p){
  const w=map.rows[0].length,h=map.rows.length;if(p.x<0||p.y<0||p.x>=w||p.y>=h)return;
  selected=p;
  if(tool==='spawn')map.spawn={x:p.x+.5,y:p.y+.65};
  else if(tool==='prop'){
    if(map.decorations.length>=300){status('장식은 300개까지 배치할 수 있어요.');return;}
    if(!map.decorations.some(d=>Math.floor(d.x)===p.x&&Math.floor(d.y)===p.y&&d.asset===$('#asset').value))map.decorations.push({asset:$('#asset').value,x:p.x+.5,y:p.y,layer:$('#layer').value,scale:Number($('#scale').value)});
  }else{
    const row=h-1-p.y;const chars=[...map.rows[row]];chars[p.x]=tool==='erase'?'.':tool;map.rows[row]=chars.join('');
    if(tool==='erase')map.decorations=map.decorations.filter(d=>Math.floor(d.x)!==p.x||Math.floor(d.y)!==p.y);
  }
  draw();rebuild();status('편집 중 · 저장하거나 초안으로 플레이해 보세요.');
}
canvas.addEventListener('pointerdown',e=>{if(!map||e.button!==0)return;history();drag=true;last=position(e);canvas.setPointerCapture(e.pointerId);paint(last);});
canvas.addEventListener('pointermove',e=>{
  if(!map)return;const p=position(e);$('#coords').textContent=`X ${p.x} · Y ${p.y} / 1칸 = 1m`;
  if(drag){const steps=Math.max(Math.abs(p.x-last.x),Math.abs(p.y-last.y));for(let i=1;i<=steps;i++)paint({x:Math.round(last.x+(p.x-last.x)*i/steps),y:Math.round(last.y+(p.y-last.y)*i/steps)});last=p;}
});
function end(){drag=false;last=null;}canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(o=>o.setAttribute('aria-pressed',o===b));});
$('#asset').onchange=()=>document.querySelector('[data-tool="prop"]').click();
$('#zoom').oninput=()=>{zoom=Number($('#zoom').value);draw();};
$('#focus').onclick=()=>{orbit.target.set(selected.x+.5,selected.y+1,0);camera.position.set(selected.x+2,selected.y+5,16);};
$('#undo').onclick=()=>{if(undo.length){redo.push(JSON.stringify(map));map=JSON.parse(undo.pop());sync();}};
$('#redo').onclick=()=>{if(redo.length){undo.push(JSON.stringify(map));map=JSON.parse(redo.pop());sync();}};
$('#mood').onchange=()=>{history();map.mood=$('#mood').value;sync();};$('#auto').onchange=()=>{history();map.autoForest=$('#auto').checked;sync();};
$('#resize').onclick=()=>{
  const w=Number($('#width').value),h=Number($('#height').value);
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<8||w>160||h<4||h>64){status('너비 8~160, 높이 4~64의 정수를 입력하세요.');return;}
  history();const rows=[];for(let y=h-1;y>=0;y--){let row='';for(let x=0;x<w;x++)row+=cell(map.rows,x,y);rows.push(row);}map.rows=rows;
  map.spawn.x=Math.min(map.spawn.x,w-.5);map.spawn.y=Math.min(map.spawn.y,h-.5);map.decorations=map.decorations.filter(d=>d.x<w&&d.y<h);sync();status('크기를 변경했습니다. 되돌리기로 복구할 수 있어요.');
};
async function choose(id){
  if(map)workingMaps.set(map.id,structuredClone(map));
  try{map=workingMaps.has(id)?structuredClone(workingMaps.get(id)):await loadMap(id);undo=[];redo=[];sync();status('맵을 열었습니다. 스테이지를 바꿔도 탭 안의 편집 내용은 유지됩니다.');}
  catch(e){if(map)$('#map').value=map.id;status(e.message);}
}
$('#map').onchange=()=>choose($('#map').value);
$('#save').onclick=()=>{try{saveDraft(map);status('이 브라우저에 초안을 저장했습니다.');}catch(e){status(e.message);}};
$('#restore').onclick=async()=>{try{const loaded=await loadMap(map.id,{draft:true});history();map=loaded;sync();status('저장한 초안을 열었습니다.');}catch(e){status(e.message);}};
$('#export').onclick=()=>{try{const data=validateMap(map);const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=data.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('JSON을 내보냈습니다. maps 폴더의 같은 이름 파일에 반영하세요.');}catch(e){status(e.message);}};
$('#import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const loaded=validateMap(JSON.parse(await file.text()));history();map=loaded;sync();status('JSON을 가져왔습니다. 플레이로 확인해 보세요.');}catch(e){status(e.message);}finally{e.target.value='';}};
$('#play').onclick=()=>{try{saveDraft(map);window.open(`./?stage=${map.id}&draft=${map.id}`,'_blank','noopener');status('초안을 저장하고 게임을 열었습니다.');}catch(e){status(e.message);}};
try {
  kit=await loadWoodlandKit();
  for(const a of kit.manifest.assets.filter(a=>PROP_IDS.includes(a.id))){const o=document.createElement('option');o.value=a.id;o.textContent=a.label;$('#asset').append(o);}
  await choose('stage-1-1');if(!map)throw new Error('맵 로딩 실패');controls.forEach(c=>c.disabled=false);draw();
  window.mapEditor={get map(){return map;},get kit(){return kit;},get preview(){return previewGroup;}};
}catch(e){status('키트를 불러오지 못했습니다: '+e.message);console.error(e);}
