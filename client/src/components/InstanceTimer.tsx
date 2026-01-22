
import React, { useEffect, useState } from 'react';

interface InstanceTimerProps {
    expiresAt?: number;
}

const InstanceTimer: React.FC<InstanceTimerProps> = ({ expiresAt }) => {
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        if (!expiresAt) return;

        const updateTimer = () => {
            const now = Date.now();
            const diff = expiresAt - now;

            if (diff <= 0) {
                setTimeLeft('00:00:00');
                return;
            }

            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);

            const hStr = h < 10 ? `0${h}` : h;
            const mStr = m < 10 ? `0${m}` : m;
            const sStr = s < 10 ? `0${s}` : s;

            setTimeLeft(`${hStr}:${mStr}:${sStr}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [expiresAt]);

    if (!expiresAt || !timeLeft) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '5px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 1000,
            pointerEvents: 'none'
        }}>
            Instance Time: {timeLeft}
        </div>
    );
};

export default InstanceTimer;
