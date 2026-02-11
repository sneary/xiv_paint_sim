import { useState } from 'react';
import type { ArenaConfig, SimulationState } from '../types';

interface ConfigMenuProps {
    config: ArenaConfig;
    onUpdate: (newConfig: Partial<ArenaConfig>) => void;
    onSetDebuffs: () => void;
    onClearDebuffs: () => void;
    onLimitCut: () => void;
    onClearLimitCut: () => void;
    onCountdown: () => void;
    onClose?: () => void;
    // Simulation
    onStartSim: (timelineId: string) => void;
    onStopSim: () => void;
    onResetSim: () => void;
    simState?: SimulationState;
    onGrotesquerieAct2: () => void;
}

const ConfigMenu = ({ config, onUpdate, onSetDebuffs, onClearDebuffs, onLimitCut, onClearLimitCut, onCountdown, onClose, onStartSim, onStopSim, onResetSim, simState, onGrotesquerieAct2 }: ConfigMenuProps) => {
    // Local state for selected timeline
    const [selectedTimeline, setSelectedTimeline] = useState('arena_split');

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
                    <option value="arena-split-outer">Arena Split Outer Markers</option>
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
                        background: '#f0ad4e',
                        border: '1px solid #eea236',
                        color: 'white',
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
                    Countdown
                </button>
                <button
                    onClick={onGrotesquerieAct2}
                    style={{
                        gridColumn: 'span 2',
                        background: '#444',
                        border: '1px solid #666',
                        color: '#eee',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '12px',
                        height: '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    Grotesquerie: Act 2
                </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '15px 0' }} />

            <div style={{ marginBottom: '10px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#aaa' }}>Mechanic Sim</h4>
                <div style={{ marginBottom: '10px' }}>
                    <label style={{ marginRight: '10px', fontSize: '12px' }}>Timeline:</label>
                    <select
                        value={selectedTimeline}
                        onChange={(e) => setSelectedTimeline(e.target.value)}
                        style={{ padding: '4px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555', width: '100%' }}
                    >

                        <option value="arena_split">Arena Split</option>
                    </select>
                </div>
                {simState?.isRunning ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={onStopSim}
                            style={{
                                flex: 2,
                                background: '#d9534f',
                                border: '1px solid #d43f3a',
                                color: 'white',
                                padding: '5px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            Stop
                        </button>
                        <button
                            onClick={onResetSim}
                            style={{
                                flex: 1,
                                background: '#f0ad4e',
                                border: '1px solid #eea236',
                                color: 'white',
                                padding: '5px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            Reset
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => onStartSim(selectedTimeline)}
                            style={{
                                flex: 1,
                                background: '#5cb85c',
                                border: '1px solid #4cae4c',
                                color: 'white',
                                padding: '5px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            Play
                        </button>
                        <button
                            onClick={onResetSim}
                            style={{
                                flex: 1,
                                background: '#777',
                                border: '1px solid #555',
                                color: '#ccc',
                                padding: '5px',
                                borderRadius: '4px',
                                cursor: 'pointer', // Allowed to reset to clear clutter
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            Reset
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
};

export default ConfigMenu;

