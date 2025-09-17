import { describe, it, expect } from 'vitest';
import { Ok, Err, isOk, isErr } from '../Result.js';

describe('Result', () => {
  it('should create Ok result', () => {
    const result = Ok('success');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toBe('success');
    }
  });

  it('should create Err result', () => {
    const error = new Error('failed');
    const result = Err(error);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe(error);
    }
  });

  it('should type guard Ok results correctly', () => {
    const result = Ok(42);
    if (isOk(result)) {
      expect(result.data).toBe(42);
    }
  });

  it('should type guard Err results correctly', () => {
    const error = new Error('test error');
    const result = Err(error);
    if (isErr(result)) {
      expect(result.error.message).toBe('test error');
    }
  });
});