/**
 * Demuxer
 * Extracts audio and video tracks from fMP4 segments
 */

import { parseInitSegment, parseMediaSegment } from '../../parsers/fmp4.js'

/**
 * Demuxer class for extracting A/V data from fMP4
 */
export class Demuxer {
  constructor() {
    this.videoConfig = null
    this.audioConfig = null
    this.initialized = false
    this.videoSegmentIndex = 0
    this.audioSegmentIndex = 0
  }
  
  /**
   * Parse init segment and extract track configs
   * @param {ArrayBuffer} data
   * @returns {{ video: object | null, audio: object | null }}
   */
  parseInit(data) {
    const result = parseInitSegment(data)
    
    if (result.video) {
      this.videoConfig = result.video
    }
    if (result.audio) {
      this.audioConfig = result.audio
    }
    
    this.initialized = true
    return result
  }
  
  /**
   * Parse media segment and extract samples
   * @param {ArrayBuffer} data
   * @param {number | null} segmentDurationSec
   * @returns {{ video: Array, audio: Array }}
   */
  parseMedia(data, segmentDurationSec = null) {
    const result = {
      video: [],
      audio: []
    }
    
    // Parse video samples using actual track ID and timescale from init segment
    if (this.videoConfig) {
      const videoTrackId = this.videoConfig.trackId || 1
      const videoTimescale = this.videoConfig.timescale || 90000
      const videoBaseTime =
        segmentDurationSec && segmentDurationSec > 0
          ? Math.round(videoTimescale * segmentDurationSec * this.videoSegmentIndex)
          : null
      const videoResult = parseMediaSegment(
        data,
        videoTrackId,
        videoTimescale,
        segmentDurationSec,
        videoBaseTime
      )
      result.video = videoResult.samples
      if (segmentDurationSec && result.video.length) {
        this.videoSegmentIndex += 1
      }
    }
    
    // Parse audio samples using actual track ID and timescale from init segment
    if (this.audioConfig) {
      const audioTrackId = this.audioConfig.trackId || 2
      const audioTimescale = this.audioConfig.timescale || 48000
      const audioBaseTime =
        segmentDurationSec && segmentDurationSec > 0
          ? Math.round(audioTimescale * segmentDurationSec * this.audioSegmentIndex)
          : null
      const audioResult = parseMediaSegment(
        data,
        audioTrackId,
        audioTimescale,
        segmentDurationSec,
        audioBaseTime
      )
      result.audio = audioResult.samples
      if (segmentDurationSec && result.audio.length) {
        this.audioSegmentIndex += 1
      }
    }
    
    return result
  }
  
  /**
   * Get video decoder config
   */
  getVideoConfig() {
    return this.videoConfig
  }
  
  /**
   * Get audio decoder config
   */
  getAudioConfig() {
    return this.audioConfig
  }
  
  /**
   * Check if video track exists
   */
  hasVideo() {
    return this.videoConfig !== null
  }
  
  /**
   * Check if audio track exists
   */
  hasAudio() {
    return this.audioConfig !== null
  }
  
  /**
   * Reset demuxer state
   */
  reset() {
    this.videoConfig = null
    this.audioConfig = null
    this.initialized = false
    this.videoSegmentIndex = 0
    this.audioSegmentIndex = 0
  }
}

/**
 * Create a demuxer instance
 */
export function createDemuxer() {
  return new Demuxer()
}
