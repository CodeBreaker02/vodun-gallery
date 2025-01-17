"use client";

import { Canvas } from '@react-three/fiber';
import { Card, CardContent } from "@/components/ui/card";
import HoverEffect from "../components/HoverEffect";
import NoiseCircleEffect from "../components/NoiseCircleEffect";
import MagneticEffect from "../components/MagneticEffect";
import NoiseEffect from "../components/NoiseDistortionEffect";
import ShapeHoverEffect from "../components/ShapeHoverEffect";
import WaterRippleEffect from "../components/WaterRippleEffect";
import Marquee from '@/components/ui/marquee';
import { useMemo, useState, useEffect, useRef, RefObject } from 'react';
import { ComponentType } from 'react';
import ExplosionEffect from "@/components/ExplosionEffect";

// Base interfaces for props and effects
interface BaseEffectProps {
    mainImageUrl: string;
    hoverImageUrl: string;
}

interface ShapeHoverEffectProps extends BaseEffectProps {
    shapeImageUrl: string;
}

type BaseEffect = {
    type: 'hover' | 'noise-circle' | 'magnetic' | 'noise-distortion' | 'water-ripple' | 'explosion';
    component: ComponentType<BaseEffectProps>;
    label: string;
};

type ShapeEffect = {
    type: 'shape-hover';
    component: ComponentType<ShapeHoverEffectProps>;
    label: string;
};

type EffectComponent = BaseEffect | ShapeEffect;

const effects: EffectComponent[] = [
    { type: 'hover', component: HoverEffect, label: 'Wave Effect' },
    { type: 'noise-circle', component: NoiseCircleEffect, label: 'Noise Circle Effect' },
    { type: 'magnetic', component: MagneticEffect, label: 'Magnetic Effect' },
    { type: 'noise-distortion', component: NoiseEffect, label: 'Noise Distortion Effect' },
    { type: 'shape-hover', component: ShapeHoverEffect, label: 'Shape Hover Effect' },
    { type: 'water-ripple', component: WaterRippleEffect, label: 'Water Ripple Effect' },
    { type: 'explosion', component: ExplosionEffect, label: 'Explosion Effect' },
];

interface ImageData {
    id: number;
    mainImage: string;
    hoverImage: string;
}

interface ImageWithEffect extends ImageData {
    effect: EffectComponent;
}

const imageData: ImageData[] = [
    { id: 1, mainImage: "/gallery/img.png", hoverImage: "/gallery/img.png" },
    { id: 2, mainImage: "/gallery/img_1.png", hoverImage: "/gallery/img_1.png" },
    { id: 3, mainImage: "/gallery/img_2.png", hoverImage: "/gallery/img_2.png" },
    { id: 4, mainImage: "/gallery/img_3.png", hoverImage: "/gallery/img_3.png" },
    { id: 5, mainImage: "/gallery/img_4.png", hoverImage: "/gallery/img_4.png" },
    { id: 6, mainImage: "/gallery/img_5.png", hoverImage: "/gallery/img_5.png" },
    { id: 7, mainImage: "/gallery/img_6.png", hoverImage: "/gallery/img_6.png" },
    { id: 8, mainImage: "/gallery/img_7.png", hoverImage: "/gallery/img_7.png" },
    { id: 9, mainImage: "/gallery/img_8.png", hoverImage: "/gallery/img_8.png" },
    { id: 10, mainImage: "/gallery/img_9.png", hoverImage: "/gallery/img_9.png" },
    { id: 11, mainImage: "/gallery/img_10.png", hoverImage: "/gallery/img_10.png" },
    { id: 12, mainImage: "/gallery/img_11.png", hoverImage: "/gallery/img_11.png" },
    { id: 13, mainImage: "/gallery/img_12.png", hoverImage: "/gallery/img_12.png" },
    { id: 14, mainImage: "/gallery/img_13.png", hoverImage: "/gallery/img_13.png" },
    { id: 15, mainImage: "/gallery/img_14.png", hoverImage: "/gallery/img_14.png" },
    { id: 16, mainImage: "/gallery/img_15.png", hoverImage: "/gallery/img_15.png" },
    { id: 17, mainImage: "/gallery/img_16.png", hoverImage: "/gallery/img_16.png" },
    { id: 18, mainImage: "/gallery/img_17.png", hoverImage: "/gallery/img_17.png" },
];

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

interface HoverCardProps {
    mainImageUrl: string;
    hoverImageUrl: string;
    effect: EffectComponent;
}

function useIsInViewport(ref: RefObject<HTMLElement>): boolean {
    const [isIntersecting, setIsIntersecting] = useState<boolean>(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsIntersecting(entry.isIntersecting);
            },
            {
                rootMargin: '100px',
                threshold: 0
            }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
        };
    }, []);

    return isIntersecting;
}

