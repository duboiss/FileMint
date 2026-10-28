import React from 'react';

interface LoupeLensProps {
  clientX: number;
  clientY: number;
  normX: number;
  normY: number;
  imageRect: {
    width: number;
    height: number;
  };
  originalSrc: string;
  resultSrc: string;
  hasChanges: boolean;
  zoom: 2 | 4;
}

export const LoupeLens: React.FC<LoupeLensProps> = ({
  clientX,
  clientY,
  normX,
  normY,
  imageRect,
  originalSrc,
  resultSrc,
  hasChanges,
  zoom,
}) => {
  const LOUPE_SIZE = 220;
  const HALF_SIZE = LOUPE_SIZE / 2;

  const scaledW = imageRect.width * zoom;
  const scaledH = imageRect.height * zoom;

  const imgLeft = HALF_SIZE - normX * scaledW;
  const imgTop = HALF_SIZE - normY * scaledH;

  const isPixelated = zoom === 4;

  return (
    <div
      className="fixed z-50 pointer-events-none select-none transition-opacity duration-75"
      style={{
        left: `${clientX}px`,
        top: `${clientY}px`,
        transform: 'translate(-50%, -50%)',
        width: `${LOUPE_SIZE}px`,
        height: `${LOUPE_SIZE}px`,
      }}
    >
      {/* Outer Glow & Rim */}
      <div className="w-full h-full rounded-full overflow-hidden relative ring-4 ring-mint-400 shadow-[0_0_35px_rgba(45,212,191,0.5),0_20px_45px_rgba(0,0,0,0.9)] border-2 border-slate-900 bg-slate-950">
        {hasChanges ? (
          <>
            {/* Left Half: Original (Initial) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: 'inset(0 50% 0 0)' }}
            >
              <img
                src={originalSrc}
                alt="Initial"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: `${imgLeft}px`,
                  top: `${imgTop}px`,
                  width: `${scaledW}px`,
                  height: `${scaledH}px`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  imageRendering: isPixelated ? 'pixelated' : 'auto',
                }}
              />
            </div>

            {/* Right Half: Result (Compressed) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: 'inset(0 0 0 50%)' }}
            >
              <img
                src={resultSrc}
                alt="Result"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: `${imgLeft}px`,
                  top: `${imgTop}px`,
                  width: `${scaledW}px`,
                  height: `${scaledH}px`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  imageRendering: isPixelated ? 'pixelated' : 'auto',
                }}
              />
            </div>

            {/* Vertical Split Line */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-mint-400 shadow-[0_0_10px_rgba(45,212,191,0.9)] z-20 pointer-events-none" />

            {/* Mini Labels on Lens */}
            <div className="absolute top-2.5 left-4 z-20 px-1.5 py-0.5 rounded-md bg-slate-950/80 border border-white/20 text-[9px] font-bold uppercase tracking-wider text-slate-200">
              Avant
            </div>
            <div className="absolute top-2.5 right-4 z-20 px-1.5 py-0.5 rounded-md bg-mint-500/90 text-slate-950 text-[9px] font-bold uppercase tracking-wider">
              Après
            </div>
          </>
        ) : (
          /* Single Image Mode */
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={resultSrc}
              alt="Result"
              draggable={false}
              style={{
                position: 'absolute',
                left: `${imgLeft}px`,
                top: `${imgTop}px`,
                width: `${scaledW}px`,
                height: `${scaledH}px`,
                maxWidth: 'none',
                maxHeight: 'none',
                imageRendering: isPixelated ? 'pixelated' : 'auto',
              }}
            />
          </div>
        )}

        {/* Precision Crosshair in center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="relative w-8 h-8 flex items-center justify-center">
            {/* Horizontal arms */}
            <div className="absolute left-0 w-2.5 h-[1px] bg-white/80 shadow-[0_0_2px_black]" />
            <div className="absolute right-0 w-2.5 h-[1px] bg-white/80 shadow-[0_0_2px_black]" />
            {/* Vertical arms */}
            <div className="absolute top-0 h-2.5 w-[1px] bg-white/80 shadow-[0_0_2px_black]" />
            <div className="absolute bottom-0 h-2.5 w-[1px] bg-white/80 shadow-[0_0_2px_black]" />
            {/* Center dot */}
            <div className="w-1.5 h-1.5 rounded-full border border-mint-400 bg-mint-500/90 shadow-[0_0_4px_rgba(45,212,191,0.8)]" />
          </div>
        </div>
      </div>

      {/* Magnification Badge */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-40 px-2.5 py-0.5 rounded-full bg-slate-900 border-2 border-mint-400/80 text-mint-400 font-mono text-[10px] font-bold shadow-lg tracking-wide whitespace-nowrap">
        {zoom * 100}% {isPixelated ? '• Pixel' : ''}
      </div>
    </div>
  );
};
