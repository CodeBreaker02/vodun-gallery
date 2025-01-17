const noiseFunction = `
//
// Description : Array and textureless GLSL 2D/3D/4D simplex 
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : ijm
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
// 

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise3(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  // Permutations
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}
`;

export const vertex = `
${noiseFunction}

varying vec2 vUv;
uniform float uTime;
uniform float uAmplitude;
uniform float uWaveLength;
uniform float uNoiseScale;
uniform float uTimeScale;
uniform float uHoverProgress;
uniform vec2 uMouse;

void main() {
    vUv = uv;
    vec3 newPosition = position;
    
    // Calculate distance from mouse position for ripple effect
    vec2 mouseDistance = position.xy - uMouse;
    float distanceFromMouse = length(mouseDistance);
    
    // Add noise to the wave
    float noise = snoise3(vec3(
        position.x * uNoiseScale, 
        position.y * uNoiseScale, 
        uTime * uTimeScale
    )) * 0.5;
    
    // Combine base wave with mouse-based ripple
    float wave = uAmplitude * (
        sin(position.x * uWaveLength + uTime + noise) * 0.5 +
        sin(distanceFromMouse * 10.0 - uTime * 2.0) * 0.5
    );
    
    // Add vertical displacement based on noise
    float verticalNoise = snoise3(vec3(
        position.x * uNoiseScale * 1.5, 
        position.y * uNoiseScale * 1.5, 
        uTime * uTimeScale * 0.5
    )) * 0.3;
    
    newPosition.z = (wave + verticalNoise * uAmplitude) * uHoverProgress;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

export const fragment = `
uniform sampler2D uTexture;
uniform float uHoverProgress;
varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    
    // Add progressive UV distortion on hover
    float distortionAmount = 0.02 * uHoverProgress;
    uv.x += sin(uv.y * 10.0) * distortionAmount;
    uv.y += cos(uv.x * 10.0) * distortionAmount;
    
    vec4 color = texture2D(uTexture, uv);
    
    // Add progressive vignette effect
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center);
    float vignette = smoothstep(0.5, 0.2, dist);
    
    color.rgb = mix(color.rgb, color.rgb * vignette, uHoverProgress * 0.5);
    
    gl_FragColor = color;
}`