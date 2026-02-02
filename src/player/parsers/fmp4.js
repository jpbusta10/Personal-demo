/**
 * fMP4 Box Parser
 * Parses fragmented MP4 for init segments (codec config) and media segments (samples).
 * ISO BMFF box structure: [size:4][type:4][payload...]
 */

function readU32(data, offset) {
  // Use >>> 0 to ensure unsigned 32-bit result (bitwise ops in JS are signed)
  return ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0
}

function readU16(data, offset) {
  return (data[offset] << 8) | data[offset + 1]
}

function readU64(data, offset) {
  const high = readU32(data, offset)
  const low = readU32(data, offset + 4)
  return high * 0x100000000 + low
}

/**
 * Find a box by type in the data
 */
function findBox(data, type, start = 0, end = data.byteLength) {
  let offset = start
  while (offset < end - 8) {
    let size = readU32(data, offset)
    const name = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7])
    let headerSize = 8
    
    if (size === 1) {
      size = readU64(data, offset + 8)
      headerSize = 16
    } else if (size === 0) {
      size = end - offset
    }
    
    if (name === type) {
      return { 
        offset: offset + headerSize, 
        size: size - headerSize, 
        fullSize: size,
        start: offset
      }
    }
    offset += size
  }
  return null
}

/**
 * Find all boxes of a type
 */
function findAllBoxes(data, type, start = 0, end = data.byteLength) {
  const boxes = []
  let offset = start
  while (offset < end - 8) {
    let size = readU32(data, offset)
    const name = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7])
    let headerSize = 8
    
    if (size === 1) {
      size = readU64(data, offset + 8)
      headerSize = 16
    } else if (size === 0) {
      size = end - offset
    }
    
    if (name === type) {
      boxes.push({ 
        offset: offset + headerSize, 
        size: size - headerSize, 
        fullSize: size,
        start: offset
      })
    }
    offset += size
  }
  return boxes
}

/**
 * Extract avcC (H.264 decoder config) from stsd
 * stsd payload: version(4) + entry_count(4) then sample entries; try both standard offset and full range
 */
function getAvcC(data, stsdOffset, stsdSize) {
  const end = stsdOffset + stsdSize
  const avc1 =
    findBox(data, 'avc1', stsdOffset + 8, end) ||
    findBox(data, 'avc3', stsdOffset + 8, end) ||
    findBox(data, 'avc1', stsdOffset, end) ||
    findBox(data, 'avc3', stsdOffset, end)
  if (!avc1) return null

  const avcC = findBox(data, 'avcC', avc1.offset, avc1.offset + avc1.size)
  if (!avcC) return null

  return data.slice(avcC.offset, avcC.offset + avcC.size)
}

/**
 * Extract esds (AAC decoder config) from stsd
 */
function getEsds(data, stsdOffset, stsdSize) {
  const mp4a = findBox(data, 'mp4a', stsdOffset + 8, stsdOffset + stsdSize)
  if (!mp4a) return null
  
  const esds = findBox(data, 'esds', mp4a.offset, mp4a.offset + mp4a.size)
  if (!esds) return null
  
  // Parse esds to get AudioSpecificConfig
  const esdsData = data.slice(esds.offset, esds.offset + esds.size)
  // Skip version/flags (4 bytes), then parse descriptors
  let pos = 4
  
  // Find DecoderConfigDescriptor (tag 0x04) which contains DecoderSpecificInfo (tag 0x05)
  while (pos < esdsData.length - 2) {
    const tag = esdsData[pos]
    pos++
    // Read size (variable length)
    let size = 0
    let byte
    do {
      byte = esdsData[pos++]
      size = (size << 7) | (byte & 0x7f)
    } while (byte & 0x80)
    
    if (tag === 0x05) {
      // DecoderSpecificInfo - this is the AudioSpecificConfig
      return esdsData.slice(pos, pos + size)
    }
    pos += size
  }
  
  return null
}

