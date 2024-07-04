export const req = (headers: { [key: string]: string } = {}) =>
  new Request('http://localhost/', {
    headers: {
      'accept-encoding': 'br, deflate, gzip, zstd',
      ...headers,
    },
  })

export const responseShort = `
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`

export const responseLong = responseShort.repeat(100)

export const jsonResponse = Bun.file('./tests/data.json')