function HoverCard({ mainImageUrl, hoverImageUrl, effect }: HoverCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const isInViewport = useIsInViewport(cardRef);
    const EffectComponent = effect.component;

    const renderEffect = () => {
        if (effect.type === 'shape-hover') {
            return (
                <EffectComponent
                    mainImageUrl={mainImageUrl}
                    hoverImageUrl={mainImageUrl}
                    shapeImageUrl="gallery/shape-mask.png"
                />
            );
        }
        return (
            <EffectComponent
                mainImageUrl={mainImageUrl}
                hoverImageUrl={hoverImageUrl}
                shapeImageUrl={hoverImageUrl}
            />
        );
    };

    return (
        <Card ref={cardRef} className="w-[400px] h-[500px] overflow-hidden bg-transparent border-0 transition-all duration-300">
            <CardContent className="p-0 h-full relative">
                {isInViewport && (
                    <div className="absolute inset-0">
                        <Canvas
                            camera={{
                                fov: 45,
                                near: 0.1,
                                far: 100,
                                position: [0, 0, 2]
                            }}
                            dpr={[1, 2]}
                            gl={{
                                powerPreference: "high-performance",
                                antialias: false
                            }}
                        >
                            {renderEffect()}
                        </Canvas>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function Home() {
    const [visibleColumnIndex, setVisibleColumnIndex] = useState<number>(0);
    const columnRefs = [
        useRef<HTMLDivElement>(null),
        useRef<HTMLDivElement>(null),
        useRef<HTMLDivElement>(null)
    ];

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = columnRefs.findIndex(
                            (ref) => ref.current === entry.target
                        );
                        if (index !== -1) {
                            setVisibleColumnIndex(index);
                        }
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: '0px 100px'
            }
        );

        columnRefs.forEach((ref) => {
            if (ref.current) {
                observer.observe(ref.current);
            }
        });

        return () => {
            columnRefs.forEach((ref) => {
                if (ref.current) {
                    observer.unobserve(ref.current);
                }
            });
        };
    }, []);

    const imagesWithEffects = useMemo<ImageWithEffect[]>(() => {
        // Create a shuffled copy of images
        const shuffledImages = shuffleArray([...imageData]);

        // Create a shuffled effects array with no consecutive repeats
        let availableEffects = [...effects];
        const shuffledEffects: EffectComponent[] = [];

        while (availableEffects.length > 0) {
            const validEffects = availableEffects.filter(effect =>
                shuffledEffects.length === 0 ||
                effect.type !== shuffledEffects[shuffledEffects.length - 1].type
            );

            const randomIndex = Math.floor(Math.random() * validEffects.length);
            const selectedEffect = validEffects[randomIndex];
            shuffledEffects.push(selectedEffect);

            // Remove the selected effect from available effects
            availableEffects = availableEffects.filter(effect => effect.type !== selectedEffect.type);

            // If we run out of effects, replenish them
            if (availableEffects.length === 0 && shuffledImages.length > shuffledEffects.length) {
                availableEffects = effects.filter(effect => effect.type !== shuffledEffects[shuffledEffects.length - 1].type);
            }
        }

        // Assign effects and hover images
        const result: ImageWithEffect[] = [];
        shuffledImages.forEach((image, index) => {
            const effectIndex = index % shuffledEffects.length;
            const hoverImageIndex = (index + 1) % shuffledImages.length;

            result.push({
                ...image,
                hoverImage: shuffledImages[hoverImageIndex].mainImage,
                effect: shuffledEffects[effectIndex],
            });
        });

        return result;
    }, []);

    const columns = useMemo(() => {
        const cols: ImageWithEffect[][] = [[], [], []];
        const itemsPerColumn = Math.ceil(imagesWithEffects.length / 3);

        imagesWithEffects.forEach((image, index) => {
            const columnIndex = Math.floor(index / itemsPerColumn);
            if (columnIndex < 3) {
                cols[columnIndex].push(image);
            }
        });

        return cols;
    }, [imagesWithEffects]);

    return (
        <main className="h-screen overflow-hidden flex flex-col bg-gradient-to-b from-[#120404] via-[#1a0808] to-[#220c0c]">
            <div className="flex-1 flex justify-center gap-8 px-4">
                {columns.map((column, columnIndex) => (
                    <div
                        key={columnIndex}
                        className="w-[400px]"
                        ref={columnRefs[columnIndex]}
                    >
                        <Marquee
                            vertical
                            className="[--duration:40s] h-full"
                            reverse={columnIndex % 2 === 1}
                            repeat={2}
                        >
                            {column.map((image) => (
                                <div
                                    key={image.id}
                                    className="mb-24 group"
                                >
                                    {Math.abs(columnIndex - visibleColumnIndex) <= 2 && (
                                        <HoverCard
                                            mainImageUrl={image.mainImage}
                                            hoverImageUrl={image.hoverImage}
                                            effect={image.effect}
                                        />
                                    )}
                                </div>
                            ))}
                        </Marquee>
                    </div>
                ))}
            </div>
        </main>
    );
}