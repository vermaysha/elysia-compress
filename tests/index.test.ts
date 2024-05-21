import { describe, it, expect } from 'bun:test'

import { Elysia } from 'elysia'
import { Stream } from '@elysiajs/stream'
import { compression } from '../src/index.js'

const req = () =>
  new Request('http://localhost/', {
    headers: {
      'accept-encoding': 'br, deflate, gzip, zstd',
    },
  })

const response = `
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`

describe('Compression With Elysia', () => {
  it('Dont compress when the threshold is not met', async () => {
    const app = new Elysia()
      .use(
        compression({
          encodings: ['br'],
          threshold: 1024,
        }),
      )
      .get('/', () => response)
    const res = await app.handle(req())

    expect(res.headers.get('Content-Encoding')).toBeNull()
  })

  it('handle brotli compression', async () => {
    const app = new Elysia()
      .use(
        compression({
          encodings: ['br'],
          threshold: 1,
        }),
      )
      .get('/', () => response)
    const res = await app.handle(req())

    expect(res.headers.get('Content-Encoding')).toBe('br')
  })

  it('handle deflate compression', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['deflate'], threshold: 1 }))
      .get('/', () => response)
    const res = await app.handle(req())

    expect(res.headers.get('Content-Encoding')).toBe('deflate')
  })

  it('handle gzip compression', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', () => response)
    const res = await app.handle(req())

    expect(res.headers.get('Content-Encoding')).toBe('gzip')
  })

  it('accept additional headers', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['deflate'], threshold: 1 }))
      .get('/', ({ set }) => {
        set.headers['x-powered-by'] = 'Elysia'

        return response
      })
    const res = await app.handle(req())

    expect(res.headers.get('Content-Encoding')).toBe('deflate')
    expect(res.headers.get('x-powered-by')).toBe('Elysia')
  })

  it('return correct plain/text', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', () => response)

    const res = await app.handle(req())

    expect(res.headers.get('Content-Type')).toBe('text/plain')
  })

  it('return correct application/json', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', () => ({ hello: 'world' }))

    const res = await app.handle(req())

    expect(res.headers.get('Content-Type')).toBe(
      'application/json;charset=utf-8',
    )
  })

  it('return correct image type', async () => {
    const app = new Elysia()
      .use(compression({ encodings: ['gzip'], threshold: 1 }))
      .get('/', () => Bun.file('tests/waifu.png'))

    const res = await app.handle(req())

    expect(res.headers.get('Content-Type')).toBe('image/png')
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
        test.set({
          value: 'test',
        })
      })

    const res = await app.handle(req())

    expect(res.headers.get('set-cookie')).toBe('test=test')
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
  })
})
