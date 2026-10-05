import { describe, expect, it } from 'vitest'
import { clamp, formatDuration, formatRelativeTime, formatWatchTime, parseTimestamp } from './format'

describe('formatDuration', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3723)).toBe('1:02:03')
    expect(formatDuration(-5)).toBe('0:00')
  })
})

describe('formatWatchTime', () => {
  it('uses seconds, minutes and hours', () => {
    expect(formatWatchTime(45)).toBe('45초')
    expect(formatWatchTime(600)).toBe('10분')
    expect(formatWatchTime(5400)).toBe('1시간 30분')
  })
})

describe('parseTimestamp', () => {
  it('parses mm:ss, hh:mm:ss and plain seconds', () => {
    expect(parseTimestamp('1:23')).toBe(83)
    expect(parseTimestamp('01:02:03')).toBe(3723)
    expect(parseTimestamp('90')).toBe(90)
  })
  it('rejects garbage', () => {
    expect(parseTimestamp('abc')).toBeNull()
    expect(parseTimestamp('1:2:3:4')).toBeNull()
    expect(parseTimestamp('-1')).toBeNull()
    expect(parseTimestamp('')).toBeNull()
  })
})

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-10-05T00:00:00Z')
  it('describes past dates in Korean', () => {
    expect(formatRelativeTime('2026-10-04T00:00:00Z', now)).toBe('어제')
    expect(formatRelativeTime('2026-10-02T00:00:00Z', now)).toBe('3일 전')
  })
  it('returns empty for invalid input', () => {
    expect(formatRelativeTime('nope', now)).toBe('')
  })
})

describe('clamp', () => {
  it('bounds a number', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
  })
})
