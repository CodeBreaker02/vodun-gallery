// ShapeHoverEffect.tsx
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
uniform sampler2D u_shape;
uniform float u_time;
uniform float u_alpha;
uniform vec2 u_res;
uniform vec2 u_ratio;
uniform vec2 u_mouse;
uniform float u_progressHover;
uniform float u_progressClick;
varying vec2 v_uv;

void main() {
    vec2 resolution = u_res;
    vec2 uv = v_uv;
    vec2 uv_h = v_uv;
    float time = u_time * 0.05;
    float progress = u_progressClick;
    float progressHover = u_progressHover;
    
    // Calculate normalized screen coordinates
    vec2 st = gl_FragCoord.xy / resolution.xy - vec2(0.5);
    st.y *= resolution.y / resolution.x;
    
    // Enhanced mouse-based offset for shape texture
    vec2 mouse = u_mouse * vec2(1.0, resolution.y/resolution.x);
    
    // Calculate shape UV for masking with enhanced scaling
    vec2 shapeUv = v_uv - vec2(0.5);
    shapeUv = shapeUv / (1.0 + progressHover * 0.3); // Increased scale effect
    shapeUv -= mouse * 0.25; // Increased mouse influence
    shapeUv += vec2(0.5);
    
    // Apply ratio correction
    uv -= vec2(0.5);
    uv *= u_ratio;
    uv += vec2(0.5);
    
    uv_h -= vec2(0.5);
    uv_h *= u_ratio;
    uv_h += vec2(0.5);
    
    // Sample textures with enhanced distortion
    vec4 image = texture2D(u_map, uv + mouse * 0.07 * progressHover);
    vec4 hover = texture2D(u_hovermap, uv_h + mouse * 0.12 * progressHover);
    
    // Sample shape texture for mask with enhanced contrast
    vec4 shapeMask = texture2D(u_shape, shapeUv);
    
    // Enhanced mask value calculation
    float maskValue = shapeMask.r * progressHover;
    maskValue = pow(maskValue, 1.5); // Add more contrast to the mask
    
    // Smoother transition with custom curve
    float smoothMask = smoothstep(0.2, 0.7, maskValue);
    smoothMask = pow(smoothMask, 1.2); // Make the transition more dramatic
    
    // Create a darker version of the hover image
    vec4 darkHover = hover; // Darken the hover state
    darkHover.rgb *= (1.0 - progressHover * 0.2); // Progressive darkening
    
    // Add vignette effect to the hover state
    vec2 vignetteUV = v_uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(vignetteUV, vignetteUV) * 0.3 * progressHover;
    darkHover.rgb *= vignette;
    
    // Enhanced mixing with darker transition
    vec4 finalImage = mix(image, darkHover, smoothMask);
    
    // Add slight color tinting to enhance depth
    finalImage.rgb *= 1.0 - (smoothMask * 0.15);
    
    gl_FragColor = vec4(finalImage.rgb, u_alpha);
}`;

interface ShapeHoverEffectProps {
    mainImageUrl: string;
    hoverImageUrl: string;
    shapeImageUrl: string;
}

export default function ShapeHoverEffect({ mainImageUrl, hoverImageUrl, shapeImageUrl }: ShapeHoverEffectProps) {
    const mesh = useRef<THREE.Mesh>(null);
    const { viewport, size } = useThree();
    const [mainTexture, hoverTexture, shapeTexture] = useTexture([mainImageUrl, hoverImageUrl, shapeImageUrl]);

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
            setupTexture(shapeTexture);

            setImageRatio(mainTexture.image.width / mainTexture.image.height);
        }
    }, [mainTexture, hoverTexture, shapeTexture]);

    const uniforms = useRef({
        u_map: { value: mainTexture },
        u_hovermap: { value: hoverTexture },
        u_shape: { value: shapeTexture },
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

        // Smooth mouse movement
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