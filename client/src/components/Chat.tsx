import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

interface ChatProps {
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
    isMobile: boolean;
}

const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, isMobile }) => {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (inputValue.trim()) {
            onSendMessage(inputValue);
            setInputValue('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent bubbling if needed
            handleSend();
        }
        e.stopPropagation(); // Stop bubbling to game (moving w/a/s/d)
        // prevent movement keys? Yes, stop propagation.
    };

    return (
        <div style={{
            position: 'absolute',
            bottom: isMobile ? '120px' : '100px', // Desktop: Restored to 100px
            left: isMobile ? 'auto' : '10px',
            right: isMobile ? '5px' : 'auto', // Closer to edge
            width: isMobile ? '180px' : '300px', // Smaller on mobile
            maxHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '8px',
            padding: '8px',
            pointerEvents: 'auto', // Enable interaction
            zIndex: 100
        }}>
            {/* Messages Area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                marginBottom: '8px',
                color: 'white',
                fontSize: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                {messages.map((msg) => (
                    <div key={msg.id} style={{ wordBreak: 'break-word' }}>
                        <span style={{
                            color: '#' + msg.color.toString(16).padStart(6, '0'),
                            fontWeight: 'bold',
                            marginRight: '6px'
                        }}>
                            {msg.sender}:
                        </span>
                        <span style={{ color: '#eee' }}>
                            {msg.text}
                        </span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ display: 'flex', gap: '5px' }}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Chat..."
                    style={{
                        flex: 1,
                        minWidth: 0, // Critical for flex box shrinking
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        color: 'white',
                        padding: '4px 8px',
                        fontSize: '0.9rem'
                    }}
                    onFocus={(e) => {
                        // Prevent game inputs
                        e.stopPropagation();
                    }}
                />
                <button
                    onClick={handleSend}
                    style={{
                        background: '#4a90e2',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '0 8px',
                        fontWeight: 'bold'
                    }}
                >
                    ➤
                </button>
            </div>
        </div>
    );
};

export default Chat;
