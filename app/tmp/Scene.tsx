import { Canvas } from '@react-three/fiber';
import HoverEffect from "../../components/HoverEffect";

interface SceneProps {
    mainImageUrl: string;
    hoverImageUrl: string;
}

export default function Scene({ mainImageUrl, hoverImageUrl }: SceneProps) {
    return (
        <Canvas
            camera={{
                fov: 45,
                near: 0.1,
                far: 100,
                position: [0, 0, 5]
            }}
        >
            <HoverEffect
                mainImageUrl={mainImageUrl}
                hoverImageUrl={hoverImageUrl}
            />
        </Canvas>
    );
}