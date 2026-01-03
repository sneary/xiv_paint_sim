import type { ArenaConfig } from '../types';

interface ConfigMenuProps {
    config: ArenaConfig;
    onUpdate: (newConfig: Partial<ArenaConfig>) => void;
    onSetDebuffs: () => void;
    onClearDebuffs: () => void;
}

const ConfigMenu = ({ config, onUpdate, onSetDebuffs, onClearDebuffs }: ConfigMenuProps) => {
    return (
        <div style={{
            backgroundColor: 'rgba(30, 30, 30, 0.9)',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #444',
            zIndex: 100,
            color: '#eee',
            fontFamily: 'sans-serif'
        }}>
            <h3 style={{ margin: '0 0 10px' }}>Arena Config</h3>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ marginRight: '10px' }}>Shape:</label>
                <select
                    value={config.shape}
                    onChange={(e) => onUpdate({ shape: e.target.value as 'circle' | 'square' })}
                    style={{ padding: '4px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555' }}
                >
                    <option value="circle">Circle</option>
                    <option value="square">Square</option>
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

            <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '15px 0' }} />

            <div style={{ display: 'flex', gap: '10px' }}>
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
                        flex: 1
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
                        flex: 1
                    }}
                >
                    Clear Debuffs
                </button>
            </div>
        </div>
    );
};

export default ConfigMenu;
