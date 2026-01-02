import { Stage, Graphics, Container, Text } from '@pixi/react'; import * as PIXI from 'pixi.js';
import { useCallback } from 'react';
import type { Player, ArenaConfig, Stroke } from '../types';

interface ArenaProps {
    players: Record<string, Player>;
    myId?: string | null;
    config: ArenaConfig;
    strokes: Stroke[];
    onStrokeStart: (x: number, y: number) => void;
    onStrokeMove: (x: number, y: number) => void;
    onStrokeEnd: () => void;
}

const Arena = ({ players, myId, config, strokes, onStrokeStart, onStrokeMove, onStrokeEnd }: ArenaProps) => {
    return (
        <Stage
            width={800}
            height={600}
            options={{ background: 0x101010 }}
        >
            {/* Interaction Layer - Transparent background to catch events */}
            <Graphics
                draw={(g) => {
                    g.clear();
                    g.beginFill(0x000000, 0.0); // Transparent
                    g.drawRect(0, 0, 800, 600);
                    g.endFill();
                }}
                // eventMode='static' replacement for interactive={true} in Pixi 7
                eventMode={'static'}
                hitArea={new PIXI.Rectangle(0, 0, 800, 600)}
                onpointerdown={(e) => {
                    const local = e.getLocalPosition(e.currentTarget as PIXI.DisplayObject);
                    onStrokeStart(local.x, local.y);
                }}
                onpointermove={(e) => {
                    const local = e.getLocalPosition(e.currentTarget as PIXI.DisplayObject);
                    onStrokeMove(local.x, local.y);
                }}
                onpointerup={() => onStrokeEnd()}
                onpointerupoutside={() => onStrokeEnd()}
            />

            {/* Strokes Layer */}
            <Graphics
                draw={useCallback((g: PIXI.Graphics) => {
                    try {
                        g.clear();
                        if (strokes.length > 0) {
                            // console.log(`[RENDER] Drawing ${strokes.length} strokes`);
                        }
                        strokes.forEach((stroke, idx) => {
                            if (!stroke || !stroke.points || stroke.points.length < 2) return;
                            // Ensure color is a number
                            const color = typeof stroke.color === 'number' ? stroke.color : parseInt(stroke.color as any, 16) || 0xffffff;

                            // Debug first stroke color
                            if (idx === strokes.length - 1) {
                                // console.log(`[RENDER] Stroke ${stroke.id}: rawColor=${stroke.color}, parsed=${color}, hex=${color.toString(16)}`);
                            }

                            const width = stroke.width || 3;
                            // If eraser, paint with background color (0x101010)
                            // Or we could use blend modes, but painting over is simpler for single layer.
                            const finalColor = stroke.isEraser ? 0x101010 : color;

                            g.lineStyle(width, finalColor, 1);
                            g.moveTo(stroke.points[0].x, stroke.points[0].y);
                            for (let i = 1; i < stroke.points.length; i++) {
                                g.lineTo(stroke.points[i].x, stroke.points[i].y);
                            }
                        });
                    } catch (err) {
                        console.error('Error drawing strokes:', err);
                    }
                }, [strokes])}
            />

            {/* Background / Arena Boundary */}
            <Graphics
                draw={(g: PIXI.Graphics) => {
                    // Start fresh
                    g.clear();
                    g.lineStyle(2, 0x444444);

                    if (config.shape === 'circle') {
                        g.drawCircle(400, 300, config.width / 2);
                    } else {
                        // Square (centered)
                        const halfW = config.width / 2;
                        const halfH = config.height / 2;
                        g.drawRect(400 - halfW, 300 - halfH, config.width, config.height);
                    }
                }}
            />

            {/* Players */}
            {/* Players */}
            {Object.values(players).map((player) => (
                <Container key={player.id} x={player.x} y={player.y}>
                    <Graphics
                        draw={(g: PIXI.Graphics) => {
                            g.clear();
                            // Draw player
                            // Use player.color if available, otherwise fallback
                            const isMe = player.id === myId;
                            // Default green for me, red for others if no color set
                            // If color set, use it. But maybe highlight "me" differently?
                            // User asked for "choose their dot color bound to them".
                            // So use player.color.
                            const color = player.color || (isMe ? 0x00ff00 : 0xff0000);

                            g.beginFill(color);
                            g.drawCircle(0, 0, 10); // Player hitbox
                            g.endFill();

                            // Ring (White for me, or maybe just always white ring?)
                            // Let's make "me" have a special highlight, e.g. thicker ring
                            g.lineStyle(isMe ? 3 : 2, 0xffffff, 0.8);
                            g.drawCircle(0, 0, 15);
                        }}
                    />
                    {player.name && (
                        <Text
                            text={player.name}
                            anchor={0.5}
                            y={-25}
                            style={new PIXI.TextStyle({
                                fill: '#ffffff',
                                fontSize: 14,
                                stroke: '#000000',
                                strokeThickness: 4,
                            })}
                        />
                    )}
                </Container>
            ))}
        </Stage>
    );
};

export default Arena;
