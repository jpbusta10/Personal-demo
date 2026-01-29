/**
 * Sample video URLs for demos
 * All streams use CMAF/fMP4 format (required for MSE and Web Codecs)
 */

export const SAMPLE_URLS = {
  // HLS CMAF - Bitmovin test stream (fMP4 segments)
  HLS: 'https://bitmovin-a.akamaihd.net/content/MI201109210084_1/m3u8s-fmp4/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
  
  // DASH - Bitmovin test stream (fMP4 segments)  
  DASH: 'https://bitmovin-a.akamaihd.net/content/MI201109210084_1/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd',
  
  // Progressive MP4
  MP4: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
}

// Alternative CMAF streams (backup)
export const ALT_SAMPLE_URLS = {
  // Apple HLS fMP4 test
  HLS: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_adv_example_hevc/master.m3u8',
  // Unified streaming test
  DASH: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
}

// Local paths (when you add files to public/samples/)
export const LOCAL_SAMPLES = {
  HLS: '/samples/master.m3u8',
  DASH: '/samples/manifest.mpd',
  MP4: '/samples/video.mp4',
}

// Local HTTP servers (npm run generate-media, then npm run serve-media)
export const LOCAL_SERVERS = {
  HLS: 'http://localhost:8081/master.m3u8',
  DASH: 'http://localhost:8082/manifest.mpd',
  MP4: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
}

// Use remote by default so demos work out of the box
export const USE_LOCAL_SAMPLES = false
// Set true after running: npm run generate-media && npm run serve-media
export const USE_LOCAL_SERVERS = false

export function getSampleUrl(type) {
  if (USE_LOCAL_SERVERS) return LOCAL_SERVERS[type]
  return USE_LOCAL_SAMPLES ? LOCAL_SAMPLES[type] : SAMPLE_URLS[type]
}

export function getAltSampleUrl(type) {
  return ALT_SAMPLE_URLS[type]
}
