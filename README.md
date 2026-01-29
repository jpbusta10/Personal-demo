# Juan Pablo Bustamante – Personal Portfolio

Personal portfolio SPA showcasing video software work: ABR players, Web Codecs, MSE, and streaming protocols (HLS, DASH, WebRTC, Progressive).

## Stack

- **React 18** + **Vite**
- **Tailwind CSS**
- **React Router**
- Custom video players (MSE and Web Codecs, no external libraries) for HLS and DASH (CMAF/fMP4)

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Run everything (local HLS + DASH from cs2.mp4)

Use **three terminals** (or run the servers in the background):

| Step | Terminal | Command |
|------|----------|---------|
| 1. Install deps | Any | `npm install` |
| 2. Generate media (once) | Any | `npm run generate-media` *(requires FFmpeg)* |
| 3. Start HLS + DASH servers | Terminal 1 | `npm run serve-media` |
| 4. Use local servers | — | Set `USE_LOCAL_SERVERS = true` in `src/config/samples.js` |
| 5. Start the app | Terminal 2 | `npm run dev` |

Then open [http://localhost:5173](http://localhost:5173) and go to the Video Demos section. Choose MSE or Web Codecs and HLS or DASH; playback uses your local streams from `cs2.mp4`.

- **HLS** is served at http://localhost:8081/master.m3u8  
- **DASH** is served at http://localhost:8082/manifest.mpd  
- If you skip steps 2–4, demos use remote test streams (may hit CORS on some networks).

## Build

```bash
npm run build
npm run preview
```

## Project structure

- `src/components/` – Layout and sections (Header, Hero, About, Contact, Portfolio)
- `src/components/VideoDemos/` – ABR player, Web Codecs, MSE, Streaming Protocols demos
- `src/config/samples.js` – Video sample URLs (remote test streams by default)
- `public/samples/` – Optional local video assets (see `public/samples/README.md`)

## Video demos

Demos use public test streams by default. To use local HLS and DASH from `cs2.mp4`:

1. **Generate media** (requires [FFmpeg](https://ffmpeg.org/)):
   ```bash
   npm run generate-media
   ```
   This creates CMAF HLS in `media/hls/` and fMP4 DASH in `media/dash/` (both ignored by git).

2. **Start the media servers** (in a separate terminal):
   ```bash
   npm run serve-media
   ```
   HLS: http://localhost:8081/master.m3u8 · DASH: http://localhost:8082/manifest.mpd

3. **Use local servers in the app**: set `USE_LOCAL_SERVERS = true` in `src/config/samples.js`, then run `npm run dev`.

Alternatively, put files under `public/samples/` and set `USE_LOCAL_SAMPLES = true` in `src/config/samples.js`.
