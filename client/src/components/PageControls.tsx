import React from 'react';
import type { Page } from '../types';

interface PageControlsProps {
    pages: Page[];
    currentPageIndex: number;
    onChangePage: (index: number) => void;
    onAddPage: () => void;
    onDeletePage: () => void;
}

const PageControls: React.FC<PageControlsProps> = ({
    pages,
    currentPageIndex,
    onChangePage,
    onAddPage,
    onDeletePage
}) => {
    return (
        <div style={{
            position: 'absolute',
            bottom: '20px', // Center bottom of screen
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: '8px 16px',
            borderRadius: '8px',
            zIndex: 200 // Above canvas, below modals
        }}>
            {/* Previous Arrow */}
            <button
                onClick={() => onChangePage(Math.max(0, currentPageIndex - 1))}
                disabled={currentPageIndex === 0}
                style={{
                    background: 'none',
                    border: 'none',
                    color: currentPageIndex === 0 ? '#555' : 'white',
                    cursor: currentPageIndex === 0 ? 'default' : 'pointer',
                    fontSize: '1.2rem',
                    padding: '0 8px'
                }}
            >
                ◀
            </button>

            {/* Page Numbers */}
            <div style={{ display: 'flex', gap: '5px' }}>
                {pages.map((page, index) => (
                    <button
                        key={page.id} // or index if id not unique enough, but id should be
                        onClick={() => onChangePage(index)}
                        style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: currentPageIndex === index ? '#4a90e2' : 'rgba(255,255,255,0.1)',
                            border: '1px solid #555',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.9rem',
                            fontWeight: currentPageIndex === index ? 'bold' : 'normal'
                        }}
                    >
                        {index + 1}
                    </button>
                ))}
            </div>

            {/* Next Arrow */}
            <button
                onClick={() => onChangePage(Math.min(pages.length - 1, currentPageIndex + 1))}
                disabled={currentPageIndex === pages.length - 1}
                style={{
                    background: 'none',
                    border: 'none',
                    color: currentPageIndex === pages.length - 1 ? '#555' : 'white',
                    cursor: currentPageIndex === pages.length - 1 ? 'default' : 'pointer',
                    fontSize: '1.2rem',
                    padding: '0 8px'
                }}
            >
                ▶
            </button>

            {/* Divider */}
            <div style={{ width: '1px', height: '20px', background: '#555', margin: '0 5px' }} />

            {/* Add Page */}
            <button
                onClick={onAddPage}
                title="Add New Page"
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#00ff00', // Bright Green
                    cursor: 'pointer',
                    fontSize: '2rem', // Increased size for text
                    padding: '0 8px',
                    fontWeight: 'bold',
                    lineHeight: '1', // Ensure vertical centering for text
                }}
            >
                +
            </button>

            {/* Delete Page */}
            <button
                onClick={onDeletePage}
                disabled={pages.length <= 1}
                title="Delete Current Page"
                style={{
                    background: 'none',
                    border: 'none',
                    color: pages.length <= 1 ? '#555' : '#ff0000', // Bright Red
                    cursor: pages.length <= 1 ? 'default' : 'pointer',
                    fontSize: '1.5rem', // Slightly larger
                    padding: '0 8px',
                    fontWeight: 'bold'
                }}
            >
                ❌
            </button>
        </div>
    );
};

export default PageControls;
