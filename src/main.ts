import { Elysia, mapResponse } from 'elysia'
import type {
  CacheOptions,
  CompressionEncoding,
  CompressionOptions,
  LifeCycleOptions,
} from './types'
import {
  BrotliOptions,
  ZlibOptions,
  constants,
  brotliCompressSync,
  gzipSync,
  deflateSync,
} from 'node:zlib'
import { CompressionStream } from './compression-stream'
import cacheStore from './cache'

/**
 * Creates a compression middleware function that compresses the response body based on the client's accept-encoding header.
 *
 * @param {CompressionOptions & LifeCycleOptions & CacheOptions} [options] - Optional compression, caching, and life cycle options.
 * @param {CompressionOptions} [options.compressionOptions] - Compression options.
 * @param {LifeCycleOptions} [options.lifeCycleOptions] - Life cycle options.
 * @param {CacheOptions} [options.cacheOptions] - Cache options.
 * @param {CompressionEncoding[]} [options.compressionOptions.encodings] - An array of supported compression encodings. Defaults to ['br', 'gzip', 'deflate'].
 * @param {boolean} [options.compressionOptions.disableByHeader] - Disable compression by header. Defaults to false.
 * @param {BrotliOptions} [options.compressionOptions.brotliOptions] - Brotli compression options.
 * @param {ZlibOptions} [options.compressionOptions.zlibOptions] - Zlib compression options.
 * @param {LifeCycleType} [options.lifeCycleOptions.as] - The life cycle type. Defaults to 'scoped'.
 * @param {number} [options.compressionOptions.threshold] - The minimum byte size for a response to be compressed. Defaults to 1024.
 * @param {number} [options.cacheOptions.TTL] - The time-to-live for the cache. Defaults to 24 hours.
 * @returns {Elysia} - The Elysia app with compression middleware.
 */
export const compression = (
  options?: CompressionOptions & LifeCycleOptions & CacheOptions,
) => {
  const zlibOptions: ZlibOptions = {
    ...{
      level: 6,
    },
    ...options?.zlibOptions,
  }
  const brotliOptions: BrotliOptions = {
    ...{
      params: {
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_DEFAULT_QUALITY,
      },
    },
    ...options?.brotliOptions,
  }
  const defaultEncodings = options?.encodings ?? ['br', 'gzip', 'deflate']
  const defaultCompressibleTypes =
    /^text\/(?!event-stream)|(?:\+|\/)json(?:;|$)|(?:\+|\/)text(?:;|$)|(?:\+|\/)xml(?:;|$)|octet-stream(?:;|$)/u
  const lifeCycleType = options?.as ?? 'global'
  const threshold = options?.threshold ?? 1024
  const cacheTTL = options?.TTL ?? 24 * 60 * 60 // 24 hours
  const disableByHeader = options?.disableByHeader ?? true
  const compressStream = options?.compressStream ?? true
  const app = new Elysia({
    name: 'elysia-compress',
    seed: options,
  })

  const compressors = {
    br: (buffer: ArrayBuffer) => brotliCompressSync(buffer, brotliOptions),
    gzip: (buffer: ArrayBuffer) => gzipSync(buffer, zlibOptions),
    deflate: (buffer: ArrayBuffer) => deflateSync(buffer, zlibOptions),
  } as Record<CompressionEncoding, (buffer: ArrayBuffer) => Buffer>
  const textDecoder = new TextDecoder()

  /**
   * Gets or compresses the response body based on the client's accept-encoding header.
   *
   * @param {CompressionEncoding} algorithm - The compression algorithm to use.
   * @param {ArrayBuffer} buffer - The buffer to compress.
   * @returns {Buffer} The compressed buffer.
   */
  const getOrCompress = (
    algorithm: CompressionEncoding,
    buffer: ArrayBuffer,
  ): Buffer => {
    const cacheKey = Bun.hash(`${algorithm}:${textDecoder.decode(buffer)}}`)
    if (cacheStore.has(cacheKey)) {
      return cacheStore.get(cacheKey)
    }

    const compressedOutput = compressors[algorithm](buffer)
    cacheStore.set(cacheKey, compressedOutput, cacheTTL)
    return compressedOutput
  }

  /**
   * Compresses the response body based on the client's accept-encoding header.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
   */
  app.mapResponse({ as: lifeCycleType }, async (ctx) => {
    // Disable compression when `x-no-compression` header is set
    if (disableByHeader && ctx.headers['x-no-compression']) {
      return
    }

    const { set } = ctx
    const response = ctx.response as any

    const acceptEncodings: string[] =
      ctx.headers['accept-encoding']?.split(', ') ?? []
    const encodings: string[] = defaultEncodings.filter((encoding) =>
      acceptEncodings.includes(encoding),
    )

    if (encodings.length < 1 && !encodings[0]) {
      return
    }

    const encoding = encodings[0] as CompressionEncoding
    let compressed: Buffer | ReadableStream<Uint8Array>
    let contentType =
      set.headers['Content-Type'] ?? set.headers['content-type'] ?? ''

    /**
     * Compress ReadableStream Object if stream exists (SSE)
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
     */
    if (compressStream && response?.stream instanceof ReadableStream) {
      const stream = response.stream as ReadableStream
      compressed = stream.pipeThrough(CompressionStream(encoding, options))
    } else {
      const res = mapResponse(response, {
        headers: {},
      })
      const resContentType = res.headers.get('Content-Type')

      contentType = resContentType ? resContentType : 'text/plain'

      const buffer = await res.arrayBuffer()
      // Disable compression when buffer size is less than threshold
      if (buffer.byteLength < threshold) {
        return
      }

      // Disable compression when Content-Type is not compressible
      const isCompressible = defaultCompressibleTypes.test(contentType)
      if (!isCompressible) {
        return
      }

      compressed = getOrCompress(encoding, buffer) // Will try cache first
    }

    /**
     * Send Vary HTTP Header
     *
     * The Vary HTTP response header describes the parts of the request message aside
     * from the method and URL that influenced the content of the response it occurs in.
     * Most often, this is used to create a cache key when content negotiation is in use.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary
     */
    const vary = set.headers.Vary ?? set.headers.vary
    if (vary) {
      const rawHeaderValue = vary
        ?.split(',')
        .map((v: any) => v.trim().toLowerCase())

      const headerValueArray = Array.isArray(rawHeaderValue)
        ? rawHeaderValue
        : [rawHeaderValue]

      // Add accept-encoding header if it doesn't exist
      // and if vary not set to *
      if (!headerValueArray.includes('*')) {
        set.headers.Vary = headerValueArray
          .concat('accept-encoding')
          .filter((value, index, array) => array.indexOf(value) === index)
          .join(', ')
      }
    } else {
      set.headers.Vary = 'accept-encoding'
    }
    set.headers['Content-Encoding'] = encoding

    return new Response(compressed, {
      headers: {
        'Content-Type': contentType,
      },
    })
  })
  return app
}
