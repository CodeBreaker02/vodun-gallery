import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
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

vec2 warp(vec2 pos, vec2 center, float strength) {
    vec2 dir = pos - center;
    float dist = length(dir);
    float force = min(1.0, 1.0 / (dist * 3.0));
    force = pow(force, 2.0);
    return pos + normalize(dir) * force * strength;
}

float luminance(vec4 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
}

void main() {
    vec2 uv = v_uv;
    vec2 mouse = u_mouse * 0.5 + 0.5;
    float time = u_time * 0.5;

    // Create magnetic distortion
    vec2 distortedUv = uv;
    float distortionStrength = u_progressHover * 0.3;
    distortedUv = warp(distortedUv, mouse, distortionStrength);

    // Create flowing movement
    vec2 flow = vec2(
        sin(uv.y * 4.0 + time) * 0.005,
        cos(uv.x * 4.0 + time) * 0.005
    ) * u_progressHover;
    
    distortedUv += flow;

    // Sample textures with color aberration
    float aberrationStrength = u_progressHover * 0.02;
    vec4 imageR = texture2D(u_map, distortedUv + vec2(aberrationStrength, 0.0));
    vec4 imageG = texture2D(u_map, distortedUv);
    vec4 imageB = texture2D(u_map, distortedUv - vec2(aberrationStrength, 0.0));
    
    vec4 hoverImageR = texture2D(u_hovermap, distortedUv + vec2(aberrationStrength, 0.0));
    vec4 hoverImageG = texture2D(u_hovermap, distortedUv);
    vec4 hoverImageB = texture2D(u_hovermap, distortedUv - vec2(aberrationStrength, 0.0));

    // Mix based on hover progress
    vec4 baseImage = vec4(imageR.r, imageG.g, imageB.b, imageG.a);
    vec4 hoverImage = vec4(hoverImageR.r, hoverImageG.g, hoverImageB.b, hoverImageG.a);

    // Create magnetic glow
    float distToMouse = length(uv - mouse);
    float glow = smoothstep(0.5, 0.0, distToMouse) * u_progressHover * 0.5;

    // Mix images with smooth transition
    float mixProgress = smoothstep(0.0, 1.0, u_progressHover);
    vec4 finalImage = mix(baseImage, hoverImage, mixProgress);

    // Add glow effect
    finalImage.rgb += vec3(glow * 0.5);

    // Add subtle vignette
    vec2 vignetteUv = uv * (1.0 - uv.yx);
    float vignette = vignetteUv.x * vignetteUv.y * 15.0;
    vignette = pow(vignette, u_progressHover * 0.5);
    finalImage.rgb *= vignette;

    gl_FragColor = vec4(finalImage.rgb, u_alpha);
}`;

interface MagneticEffectProps {
    mainImageUrl: string;
    hoverImageUrl: string;
}

export default function MagneticEffect({ mainImageUrl, hoverImageUrl }: MagneticEffectProps) {
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