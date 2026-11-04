import { test, expect } from 'vitest';
import { gameFlow } from '../src/gameFlow.js';

test('small button starts from title and caught', () => {
  expect(gameFlow({ phase: 'title', action: 'start', sticksLost: false })).toEqual({ start: true, paused: false });
  expect(gameFlow({ phase: 'caught', action: 'start', sticksLost: false })).toEqual({ start: true, paused: false });
  expect(gameFlow({ phase: 'title', action: null, sticksLost: false }).start).toBe(false);
});

test('small button ignored while running', () => {
  expect(gameFlow({ phase: 'running', action: 'start', sticksLost: false })).toEqual({ start: false, paused: false });
});

test('pauses only while running and a stick is lost', () => {
  expect(gameFlow({ phase: 'running', action: null, sticksLost: true }).paused).toBe(true);
  expect(gameFlow({ phase: 'title', action: null, sticksLost: true }).paused).toBe(false);
  expect(gameFlow({ phase: 'caught', action: null, sticksLost: true }).paused).toBe(false);
});

test('resumes after reconnect', () => {
  expect(gameFlow({ phase: 'running', action: null, sticksLost: true }).paused).toBe(true);
  expect(gameFlow({ phase: 'running', action: null, sticksLost: false }).paused).toBe(false);
});

test('audio goes quiet while paused for a dropped stick', async () => {
  const { audioLevels } = await import('../src/gameFlow.js');
  expect(audioLevels({ running: true, paused: false, fill: 0.8, chaseActive: true })).toEqual({ danger: 0.8, chase: true });
  expect(audioLevels({ running: true, paused: true, fill: 0.8, chaseActive: true })).toEqual({ danger: 0, chase: false });
  expect(audioLevels({ running: false, paused: false, fill: 0.8, chaseActive: true })).toEqual({ danger: 0, chase: false });
});
