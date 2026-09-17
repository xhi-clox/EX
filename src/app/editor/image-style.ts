import type { CSSProperties } from 'react';

export type ImageAlign = 'left' | 'center' | 'right';

export interface QuestionImage {
    id: string;
    data: string;
}

export interface ImageAdjustments {
    grayscale?: number;
    brightness?: number;
    contrast?: number;
    light?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const imageFilterCss = (adj: ImageAdjustments): string | undefined => {
    const parts: string[] = [];
    const grayscale = clamp(adj.grayscale ?? 0, 0, 100);
    const brightness = clamp(adj.brightness ?? 100, 0, 200);
    const contrast = clamp(adj.contrast ?? 100, 0, 200);
    const light = clamp(adj.light ?? 100, 10, 100);
    if (grayscale > 0) parts.push(`grayscale(${grayscale}%)`);
    if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
    if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
    if (light < 100) parts.push(`opacity(${light}%)`);
    return parts.length ? parts.join(' ') : undefined;
};

// Style for a single image inside the group flex row. With several images in the
// group each one shares the row equally and `width` becomes a per-item max width,
// so two images sit side by side. A lone image keeps its previous width behaviour.
export const imageItemStyle = (count: number, widthPct: number, filter?: string): CSSProperties => {
    const base: CSSProperties = { filter };
    if (count > 1) {
        return { ...base, flex: '1 1 0', minWidth: 0, maxWidth: `${widthPct}%`, boxSizing: 'border-box' };
    }
    return { ...base, width: `${widthPct}%`, flex: '0 0 auto' };
};

// The Question may store images two ways: a group array (new) or a single
// legacy `imageData` (old). This normalizes both to an array so the editor,
// preview and PDF all render the same way.
export const getQuestionImages = (q: {
    imageData?: string;
    imageWidth?: number;
    imageAlign?: ImageAlign;
    imageGrayscale?: number;
    imageBrightness?: number;
    imageContrast?: number;
    imageLight?: number;
    images?: QuestionImage[];
}): QuestionImage[] => {
    if (q.images && q.images.length > 0) return q.images;
    if (q.imageData) {
        return [{
            id: 'img0',
            data: q.imageData,
        }];
    }
    return [];
};

export const imageGroupStyle = (align?: ImageAlign): CSSProperties => ({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
});
