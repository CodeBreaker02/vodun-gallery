import React from 'react';
import { Canvas } from '@react-three/fiber';
import HoverEffect from "../../components/HoverEffect";
import {Card, CardContent} from "../../components/ui/card";

interface CardSceneProps {
    mainImageUrl: string;
    hoverImageUrl: string;
}

export default function CardScene({ mainImageUrl, hoverImageUrl }: CardSceneProps) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-[600px] h-[400px] overflow-hidden">
                <CardContent className="p-0 h-full relative">
                    <div className="absolute inset-0">
                        <Canvas
                            camera={{
                                fov: 45,
                                near: 0.1,
                                far: 100,
                                position: [0, 0, 2]
                            }}
                            dpr={[1, 2]}
                        >
                            <HoverEffect
                                mainImageUrl={mainImageUrl}
                                hoverImageUrl={hoverImageUrl}
                            />
                        </Canvas>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}