import React from 'react';

/**
 * SparklineChart - A reusable mini sparkline component for dashboard analytics
 *
 * Props:
 * - data (array of numbers): The data points to visualize
 * - width (number): SVG width in pixels (default: 120)
 * - height (number): SVG height in pixels (default: 32)
 * - color (string): Line/dot color, supports CSS vars (default: 'var(--accent)')
 * - showDot (boolean): Show a dot on the last data point (default: true)
 * - fill (boolean): Show area fill under the line (default: true)
 */
export default function SparklineChart({
  data = [],
  width = 120,
  height = 32,
  color = 'var(--accent)',
  showDot = true,
  fill = true,
}) {
  // Handle edge cases
  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize="10" fill="#999">
          No data
        </text>
      </svg>
    );
  }

  if (data.length === 1) {
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <circle cx={width / 2} cy={height / 2} r="2" fill={color} />
      </svg>
    );
  }

  // Calculate min and max for normalization
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  // Calculate padding (leave some space for dot/line)
  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Normalize data points to fit within chart bounds
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const normalized = (value - min) / range;
    const y = padding + (1 - normalized) * chartHeight; // Invert Y for SVG coordinates
    return { x, y, value };
  });

  // Build the path string for the line
  const pathData = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  // Build fill path (closes the area under the curve)
  const fillPath =
    pathData +
    ` L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  // Get a semi-transparent version of the color
  const fillColor =
    color.includes('var(--') ||
    color.startsWith('#') ||
    color.startsWith('rgb')
      ? color
      : color;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Background grid (optional subtle reference) */}
      <defs>
        <linearGradient id={`gradient-${Math.random()}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Area fill under line */}
      {fill && (
        <path
          d={fillPath}
          fill={`url(#gradient-${Math.random()})`}
          opacity="0.6"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Line */}
      <path d={pathData} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dot on last point */}
      {showDot && points.length > 0 && (
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill={color} />
      )}
    </svg>
  );
}
