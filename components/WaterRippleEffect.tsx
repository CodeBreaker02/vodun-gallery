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

// Improved ripple function with more natural falloff
vec2 ripple(vec2 pos, vec2 center, float time, float frequency, float amplitude, float decay) {
    vec2 dir = pos - center;
    float dist = length(dir);
    
    // Multiple wave frequencies for more complex pattern
    float wave1 = sin(dist * frequency - time) * amplitude;
    float wave2 = sin(dist * (frequency * 1.5) - time * 0.8) * (amplitude * 0.3);
    
    // Combined waves with natural falloff
    float wave = (wave1 + wave2) * exp(-dist * decay);
    
    // Add subtle rotation to the ripples
    float angle = time * 0.2;
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    return rot * normalize(dir) * wave;
}

// Function to create caustics-like effect
float caustics(vec2 uv, float time) {
    float caustic = 0.0;
    for(float i = 0.0; i < 3.0; i++) {
        vec2 offset = vec2(
            cos(time * (0.5 + i * 0.2)) * 0.3,
            sin(time * (0.3 + i * 0.2)) * 0.3
        );
        float angle = time * (0.2 + i * 0.1);
        vec2 rotatedUV = uv - 0.5;
        rotatedUV = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * rotatedUV;
        rotatedUV += 0.5 + offset;
        
        caustic += pow(0.5 + 0.5 * sin(rotatedUV.x * 20.0) * sin(rotatedUV.y * 20.0), 3.0);
    }
    return caustic / 3.0;
}

void main() {
    vec2 uv = v_uv;
    vec2 mouse = u_mouse * 0.5 + 0.5;
    float time = u_time * 1.5; // Adjusted speed
    
    // Combined displacement
    vec2 offset = vec2(0.0);
    
    // Enhanced mouse ripple
    offset += ripple(uv, mouse, time, 25.0, 0.04, 2.5) * u_progressHover;
    
    // Dynamic ambient ripples
    vec2 center1 = vec2(0.3 + sin(time * 0.4) * 0.15, 0.4 + cos(time * 0.3) * 0.15);
    vec2 center2 = vec2(0.7 + cos(time * 0.3) * 0.15, 0.6 + sin(time * 0.5) * 0.15);
    vec2 center3 = vec2(0.5 + sin(time * 0.6) * 0.1, 0.5 + cos(time * 0.4) * 0.1);
    
    offset += ripple(uv, center1, time, 20.0, 0.015, 3.0) * u_progressHover;
    offset += ripple(uv, center2, time * 1.1, 22.0, 0.012, 3.0) * u_progressHover;
    offset += ripple(uv, center3, time * 0.9, 18.0, 0.018, 3.0) * u_progressHover;
    
    // Add subtle circular wave pattern
    float radius = length(uv - vec2(0.5));
    offset += normalize(uv - vec2(0.5)) * sin(radius * 20.0 - time) * 0.002 * u_progressHover;
    
    // Sample textures with enhanced distortion
    vec2 distortedUV = uv + offset;
    distortedUV = mix(uv, distortedUV, smoothstep(0.0, 1.0, u_progressHover));
    distortedUV = clamp(distortedUV, 0.0, 1.0);
    
    vec4 image = texture2D(u_map, distortedUV);
    vec4 hoverImage = texture2D(u_hovermap, distortedUV);
    
    // Enhanced water highlights
    float fresnel = pow(1.0 - max(0.0, dot(normalize(vec3(offset, 0.2)), normalize(vec3(0.0, 0.0, 1.0)))), 3.0);
    vec3 waterHighlight = vec3(0.95, 0.98, 1.0) * fresnel * u_progressHover * 0.5;
    
    // Add caustics effect
    float causticEffect = caustics(distortedUV, time) * u_progressHover * 0.15;
    vec3 causticColor = vec3(0.95, 0.98, 1.0) * causticEffect;
    
    // Combine everything with enhanced blending
    vec4 finalImage = mix(image, hoverImage, u_progressHover * 0.6);
    finalImage.rgb += waterHighlight;
    finalImage.rgb += causticColor;
    finalImage.rgb *= 1.0 + u_progressHover * 0.1; // Slight brightness boost when active
    
    gl_FragColor = vec4(finalImage.rgb, u_alpha);
}`;

interface WaterRippleEffectProps {
    mainImageUrl: string;
    hoverImageUrl: string;
}

export default function WaterRippleEffect({ mainImageUrl, hoverImageUrl }: WaterRippleEffectProps) {
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