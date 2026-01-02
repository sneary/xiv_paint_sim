import { useState } from 'react';
import './LandingPage.css';

interface LandingPageProps {
    onJoin: (name: string, color: number, role: 'tank' | 'healer' | 'dps' | 'spectator') => void;
    takenNames: string[];
    takenColors: number[];
}

const COLORS = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffff00,
    0xff00ff, 0x00ffff, 0xffffff, 0xCC5500
];

const LandingPage = ({ onJoin, takenNames, takenColors }: LandingPageProps) => {
    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [selectedRole, setSelectedRole] = useState<'tank' | 'healer' | 'dps' | 'spectator'>('dps');
    const [error, setError] = useState('');

    const isNameTaken = (n: string) => takenNames.some(taken => taken.toLowerCase() === n.toLowerCase());
    const isColorTaken = (c: number) => takenColors.includes(c);
    const isSpectator = selectedRole === 'spectator';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) return;
        if (isNameTaken(name)) {
            setError('Name is already taken.');
            return;
        }
        if (!isSpectator && isColorTaken(selectedColor)) {
            setError('Color is already taken.');
            return;
        }

        onJoin(name, selectedColor, selectedRole);
    };

    return (
        <div className="landing-container">
            <div className="landing-content">
                <div className="title-group">
                    <h1 className="main-title">FFXIV MSPaint Sim</h1>
                    <div className="subtitle">Mechanic Training Arena</div>
                </div>

                <div className="glass-card">
                    <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
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
                                style={{ borderColor: isNameTaken(name) ? '#ff4444' : '' }}
                            />
                            {isNameTaken(name) && <div style={{ color: '#ff4444', fontSize: '0.8rem', marginTop: '4px' }}>Name taken</div>}
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
                                        const taken = isColorTaken(color);
                                        return (
                                            <div
                                                key={color}
                                                onClick={() => !taken && setSelectedColor(color)}
                                                className={`color-option ${selectedColor === color ? 'selected' : ''} ${taken ? 'disabled' : ''}`}
                                                style={{
                                                    backgroundColor: '#' + color.toString(16).padStart(6, '0'),
                                                    color: '#' + color.toString(16).padStart(6, '0'),
                                                    opacity: taken ? 0.2 : 1,
                                                    cursor: taken ? 'not-allowed' : 'pointer'
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
                            disabled={!name.trim() || isNameTaken(name) || (!isSpectator && isColorTaken(selectedColor))}
                        >
                            {isSpectator ? 'Watch Game' : 'Enter Duty'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
