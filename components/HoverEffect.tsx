import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';

const vertexShader = `
varying vec2 v_uv;

void main() {
    v_uv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = `
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
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    // Gradients: 7x7 points over a square, mapped onto an octahedron.
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

uniform sampler2D u_map;
uniform sampler2D u_hovermap;
uniform float u_alpha;
uniform float u_time;
uniform float u_progressHover;
uniform float u_progressClick;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform vec2 u_ratio;
uniform vec2 u_hoverratio;

varying vec2 v_uv;

float circle(in vec2 _st, in float _radius, in float blurriness) {
    vec2 dist = _st - vec2(0.5);
    return 1.0 - smoothstep(_radius-(_radius*blurriness), _radius+(_radius*blurriness), dot(dist,dist)*4.0);
}

void main() {
    vec2 resolution = u_res;
    float time = u_time * 0.05;
    float progress = u_progressClick;
    float progressHover = u_progressHover;
    vec2 uv = v_uv;
    vec2 uv_h = v_uv;

    vec2 st = gl_FragCoord.xy / resolution.xy - vec2(.5);
    st.y *= resolution.y / resolution.x;

    vec2 mouse = vec2((u_mouse.x / u_res.x) * 2.0 - 1.0, -(u_mouse.y / u_res.y) * 2.0 + 1.0) * -.5;
    mouse.y *= resolution.y / resolution.x;

    float offX = uv.x * .3 - time * 0.3;
    float offY = uv.y + sin(uv.x * 5.0) * .1 - sin(time * 0.5) + snoise3(vec3(uv.x, uv.y, time) * 0.5);

    offX += snoise3(vec3(offX, offY, time) * 5.0) * .3;
    offY += snoise3(vec3(offX, offX, time * 0.3)) * .1;

    float nc = (snoise3(vec3(offX, offY, time * .5) * 8.)) * progressHover;
    float nh = (snoise3(vec3(offX, offY, time * .5) * 2.)) * .03;
    nh *= smoothstep(nh, 0.5, 0.6);

    uv_h -= vec2(0.5);
    uv_h *= u_hoverratio;
    uv_h += vec2(0.5);

    uv -= vec2(0.5);
    uv *= u_ratio;
    uv += vec2(0.5);

    vec4 image = texture2D(u_map, uv_h + vec2(nc + nh) * progressHover);
    vec4 hover = texture2D(u_hovermap, uv + vec2(nc + nh) * progressHover * (1.0 - progress));
    vec4 finalImage = mix(image, hover, clamp(nh * (1.0 - progress) + progressHover, 0.0, 1.0));

    gl_FragColor = vec4(finalImage.rgb, u_alpha);
}`;

interface HoverEffectProps {
    mainImageUrl: string;
    hoverImageUrl: string;
}

export default function HoverEffect({ mainImageUrl, hoverImageUrl }: HoverEffectProps) {
    const mesh = useRef<THREE.Mesh>(null);
    const { viewport, size } = useThree();
    const [mainTexture, hoverTexture] = useTexture([mainImageUrl, hoverImageUrl]);

    const [hovered, setHovered] = useState(false);
    const [clicked, setClicked] = useState(false);
    const [imageRatio, setImageRatio] = useState(1);

    const hoverProgress = useRef(0);
    const clickProgress = useRef(0);
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
        u_ratio: { value: new THREE.Vector2(1, 1) },
        u_hoverratio: { value: new THREE.Vector2(1, 1) }
    });

    useFrame((_, delta) => {
        if (!mesh.current) return;

        const targetHover = hovered ? 1 : 0;
        const targetClick = clicked ? 1 : 0;

        hoverProgress.current += (targetHover - hoverProgress.current) * 0.1;
        clickProgress.current += (targetClick - clickProgress.current) * 0.1;

        const material = mesh.current.material as THREE.ShaderMaterial;
        material.uniforms.u_time.value += delta;
        material.uniforms.u_progressHover.value = hoverProgress.current;
        material.uniforms.u_progressClick.value = clickProgress.current;
        material.uniforms.u_mouse.value.copy(mouse.current);

        const dims = calculateDimensions();
        material.uniforms.u_ratio.value.set(dims.width / viewport.width, dims.height / viewport.height);
        material.uniforms.u_hoverratio.value.copy(material.uniforms.u_ratio.value);
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
            onClick={() => setClicked(!clicked)}
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