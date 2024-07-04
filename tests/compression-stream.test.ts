import { describe, expect, it } from 'bun:test'
import { CompressionStream } from '../src/compression-stream'
import zlib from 'node:zlib'
import { responseShort } from './setup'

describe('CompressionStream', () => {
  it('should create a compression stream', () => {
    const stream = CompressionStream('br')
    expect(stream).toBeDefined()
    expect(stream.readable).toBeDefined()
    expect(stream.writable).toBeDefined()
  })

  it('compresses data using br encoding and verifies output', async () => {
    // Sample data to compress
    const testData = new TextEncoder().encode(responseShort)

    // Create a compression stream with Brotli encoding
    const { readable, writable } = CompressionStream('br')

    // Use the WritableStream to write the test data
    const writer = writable.getWriter()
    await writer.write(testData)
    await writer.close()

    // Read from the ReadableStream and collect the compressed data
    const reader = readable.getReader()
    let compressedData = new Uint8Array()
    let done = false
    while (!done) {
      const { value, done: streamDone } = await reader.read()
      if (value) {
        // This example simply concatenates chunks; for larger data, consider a more efficient method
        compressedData = new Uint8Array([...compressedData, ...value])
      }
      done = streamDone
    }

    // Verify the compressed data
    // Expect the compressed data to exist and be different from the original
    expect(compressedData.byteLength).toBeGreaterThan(0)
    expect(compressedData).not.toEqual(testData)

    // Further verification could include decompressing `compressedData` and comparing with `testData`
    // and checking that the decompressed data matches the original.

    // Verify that the decompressed data matches the original
    const decompressedData = new TextDecoder().decode(
      zlib.brotliDecompressSync(compressedData),
    )
    expect(decompressedData).toEqual(responseShort)
  })

  it('compresses data using gzip encoding and verifies output', async () => {
    // Sample data to compress
    const testData = new TextEncoder().encode(responseShort)

    // Create a compression stream with Brotli encoding
    const { readable, writable } = CompressionStream('gzip')

    // Use the WritableStream to write the test data
    const writer = writable.getWriter()
    await writer.write(testData)
    await writer.close()

    // Read from the ReadableStream and collect the compressed data
    const reader = readable.getReader()
    let compressedData = new Uint8Array()
    let done = false
    while (!done) {
      const { value, done: streamDone } = await reader.read()
      if (value) {
        // This example simply concatenates chunks; for larger data, consider a more efficient method
        compressedData = new Uint8Array([...compressedData, ...value])
      }
      done = streamDone
    }

    // Verify the compressed data
    // Expect the compressed data to exist and be different from the original
    expect(compressedData.byteLength).toBeGreaterThan(0)
    expect(compressedData).not.toEqual(testData)

    // Further verification could include decompressing `compressedData` and comparing with `testData`
    // and checking that the decompressed data matches the original.

    // Verify that the decompressed data matches the original
    const decompressedData = new TextDecoder().decode(
      zlib.gunzipSync(compressedData),
    )
    expect(decompressedData).toEqual(responseShort)
  })

  it('compresses data using deflate encoding and verifies output', async () => {
    // Sample data to compress
    const testData = new TextEncoder().encode(responseShort)

    // Create a compression stream with Brotli encoding
    const { readable, writable } = CompressionStream('deflate')

    // Use the WritableStream to write the test data
    const writer = writable.getWriter()
    await writer.write(testData)
    await writer.close()

    // Read from the ReadableStream and collect the compressed data
    const reader = readable.getReader()
    let compressedData = new Uint8Array()
    let done = false
    while (!done) {
      const { value, done: streamDone } = await reader.read()
      if (value) {
        // This example simply concatenates chunks; for larger data, consider a more efficient method
        compressedData = new Uint8Array([...compressedData, ...value])
      }
      done = streamDone
    }

    // Verify the compressed data
    // Expect the compressed data to exist and be different from the original
    expect(compressedData.byteLength).toBeGreaterThan(0)
    expect(compressedData).not.toEqual(testData)

    // Further verification could include decompressing `compressedData` and comparing with `testData`
    // and checking that the decompressed data matches the original.

    // Verify that the decompressed data matches the original
    const decompressedData = new TextDecoder().decode(
      zlib.inflateSync(compressedData),
    )
    expect(decompressedData).toEqual(responseShort)
  })

  it(`Don't compress when algorithm is invalid`, async () => {
    // Sample data to compress
    const testData = new TextEncoder().encode(responseShort)

    // Create a compression stream with Brotli encoding
    const { readable, writable } = CompressionStream('' as any)

    // Use the WritableStream to write the test data
    const writer = writable.getWriter()
    await writer.write(testData)
    await writer.close()

    // Read from the ReadableStream and collect the compressed data
    const reader = readable.getReader()
    let compressedData = new Uint8Array()
    let done = false
    while (!done) {
      const { value, done: streamDone } = await reader.read()
      if (value) {
        // This example simply concatenates chunks; for larger data, consider a more efficient method
        compressedData = new Uint8Array([...compressedData, ...value])
      }
      done = streamDone
    }

    // Verify the compressed data
    // Expect the compressed data to exist and be different from the original
    expect(compressedData.byteLength).toBeGreaterThan(0)
    expect(compressedData).toEqual(testData)
  })
})
