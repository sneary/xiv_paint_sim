import type { ArenaConfig } from '../types';

interface ConfigMenuProps {
    config: ArenaConfig;
    onUpdate: (newConfig: Partial<ArenaConfig>) => void;
    onSetDebuffs: () => void;
    onClearDebuffs: () => void;
    onLimitCut: () => void;
    onClearLimitCut: () => void;
    onCountdown: () => void;
    onClose?: () => void;
}

const ConfigMenu = ({ config, onUpdate, onSetDebuffs, onClearDebuffs, onLimitCut, onClearLimitCut, onCountdown, onClose }: ConfigMenuProps) => {
    return (
        <div style={{
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #444',
            zIndex: 100,
            color: '#eee',
            fontFamily: 'sans-serif',
            minWidth: '200px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>Arena Config</h3>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '20px', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    >
                        ×
                    </button>
                )}
            </div>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ marginRight: '10px' }}>Shape:</label>
                <select
                    value={config.shape}
                    onChange={(e) => onUpdate({ shape: e.target.value as 'circle' | 'square' | 'none' })}
                    style={{ padding: '4px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555' }}
                >
                    <option value="circle">Circle</option>
                    <option value="square">Square</option>
                    <option value="none">None</option>
                </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ marginRight: '10px' }}>Waymarks:</label>
                <select
                    value={config.waymarkPreset || 'custom'}
                    onChange={(e) => onUpdate({ waymarkPreset: e.target.value })}
                    style={{ padding: '4px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555' }}
                >
                    <option value="custom">Custom</option>
                    <option value="waymarks-1">Waymarks 1</option>
                    <option value="waymarks-2">Waymarks 2</option>
                    <option value="waymarks-3">Waymarks 3</option>
                    <option value="waymarks-4">Waymarks 4</option>
                </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={!!config.showGrid}
                        onChange={(e) => onUpdate({ showGrid: e.target.checked })}
                        style={{ marginRight: '10px' }}
                    />
                    Show Gridlines
                </label>
            </div>

            {/* Mute Honks moved to main UI */}

            <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '15px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <button
                    onClick={onSetDebuffs}
                    style={{
                        background: '#333',
                        border: '1px solid #555',
                        color: '#eee',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '12px',
                        height: '32px', // Fixed height
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    Set Debuffs
                </button>
                <button
                    onClick={onClearDebuffs}
                    style={{
                        background: '#d9534f',
                        border: '1px solid #d43f3a',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '12px',
                        height: '32px', // Fixed height
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    Clear Debuffs
                </button>
                <button
                    onClick={onLimitCut}
                    style={{
                        background: '#5bc0de',
                        border: '1px solid #46b8da',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '12px',
                        height: '32px', // Fixed height
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    Limit Cut
                </button>
                <button
                    onClick={onClearLimitCut}
                    style={{
                        background: '#d9534f',
                        border: '1px solid #d43f3a',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '12px',
                        height: '32px', // Fixed height
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    Clear LC
                </button>
                <button
                    onClick={() => onCountdown && onCountdown()}
                    style={{
                        gridColumn: 'span 2',
                        background: 'rgba(255, 215, 0, 0.1)',
                        border: '1px solid #FFD700',
                        color: '#FFD700',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '12px',
                        height: '32px', // Fixed height
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold'
                    }}
                >
                    Countdown (3s)
                </button>
            </div>
        </div >
    );
};

export default ConfigMenu;

