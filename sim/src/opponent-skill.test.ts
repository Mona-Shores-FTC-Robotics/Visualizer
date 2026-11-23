import { describe, expect, it } from 'vitest';
import { DEFAULT_SETUP, OPPONENT_SKILL, REF_ERR, opponentSetup } from './setup';

describe('opponent skill dial', () => {
  it('is the default robot at 1', () => {
    const s = opponentSetup(1);
    expect(s.driveRpm).toBe(DEFAULT_SETUP.driveRpm);
    expect(s.errAzimDeg).toBeCloseTo(REF_ERR.errAzimDeg);
    expect(s.intakeP).toBeCloseTo(0.95);
  });
  it('gets weaker as the setting falls, and clamps', () => {
    const levels = [OPPONENT_SKILL[7], OPPONENT_SKILL[5], OPPONENT_SKILL[3], OPPONENT_SKILL[1]].map(opponentSetup);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].driveRpm!).toBeLessThan(levels[i - 1].driveRpm!);
      expect(levels[i].errElevDeg!).toBeGreaterThan(levels[i - 1].errElevDeg!);
      expect(levels[i].intakeP!).toBeLessThan(levels[i - 1].intakeP!);
    }
    expect(opponentSetup(-3)).toEqual(opponentSetup(0));
    expect(opponentSetup(NaN)).toEqual(opponentSetup(1));
  });
});
