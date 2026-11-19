'use client';

import React from 'react';
import { X } from 'lucide-react';

export const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, eyebrow, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4 animate-fade" onClick={onClose}>
      <div
        className="flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl border border-ivory-100/10 bg-obsidian-800 shadow-2xl sm:rounded-3xl animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pb-2 pt-5">
          <div>
            {eyebrow && <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-astrolabe-400">{eyebrow}</div>}
            <h2 className="font-serif text-2xl text-ivory-50">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 text-ivory-400 hover:bg-ivory-100/10 hover:text-ivory-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-6 pt-1">{children}</div>
      </div>
    </div>
  );
};