function parseAacAudioObjectType(audioSpecificConfig) {
  if (!audioSpecificConfig || audioSpecificConfig.length < 2) return null
  // AudioSpecificConfig: 5 bits audioObjectType, 4 bits samplingFrequencyIndex, 4 bits channelConfig
  const byte0 = audioSpecificConfig[0]
  const byte1 = audioSpecificConfig[1]
  let audioObjectType = (byte0 >> 3) & 0x1f
  if (audioObjectType === 31 && audioSpecificConfig.length >= 3) {
    // escape value: read next 6 bits
    const byte2 = audioSpecificConfig[2]
    audioObjectType = 32 + ((byte0 & 0x07) << 3) + ((byte1 >> 5) & 0x07)
    // note: this is a simplified escape handling; good enough for common AAC
  }
  return audioObjectType || null
}

/**
 * Get track_id from tkhd box inside a trak
 */
function getTrackId(view, trakOffset, trakSize) {
  const tkhd = findBox(view, 'tkhd', trakOffset, trakOffset + trakSize)
  if (!tkhd) return null
  // tkhd: version(1) + flags(3) + ...
  // v0: creation_time(4) + modification_time(4) + track_id(4)
  // v1: creation_time(8) + modification_time(8) + track_id(4)
  const version = view[tkhd.offset]
  const trackIdOffset = version === 1 ? tkhd.offset + 1 + 3 + 8 + 8 : tkhd.offset + 1 + 3 + 4 + 4
  return readU32(view, trackIdOffset)
}

/**
 * Get timescale from mdhd box inside mdia
 */
function getTimescale(view, mdiaOffset, mdiaSize) {
  const mdhd = findBox(view, 'mdhd', mdiaOffset, mdiaOffset + mdiaSize)
  if (!mdhd) return null
  // mdhd: version(1) + flags(3) + ...
  // v0: creation_time(4) + modification_time(4) + timescale(4)
  // v1: creation_time(8) + modification_time(8) + timescale(4)
  const version = view[mdhd.offset]
  const timescaleOffset = version === 1 ? mdhd.offset + 1 + 3 + 8 + 8 : mdhd.offset + 1 + 3 + 4 + 4
  return readU32(view, timescaleOffset)
}

/**
 * Parse init segment and extract track configs
 * @param {ArrayBuffer} data
 * @returns {{ video: { codec: string, description: Uint8Array, trackId: number } | null, audio: { codec: string, sampleRate: number, channels: number, description: Uint8Array, trackId: number } | null }}
 */
export function parseInitSegment(data) {
  const view = new Uint8Array(data)
  const result = { video: null, audio: null }

  const moov = findBox(view, 'moov', 0)
  if (!moov) return result

  // Strategy 1: walk trak -> mdia -> minf -> stbl -> stsd
  const traks = findAllBoxes(view, 'trak', moov.offset, moov.offset + moov.size)
  for (const trak of traks) {
    const trackId = getTrackId(view, trak.offset, trak.size)
    const mdia = findBox(view, 'mdia', trak.offset, trak.offset + trak.size)
    if (!mdia) continue
    const timescale = getTimescale(view, mdia.offset, mdia.size)
    const minf = findBox(view, 'minf', mdia.offset, mdia.offset + mdia.size)
    if (!minf) continue
    const stbl = findBox(view, 'stbl', minf.offset, minf.offset + minf.size)
    if (!stbl) continue
    const stsd = findBox(view, 'stsd', stbl.offset, stbl.offset + stbl.size)
    if (!stsd) continue
    extractTrackConfigsFromStsd(view, stsd, result, trackId, timescale)
  }

  // Strategy 2: if still missing, find every stsd inside moov and check for avcC/mp4a
  if (!result.video || !result.audio) {
    const allStsd = findAllBoxes(view, 'stsd', moov.offset, moov.offset + moov.size)
    for (const stsd of allStsd) {
      extractTrackConfigsFromStsd(view, stsd, result, null, null)
    }
  }

  // Strategy 3: linear scan for 'stsd' anywhere (stsd is nested inside trak)
  if (!result.video || !result.audio) {
    const stsdList = findBoxesLinear(view, 'stsd', 0, view.length)
    for (const stsd of stsdList) {
      extractTrackConfigsFromStsd(view, stsd, result, null, null)
    }
  }

  // Strategy 4: direct linear scan for avcC box (use first one as video config)
  if (!result.video) {
    const avcCList = findBoxesLinear(view, 'avcC', 0, view.length)
    if (avcCList.length > 0) {
      const avcC = avcCList[0]
      const desc = view.slice(avcC.offset, avcC.offset + avcC.size)
      result.video = {
        codec: codecStringFromAvcC(desc),
        description: new Uint8Array(desc),
        trackId: 1, // default to 1 for fallback
      }
    }
  }

  return result
}

