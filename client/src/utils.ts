import type { Stroke, TextObject } from './types';

export const getSelectionBounds = (selectedIds: string[], strokes: Stroke[], text: TextObject[]) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasSelection = false;

    strokes.forEach(s => {
        if (selectedIds.includes(s.id)) {
            hasSelection = true;
            // Calculate bounds
            if (s.points.length === 0) return;
            if (s.type === 'circle' && s.points.length >= 2) {
                const c = s.points[0];
                const r = Math.sqrt(Math.pow(s.points[1].x - c.x, 2) + Math.pow(s.points[1].y - c.y, 2));
                minX = Math.min(minX, c.x - r); maxX = Math.max(maxX, c.x + r);
                minY = Math.min(minY, c.y - r); maxY = Math.max(maxY, c.y + r);
            } else if (s.type === 'donut' && s.points.length >= 2) {
                const c = s.points[0];
                const r = Math.sqrt(Math.pow(s.points[1].x - c.x, 2) + Math.pow(s.points[1].y - c.y, 2));
                minX = Math.min(minX, c.x - r); maxX = Math.max(maxX, c.x + r);
                minY = Math.min(minY, c.y - r); maxY = Math.max(maxY, c.y + r);
            } else {
                s.points.forEach(p => {
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.y > maxY) maxY = p.y;
                });
            }
            // Add padding (approx stroke width)
            const pad = (s.width || 3) / 2;
            minX -= pad; maxX += pad; minY -= pad; maxY += pad;
        }
    });

    text.forEach(t => {
        if (selectedIds.includes(t.id)) {
            hasSelection = true;
            const w = t.text.length * (t.fontSize || 20) * 0.6;
            const h = t.fontSize || 20;
            // anchor [0, 1] => x, x+w, y-h, y
            minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x + w);
            minY = Math.min(minY, t.y - h); maxY = Math.max(maxY, t.y);
        }
    });

    if (!hasSelection) return null;
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

export const hitTest = (x: number, y: number, strokes: Stroke[], text: TextObject[]): { id: string, type: 'object' } | { type: 'handle', handle: string } | null => {
    // 0. Check Handles (If we have a helper for current selection bounds, we need it passed in here)
    // Refactoring: hitTest needs to know if we are hitting selection handles.
    // We will handle object hit test here. Handle hit test inside App/Arena logic?
    // Or pass selection bounds to this function.

    // For now, standard object hit test
    // 1. Check Text (Approximation)
    for (let i = text.length - 1; i >= 0; i--) {
        const t = text[i];
        const w = t.text.length * (t.fontSize || 20) * 0.6;
        const h = t.fontSize || 20;
        if (x >= t.x && x <= t.x + w && y >= t.y - h && y <= t.y) {
            return { id: t.id, type: 'object' };
        }
    }

    // 2. Check Strokes (Reverse order)
    for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        if (s.points.length === 0) continue;

        if (s.type === 'circle' && s.points.length >= 2) {
            const c = s.points[0];
            const r = Math.sqrt(Math.pow(s.points[1].x - c.x, 2) + Math.pow(s.points[1].y - c.y, 2));
            const dist = Math.sqrt(Math.pow(x - c.x, 2) + Math.pow(y - c.y, 2));
            if (dist <= r + (s.width || 3) / 2) return { id: s.id, type: 'object' };
        } else if (s.type === 'donut' && s.points.length >= 2) {
            const c = s.points[0];
            const r = Math.sqrt(Math.pow(s.points[1].x - c.x, 2) + Math.pow(s.points[1].y - c.y, 2));
            const dist = Math.sqrt(Math.pow(x - c.x, 2) + Math.pow(y - c.y, 2));
            if (Math.abs(dist - r) <= (s.width || 3) + 5) return { id: s.id, type: 'object' };
        } else if (s.type === 'cone') {
            const dist = Math.sqrt(Math.pow(x - s.points[0].x, 2) + Math.pow(y - s.points[0].y, 2));
            if (dist < 20) return { id: s.id, type: 'object' };
        } else {
            // Freehand / Line / Rect
            for (let j = 0; j < s.points.length - 1; j++) {
                const p1 = s.points[j];
                const p2 = s.points[j + 1];
                const A = x - p1.x;
                const B = y - p1.y;
                const C = p2.x - p1.x;
                const D = p2.y - p1.y;
                const dot = A * C + B * D;
                const len_sq = C * C + D * D;
                let param = -1;
                if (len_sq !== 0) param = dot / len_sq;
                let xx, yy;
                if (param < 0) { xx = p1.x; yy = p1.y; }
                else if (param > 1) { xx = p2.x; yy = p2.y; }
                else { xx = p1.x + param * C; yy = p1.y + param * D; }
                const dx = x - xx;
                const dy = y - yy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= (s.width || 3) + 5) return { id: s.id, type: 'object' };
            }
        }
    }

    return null;
}
