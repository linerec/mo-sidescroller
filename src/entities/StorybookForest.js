import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from './Decor.js';

/** Original, geometry-based forest art. All scenery is non-colliding and stage-owned. */
export const FOREST_ENV = {
  morning: { sky: 0xd6e5cb, fogColor: 0xc5dbbf, fog: { near: 24, far: 100 },
    hemi: { sky: 0xe9f3d8, ground: 0x64775b, intensity: 2.1 },
    sun: { color: 0xffebba, intensity: 2.7, offset: [-12, 20, 10] } },
  glade: { sky: 0xa7cfc6, fogColor: 0xa3ccc0, fog: { near: 19, far: 90 },
    hemi: { sky: 0xd7efde, ground: 0x405e59, intensity: 1.9 },
    sun: { color: 0xffecc4, intensity: 2.4, offset: [-10, 18, 9] } },
};

const PALETTES = {
  morning: { skyTop: 0x83b6b4, skyBottom: 0xf1edc9, far: 0x85b4a2, mid: 0x548c79,
    bark: 0x665747, barkLight: 0x968165, leaf: [0x496c46, 0x617e45, 0x83964f, 0x9dac60],
    moss: 0x8da84f, grass: [0x536f3e, 0x7a9949, 0xa6b863], soil: 0x695844, rock: 0x65766a },
  glade: { skyTop: 0x67a8b1, skyBottom: 0xd4e5cc, far: 0x72a99e, mid: 0x437f77,
    bark: 0x4d6156, barkLight: 0x8a9680, leaf: [0x345f51, 0x47795c, 0x668c60, 0x8fa570],
    moss: 0x729e65, grass: [0x386c59, 0x679662, 0xa4b778], soil: 0x52665c, rock: 0x617e78 },
};

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const color = x => new THREE.Color(x);

