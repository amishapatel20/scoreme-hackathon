export type ApiError = {
  status: number
  message: string
  details?: unknown
}

async function readErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('application/json')) return await response.json()
    return await response.text()
  } catch {
    return null
  }
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const details = await readErrorBody(res)
    throw {
      status: res.status,
      message: `GET ${path} failed (${res.status})`,
      details,
    } satisfies ApiError
  }
  return (await res.json()) as T
}

export async function postJson<T>(
  path: string,
  body: unknown,
  options?: { headers?: Record<string, string> },
): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options?.headers ?? {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const details = await readErrorBody(res)
    throw {
      status: res.status,
      message: `POST ${path} failed (${res.status})`,
      details,
    } satisfies ApiError
  }

  return (await res.json()) as T
}
