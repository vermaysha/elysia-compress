import { Elysia, mapResponse } from 'elysia'
import type {
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

/**
 * Creates a compression middleware function that compresses the response body based on the client's accept-encoding header.
 *
 * @param {CompressionOptions & LifeCycleOptions} [options] - Optional compression options and life cycle options.
 * @param {CompressionOptions} [options.compressionOptions] - Compression options.
 * @param {LifeCycleOptions} [options.lifeCycleOptions] - Life cycle options.
 * @param {CompressionEncoding[]} [options.compressionOptions.encodings] - An array of supported compression encodings. Defaults to ['br', 'gzip', 'deflate'].
 * @param {boolean} [options.compressionOptions.disableByHeader] - Disable compression by header. Defaults to false.
 * @param {BrotliOptions} [options.compressionOptions.brotliOptions] - Brotli compression options.
 * @param {ZlibOptions} [options.compressionOptions.zlibOptions] - Zlib compression options.
 * @param {LifeCycleType} [options.lifeCycleOptions.as] - The life cycle type. Defaults to 'scoped'.
 * @returns {Elysia} - The Elysia app with compression middleware.
 */
export const compression = (
  options?: CompressionOptions & LifeCycleOptions,
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
  const app = new Elysia({
    name: 'elysia-compress',
    seed: options,
  })

  /**
   * Compresses the response body based on the client's accept-encoding header.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
   */
  app.mapResponse({ as: lifeCycleType }, async (ctx) => {
    // Disable compression when `x-no-compression` header is set
    if (options?.disableByHeader && ctx.headers['x-no-compression']) {
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
    let contentType = set.headers['Content-Type'] ?? ''

    /**
     * Compress ReadableStream Object if stream exists (SSE)
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
     */
    if (response?.stream && response.stream instanceof ReadableStream) {
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

      if (encoding === 'br') {
        compressed = brotliCompressSync(buffer, brotliOptions)
      } else if (encoding === 'gzip') {
        compressed = gzipSync(buffer, zlibOptions)
      } else if (encoding === 'deflate') {
        compressed = deflateSync(buffer, zlibOptions)
      } else {
        return
      }
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
    if (set.headers.Vary) {
      const rawHeaderValue = set.headers.Vary?.split(',').map((v: any) =>
        v.trim().toLowerCase(),
      )

      const headerValueArray = Array.isArray(rawHeaderValue)
        ? rawHeaderValue
        : [rawHeaderValue]

      // Add accept-encoding header if it doesn't exist
      // and if vary not set to *
      if (
        !headerValueArray.some((h) => h.includes('accept-encoding')) &&
        !headerValueArray.includes('*')
      ) {
        set.headers.Vary = headerValueArray.concat('accept-encoding').join(', ')
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
