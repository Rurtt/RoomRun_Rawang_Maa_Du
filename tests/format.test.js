import { test, expect } from 'vitest';
import strings from '../src/strings.js';
import { formatMeters, meterFill, chaseSeconds } from '../src/hud/format.js';

test('formatMeters', () => {
  expect(formatMeters(1240.7)).toBe('1,240 ม.'); expect(formatMeters(0)).toBe('0 ม.');
  expect(formatMeters(12.99)).toBe('12 ม.'); expect(formatMeters(-3)).toBe('0 ม.');
});

test('meterFill', () => {
  expect(meterFill(0)).toBe(1); expect(meterFill(15)).toBeCloseTo(0.5); expect(meterFill(40)).toBe(0); expect(meterFill(-2)).toBe(1);
});

test('meterFill reads its range from config', () => {
  expect(meterFill(10, { meterRange: 20 })).toBeCloseTo(0.5);
});

test('chaseSeconds rounds up so the countdown ends on 1, never shows 0 while active', () => {
  expect(chaseSeconds(29.99)).toBe(30); expect(chaseSeconds(0.2)).toBe(1); expect(chaseSeconds(0)).toBe(0);
});

test('strings', () => {
  expect(strings.chaseBanner(30)).toBe('ไล่ล่า 30 วิ!'); expect(strings.gap(24)).toBe('ผีห่าง 24 ม.');
  expect(strings.phoneLost).toBe('มือถือหลุด');
});
