import React from 'react';

export const angleDiagramKinds = ['acute', 'right', 'obtuse', 'straight'] as const;
export type AngleDiagramKind = (typeof angleDiagramKinds)[number];

export const angleDiagramLabels: Record<AngleDiagramKind, string> = {
  acute: 'Acute angle',
  right: 'Right angle',
  obtuse: 'Obtuse angle',
  straight: 'Straight angle',
};

const diagramPaths: Record<AngleDiagramKind, { vertex: [number, number]; rays: string[]; marker?: string }> = {
  acute: {
    vertex: [18, 58],
    rays: ['M18 58 H88', 'M18 58 L68 12'],
  },
  right: {
    vertex: [18, 58],
    rays: ['M18 58 H88', 'M18 58 V10'],
    marker: 'M34 58 V42 H18',
  },
  obtuse: {
    vertex: [70, 58],
    rays: ['M70 58 H98', 'M70 58 L12 18'],
  },
  straight: {
    vertex: [53, 58],
    rays: ['M53 58 H8', 'M53 58 H98'],
  },
};

export const getAngleDiagramMarkup = (kind: AngleDiagramKind): string => {
  const { vertex, rays, marker } = diagramPaths[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="12" viewBox="0 0 108 72" role="img" aria-label="${angleDiagramLabels[kind]}" style="display:inline-block;vertical-align:middle;color:currentColor"><path d="${rays.join(' ')}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>${marker ? `<path d="${marker}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}<circle cx="${vertex[0]}" cy="${vertex[1]}" r="4" fill="currentColor"/></svg>`;
};

const AngleDiagram = ({ kind, className }: { kind: AngleDiagramKind; className?: string }) => {
  const { vertex, rays, marker } = diagramPaths[kind];
  return (
    <svg
      className={className}
      width="18"
      height="12"
      viewBox="0 0 108 72"
      role="img"
      aria-label={angleDiagramLabels[kind]}
      style={{ display: 'inline-block', verticalAlign: 'middle', color: 'currentColor' }}
    >
      <path d={rays.join(' ')} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {marker && <path d={marker} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}
      <circle cx={vertex[0]} cy={vertex[1]} r="4" fill="currentColor" />
    </svg>
  );
};

export default AngleDiagram;
