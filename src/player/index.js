/**
 * Player Module Exports
 */

// MSE Players
export { default as MSEHLSPlayer } from './mse/hls/HLSPlayer.jsx'
export { default as MSEDASHPlayer } from './mse/dash/DASHPlayer.jsx'

// Web Codecs Players
export { default as WebCodecsHLSPlayer } from './webcodecs/hls/HLSPlayer.jsx'
export { default as WebCodecsDASHPlayer } from './webcodecs/dash/DASHPlayer.jsx'

// MSE Loaders
export { HLSLoader, createHLSLoader } from './mse/hls/hlsLoader.js'
export { DASHLoader, createDASHLoader } from './mse/dash/dashLoader.js'

// MSE Core
export { 
  createMediaSource, 
  addSourceBuffer, 
  appendBuffer, 
  getSupportedVideoCodec,
  isMSESupported,
  cleanupMediaSource 
} from './mse/core/mediaSource.js'

// Web Codecs Video
export { 
  VideoDecoderWrapper, 
  createVideoDecoder,
  isVideoDecoderSupported 
} from './webcodecs/video/VideoDecoderWrapper.js'
export { VideoRenderer, createVideoRenderer } from './webcodecs/video/videoRenderer.js'

// Web Codecs Audio
export { 
  AudioDecoderWrapper, 
  createAudioDecoder,
  isAudioDecoderSupported 
} from './webcodecs/audio/AudioDecoderWrapper.js'
export { AudioRenderer, createAudioRenderer } from './webcodecs/audio/audioRenderer.js'

// Web Codecs Core
export { Demuxer, createDemuxer } from './webcodecs/core/demuxer.js'
export { SyncController, createSyncController } from './webcodecs/core/syncController.js'

// Parsers
export { parseM3u8, loadHlsManifest, resolveUrl } from './parsers/m3u8.js'
export { parseMpd, loadDashManifest } from './parsers/mpd.js'
export { parseInitSegment, parseMediaSegment } from './parsers/fmp4.js'