// Merge irregular branches; instance repeated leaves, pebbles and plants.
// Materials/geometries belong to a single stage, so unloading releases all of them.
class ForestPainter {
  constructor(group, time) {
    this.group = group; this.time = time; this.batches = new Map(); this.strokes = [];
    this.dummy = new THREE.Object3D();
    this.geometries = {
      crown: new THREE.SphereGeometry(1, 20, 14),
      pebble: new THREE.IcosahedronGeometry(1, 1),
      leaf: new THREE.SphereGeometry(1, 7, 5),
      stem: new THREE.CylinderGeometry(0.65, 1, 1, 7),
      cap: new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.58),
    };
    // A slight unevenness removes the perfect primitive silhouette.
    const p = this.geometries.crown.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = 1 + 0.06 * Math.sin(x * 7 + z * 4) * Math.cos(y * 6 - x * 3);
      p.setXYZ(i, x * r, y * r, z * r);
    }
    this.geometries.crown.computeVertexNormals();
  }
  dot(kind, pos, scale, tint, { rotation = [0, 0, 0], flat = false, wind = false, shadow = false } = {}) {
    const key = `${kind}:${flat}:${wind}:${shadow}`;
    if (!this.batches.has(key)) this.batches.set(key, { kind, flat, wind, shadow, items: [] });
    this.batches.get(key).items.push({ pos, scale, tint, rotation });
  }
  line(points, radius, tint, segments = 8, taper = 0) {
    const curve = new THREE.CatmullRomCurve3(points.map(a => new THREE.Vector3(...a)));
    const geo = new THREE.TubeGeometry(curve, segments, radius, 6, false);
    if (taper) {
      const positions=geo.attributes.position;
      for(let i=0;i<positions.count;i++) {
        const t=Math.floor(i/7)/segments, center=curve.getPointAt(t), k=1-t*taper;
        positions.setXYZ(i,center.x+(positions.getX(i)-center.x)*k,center.y+(positions.getY(i)-center.y)*k,center.z+(positions.getZ(i)-center.z)*k);
      }
      geo.computeVertexNormals();
    }
    const c = color(tint), colors = [];
    for (let i = 0; i < geo.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.strokes.push(geo);
  }
  finish() {
    for (const batch of this.batches.values()) {
      const mat = batch.flat ? new THREE.MeshBasicMaterial({ color: 0xffffff }) :
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
      if (batch.wind) {
        mat.onBeforeCompile = shader => {
          shader.uniforms.forestTime = this.time;
          shader.vertexShader = 'uniform float forestTime;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
            #include <begin_vertex>
            float phase = instanceMatrix[3].x * 0.67 + instanceMatrix[3].z;
            transformed.x += sin(forestTime * 0.8 + phase) * 0.045 * (position.y + 1.0);
          `);
        };
        mat.customProgramCacheKey = () => 'storybook-wind-v1';
      }
      const mesh = new THREE.InstancedMesh(this.geometries[batch.kind], mat, batch.items.length);
      mesh.name = `Forest ${batch.kind}`;
      batch.items.forEach((item, i) => {
        this.dummy.position.set(...item.pos); this.dummy.scale.set(...item.scale);
        this.dummy.rotation.set(...item.rotation); this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix); mesh.setColorAt(i, color(item.tint));
      });
      mesh.castShadow = batch.shadow; mesh.receiveShadow = !batch.flat;
      mesh.computeBoundingSphere(); this.group.add(mesh);
    }
    if (this.strokes.length) {
      const geo = mergeGeometries(this.strokes);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
      mesh.name = 'Forest branches and roots'; mesh.receiveShadow = true; this.group.add(mesh);
      this.strokes.forEach(g => g.dispose());
    }
    // Do not retain unused construction geometry.
    const used = new Set([...this.batches.values()].map(b => b.kind));
    for (const [key, geo] of Object.entries(this.geometries)) if (!used.has(key)) geo.dispose();
  }
}

function sky(group, x0, x1, p) {
  const mat = new THREE.ShaderMaterial({ depthWrite: false, uniforms: {
    top: { value: color(p.skyTop) }, bottom: { value: color(p.skyBottom) },
  }, vertexShader: `varying vec2 uv0; void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec2 uv0; uniform vec3 top; uniform vec3 bottom;
    void main(){float f=smoothstep(.22,.87,uv0.y);vec3 c=mix(bottom,top,f);
    float paper=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
    gl_FragColor=vec4(c+(paper-.5)*.014,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }` });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 500, 220), mat);
  m.position.set((x0+x1)/2, 22, -110); m.renderOrder = -10; m.name = 'Painted sky'; group.add(m);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64), new THREE.MeshBasicMaterial({ color: 0xfff1bf, fog: false }));
  sun.position.set(x0 + 23, 29, -95); group.add(sun);
}

function ridge(group, x0, x1, z, y, tint, seed) {
  const rnd = seeded(seed), shape = new THREE.Shape(); shape.moveTo(x0, -35); shape.lineTo(x0, y);
  for (let x = x0; x < x1; x += 10) shape.bezierCurveTo(x + 3, y + rnd()*6, x + 7, y + rnd()*6, x + 10, y + rnd()*2);
  shape.lineTo(x1, -35); shape.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 10), new THREE.MeshBasicMaterial({ color: tint }));
  m.position.z = z; m.name = 'Distant wooded ridge'; group.add(m);
}

function broadleaf(art, x, y, z, h, p, rnd, distant = false) {
  const lean = (rnd()-.5)*h*.36, trunk = distant ? p.mid : p.bark;
  const flat = distant;
  art.line([[x,y,z],[x-h*.018,y+h*.3,z],[x+lean*.5,y+h*.65,z],[x+lean,y+h*.9,z]], h*.060, trunk, 12, .64);
  for (let side of [-1,1]) {
    const tipX=x+lean+side*h*(.20+rnd()*.18), tipY=y+h*(.65+rnd()*.21);
    art.line([[x+lean*.2,y+h*.46,z],[x+side*h*.12,y+h*.63,z-.05],[tipX,tipY,z]],h*.029,trunk,8,.75);
    if (!distant) {
      art.line([[x,y+.16,z],[x+side*h*.065,y+.07,z+.10],[x+side*h*.14,y-.05,z+.16]],h*.020,trunk);
      art.line([[x+side*.08,y+h*.13,z+h*.042],[x+side*.04,y+h*.42,z+h*.044],[x+lean*.5+side*.03,y+h*.64,z+h*.038]],h*.003,p.barkLight);
      // Loose ivy strands hang from a few branches, never across the play plane.
      if(side===1 && rnd()<.65) {
        const vy=y+h*.70, vx=x+side*h*.19;
        art.line([[vx,vy,z+.2],[vx-.12,vy-h*.12,z+.3],[vx+.10,vy-h*.22,z+.4]],.022,p.grass[0]);
        for(let k=0;k<9;k++) {
          const dir=k%2?1:-1;
          art.dot('leaf',[vx+dir*.12,vy-h*.22*k/9,z+.45],[.16,.085,.04],p.grass[1],{rotation:[0,0,dir*.55],wind:true});
        }
      }
    }
    for (let k=0;k<4;k++) {
      const cx=tipX+(rnd()-.5)*h*.28, cy=tipY+(rnd()-.2)*h*.15;
      art.dot('crown',[cx,cy,z+(rnd()-.5)*1.6],[h*.17,h*.13,h*.13],distant ? p.mid : p.leaf[k],{flat,wind:!distant});
    }
  }
  for (let k=0;k<6;k++) {
    const cx=x+lean+(rnd()-.5)*h*.45, cy=y+h*(.88+rnd()*.16);
    art.dot('crown',[cx,cy,z+(rnd()-.5)*2],[h*.20,h*.15,h*.14],distant ? p.mid : p.leaf[k%4],{flat,wind:!distant});
  }
  if (!distant) {
    // Small clusters across the crown give the silhouette fine, leafy edges.
    for (let k=0;k<44;k++) {
      const a=rnd()*Math.PI*2, r=h*(.16+rnd()*.20);
      const cx=x+lean+Math.cos(a)*r, cy=y+h*.91+Math.sin(a)*r*.5;
      art.dot('leaf',[cx,cy,z+1.0+rnd()*.3],[.19+rnd()*.16,.10+rnd()*.08,.10],p.leaf[2+k%2],{rotation:[0,0,a*.4],wind:true});
    }
  }
}

function fern(art, x, y, z, s, tint) {
  for (let frond=0;frond<5;frond++) {
    const a=(frond-2)*.53;
    const dx=Math.sin(a)*s*.8, dy=Math.cos(a)*s;
    art.line([[x,y,z],[x+dx*.3,y+dy*.65,z],[x+dx,y+dy,z]],.013*s,tint,5);
    for (let k=1;k<7;k++) {
      const t=k/7, bx=x+dx*t*t, by=y+dy*t, len=s*.21*(1-t*.8);
      for (const side of [-1,1]) art.dot('leaf',[bx+side*len*.6,by+len*.14,z+.025],[len,.045*s,.025*s],tint,{rotation:[0,0,side*.40+a*.35],wind:true});
    }
  }
}

function mushroom(art,x,y,z,s,tint) {
  art.dot('stem',[x,y+s*.33,z],[s*.075,s*.65,s*.075],0xede1bb);
  art.dot('cap',[x,y+s*.61,z],[s*.40,s*.25,s*.34],tint);
  for (let i=0;i<5;i++) {
    const a=i*2.4, r=s*.20;
    art.dot('pebble',[x+Math.cos(a)*r,y+s*.80,z+Math.sin(a)*r],[s*.035,s*.012,s*.035],0xffe8bf);
  }
}

function flowers(art,x,y,z,rnd) {
  const height=.20+rnd()*.26;
  art.dot('stem',[x,y+height/2,z],[.012,height,.012],0x637c43);
  const tint=[0xffdf91,0xf3dec7,0xeaa89c,0xb8ccec][Math.floor(rnd()*4)];
  for (let i=0;i<5;i++) {
    const a=i*Math.PI*2/5;
    art.dot('leaf',[x+Math.cos(a)*.065,y+height+Math.sin(a)*.065,z],[.056,.040,.022],tint,{rotation:[0,0,a],wind:true});
  }
  art.dot('pebble',[x,y+height,z+.025],[.028,.028,.025],0xe8b858);
}

function lightShafts(group,x0,x1,time) {
  const geo = new THREE.PlaneGeometry(1,1);
  const material = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending, uniforms:{time},
    vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 uv0;uniform float time;void main(){
      float edge=pow(max(0.,sin(uv0.x*3.14159)),2.);
      float ends=smoothstep(0.,.2,uv0.y)*(1.-smoothstep(.80,1.,uv0.y));
      gl_FragColor=vec4(.95,.87,.56,edge*ends*(.070+.014*sin(time*.35+uv0.y*4.)));}` });
  for (let x=x0+5;x<x1+20;x+=13) {
    const ray = new THREE.Mesh(geo,material); ray.position.set(x,10,-7);
    ray.scale.set(2.5,25,1); ray.rotation.z=-.35; ray.name='Sunlight through canopy'; group.add(ray);
  }
}

function driftingSeeds(group,x0,x1,time,rnd) {
  const count=Math.ceil((x1-x0)*3), positions=[], phases=[];
  for (let i=0;i<count;i++) { positions.push(x0+rnd()*(x1-x0),1+rnd()*15,-12+rnd()*15); phases.push(rnd()*6.28); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); g.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time},
    vertexShader:`uniform float time;attribute float phase;varying float glow;
      void main(){vec3 p=position;p.x+=sin(time*.25+phase)*.8;p.y+=sin(time*.4+phase)*.6;
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(55./-mv.z,1.5,5.);glow=.3+.5*pow(sin(time*.6+phase),2.);}`,
    fragmentShader:`varying float glow;void main(){float d=length(gl_PointCoord-.5)*2.;
      float a=(1.-smoothstep(.15,1.,d))*glow;if(a<.02)discard;gl_FragColor=vec4(1.,.93,.67,a);}`});
  const pts=new THREE.Points(g,m); pts.name='Floating pollen'; pts.frustumCulled=false; group.add(pts);
}

