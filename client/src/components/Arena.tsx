import { Stage, Graphics, Container, Text, Sprite } from '@pixi/react'; import * as PIXI from 'pixi.js';
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
    markers?: Record<string, { x: number, y: number }>;
    // Preview for current line tool
    linePreview?: { x1: number, y1: number, x2: number, y2: number } | null;
}

const Arena = ({ players, myId, config, strokes, onStrokeStart, onStrokeMove, onStrokeEnd, scale = 1, honkingPlayers = {}, markers = {}, linePreview }: ArenaProps) => {
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
                            // Existing Strokes
                            strokes.forEach((stroke) => {
                                if (!stroke || !stroke.points || stroke.points.length < 2) return;
                                const color = typeof stroke.color === 'number' ? stroke.color : parseInt(stroke.color as any, 16) || 0xffffff;
                                const width = stroke.width || 3;
                                const finalColor = stroke.isEraser ? 0x101010 : color;

                                g.lineStyle(width, finalColor, 1);
                                g.moveTo(stroke.points[0].x, stroke.points[0].y);
                                for (let i = 1; i < stroke.points.length; i++) {
                                    g.lineTo(stroke.points[i].x, stroke.points[i].y);
                                }
                            });

                            // Line Preview
                            if (linePreview) {
                                // For now assume white or last selected color? 
                                // Actually we don't pass selectedColor to Arena. 
                                // Let's simplify and make it white or a distinct "preview" color like Yellow/Green, 
                                // OR modify strokes to include the partial stroke. 
                                // But passing it as a separate prop is cleaner.
                                g.lineStyle(2, 0xFFFFFF, 0.8); // White dashed/solid
                                g.moveTo(linePreview.x1, linePreview.y1);
                                g.lineTo(linePreview.x2, linePreview.y2);
                            }

                        } catch (err) {
                            console.error('Error drawing strokes:', err);
                        }
                    }, [strokes, linePreview])}
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

                {/* Waymarks Layer */}
                <Container>
                    {markers && Object.entries(markers).map(([type, pos]) => {
                        const size = 40; // Size of waymark
                        return (
                            <Sprite
                                key={type}
                                image={`/waymarks/${type}.png`}
                                x={pos.x}
                                y={pos.y}
                                width={size}
                                height={size}
                                anchor={0.5}
                            />
                        );
                    })}
                </Container>

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
                                    {player.debuffs.map((colorVal, i) => {
                                        // Ensure color is a valid number
                                        let finalColor = typeof colorVal === 'number' ? colorVal : parseInt(colorVal, 16);
                                        if (isNaN(finalColor)) finalColor = 0xFFFFFF;

                                        const count = player.debuffs.length;
                                        const spacing = 12;
                                        const startX = -((count - 1) * spacing) / 2;
                                        return (
                                            <Graphics
                                                key={i}
                                                x={startX + i * spacing}
                                                draw={(g) => {
                                                    try {
                                                        g.clear();
                                                        g.beginFill(finalColor);
                                                        g.lineStyle(1, 0x000000);
                                                        g.drawCircle(0, 0, 5);
                                                        g.endFill();
                                                    } catch (err) {
                                                        console.error('Error drawing debuff:', err);
                                                    }
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
