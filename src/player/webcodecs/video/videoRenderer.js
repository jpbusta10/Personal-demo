/**
 * Video Renderer
 * Renders VideoFrames to a canvas element
 */

/**
 * Canvas-based video renderer
 */
export class VideoRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.frameQueue = []
    this.rendering = false
    this.lastFrameTime = 0
    this.startTime = 0
    this.firstFrameTimestamp = null // For normalizing timestamps
    this.clockFn = null
    this.baseTimestampUs = null
    this.paused = false
    this.pausedElapsedUs = 0
    this.rafId = null
  }
  
  /**
   * Queue a frame for rendering
   * @param {VideoFrame} frame
   */
  queueFrame(frame) {
    // Normalize timestamp relative to first frame (performance clock fallback)
    if (this.clockFn === null && this.firstFrameTimestamp === null) {
      this.firstFrameTimestamp = frame.timestamp
    }
    if (this.clockFn === null && this.firstFrameTimestamp !== null) {
      frame._normalizedTimestamp = frame.timestamp - this.firstFrameTimestamp
    }
    this.frameQueue.push(frame)
    
    // Start render loop if not running
    if (!this.rendering) {
      this.startRenderLoop()
    }
  }
  
  /**
   * Render a frame immediately
   * @param {VideoFrame} frame
   */
  renderFrame(frame) {
    if (!this.canvas || !this.ctx) return
    
    // Resize canvas if needed
    if (this.canvas.width !== frame.displayWidth || 
        this.canvas.height !== frame.displayHeight) {
      this.canvas.width = frame.displayWidth
      this.canvas.height = frame.displayHeight
    }
    
    // Draw frame
    this.ctx.drawImage(frame, 0, 0)
    
    // Close frame to release resources
    frame.close()
  }
  
  /**
   * Start the render loop for timed playback
   */
  startRenderLoop() {
    if (this.rendering) return
    
    this.rendering = true
    this.startTime = performance.now()
    this.paused = false
    this.pausedElapsedUs = 0
    
    const renderLoop = () => {
      if (!this.rendering) return
      
      const now = performance.now()
      const elapsed = this.clockFn && this.baseTimestampUs !== null
        ? this.clockFn() - this.baseTimestampUs
        : (now - this.startTime) * 1000 // Convert to microseconds
      
      if (this.paused) {
        this.rafId = requestAnimationFrame(renderLoop)
        return
      }
      
      // Render frames that should be displayed by now
      while (this.frameQueue.length > 0) {
        const frame = this.frameQueue[0]
        
        // Use normalized timestamp (performance clock) or absolute timestamp (audio clock)
        const frameTime = frame._normalizedTimestamp ?? frame.timestamp
        
        // Check if frame should be displayed
        if (frameTime <= elapsed) {
          this.frameQueue.shift()
          this.renderFrame(frame)
        } else {
          break
        }
      }
      
      this.rafId = requestAnimationFrame(renderLoop)
    }
    
    this.rafId = requestAnimationFrame(renderLoop)
  }
  
  /**
   * Stop the render loop
   */
  stopRenderLoop() {
    this.rendering = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  pause() {
    if (!this.rendering || this.paused) return
    const now = performance.now()
    this.pausedElapsedUs = (now - this.startTime) * 1000
    this.paused = true
  }

  resume() {
    if (!this.rendering || !this.paused) return
    this.startTime = performance.now() - this.pausedElapsedUs / 1000
    this.paused = false
  }
  
  /**
   * Clear the canvas and frame queue
   */
  clear() {
    this.stopRenderLoop()
    
    // Close any remaining frames
    for (const frame of this.frameQueue) {
      try {
        frame.close()
      } catch (_) {}
    }
    this.frameQueue = []
    this.firstFrameTimestamp = null
    this.baseTimestampUs = null
    this.paused = false
    this.pausedElapsedUs = 0
    
    // Clear canvas
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }
  
  /**
   * Reset timing (call when seeking or restarting)
   */
  resetTiming() {
    this.startTime = performance.now()
  }
  
  /**
   * Get queue size
   */
  get queueSize() {
    return this.frameQueue.length
  }

  setClock(getTimeUs) {
    this.clockFn = typeof getTimeUs === 'function' ? getTimeUs : null
  }

  setBaseTimestampUs(baseTimestampUs) {
    this.baseTimestampUs = Number.isFinite(baseTimestampUs) ? baseTimestampUs : null
  }
}

/**
 * Create a video renderer instance
 */
export function createVideoRenderer(canvas) {
  return new VideoRenderer(canvas)
}
