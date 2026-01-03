import React from 'react';

interface WaymarkMenuProps {
    activeMarker: string | null;
    onSelect: (marker: string | null) => void;
    onClearAll: () => void;
}

const MARKERS = ['A', 'B', 'C', 'D', '1', '2', '3', '4'];

const WaymarkMenu: React.FC<WaymarkMenuProps> = ({ activeMarker, onSelect, onClearAll }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            background: 'rgba(20, 20, 20, 0.9)',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #444',
            marginTop: '10px'
        }}>
            <div style={{ fontSize: '12px', color: '#aaa', textAlign: 'center' }}>Waymarks</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {MARKERS.map(m => {
                    const isSelected = activeMarker === m;

                    return (
                        <button
                            key={m}
                            onClick={() => onSelect(isSelected ? null : m)} // Toggle
                            style={{
                                width: '36px',
                                height: '36px',
                                background: isSelected ? 'rgba(255,255,255,0.2)' : 'transparent',
                                border: isSelected ? '1px solid white' : '1px solid #555',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.1s',
                                padding: '2px'
                            }}
                        >
                            <img
                                src={`/waymarks/${m}.png`}
                                alt={m}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    filter: isSelected ? 'drop-shadow(0 0 4px white)' : 'none'
                                }}
                            />
                        </button>
                    );
                })}
            </div>

            <button
                onClick={onClearAll}
                style={{
                    background: '#d9534f',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    padding: '4px',
                    fontSize: '11px',
                    cursor: 'pointer'
                }}
            >
                Clear All
            </button>
        </div>
    );
};

export default WaymarkMenu;
