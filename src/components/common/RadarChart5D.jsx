import React from 'react';

export function RadarChart5D({ vector, size = 180, color = '#f59e0b', showLabels = true }) {
  const v = vector || { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 };
  
  const center = size / 2;
  const radius = size * 0.38;
  
  const axes = [
    { label: '⚡ Энергия', val: v.energy || 5, angle: -Math.PI / 2 },
    { label: '🌑 Тьма', val: v.darkness || 5, angle: -Math.PI / 2 + (2 * Math.PI) / 5 },
    { label: '🧠 Интеллект', val: v.intellect || 5, angle: -Math.PI / 2 + (4 * Math.PI) / 5 },
    { label: '❤️ Эмоции', val: v.emotion || 5, angle: -Math.PI / 2 + (6 * Math.PI) / 5 },
    { label: '💥 Динамизм', val: v.dynamism || 5, angle: -Math.PI / 2 + (8 * Math.PI) / 5 }
  ];

  // Generate web rings (25%, 50%, 75%, 100%)
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Polygon points
  const points = axes.map((axis) => {
    const r = (axis.val / 10) * radius;
    const x = center + r * Math.cos(axis.angle);
    const y = center + r * Math.sin(axis.angle);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background Grid Rings */}
        {rings.map((factor, idx) => {
          const ringPoints = axes.map((a) => {
            const r = factor * radius;
            const x = center + r * Math.cos(a.angle);
            const y = center + r * Math.sin(a.angle);
            return `${x},${y}`;
          }).join(' ');
          return (
            <polygon
              key={idx}
              points={ringPoints}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis Lines */}
        {axes.map((axis, i) => {
          const x2 = center + radius * Math.cos(axis.angle);
          const y2 = center + radius * Math.sin(axis.angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x2}
              y2={y2}
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="1"
            />
          );
        })}

        {/* 5D Sensation Polygon Area */}
        <polygon
          points={points}
          fill={color}
          fillOpacity="0.28"
          stroke={color}
          strokeWidth="2.5"
          filter="drop-shadow(0 0 6px rgba(245, 158, 11, 0.4))"
        />

        {/* Node Dots */}
        {axes.map((axis, i) => {
          const r = (axis.val / 10) * radius;
          const x = center + r * Math.cos(axis.angle);
          const y = center + r * Math.sin(axis.angle);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3.5"
              fill="#fff"
              stroke={color}
              strokeWidth="1.5"
            />
          );
        })}
      </svg>

      {showLabels && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          width: '100%',
          marginTop: '10px'
        }}>
          {axes.map((a, idx) => (
            <div key={idx} style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '4px 8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.label}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: color, fontFamily: 'Space Grotesk' }}>{a.val}/10</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
