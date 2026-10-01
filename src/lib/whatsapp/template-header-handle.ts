import { uploadResumableMedia } from '@/lib/whatsapp/meta-api'
import type { TemplatePayload } from '@/lib/whatsapp/template-validators'
import { isDeliverableUrl } from '@/lib/webhooks/ssrf'

/**
 * Meta requires an `example.header_handle` (from the Resumable Upload
 * API) to create/edit a template with an IMAGE, DOCUMENT, or VIDEO header —
 * a plain public URL is not accepted at creation time. This helper turns
 * the template's `header_media_url` into a handle and writes it onto the
 * payload, so both the upload path and the pasted URL path succeed.
 */

interface MediaConfig {
  maxBytes: number
  allowedTypes: string[]
  defaultFileName: (type: string) => string
  defaultMime: string
  label: string
  typeDesc: string
  sizeLimitDesc: string
}

const MEDIA_CONFIG: Record<'image' | 'document' | 'video', MediaConfig> = {
  image: {
    maxBytes: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png'],
    defaultFileName: (type: string) => (type === 'image/png' ? 'header.png' : 'header.jpg'),
    defaultMime: 'image/jpeg',
    label: 'image',
    typeDesc: 'JPEG or PNG',
    sizeLimitDesc: '5 MB',
  },
  document: {
    maxBytes: 16 * 1024 * 1024,
    allowedTypes: ['application/pdf', 'application/octet-stream'],
    defaultFileName: () => 'header.pdf',
    defaultMime: 'application/pdf',
    label: 'document',
    typeDesc: 'PDF',
    sizeLimitDesc: '16 MB',
  },
  video: {
    maxBytes: 16 * 1024 * 1024,
    allowedTypes: ['video/mp4', 'video/3gpp'],
    defaultFileName: (type: string) => (type === 'video/3gpp' ? 'header.3gp' : 'header.mp4'),
    defaultMime: 'video/mp4',
    label: 'video',
    typeDesc: 'MP4 or 3GPP',
    sizeLimitDesc: '16 MB',
  },
}

export async function ensureMediaHeaderHandle(
  payload: TemplatePayload,
  accessToken: string,
): Promise<void> {
  const headerType = payload.header_type
  if (!headerType || headerType === 'text') return
  if (headerType !== 'image' && headerType !== 'document' && headerType !== 'video') return
  if (payload.header_handle) return // already have one
  if (!payload.header_media_url) return // validator already requires url-or-handle

  const config = MEDIA_CONFIG[headerType]

  const appId = process.env.META_APP_ID
  if (!appId) {
    throw new Error(
      `${config.label === 'image' ? 'Image' : config.label.toUpperCase()}-header templates need META_APP_ID set (used for Meta’s Resumable Upload). Add it to your environment, or remove the ${config.label} header.`,
    )
  }

  // SSRF guard: `header_media_url` is caller-supplied (any authenticated
  // member can submit a template) and the fetch below happens server-side,
  // so refuse any destination that resolves to a private / loopback /
  // link-local / reserved address.
  if (!(await isDeliverableUrl(payload.header_media_url))) {
    throw new Error(`Could not fetch the header ${config.label} URL. Make sure it is publicly reachable.`)
  }

  // Fetch the sample media bytes.
  let res: Response
  try {
    res = await fetch(payload.header_media_url, {
      // Do NOT follow redirects — a public URL could 3xx-bounce to an
      // internal address, defeating the guard above.
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new Error(`Could not fetch the header ${config.label} URL. Make sure it is publicly reachable.`)
  }
  if (!res.ok) {
    throw new Error(`Header ${config.label} URL returned ${res.status}. It must be publicly reachable.`)
  }

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (contentType && !config.allowedTypes.includes(contentType)) {
    throw new Error(`Header ${config.label} must be ${config.typeDesc} (got ${contentType}).`)
  }

  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error(`Header ${config.label} is empty.`)
  }
  if (bytes.byteLength > config.maxBytes) {
    throw new Error(
      `Header ${config.label} is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB — Meta's limit is ${config.sizeLimitDesc}.`,
    )
  }

  const mimeType = config.allowedTypes.includes(contentType) ? contentType : config.defaultMime
  const fileName = config.defaultFileName(contentType)

  const { handle } = await uploadResumableMedia({
    appId,
    accessToken,
    fileName,
    mimeType,
    bytes,
  })
  payload.header_handle = handle
}

/**
 * Backward-compatible alias for callers expecting ensureImageHeaderHandle.
 */
export const ensureImageHeaderHandle = ensureMediaHeaderHandle

