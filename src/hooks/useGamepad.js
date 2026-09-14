/**
 * Gamepad API Hook with Debouncing & Action Dispatcher
 * Polls navigator.getGamepads() on requestAnimationFrame loop.
 */

import { useEffect, useRef, useState } from 'react';

export function useGamepad(onAction) {
  const [gamepadInfo, setGamepadInfo] = useState({
    isConnected: false,
    name: 'Ningún mando detectado'
  });

  const lastActionTimeRef = useRef(0);
  const animFrameIdRef = useRef(null);

  useEffect(() => {
    const handleConnect = (e) => {
      console.log('Gamepad conectado:', e.gamepad.id);
      setGamepadInfo({
        isConnected: true,
        name: e.gamepad.id.split('(')[0].trim() || 'Mando VR/Bluetooth'
      });
    };

    const handleDisconnect = (e) => {
      console.log('Gamepad desconectado:', e.gamepad.id);
      setGamepadInfo({
        isConnected: false,
        name: 'Ningún mando detectado'
      });
    };

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);

    // Gamepad Polling Loop
    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let activePad = null;

      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
          activePad = gamepads[i];
          break;
        }
      }

      if (activePad) {
        if (!gamepadInfo.isConnected) {
          setGamepadInfo({
            isConnected: true,
            name: activePad.id.split('(')[0].trim() || 'Mando VR/Bluetooth'
          });
        }

        const now = Date.now();
        // 240ms debounce threshold
        if (now - lastActionTimeRef.current > 240) {
          const buttons = activePad.buttons;
          const axes = activePad.axes;

          let actionTriggered = false;

          // Helper to check button index or axis threshold
          const isPressed = (index) => buttons[index] && (buttons[index].pressed || buttons[index].value > 0.4);

          // 1. Next / Prev Video -> D-Pad Right / Left or Left Stick X
          if (isPressed(15) || (axes[0] && axes[0] > 0.5)) {
            onAction('NEXT_VIDEO');
            actionTriggered = true;
          } else if (isPressed(14) || (axes[0] && axes[0] < -0.5)) {
            onAction('PREV_VIDEO');
            actionTriggered = true;
          }

          // 2. Next Tag / Prev Tag -> Button A (0) / Button B (1) or D-Pad Down / Up
          else if (isPressed(0) || isPressed(13) || (axes[1] && axes[1] > 0.5)) {
            onAction('NEXT_TAG');
            actionTriggered = true;
          } else if (isPressed(1) || isPressed(12) || (axes[1] && axes[1] < -0.5)) {
            onAction('PREV_TAG');
            actionTriggered = true;
          }

          // 3. Next Audio / Prev Audio -> Triggers / Bumpers (LB: 4, RB: 5, LT: 6, RT: 7)
          else if (isPressed(5) || isPressed(7)) {
            onAction('NEXT_AUDIO');
            actionTriggered = true;
          } else if (isPressed(4) || isPressed(6)) {
            onAction('PREV_AUDIO');
            actionTriggered = true;
          }

          // 4. Play / Pause -> Start (9) or Button X (2)
          else if (isPressed(9) || isPressed(2)) {
            onAction('TOGGLE_PLAY');
            actionTriggered = true;
          }

          // 5. Toggle HUD -> Select (8) or Button Y (3)
          else if (isPressed(8) || isPressed(3)) {
            onAction('TOGGLE_HUD');
            actionTriggered = true;
          }

          if (actionTriggered) {
            lastActionTimeRef.current = now;
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(pollGamepad);
    };

    animFrameIdRef.current = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [onAction, gamepadInfo.isConnected]);

  return gamepadInfo;
}
