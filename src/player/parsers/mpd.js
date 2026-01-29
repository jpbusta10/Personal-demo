/**
 * DASH MPD Parser
 * Supports SegmentList and SegmentTemplate with $Number$ substitution.
 */

/**
 * Parse an MPD manifest
 * @param {string} xml - Raw MPD XML
 * @param {string} baseUrl - MPD URL (used to resolve relative URIs)
 * @returns {{ initSegment: string | null, segments: string[], mimeType: string }}
 */
export function parseMpd(xml, baseUrl) {
  const base = baseUrl.replace(/\/[^/]*$/, '/')
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error('Invalid MPD XML')

  let initSegment = null
  let segments = []
  let mimeType = 'video/mp4; codecs="avc1.42E01E"'

  const representation = doc.querySelector('Representation') || doc.querySelector('AdaptationSet Representation')
  const adaptationSet = doc.querySelector('AdaptationSet')
  const rep = representation || adaptationSet

  if (!rep) throw new Error('No Representation or AdaptationSet in MPD')

  const baseUrlEl = rep.querySelector('BaseURL')
  const repBase = baseUrlEl ? resolveUrl(baseUrlEl.textContent.trim(), base) : base

  const segmentList = rep.querySelector('SegmentList')
  const segmentTemplate = rep.querySelector('SegmentTemplate')

  if (segmentList) {
    const init = segmentList.querySelector('Initialization')
    if (init) {
      const src = init.getAttribute('sourceURL') || init.getAttribute('range')
      if (src) initSegment = resolveUrl(src, repBase)
    }
    const segmentUrls = segmentList.querySelectorAll('SegmentURL')
    if (segmentUrls.length) {
      segments = Array.from(segmentUrls).map((s) => {
        const href = s.getAttribute('media') || s.getAttribute('mediaURL') || s.getAttribute('href')
        return resolveUrl(href || '', repBase)
      })
    }
  } else if (segmentTemplate) {
    const init = segmentTemplate.getAttribute('initialization') || segmentTemplate.getAttribute('sourceURL')
    if (init) {
      initSegment = resolveUrl(init.replace('$RepresentationID$', rep.getAttribute('id') || '0'), repBase)
    }
    const media = segmentTemplate.getAttribute('media')
    const start = parseInt(segmentTemplate.getAttribute('startNumber') || '1', 10)
    const duration = parseFloat(segmentTemplate.getAttribute('duration') || '0')
    const timescale = parseFloat(segmentTemplate.getAttribute('timescale') || '1')
    
    if (media) {
      const repId = rep.getAttribute('id') || '0'
      const mediaTmpl = media
        .replace(/\$RepresentationID\$/g, repId)
        .replace(/\$Number%(\d+)d\$/g, (_, pad) => `%${pad}d`)
        .replace(/\$Number\$/g, '%d')
        .replace(/\$\$/g, '$')

      // Calculate segment count from period duration
      const period = doc.querySelector('Period')
      const periodDuration = period?.getAttribute('duration')
      let count = 10 // default
      
      if (periodDuration) {
        const match = periodDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/)
        if (match) {
          const hours = parseFloat(match[1] || 0)
          const mins = parseFloat(match[2] || 0)
          const secs = parseFloat(match[3] || 0)
          const totalSec = hours * 3600 + mins * 60 + secs
          const segDuration = duration / timescale
          count = Math.ceil(totalSec / segDuration) || 1
        }
      }
      
      for (let i = 0; i < count; i++) {
        const num = start + i
        const segUrl = mediaTmpl.replace(/%(\d*)d/, (_, pad) => {
          const padLen = parseInt(pad || '0', 10)
          return String(num).padStart(padLen, '0')
        })
        segments.push(resolveUrl(segUrl, repBase))
      }
    }
  }

  return { initSegment, segments, mimeType }
}

/**
 * Resolve a relative URL against a base URL
 */
export function resolveUrl(uri, base) {
  if (!uri) return base
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri
  if (uri.startsWith('/')) {
    try {
      const u = new URL(base)
      return `${u.origin}${uri}`
    } catch (_) {
      return base + uri.replace(/^\//, '')
    }
  }
  return base.replace(/\/?$/, '/') + uri
}

/**
 * Load DASH manifest
 * @param {string} url - MPD URL
 * @param {AbortSignal} signal - Abort signal
 * @returns {Promise<{ initSegment: string | null, segments: string[], mimeType: string }>}
 */
export async function loadDashManifest(url, signal) {
  const response = await fetch(url, { signal })
  const text = await response.text()
  const baseUrl = new URL(url).href
  return parseMpd(text, baseUrl)
}
