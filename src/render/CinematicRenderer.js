import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class CinematicRenderer {
  constructor(renderer,scene,camera) {
    this.renderer=renderer;
    const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
    this.composer=new EffectComposer(renderer,target);
    this.composer.addPass(new RenderPass(scene,camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.48,.65,.82);
    this.composer.addPass(this.bloom);
    this.grade=new ShaderPass({
      uniforms:{tDiffuse:{value:null}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;
        void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;
          vec2 p=(vUv-.5)*vec2(1.,.85);float vignette=1.-smoothstep(.18,.69,length(p))*.29;
          float paper=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
          c*=vignette; c+=paper*.0025;
          gl_FragColor=vec4(max(c,vec3(0.)),1.);}`,
    });
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    // Count the whole scene + post pipeline, not just the final fullscreen triangle.
    renderer.info.autoReset=false;
  }
  resize(w,h){this.composer.setSize(w,h);}
  render(){this.renderer.info.reset();this.composer.render(0);}
  dispose(){for(const pass of this.composer.passes)pass.dispose?.();this.composer.dispose();}
}
