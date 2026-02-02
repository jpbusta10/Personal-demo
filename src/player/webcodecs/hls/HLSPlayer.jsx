import { useRef, useEffect, useState } from 'react'
import { loadHlsManifest } from '../../parsers/m3u8.js'
import { Demuxer } from '../core/demuxer.js'
import { VideoDecoderWrapper, isVideoDecoderSupported } from '../video/VideoDecoderWrapper.js'
import { VideoRenderer } from '../video/videoRenderer.js'
import { AudioDecoderWrapper, isAudioDecoderSupported } from '../audio/AudioDecoderWrapper.js'
import { AudioRenderer } from '../audio/audioRenderer.js'
import { getSampleUrl } from '../../../config/samples.js'
import { usePlayerLog } from '../../../components/VideoDemos/PlayerLogContext.jsx'

/**
 * Web Codecs + HLS Player Component (CMAF/fMP4 only)
 */
export default function HLSPlayer({ url, VideoWrapper }) {
  const canvasRef = useRef(null)
  const videoRendererRef = useRef(null)
  const audioRendererRef = useRef(null)
  const audioDecoderRef = useRef(null)
  const audioReadyRef = useRef(false)
  const pendingAudioInitRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const logCtx = usePlayerLog()
  const addLog = logCtx ? (level, message, detail) => logCtx.addLog(level, message, detail) : () => {}

  const enableAudio = async () => {
    if (audioReadyRef.current) return
    const audioRenderer = audioRendererRef.current
    if (!audioRenderer) {
      pendingAudioInitRef.current = true
      return
    }
    try {
      await audioRenderer.init()
      await audioRenderer.resume?.()
      audioReadyRef.current = true
    } catch (err) {
      addLog('warn', 'Audio context blocked. Click play to enable audio.', err?.message)
    }
  }

  useEffect(() => {
    const handler = () => {
      enableAudio()
      videoRendererRef.current?.resume?.()
      setIsPlaying(true)
    }
    window.addEventListener('pointerdown', handler, { once: true })
    return () => window.removeEventListener('pointerdown', handler)
  }, [])

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
    const sourceUrl = url || getSampleUrl('HLS')

    async function init() {
      try {
        setLoading(true)
        setError(null)
        addLog('info', 'Loading manifest', sourceUrl)

        // Load manifest
        let manifest
        try {
          manifest = await loadHlsManifest(sourceUrl, abortController.signal)
        } catch (err) {
          if (err.name !== 'AbortError' && !/abort/i.test(err.message || '')) {
            addLog('error', err.message || 'Failed to fetch manifest')
          }
          if (err.name === 'TypeError') {
            throw new Error('CORS error: Cannot fetch HLS manifest.')
          }
          throw err
        }

        addLog('info', 'Manifest loaded', { segments: manifest.segments?.length, hasInit: !!manifest.initSegment })

        if (!manifest.segments.length) {
          addLog('error', 'No segments found in HLS manifest')
          throw new Error('No segments found in HLS manifest')
        }

        if (!manifest.initSegment) {
          addLog('error', 'No init segment. Stream may be TS format, not CMAF/fMP4.')
          throw new Error('No init segment. This HLS may use TS format instead of CMAF/fMP4.')
        }

        // Create components
        const demuxer = new Demuxer()
        const videoRenderer = new VideoRenderer(canvas)
        const audioRenderer = new AudioRenderer()
        videoRendererRef.current = videoRenderer
        audioRendererRef.current = audioRenderer
        audioRenderer.setBaseTimestampCallback((baseTimestampUs) => {
          videoRenderer.setClock(() => audioRenderer.getCurrentTimeUs())
          videoRenderer.setBaseTimestampUs(baseTimestampUs)
        })
        if (pendingAudioInitRef.current) {
          pendingAudioInitRef.current = false
          await enableAudio()
        }

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
        addLog('info', 'Track configs', {
          hasVideo: !!trackConfigs?.video,
          video: trackConfigs?.video
            ? {
                codec: trackConfigs.video.codec,
                trackId: trackConfigs.video.trackId,
                timescale: trackConfigs.video.timescale,
                width: trackConfigs.video.codedWidth,
                height: trackConfigs.video.codedHeight,
                hasDescription: !!trackConfigs.video.description
              }
            : null,
          hasAudio: !!trackConfigs?.audio,
          audio: trackConfigs?.audio
            ? {
                codec: trackConfigs.audio.codec,
                trackId: trackConfigs.audio.trackId,
                timescale: trackConfigs.audio.timescale,
                sampleRate: trackConfigs.audio.sampleRate,
                channels: trackConfigs.audio.channels,
                hasDescription: !!trackConfigs.audio.description
              }
            : null
        })

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

        // Configure audio decoder if available
        if (trackConfigs.audio && isAudioDecoderSupported()) {
          const audioDecoder = new AudioDecoderWrapper(
            (audioData) => audioRenderer.queueAudio(audioData),
            (err) => addLog('error', 'Audio decode error', err?.message)
          )
          const audioConfigured = await audioDecoder.configure(trackConfigs.audio)
          if (audioConfigured) {
            audioDecoderRef.current = audioDecoder
            addLog('info', 'Audio decoder configured', {
              codec: trackConfigs.audio.codec,
              sampleRate: trackConfigs.audio.sampleRate,
              channels: trackConfigs.audio.channels
            })
          } else {
            addLog('warn', 'Failed to configure audio decoder')
          }
        } else if (!trackConfigs.audio) {
          addLog('info', 'No audio track found in init segment')
        }

        setLoading(false)
        addLog('info', `Loading ${manifest.segments.length} segments`)

        // Process segments
        for (let i = 0; i < manifest.segments.length; i++) {
          if (abortController.signal.aborted) break
          const segment = manifest.segments[i]
          const segmentUrl = typeof segment === 'string' ? segment : segment.url
          const segmentDurationSec = typeof segment === 'string' ? null : segment.duration

          try {
            const response = await fetch(segmentUrl, { signal: abortController.signal })
            if (!response.ok) {
              addLog('warn', `Segment ${i} HTTP ${response.status}`)
              continue
            }
            const segmentData = await response.arrayBuffer()
            if (abortController.signal.aborted) break

            const { video, audio } = demuxer.parseMedia(segmentData, segmentDurationSec)

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

            // Decode audio samples
            if (audioDecoderRef.current) {
              for (const sample of audio) {
                if (abortController.signal.aborted) break
                audioDecoderRef.current.decode(sample)
              }
            }
          } catch (err) {
            if (err.name === 'AbortError') break
            addLog('warn', `Segment ${i}: ${err.message}`)
          }
        }

        if (abortController.signal.aborted) return
        addLog('info', 'Flushing decoder')
        await videoDecoder.flush()
        await audioDecoderRef.current?.flush?.()
        if (abortController.signal.aborted) return
        videoDecoder.close()
        audioDecoderRef.current?.close()
        audioDecoderRef.current = null
        decoderRef.current = null
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
      audioDecoderRef.current?.close()
      audioDecoderRef.current = null
      videoRendererRef.current?.clear?.()
      audioRendererRef.current?.close?.()
      videoRendererRef.current = null
      audioRendererRef.current = null
    }
  }, [url])

  useEffect(() => {
    const audioRenderer = audioRendererRef.current
    if (!audioRenderer) return
    const nextVolume = muted ? 0 : volume
    audioRenderer.setVolume(nextVolume)
  }, [muted, volume])

  const handlePlayPause = async () => {
    const videoRenderer = videoRendererRef.current
    const audioRenderer = audioRendererRef.current
    if (!videoRenderer || !audioRenderer) return

    if (isPlaying) {
      videoRenderer.pause?.()
      await audioRenderer.suspend?.()
      setIsPlaying(false)
    } else {
      await enableAudio()
      videoRenderer.resume?.()
      setIsPlaying(true)
    }
  }
  
  const content = (
    <div className="relative w-full h-full">
      <canvas 
        ref={canvasRef}
        className="w-full h-full bg-black"
        width={1280}
        height={720}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 flex items-center gap-3">
        <button
          type="button"
          className="px-2 py-1 bg-white/10 rounded hover:bg-white/20"
          onClick={handlePlayPause}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className="px-2 py-1 bg-white/10 rounded hover:bg-white/20"
          onClick={() => setMuted((v) => !v)}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <div className="flex items-center gap-2">
          <span>Vol</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
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
