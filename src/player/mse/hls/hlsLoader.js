/**
 * HLS Loader for MSE (CMAF/fMP4 only)
 * Fetches HLS manifest and loads segments into MediaSource
 */

import { loadHlsManifest } from '../../parsers/m3u8.js'
import { 
  createMediaSource, 
  addSourceBuffer, 
  appendBuffer, 
  getSupportedVideoCodec,
  cleanupMediaSource,
  isMSESupported
} from '../core/mediaSource.js'

/**
 * HLS MSE Player Controller
 */
export class HLSLoader {
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
      
      console.log('[HLS] Loading manifest:', this.url)
      
      // Load manifest
      let manifest
      try {
        manifest = await loadHlsManifest(this.url, this.abortController.signal)
      } catch (err) {
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
          throw new Error('CORS error: Cannot fetch HLS manifest. Try using local samples.')
        }
        throw err
      }
      
      console.log('[HLS] Manifest loaded:', manifest)
      
      if (!manifest.segments.length) {
        throw new Error('No segments found in HLS manifest')
      }
      
      if (!manifest.initSegment) {
        throw new Error('No init segment found. This HLS stream may use TS format instead of CMAF/fMP4.')
      }
      
      // Create MediaSource
      const { mediaSource, objectUrl } = await createMediaSource(this.video)
      this.mediaSource = mediaSource
      this.objectUrl = objectUrl
      
      // Add source buffer
      const mimeType = getSupportedVideoCodec()
      console.log('[HLS] Using codec:', mimeType)
      this.sourceBuffer = addSourceBuffer(mediaSource, mimeType)
      
      // Append init segment
      console.log('[HLS] Fetching init segment:', manifest.initSegment)
      let initData
      try {
        const initResponse = await fetch(manifest.initSegment, { 
          signal: this.abortController.signal 
        })
        if (!initResponse.ok) {
          throw new Error(`Failed to fetch init segment: ${initResponse.status}`)
        }
        initData = await initResponse.arrayBuffer()
      } catch (err) {
        if (err.name === 'TypeError') {
          throw new Error('CORS error: Cannot fetch init segment. Try using local samples.')
        }
        throw err
      }
      
      console.log('[HLS] Init segment size:', initData.byteLength)
      await appendBuffer(this.sourceBuffer, initData)
      
      // Append media segments
      const total = manifest.segments.length
      console.log('[HLS] Loading', total, 'segments')
      
      for (let i = 0; i < total; i++) {
        if (this.abortController.signal.aborted) break
        
        try {
          const response = await fetch(manifest.segments[i], { 
            signal: this.abortController.signal 
          })
          if (!response.ok) {
            console.warn(`[HLS] Segment ${i} failed: ${response.status}`)
            continue
          }
          const data = await response.arrayBuffer()
          
          if (this.abortController.signal.aborted) break
          
          await appendBuffer(this.sourceBuffer, data)
          this.progress = (i + 1) / total
        } catch (err) {
          if (err.name === 'AbortError') break
          console.warn(`[HLS] Segment ${i} error:`, err.message)
        }
      }
      
      // Signal end of stream
      if (!this.abortController.signal.aborted && this.mediaSource.readyState === 'open') {
        this.mediaSource.endOfStream()
        console.log('[HLS] Playback ready')
      }
      
      this.loading = false
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.error = err.message
        console.error('[HLS] Load error:', err)
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
 * Create an HLS loader instance
 */
export function createHLSLoader(video, url) {
  return new HLSLoader(video, url)
}
