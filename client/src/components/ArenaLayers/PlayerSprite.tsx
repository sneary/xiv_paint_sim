import { Container, Graphics, Text, Sprite } from '@pixi/react';
import * as PIXI from 'pixi.js';
import React, { useCallback } from 'react';
import type { Player } from '../../types';

interface PlayerSpriteProps {
    player: Player;
    isMe: boolean;
    isHonking: boolean;
}

const PlayerSprite = React.memo(({ player, isMe, isHonking }: PlayerSpriteProps) => {
    const isSpectator = player.role === 'spectator';

    const drawPlayer = useCallback((g: PIXI.Graphics) => {
        g.clear();

        // Role Colors
        const roleColors = {
            tank: 0x4a90e2,
            healer: 0x7ed321,
            dps: 0xd0021b
        };
        // @ts-ignore
        let baseColor = roleColors[player.role] || 0xd0021b;

        if (isHonking) {
            baseColor = 0xFFFFFF ^ baseColor;
        }

        g.beginFill(baseColor);
        g.drawCircle(0, 0, 10); // Player hitbox
        g.endFill();

        // Ring uses the player's selected paint color
        // Highlight 'me' with thicker stroke
        g.lineStyle(isMe ? 3 : 2, isHonking ? (0xFFFFFF ^ player.color) : player.color, 1);
        g.drawCircle(0, 0, 15);
    }, [player.role, player.color, isMe, isHonking]);



    // Optimization: Draw all debuffs in ONE Graphics call?
    // The original code used map -> Graphics. That's N Graphics objects. 
    // It's better to use ONE Graphics object for all debuffs if possible.
    // However, keeping layout logic simple is also good.
    // Let's stick to the structure but use useCallback where possible.

    const hasArrow = player.debuffs && player.debuffs.includes(99);

    const NEW_DEBUFFS = [
        { id: 101, img: '/assets/debuffs/debuff_1_I.png' },
        { id: 102, img: '/assets/debuffs/debuff_2_II.png' },
        { id: 103, img: '/assets/debuffs/debuff_3_III.png' },
        { id: 104, img: '/assets/debuffs/debuff_4_IV.png' },
        { id: 105, img: '/assets/debuffs/debuff_5_alpha.png' },
        { id: 106, img: '/assets/debuffs/debuff_6_beta.png' }
    ];

    return (
        <Container x={player.x} y={player.y}>
            {!isSpectator && (
                <Graphics draw={drawPlayer} />
            )}

            {/* Red Arrow Marker (Debuff 99) */}
            {hasArrow && (
                <Sprite
                    image="/red_arrow_down.svg"
                    anchor={0.5}
                    width={40}
                    height={40}
                    y={-50}
                    alpha={1}
                />
            )}

            {/* New Debuffs (101-106) */}
            {/* New Debuffs (101-106) */}
            <Container y={-65}>
                {(() => {
                    const activeNewDebuffs = player.debuffs
                        ? player.debuffs
                            .map(dId => NEW_DEBUFFS.find(d => d.id === dId))
                            .filter((d): d is typeof NEW_DEBUFFS[0] => !!d)
                        : [];

                    if (activeNewDebuffs.length === 0) return null;

                    const height = 32;
                    // We don't know the aspect ratio, but assuming roughly 1:1 or similar.
                    // Providing only height to Sprite should maintain aspect ratio if width is undefined?
                    // React-Pixi Sprite might default width to original if not provided? 
                    // Let's try passing ONLY height. If that fails, we might need a fixed width.
                    // The user said "maintain original proportions". 
                    // If we only set height, Pixi usually scales width proportionally.
                    // Let's assume a width of 32 for spacing calculations, even if actual width varies.
                    const spacing = 36;
                    const totalWidth = (activeNewDebuffs.length - 1) * spacing;
                    const startX = -totalWidth / 2;

                    return activeNewDebuffs.map((def, i) => (
                        <Sprite
                            key={def.id}
                            image={def.img}
                            anchor={0.5}
                            height={height}
                            // Do NOT set width to prevent stretching. 
                            // However, we need to ensure the anchor works correctly with scaling.
                            // If we don't set width, and the original is large, it might be huge but scaled down by height?
                            // Actually, if we set height, the scale.y is refined. If we don't set width, scale.x remains 1. 
                            // This would DISTORT the image (squash/stretch).
                            // To maintain aspect ratio in Pixi when setting one dimension, we typically need to set scale, not dimension.
                            // BUT, since we can't easily get the texture ratio here without loading it, 
                            // a common trick is to not set width/height but set scale. But we don't know the source size.
                            //
                            // WAIT: If we use the `scale` prop, we can set it to a fixed value.
                            // The cropped images are approx 78x95. 
                            // if we want height 32, scale should be ~0.33.
                            // Let's try using a fixed scale of 0.35 which should make them roughly 30px high.
                            scale={{ x: 0.35, y: 0.35 }}
                            x={startX + i * spacing}
                            y={0}
                            alpha={1}
                        />
                    ));
                })()}
            </Container>

            {/* Damage Debuff (Skull) (Debuff 1) */}
            {player.debuffs && player.debuffs.includes(1) && (
                <Text
                    text="☠️"
                    anchor={0.5}
                    x={0}
                    y={-40} // Position it slightly differently or overlapping? Arrow is -50.
                    style={new PIXI.TextStyle({
                        fontSize: 24,
                        fill: ['#ffffff'], // Not really used for emoji but good practice
                    })}
                />
            )}

            {/* Debuffs */}
            {player.debuffs && player.debuffs.length > 0 && (
                <Container x={0} y={isSpectator ? -20 : -45}>
                    <Graphics
                        draw={useCallback((g: PIXI.Graphics) => {
                            g.clear();
                            // Filter out 99 (Arrow), 1 (Skull), 2 (Invisible Vuln), and 101-106
                            const visibleDebuffs = player.debuffs.filter(d =>
                                d !== 99 && d !== 1 && d !== 2 && !(d >= 101 && d <= 106)
                            );
                            if (visibleDebuffs.length === 0) return;

                            const count = visibleDebuffs.length;
                            const spacing = 12;
                            const startX = -((count - 1) * spacing) / 2;

                            visibleDebuffs.forEach((colorVal, i) => {
                                let finalColor = typeof colorVal === 'number' ? colorVal : parseInt(colorVal as any, 16);
                                if (isNaN(finalColor)) finalColor = 0xFFFFFF;

                                g.beginFill(finalColor);
                                g.lineStyle(1, 0x000000);
                                g.drawCircle(startX + i * spacing, 0, 5);
                                g.endFill();
                            });
                        }, [player.debuffs])}
                    />
                </Container>
            )}

            {/* Limit Cut */}
            {player.limitCut && (
                <Container x={0} y={isSpectator ? -35 : -60}>
                    <Graphics
                        draw={useCallback((g: PIXI.Graphics) => {
                            g.clear();
                            const num = player.limitCut!;
                            const color = num % 2 === 1 ? 0x00B4FF : 0xFF6B4A;
                            const dotRadius = 3;
                            const sp = 8;
                            const drawDot = (x: number, y: number) => {
                                g.beginFill(color);
                                g.lineStyle(1, 0x000000);
                                g.drawCircle(x, y, dotRadius);
                                g.endFill();
                            };

                            switch (num) {
                                case 1: drawDot(0, 0); break;
                                case 2: drawDot(-sp / 2, 0); drawDot(sp / 2, 0); break;
                                case 3: drawDot(0, -sp / 2); drawDot(-sp / 2, sp / 2); drawDot(sp / 2, sp / 2); break;
                                case 4: drawDot(-sp / 2, -sp / 2); drawDot(sp / 2, -sp / 2); drawDot(-sp / 2, sp / 2); drawDot(sp / 2, sp / 2); break;
                                case 5: drawDot(-sp * 1.5, 0); drawDot(0, -sp / 2); drawDot(sp, -sp / 2); drawDot(0, sp / 2); drawDot(sp, sp / 2); break;
                                case 6: drawDot(-sp, -sp / 2); drawDot(-sp * 1.5, sp / 2); drawDot(-sp * 0.5, sp / 2); drawDot(sp * 0.5, -sp / 2); drawDot(sp * 1.5, -sp / 2); drawDot(sp, sp / 2); break;
                                case 7: drawDot(-sp * 1.5, -sp / 2); drawDot(-sp * 2, sp / 2); drawDot(-sp, sp / 2); drawDot(0, -sp / 2); drawDot(sp, -sp / 2); drawDot(0, sp / 2); drawDot(sp, sp / 2); break;
                                case 8: drawDot(-sp * 1.5, -sp / 2); drawDot(-sp / 2, -sp / 2); drawDot(sp / 2, -sp / 2); drawDot(sp * 1.5, -sp / 2); drawDot(-sp * 1.5, sp / 2); drawDot(-sp / 2, sp / 2); drawDot(sp / 2, sp / 2); drawDot(sp * 1.5, sp / 2); break;
                            }
                        }, [player.limitCut])}
                    />
                </Container>
            )}

            {player.name && (
                <Text
                    text={player.name}
                    anchor={0.5}
                    y={isSpectator ? 0 : -25}
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
}, (prev, next) => {
    // Custom comparison to ensure high performance
    // Only re-render if visible props change
    // Since 'player' is an object, we need to check its fields if identity differs
    if (prev.isMe !== next.isMe) return false;
    if (prev.isHonking !== next.isHonking) return false;

    const p1 = prev.player;
    const p2 = next.player;

    // Check fields that affect rendering
    if (p1.x !== p2.x || p1.y !== p2.y) return false;
    if (p1.color !== p2.color) return false;
    if (p1.role !== p2.role) return false;
    if (p1.name !== p2.name) return false;
    if (p1.limitCut !== p2.limitCut) return false;

    // Deep check debuffs array (assumed small)
    if (p1.debuffs !== p2.debuffs) {
        if (!p1.debuffs || !p2.debuffs) return false;
        if (p1.debuffs.length !== p2.debuffs.length) return false;
        for (let i = 0; i < p1.debuffs.length; i++) {
            if (p1.debuffs[i] !== p2.debuffs[i]) return false;
        }
    }

    return true;
});

export default PlayerSprite;
