import { useRef, useState, useEffect } from 'react';
import {ThreeEvent, useFrame, useThree} from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const vertexShader = `
varying vec2 v_uv;
varying vec3 v_position;

void main() {
    v_uv = uv;
    v_position = position;
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
uniform float u_progressClick;

varying vec2 v_uv;
varying vec3 v_position;

#define PI 3.14159265359

float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float n = i.x + i.y * 157.0 + 113.0 * i.z;
    return mix(
        mix(
            mix(rand(vec2(n, n)), rand(vec2(n + 1.0, n)), f.x),
            mix(rand(vec2(n + 157.0, n)), rand(vec2(n + 157.0 + 1.0, n)), f.x),
            f.y),
        mix(
            mix(rand(vec2(n + 113.0, n)), rand(vec2(n + 113.0 + 1.0, n)), f.x),
            mix(rand(vec2(n + 113.0 + 157.0, n)), rand(vec2(n + 113.0 + 157.0 + 1.0, n)), f.x),
            f.y),
        f.z);
}

float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    // Add octaves of noise
    for(int i = 0; i < 6; i++) {
        sum += noise(p * freq) * amp;
        amp *= 0.5;
        freq *= 2.0;
    }
    return sum;
}

vec3 explosionEffect(vec2 uv, float progress) {
    // Create center point for explosion
    vec2 center = vec2(0.5, 0.5) + u_mouse * 0.1;
    float dist = length(uv - center);
    
    // Time-based animation
    float t = u_time * 2.0;
    
    // Create 3D position for noise
    vec3 p = vec3(uv * 2.0 - 1.0, t * 0.1);
    
    // Generate fractal noise
    float noise = fbm(p * 3.0 + vec3(0.0, 0.0, t));
    
    // Create explosion shape
    float explosion = smoothstep(0.8, 0.0, dist) * progress;
    explosion *= noise * 2.0;
    
    // Color gradient for explosion
    vec3 fireColor1 = vec3(1.0, 0.5, 0.1); // Orange
    vec3 fireColor2 = vec3(1.0, 0.2, 0.05); // Red
    vec3 smokeColor = vec3(0.2, 0.2, 0.2); // Dark grey
    
    // Mix colors based on noise and distance
    vec3 color = mix(fireColor1, fireColor2, noise);
    color = mix(color, smokeColor, smoothstep(0.3, 1.0, dist));
    
    // Add glow
    float glow = exp(-dist * 4.0) * progress;
    color += vec3(1.0, 0.7, 0.3) * glow;
    
    return color * explosion;
}

void main() {
    vec2 uv = v_uv;
    
    // Apply ratio correction
    uv -= vec2(0.5);
    uv *= u_ratio;
    uv += vec2(0.5);
    
    // Sample original textures
    vec4 image = texture2D(u_map, uv);
    vec4 hoverImage = texture2D(u_hovermap, uv);
    
    // Generate explosion effect
    vec3 explosion = explosionEffect(v_uv, u_progressHover);
    
    // Mix original image with explosion
    vec3 finalColor = mix(image.rgb, hoverImage.rgb, u_progressHover * 0.5);
    finalColor += explosion;
    
    // Add brightness and contrast adjustments
    finalColor *= 1.2; // Brightness
    finalColor = pow(finalColor, vec3(0.95)); // Contrast
    
    gl_FragColor = vec4(finalColor, u_alpha);
}`;

interface ExplosionEffectProps {
    mainImageUrl: string;
    hoverImageUrl: string;
}

export default function ExplosionEffect({ mainImageUrl, hoverImageUrl }: ExplosionEffectProps) {
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
        u_progressClick: { value: 0 },
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