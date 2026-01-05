import { Stage, Graphics, Container, Text, Sprite } from '@pixi/react'; import * as PIXI from 'pixi.js';
import { useCallback, useRef } from 'react';
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
    shapePreview?: { x: number, y: number, r: number } | null;
    conePreview?: { x: number, y: number, r: number, startAngle: number, endAngle: number, anticlockwise?: boolean } | null;
    text?: { id: string, x: number, y: number, text: string, color: number, fontSize: number }[];
    currentTool?: 'select' | 'brush' | 'eraser' | 'line' | 'text' | 'donut' | 'circle' | 'cone';
    currentColor?: number;
    currentWidth?: number;
    // Selection
    selectionBox?: { x: number, y: number, w: number, h: number } | null;
    selectedIds?: string[];
}

const Arena = ({
    players,
    myId,
    config,
    strokes,
    onStrokeStart,
    onStrokeMove,
    onStrokeEnd,
    scale = 1,
    honkingPlayers = {},
    markers = {},
    linePreview,
    shapePreview,
    conePreview,
    text = [],
    currentTool = 'brush',
    currentColor = 0xff0000,
    currentWidth = 3,
    selectionBox,
    selectedIds = []
}: ArenaProps) => {
    // Optimization: Use ref for cursor to avoid re-rendering entire Arena on mousemove
    // We strictly use the ref for POSITION updates. 
    // Appearance (draw) is handled by the Graphics component's draw prop, which re-runs when props change.
    const cursorRef = useRef<PIXI.Graphics>(null);

    console.log('Arena render. Text items:', text);

    // Helper to move cursor imperatively
    const updateCursorPos = (x: number, y: number) => {
        if (cursorRef.current) {
            cursorRef.current.position.set(x, y);
            cursorRef.current.visible = true;
        }
    };
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
                        updateCursorPos(local.x, local.y);
                    }}
                    onpointerover={(e) => {
                        const local = e.getLocalPosition(e.currentTarget as PIXI.DisplayObject);
                        updateCursorPos(local.x, local.y);
                    }}
                    onpointerout={() => {
                        if (cursorRef.current) cursorRef.current.visible = false;
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
                            // Existing Strokes
                            strokes.forEach((stroke) => {
                                if (!stroke || !stroke.points || stroke.points.length === 0) return;
                                const color = typeof stroke.color === 'number' ? stroke.color : parseInt(stroke.color as any, 16) || 0xffffff;
                                const width = stroke.width || 3;
                                const finalColor = stroke.isEraser ? 0x101010 : color;

                                g.lineStyle({
                                    width,
                                    color: finalColor,
                                    alpha: 1,
                                    cap: PIXI.LINE_CAP.ROUND,
                                    join: PIXI.LINE_JOIN.ROUND
                                });

                                if (stroke.type === 'cone' && stroke.points.length >= 3) {
                                    const center = stroke.points[0];
                                    const pStart = stroke.points[1];
                                    const pEnd = stroke.points[2];
                                    const r = Math.sqrt(Math.pow(pStart.x - center.x, 2) + Math.pow(pStart.y - center.y, 2));
                                    const startAngle = Math.atan2(pStart.y - center.y, pStart.x - center.x);
                                    let endAngle = Math.atan2(pEnd.y - center.y, pEnd.x - center.x);

                                    // Use explicit anticlockwise flag from stroke data
                                    const anticlockwise = stroke.anticlockwise ?? false;

                                    g.beginFill(finalColor, 0.5);
                                    g.moveTo(center.x, center.y);
                                    g.arc(center.x, center.y, r, startAngle, endAngle, anticlockwise);
                                    g.lineTo(center.x, center.y);
                                    g.endFill();
                                } else if ((stroke.type === 'donut' || stroke.type === 'circle') && stroke.points.length >= 2) {
                                    const center = stroke.points[0];
                                    const radiusPoint = stroke.points[stroke.points.length - 1];
                                    const r = Math.sqrt(Math.pow(radiusPoint.x - center.x, 2) + Math.pow(radiusPoint.y - center.y, 2));

                                    g.lineStyle({
                                        width,
                                        color: finalColor,
                                        alpha: 1,
                                    });
                                    if (stroke.type === 'circle') {
                                        g.beginFill(finalColor, 0.5); // Filled circle (with some transparency?) User said "completely filled". Let's do 1.0 or 0.5? Usually 1.0 or user default.
                                        // Wait, user said "completely filled with color". Maybe opacity depends on something else?
                                        // Let's use 1.0 alpha for fill if it's "paint".
                                        g.beginFill(finalColor, 1.0);
                                    } else {
                                        g.beginFill(0, 0); // Donut: No fill
                                    }
                                    g.drawCircle(center.x, center.y, r);
                                    g.endFill();
                                } else {
                                    // Handle Freehand / Line (Legacy)
                                    if (stroke.points.length === 1) {
                                        g.lineStyle(0);
                                        g.beginFill(finalColor);
                                        g.drawCircle(stroke.points[0].x, stroke.points[0].y, width / 2);
                                        g.endFill();
                                    } else {
                                        g.moveTo(stroke.points[0].x, stroke.points[0].y);
                                        for (let i = 1; i < stroke.points.length; i++) {
                                            g.lineTo(stroke.points[i].x, stroke.points[i].y);
                                        }
                                    }
                                }
                            });

                            // Line Preview
                            if (linePreview) {
                                g.lineStyle(2, 0xFFFFFF, 0.8); // White dashed/solid
                                g.moveTo(linePreview.x1, linePreview.y1);
                                g.lineTo(linePreview.x2, linePreview.y2);
                            }

                            // Shape Preview
                            if (shapePreview) {
                                g.lineStyle(2, 0xFFFFFF, 0.8);
                                if (currentTool === 'circle') {
                                    g.beginFill(currentColor ?? 0xff0000, 1.0);
                                } else {
                                    g.beginFill(0, 0);
                                }
                                g.drawCircle(shapePreview.x, shapePreview.y, shapePreview.r);
                                g.endFill();
                            }

                            // Cone Preview
                            if (conePreview) {
                                g.lineStyle(2, 0xFFFFFF, 0.8);
                                g.beginFill(currentColor ?? 0xff0000, 0.5);
                                g.moveTo(conePreview.x, conePreview.y);

                                // Highlighting the axis: if angles are same, draw line
                                if (Math.abs(conePreview.startAngle - conePreview.endAngle) < 0.001) {
                                    g.lineTo(
                                        conePreview.x + conePreview.r * Math.cos(conePreview.startAngle),
                                        conePreview.y + conePreview.r * Math.sin(conePreview.startAngle)
                                    );
                                } else {
                                    g.arc(conePreview.x, conePreview.y, conePreview.r, conePreview.startAngle, conePreview.endAngle, conePreview.anticlockwise ?? false);
                                    g.lineTo(conePreview.x, conePreview.y);
                                }
                                g.endFill();
                            }

                        } catch (err) {
                            console.error('Error drawing strokes:', err);
                        }
                    }, [strokes, linePreview, shapePreview, currentTool, currentColor])}
                />



                {/* Text Layer */}
                <Container>
                    {text && text.map((t) => (
                        <Text
                            key={t.id}
                            text={t.text}
                            x={t.x}
                            y={t.y}
                            anchor={[0, 1]}
                            style={new PIXI.TextStyle({
                                fill: t.color,
                                fontSize: t.fontSize || 20,
                                fontFamily: 'Arial',
                                stroke: '#000000',
                                strokeThickness: 3
                            })}
                        />
                    ))}
                </Container>

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
                        } else if (config.shape === 'square') {
                            // Square (centered)
                            const halfW = config.width / 2;
                            const halfH = config.height / 2;
                            g.drawRect(400 - halfW, 300 - halfH, config.width, config.height);
                        }
                        // If 'none', draw nothing for the boundary

                        // Draw Grid
                        if (config.showGrid) {
                            g.lineStyle(1, 0xFFFFFF, 0.1); // Very faint white
                            const step = 50;

                            if (config.shape === 'none') {
                                // Full Canvas Grid
                                // Vertical lines (covering 0 to 800)
                                for (let x = 0; x <= 800; x += step) {
                                    g.moveTo(x, 0);
                                    g.lineTo(x, 600);
                                }
                                // Horizontal lines (covering 0 to 600)
                                for (let y = 0; y <= 600; y += step) {
                                    g.moveTo(0, y);
                                    g.lineTo(800, y);
                                }
                            } else if (config.shape === 'square') {
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
                                const r = config.width / 2;
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
                                alpha={0.75}
                            />
                        );
                    })}
                </Container>

                {/* Cursor Preview Layer */}
                <Graphics
                    ref={cursorRef}
                    draw={useCallback((g: PIXI.Graphics) => {
                        g.clear();
                        if (currentTool === 'select') return;
                        if (currentTool === 'text') {
                            const color = currentColor ?? 0xff0000;
                            g.lineStyle(2, color, 1);
                            // Calculate anticipated font size to match App.tsx logic
                            const fontSize = Math.max(12, currentWidth * 2);

                            // Draw I-beam (Shifted up to match text box anchor)
                            g.moveTo(0, -fontSize);
                            g.lineTo(0, 0);
                            // Serifs
                            g.moveTo(-5, -fontSize);
                            g.lineTo(5, -fontSize);
                            g.moveTo(-5, 0);
                            g.lineTo(5, 0);

                            g.visible = true;
                            return;
                        }
                        const isEraser = currentTool === 'eraser';
                        const color = isEraser ? 0xffffff : (currentColor ?? 0xff0000);
                        const alpha = isEraser ? 0.5 : 0.8;

                        let r = Math.max((currentWidth || 3) / 2, 2);
                        if (isNaN(r)) r = 2;

                        g.lineStyle(2, 0x000000, 0.5);
                        g.beginFill(color, alpha);
                        g.drawCircle(0, 0, r);
                        g.endFill();
                    }, [currentTool, currentColor, currentWidth])}

                />

                {/* Selection Overlay */}
                <Graphics
                    draw={useCallback((g: PIXI.Graphics) => {
                        g.clear();

                        // Draw Selection Box (Drag)
                        if (selectionBox) {
                            const { x, y, w, h } = selectionBox;
                            g.lineStyle(1, 0x00B4FF, 0.8); // Light Blue
                            g.drawRect(x, y, w, h);
                            g.beginFill(0x00B4FF, 0.1);
                            g.drawRect(x, y, w, h);
                            g.endFill();
                        }

                        // Draw Selected Object Bounds
                        if (selectedIds.length > 0) {
                            g.lineStyle(1, 0x00B4FF, 1);

                            strokes.forEach(s => {
                                if (selectedIds.includes(s.id)) {
                                    if (s.points.length === 0) return;
                                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                                    if (s.type === 'circle' && s.points.length >= 2) {
                                        const c = s.points[0];
                                        const r = Math.sqrt(Math.pow(s.points[1].x - c.x, 2) + Math.pow(s.points[1].y - c.y, 2));
                                        minX = c.x - r; maxX = c.x + r;
                                        minY = c.y - r; maxY = c.y + r;
                                    } else if (s.type === 'donut' && s.points.length >= 2) {
                                        const c = s.points[0];
                                        const r = Math.sqrt(Math.pow(s.points[1].x - c.x, 2) + Math.pow(s.points[1].y - c.y, 2));
                                        minX = c.x - r; maxX = c.x + r;
                                        minY = c.y - r; maxY = c.y + r;
                                    } else {
                                        s.points.forEach(p => {
                                            if (p.x < minX) minX = p.x;
                                            if (p.x > maxX) maxX = p.x;
                                            if (p.y < minY) minY = p.y;
                                            if (p.y > maxY) maxY = p.y;
                                        });
                                    }
                                    const pad = (s.width || 3) / 2 + 5;
                                    g.drawRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
                                }
                            });

                            if (text) {
                                text.forEach(t => {
                                    if (selectedIds.includes(t.id)) {
                                        const w = t.text.length * (t.fontSize || 20) * 0.6;
                                        const h = t.fontSize || 20;
                                        g.drawRect(t.x - 2, t.y - h - 2, w + 4, h + 4);
                                    }
                                });
                            }
                        }

                    }, [selectionBox, selectedIds, strokes, text])}
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

                            {/* Limit Cut - Render dots pattern above debuffs */}
                            {player.limitCut && (
                                <Container x={0} y={isSpectator ? -35 : -60}>
                                    <Graphics
                                        draw={(g) => {
                                            try {
                                                g.clear();
                                                const num = player.limitCut!;
                                                const color = num % 2 === 1 ? 0x00B4FF : 0xFF6B4A; // Blue = odd, Red = even
                                                const dotRadius = 3;
                                                const sp = 8; // spacing

                                                // Draw dot helper
                                                const drawDot = (x: number, y: number) => {
                                                    g.beginFill(color);
                                                    g.lineStyle(1, 0x000000);
                                                    g.drawCircle(x, y, dotRadius);
                                                    g.endFill();
                                                };

                                                // FFXIV Limit Cut patterns (matching screenshot)
                                                switch (num) {
                                                    case 1:
                                                        drawDot(0, 0);
                                                        break;
                                                    case 2:
                                                        drawDot(-sp / 2, 0);
                                                        drawDot(sp / 2, 0);
                                                        break;
                                                    case 3:
                                                        // 1 on top, 2 below (triangle)
                                                        drawDot(0, -sp / 2); // top
                                                        drawDot(-sp / 2, sp / 2); // bottom left
                                                        drawDot(sp / 2, sp / 2); // bottom right
                                                        break;
                                                    case 4:
                                                        drawDot(-sp / 2, -sp / 2);
                                                        drawDot(sp / 2, -sp / 2);
                                                        drawDot(-sp / 2, sp / 2);
                                                        drawDot(sp / 2, sp / 2);
                                                        break;
                                                    case 5:
                                                        // 1 dot left, 4 dots (2x2) right
                                                        drawDot(-sp * 1.5, 0); // single dot left

                                                        // 2x2 square to the right
                                                        drawDot(0, -sp / 2); // top left of square
                                                        drawDot(sp, -sp / 2); // top right of square
                                                        drawDot(0, sp / 2); // bottom left of square
                                                        drawDot(sp, sp / 2); // bottom right of square
                                                        break;
                                                    case 6:
                                                        // Triangle (left) + Inverted Triangle (right)
                                                        // Left Triangle (1 top, 2 bottom)
                                                        drawDot(-sp, -sp / 2); // top
                                                        drawDot(-sp * 1.5, sp / 2); // bottom left
                                                        drawDot(-sp * 0.5, sp / 2); // bottom right

                                                        // Right Inverted Triangle (2 top, 1 bottom)
                                                        drawDot(sp * 0.5, -sp / 2); // top left
                                                        drawDot(sp * 1.5, -sp / 2); // top right
                                                        drawDot(sp, sp / 2); // bottom center
                                                        break;
                                                    case 7:
                                                        // Triangle (left) + Square (right)
                                                        // Left Triangle (1 top, 2 bottom)
                                                        drawDot(-sp * 1.5, -sp / 2); // top
                                                        drawDot(-sp * 2, sp / 2); // bottom left
                                                        drawDot(-sp, sp / 2); // bottom right

                                                        // Right Square (2x2)
                                                        drawDot(0, -sp / 2); // top left
                                                        drawDot(sp, -sp / 2); // top right
                                                        drawDot(0, sp / 2); // bottom left
                                                        drawDot(sp, sp / 2); // bottom right
                                                        break;
                                                    case 8:
                                                        // 2 rows of 4
                                                        drawDot(-sp * 1.5, -sp / 2);
                                                        drawDot(-sp / 2, -sp / 2);
                                                        drawDot(sp / 2, -sp / 2);
                                                        drawDot(sp * 1.5, -sp / 2);
                                                        drawDot(-sp * 1.5, sp / 2);
                                                        drawDot(-sp / 2, sp / 2);
                                                        drawDot(sp / 2, sp / 2);
                                                        drawDot(sp * 1.5, sp / 2);
                                                        break;
                                                }
                                            } catch (err) {
                                                console.error('Error drawing limit cut:', err);
                                            }
                                        }}
                                    />
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
