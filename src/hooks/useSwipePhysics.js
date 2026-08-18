import { useState, useRef, useEffect, useCallback } from 'react';
import { triggerHaptic } from '../engine/hapticsEngine.js';
import { playSound } from '../engine/soundEngine.js';

export function useSwipePhysics({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onUndo,
  threshold = 85,
  verticalThreshold = 100,
  disabled = false
}) {
  const [dragState, setDragState] = useState({
    x: 0,
    y: 0,
    rotateZ: 0,
    rotateX: 0,
    rotateY: 0,
    isDragging: false,
    direction: null, // 'like' | 'pass' | 'superlike' | 'details' | null
    flyOut: null // 'right' | 'left' | 'up' | null
  });

  const startPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const isAnimatingRef = useRef(false);

  const triggerFlyOut = useCallback((dir, callback) => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    setDragState((prev) => ({
      ...prev,
      flyOut: dir,
      isDragging: false,
      direction: dir === 'right' ? 'like' : dir === 'left' ? 'pass' : dir === 'up' ? 'superlike' : null
    }));

    setTimeout(() => {
      if (callback) callback();
      setDragState({
        x: 0,
        y: 0,
        rotateZ: 0,
        rotateX: 0,
        rotateY: 0,
        isDragging: false,
        direction: null,
        flyOut: null
      });
      isAnimatingRef.current = false;
    }, 290);
  }, []);

  const handlePointerDown = (e) => {
    if (disabled || isAnimatingRef.current) return;
    isDraggingRef.current = true;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setDragState((prev) => ({ ...prev, isDragging: true, flyOut: null }));
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || disabled || isAnimatingRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;

    // 3D Tilt calculation
    const rotZ = dx * 0.08;
    const rotY = dx * 0.04;
    const rotX = -dy * 0.04;

    let dir = null;
    if (dx > threshold * 0.4) dir = 'like';
    else if (dx < -threshold * 0.4) dir = 'pass';
    else if (dy < -verticalThreshold * 0.4) dir = 'superlike';
    else if (dy > verticalThreshold * 0.4) dir = 'details';

    setDragState({
      x: dx,
      y: dy,
      rotateZ: rotZ,
      rotateX: rotX,
      rotateY: rotY,
      isDragging: true,
      direction: dir,
      flyOut: null
    });
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current || disabled || isAnimatingRef.current) return;
    isDraggingRef.current = false;

    const dx = dragState.x;
    const dy = dragState.y;

    // Evaluate gesture trigger with kinetic fly-out
    if (dx > threshold) {
      // Like
      triggerHaptic('medium');
      playSound('swipe_like');
      triggerFlyOut('right', onSwipeRight);
    } else if (dx < -threshold) {
      // Pass
      triggerHaptic('light');
      playSound('swipe_pass');
      triggerFlyOut('left', onSwipeLeft);
    } else if (dy < -verticalThreshold) {
      // Superlike
      triggerHaptic('heavy');
      playSound('superlike');
      triggerFlyOut('up', onSwipeUp);
    } else if (dy > verticalThreshold) {
      // Details
      triggerHaptic('light');
      playSound('tap');
      if (onSwipeDown) onSwipeDown();
      setDragState({
        x: 0,
        y: 0,
        rotateZ: 0,
        rotateX: 0,
        rotateY: 0,
        isDragging: false,
        direction: null,
        flyOut: null
      });
    } else {
      // Reset position
      setDragState({
        x: 0,
        y: 0,
        rotateZ: 0,
        rotateX: 0,
        rotateY: 0,
        isDragging: false,
        direction: null,
        flyOut: null
      });
    }
  };

  // Programmatic Button Triggers with Fly-Out
  const triggerLike = () => {
    if (disabled || isAnimatingRef.current) return;
    triggerFlyOut('right', onSwipeRight);
  };

  const triggerPass = () => {
    if (disabled || isAnimatingRef.current) return;
    triggerFlyOut('left', onSwipeLeft);
  };

  const triggerSuperlike = () => {
    if (disabled || isAnimatingRef.current) return;
    triggerFlyOut('up', onSwipeUp);
  };

  // Keyboard navigation support
  useEffect(() => {
    if (disabled || isAnimatingRef.current) return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        triggerHaptic('medium');
        playSound('swipe_like');
        triggerLike();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerHaptic('light');
        playSound('swipe_pass');
        triggerPass();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        triggerHaptic('heavy');
        playSound('superlike');
        triggerSuperlike();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        triggerHaptic('light');
        playSound('tap');
        if (onSwipeDown) onSwipeDown();
      } else if (e.key === 'z' || e.key === 'Backspace') {
        if (onUndo) onUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, triggerLike, triggerPass, triggerSuperlike, onSwipeDown, onUndo]);

  return {
    dragState,
    triggerLike,
    triggerPass,
    triggerSuperlike,
    bind: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp
    }
  };
}
