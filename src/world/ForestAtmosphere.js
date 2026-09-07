import * as THREE from 'three';
import { seeded } from '../entities/Decor.js';
const color=x=>new THREE.Color(x);
export const FOREST_ENV = {
  morning: { sky: 0x031324, fogColor: 0x07414d, fog: { near: 36, far: 155 },
    hemi: { sky: 0x6ca5b7, ground: 0x071326, intensity: 1.15 },
    sun: { color: 0x8bf3cf, intensity: 1.65, offset: [-10, 20, 4] } },
  glade: { sky: 0x020b1c, fogColor: 0x07303e, fog: { near: 30, far: 145 },
    hemi: { sky: 0x59889f, ground: 0x060e22, intensity: 1.05 },
    sun: { color: 0x71dfc6, intensity: 1.6, offset: [-8, 20, 3] } },
};

function sky(group,x0,x1,p) {
  const mat=new THREE.ShaderMaterial({depthWrite:false,fog:false,uniforms:{
    top:{value:color(p.skyTop)},bottom:{value:color(p.skyBottom)},center:{value:(x0+x1)*.5},
  },vertexShader:`varying vec2 world;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xy;gl_Position=projectionMatrix*viewMatrix*p;}`,
  fragmentShader:`varying vec2 world;uniform vec3 top;uniform vec3 bottom;uniform float center;
    void main(){float h=smoothstep(-12.,55.,world.y);vec3 c=mix(bottom,top,h);
      vec2 d=(world-vec2(center,9.))/vec2(65.,35.);c+=vec3(.002,.028,.022)*exp(-dot(d,d)*2.);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0+650,260),mat);
  m.position.set((x0+x1)/2,25,-130);m.renderOrder=-10;m.name='Painted sky';group.add(m);
}

function mist(group,width,time) {
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,uniforms:{time},
    vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 uv0;uniform float time;
      void main(){float ribbons=.5+.5*sin(uv0.x*19.+sin(uv0.x*41.+time*.04)+uv0.y*8.+time*.06);
        float edge=pow(max(0.,sin(uv0.y*3.14159)),2.);
        float ends=smoothstep(0.,.1,uv0.x)*(1.-smoothstep(.9,1.,uv0.x));
        gl_FragColor=vec4(.015,.16,.17,edge*ends*(.10+ribbons*.12));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  for(const [y,z,h] of [[5,-48,18],[0,-16,8],[-4,2,6]]){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(width+180,h),material);m.position.set(width/2,y,z);m.name='Slow valley mist';group.add(m);
  }
}

function lightShafts(group,x0,x1,time) {
  const geo = new THREE.PlaneGeometry(1,1);
  const material = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending, uniforms:{time},
    vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 uv0;uniform float time;void main(){
      float edge=pow(max(0.,sin(uv0.x*3.14159)),2.);
      float ends=smoothstep(0.,.2,uv0.y)*(1.-smoothstep(.80,1.,uv0.y));
      gl_FragColor=vec4(.09,.52,.46,edge*ends*(.025+.006*sin(time*.35+uv0.y*4.)));}` });
  for (let x=x0+5;x<x1+20;x+=28) {
    const ray = new THREE.Mesh(geo,material); ray.position.set(x,14,-18);
    ray.scale.set(5.5,40,1); ray.rotation.z=-.35; ray.name='Sunlight through canopy'; group.add(ray);
  }
}

function driftingSeeds(group,x0,x1,time,rnd) {
  const count=Math.ceil((x1-x0)*.9), positions=[], phases=[];
  for (let i=0;i<count;i++) { positions.push(x0+rnd()*(x1-x0),1+rnd()*15,-12+rnd()*15); phases.push(rnd()*6.28); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); g.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time},
    vertexShader:`uniform float time;attribute float phase;varying float glow;
      void main(){vec3 p=position;p.x+=sin(time*.25+phase)*.8;p.y+=sin(time*.4+phase)*.6;
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(38./-mv.z,1.,3.);glow=.3+.5*pow(sin(time*.6+phase),2.);}`,
    fragmentShader:`varying float glow;void main(){float d=length(gl_PointCoord-.5)*2.;
      float a=(1.-smoothstep(.15,1.,d))*glow;if(a<.02)discard;gl_FragColor=vec4(.47,.90,.65,a*.65);}`});
  const pts=new THREE.Points(g,m); pts.name='Floating pollen'; pts.frustumCulled=false; group.add(pts);
}

function woodlandStream(group, x, time) {
  // Decorative water is behind and below the playable platforms; the gap remains a pit.
  const water=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time},
    vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 uv0;uniform float time;void main(){
      float line=pow(.5+.5*sin(uv0.y*95.+sin(uv0.x*24.+time*.5)*2.-time*.6),18.);
      vec3 c=mix(vec3(.004,.025,.06),vec3(.018,.18,.19),uv0.y);
      c+=line*.05;float edge=smoothstep(0.,.12,uv0.x)*(1.-smoothstep(.88,1.,uv0.x));
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
      gl_FragColor=vec4(.05,.36,.33,edge*(.10+thread*.12+foam*.03));}`});
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
    fragmentShader:`varying float wing;void main(){gl_FragColor=vec4(mix(vec3(.06,.22,.25),vec3(.24,.62,.48),wing),.85);}`});
  const n=Math.ceil((x1-x0)/28), mesh=new THREE.InstancedMesh(g,m,n*2), d=new THREE.Object3D();
  for(let i=0;i<n;i++) {
    const px=x0+rnd()*(x1-x0), py=3+rnd()*4;
    for(let side=0;side<2;side++) {
      d.position.set(px,py,-2.8);d.rotation.set(0,side?Math.PI:0,.25);d.updateMatrix();mesh.setMatrixAt(i*2+side,d.matrix);
    }
  }
  mesh.frustumCulled=false;mesh.name='Golden woodland butterflies';group.add(mesh);
}


export function woodlandAtmosphere({width,mood,seed}) {
 const group=new THREE.Group(),time={value:0};group.name='Woodland light and atmosphere';
 const p=mood==='glade'?{skyTop:0x020a23,skyBottom:0x075460}:{skyTop:0x03132e,skyBottom:0x096267};
 sky(group,-20,width+20,p);lightShafts(group,-20,width+20,time);driftingSeeds(group,-20,width+20,time,seeded(seed));butterflies(group,-10,width+10,time,seeded(seed+1));
 mist(group,width,time);
 if(mood==='glade')woodlandStream(group,11,time);
 group.update=t=>{time.value=t;};return group;
}
