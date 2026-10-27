// Every tunable number in the game. Modules read these on each use, so the
// debug panel (Backquote) can change them live.
export default {
  title: 'ระวังหมาดุ',
  loop: { stepDt: 1 / 120, maxFrameDt: 0.1 },
  cadence: { windowMs: 1500, stopAfterMs: 700, minRate: 1.0, fullRate: 4.0, smoothTau: 0.2 },
  player: { maxSpeed: 12, laneWidth: 2.5, laneChangeTime: 0.15, laneCooldown: 0, // keyboard: none; phones have motion.gestureCooldownMs
            jumpVelocity: 7, gravity: 20, stumbleTime: 1.5, stumbleFactor: 0.2,
            startSpeedThreshold: 0.2 },
  chaser: { speed: 6, startGap: 20, maxGap: 50, visibleGap: 5, meterRange: 30 }, // visibleGap 5: drawn 0.9..2.2 m behind, close to true
  chase: { warningTime: 3, activeTime: 30, speedMultiplier: 1.4, firstAt: 60, every: 90,
           rewardCoins: 50, rewardGap: 15, obstacleDensity: 0.5 },
  track: { spawnAhead: 120, despawnBehind: 20, startClear: 30, minRowSpacing: 14, maxRowSpacing: 26,
           singleOnlyUntil: 60, coinRowLength: 5, coinSpacing: 2, coinRowChance: 0.6,
           hitHalfDepth: 0.8, laneHitHalfWidth: 1.0, jumpClearHeight: 0.6, coinPickupDepth: 1.0 },
  // Dog rework: hit-stop, boss peek after a hit, woken heel dogs, per-obstacle extras, chase pack
  effects: { hitStop: 0.08, peekTime: 1.5, heelTime: 10, heelSpeedBonus: 1, maxHeelDogs: 2,
             cartCoinLoss: 10, tuktukStun: 2, packIntroTime: 2, packSize: 3 },
  // last ~1 s before a catch the game runs at slowMoScale (the grab reads on video)
  juice: { slowMoScale: 0.4, slowMoWindow: 1.0, slowMoMaxGap: 4 },
  // Phone/stick arm-swing detection, m/s^2 with gravity removed. Tuned from logs (scripts/replay.mjs).
  motion: {
    axes: { vertical: 1, lateral: 0 },     // indexes into a = [x, y, z]
    lateralSign: { L: 1, R: 1 },           // flip a hand whose phone is held the other way round
    stepSign: 1,                           // count the swing end where vertical is this sign: one step per arm cycle per hand
    stepThreshold: 6, stepRefractoryMs: 180,
    jumpThreshold: 15, jumpWindowMs: 100,
    swipeThreshold: 12, swipeWindowMs: 150, gestureCooldownMs: 350,
    gestureHoldMs: 600, suppressStepsAfterGestureMs: 300,
  },
  phone: { disconnectAfterMs: 1000 },
};
