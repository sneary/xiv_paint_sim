import { Graphics } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useCallback } from 'react';
import React from 'react';
import type { ArenaConfig } from '../../types';

interface GridLayerProps {
    config: ArenaConfig;
    width: number;
    height: number;
}

const GridLayer = React.memo(({ config, width, height }: GridLayerProps) => {
    const draw = useCallback((g: PIXI.Graphics) => {
        g.clear();

        const centerX = width / 2;
        const centerY = height / 2;

        // Draw Floor Boundary if needed (only if not using background image basically)
        // Original logic: g.lineStyle(2, 0x444444); ... drawCircle/Rect
        g.lineStyle(2, 0x444444);

        if (config.shape === 'circle') {
            g.drawCircle(centerX, centerY, config.width / 2);
        } else if (config.shape === 'square') {
            const halfW = config.width / 2;
            const halfH = config.height / 2;
            g.drawRect(centerX - halfW, centerY - halfH, config.width, config.height);
        }

        // Draw Grid
        if (config.showGrid) {
            g.lineStyle(1, 0xFFFFFF, 0.1); // Very faint white
            const step = 50;

            if (config.shape === 'none' || config.backgroundImageUrl) {
                // Full Canvas Grid
                for (let x = 0; x <= width; x += step) {
                    g.moveTo(x, 0);
                    g.lineTo(x, height);
                }
                for (let y = 0; y <= height; y += step) {
                    g.moveTo(0, y);
                    g.lineTo(width, y);
                }
            } else if (config.shape === 'square') {
                const halfW = config.width / 2;
                const halfH = config.height / 2;

                // Verticals (centered)
                for (let x = -halfW + step; x < halfW; x += step) {
                    g.moveTo(centerX + x, centerY - halfH);
                    g.lineTo(centerX + x, centerY + halfH);
                }
                // Horizontals (centered)
                for (let y = -halfH + step; y < halfH; y += step) {
                    g.moveTo(centerX - halfW, centerY + y);
                    g.lineTo(centerX + halfW, centerY + y);
                }
            } else {
                // Circle
                const r = config.width / 2;
                // Verticals
                for (let x = -r + step; x < r; x += step) {
                    const limit = Math.sqrt(r * r - x * x);
                    g.moveTo(centerX + x, centerY - limit);
                    g.lineTo(centerX + x, centerY + limit);
                }
                // Horizontals
                for (let y = -r + step; y < r; y += step) {
                    const limit = Math.sqrt(r * r - y * y);
                    g.moveTo(centerX - limit, centerY + y);
                    g.lineTo(centerX + limit, centerY + y);
                }
            }
        }
    }, [config, width, height]);

    return <Graphics draw={draw} />;
});

export default GridLayer;
