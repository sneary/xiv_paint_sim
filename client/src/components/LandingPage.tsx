import { useState } from 'react';
import './LandingPage.css';

interface LandingPageProps {
    onJoin: (name: string, color: number, role: 'tank' | 'healer' | 'dps') => void;
}

const COLORS = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffff00,
    0xff00ff, 0x00ffff, 0xffffff, 0xffaa00
];

const LandingPage = ({ onJoin }: LandingPageProps) => {
    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [selectedRole, setSelectedRole] = useState<'tank' | 'healer' | 'dps'>('dps');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onJoin(name, selectedColor, selectedRole);
        }
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
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter Name"
                                maxLength={12}
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Role (Main Color)</label>
                            <div className="role-selector" style={{ display: 'flex', gap: '10px' }}>
                                <div
                                    className={`role-option tank ${selectedRole === 'tank' ? 'selected' : ''}`}
                                    onClick={() => setSelectedRole('tank')}
                                >
                                    Tank
                                </div>
                                <div
                                    className={`role-option healer ${selectedRole === 'healer' ? 'selected' : ''}`}
                                    onClick={() => setSelectedRole('healer')}
                                >
                                    Healer
                                </div>
                                <div
                                    className={`role-option dps ${selectedRole === 'dps' ? 'selected' : ''}`}
                                    onClick={() => setSelectedRole('dps')}
                                >
                                    DPS
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Ring & Paint Color</label>
                            <div className="color-grid">
                                {COLORS.map(color => (
                                    <div
                                        key={color}
                                        onClick={() => setSelectedColor(color)}
                                        className={`color-option ${selectedColor === color ? 'selected' : ''}`}
                                        style={{
                                            backgroundColor: '#' + color.toString(16).padStart(6, '0'),
                                            color: '#' + color.toString(16).padStart(6, '0') // Used for glow effect
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            className="join-button"
                            type="submit"
                            disabled={!name.trim()}
                        >
                            Enter Duty
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
