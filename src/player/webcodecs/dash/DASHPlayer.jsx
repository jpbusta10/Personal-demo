import { useRef, useEffect, useState } from 'react'
import { loadDashManifest } from '../../parsers/mpd.js'
import { Demuxer } from '../core/demuxer.js'
import { VideoDecoderWrapper, isVideoDecoderSupported } from '../video/VideoDecoderWrapper.js'
import { VideoRenderer } from '../video/videoRenderer.js'
import { AudioDecoderWrapper, isAudioDecoderSupported } from '../audio/AudioDecoderWrapper.js'
import { AudioRenderer } from '../audio/audioRenderer.js'
import { getSampleUrl } from '../../../config/samples.js'
import { usePlayerLog } from '../../../components/VideoDemos/PlayerLogContext.jsx'

/**
 * Web Codecs + DASH Player Component (CMAF/fMP4)
 */
export default function DASHPlayer({ url, VideoWrapper }) {
  const canvasRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const logCtx = usePlayerLog()
  const addLog = logCtx ? (level, message, detail) => logCtx.addLog(level, message, detail) : () => {}

  useEffect(() => {
    if (!isVideoDecoderSupported()) {
      addLog('error', 'Web Codecs VideoDecoder not supported. Try Chrome 94+ or Edge 94+.')
      setError('Web Codecs VideoDecoder not supported in this browser. Try Chrome 94+ or Edge 94+.')
      setLoading(false)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const abortController = new AbortController()
    const decoderRef = { current: null }
    const sourceUrl = url || getSampleUrl('DASH')

    async function init() {
      try {
        setLoading(true)
        setError(null)
        addLog('info', 'Loading manifest', sourceUrl)

        // Load manifest
        let manifest
        try {
          manifest = await loadDashManifest(sourceUrl, abortController.signal)
        } catch (err) {
          if (err.name !== 'AbortError' && !/abort/i.test(err.message || '')) {
            addLog('error', err.message || 'Failed to fetch manifest')
          }
          if (err.name === 'TypeError') {
            throw new Error('CORS error: Cannot fetch DASH manifest.')
          }
          throw err
        }

        addLog('info', 'Manifest loaded', { segments: manifest.segments?.length, hasInit: !!manifest.initSegment })

        if (!manifest.segments.length) {
          addLog('error', 'No segments found in DASH manifest')
          throw new Error('No segments found in DASH manifest')
        }

        if (!manifest.initSegment) {
          addLog('error', 'No init segment found in DASH manifest')
          throw new Error('No init segment found in DASH manifest')
        }

        // Create components
        const demuxer = new Demuxer()
        const videoRenderer = new VideoRenderer(canvas)

        // Create video decoder with timed frame rendering
        const videoDecoder = new VideoDecoderWrapper(
          (frame) => videoRenderer.queueFrame(frame),
          (err) => addLog('error', 'Video decode error', err?.message)
        )
        decoderRef.current = videoDecoder

        // Fetch and parse init segment
        addLog('info', 'Fetching init segment', manifest.initSegment)
        let initData
        try {
          const initResponse = await fetch(manifest.initSegment, {
            signal: abortController.signal
          })
          if (!initResponse.ok) {
            addLog('error', `Init segment HTTP ${initResponse.status}`)
            throw new Error(`Failed to fetch init segment: ${initResponse.status}`)
          }
          initData = await initResponse.arrayBuffer()
        } catch (err) {
          addLog('error', err.message || 'Failed to fetch init segment')
          if (err.name === 'TypeError') {
            throw new Error('CORS error: Cannot fetch init segment.')
          }
          throw err
        }

        addLog('info', `Init segment size: ${initData.byteLength} bytes`)
        const trackConfigs = demuxer.parseInit(initData)
        addLog('info', 'Track configs', trackConfigs?.video ? { 
          hasVideo: true, 
          codec: trackConfigs.video.codec,
          trackId: trackConfigs.video.trackId,
          timescale: trackConfigs.video.timescale,
          width: trackConfigs.video.codedWidth,
          height: trackConfigs.video.codedHeight,
          hasDescription: !!trackConfigs.video.description
        } : { hasVideo: false })

        // Configure video decoder
        if (trackConfigs.video) {
          const configured = await videoDecoder.configure(trackConfigs.video)
          if (!configured) {
            addLog('error', 'Failed to configure video decoder')
            throw new Error('Failed to configure video decoder')
          }
        } else {
          addLog('error', 'No video track found in init segment')
          throw new Error('No video track found in init segment')
        }

        setLoading(false)
        addLog('info', `Loading ${manifest.segments.length} segments`)

        // Process segments
        for (let i = 0; i < manifest.segments.length; i++) {
          if (abortController.signal.aborted) break
          const segmentUrl = manifest.segments[i]

          try {
            const response = await fetch(segmentUrl, { signal: abortController.signal })
            if (!response.ok) {
              addLog('warn', `Segment ${i} HTTP ${response.status}`)
              continue
            }
            const segmentData = await response.arrayBuffer()
            if (abortController.signal.aborted) break

            const { video } = demuxer.parseMedia(segmentData)

            // Log segment parsing results for first segment
            if (i === 0) {
              addLog('info', `Segment 0 parsed`, { 
                videoSamples: video.length,
                firstSampleType: video[0]?.type,
                firstSampleSize: video[0]?.data?.byteLength
              })
            }

            // Decode video samples
            for (const sample of video) {
              if (abortController.signal.aborted) break
              videoDecoder.decode(sample)
            }
          } catch (err) {
            if (err.name === 'AbortError') break
            addLog('warn', `Segment ${i}: ${err.message}`)
          }
        }

        addLog('info', 'Flushing decoder')
        await videoDecoder.flush()
        videoDecoder.close()
        addLog('info', 'Playback ready')
      } catch (err) {
        if (err.name !== 'AbortError' && !/abort/i.test(err.message || '')) {
          addLog('error', err.message)
          setError(err.message)
        }
        setLoading(false)
      }
    }

    init()

    return () => {
      abortController.abort()
      decoderRef.current?.close()
      decoderRef.current = null
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
