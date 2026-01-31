import { useRef, useEffect, useState } from 'react'
import { HLSLoader } from './hlsLoader.js'
import { getSampleUrl } from '../../../config/samples.js'
import { usePlayerLog } from '../../../components/VideoDemos/PlayerLogContext.jsx'

/**
 * MSE + HLS Player Component (CMAF/fMP4 only)
 */
export default function HLSPlayer({ url, VideoWrapper }) {
  const videoRef = useRef(null)
  const loaderRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const logCtx = usePlayerLog()
  const onLog = logCtx ? (level, message, detail) => logCtx.addLog(level, message, detail) : undefined

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const sourceUrl = url || getSampleUrl('HLS')
    const loader = new HLSLoader(video, sourceUrl, { onLog })
    loaderRef.current = loader
    
    setLoading(true)
    setError(null)
    
    loader.load().then(() => {
      setLoading(loader.loading)
      if (loader.error) {
        setError(loader.error)
      }
    }).catch((err) => {
      setError(err.message)
      setLoading(false)
    })
    
    return () => {
      loader.destroy()
    }
  }, [url])
  
  const content = (
    <video 
      ref={videoRef} 
      className="w-full h-full" 
      controls 
      playsInline 
      autoPlay
      muted
    />
  )
  
  // Add helpful error message for common issues
  const errorMessage = error ? (
    error.includes('CORS') ? (
      `${error} Place CMAF/fMP4 HLS files in public/samples/ and set USE_LOCAL_SAMPLES=true in config/samples.js`
    ) : error.includes('TS format') ? (
      `${error} This player only supports CMAF/fMP4 HLS streams, not MPEG-TS.`
    ) : error
  ) : null
  
  if (VideoWrapper) {
    return (
      <VideoWrapper
        title="MSE + HLS (CMAF)"
        description="Media Source Extensions with HLS CMAF/fMP4. Pure JavaScript, no external libraries."
        loading={loading}
        error={errorMessage}
      >
        {content}
      </VideoWrapper>
    )
  }
  
  return content
}
