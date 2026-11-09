
import type { GestureMessage } from '../types/gesture';

export type GestureAction =
  | { kind: 'zoom'; delta: number }
  | { kind: 'rotate'; delta: [number, number] }
  | { kind: 'cursor'; position: [number, number] }
  | { kind: 'none'; releaseDrag: boolean };

export function dispatchGesture(
  message: GestureMessage,
  sensitivity: number,
): GestureAction {
  if (message.tracking !== 'tracking') {
    return { kind: 'none', releaseDrag: true };
  }

  // Two hands: zoom only.
  if (message.gesture === 'zoom' && message.hands === 2) {
    return {
      kind: 'zoom',
      delta: message.zoom * sensitivity,
    };
  }

  // One closed fist: camera rotation only.
  if (message.gesture === 'fist' && message.hands === 1) {
    return {
      kind: 'rotate',
      delta: [
        message.rotation[0] * sensitivity,
        message.rotation[1] * sensitivity,
      ],
    };
  }

  // One open palm: cursor movement only.
  if (
    message.gesture === 'open_palm' &&
    message.hands === 1 &&
    message.cursor !== null
  ) {
    return {
      kind: 'cursor',
      position: [message.cursor[0], message.cursor[1]],
    };
  }

  // Ignore unsupported or incompatible gestures.
  return { kind: 'none', releaseDrag: false };
}
