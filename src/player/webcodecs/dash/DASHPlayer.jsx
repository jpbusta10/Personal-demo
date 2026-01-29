import { useRef, useEffect, useState } from 'react'
import { loadDashManifest } from '../../parsers/mpd.js'
import { Demuxer } from '../core/demuxer.js'
import { VideoDecoderWrapper, isVideoDecoderSupported } from '../video/VideoDecoderWrapper.js'
import { VideoRenderer } from '../video/videoRenderer.js'
import { AudioDecoderWrapper, isAudioDecoderSupported } from '../audio/AudioDecoderWrapper.js'
import { AudioRenderer } from '../audio/audioRenderer.js'
import { getSampleUrl } from '../../../config/samples.js'

/**
 * Web Codecs + DASH Player Component (CMAF/fMP4)
 */
export default function DASHPlayer({ url, VideoWrapper }) {
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
    const sourceUrl = url || getSampleUrl('DASH')
    
    async function init() {
      try {
        setLoading(true)
        setError(null)
        
        console.log('[WebCodecs DASH] Loading manifest:', sourceUrl)
        
        // Load manifest
        let manifest
        try {
          manifest = await loadDashManifest(sourceUrl, abortController.signal)
        } catch (err) {
          if (err.name === 'TypeError') {
            throw new Error('CORS error: Cannot fetch DASH manifest.')
          }
          throw err
        }
        
        console.log('[WebCodecs DASH] Manifest:', manifest)
        
        if (!manifest.segments.length) {
          throw new Error('No segments found in DASH manifest')
        }
        
        if (!manifest.initSegment) {
          throw new Error('No init segment found in DASH manifest')
        }
        
        // Create components
        const demuxer = new Demuxer()
        const videoRenderer = new VideoRenderer(canvas)
        
        // Create video decoder
        const videoDecoder = new VideoDecoderWrapper(
          (frame) => videoRenderer.renderFrame(frame),
          (err) => console.error('[WebCodecs] Video decode error:', err)
        )
        
        // Fetch and parse init segment
        console.log('[WebCodecs DASH] Fetching init:', manifest.initSegment)
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
        
        console.log('[WebCodecs DASH] Init size:', initData.byteLength)
        const trackConfigs = demuxer.parseInit(initData)
        console.log('[WebCodecs DASH] Track configs:', trackConfigs)
        
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
            console.warn('[WebCodecs DASH] Segment error:', err.message)
          }
        }
        
        // Flush
        await videoDecoder.flush()
        videoDecoder.close()
        
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[WebCodecs DASH] Error:', err)
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
      `${error} Place CMAF/fMP4 DASH files in public/samples/ and set USE_LOCAL_SAMPLES=true.`
    ) : error
  ) : null
  
  if (VideoWrapper) {
    return (
      <VideoWrapper
        title="Web Codecs + DASH (CMAF)"
        description="Web Codecs API with DASH CMAF/fMP4. Separate video decoder rendering to canvas."
        loading={loading}
        error={errorMessage}
      >
        {content}
      </VideoWrapper>
    )
  }
  
  return content
}
