import React, { useMemo } from 'react';
import type { Player } from '../types';

interface PartyListProps {
    players: Record<string, Player>;
    myId: string | null;
}

const ROLE_PRIORITY: Record<string, number> = {
    tank: 1,
    healer: 2,
    dps: 3,
    spectator: 4
};

const ROLE_COLORS: Record<string, string> = {
    tank: '#4a90e2',   // Blue
    healer: '#7ed321', // Green
    dps: '#d0021b',    // Red
    spectator: '#888'  // Grey
};

const PartyList: React.FC<PartyListProps> = ({ players, myId }) => {
    const sortedPlayers = useMemo(() => {
        const list = Object.values(players);

        return list.sort((a, b) => {
            // 1. "Me" at the top
            if (a.id === myId) return -1;
            if (b.id === myId) return 1;

            // 2. Role Priority
            const priorityA = ROLE_PRIORITY[a.role] || 99;
            const priorityB = ROLE_PRIORITY[b.role] || 99;

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            // 3. Name Alphabetical
            return a.name.localeCompare(b.name);
        });
    }, [players, myId]);

    if (sortedPlayers.length === 0) return null;

    return (
        <div style={{
            position: 'absolute',
            // Positioned below standard top-left/right elements, 
            // or we can put it Top-Left but offset by some amount if needed.
            // Let's try Top-Left slightly offset to not cover config instructions if they exist,
            // But standard HUD is top-left. Let's put it below the Config button area.
            top: 150,
            left: 20,
            width: '200px',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '5px',
            padding: '5px',
            pointerEvents: 'none', // Allow clicking through to arena if needed (though usually HUD blocks)
            zIndex: 90, // Below overlays like config menu
            color: 'white',
            fontFamily: "'Outfit', sans-serif",
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
        }}>
            <div style={{
                fontSize: '12px',
                color: '#aaa',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '2px',
                paddingLeft: '4px'
            }}>
                Party ({sortedPlayers.length})
            </div>

            {sortedPlayers.map(player => {
                const isMe = player.id === myId;
                return (
                    <div
                        key={player.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: isMe ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                            padding: '4px',
                            borderRadius: '3px',
                            borderLeft: `3px solid ${ROLE_COLORS[player.role] || '#fff'}`
                        }}
                    >
                        {/* Simple Role Indicator Icon could go here, for now just Color Bar */}

                        <span style={{
                            fontWeight: isMe ? 600 : 400,
                            flex: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: isMe ? '#fff' : '#ddd',
                            fontSize: '14px'
                        }}>
                            {player.name}
                        </span>

                        {/* Role Text (Optional, maybe for clarity) */}
                        <span style={{
                            fontSize: '10px',
                            color: ROLE_COLORS[player.role] || '#888',
                            marginLeft: '8px',
                            textTransform: 'uppercase'
                        }}>
                            {player.role.substring(0, 3)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default PartyList;
