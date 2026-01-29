#!/usr/bin/env bash
# Generate CMAF HLS and fMP4 DASH from cs2.mp4 into media/hls and media/dash.
# Run from project root. Requires ffmpeg.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f cs2.mp4 ]]; then
  echo "Error: cs2.mp4 not found in project root."
  exit 1
fi

mkdir -p media/hls media/dash

echo "Generating HLS (CMAF) in media/hls/ ..."
cd media/hls
ffmpeg -y -i "$ROOT/cs2.mp4" -c:v libx264 -c:a aac \
  -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_time 4 -hls_playlist_type vod \
  master.m3u8
cd "$ROOT"

echo "Generating DASH (fMP4) in media/dash/ ..."
cd media/dash
ffmpeg -y -i "$ROOT/cs2.mp4" -c:v libx264 -c:a aac -f dash \
  manifest.mpd
cd "$ROOT"

echo "Done. HLS: media/hls/master.m3u8  DASH: media/dash/manifest.mpd"
