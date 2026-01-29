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
  }
  
  /**
   * Configure the decoder with codec info from init segment
   * @param {{ codec: string, description: Uint8Array, codedWidth?: number, codedHeight?: number }} config
   */
  configure(config) {
    if (!isVideoDecoderSupported()) {
      this.onError?.(new Error('VideoDecoder not supported'))
      return false
    }
    
    try {
      this.decoder = new VideoDecoder({
        output: (frame) => {
          this.frameCount++
          this.onFrame?.(frame)
        },
        error: (e) => {
          this.onError?.(e)
        }
      })
      
      const decoderConfig = {
        codec: config.codec,
        codedWidth: config.codedWidth || 1920,
        codedHeight: config.codedHeight || 1080,
      }
      
      // Add description (avcC) if provided
      if (config.description) {
        decoderConfig.description = config.description
      }
      
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
    if (!this.decoder || !this.configured) return
    
    try {
      const chunk = new EncodedVideoChunk({
        type: sample.type === 'key' ? 'key' : 'delta',
        timestamp: sample.timestamp,
        duration: sample.duration,
        data: sample.data
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
