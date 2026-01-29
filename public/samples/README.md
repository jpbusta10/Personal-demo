# Local CMAF/fMP4 Samples

This folder is for local video samples. The players require **CMAF/fMP4** format (not MPEG-TS).

## Required Format

- **HLS**: fMP4/CMAF segments (NOT .ts files)
  - Must have `#EXT-X-MAP` tag pointing to init segment
  - Segments must be .m4s or .mp4 files

- **DASH**: Standard fMP4 DASH
  - MPD manifest with Initialization and SegmentTemplate/SegmentList
  - fMP4 segments

## Creating CMAF Content

Use FFmpeg to create CMAF content from any video:

```bash
# Create HLS CMAF
ffmpeg -i input.mp4 \
  -c:v libx264 -c:a aac \
  -hls_segment_type fmp4 \
  -hls_fmp4_init_filename init.mp4 \
  -hls_time 4 \
  -hls_playlist_type vod \
  master.m3u8

# Create DASH
ffmpeg -i input.mp4 \
  -c:v libx264 -c:a aac \
  -f dash \
  -init_seg_name init-\$RepresentationID\$.m4s \
  -media_seg_name chunk-\$RepresentationID\$-\$Number%05d\$.m4s \
  manifest.mpd
```

## File Structure

```
public/samples/
├── master.m3u8        # HLS master playlist
├── init.mp4           # HLS init segment
├── segment0.m4s       # HLS media segments
├── segment1.m4s
├── ...
├── manifest.mpd       # DASH manifest
├── init-0.m4s         # DASH init segment
├── chunk-0-00001.m4s  # DASH media segments
└── ...
```

## Enable Local Samples

Edit `src/config/samples.js`:

```js
export const USE_LOCAL_SAMPLES = true
```

Then update `LOCAL_SAMPLES` paths if needed.