/**
 * Linear scan for all boxes of type (finds nested boxes).
 * Advance by 1 so we don't miss boxes that don't start at 4-byte alignment.
 */
function findBoxesLinear(data, type, start, end) {
  const list = []
  const t0 = type.charCodeAt(0)
  const t1 = type.charCodeAt(1)
  const t2 = type.charCodeAt(2)
  const t3 = type.charCodeAt(3)
  let offset = start
  while (offset <= end - 8) {
    if (
      data[offset + 4] === t0 &&
      data[offset + 5] === t1 &&
      data[offset + 6] === t2 &&
      data[offset + 7] === t3
    ) {
      let size = readU32(data, offset)
      let payloadStart = offset + 8
      if (size === 1 && offset + 16 <= end) {
        size = Number(readU64(data, offset + 8))
        payloadStart = offset + 16
      } else if (size === 0) {
        size = end - offset
      }
      if (size >= 8 && offset + size <= end) {
        list.push({
          offset: payloadStart,
          size: size - (payloadStart - offset),
          fullSize: size,
          start: offset,
        })
      }
      offset += Math.max(size, 8)
    } else {
      offset += 1
    }
  }
  return list
}

function codecStringFromAvcC(avcC) {
  if (!avcC || avcC.length < 4) return 'avc1.42E01E'
  const p = avcC[1]
  const c = avcC[2]
  const l = avcC[3]
  return 'avc1.' + [p, c, l].map(b => (b >>> 0).toString(16).padStart(2, '0').toUpperCase()).join('')
}

function getAvc1Size(view, stsdOffset, stsdSize) {
  const end = stsdOffset + stsdSize
  const avc1 =
    findBox(view, 'avc1', stsdOffset + 8, end) ||
    findBox(view, 'avc3', stsdOffset + 8, end) ||
    findBox(view, 'avc1', stsdOffset, end) ||
    findBox(view, 'avc3', stsdOffset, end)
  if (!avc1 || avc1.size < 30) return null
  const width = readU16(view, avc1.offset + 24)
  const height = readU16(view, avc1.offset + 26)
  return { width: width || 1920, height: height || 1080 }
}

function extractTrackConfigsFromStsd(view, stsd, result, trackId, timescale) {
  const avcC = getAvcC(view, stsd.offset, stsd.size)
  if (avcC && !result.video) {
    const size = getAvc1Size(view, stsd.offset, stsd.size)
    result.video = {
      codec: codecStringFromAvcC(avcC),
      description: new Uint8Array(avcC),
      codedWidth: size?.width,
      codedHeight: size?.height,
      trackId: trackId || 1,
      timescale: timescale || 90000, // Default to 90kHz if not found
    }
  }
  const mp4a = findBox(view, 'mp4a', stsd.offset + 8, stsd.offset + stsd.size)
  if (mp4a && !result.audio) {
    const esds = getEsds(view, stsd.offset, stsd.size)
    const audioObjectType = parseAacAudioObjectType(esds)
    // mp4a sample entry:
    // 6 bytes reserved, 2 bytes data_reference_index,
    // 8 bytes reserved, 2 bytes channelcount,
    // 2 bytes samplesize, 2 bytes pre_defined, 2 bytes reserved,
    // 4 bytes samplerate (16.16 fixed)
    const channels = readU16(view, mp4a.offset + 16)
    const sampleRate = readU32(view, mp4a.offset + 24) >> 16
    result.audio = {
      codec: `mp4a.40.${audioObjectType || 2}`,
      sampleRate: sampleRate || 44100,
      channels: channels || 2,
      description: esds ? new Uint8Array(esds) : null,
      trackId: trackId || 2,
      timescale: timescale || 48000, // Default to 48kHz for audio
    }
  }
}

