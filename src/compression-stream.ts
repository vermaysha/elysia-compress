import zlib from 'node:zlib'
import { Transform } from 'stream'
import type { CompressionEncoding, CompressionOptions } from './types'

/**
 * Creates a compression stream based on the specified encoding and options.
 *
 * @param {CompressionEncoding} encoding - The compression encoding to use.
 * @param {CompressionOptions} [options] - The compression options.
 * @returns {{ readable: ReadableStream<Uint8Array>, writable: WritableStream<Uint8Array> }} The compression stream.
 */
export const CompressionStream = (
  encoding: CompressionEncoding,
  options?: CompressionOptions,
) => {
  let handler: Transform

  const zlibOptions: zlib.ZlibOptions = {
    ...{
      level: 6,
    },
    ...options?.zlibOptions,
  }
  const brotliOptions: zlib.BrotliOptions = {
    ...{
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_QUALITY]:
          zlib.constants.BROTLI_DEFAULT_QUALITY,
      },
    },
    ...options?.brotliOptions,
  }

  if (encoding === 'br') {
    handler = zlib.createBrotliCompress(brotliOptions)
  } else if (encoding === 'gzip') {
    handler = zlib.createGzip(zlibOptions)
  } else if (encoding === 'deflate') {
    handler = zlib.createDeflate(zlibOptions)
  } else {
    handler = new Transform({
      /**
       * Transforms the given chunk of data and calls the callback with the transformed data.
       *
       * @param {any} chunk - The chunk of data to be transformed.
       * @param {any} _ - Unused parameter.
       * @param {any} callback - The callback function to be called with the transformed data.
       * @return {void}
       */
      transform(chunk: any, _: any, callback: any): void {
        callback(null, chunk)
      },
    })
  }

  const readable = new ReadableStream({
    /**
     * Starts the stream and sets up event listeners for 'data' and 'end' events.
     *
     * @param {ReadableStreamDefaultController<Uint8Array>} controller - The controller object for the readable stream.
     */
    start(controller: ReadableStreamDefaultController<Uint8Array>) {
      handler.on('data', (chunk: Uint8Array) => controller.enqueue(chunk))
      handler.once('end', () => controller.close())
    },
  })

  const writable = new WritableStream({
    /**
     * Writes a chunk of data to the writable stream.
     *
     * @param {Uint8Array} chunk - The chunk of data to write.
     * @returns {Promise<void>}
     */
    write: (chunk: Uint8Array): Promise<void> => handler.write(chunk) as any,

    /**
     * Closes the writable stream.
     *
     * @returns {Promise<void>}
     */
    close: (): Promise<void> => handler.end() as any,
  })

  return {
    readable,
    writable,
  }
}
