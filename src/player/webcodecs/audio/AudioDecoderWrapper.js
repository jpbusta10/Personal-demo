/**
 * Audio Decoder Wrapper
 * Wraps the Web Codecs AudioDecoder API with a simpler interface
 */

/**
 * Check if Web Codecs AudioDecoder is supported
 */
export function isAudioDecoderSupported() {
  return typeof AudioDecoder !== 'undefined'
}

/**
 * AudioDecoder wrapper class
 */
export class AudioDecoderWrapper {
  constructor(onData, onError) {
    this.onData = onData
    this.onError = onError
    this.decoder = null
    this.configured = false
    this.sampleCount = 0
    this._closed = false
  }
  
  /**
   * Configure the decoder with codec info from init segment
   * @param {{ codec: string, sampleRate: number, channels: number, description?: Uint8Array }} config
   */
  configure(config) {
    if (!isAudioDecoderSupported()) {
      this.onError?.(new Error('AudioDecoder not supported'))
      return false
    }
    
    try {
      this.decoder = new AudioDecoder({
        output: (data) => {
          this.sampleCount++
          this.onData?.(data)
        },
        error: (e) => {
          this.onError?.(e)
        }
      })
      
      const decoderConfig = {
        codec: config.codec,
        sampleRate: config.sampleRate || 44100,
        numberOfChannels: config.channels || 2,
      }
      
      // Add description (esds AudioSpecificConfig) if provided
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
   * Decode an audio chunk
   * @param {{ type: string, timestamp: number, duration: number, data: Uint8Array }} sample
   */
  decode(sample) {
    if (this._closed) return
    if (!this.decoder || !this.configured) return
    if (this.decoder.state === 'closed') return

    try {
      const chunk = new EncodedAudioChunk({
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
   * Flush pending data
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
 * Create an audio decoder instance
 */
export function createAudioDecoder(onData, onError) {
  return new AudioDecoderWrapper(onData, onError)
}
