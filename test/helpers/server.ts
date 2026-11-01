/**
 * A real loopback HTTP server standing in for an OpenAI-compatible endpoint.
 *
 * Nothing leaves the machine: the suite points the plugin at
 * `http://127.0.0.1:<random port>`, so the production path (global fetch,
 * FormData, bearer header) is exercised without a key or a network.
 */

import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

/** One captured request. */
export interface StubRequest {
  method: string | undefined
  url: string | undefined
  headers: Record<string, string | string[] | undefined>
  body: Buffer
}

/** Request handler; a throw is answered with a 500 so a broken fake never hangs the suite. */
export type StubHandler = (request: StubRequest, res: ServerResponse) => unknown

export interface StubServer {
  /** Base URL to point a route at, without a trailing slash. */
  baseURL: string
  /** Every request the server saw, in order. */
  requests: StubRequest[]
  /** Stop the server. */
  close: () => Promise<void>
}

/**
 * Start a throwaway server on a random loopback port.
 *
 * @param handler how to answer requests.
 * @returns the handle to stop and inspect.
 */
export async function startSttServer (handler: StubHandler): Promise<StubServer> {
  const requests: StubRequest[] = []

  const server: Server = createServer((req: IncomingMessage, res) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('error', () => {})

    req.on('end', () => {
      const record: StubRequest = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks) }

      requests.push(record)

      try {
        handler(record, res)
      } catch {
        reply(res, 500, { error: 'stub handler threw' })
      }
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  const { port } = server.address() as AddressInfo

  return {
    baseURL: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error === undefined) resolve()
        else reject(error)
      })
    }),
  }
}

/**
 * Answer with a JSON payload.
 *
 * @param res response handle.
 * @param status HTTP status.
 * @param payload body to serialise.
 */
export function reply (res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)

  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
  res.end(body)
}

/** A multipart body split into its text fields and its file part. */
export interface Multipart {
  /** Text fields by name. */
  fields: Record<string, string>
  /** Filename of the file part, if any. */
  filename?: string
  /** Content type of the file part, if any. */
  contentType?: string
  /** Bytes of the file part. */
  file: Buffer
}

/**
 * Parse a `multipart/form-data` request without any dependency.
 *
 * @param request the captured request.
 * @returns its fields and file part.
 */
export function readMultipart (request: StubRequest): Multipart {
  const header = request.headers['content-type']
  const boundary = typeof header === 'string' ? /boundary=(?:"([^"]+)"|([^;]+))/.exec(header) : undefined
  const delimiter = `--${(boundary?.[1] ?? boundary?.[2] ?? '')}`

  const result: Multipart = { fields: {}, file: Buffer.alloc(0) }

  for (const chunk of request.body.toString('binary').split(delimiter)) {
    const split = chunk.indexOf('\r\n\r\n')

    if (split < 0) continue

    const headers = chunk.slice(0, split)
    const content = Buffer.from(chunk.slice(split + 4).replace(/\r\n$/, ''), 'binary')
    const name = /name="([^"]*)"/.exec(headers)?.[1]

    if (name === undefined) continue

    const filename = /filename="([^"]*)"/.exec(headers)?.[1]

    if (filename === undefined) {
      result.fields[name] = content.toString('utf8')

      continue
    }

    result.filename = filename
    result.contentType = /content-type:\s*([^;\r\n]+)/i.exec(headers)?.[1]
    result.file = content
  }

  return result
}
