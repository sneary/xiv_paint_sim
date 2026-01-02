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
    scale?: number;
    honkingPlayers?: Record<string, number>;
}

const Arena = ({ players, myId, config, strokes, onStrokeStart, onStrokeMove, onStrokeEnd, scale = 1, honkingPlayers = {} }: ArenaProps) => {
    return (
        <Stage
            width={800 * scale}
            height={600 * scale}
            options={{ background: 0x101010 }}
        >
            <Container scale={scale}>
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
                            strokes.forEach((stroke) => {
                                if (!stroke || !stroke.points || stroke.points.length < 2) return;
                                // Ensure color is a number
                                const color = typeof stroke.color === 'number' ? stroke.color : parseInt(stroke.color as any, 16) || 0xffffff;

                                const width = stroke.width || 3;
                                // If eraser, paint with background color (0x101010)
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

                        // Draw Floor
                        // g.beginFill(0xffffff); // Removed to keep original color (background)
                        g.lineStyle(2, 0x444444);

                        if (config.shape === 'circle') {
                            g.drawCircle(400, 300, config.width / 2);
                        } else {
                            // Square (centered)
                            const halfW = config.width / 2;
                            const halfH = config.height / 2;
                            g.drawRect(400 - halfW, 300 - halfH, config.width, config.height);
                        }
                        // g.endFill(); // Removed

                        // Draw Grid
                        if (config.showGrid) {
                            g.lineStyle(1, 0xFFFFFF, 0.1); // Very faint white
                            const step = 50;
                            const r = config.width / 2;

                            if (config.shape === 'square') {
                                const halfW = config.width / 2;
                                const halfH = config.height / 2;

                                // Verticals (centered at 400)
                                for (let x = -halfW + step; x < halfW; x += step) {
                                    g.moveTo(400 + x, 300 - halfH);
                                    g.lineTo(400 + x, 300 + halfH);
                                }
                                // Horizontals (centered at 300)
                                for (let y = -halfH + step; y < halfH; y += step) {
                                    g.moveTo(400 - halfW, 300 + y);
                                    g.lineTo(400 + halfW, 300 + y);
                                }
                            } else {
                                // Circle
                                // Verticals
                                for (let x = -r + step; x < r; x += step) {
                                    const limit = Math.sqrt(r * r - x * x);
                                    g.moveTo(400 + x, 300 - limit);
                                    g.lineTo(400 + x, 300 + limit);
                                }
                                // Horizontals
                                for (let y = -r + step; y < r; y += step) {
                                    const limit = Math.sqrt(r * r - y * y);
                                    g.moveTo(400 - limit, 300 + y);
                                    g.lineTo(400 + limit, 300 + y);
                                }
                            }
                        }
                    }}
                />

                {/* Players */}
                {Object.values(players).map((player) => {
                    const isSpectator = player.role === 'spectator';
                    const isHonking = !!honkingPlayers[player.id];

                    return (
                        <Container key={player.id} x={player.x} y={player.y}>
                            {!isSpectator && (
                                <Graphics
                                    draw={(g: PIXI.Graphics) => {
                                        g.clear();
                                        const isMe = player.id === myId;
                                        // Role Colors
                                        const roleColors = {
                                            tank: 0x4a90e2,
                                            healer: 0x7ed321,
                                            dps: 0xd0021b
                                            // spectator handled above
                                        };
                                        let baseColor = (roleColors as any)[player.role] || 0xd0021b;

                                        if (isHonking) {
                                            // Invert Color
                                            baseColor = 0xFFFFFF ^ baseColor;
                                        }

                                        g.beginFill(baseColor);
                                        g.drawCircle(0, 0, 10); // Player hitbox
                                        g.endFill();

                                        // Ring uses the player's selected paint color
                                        // Highlight 'me' with thicker stroke
                                        g.lineStyle(isMe ? 3 : 2, isHonking ? (0xFFFFFF ^ player.color) : player.color, 1);
                                        g.drawCircle(0, 0, 15);
                                    }}
                                />
                            )}

                            {/* Debuffs - Render above Name */}
                            {player.debuffs && player.debuffs.length > 0 && (
                                <Container x={0} y={isSpectator ? -20 : -45}>
                                    {player.debuffs.map((color, i) => {
                                        const count = player.debuffs.length;
                                        const spacing = 12;
                                        const startX = -((count - 1) * spacing) / 2;
                                        return (
                                            <Graphics
                                                key={i}
                                                x={startX + i * spacing}
                                                draw={(g) => {
                                                    g.clear();
                                                    g.beginFill(color);
                                                    g.lineStyle(1, 0x000000);
                                                    g.drawCircle(0, 0, 5);
                                                    g.endFill();
                                                }}
                                            />
                                        );
                                    })}
                                </Container>
                            )}

                            {player.name && (
                                <Text
                                    text={player.name}
                                    anchor={0.5}
                                    y={isSpectator ? 0 : -25} // Center name if spectator, otherwise above sprite
                                    alpha={isSpectator ? 0.6 : 1}
                                    style={new PIXI.TextStyle({
                                        fill: '#ffffff',
                                        fontSize: 14,
                                        stroke: '#000000',
                                        strokeThickness: 4,
                                    })}
                                />
                            )}
                        </Container>
                    );
                })}
            </Container>
        </Stage>
    );
};

export default Arena;
