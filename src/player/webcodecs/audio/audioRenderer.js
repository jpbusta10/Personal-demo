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
  }
  
  /**
   * Queue audio data for playback
   * @param {AudioData} audioData
   */
  queueAudio(audioData) {
    if (!this.audioContext) {
      audioData.close()
      return
    }
    
    try {
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
      if (this.nextPlayTime < this.audioContext.currentTime) {
        this.nextPlayTime = this.audioContext.currentTime
      }
      
      source.start(this.nextPlayTime)
      this.nextPlayTime += buffer.duration
      
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
