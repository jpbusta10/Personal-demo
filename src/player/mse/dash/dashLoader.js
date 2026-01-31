/**
 * DASH Loader for MSE (CMAF/fMP4)
 * Fetches DASH manifest and loads segments into MediaSource
 */

import { loadDashManifest } from '../../parsers/mpd.js'
import { 
  createMediaSource, 
  addSourceBuffer, 
  appendBuffer, 
  getSupportedVideoCodec,
  cleanupMediaSource,
  isMSESupported
} from '../core/mediaSource.js'

/**
 * DASH MSE Player Controller
 */
function noop() {}

export class DASHLoader {
  constructor(video, url, options = {}) {
    this.video = video
    this.url = url
    this.onLog = typeof options.onLog === 'function' ? options.onLog : noop
    this.mediaSource = null
    this.objectUrl = null
    this.sourceBuffer = null
    this.abortController = new AbortController()
    this.loading = false
    this.error = null
    this.progress = 0
  }

  _log(level, message, detail) {
    this.onLog(level, message, detail)
  }

  /**
   * Start loading and playing
   */
  async load() {
    try {
      this.loading = true
      this.error = null
      this.progress = 0

      if (!isMSESupported()) {
        this._log('error', 'MediaSource API not supported in this browser')
        throw new Error('MediaSource API not supported in this browser')
      }

      this._log('info', 'Loading manifest', this.url)

      let manifest
      try {
        manifest = await loadDashManifest(this.url, this.abortController.signal)
      } catch (err) {
        if (err.name !== 'AbortError' && !/abort/i.test(err.message || '')) {
          this._log('error', err.message || 'Failed to fetch manifest')
        }
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
          throw new Error('CORS error: Cannot fetch DASH manifest. Try using local samples.')
        }
        throw err
      }

      this._log('info', 'Manifest loaded', { segments: manifest.segments?.length, hasInit: !!manifest.initSegment })

      if (!manifest.segments.length) {
        this._log('error', 'No segments found in DASH manifest')
        throw new Error('No segments found in DASH manifest')
      }

      const { mediaSource, objectUrl } = await createMediaSource(this.video)
      this.mediaSource = mediaSource
      this.objectUrl = objectUrl

      const mimeType = manifest.mimeType || getSupportedVideoCodec()
      this._log('info', 'Using codec', mimeType)
      this.sourceBuffer = addSourceBuffer(mediaSource, mimeType)

      if (manifest.initSegment) {
        this._log('info', 'Fetching init segment', manifest.initSegment)
        try {
          const initResponse = await fetch(manifest.initSegment, {
            signal: this.abortController.signal
          })
          if (!initResponse.ok) {
            this._log('error', `Init segment HTTP ${initResponse.status}`)
            throw new Error(`Failed to fetch init segment: ${initResponse.status}`)
          }
          const initData = await initResponse.arrayBuffer()
          this._log('info', `Init segment size: ${initData.byteLength} bytes`)
          await appendBuffer(this.sourceBuffer, initData)
        } catch (err) {
          this._log('error', err.message || 'Failed to fetch init segment')
          if (err.name === 'TypeError') {
            throw new Error('CORS error: Cannot fetch init segment. Try using local samples.')
          }
          throw err
        }
      }

      const total = manifest.segments.length
      this._log('info', `Loading ${total} segments`)

      for (let i = 0; i < total; i++) {
        if (this.abortController.signal.aborted) break

        try {
          const response = await fetch(manifest.segments[i], {
            signal: this.abortController.signal
          })
          if (!response.ok) {
            this._log('warn', `Segment ${i} failed: HTTP ${response.status}`)
            continue
          }
          const data = await response.arrayBuffer()

          if (this.abortController.signal.aborted) break

          await appendBuffer(this.sourceBuffer, data)
          this.progress = (i + 1) / total
        } catch (err) {
          if (err.name === 'AbortError') break
          this._log('warn', `Segment ${i}: ${err.message}`)
        }
      }

      if (!this.abortController.signal.aborted && this.mediaSource.readyState === 'open') {
        this.mediaSource.endOfStream()
        this._log('info', 'Playback ready')
      }

      this.loading = false
    } catch (err) {
      if (err.name !== 'AbortError' && !/abort/i.test(err.message || '')) {
        this.error = err.message
        this._log('error', err.message)
      }
      this.loading = false
    }
  }
  
  /**
   * Abort loading and cleanup
   */
  destroy() {
    this.abortController.abort()
    if (this.mediaSource && this.objectUrl) {
      cleanupMediaSource(this.mediaSource, this.objectUrl, this.video)
    }
    this.mediaSource = null
    this.objectUrl = null
    this.sourceBuffer = null
  }
}

/**
 * Create a DASH loader instance
 */
export function createDASHLoader(video, url, options) {
  return new DASHLoader(video, url, options)
}
