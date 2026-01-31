/**
 * MSE Core - MediaSource and SourceBuffer helpers
 */

const VIDEO_CODECS = [
  'video/mp4; codecs="avc1.42E01E"',
  'video/mp4; codecs="avc1.4d401e"',
  'video/mp4; codecs="avc1.64001e"',
  'video/mp4; codecs="avc1.42c01e"',
]

const AUDIO_VIDEO_CODECS = [
  'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  'video/mp4; codecs="avc1.4d401e, mp4a.40.2"',
]

/**
 * Get a supported video codec MIME type
 */
export function getSupportedVideoCodec() {
  if (typeof MediaSource === 'undefined') return VIDEO_CODECS[0]
  
  for (const codec of AUDIO_VIDEO_CODECS) {
    if (MediaSource.isTypeSupported(codec)) return codec
  }
  for (const codec of VIDEO_CODECS) {
    if (MediaSource.isTypeSupported(codec)) return codec
  }
  return VIDEO_CODECS[0]
}

/**
 * Check if MSE is supported
 */
export function isMSESupported() {
  return typeof MediaSource !== 'undefined' && typeof MediaSource.isTypeSupported === 'function'
}

/**
 * Create and attach a MediaSource to a video element
 * @param {HTMLVideoElement} video
 * @returns {Promise<{ mediaSource: MediaSource, objectUrl: string }>}
 */
export function createMediaSource(video) {
  return new Promise((resolve, reject) => {
    if (!isMSESupported()) {
      reject(new Error('MediaSource API not supported'))
      return
    }
    
    const mediaSource = new MediaSource()
    const objectUrl = URL.createObjectURL(mediaSource)
    video.src = objectUrl
    
    mediaSource.addEventListener('sourceopen', () => {
      resolve({ mediaSource, objectUrl })
    }, { once: true })
    
    mediaSource.addEventListener('error', (e) => {
      reject(new Error('MediaSource error'))
    }, { once: true })
  })
}

/**
 * Add a source buffer with the given MIME type
 * @param {MediaSource} mediaSource
 * @param {string} mimeType
 * @returns {SourceBuffer}
 */
export function addSourceBuffer(mediaSource, mimeType) {
  const sourceBuffer = mediaSource.addSourceBuffer(mimeType)
  sourceBuffer.mode = 'segments'
  return sourceBuffer
}

/**
 * Append a buffer and wait for updateend
 * @param {SourceBuffer} sourceBuffer
 * @param {ArrayBuffer} data
 * @returns {Promise<void>}
 */
export function appendBuffer(sourceBuffer, data) {
  return new Promise((resolve, reject) => {
    const onUpdateEnd = () => {
      sourceBuffer.removeEventListener('updateend', onUpdateEnd)
      sourceBuffer.removeEventListener('error', onError)
      resolve()
    }
    const onError = (e) => {
      sourceBuffer.removeEventListener('updateend', onUpdateEnd)
      sourceBuffer.removeEventListener('error', onError)
      const msg = (e?.target?.error?.message || e?.message) || 'SourceBuffer append error'
      reject(new Error(msg))
    }
    
    sourceBuffer.addEventListener('updateend', onUpdateEnd)
    sourceBuffer.addEventListener('error', onError)
    sourceBuffer.appendBuffer(data)
  })
}

/**
 * Sequentially append multiple segments
 * @param {SourceBuffer} sourceBuffer
 * @param {string[]} urls - Segment URLs to fetch and append
 * @param {AbortSignal} signal
 * @param {(progress: number) => void} onProgress
 */
export async function appendSegments(sourceBuffer, urls, signal, onProgress) {
  for (let i = 0; i < urls.length; i++) {
    if (signal?.aborted) break
    
    const response = await fetch(urls[i], { signal })
    const data = await response.arrayBuffer()
    
    if (signal?.aborted) break
    
    await appendBuffer(sourceBuffer, data)
    onProgress?.((i + 1) / urls.length)
  }
}

/**
 * Clean up MediaSource resources
 * @param {MediaSource} mediaSource
 * @param {string} objectUrl
 * @param {HTMLVideoElement} video
 */
export function cleanupMediaSource(mediaSource, objectUrl, video) {
  try {
    if (mediaSource.readyState === 'open') {
      mediaSource.endOfStream()
    }
  } catch (_) {}
  
  try {
    URL.revokeObjectURL(objectUrl)
  } catch (_) {}
  
  if (video) {
    video.src = ''
    video.load()
  }
}
