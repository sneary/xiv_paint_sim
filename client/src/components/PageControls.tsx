import React from 'react';
import type { Page } from '../types';

interface PageControlsProps {
    pages: Page[];
    currentPageIndex: number;
    onChangePage: (index: number) => void;
    onAddPage: () => void;
    onDuplicatePage: () => void;
    onDeletePage: () => void;
    onImport: () => void;
}

const PageControls: React.FC<PageControlsProps> = ({
    pages,
    currentPageIndex,
    onChangePage,
    onAddPage,
    onDuplicatePage,
    onDeletePage,
    onImport
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
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    padding: 0,
                }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ff00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </button>

            {/* Duplicate Page */}
            <button
                onClick={onDuplicatePage}
                title="Duplicate Current Page"
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    padding: 0,
                }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    {/* Green Plus (Top Left, scaled down) */}
                    <g transform="scale(0.7) translate(-2, -2)">
                        <path d="M12 5V19M5 12H19" stroke="#00ff00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                    {/* Copy Icon (Bottom Right, White) */}
                    <g transform="translate(8, 8) scale(0.65)">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="white" strokeWidth="2.5" fill="none"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    </g>
                </svg>
            </button>

            {/* Import RaidPlan */}
            <button
                onClick={onImport}
                title="Import from RaidPlan.io"
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    padding: 0,
                }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00B4FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </button>

            {/* Delete Page */}
            <button
                onClick={onDeletePage}
                disabled={pages.length <= 1}
                title="Delete Current Page"
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: pages.length <= 1 ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    padding: 0,
                }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={pages.length <= 1 ? '#555' : '#ff0000'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    );
};

export default PageControls;
