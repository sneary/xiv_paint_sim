import type { ArenaConfig } from '../types';

interface ConfigMenuProps {
    config: ArenaConfig;
    onUpdate: (newConfig: Partial<ArenaConfig>) => void;
}

const ConfigMenu = ({ config, onUpdate }: ConfigMenuProps) => {
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

            <div>
                {config.shape === 'circle' ? (
                    // Maybe add diameter slider in future
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Radius: {config.width / 2}</div>
                ) : (
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Size: {config.width}x{config.height}</div>
                )}
            </div>
        </div>
    );
};

export default ConfigMenu;
