/**
 * HLS M3U8 Parser
 * Handles both master playlists (variant list) and media playlists (segment list).
 */

/**
 * Parse an m3u8 manifest
 * @param {string} text - Raw m3u8 content
 * @param {string} baseUrl - Manifest URL (used to resolve relative URIs)
 * @returns {{ initSegment: string | null, segments: string[], variantPlaylists: string[] }}
 */
export function parseM3u8(text, baseUrl) {
  const base = baseUrl.replace(/\/[^/]*$/, '/')
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let initSegment = null
  const segments = []
  const variantPlaylists = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Init segment (fMP4)
    if (line.startsWith('#EXT-X-MAP:')) {
      const match = line.match(/URI="([^"]+)"/)
      if (match) initSegment = resolveUrl(match[1], base)
      continue
    }
    
    // Master playlist variant
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const next = lines[i + 1]
      if (next && !next.startsWith('#')) {
        variantPlaylists.push(resolveUrl(next, base))
        i++
      }
      continue
    }
    
    // Media segment
    if (line.startsWith('#EXTINF:')) {
      const next = lines[i + 1]
      if (next && !next.startsWith('#')) {
        segments.push(resolveUrl(next, base))
        i++
      }
    }
  }

  return { initSegment, segments, variantPlaylists }
}

/**
 * Resolve a relative URL against a base URL
 */
export function resolveUrl(uri, base) {
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri
  if (uri.startsWith('/')) {
    try {
      const u = new URL(base)
      return `${u.origin}${uri}`
    } catch (_) {
      return base + uri.replace(/^\//, '')
    }
  }
  return base + uri
}

/**
 * Load HLS manifest, following variant playlists if needed
 * @param {string} url - Manifest URL
 * @param {AbortSignal} signal - Abort signal
 * @returns {Promise<{ initSegment: string | null, segments: string[] }>}
 */
export async function loadHlsManifest(url, signal) {
  const response = await fetch(url, { signal })
  const text = await response.text()
  const baseUrl = new URL(url).href
  const parsed = parseM3u8(text, baseUrl)
  
  // If it's a master playlist, follow the first variant
  if (parsed.segments.length === 0 && parsed.variantPlaylists.length > 0) {
    return loadHlsManifest(parsed.variantPlaylists[0], signal)
  }
  
  return {
    initSegment: parsed.initSegment,
    segments: parsed.segments,
  }
}
