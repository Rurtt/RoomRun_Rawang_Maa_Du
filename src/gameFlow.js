// Stick-driven flow, kept pure so it is testable: the small button starts a run
// on the title/caught screens only (an accidental press mid-run does nothing),
// and a stick dropping mid-run pauses until it is back.

/**
 * @param {{ phase: string, action: 'start'|null, sticksLost: boolean }} s
 * @returns {{ start: boolean, paused: boolean }}
 */
export function gameFlow({ phase, action, sticksLost }) {
  return {
    start: action === 'start' && (phase === 'title' || phase === 'caught'),
    paused: phase === 'running' && sticksLost,
  };
}
