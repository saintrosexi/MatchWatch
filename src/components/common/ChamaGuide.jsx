import React from 'react';

export function ChamaGuide({
  state = 'default', // 'default' | 'popcorn' | 'match' | 'think' | 'empty'
  text = 'Готов подобрать идеальный фильм!',
  size = 110,
  actionButton = null
}) {
  // Graceful mascot image resolution with animated fallback avatar
  const mascotMap = {
    default: '/chama/chama_default.png',
    popcorn: '/chama/chama_popcorn.png',
    match: '/chama/chama_celebrate.png',
    think: '/chama/chama_smart.png',
    empty: '/chama/chama_sad.png'
  };

  const emojiMap = {
    default: '🐕🍿',
    popcorn: '🍿✨',
    match: '🎉🐶',
    think: '🧐🎬',
    empty: '🐕💤'
  };

  const [imgFailed, setImgFailed] = React.useState(false);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '24px 16px',
      gap: '12px'
    }}>
      <div style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)',
        borderRadius: '50%'
      }}>
        {!imgFailed ? (
          <img
            src={mascotMap[state] || mascotMap.default}
            alt="Chama Guide"
            onError={() => setImgFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 6px 16px rgba(0, 0, 0, 0.7))',
              animation: 'floatGentle 3s infinite ease-in-out'
            }}
          />
        ) : (
          <div style={{
            fontSize: `${size * 0.45}px`,
            animation: 'floatGentle 3s infinite ease-in-out'
          }}>
            {emojiMap[state] || emojiMap.default}
          </div>
        )}
      </div>

      <div style={{
        maxWidth: '320px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 18px',
        backdropFilter: 'blur(10px)'
      }}>
        <p style={{
          fontSize: '0.9rem',
          lineHeight: '1.45',
          color: 'var(--text-primary)',
          fontWeight: '500'
        }}>
          {text}
        </p>
      </div>

      {actionButton && (
        <div style={{ marginTop: '4px' }}>
          {actionButton}
        </div>
      )}
    </div>
  );
}
