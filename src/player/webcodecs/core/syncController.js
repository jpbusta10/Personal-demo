/**
 * A/V Sync Controller
 * Synchronizes video and audio playback
 */

/**
 * Sync Controller class
 */
export class SyncController {
  constructor() {
    this.startTime = 0
    this.videoTime = 0
    this.audioTime = 0
    this.playing = false
    this.playbackRate = 1.0
    this.rafId = null
    
    // Callbacks
    this.onVideoFrame = null
    this.onAudioData = null
    
    // Queues
    this.videoQueue = []
    this.audioQueue = []
    
    // Sync threshold (microseconds)
    this.syncThreshold = 50000 // 50ms
  }
  
  /**
   * Set callbacks for video and audio output
   */
  setCallbacks(onVideoFrame, onAudioData) {
    this.onVideoFrame = onVideoFrame
    this.onAudioData = onAudioData
  }
  
  /**
   * Queue a video frame
   * @param {VideoFrame} frame
   */
  queueVideoFrame(frame) {
    this.videoQueue.push(frame)
    
    if (this.playing) {
      this.processQueues()
    }
  }
  
  /**
   * Queue audio data
   * @param {AudioData} data
   */
  queueAudioData(data) {
    this.audioQueue.push(data)
    
    if (this.playing) {
      this.processQueues()
    }
  }
  
  /**
   * Start playback
   */
  start() {
    if (this.playing) return
    
    this.playing = true
    this.startTime = performance.now()
    this.startSyncLoop()
  }
  
  /**
   * Stop playback
   */
  stop() {
    this.playing = false
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
  
  /**
   * Start the sync loop
   */
  startSyncLoop() {
    const loop = () => {
      if (!this.playing) return
      
      this.processQueues()
      this.rafId = requestAnimationFrame(loop)
    }
    
    this.rafId = requestAnimationFrame(loop)
  }
  
  /**
   * Process video and audio queues
   */
  processQueues() {
    const now = performance.now()
    const elapsed = (now - this.startTime) * 1000 * this.playbackRate // microseconds
    
    // Process video frames
    while (this.videoQueue.length > 0) {
      const frame = this.videoQueue[0]
      
      // Check if frame should be displayed
      if (frame.timestamp <= elapsed + this.syncThreshold) {
        this.videoQueue.shift()
        
        // Only render if not too late
        if (frame.timestamp >= elapsed - this.syncThreshold) {
          this.onVideoFrame?.(frame)
        } else {
          // Frame is too late, drop it
          frame.close()
        }
      } else {
        break
      }
    }
    
    // Process audio data
    while (this.audioQueue.length > 0) {
      const data = this.audioQueue[0]
      
      if (data.timestamp <= elapsed + this.syncThreshold) {
        this.audioQueue.shift()
        
        if (data.timestamp >= elapsed - this.syncThreshold) {
          this.onAudioData?.(data)
        } else {
          // Audio is too late, drop it
          data.close()
        }
      } else {
        break
      }
    }
  }
  
  /**
   * Seek to a specific time (microseconds)
   */
  seek(time) {
    // Clear queues
    this.clearQueues()
    
    // Reset timing
    this.startTime = performance.now() - (time / 1000 / this.playbackRate)
  }
  
  /**
   * Set playback rate
   */
  setPlaybackRate(rate) {
    // Adjust start time to maintain position
    const now = performance.now()
    const currentPosition = (now - this.startTime) * this.playbackRate
    
    this.playbackRate = rate
    this.startTime = now - (currentPosition / rate)
  }
  
  /**
   * Get current playback position (microseconds)
   */
  getCurrentTime() {
    const now = performance.now()
    return (now - this.startTime) * 1000 * this.playbackRate
  }
  
  /**
   * Clear all queues
   */
  clearQueues() {
    // Close video frames
    for (const frame of this.videoQueue) {
      try {
        frame.close()
      } catch (_) {}
    }
    this.videoQueue = []
    
    // Close audio data
    for (const data of this.audioQueue) {
      try {
        data.close()
      } catch (_) {}
    }
    this.audioQueue = []
  }
  
  /**
   * Reset the controller
   */
  reset() {
    this.stop()
    this.clearQueues()
    this.startTime = 0
    this.videoTime = 0
    this.audioTime = 0
  }
}

/**
 * Create a sync controller instance
 */
export function createSyncController() {
  return new SyncController()
}
