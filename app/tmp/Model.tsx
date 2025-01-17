import React, { useRef, useState } from 'react'
import { useControls } from 'leva'
import { fragment, vertex } from './Shader'
import { useFrame } from '@react-three/fiber'
import { useTexture, useAspect } from '@react-three/drei'
import * as THREE from 'three'

type MeshWithMaterial = THREE.Mesh & {
    material: THREE.ShaderMaterial & {
        uniforms: {
            uTime: { value: number }
            uHoverProgress: { value: number }
            uAmplitude: { value: number }
            uWaveLength: { value: number }
            uNoiseScale: { value: number }
            uTimeScale: { value: number }
        }
    }
}

export default function Model() {
    const image = useRef<MeshWithMaterial>(null)
    const texture = useTexture("/cover.jpg")
    const { width, height } = texture.image
    const scale = useAspect(width, height, 1)

    // Hover state
    const [hovered, setHovered] = useState(false)
    const hoverProgress = useRef(0)

    const { amplitude, waveLength, noiseScale, timeScale, hoverSpeed } = useControls({
        amplitude: { value: 0.25, min: 0, max: 2, step: 0.1 },
        waveLength: { value: 5, min: 0, max: 20, step: 0.5 },
        noiseScale: { value: 2.0, min: 0, max: 5, step: 0.1 },
        timeScale: { value: 0.2, min: 0, max: 1, step: 0.01 },
        hoverSpeed: { value: 0.1, min: 0.01, max: 0.5, step: 0.01 }
    })

    const uniforms = useRef({
        uTime: { value: 0 },
        uAmplitude: { value: 0 },
        uWaveLength: { value: waveLength },
        uTexture: { value: texture },
        uNoiseScale: { value: noiseScale },
        uTimeScale: { value: timeScale },
        uHoverProgress: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) }
    })

    useFrame(() => {
        if (!image.current) return

        // Smoothly animate hover progress
        const targetProgress = hovered ? 1 : 0
        hoverProgress.current += (targetProgress - hoverProgress.current) * hoverSpeed

        // Update uniforms
        image.current.material.uniforms.uTime.value += 0.04
        image.current.material.uniforms.uHoverProgress.value = hoverProgress.current
        image.current.material.uniforms.uAmplitude.value = amplitude * hoverProgress.current
        image.current.material.uniforms.uWaveLength.value = waveLength
        image.current.material.uniforms.uNoiseScale.value = noiseScale
        image.current.material.uniforms.uTimeScale.value = timeScale
    })

    const handlePointerMove = (e: THREE.Event & { uv: THREE.Vector2 }) => {
        const x = (e.uv.x - 0.5) * 2
        const y = (e.uv.y - 0.5) * 2
        uniforms.current.uMouse.value.set(x, y)
    }

    return (
        <mesh
            ref={image}
            scale={scale}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onPointerMove={handlePointerMove}
        >
            <meshBasicMaterial />
            <planeGeometry attach="geometry" args={[1, 1, 32, 32]} />
            <shaderMaterial
                attach="material"
                transparent={true}
                fragmentShader={fragment}
                vertexShader={vertex}
                uniforms={uniforms.current}
            />
        </mesh>
    )
}