function woodlandStream(group, x, time) {
  // Decorative water is behind and below the playable platforms; the gap remains a pit.
  const water=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time},
    vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 uv0;uniform float time;void main(){
      float line=pow(.5+.5*sin(uv0.y*95.+sin(uv0.x*24.+time*.5)*2.-time*.6),18.);
      vec3 c=mix(vec3(.15,.39,.37),vec3(.57,.76,.64),uv0.y);
      c+=line*.16;float edge=smoothstep(0.,.12,uv0.x)*(1.-smoothstep(.88,1.,uv0.x));
      gl_FragColor=vec4(c,edge*.86);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const pool=new THREE.Mesh(new THREE.PlaneGeometry(22,4),water);pool.position.set(x,-1.15,-5.8);pool.name='Still woodland brook';group.add(pool);
  const falls=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time},
    vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 uv0;uniform float time;void main(){
      float thread=pow(.5+.5*sin(uv0.x*79.+sin(uv0.y*13.+time*2.)),3.);
      float edge=pow(max(0.,sin(uv0.x*3.14159)),.8);
      float foam=.5+.5*sin(uv0.y*43.+time*3.);
      gl_FragColor=vec4(.72,.9,.80,edge*(.13+thread*.20+foam*.05));}`});
  const fall=new THREE.Mesh(new THREE.PlaneGeometry(1.4,5.4),falls);fall.position.set(x+1,1.4,-6);fall.name='Silver waterfall';group.add(fall);
}

function butterflies(group,x0,x1,time,rnd) {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.14,.13,0,.21,.04,0,.13,-.085,0],3));
  g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
  const m=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,uniforms:{time},
    vertexShader:`uniform float time;varying float wing;void main(){
      vec3 p=position;float phase=instanceMatrix[3].x;
      p.z+=p.x*sin(time*9.+phase)*1.7;wing=position.x/.21;
      vec4 world=instanceMatrix*vec4(p,1.);world.x+=sin(time*.7+phase)*.5;world.y+=sin(time*1.1+phase)*.25;
      gl_Position=projectionMatrix*modelViewMatrix*world;}`,
    fragmentShader:`varying float wing;void main(){gl_FragColor=vec4(mix(vec3(.83,.54,.24),vec3(1.,.91,.61),wing),.85);}`});
  const n=Math.ceil((x1-x0)/9), mesh=new THREE.InstancedMesh(g,m,n*2), d=new THREE.Object3D();
  for(let i=0;i<n;i++) {
    const px=x0+rnd()*(x1-x0), py=3+rnd()*4;
    for(let side=0;side<2;side++) {
      d.position.set(px,py,-2.8);d.rotation.set(0,side?Math.PI:0,.25);d.updateMatrix();mesh.setMatrixAt(i*2+side,d.matrix);
    }
  }
  mesh.frustumCulled=false;mesh.name='Golden woodland butterflies';group.add(mesh);
}

/** Dress only exposed terrain tops; retain exact collision bounds and open pits. */
function dressTerrain(stage, art, p, rnd) {
  const blocks=stage.entities.filter(e=>e.name==='block' && e.body);
  for (const block of blocks) {
    const b=block.body;
    // Recolor existing surfaces. Replace each material with a stage-owned clone;
    // Block's shared material cache must not be modified for other stages.
    block.object.children.forEach((m,i)=>{ if(m.isMesh){ const old=m.material; m.material=old.clone(); m.material.color.set(i===1?p.moss:p.soil);
      if(i===0){
        if(b.bottom<.01){m.scale.y=7;m.position.y=-3;}
        m.material.onBeforeCompile=shader=>{
          shader.vertexShader='varying vec3 soilPosition;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nsoilPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
          shader.fragmentShader='varying vec3 soilPosition;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
            float n=sin(soilPosition.x*2.4+sin(soilPosition.y*3.))*sin(soilPosition.y*8.5+soilPosition.x*.6);
            float strata=sin(soilPosition.y*6.+sin(soilPosition.x*.8)*.3);
            diffuseColor.rgb*=.87+n*.055+strata*.035;
            diffuseColor.rgb*=mix(.48,1.,smoothstep(-5.,2.,soilPosition.y));`);
        };
        m.material.customProgramCacheKey=()=> 'storybook-earth-v1';
      }
    } });
    block.disposeObject=function(){this.object.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});};
    let exposed=false;
    for(let x=b.left+.15;x<b.right-.08;x+=.22+rnd()*.12) {
      const covered=blocks.some(o=>o!==block && Math.abs(o.body.bottom-b.top)<.05 && x>o.body.left && x<o.body.right);
      if(covered) continue;
      exposed=true;
      const yy=b.top+.07;
      // Rounded tufts soften the block edge, but extend below the true landing line.
      art.dot('pebble',[x,yy-.09,.58],[.24,.12,.17],p.moss);
      for(let k=0;k<3;k++) {
        const h=.12+rnd()*.18;
        art.dot('leaf',[x+(rnd()-.5)*.14,yy+h*.40,-.12-rnd()*.6],[.025,h,.025],p.grass[Math.floor(rnd()*3)],{rotation:[0,0,(rnd()-.5)*.65],wind:true});
      }
      if(rnd()<.16) flowers(art,x,yy,-.55,rnd);
      if(rnd()<.045) mushroom(art,x,yy,-.8,.35+rnd()*.25,0xbc8061);
      if(rnd()<.075) {
        const len=.25+rnd()*.45;
        art.line([[x,yy-.12,.64],[x+.07,yy-len*.6,.66],[x-.09,yy-len,.67]],.016,p.grass[0],5);
        for(let k=1;k<4;k++) art.dot('leaf',[x+(k%2?.07:-.05),yy-len*k/4,.68],[.055,.025,.018],p.moss,{rotation:[0,0,k%2?.6:-.6]});
      }
    }
    if(!exposed && block.object.children[1]) block.object.children[1].visible=false;
    // Ochre layers and small embedded stones articulate the soil wall.
    for(let x=b.left+.3;x<b.right-.2;x+=.65+rnd()*.8) {
      art.dot('pebble',[x,b.y+(rnd()-.5)*b.h*.6,.615],[.10+rnd()*.13,.05+rnd()*.07,.025],p.rock);
    }
  }
}

