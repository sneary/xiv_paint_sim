import { useState } from 'react';
import './LandingPage.css';

interface LandingPageProps {
    onJoin: (data: { action: 'create' | 'join', roomId?: string, name: string, color: number, role: 'tank' | 'healer' | 'dps' | 'spectator' }) => void;
}

const COLORS = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffff00,
    0xff00ff, 0x00ffff, 0xffffff, 0xCC5500
];

const LandingPage = ({ onJoin }: LandingPageProps) => {

    const [mode, setMode] = useState<'create' | 'join'>('create');
    const [roomId, setRoomId] = useState('');
    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [selectedRole, setSelectedRole] = useState<'tank' | 'healer' | 'dps' | 'spectator'>('dps');
    const [error, setError] = useState('');

    const isSpectator = selectedRole === 'spectator';

    // Auto-select logic removed as we don't have takenColors yet

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) return;

        // BasicClient-side validation (Server does authoritative check)
        if (mode === 'join' && !roomId.trim()) {
            setError('Please enter a Room Code.');
            return;
        }

        if (mode === 'join' && roomId.length !== 4) {
            setError('Room Code must be 4 characters.');
            return;
        }

        // Note: We can't strictly check isNameTaken/isColorTaken here for 'join' 
        // because existing players list might be from a different room context 
        // (or global logic if not yet updated). 
        // Ideally, LandingPage shouldn't show takenNames/Colors until connected to a room?
        // Actually, with the new architecture, we don't know who is in the target room until we try to join.
        // So we will rely on server 'joinError' response instead of pre-emptive check for 'join' mode.
        // For 'create', it's a new room so it's always empty.

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
                            />
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
                                        return (
                                            <div
                                                key={color}
                                                onClick={() => setSelectedColor(color)}
                                                className={`color-option ${selectedColor === color ? 'selected' : ''}`}
                                                style={{
                                                    backgroundColor: '#' + color.toString(16).padStart(6, '0'),
                                                    color: '#' + color.toString(16).padStart(6, '0'),
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {error && <div style={{ color: '#ff4444', marginBottom: '10px', textAlign: 'center' }}>{error}</div>}

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
