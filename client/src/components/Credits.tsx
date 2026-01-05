

const Credits = () => {
    return (
        <div style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            textAlign: 'right',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '10px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 9999,
            lineHeight: '1.4'
        }}>
            <div>Created by Ombo Xox Adamantoise</div>
            <div>Reach out to me on discord @ombox</div>
            <div style={{ pointerEvents: 'auto' }}>
                <a href="https://www.patreon.com/ombox/join" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255, 255, 255, 0.4)', textDecoration: 'underline' }}>
                    Support this project on Patreon
                </a>
            </div>
        </div>
    );
};

export default Credits;
