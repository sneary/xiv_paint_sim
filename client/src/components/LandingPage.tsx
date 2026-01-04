import { useState, useEffect } from 'react';
import './LandingPage.css';

interface LandingPageProps {
    onJoin: (data: { action: 'create' | 'join', roomId?: string, name: string, color: number, role: 'tank' | 'healer' | 'dps' | 'spectator' }) => void;
    onCheckRoom: (roomId: string) => Promise<{ exists: boolean, takenNames: string[], takenColors: number[] }>;
}

const COLORS = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffff00,
    0xff00ff, 0x00ffff, 0xffffff, 0xCC5500
];

const LandingPage = ({ onJoin, onCheckRoom }: LandingPageProps) => {

    const [mode, setMode] = useState<'create' | 'join'>('create');
    const [roomId, setRoomId] = useState('');
    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [selectedRole, setSelectedRole] = useState<'tank' | 'healer' | 'dps' | 'spectator'>('dps');
    const [error, setError] = useState('');

    // Validation State
    const [takenColors, setTakenColors] = useState<number[]>([]);
    const [takenNames, setTakenNames] = useState<string[]>([]);
    const [roomExists, setRoomExists] = useState<boolean | null>(null);

    const isSpectator = selectedRole === 'spectator';

    // Auto-select logic removed as we don't have takenColors yet

    // Check room when ID changes
    useEffect(() => {
        if (mode === 'join' && roomId.length === 4) {
            onCheckRoom(roomId).then(data => {
                if (!data.exists) {
                    setRoomExists(false);
                    setError('Room not found');
                } else {
                    setRoomExists(true);
                    setTakenNames(data.takenNames);
                    setTakenColors(data.takenColors);
                    setError('');
                }
            });
        } else {
            setRoomExists(null);
            setTakenColors([]);
            setTakenNames([]);
        }
    }, [roomId, mode, onCheckRoom]);

    // Auto-select available color if current is taken
    useEffect(() => {
        if (mode === 'join' && takenColors.length > 0) {
            if (takenColors.includes(selectedColor)) {
                const available = COLORS.find(c => !takenColors.includes(c));
                if (available !== undefined) {
                    setSelectedColor(available);
                }
            }
        }
    }, [takenColors, mode, selectedColor]);

    // Real-time Name Validation
    useEffect(() => {
        if (mode === 'join' && name.trim()) {
            const nameConflict = takenNames.some(n => n.toLowerCase() === name.trim().toLowerCase());
            if (nameConflict) {
                setError('Name is taken.');
            } else {
                // Only clear error if it was a name error
                setError(prev => prev === 'Name is taken.' ? '' : prev);
            }
        }
    }, [name, takenNames, mode]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) return;

        // Basic Client-side validation
        if (mode === 'join') {
            if (!roomId.trim()) {
                setError('Please enter a Room Code.');
                return;
            }
            if (roomId.length !== 4) {
                setError('Room Code must be 4 characters.');
                return;
            }
            if (roomExists === false) {
                setError('Room not found');
                return;
            }
            const nameConflict = takenNames.some(n => n.toLowerCase() === name.trim().toLowerCase());
            if (nameConflict) {
                setError('Name is taken.');
                return;
            }

            if (selectedRole !== 'spectator') {
                if (takenColors.includes(selectedColor)) {
                    setError('Color is taken.');
                    return;
                }
            }
        }

        onJoin({
            action: mode,
            roomId: mode === 'join' ? roomId : undefined,
            name: name,
            color: selectedColor,
            role: selectedRole
        });
    };

    return (
        <div className="landing-container">
            <div className="landing-content">
                <div className="title-group">
                    <h1 className="main-title">FFXIV MSPaint Sim</h1>
                    <div className="subtitle">Mechanic Training Arena</div>
                </div>

                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '10px' }}>
                        <button
                            onClick={() => setMode('create')}
                            style={{
                                background: mode === 'create' ? '#e67e22' : 'transparent',
                                border: '1px solid #e67e22',
                                color: 'white',
                                padding: '8px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Host New Room
                        </button>
                        <button
                            onClick={() => setMode('join')}
                            style={{
                                background: mode === 'join' ? '#4a90e2' : 'transparent',
                                border: '1px solid #4a90e2',
                                color: 'white',
                                padding: '8px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Join Room
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'contents' }}>

                        {mode === 'join' && (
                            <div className="form-group">
                                <label className="form-label">Room Code</label>
                                <input
                                    className="input-field"
                                    type="text"
                                    value={roomId}
                                    onChange={(e) => {
                                        setRoomId(e.target.value.toUpperCase());
                                        setError('');
                                    }}
                                    placeholder="ABCD"
                                    maxLength={4}
                                    style={{ textAlign: 'center', letterSpacing: '4px', fontFamily: 'monospace' }}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Character Name</label>
                            <input
                                className="input-field"
                                type="text"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    setError('');
                                }}
                                placeholder="Enter Name"
                                maxLength={12}
                                autoFocus
                                style={{
                                    borderColor: error === 'Name is taken.' ? '#ff4444' : undefined
                                }}
                            />
                            {error === 'Name is taken.' && (
                                <div style={{ color: '#ff4444', fontSize: '0.85rem', marginTop: '4px' }}>
                                    Name is already taken in this room.
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Role</label>
                            <div className="role-selector" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <div
                                    className={`role-option tank ${selectedRole === 'tank' ? 'selected' : ''}`}
                                    onClick={() => setSelectedRole('tank')}
                                >Tank</div>
                                <div
                                    className={`role-option healer ${selectedRole === 'healer' ? 'selected' : ''}`}
                                    onClick={() => setSelectedRole('healer')}
                                >Healer</div>
                                <div
                                    className={`role-option dps ${selectedRole === 'dps' ? 'selected' : ''}`}
                                    onClick={() => setSelectedRole('dps')}
                                >DPS</div>
                            </div>
                            {/* Spectator Button - Smaller/Separate */}
                            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center' }}>
                                <div
                                    className={`role-option spectator ${selectedRole === 'spectator' ? 'selected' : ''}`}
                                    onClick={() => setSelectedRole('spectator')}
                                    style={{ flex: '0 0 auto', padding: '5px 15px', fontSize: '0.9rem', opacity: 0.8 }}
                                >
                                    👁 Spectator (No Slot)
                                </div>
                            </div>
                        </div>

                        {!isSpectator && (
                            <div className="form-group">
                                <label className="form-label">Ring & Paint Color</label>
                                <div className="color-grid">
                                    {COLORS.map(color => {
                                        const isTaken = mode === 'join' && takenColors.includes(color);
                                        return (
                                            <div
                                                key={color}
                                                onClick={() => !isTaken && setSelectedColor(color)}
                                                className={`color-option ${selectedColor === color ? 'selected' : ''} ${isTaken ? 'taken' : ''}`}
                                                style={{
                                                    backgroundColor: '#' + color.toString(16).padStart(6, '0'),
                                                    color: '#' + color.toString(16).padStart(6, '0'),
                                                    opacity: isTaken ? 0.3 : 1,
                                                    cursor: isTaken ? 'not-allowed' : 'pointer',
                                                    position: 'relative'
                                                }}
                                            >
                                                {isTaken && <div style={{
                                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'white', fontWeight: 'bold', fontSize: '20px', textShadow: '0 0 2px black'
                                                }}>×</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {error && error !== 'Name is taken.' && (
                            <div style={{ color: '#ff4444', marginBottom: '10px', textAlign: 'center' }}>{error}</div>
                        )}

                        <button
                            className="join-button"
                            type="submit"
                            disabled={!name.trim() || (mode === 'join' && roomId.length !== 4)}
                        >
                            {isSpectator ? 'Watch Game' : (mode === 'create' ? 'Create Room' : 'Join Room')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
