/**
 * fMP4 Box Parser
 * Parses fragmented MP4 for init segments (codec config) and media segments (samples).
 * ISO BMFF box structure: [size:4][type:4][payload...]
 */

function readU32(data, offset) {
  return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]
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
 */
function getAvcC(data, stsdOffset, stsdSize) {
  const avc1 = findBox(data, 'avc1', stsdOffset + 8, stsdOffset + stsdSize) ||
               findBox(data, 'avc3', stsdOffset + 8, stsdOffset + stsdSize)
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

/**
 * Parse init segment and extract track configs
 * @param {ArrayBuffer} data
 * @returns {{ video: { codec: string, description: Uint8Array } | null, audio: { codec: string, sampleRate: number, channels: number, description: Uint8Array } | null }}
 */
export function parseInitSegment(data) {
  const view = new Uint8Array(data)
  const result = { video: null, audio: null }
  
  const moov = findBox(view, 'moov', 0)
  if (!moov) return result
  
  // Find all tracks
  const traks = findAllBoxes(view, 'trak', moov.offset, moov.offset + moov.size)
  
  for (const trak of traks) {
    const mdia = findBox(view, 'mdia', trak.offset, trak.offset + trak.size)
    if (!mdia) continue
    
    const hdlr = findBox(view, 'hdlr', mdia.offset, mdia.offset + mdia.size)
    if (!hdlr) continue
    
    // Handler type is at offset 8 in hdlr payload
    const handlerType = String.fromCharCode(
      view[hdlr.offset + 8],
      view[hdlr.offset + 9],
      view[hdlr.offset + 10],
      view[hdlr.offset + 11]
    )
    
    const minf = findBox(view, 'minf', mdia.offset, mdia.offset + mdia.size)
    if (!minf) continue
    
    const stbl = findBox(view, 'stbl', minf.offset, minf.offset + minf.size)
    if (!stbl) continue
    
    const stsd = findBox(view, 'stsd', stbl.offset, stbl.offset + stbl.size)
    if (!stsd) continue
    
    if (handlerType === 'vide') {
      const avcC = getAvcC(view, stsd.offset, stsd.size)
      if (avcC) {
        result.video = {
          codec: 'avc1.42E01E',
          description: new Uint8Array(avcC),
        }
      }
    } else if (handlerType === 'soun') {
      const esds = getEsds(view, stsd.offset, stsd.size)
      // Get sample rate and channels from mp4a box
      const mp4a = findBox(view, 'mp4a', stsd.offset + 8, stsd.offset + stsd.size)
      if (mp4a) {
        const sampleRate = readU32(view, mp4a.offset + 16) >> 16
        const channels = readU16(view, mp4a.offset + 8)
        result.audio = {
          codec: 'mp4a.40.2',
          sampleRate: sampleRate || 44100,
          channels: channels || 2,
          description: esds ? new Uint8Array(esds) : null,
        }
      }
    }
  }
  
  return result
}

/**
 * Parse media segment and extract samples
 * @param {ArrayBuffer} data
 * @param {number} trackId - Track ID to extract (0 = first track)
 * @returns {{ samples: Array<{ type: string, timestamp: number, duration: number, data: Uint8Array }> }}
 */
export function parseMediaSegment(data, trackId = 0) {
  const view = new Uint8Array(data)
  const samples = []
  
  const moof = findBox(view, 'moof', 0)
  const mdat = findBox(view, 'mdat', 0)
  if (!moof || !mdat) return { samples }
  
  // Find traf for the track
  const trafs = findAllBoxes(view, 'traf', moof.offset, moof.offset + moof.size)
  const traf = trafs[trackId] || trafs[0]
  if (!traf) return { samples }
  
  // Get default sample duration from tfhd
  const tfhd = findBox(view, 'tfhd', traf.offset, traf.offset + traf.size)
  let defaultDuration = 1024
  if (tfhd) {
    const tfhdFlags = readU32(view, tfhd.offset) & 0xffffff
    let pos = tfhd.offset + 4 // skip track_id
    if (tfhdFlags & 0x01) pos += 8 // base_data_offset
    if (tfhdFlags & 0x02) pos += 4 // sample_description_index
    if (tfhdFlags & 0x08) {
      defaultDuration = readU32(view, pos)
    }
  }
  
  const trun = findBox(view, 'trun', traf.offset, traf.offset + traf.size)
  if (!trun) return { samples }
  
  const flags = readU32(view, trun.offset) & 0xffffff
  const sampleCount = readU32(view, trun.offset + 4)
  
  let pos = trun.offset + 8
  let dataOffset = mdat.start + 8 // Default to mdat start
  
  if (flags & 0x01) {
    dataOffset = moof.start - 8 + readU32(view, pos)
    pos += 4
  }
  if (flags & 0x04) pos += 4 // first_sample_flags
  
  const hasDuration = (flags & 0x100) !== 0
  const hasSize = (flags & 0x200) !== 0
  const hasFlags = (flags & 0x400) !== 0
  const hasCTO = (flags & 0x800) !== 0
  
  let timestamp = 0
  const timescale = 90000 // Assume 90kHz for video, will be overridden for audio
  let sampleOffset = dataOffset
  
  for (let i = 0; i < sampleCount; i++) {
    let duration = defaultDuration
    let size = 0
    let sampleFlags = 0
    
    if (hasDuration) {
      duration = readU32(view, pos)
      pos += 4
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
      const isKeyframe = (sampleFlags & 0x10000) === 0 && i === 0
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
  
  return { samples }
}
