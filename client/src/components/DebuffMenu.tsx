import React, { useState } from 'react';
import type { Player } from '../types';

interface DebuffMenuProps {
    players: Record<string, Player>;
    onApply: (updates: Record<string, number[]>, useCountdown: boolean) => void;
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

    const handleConfirm = (useCountdown: boolean) => {
        onApply(localDebuffs, useCountdown);
        onClose();
    };

    return (
        <div style={{
            position: 'absolute',
            // ... (omitting middle lines using existing context if possible, but replace_file_content works on contiguous blocks. 
            // I will replace the button section at the bottom)
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
            minWidth: '350px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', textAlign: 'center' }}>Set Debuffs</h2>

            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {Object.values(players).map(player => (
                    <div key={player.id} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #333' }}>
                        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>{player.name}</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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

export default DebuffMenu;
