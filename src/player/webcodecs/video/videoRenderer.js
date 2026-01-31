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
    this.rafId = null
  }
  
  /**
   * Queue a frame for rendering
   * @param {VideoFrame} frame
   */
  queueFrame(frame) {
    // Normalize timestamp relative to first frame
    if (this.firstFrameTimestamp === null) {
      this.firstFrameTimestamp = frame.timestamp
    }
    
    // Store normalized timestamp for rendering
    frame._normalizedTimestamp = frame.timestamp - this.firstFrameTimestamp
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
    
    const renderLoop = () => {
      if (!this.rendering) return
      
      const now = performance.now()
      const elapsed = (now - this.startTime) * 1000 // Convert to microseconds
      
      // Render frames that should be displayed by now
      while (this.frameQueue.length > 0) {
        const frame = this.frameQueue[0]
        
        // Use normalized timestamp (relative to first frame)
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
}

/**
 * Create a video renderer instance
 */
export function createVideoRenderer(canvas) {
  return new VideoRenderer(canvas)
}
