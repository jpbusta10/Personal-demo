/**
 * Audio Renderer
 * Plays AudioData using Web Audio API
 */

/**
 * AudioContext-based audio renderer
 */
export class AudioRenderer {
  constructor() {
    this.audioContext = null
    this.audioQueue = []
    this.playing = false
    this.nextPlayTime = 0
    this.startTime = 0
    this.volume = 1.0
    this.gainNode = null
    this.baseTimestampUs = null
    this.baseAudioTime = null
    this.onBaseTimestamp = null
  }
  
  /**
   * Initialize the audio context (must be called after user interaction)
   */
  async init() {
    if (this.audioContext) return
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    this.gainNode = this.audioContext.createGain()
    this.gainNode.connect(this.audioContext.destination)
    this.gainNode.gain.value = this.volume
    
    // Resume if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    // Flush any queued audio data
    if (this.audioQueue.length > 0) {
      const queued = [...this.audioQueue]
      this.audioQueue = []
      for (const audioData of queued) {
        this._scheduleAudio(audioData)
      }
    }
  }
  
  /**
   * Queue audio data for playback
   * @param {AudioData} audioData
   */
  queueAudio(audioData) {
    if (!this.audioContext) {
      this.audioQueue.push(audioData)
      return
    }
    this._scheduleAudio(audioData)
  }

  _scheduleAudio(audioData) {
    try {
      const timestampUs = Number.isFinite(audioData.timestamp) ? audioData.timestamp : null
      if (timestampUs !== null) {
        if (this.baseTimestampUs === null) {
          this.baseTimestampUs = timestampUs
          this.baseAudioTime = this.audioContext.currentTime
          this.onBaseTimestamp?.(this.baseTimestampUs)
        }
      }

      // Convert AudioData to AudioBuffer
      const buffer = this.audioContext.createBuffer(
        audioData.numberOfChannels,
        audioData.numberOfFrames,
        audioData.sampleRate
      )
      
      // Copy data to buffer
      for (let i = 0; i < audioData.numberOfChannels; i++) {
        const channelData = new Float32Array(audioData.numberOfFrames)
        audioData.copyTo(channelData, { planeIndex: i, format: 'f32-planar' })
        buffer.copyToChannel(channelData, i)
      }
      
      // Schedule playback
      const source = this.audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(this.gainNode)
      
      // Calculate when to play
      let startTime = this.nextPlayTime
      if (timestampUs !== null && this.baseTimestampUs !== null && this.baseAudioTime !== null) {
        startTime = this.baseAudioTime + (timestampUs - this.baseTimestampUs) / 1e6
      }
      if (startTime < this.audioContext.currentTime) {
        startTime = this.audioContext.currentTime
      }
      
      source.start(startTime)
      this.nextPlayTime = Math.max(this.nextPlayTime, startTime + buffer.duration)
      
      // Close the AudioData to release resources
      audioData.close()
    } catch (e) {
      console.error('Audio render error:', e)
      try {
        audioData.close()
      } catch (_) {}
    }
  }
  
  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value))
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume
    }
  }

  async resume() {
    if (!this.audioContext) return
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
      this.nextPlayTime = this.audioContext.currentTime
    }
  }

  async suspend() {
    if (!this.audioContext) return
    if (this.audioContext.state === 'running') {
      await this.audioContext.suspend()
    }
  }

  setBaseTimestampCallback(callback) {
    this.onBaseTimestamp = typeof callback === 'function' ? callback : null
  }

  getCurrentTimeUs() {
    return (this.audioContext?.currentTime || 0) * 1e6
  }

  getBaseTimestampUs() {
    return this.baseTimestampUs
  }
  
  /**
   * Get current audio context time
   */
  get currentTime() {
    return this.audioContext?.currentTime || 0
  }
  
  /**
   * Reset timing (call when seeking or restarting)
   */
  resetTiming() {
    this.nextPlayTime = this.audioContext?.currentTime || 0
  }
  
  /**
   * Clear queued audio and stop playback
   */
  clear() {
    // Close any queued audio
    for (const audio of this.audioQueue) {
      try {
        audio.close()
      } catch (_) {}
    }
    this.audioQueue = []
    this.nextPlayTime = this.audioContext?.currentTime || 0
    this.baseTimestampUs = null
    this.baseAudioTime = null
  }
  
  /**
   * Close and cleanup
   */
  close() {
    this.clear()
    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch (_) {}
      this.audioContext = null
    }
    this.gainNode = null
  }
}

/**
 * Create an audio renderer instance
 */
export function createAudioRenderer() {
  return new AudioRenderer()
}
