import React, { useMemo } from 'react';
import { generateQRMatrix, QRErrorCorrectLevel } from '../../utils/qrCodeGenerator';

/**
 * High-performance, zero-dependency SVG QR Code Component
 */
export const QRCodeView = ({
  value,
  size = 220,
  fgColor = '#0f172a', // dark slate
  bgColor = '#ffffff', // pure white for maximum camera contrast
  includeMargin = true,
  className = '',
  centerLogo = null
}) => {
  const { pathData, viewBoxSize } = useMemo(() => {
    if (!value) return { pathData: '', viewBoxSize: 25 };

    try {
      const { matrix, size: matrixSize } = generateQRMatrix(value, QRErrorCorrectLevel.M);
      const margin = includeMargin ? 3 : 0;
      const totalSize = matrixSize + margin * 2;

      let d = '';
      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (matrix[r][c]) {
            const x = c + margin;
            const y = r + margin;
            d += `M${x},${y}h1v1h-1z `;
          }
        }
      }

      return { pathData: d, viewBoxSize: totalSize };
    } catch (err) {
      console.error('Error generating QR code:', err);
      return { pathData: '', viewBoxSize: 25 };
    }
  }, [value, includeMargin]);

  if (!pathData) {
    return (
      <div 
        style={{ width: size, height: size }} 
        className="flex items-center justify-center bg-slate-800 text-slate-400 text-xs rounded-xl"
      >
        Invalid QR Data
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="w-full h-full rounded-2xl shadow-lg"
        shapeRendering="crispEdges"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={viewBoxSize} height={viewBoxSize} fill={bgColor} rx={viewBoxSize > 30 ? 2 : 1} />
        <path d={pathData} fill={fgColor} />
      </svg>
      {centerLogo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white p-1.5 rounded-xl shadow-md border border-slate-200">
            {centerLogo}
          </div>
        </div>
      )}
    </div>
  );
};
