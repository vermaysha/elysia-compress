import { describe, expect, it } from 'bun:test'
import zlib from 'node:zlib'
import Elysia from 'elysia'
import staticPlugin from '@elysiajs/static'
import { Stream } from '@elysiajs/stream'
import { cors } from '@elysiajs/cors'

import { req, responseShort, imageResponse, jsonResponse } from './setup'
import compression from '../src'

describe(`elysia-compress`, () => {
  it('Dont compress when the threshold is not met', async () => {
    const app = new Elysia()
      .use(
        compression({
          encodings: ['br'],
          threshold: 1024,
        }),
      )
      .get('/', () => responseShort)
    const res = await app.handle(req())

    expect(res.headers.get('Content-Encoding')).toBeNull()
    expect(res.headers.get('vary')).toBeNull()
  })

  it('handle brotli compression', async () => {
    const app = new Elysia()
      .use(
        compression({
          encodings: ['br'],
          threshold: 1,
        }),
      )
      .get('/', () => responseShort)
    const res = await app.handle(req())

    expect(res.headers.get('Content-Encoding')).toBe('br')
    expect(res.headers.get('vary')).toBe('accept-encoding')
  })

  it('handle deflate compression', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['deflate'], threshold: 1 }))
      .get('/', () => responseShort)
    const res = await app.handle(req())

    expect(res.headers.get('Content-Encoding')).toBe('deflate')
    expect(res.headers.get('vary')).toBe('accept-encoding')
  })

  it('handle gzip compression', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', () => responseShort)
    const res = await app.handle(req())

    expect(res.headers.get('Content-Encoding')).toBe('gzip')
    expect(res.headers.get('vary')).toBe('accept-encoding')
  })

  it('accept additional headers', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['deflate'], threshold: 1 }))
      .get('/', ({ set }) => {
        set.headers['x-powered-by'] = 'Elysia'

        return responseShort
      })
    const res = await app.handle(req())

    expect(res.headers.get('Content-Encoding')).toBe('deflate')
    expect(res.headers.get('x-powered-by')).toBe('Elysia')
    expect(res.headers.get('vary')).toBe('accept-encoding')
  })

  it('return correct plain/text', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', () => responseShort)

    const res = await app.handle(req())

    expect(res.headers.get('Content-Type')).toBe('text/plain')
    expect(res.headers.get('vary')).toBe('accept-encoding')
  })

  it('return correct application/json', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', () => ({ hello: 'world' }))

    const res = await app.handle(req())

    expect(res.headers.get('Content-Type')).toBe(
      'application/json;charset=utf-8',
    )
    expect(res.headers.get('vary')).toBe('accept-encoding')
  })

  it('return correct image', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', () => imageResponse)

    const res = await app.handle(req())

    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get('vary')).toBeNull()

    const actualBody = await res.arrayBuffer()
    const expectedBody = await imageResponse.arrayBuffer()
    expect(actualBody).toEqual(expectedBody)
  })

  it('return correct image from static plugin', async () => {
    const app = new Elysia()
      .use(staticPlugin({ assets: 'tests/images', prefix: '' }))
      .use(compression())

    await app.modules

    const res = await app.handle(
      new Request('http://localhost/waifu.png', {
        headers: { 'accept-encoding': 'br, deflate, gzip, zstd' },
      }),
    )

    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get('vary')).toBeNull()

    const actualBody = await res.arrayBuffer()
    const expectedBody = await imageResponse.arrayBuffer()
    expect(actualBody).toEqual(expectedBody)
  })

  it('must be redirected to /not-found', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', ({ set }) => {
        set.redirect = '/not-found'
      })

    const res = await app.handle(req())

    expect(res.headers.get('Location')).toBe('/not-found')
  })

  it('cookie should be set', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', ({ cookie: { test } }) => {
        test?.set({
          value: 'test',
        })
      })

    const res = await app.handle(req())

    expect(res.headers.get('set-cookie')).toContain('test=test')
  })

  it('stream should be compressed', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', () => {
        return new Stream(async (stream) => {
          stream.send('hello')

          await stream.wait(1000)
          stream.send('world')

          stream.close()
        })
      })

    const res = await app.handle(req())

    expect(res.headers.get('Content-Encoding')).toBe('gzip')
    expect(res.headers.get('vary')).toBe('accept-encoding')
  })

  it('cors should be enable when threshold 1024', async () => {
    const app = new Elysia()
      .use(
        cors({
          origin: true,
        }),
      )
      .use(compression({ encodings: ['gzip'], threshold: 1024 }))
      .get('/', () => {
        return new Stream(async (stream) => {
          stream.send('hello')

          await stream.wait(1000)
          stream.send('world')

          stream.close()
        })
      })

    const res = await app.handle(req())

    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('cors should be enable when threshold 1', async () => {
    const app = new Elysia()
      .use(
        cors({
          origin: true,
        }),
      )
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', () => {
        return new Stream(async (stream) => {
          stream.send('hello')

          await stream.wait(1000)
          stream.send('world')

          stream.close()
        })
      })

    const res = await app.handle(req())

    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('vary')).toBe('*')
  })

  it(`Should't compress response if threshold is not met minimum size (1024)`, async () => {
    const app = new Elysia()
      .use(compression({ threshold: 1024 }))
      .get('/', () => {
        return responseShort
      })

    const res = await app.handle(req())

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Encoding')).toBeNull()
    expect(res.headers.get('Vary')).toBeNull()
  })

  it(`Should't compress response if x-no-compression header is present`, async () => {
    const app = new Elysia()
      .use(compression({ disableByHeader: true }))
      .get('/', () => {
        return responseShort
      })

    const res = await app.handle(req({ 'x-no-compression': 'true' }))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Encoding')).toBeNull()
    expect(res.headers.get('Vary')).toBeNull()
  })

  it(`When not compress response send original response`, async () => {
    const app = new Elysia()
      .use(compression({ threshold: 1024 }))
      .get('/', () => {
        return responseShort
      })

    const res = await app.handle(req())
    const test = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Encoding')).toBeNull()
    expect(res.headers.get('Vary')).toBeNull()
    expect(test).toBe(responseShort)
  })

  it(`When not compress response should send original content-type`, async () => {
    const app = new Elysia()
      .use(compression({ threshold: Number.MAX_SAFE_INTEGER }))
      .get('/', () => {
        return jsonResponse
      })

    const res = await app.handle(req())
    const test = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Encoding')).toBeNull()
    expect(res.headers.get('Vary')).toBeNull()
    expect(test).toBe(await jsonResponse.text())
    expect(res.headers.get('Content-Type')).toBe(
      'application/json;charset=utf-8',
    )
  })

  it(`Should'nt compress response if browser not support any compression algorithm`, async () => {
    const app = new Elysia()
      .use(compression({ threshold: 1024 }))
      .get('/', () => {
        return responseShort
      })

    const res = await app.handle(req({ 'accept-encoding': '*' }))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Encoding')).toBeNull()
    expect(res.headers.get('Vary')).toBeNull()
  })

  it(`Should return data from cache`, async () => {
    const app = new Elysia().use(compression({ threshold: 0 })).get('/', () => {
      return responseShort
    })

    const res = await app.handle(req())
    const test = zlib
      .brotliDecompressSync(await res.arrayBuffer())
      .toString('utf-8')

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Encoding')).toBe('br')
    expect(res.headers.get('Vary')).toBe('accept-encoding')
    expect(test).toBe(responseShort)

    const res2 = await app.handle(req())
    const test2 = zlib
      .brotliDecompressSync(await res2.arrayBuffer())
      .toString('utf-8')

    expect(res2.status).toBe(200)
    expect(res2.headers.get('Content-Encoding')).toBe('br')
    expect(res2.headers.get('Vary')).toBe('accept-encoding')
    expect(test2).toBe(responseShort)
    expect(test2).toBe(test)
  })

  it(`Don't append vary header if values are *`, async () => {
    const app = new Elysia()
      .use(compression({ threshold: 0 }))
      .get('/', (ctx) => {
        ctx.set.headers['Vary'] = 'location, header'
        return responseShort
      })

    const res = await app.handle(req())

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Encoding')).toBe('br')
    expect(res.headers.get('Vary')).toBe('location, header, accept-encoding')
  })
})
