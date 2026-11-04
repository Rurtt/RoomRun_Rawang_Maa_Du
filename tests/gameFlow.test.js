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
