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
export class DASHLoader {
  constructor(video, url) {
    this.video = video
    this.url = url
    this.mediaSource = null
    this.objectUrl = null
    this.sourceBuffer = null
    this.abortController = new AbortController()
    this.loading = false
    this.error = null
    this.progress = 0
  }
  
  /**
   * Start loading and playing
   */
  async load() {
    try {
      this.loading = true
      this.error = null
      this.progress = 0
      
      // Check MSE support
      if (!isMSESupported()) {
        throw new Error('MediaSource API not supported in this browser')
      }
      
      console.log('[DASH] Loading manifest:', this.url)
      
      // Load manifest
      let manifest
      try {
        manifest = await loadDashManifest(this.url, this.abortController.signal)
      } catch (err) {
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
          throw new Error('CORS error: Cannot fetch DASH manifest. Try using local samples.')
        }
        throw err
      }
      
      console.log('[DASH] Manifest loaded:', manifest)
      
      if (!manifest.segments.length) {
        throw new Error('No segments found in DASH manifest')
      }
      
      // Create MediaSource
      const { mediaSource, objectUrl } = await createMediaSource(this.video)
      this.mediaSource = mediaSource
      this.objectUrl = objectUrl
      
      // Add source buffer
      const mimeType = manifest.mimeType || getSupportedVideoCodec()
      console.log('[DASH] Using codec:', mimeType)
      this.sourceBuffer = addSourceBuffer(mediaSource, mimeType)
      
      // Append init segment if present
      if (manifest.initSegment) {
        console.log('[DASH] Fetching init segment:', manifest.initSegment)
        try {
          const initResponse = await fetch(manifest.initSegment, { 
            signal: this.abortController.signal 
          })
          if (!initResponse.ok) {
            throw new Error(`Failed to fetch init segment: ${initResponse.status}`)
          }
          const initData = await initResponse.arrayBuffer()
          console.log('[DASH] Init segment size:', initData.byteLength)
          await appendBuffer(this.sourceBuffer, initData)
        } catch (err) {
          if (err.name === 'TypeError') {
            throw new Error('CORS error: Cannot fetch init segment. Try using local samples.')
          }
          throw err
        }
      }
      
      // Append media segments
      const total = manifest.segments.length
      console.log('[DASH] Loading', total, 'segments')
      
      for (let i = 0; i < total; i++) {
        if (this.abortController.signal.aborted) break
        
        try {
          const response = await fetch(manifest.segments[i], { 
            signal: this.abortController.signal 
          })
          if (!response.ok) {
            console.warn(`[DASH] Segment ${i} failed: ${response.status}`)
            continue
          }
          const data = await response.arrayBuffer()
          
          if (this.abortController.signal.aborted) break
          
          await appendBuffer(this.sourceBuffer, data)
          this.progress = (i + 1) / total
        } catch (err) {
          if (err.name === 'AbortError') break
          console.warn(`[DASH] Segment ${i} error:`, err.message)
        }
      }
      
      // Signal end of stream
      if (!this.abortController.signal.aborted && this.mediaSource.readyState === 'open') {
        this.mediaSource.endOfStream()
        console.log('[DASH] Playback ready')
      }
      
      this.loading = false
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.error = err.message
        console.error('[DASH] Load error:', err)
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
export function createDASHLoader(video, url) {
  return new DASHLoader(video, url)
}
