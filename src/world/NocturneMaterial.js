import * as THREE from 'three';

// Broad painted values, turquoise grazing light, and world-space grain across tile seams.
// Shared per Blender material; no screenshots or borrowed textures enter the game.
export function nocturneMaterial(source) {
  const glow = /Woodland_glow/.test(source.name);
  const edge = /Woodland_rim/.test(source.name);
  const soil = /Woodland_earth/.test(source.name);
  const foliage = /Woodland_leaf/.test(source.name);
  const material = new THREE.ShaderMaterial({
    name: source.name + ' · nocturne', fog: true, side: THREE.DoubleSide,
    uniforms: {
      ...THREE.UniformsLib.fog,
      base: {value: source.color.clone()},
      luminous: {value: glow ? 1 : edge ? .22 : 0},
      rimStrength: {value: foliage ? .001 : soil ? .003 : .014},
      flatShade: {value: foliage ? 1 : 0},
    },
    vertexShader: `
      varying vec3 worldPosition; varying vec3 worldNormal; varying vec3 viewDirection;
      #include <fog_pars_vertex>
      void main(){
        vec4 p=vec4(position,1.); vec3 n=normal;
        #ifdef USE_INSTANCING
          p=instanceMatrix*p; n=mat3(instanceMatrix)*n;
        #endif
        vec4 world=modelMatrix*p;
        worldPosition=world.xyz; worldNormal=normalize(mat3(modelMatrix)*n);
        viewDirection=cameraPosition-world.xyz;
        vec4 mvPosition=viewMatrix*world;
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 base; uniform float luminous; uniform float rimStrength; uniform float flatShade;
      varying vec3 worldPosition; varying vec3 worldNormal; varying vec3 viewDirection;
      #include <fog_pars_fragment>
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){
        vec3 n=normalize(worldNormal);float light=dot(n,normalize(vec3(-.45,.8,.5)));
        float painted=smoothstep(-.15,.75,light);
        float grain=noise(worldPosition*vec3(1.4,3.1,1.8))*.6+noise(worldPosition*13.)*.4;
        vec3 c=base*mix(.30+painted*.40,.55,flatShade)*( .86+grain*.22 );
        float rim=pow(1.-abs(dot(n,normalize(viewDirection))),3.);
        c+=vec3(.12,.8,.68)*rim*rimStrength*smoothstep(-.3,.7,light);
        c=mix(c,base*(luminous>0.5?2.7:1.1),min(1.,luminous*4.));
        gl_FragColor=vec4(c,1.);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return material;
}
