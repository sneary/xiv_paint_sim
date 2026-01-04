import React, { useState } from 'react';

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div style={{
            background: 'rgba(40, 40, 40, 0.95)',
            borderRadius: '6px',
            border: '1px solid #555',
            overflow: 'hidden',
            marginBottom: '5px'
        }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '8px 10px',
                    background: '#333',
                    color: '#eee',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'sans-serif'
                }}
            >
                <span>{title}</span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }}
                    style={{
                        background: '#555',
                        border: '1px solid #777',
                        borderRadius: '3px',
                        color: 'white',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        lineHeight: '1',
                        fontSize: '14px'
                    }}
                >
                    {isOpen ? '−' : '+'}
                </button>
            </div>
            {isOpen && (
                <div style={{ padding: '10px' }}>
                    {children}
                </div>
            )}
        </div>
    );
};

export default CollapsibleSection;
