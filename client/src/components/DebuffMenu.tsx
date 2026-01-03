import React, { useState } from 'react';
import type { Player } from '../types';

interface DebuffMenuProps {
    players: Record<string, Player>;
    onApply: (debuffUpdates: Record<string, number[]>, limitCutUpdates: Record<string, number | undefined>, useCountdown: boolean) => void;
    onClose: () => void;
}

// 8 Distinct Colors for Debuffs
const DEBUFF_COLORS = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffff00,
    0xff00ff, 0x00ffff, 0xffffff, 0xFFA500 // Orange
];

const DebuffMenu: React.FC<DebuffMenuProps> = ({ players, onApply, onClose }) => {
    // Local state to track changes before applying
    const [localDebuffs, setLocalDebuffs] = useState<Record<string, number[]>>(() => {
        const initial: Record<string, number[]> = {};
        Object.values(players).forEach(p => {
            initial[p.id] = p.debuffs || [];
        });
        return initial;
    });

    const [localLimitCuts, setLocalLimitCuts] = useState<Record<string, number | undefined>>(() => {
        const initial: Record<string, number | undefined> = {};
        Object.values(players).forEach(p => {
            initial[p.id] = p.limitCut;
        });
        return initial;
    });

    const toggleDebuff = (playerId: string, color: number) => {
        setLocalDebuffs(prev => {
            const current = prev[playerId] || [];
            if (current.includes(color)) {
                return { ...prev, [playerId]: current.filter(c => c !== color) };
            } else {
                return { ...prev, [playerId]: [...current, color] };
            }
        });
    };

    const handleLimitCutChange = (playerId: string, val: string) => {
        const num = val === "" ? undefined : parseInt(val);
        setLocalLimitCuts(prev => ({ ...prev, [playerId]: num }));
    };

    const handleConfirm = (useCountdown: boolean) => {
        onApply(localDebuffs, localLimitCuts, useCountdown);
        onClose();
    };

    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(20, 20, 20, 0.95)',
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '20px',
            zIndex: 300,
            color: 'white',
            fontFamily: "'Outfit', sans-serif",
            minWidth: '550px',
            maxWidth: '90vw',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', textAlign: 'center' }}>Set Debuffs & Limit Cuts</h2>

            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {Object.values(players).map(player => (
                    <div key={player.id} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #333' }}>
                        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>{player.name}</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Limit Cuts Row */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.8em', color: '#aaa', minWidth: '60px' }}>Limit Cut:</span>
                                {/* Clear Button (0) */}
                                <div
                                    onClick={() => handleLimitCutChange(player.id, "")}
                                    style={{
                                        width: '24px', height: '24px',
                                        borderRadius: '4px',
                                        border: localLimitCuts[player.id] === undefined ? '2px solid white' : '1px solid #555',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: '#aaa', fontSize: '12px'
                                    }}
                                >
                                    None
                                </div>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                    <div
                                        key={n}
                                        onClick={() => handleLimitCutChange(player.id, n.toString())}
                                        style={{
                                            width: '32px', height: '24px',
                                            borderRadius: '4px',
                                            border: localLimitCuts[player.id] === n ? '2px solid white' : '1px solid #333',
                                            background: '#222',
                                            cursor: 'pointer',
                                            padding: '2px'
                                        }}
                                        title={`Limit Cut ${n}`}
                                    >
                                        <LimitCutSVG number={n} />
                                    </div>
                                ))}
                            </div>

                            {/* Debuffs Row */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.8em', color: '#aaa', minWidth: '60px' }}>Debuffs:</span>
                                {DEBUFF_COLORS.map(color => {
                                    const isSelected = (localDebuffs[player.id]?.includes(color));
                                    return (
                                        <div
                                            key={color}
                                            onClick={() => toggleDebuff(player.id, color)}
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                backgroundColor: '#' + color.toString(16).padStart(6, '0'),
                                                border: isSelected ? '2px solid white' : '2px solid transparent',
                                                opacity: isSelected ? 1 : 0.4,
                                                cursor: 'pointer',
                                                transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                                                transition: 'all 0.1s'
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                    onClick={onClose}
                    style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        border: '1px solid #666',
                        color: '#aaa',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Cancel
                </button>
                <div style={{ flex: 1 }}></div>

                <button
                    onClick={() => handleConfirm(false)}
                    style={{
                        padding: '8px 16px',
                        background: '#e67e22',
                        border: 'none',
                        color: 'white',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Instant
                </button>
                <button
                    onClick={() => handleConfirm(true)}
                    style={{
                        padding: '8px 16px',
                        background: '#4a90e2',
                        border: 'none',
                        color: 'white',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Countdown
                </button>
            </div>
        </div>
    );
};

// Helper to render Limit Cut patterns as SVG
const LimitCutSVG: React.FC<{ number: number }> = ({ number }) => {
    const color = number % 2 === 1 ? '#00B4FF' : '#FF6B4A';
    const r = 3.5; // radius
    const sp = 9; // spacing

    // Same patterns as Arena.tsx but mapped to SVG coords
    // ViewBox centered at 0,0 for convenience, we translate in group
    // Let's use a fixed viewBox 0 0 50 25 and center everything manually?
    // Or allow negative coords.

    let dots: { x: number, y: number }[] = [];

    switch (number) {
        case 1:
            dots = [{ x: 0, y: 0 }];
            break;
        case 2:
            dots = [{ x: -sp / 2, y: 0 }, { x: sp / 2, y: 0 }];
            break;
        case 3: // 1 top, 2 bot (triangle)
            dots = [{ x: 0, y: -sp / 2 }, { x: -sp / 2, y: sp / 2 }, { x: sp / 2, y: sp / 2 }];
            break;
        case 4: // 2x2
            dots = [
                { x: -sp / 2, y: -sp / 2 }, { x: sp / 2, y: -sp / 2 },
                { x: -sp / 2, y: sp / 2 }, { x: sp / 2, y: sp / 2 }
            ];
            break;
        case 5: // 1 left, 2x2 right
            // Arena: -sp*1.5 (left), then 2x2 centered at x=+sp/2?
            // Arena code: 
            // drawDot(-sp * 1.5, 0); // single dot left
            // 2x2 square to the right: (0, -sp/2), (sp, -sp/2)...
            // Let's center this whole group roughly. 
            // The group width is roughly from -1.5sp to +sp = 2.5sp width?
            // To center visualy, we might need a slight offset.
            dots = [
                { x: -sp * 1.5, y: 0 },
                { x: 0, y: -sp / 2 }, { x: sp, y: -sp / 2 },
                { x: 0, y: sp / 2 }, { x: sp, y: sp / 2 }
            ];
            break;
        case 6: // Triangle Left + Inverted Triangle Right
            // Arena: Left (-sp, -sp/2)... Right ...
            // Let's copy exact logic
            dots = [
                // Left Triangle (1 top, 2 bot)
                { x: -sp, y: -sp / 2 }, { x: -sp * 1.5, y: sp / 2 }, { x: -sp * 0.5, y: sp / 2 },
                // Right Inverted (2 top, 1 bot)
                { x: sp * 0.5, y: -sp / 2 }, { x: sp * 1.5, y: -sp / 2 }, { x: sp, y: sp / 2 }
            ];
            break;
        case 7: // Triangle Left + Square Right
            dots = [
                // Left Triangle
                { x: -sp * 1.5, y: -sp / 2 }, { x: -sp * 2, y: sp / 2 }, { x: -sp, y: sp / 2 },
                // Right Square (2x2)
                { x: 0, y: -sp / 2 }, { x: sp, y: -sp / 2 },
                { x: 0, y: sp / 2 }, { x: sp, y: sp / 2 }
            ];
            break;
        case 8: // 2 rows of 4
            dots = [
                { x: -sp * 1.5, y: -sp / 2 }, { x: -sp / 2, y: -sp / 2 }, { x: sp / 2, y: -sp / 2 }, { x: sp * 1.5, y: -sp / 2 },
                { x: -sp * 1.5, y: sp / 2 }, { x: -sp / 2, y: sp / 2 }, { x: sp / 2, y: sp / 2 }, { x: sp * 1.5, y: sp / 2 }
            ];
            break;
    }

    return (
        <svg width="100%" height="100%" viewBox="-25 -15 50 30" style={{ display: 'block' }}>
            {dots.map((d, i) => (
                <circle key={i} cx={d.x} cy={d.y} r={r} fill={color} stroke="black" strokeWidth="0.5" />
            ))}
        </svg>
    );
};

export default DebuffMenu;