/**
 * Parse media segment and extract samples
 * @param {ArrayBuffer} data
 * @param {number} trackId - Actual track ID from init segment (not array index)
 * @param {number} timescale - Timescale from init segment (ticks per second)
 * @param {number | null} segmentDurationSec - Duration of segment in seconds (if known)
 * @param {number | null} baseDecodeTimeOverride - Base decode time in track timescale ticks
 * @returns {{ samples: Array<{ type: string, timestamp: number, duration: number, data: Uint8Array }> }}
 */
export function parseMediaSegment(
  data,
  trackId = 1,
  timescale = 90000,
  segmentDurationSec = null,
  baseDecodeTimeOverride = null
) {
  const view = new Uint8Array(data)
  const samples = []
  
  const moof = findBox(view, 'moof', 0)
  const mdat = findBox(view, 'mdat', 0)
  if (!moof || !mdat) {
    console.warn('parseMediaSegment: missing moof or mdat', { hasMoof: !!moof, hasMdat: !!mdat })
    return { samples }
  }
  
  // Find traf for the track by matching track_id in tfhd
  const trafs = findAllBoxes(view, 'traf', moof.offset, moof.offset + moof.size)
  let traf = null
  let foundTrackId = null
  
  for (const t of trafs) {
    const tfhd = findBox(view, 'tfhd', t.offset, t.offset + t.size)
    if (tfhd) {
      // tfhd: version(1) + flags(3) + track_id(4)
      const tfhdTrackId = readU32(view, tfhd.offset + 4)
      if (tfhdTrackId === trackId) {
        traf = t
        foundTrackId = tfhdTrackId
        break
      }
    }
  }
  
  // Fallback to first traf if no match found
  if (!traf) {
    traf = trafs[0]
    if (traf) {
      const tfhd = findBox(view, 'tfhd', traf.offset, traf.offset + traf.size)
      if (tfhd) foundTrackId = readU32(view, tfhd.offset + 4)
    }
    console.warn('parseMediaSegment: no matching traf for trackId', trackId, 'using', foundTrackId)
  }
  if (!traf) return { samples }
  
  // Get base decode time from tfdt (Track Fragment Decode Time)
  // tfdt structure: version(1) + flags(3) + baseMediaDecodeTime(4 or 8 bytes)
  let baseDecodeTime = 0
  let tfdtVersion = 0
  const tfdt = findBox(view, 'tfdt', traf.offset, traf.offset + traf.size)
  if (tfdt) {
    tfdtVersion = view[tfdt.offset]
    if (tfdtVersion === 1) {
      // 64-bit baseMediaDecodeTime
      baseDecodeTime = readU64(view, tfdt.offset + 4)
    } else {
      // 32-bit baseMediaDecodeTime
      baseDecodeTime = readU32(view, tfdt.offset + 4)
    }
  }
  if (baseDecodeTimeOverride !== null && Number.isFinite(baseDecodeTimeOverride)) {
    baseDecodeTime = baseDecodeTimeOverride
  }
  
  // Get default sample duration from tfhd
  // tfhd structure: version(1) + flags(3) + track_id(4) + [optional fields based on flags]
  const tfhd = findBox(view, 'tfhd', traf.offset, traf.offset + traf.size)
  let defaultDuration = 0
  let defaultSampleSize = 0
  let tfhdFlags = 0
  if (tfhd) {
    tfhdFlags = readU32(view, tfhd.offset) & 0xffffff
    let pos = tfhd.offset + 8 // skip version+flags(4) + track_id(4)
    if (tfhdFlags & 0x000001) pos += 8 // base_data_offset (64-bit)
    if (tfhdFlags & 0x000002) pos += 4 // sample_description_index
    if (tfhdFlags & 0x000008) {
      defaultDuration = readU32(view, pos)
      pos += 4
    }
    if (tfhdFlags & 0x000010) {
      defaultSampleSize = readU32(view, pos)
      pos += 4
    }
    // Sanity check: if default duration seems unreasonable, use a calculated default
    // For video at 90kHz, reasonable duration is 1500-6000 (15-60fps)
    // For audio at 48kHz, reasonable duration is 1024-2048 (AAC frames)
    const maxReasonableDuration = timescale > 10000 ? timescale / 10 : timescale / 10 // Max 10fps / 100ms per sample
    if (defaultDuration === 0 || defaultDuration > maxReasonableDuration) {
      // Use 30fps for video, 1024 samples for audio
      defaultDuration = timescale > 10000 ? Math.round(timescale / 30) : 1024
      console.log('Using calculated defaultDuration:', defaultDuration, 'for timescale:', timescale)
    }
  }
  
  const trun = findBox(view, 'trun', traf.offset, traf.offset + traf.size)
  if (!trun) return { samples }
  
  const flags = readU32(view, trun.offset) & 0xffffff
  const sampleCount = readU32(view, trun.offset + 4)
  
  let pos = trun.offset + 8
  // data_offset: offset from the start of the moof box to the first sample data
  // (per ISO 14496-12, it's relative to the enclosing Movie Fragment Box)
  let dataOffset = mdat.offset // default: start of mdat payload (after 8-byte header)
  
  if (flags & 0x01) {
    // data_offset is a signed 32-bit offset from the start of the moof box
    const dataOffsetVal = readU32(view, pos)
    dataOffset = moof.start + dataOffsetVal
    pos += 4
  }
  let firstSampleFlags = 0
  if (flags & 0x04) {
    firstSampleFlags = readU32(view, pos)
    pos += 4
  }
  
  const hasDuration = (flags & 0x100) !== 0
  const hasSize = (flags & 0x200) !== 0
  const hasFlags = (flags & 0x400) !== 0
  const hasCTO = (flags & 0x800) !== 0
  
  // Start timestamp from base decode time (from tfdt)
  let timestamp = baseDecodeTime
  let sampleOffset = dataOffset
  
  // If per-sample duration is missing and segment duration is known, compute per-sample duration
  const computedDuration = !hasDuration && segmentDurationSec && sampleCount > 0
    ? Math.max(1, Math.round((segmentDurationSec * timescale) / sampleCount))
    : null

  for (let i = 0; i < sampleCount; i++) {
    let duration = defaultDuration
    let size = 0
    let sampleFlags = hasFlags ? 0 : (i === 0 ? firstSampleFlags : 0)
    
    if (hasDuration) {
      duration = readU32(view, pos)
      pos += 4
    } else if (computedDuration) {
      duration = computedDuration
    }
    if (hasSize) {
      size = readU32(view, pos)
      pos += 4
    }
    if (hasFlags) {
      sampleFlags = readU32(view, pos)
      pos += 4
    }
    if (hasCTO) pos += 4
    
    if (size > 0 && sampleOffset + size <= view.length) {
      // First sample of a fragment is always a keyframe (required for fMP4 playback)
      // Otherwise use sample_is_non_sync_sample bit (0x02000000): 0 = sync/keyframe
      const isKeyframe = i === 0 || (sampleFlags & 0x02000000) === 0
      samples.push({
        type: isKeyframe ? 'key' : 'delta',
        timestamp: (timestamp / timescale) * 1e6,
        duration: (duration / timescale) * 1e6,
        data: view.slice(sampleOffset, sampleOffset + size),
      })
    }
    
    timestamp += duration
    sampleOffset += size
  }
  
  // Debug logging
  if (samples.length > 0) {
    const first = samples[0]
    const last = samples[samples.length - 1]
    console.log('parseMediaSegment:', {
      trackId,
      timescale,
      tfhdFlags: '0x' + tfhdFlags.toString(16),
      trunFlags: '0x' + flags.toString(16),
      hasDuration,
      defaultDuration,
      baseDecodeTime,
      firstDurationMs: Math.round(first.duration / 1000),
      firstTimestampMs: Math.round(first.timestamp / 1000),
      lastTimestampMs: Math.round(last.timestamp / 1000),
      sampleCount: samples.length,
    })
  }
  
  return { samples }
}
