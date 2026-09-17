'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil } from 'lucide-react';
import type { ImageEditCallbacks } from './paper-render';
import { imageFilterCss, imageGroupStyle, imageItemStyle, type ImageAlign, type QuestionImage } from './image-style';

interface EditableImageProps {
  questionId: string;
  images: QuestionImage[];
  width: number;
  align?: ImageAlign;
  grayscale?: number;
  brightness?: number;
  contrast?: number;
  light?: number;
  callbacks: ImageEditCallbacks;
}

const SliderRow = ({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) => (
  <label className="flex items-center gap-2 text-[11px] text-slate-600">
    <span className="w-16 shrink-0">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={1}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-3 flex-1 cursor-pointer"
    />
    <span className="w-9 shrink-0 text-right tabular-nums">{value}%</span>
  </label>
);

export default function EditableImage({
  questionId,
  images,
  width,
  align,
  grayscale = 0,
  brightness = 100,
  contrast = 100,
  light = 100,
  callbacks,
}: EditableImageProps) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filter = imageFilterCss({ grayscale, brightness, contrast, light });

  const openEditMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!menu) return;
    const onOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onScrollOrResize = () => setMenu(null);
    document.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('pointerdown', onOutside, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [menu]);

  return (
    <div data-image-element className="relative" onContextMenu={openEditMenu}>
      {editing && (
        <div className="mb-1 grid grid-cols-1 gap-x-4 gap-y-1 rounded border border-blue-300 bg-blue-50/60 p-2 sm:grid-cols-2">
          <SliderRow
            label="Grayscale"
            value={grayscale}
            min={0}
            max={100}
            onChange={(value) => callbacks.onImageChange(questionId, { imageGrayscale: value })}
          />
          <SliderRow
            label="Brightness"
            value={brightness}
            min={0}
            max={200}
            onChange={(value) => callbacks.onImageChange(questionId, { imageBrightness: value })}
          />
          <SliderRow
            label="Contrast"
            value={contrast}
            min={0}
            max={200}
            onChange={(value) => callbacks.onImageChange(questionId, { imageContrast: value })}
          />
          <SliderRow
            label="Light"
            value={light}
            min={10}
            max={100}
            onChange={(value) => callbacks.onImageChange(questionId, { imageLight: value })}
          />
          <div className="col-span-full flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                callbacks.onImageChange(questionId, { imageGrayscale: 0 });
                callbacks.onImageChange(questionId, { imageBrightness: 100 });
                callbacks.onImageChange(questionId, { imageContrast: 100 });
                callbacks.onImageChange(questionId, { imageLight: 100 });
              }}
              className="inline-flex h-6 items-center rounded border border-slate-300 bg-white px-2 text-[11px] text-slate-600 hover:bg-slate-100"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="ml-auto inline-flex h-6 items-center gap-1 rounded border border-blue-500 bg-white px-2 text-[11px] text-blue-600 hover:bg-blue-50"
            >
              <Check className="size-3" /> Done
            </button>
          </div>
        </div>
      )}
      <div style={imageGroupStyle(align)} className={editing ? 'ring-1 ring-blue-400 rounded' : undefined}>
        {images.map((img) => (
          <img key={img.id} src={img.data} alt="" style={imageItemStyle(images.length, width, filter)} />
        ))}
      </div>

      {menu && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[1000] w-40 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            <Pencil className="size-3.5" /> Edit image
          </button>
        </div>
      , document.body)}
    </div>
  );
}