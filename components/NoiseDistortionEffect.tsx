// NoiseEffect.tsx
import { useRef, useState, useEffect } from 'react';
import {ThreeEvent, useFrame, useThree} from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const vertexShader = `
varying vec2 v_uv;

void main() {
    v_uv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `
uniform sampler2D u_map;
uniform sampler2D u_hovermap;
uniform float u_time;
uniform float u_alpha;
uniform vec2 u_res;
uniform vec2 u_ratio;
uniform vec2 u_mouse;
uniform float u_progressHover;

varying vec2 v_uv;

// Simplex 3D Noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
        + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
        dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

void main() {
    vec2 uv = v_uv;
    vec2 mouse = u_mouse * 0.5;
    float time = u_time * 0.5;
    
    // Create multiple layers of noise
    float noise1 = snoise(uv * 3.0 + time) * 0.5 + 0.5;
    float noise2 = snoise(uv * 6.0 - time * 0.5) * 0.5 + 0.5;
    float noise3 = snoise(uv * 12.0 + time * 0.2) * 0.5 + 0.5;
    
    // Combine noise layers
    float finalNoise = mix(noise1, noise2, 0.5) * 0.8 + noise3 * 0.2;
    
    // Create mouse interaction
    float distToMouse = length(uv - (mouse + 0.5));
    float mouseInfluence = smoothstep(0.5, 0.0, distToMouse) * u_progressHover;
    
    // Sample textures
    vec2 distortedUV = uv + vec2(
        sin(uv.y * 10.0 + time) * 0.02,
        cos(uv.x * 10.0 + time) * 0.02
    ) * mouseInfluence;
    
    vec4 image = texture2D(u_map, distortedUV);
    vec4 hoverImage = texture2D(u_hovermap, distortedUV);
    
    // Create color separation based on noise
    vec4 finalImage = mix(image, hoverImage, u_progressHover);
    vec3 colorShift = vec3(
        finalNoise * 0.1 * u_progressHover,
        finalNoise * 0.05 * u_progressHover,
        finalNoise * 0.15 * u_progressHover
    );
    
    // Apply color shift and noise
    finalImage.r += colorShift.r;
    finalImage.g += colorShift.g;
    finalImage.b += colorShift.b;
    
    // Add noise grain
    float grain = snoise(uv * 1000.0 + time * 10.0) * 0.1 * u_progressHover;
    finalImage.rgb += grain;
    
    gl_FragColor = vec4(finalImage.rgb, u_alpha);
}`;

interface NoiseEffectProps {
    mainImageUrl: string;
    hoverImageUrl: string;
}

export default function NoiseEffect({ mainImageUrl, hoverImageUrl }: NoiseEffectProps) {
    const mesh = useRef<THREE.Mesh>(null);
    const { viewport, size } = useThree();
    const [mainTexture, hoverTexture] = useTexture([mainImageUrl, hoverImageUrl]);

    const [hovered, setHovered] = useState(false);
    const [imageRatio, setImageRatio] = useState(1);
    const hoverProgress = useRef(0);
    const mouse = useRef(new THREE.Vector2(0, 0));

    const calculateDimensions = () => {
        const containerRatio = viewport.width / viewport.height;
        const width = imageRatio > containerRatio
            ? viewport.width
            : viewport.height * imageRatio;
        const height = imageRatio > containerRatio
            ? viewport.width / imageRatio
            : viewport.height;
        return { width, height };
    };

    useEffect(() => {
        if (mainTexture) {
            const setupTexture = (texture: THREE.Texture) => {
                texture.needsUpdate = true;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = false;
            };

            setupTexture(mainTexture);
            setupTexture(hoverTexture);

            setImageRatio(mainTexture.image.width / mainTexture.image.height);
        }
    }, [mainTexture, hoverTexture]);

    const uniforms = useRef({
        u_map: { value: mainTexture },
        u_hovermap: { value: hoverTexture },
        u_time: { value: 0 },
        u_progressHover: { value: 0 },
        u_alpha: { value: 1.0 },
        u_mouse: { value: new THREE.Vector2(0, 0) },
        u_res: { value: new THREE.Vector2(size.width, size.height) },
        u_ratio: { value: new THREE.Vector2(1, 1) }
    });

    useFrame((_, delta) => {
        if (!mesh.current) return;

        const targetHover = hovered ? 1 : 0;
        hoverProgress.current += (targetHover - hoverProgress.current) * 0.1;

        const material = mesh.current.material as THREE.ShaderMaterial;
        material.uniforms.u_time.value += delta;
        material.uniforms.u_progressHover.value = hoverProgress.current;
        material.uniforms.u_mouse.value.lerp(mouse.current, 0.1);

        const dims = calculateDimensions();
        material.uniforms.u_ratio.value.set(dims.width / viewport.width, dims.height / viewport.height);
    });

    const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
        if (event.uv) {
            const x = (event.uv.x - 0.5) * 2;
            const y = (event.uv.y - 0.5) * 2;
            mouse.current.set(x, y);
        }
    };

    const dims = calculateDimensions();

    return (
        <mesh
            ref={mesh}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onPointerMove={handlePointerMove}
        >
            <planeGeometry args={[dims.width, dims.height, 32, 32]} />
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms.current}
                transparent={true}
            />
        </mesh>
    );
}