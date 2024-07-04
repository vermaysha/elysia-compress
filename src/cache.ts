/**
 * A simple in-memory cache
 *
 */
class MemCache {
  constructor(private cache: Map<number | bigint, any> = new Map()) {}

  /**
   * Sets a value in the cache with the specified key and optional time-to-live (TTL).
   *
   * @param {number | bigint} key - The key to set the value for.
   * @param {any} value - The value to set in the cache.
   * @param {number} [TTL=Number.MAX_SAFE_INTEGER] - The time-to-live (in seconds) for the value in the cache.
   * @return {void} This function does not return anything.
   */
  set(
    key: number | bigint,
    value: any,
    TTL: number = Number.MAX_SAFE_INTEGER,
  ): void {
    this.cache.set(key, value)
    setTimeout(() => this.cache.delete(key), TTL * 1000)
  }

  /**
   * Gets a value from the cache with the specified key.
   *
   * @param {number | bigint} key - The key to get the value from the cache.
   * @return {any} The value from the cache if it exists, otherwise `undefined`.
   */
  get(key: number | bigint) {
    return this.cache.get(key)
  }

  /**
   * Checks if a value exists in the cache with the specified key.
   *
   * @param {number | bigint} key - The key to check for in the cache.
   * @return {boolean} `true` if the value exists in the cache, `false` otherwise.
   */
  has(key: number | bigint): boolean {
    return this.cache.has(key)
  }

  /**
   * Removes a value from the cache with the specified key.
   *
   * @return {void} This function does not return anything.
   */
  clear(): void {
    this.cache.clear()
  }
}

const memCache = new MemCache()

export default memCache
