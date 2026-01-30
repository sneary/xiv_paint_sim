import React, { useEffect, useState } from 'react';
import type { SimulationState } from '../types';

interface CastBarProps {
    simState: SimulationState;
    scale?: number; // Global app scale for Arena
}

const CastBar: React.FC<CastBarProps> = ({ simState, scale = 1 }) => {
    const { bossCast, isRunning } = simState;
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!bossCast || !isRunning) {
            setVisible(false);
            return;
        }

        setVisible(true);

        let animationFrameId: number;

        const update = () => {
            const now = Date.now();
            const elapsed = now - bossCast.startTime;
            const p = Math.min(1, Math.max(0, elapsed / bossCast.duration));
            setProgress(p);

            animationFrameId = requestAnimationFrame(update);
        };

        update();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [bossCast?.startTime, bossCast?.duration, isRunning]);

    if (!visible || !bossCast) return null;

    // Default sizing
    const BASE_WIDTH = 225; // 3/4 of previous 300px
    const castScale = bossCast.scale ?? 1;

    // Positioning
    // Default: Top middle of the arena container.
    // Assuming container is relative.
    // x, y from bossCast can be pixels or percentages? 
    // Let's assume pixels relative to arena origin (top-left) if provided.
    // If not provided: x=50% (centered), y=100px (top offset)

    // If user provides x/y, we use them.
    // If x is not provided, use 50% (of container width).
    // If y is not provided, use 100px.

    const left = bossCast.x !== undefined ? `${bossCast.x}px` : '50%';
    const top = bossCast.y !== undefined ? `${bossCast.y}px` : '100px';
    const transformX = bossCast.x !== undefined ? '0%' : '-50%'; // Center if using default 50%

    // Width of the bar relative to progress
    const widthPercent = progress * 100;

    return (
        <div style={{
            position: 'absolute',
            top: top,
            left: left,
            transform: `translate(${transformX}, 0) scale(${castScale})`, // Scale component itself
            transformOrigin: 'top center',
            pointerEvents: 'none',
            zIndex: 100, // Above canvas
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: `${BASE_WIDTH}px`
        }}>
            {/* Wrapper to apply global app scale if needed */}
            <div style={{
                transform: `scale(${scale})`, // Global App/Window Scale
                transformOrigin: 'top center',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                {/* Cast Bar Container */}
                <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '14px',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '2px', // Slight rounding
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}>
                    {/* Progress Fill */}
                    <div style={{
                        width: `${widthPercent}%`,
                        height: '100%',
                        backgroundColor: '#EAC159', // Goldish
                        background: 'linear-gradient(to bottom, #FFD700, #EAC159, #B8860B)',
                        borderRadius: '1px'
                    }} />

                    {/* Shine/Gloss effect (Optional) */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '50%',
                        background: 'linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)',
                        pointerEvents: 'none'
                    }} />
                </div>

                {/* Cast Name - Right Aligned Under Bar */}
                <div style={{
                    width: '100%',
                    textAlign: 'right',
                    marginTop: '4px',
                    color: '#FFFFFF',
                    fontFamily: "'Jupiter Pro', 'Meiryo', sans-serif", // FFXIV-ish fonts
                    fontSize: '16px',
                    textShadow: '1px 1px 2px black, 0 0 4px black',
                    fontWeight: 600
                }}>
                    {bossCast.name}
                </div>
            </div>
        </div>
    );
};

export default CastBar;
