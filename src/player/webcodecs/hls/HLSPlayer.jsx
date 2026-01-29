import { useRef, useEffect, useState } from 'react'
import { loadHlsManifest } from '../../parsers/m3u8.js'
import { Demuxer } from '../core/demuxer.js'
import { VideoDecoderWrapper, isVideoDecoderSupported } from '../video/VideoDecoderWrapper.js'
import { VideoRenderer } from '../video/videoRenderer.js'
import { AudioDecoderWrapper, isAudioDecoderSupported } from '../audio/AudioDecoderWrapper.js'
import { AudioRenderer } from '../audio/audioRenderer.js'
import { getSampleUrl } from '../../../config/samples.js'

/**
 * Web Codecs + HLS Player Component (CMAF/fMP4 only)
 */
export default function HLSPlayer({ url, VideoWrapper }) {
  const canvasRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    if (!isVideoDecoderSupported()) {
      setError('Web Codecs VideoDecoder not supported in this browser. Try Chrome 94+ or Edge 94+.')
      setLoading(false)
      return
    }
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const abortController = new AbortController()
    const sourceUrl = url || getSampleUrl('HLS')
    
    async function init() {
      try {
        setLoading(true)
        setError(null)
        
        console.log('[WebCodecs HLS] Loading manifest:', sourceUrl)
        
        // Load manifest
        let manifest
        try {
          manifest = await loadHlsManifest(sourceUrl, abortController.signal)
        } catch (err) {
          if (err.name === 'TypeError') {
            throw new Error('CORS error: Cannot fetch HLS manifest.')
          }
          throw err
        }
        
        console.log('[WebCodecs HLS] Manifest:', manifest)
        
        if (!manifest.segments.length) {
          throw new Error('No segments found in HLS manifest')
        }
        
        if (!manifest.initSegment) {
          throw new Error('No init segment. This HLS may use TS format instead of CMAF/fMP4.')
        }
        
        // Create components
        const demuxer = new Demuxer()
        const videoRenderer = new VideoRenderer(canvas)
        const audioRenderer = new AudioRenderer()
        
        // Create video decoder
        const videoDecoder = new VideoDecoderWrapper(
          (frame) => videoRenderer.renderFrame(frame),
          (err) => console.error('[WebCodecs] Video decode error:', err)
        )
        
        // Fetch and parse init segment
        console.log('[WebCodecs HLS] Fetching init:', manifest.initSegment)
        let initData
        try {
          const initResponse = await fetch(manifest.initSegment, { 
            signal: abortController.signal 
          })
          if (!initResponse.ok) {
            throw new Error(`Failed to fetch init segment: ${initResponse.status}`)
          }
          initData = await initResponse.arrayBuffer()
        } catch (err) {
          if (err.name === 'TypeError') {
            throw new Error('CORS error: Cannot fetch init segment.')
          }
          throw err
        }
        
        console.log('[WebCodecs HLS] Init size:', initData.byteLength)
        const trackConfigs = demuxer.parseInit(initData)
        console.log('[WebCodecs HLS] Track configs:', trackConfigs)
        
        // Configure video decoder
        if (trackConfigs.video) {
          const configured = videoDecoder.configure(trackConfigs.video)
          if (!configured) {
            throw new Error('Failed to configure video decoder')
          }
        } else {
          throw new Error('No video track found in init segment')
        }
        
        setLoading(false)
        
        // Process segments
        for (const segmentUrl of manifest.segments) {
          if (abortController.signal.aborted) break
          
          try {
            const response = await fetch(segmentUrl, { signal: abortController.signal })
            if (!response.ok) continue
            
            const segmentData = await response.arrayBuffer()
            if (abortController.signal.aborted) break
            
            const { video } = demuxer.parseMedia(segmentData)
            
            // Decode video samples
            for (const sample of video) {
              if (abortController.signal.aborted) break
              videoDecoder.decode(sample)
            }
          } catch (err) {
            if (err.name === 'AbortError') break
            console.warn('[WebCodecs HLS] Segment error:', err.message)
          }
        }
        
        // Flush
        await videoDecoder.flush()
        videoDecoder.close()
        
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[WebCodecs HLS] Error:', err)
          setError(err.message)
        }
        setLoading(false)
      }
    }
    
    init()
    
    return () => {
      abortController.abort()
    }
  }, [url])
  
  const content = (
    <canvas 
      ref={canvasRef}
      className="w-full h-full bg-black"
      width={1280}
      height={720}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  )
  
  const errorMessage = error ? (
    error.includes('CORS') ? (
      `${error} Place CMAF/fMP4 HLS files in public/samples/ and set USE_LOCAL_SAMPLES=true.`
    ) : error.includes('TS format') ? (
      `${error} This player only supports CMAF/fMP4 HLS streams, not MPEG-TS.`
    ) : error
  ) : null
  
  if (VideoWrapper) {
    return (
      <VideoWrapper
        title="Web Codecs + HLS (CMAF)"
        description="Web Codecs API with HLS CMAF/fMP4. Separate video decoder rendering to canvas."
        loading={loading}
        error={errorMessage}
      >
        {content}
      </VideoWrapper>
    )
  }
  
  return content
}
