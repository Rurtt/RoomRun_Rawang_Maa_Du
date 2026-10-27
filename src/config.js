// Every tunable number in the game. Modules read these on each use, so the
// debug panel (Backquote) can change them live.
export default {
  title: 'ซอยผี',
  loop: { stepDt: 1 / 120, maxFrameDt: 0.1 },
  cadence: { windowMs: 1500, stopAfterMs: 700, minRate: 1.0, fullRate: 4.0, smoothTau: 0.2 },
  player: { maxSpeed: 12, laneWidth: 2.5, laneChangeTime: 0.15, laneCooldown: 0.35,
            jumpVelocity: 7, gravity: 20, stumbleTime: 1.0, stumbleFactor: 0.4,
            startSpeedThreshold: 0.2 },
  chaser: { speed: 6, startGap: 20, maxGap: 50, visibleGap: 12, meterRange: 30 },
  chase: { warningTime: 3, activeTime: 30, speedMultiplier: 1.4, firstAt: 60, every: 90,
           rewardCoins: 50, rewardGap: 15 },
  track: { spawnAhead: 120, despawnBehind: 20, startClear: 30, minRowSpacing: 14, maxRowSpacing: 26,
           singleOnlyUntil: 60, coinRowLength: 5, coinSpacing: 2, coinRowChance: 0.6,
           hitHalfDepth: 0.8, laneHitHalfWidth: 1.0, jumpClearHeight: 0.6, coinPickupDepth: 1.0 },
  motion: { /* filled in Task 12 */ },
  phone: { disconnectAfterMs: 1000 },
};
