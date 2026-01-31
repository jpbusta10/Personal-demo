/**
 * Video Decoder Wrapper
 * Wraps the Web Codecs VideoDecoder API with a simpler interface
 */

/**
 * Check if Web Codecs VideoDecoder is supported
 */
export function isVideoDecoderSupported() {
  return typeof VideoDecoder !== 'undefined'
}

/**
 * VideoDecoder wrapper class
 */
export class VideoDecoderWrapper {
  constructor(onFrame, onError) {
    this.onFrame = onFrame
    this.onError = onError
    this.decoder = null
    this.configured = false
    this.frameCount = 0
    /** Set synchronously in close() so decode() bails even if decoder state lags */
    this._closed = false
  }
  
  /**
   * Configure the decoder with codec info from init segment
   * @param {{ codec: string, description: Uint8Array, codedWidth?: number, codedHeight?: number }} config
   */
  async configure(config) {
    if (!isVideoDecoderSupported()) {
      this.onError?.(new Error('VideoDecoder not supported'))
      return false
    }
    
    try {
      const decoderConfig = {
        codec: config.codec,
        codedWidth: config.codedWidth || 1920,
        codedHeight: config.codedHeight || 1080,
      }
      
      // Add description (avcC) if provided
      if (config.description) {
        decoderConfig.description = config.description
      }
      
      // Check if configuration is supported before creating decoder
      try {
        const support = await VideoDecoder.isConfigSupported(decoderConfig)
        if (!support.supported) {
          console.error('VideoDecoder config not supported:', decoderConfig)
          this.onError?.(new Error(`Codec ${config.codec} not supported`))
          return false
        }
        console.log('VideoDecoder config supported:', {
          codec: config.codec,
          width: decoderConfig.codedWidth,
          height: decoderConfig.codedHeight,
          hasDescription: !!decoderConfig.description
        })
      } catch (supportErr) {
        console.warn('Could not check config support:', supportErr)
      }
      
      this.decoder = new VideoDecoder({
        output: (frame) => {
          this.frameCount++
          this.onFrame?.(frame)
        },
        error: (e) => {
          // Include more details about the error
          const errorDetails = {
            message: e?.message,
            name: e?.name,
            code: e?.code,
            state: this.decoder?.state
          }
          console.error('VideoDecoder error:', errorDetails)
          this.onError?.(e)
        }
      })
      
      this.decoder.configure(decoderConfig)
      this.configured = true
      return true
    } catch (e) {
      this.onError?.(e)
      return false
    }
  }
  
  /**
   * Decode a video chunk
   * @param {{ type: string, timestamp: number, duration: number, data: Uint8Array }} sample
   */
  decode(sample) {
    if (this._closed) return
    if (!this.decoder || !this.configured) return
    if (this.decoder.state === 'closed') return

    try {
      const data = sample.data.byteLength > 0 ? new Uint8Array(sample.data) : sample.data
      const duration = sample.duration > 0 ? sample.duration : 1
      const chunk = new EncodedVideoChunk({
        type: sample.type === 'key' ? 'key' : 'delta',
        timestamp: sample.timestamp,
        duration,
        data
      })
      this.decoder.decode(chunk)
    } catch (e) {
      this.onError?.(e)
    }
  }
  
  /**
   * Flush pending frames
   */
  async flush() {
    if (!this.decoder) return
    
    try {
      await this.decoder.flush()
    } catch (e) {
      // Ignore flush errors during cleanup
    }
  }
  
  /**
   * Close the decoder
   */
  close() {
    this._closed = true
    if (this.decoder) {
      try {
        this.decoder.close()
      } catch (e) {
        // Ignore close errors
      }
      this.decoder = null
    }
    this.configured = false
  }
  
  /**
   * Get decoder state
   */
  get state() {
    return this.decoder?.state || 'closed'
  }
  
  /**
   * Get decode queue size
   */
  get decodeQueueSize() {
    return this.decoder?.decodeQueueSize || 0
  }
}

/**
 * Create a video decoder instance
 */
export function createVideoDecoder(onFrame, onError) {
  return new VideoDecoderWrapper(onFrame, onError)
}
