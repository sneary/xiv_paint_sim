import { Stage, Graphics, Container, Text, Sprite } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useCallback, useRef } from 'react';
import type { Player, ArenaConfig, Stroke } from '../types';
import GridLayer from './ArenaLayers/GridLayer';
import PlayerSprite from './ArenaLayers/PlayerSprite';

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
    rectPreview?: { x: number, y: number, w: number, h: number } | null;
    text?: { id: string, x: number, y: number, text: string, color: number, fontSize: number }[];
    currentTool?: 'select' | 'brush' | 'eraser' | 'line' | 'text' | 'donut' | 'circle' | 'cone' | 'rect';
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
    rectPreview,
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

    // Helper to move cursor imperatively
    const updateCursorPos = (x: number, y: number) => {
        if (cursorRef.current) {
            cursorRef.current.position.set(x, y);
            cursorRef.current.visible = true;
        }
    };

    // Determine Canvas Size
    // Default to 800x600, but if config has background (RaidPlan) or is larger, expand.
    const canvasWidth = config.backgroundImageUrl ? config.width : 800;
    const canvasHeight = config.backgroundImageUrl ? config.height : 600;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const drawInteractionLayer = useCallback((g: PIXI.Graphics) => {
        g.clear();
        g.beginFill(0x000000, 0.0); // Transparent
        g.drawRect(0, 0, canvasWidth, canvasHeight);
        g.endFill();
    }, [canvasWidth, canvasHeight]);

    const drawStrokes = useCallback((g: PIXI.Graphics) => {
        try {
            g.clear();
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
                        // Let's use 1.0 alpha for fill if it's "paint".
                        g.beginFill(finalColor, 1.0);
                    } else {
                        g.beginFill(0, 0); // Donut: No fill
                    }
                    g.drawCircle(center.x, center.y, r);
                    g.endFill();
                } else if (stroke.type === 'rect') {
                    // Rectangle
                    if (stroke.points.length >= 2) {
                        const p1 = stroke.points[0];
                        const p2 = stroke.points[stroke.points.length - 1]; // Use last point
                        g.lineStyle(0);
                        g.beginFill(finalColor, 1.0); // Filled per request
                        const x = Math.min(p1.x, p2.x);
                        const y = Math.min(p1.y, p2.y);
                        const w = Math.abs(p2.x - p1.x);
                        const h = Math.abs(p2.y - p1.y);
                        g.drawRect(x, y, w, h);
                        g.endFill();
                    }
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

            // Rect Preview
            if (rectPreview) {
                g.lineStyle(2, 0xFFFFFF, 0.8);
                g.beginFill(currentColor ?? 0xff0000, 1.0);
                // Normalizing not strictly needed if drawRect handles negative, but safe
                const { x, y, w, h } = rectPreview;
                const x_ = w < 0 ? x + w : x;
                const y_ = h < 0 ? y + h : y;
                const w_ = Math.abs(w);
                const h_ = Math.abs(h);
                g.drawRect(x_, y_, w_, h_);
                g.endFill();
            }

            // Shape Preview (Circle/Donut)
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
    }, [strokes, linePreview, shapePreview, conePreview, rectPreview, currentTool, currentColor]);

    const drawCursor = useCallback((g: PIXI.Graphics) => {
        g.clear();
        if (currentTool === 'select') return;
        if (currentTool === 'text') {
            const color = currentColor ?? 0xff0000;
            g.lineStyle(2, color, 1);
            // Calculate anticipated font size to match App.tsx logic
            const fontSize = Math.max(12, (currentWidth || 3) * 2);

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
    }, [currentTool, currentColor, currentWidth]);

    const drawSelection = useCallback((g: PIXI.Graphics) => {
        g.clear();

        // Draw Selection Box (Drag)
        if (selectionBox) {
            const { x, y, w, h } = selectionBox;
            g.lineStyle(1, 0x00B4FF, 0.8); // Light Blue
            g.drawRect(x, y, w, h);
            // Draw Selection Box
            g.lineStyle(1, 0x00B4FF, 1);
            // Normalize rect for negative w/h
            const x_ = w < 0 ? x + w : x;
            const y_ = h < 0 ? y + h : y;
            const w_ = Math.abs(w);
            const h_ = Math.abs(h);

            g.beginFill(0x00B4FF, 0.1);
            g.drawRect(x_, y_, w_, h_);
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

    }, [selectionBox, selectedIds, strokes, text]);

    return (
        <Stage
            width={canvasWidth * scale}
            height={canvasHeight * scale}
            options={{ background: 0x101010 }}
        >
            <Container scale={scale}>
                {/* RaidPlan Background Image - Rendered FIRST (behind everything) */}
                {config.backgroundImageUrl && (
                    <Sprite
                        image={config.backgroundImageUrl}
                        x={centerX}
                        y={centerY}
                        width={config.width}
                        height={config.height}
                        anchor={0.5}
                        alpha={1}
                    />
                )}

                {/* Interaction Layer - Transparent background to catch events */}
                <Graphics
                    draw={drawInteractionLayer}
                    eventMode={'static'}
                    hitArea={new PIXI.Rectangle(0, 0, canvasWidth, canvasHeight)}
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
                <Graphics draw={drawStrokes} />

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

                {/* Background / Arena Boundary (Grid) */}
                <GridLayer config={config} width={canvasWidth} height={canvasHeight} />

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
                <Graphics ref={cursorRef} draw={drawCursor} />

                {/* Selection Overlay */}
                <Graphics draw={drawSelection} />

                {/* Players */}
                {Object.values(players).map((player) => (
                    <PlayerSprite
                        key={player.id}
                        player={player}
                        isMe={player.id === myId}
                        isHonking={!!honkingPlayers[player.id]}
                    />
                ))}
            </Container>
        </Stage>
    );
};

export default Arena;

