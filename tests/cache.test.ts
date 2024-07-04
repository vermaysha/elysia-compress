import { describe, expect } from 'bun:test'
import cache from '../src/cache'
import { it } from 'bun:test'

describe('MemCache', () => {
  it('should set and get a value', () => {
    cache.set(1, 'value', 10)
    expect(cache.get(1)).toBe('value')
  })

  it('should clear the cache', () => {
    cache.set(1, 'value', 10)
    cache.clear()
    expect(cache.get(1)).toBeUndefined()
  })

  it('should check if a value exists', () => {
    cache.set(1, 'value', 10)
    expect(cache.has(1)).toBe(true)
    expect(cache.has(2)).toBe(false)
  })

  it('should delete a value', async () => {
    cache.set(1, 'value', 0.1)
    await new Promise((resolve) => setTimeout(resolve, 0.1 * 1000))
    expect(cache.get(1)).toBeUndefined()
  })
})
