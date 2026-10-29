'use client';

// ===== VOIDPULSE :: React canvas host =====

import { useEffect, useRef } from 'react';
import { Game } from '@/game/game';
import { Renderer } from '@/game/render';
import { AudioEngine } from '@/game/audio';

const GAME_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
]);

/** Some browsers / virtual keyboards / automation tools send empty `code`.
 *  Normalize to a stable code using `key` as fallback. */
const KEY_FALLBACK: Record<string, string> = {
  w: 'KeyW',
  a: 'KeyA',
  s: 'KeyS',
  d: 'KeyD',
  W: 'KeyW',
  A: 'KeyA',
  S: 'KeyS',
  D: 'KeyD',
  ' ': 'Space',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Enter: 'Enter',
  Escape: 'Escape',
  p: 'KeyP',
  P: 'KeyP',
  m: 'KeyM',
  M: 'KeyM',
  r: 'KeyR',
  R: 'KeyR',
  q: 'KeyQ',
  Q: 'KeyQ',
  t: 'KeyT',
  T: 'KeyT',
  e: 'KeyE',
  E: 'KeyE',
  h: 'KeyH',
  H: 'KeyH',
  c: 'KeyC',
  C: 'KeyC',
  '1': 'Digit1',
  '2': 'Digit2',
  '3': 'Digit3',
  Shift: 'ShiftLeft',
};

function normalizeCode(e: KeyboardEvent): string {
  return e.code || KEY_FALLBACK[e.key] || '';
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const audio = new AudioEngine();
    const game = new Game(audio);
    const renderer = new Renderer(canvas);

    // expose for debugging / automated verification (merge with Game's own hook)
    const w = window as unknown as { __VOIDPULSE?: Record<string, unknown> };
    w.__VOIDPULSE = { ...(w.__VOIDPULSE ?? {}), game, audio };

    // ---- input ----
    const onKeyDown = (e: KeyboardEvent) => {
      const code = normalizeCode(e);
      if (GAME_KEYS.has(code)) e.preventDefault();
      if (e.repeat) {
        game.setMove(code, true);
        return;
      }
      game.setMove(code, true);
      game.handleKeyPress(code, false);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const code = normalizeCode(e);
      game.setMove(code, false);
      game.handleKeyRelease(code);
    };
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      game.mouse.x = e.clientX - rect.left;
      game.mouse.y = e.clientY - rect.top;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      game.click(e.clientX - rect.left, e.clientY - rect.top);
    };
    const onBlur = () => {
      game.input.up = false;
      game.input.down = false;
      game.input.left = false;
      game.input.right = false;
      if (game.state === 'playing') game.togglePause();
    };
    const onResize = () => renderer.resize();
    const onVisibility = () => {
      if (document.hidden && game.state === 'playing') game.togglePause();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    // ---- main loop (fixed timestep) ----
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1 / 60;
    let running = true;

    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25; // tab switch protection
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        game.update(STEP);
        acc -= STEP;
        steps++;
      }
      renderer.draw(game, dt);
    };
    raf = requestAnimationFrame(frame);

    // ---- cleanup (strict-mode safe) ----
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      audio.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="block h-screen w-screen cursor-crosshair select-none"
      style={{ imageRendering: 'auto' }}
      aria-label="VOIDPULSE game canvas"
      role="img"
    />
  );
}