/** A little woodland shrine is a readable, non-interactive landmark behind the path. */
function shrine(art,x,y,z,p) {
  for(let side of [-1,1]) {
    for(let k=0;k<5;k++) art.dot('pebble',[x+side*.95,y+k*.42+.2,z],[.32,.27,.40],p.rock);
  }
  for(let k=0;k<9;k++) {
    const a=k*Math.PI/8;
    art.dot('pebble',[x+Math.cos(a)*.95,y+1.90+Math.sin(a)*.80,z],[.30,.26,.40],p.rock,{rotation:[0,0,a]});
    art.dot('crown',[x+Math.cos(a)*.97,y+2.09+Math.sin(a)*.82,z],[.27,.10,.40],p.moss);
  }
  art.dot('pebble',[x,y+.45,z],[.60,.42,.42],p.rock);
  mushroom(art,x-.45,y+.70,z+.1,.40,0xd79b6c);
}

export function storybookForest(stage, { x0=-15, x1=90, ground=2, mood='morning', seed=71 } = {}) {
  const group=new THREE.Group(); group.name=`Storybook forest • ${mood}`;
  const p=PALETTES[mood] || PALETTES.morning, rnd=seeded(seed), time={value:0};
  const art=new ForestPainter(group,time);
  sky(group,x0,x1,p);
  ridge(group,x0-140,x1+140,-83,2,p.far,seed);
  ridge(group,x0-100,x1+100,-57,-1,p.mid,seed+1);
  ridge(group,x0-70,x1+70,-22,ground-3,p.mid,seed+2);
  ridge(group,x0-45,x1+45,-8,ground-2,p.leaf[0],seed+3);
  // Faint slender trunks beyond the broadleaf forest.
  for(let x=x0-90;x<x1+90;x+=5+rnd()*5) {
    const h=20+rnd()*16;
    art.line([[x,-3,-49],[x+.6,h*.45,-49],[x-1,h,-49]],.25+rnd()*.25,p.far,5);
    art.line([[x+.4,h*.35,-49],[x-3,h*.55,-49],[x-5,h*.7,-49]],.15,p.far,4);
    for(let k=0;k<3;k++) art.dot('crown',[x+(k-1)*3,h-1+Math.sin(k)*2,-50],[5,4,2],p.far,{flat:true});
  }
  for(let x=x0-35;x<x1+35;x+=7+rnd()*5) broadleaf(art,x,ground-3,-29-rnd()*8,13+rnd()*9,p,rnd,true);
  for(let x=x0-15;x<x1+15;x+=9+rnd()*5) broadleaf(art,x,ground-1.3,-10-rnd()*7,10+rnd()*6,p,rnd);
  // Low shrubbery behind the walking plane separates warm ground from cool depth.
  for(let x=x0-20;x<x1+20;x+=1.4+rnd()) {
    const h=.5+rnd()*1.6;
    art.dot('crown',[x,ground-.1,-4-rnd()*4],[1.4,h,.9],p.leaf[Math.floor(rnd()*3)]);
    if(rnd()<.4) fern(art,x,ground-.25,-2.5,.8+rnd()*.5,p.grass[1]);
    if(rnd()<.4) mushroom(art,x,ground-.1,-3,.6+rnd()*.65,rnd()<.5?0xc9906d:0xc7b27b);
  }
  shrine(art,x0+26,ground,-5,p);
  shrine(art,x1-17,ground,-6,p);
  // Sparse foreground ferns stay below the playable landing line.
  for(let x=x0;x<x1;x+=4+rnd()*4) {
    fern(art,x,-.3,3.5,.8+rnd()*.9,p.grass[0]);
    art.dot('crown',[x,-.6,3.0],[1.4,.65,.8],p.leaf[0]);
  }
  dressTerrain(stage,art,p,rnd);
  art.finish(); lightShafts(group,x0,x1,time); driftingSeeds(group,x0,x1,time,rnd); butterflies(group,x0,x1,time,rnd);
  if(mood==='glade') woodlandStream(group,11,time);
  group.userData.theme=mood; group.userData.seed=seed;
  group.update=t=>{time.value=t;};
  return group;
}
