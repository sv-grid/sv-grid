/**
 * The container an .xls file is: a Compound File, which is a FAT filesystem
 * in a file.
 *
 * Excel 97-2003 does not hold XML in a zip; it holds named streams in a
 * little filesystem, and the one that matters is `Workbook` (`Book` in the
 * oldest files). The layout is a header, a table of sector chains, a
 * directory of entries, and - for anything under 4096 bytes - a second,
 * finer allocation inside a stream of its own.
 *
 * Only what reading and writing a workbook needs is here: whole streams by
 * name, and a writer that lays a few of them out again.
 */

const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const END_OF_CHAIN = 0xfffffffe
const FREE_SECTOR = 0xffffffff
const DIFAT_SECTOR = 0xfffffffc
const FAT_SECTOR = 0xfffffffd
/** Streams smaller than this live in the mini stream. */
const MINI_CUTOFF = 4096
const DIR_ENTRY_SIZE = 128

/** Whether these bytes are a compound file at all, which is how an .xls is
 *  told from a zip without looking at the name. */
export function isCompoundFile(bytes: Uint8Array): boolean {
  return SIGNATURE.every((b, i) => bytes[i] === b)
}

type Chain = { start: number; size: number }

/** The streams a compound file holds, by name. */
export function readCompoundFile(bytes: Uint8Array): Map<string, Uint8Array> {
  if (!isCompoundFile(bytes)) throw new Error('@svgrid/enterprise: not an .xls file: the compound file signature is missing')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const sectorSize = 1 << view.getUint16(0x1e, true)
  const miniSectorSize = 1 << view.getUint16(0x20, true)
  const fatCount = view.getUint32(0x2c, true)
  const dirStart = view.getUint32(0x30, true)
  const miniFatStart = view.getUint32(0x3c, true)
  const difatStart = view.getUint32(0x44, true)
  const difatCount = view.getUint32(0x48, true)

  const sectorAt = (id: number): Uint8Array => {
    const offset = (id + 1) * sectorSize
    if (offset + sectorSize > bytes.length) throw new Error('@svgrid/enterprise: the .xls file is truncated')
    return bytes.subarray(offset, offset + sectorSize)
  }

  // The FAT's own sectors are listed in the header, and for a big file in a
  // chain of DIFAT sectors after it.
  const fatSectors: number[] = []
  for (let i = 0; i < 109 && fatSectors.length < fatCount; i += 1) {
    const id = view.getUint32(0x4c + i * 4, true)
    if (id === FREE_SECTOR) break
    fatSectors.push(id)
  }
  let next = difatStart
  for (let n = 0; n < difatCount && next !== END_OF_CHAIN && next !== FREE_SECTOR; n += 1) {
    const sector = sectorAt(next)
    const inner = new DataView(sector.buffer, sector.byteOffset, sector.byteLength)
    for (let i = 0; i < (sectorSize / 4) - 1; i += 1) {
      const id = inner.getUint32(i * 4, true)
      if (id === FREE_SECTOR) continue
      fatSectors.push(id)
    }
    next = inner.getUint32(sectorSize - 4, true)
  }

  const fat: number[] = []
  for (const id of fatSectors) {
    const sector = sectorAt(id)
    const inner = new DataView(sector.buffer, sector.byteOffset, sector.byteLength)
    for (let i = 0; i < sectorSize / 4; i += 1) fat.push(inner.getUint32(i * 4, true))
  }

  /** Every sector of a chain, in order. */
  const chainOf = (start: number, table: number[]): number[] => {
    const out: number[] = []
    let id = start
    // The cap is the table's own size: a corrupt file cannot loop forever.
    while (id !== END_OF_CHAIN && id !== FREE_SECTOR && id !== FAT_SECTOR && id !== DIFAT_SECTOR && out.length <= table.length) {
      out.push(id)
      id = table[id] ?? END_OF_CHAIN
    }
    return out
  }

  const readChain = (start: number, size: number): Uint8Array => {
    const out = new Uint8Array(size)
    let written = 0
    for (const id of chainOf(start, fat)) {
      const sector = sectorAt(id)
      const take = Math.min(sectorSize, size - written)
      if (take <= 0) break
      out.set(sector.subarray(0, take), written)
      written += take
    }
    return out
  }

  // The directory: one 128-byte entry per stream, the first being the root,
  // whose own stream holds every small stream end to end.
  const dirBytes = readChain(dirStart, chainOf(dirStart, fat).length * sectorSize)
  const entries: Array<{ name: string; type: number; chain: Chain }> = []
  for (let offset = 0; offset + DIR_ENTRY_SIZE <= dirBytes.length; offset += DIR_ENTRY_SIZE) {
    const nameLength = new DataView(dirBytes.buffer, dirBytes.byteOffset + offset, DIR_ENTRY_SIZE).getUint16(0x40, true)
    let name = ''
    for (let i = 0; i + 1 < Math.max(nameLength - 2, 0); i += 2) {
      name += String.fromCharCode(dirBytes[offset + i]! | (dirBytes[offset + i + 1]! << 8))
    }
    const entry = new DataView(dirBytes.buffer, dirBytes.byteOffset + offset, DIR_ENTRY_SIZE)
    entries.push({
      name,
      type: dirBytes[offset + 0x42]!,
      chain: { start: entry.getUint32(0x74, true), size: entry.getUint32(0x78, true) },
    })
  }

  const root = entries[0]
  const miniStream = root && root.chain.size > 0 ? readChain(root.chain.start, root.chain.size) : new Uint8Array(0)
  const miniFat: number[] = []
  if (miniFatStart !== END_OF_CHAIN && miniFatStart !== FREE_SECTOR) {
    for (const id of chainOf(miniFatStart, fat)) {
      const sector = sectorAt(id)
      const inner = new DataView(sector.buffer, sector.byteOffset, sector.byteLength)
      for (let i = 0; i < sectorSize / 4; i += 1) miniFat.push(inner.getUint32(i * 4, true))
    }
  }
  const readMini = (start: number, size: number): Uint8Array => {
    const out = new Uint8Array(size)
    let written = 0
    for (const id of chainOf(start, miniFat)) {
      const from = id * miniSectorSize
      const take = Math.min(miniSectorSize, size - written)
      if (take <= 0) break
      out.set(miniStream.subarray(from, from + take), written)
      written += take
    }
    return out
  }

  const streams = new Map<string, Uint8Array>()
  for (const entry of entries) {
    // Type 2 is a stream; 1 is a storage (a folder) and 5 the root.
    if (entry.type !== 2 || entry.chain.size === 0) continue
    streams.set(entry.name, entry.chain.size < MINI_CUTOFF
      ? readMini(entry.chain.start, entry.chain.size)
      : readChain(entry.chain.start, entry.chain.size))
  }
  return streams
}

/**
 * A compound file holding the streams given, in the order given.
 *
 * Two allocations, as the format asks: anything from 4096 bytes up gets
 * sectors of its own, and everything smaller is packed into the mini
 * stream, which is itself a chain of ordinary sectors owned by the root
 * entry. A reader decides which of the two a stream lives in by its size
 * alone, so a small stream laid out the big way is one no other program
 * can find.
 */
export function writeCompoundFile(streams: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const SECTOR = 512
  const MINI = 64
  const sectorsFor = (size: number) => Math.ceil(size / SECTOR)
  const dirEntries = streams.length + 1
  const dirSectors = Math.max(1, Math.ceil((dirEntries * DIR_ENTRY_SIZE) / SECTOR))

  const small = streams.filter((s) => s.data.length > 0 && s.data.length < MINI_CUTOFF)
  const miniSectors = small.reduce((sum, s) => sum + Math.ceil(s.data.length / MINI), 0)
  const miniStreamSize = miniSectors * MINI
  const miniFatSectors = miniSectors ? Math.ceil((miniSectors * 4) / SECTOR) : 0

  // Lay the sectors out: the big streams, the mini stream, the mini FAT,
  // the directory, and the FAT that describes all of it.
  const placed = new Map<string, { start: number; count: number }>()
  const miniAt = new Map<string, { start: number; count: number }>()
  let cursor = 0
  for (const stream of streams) {
    if (stream.data.length === 0 || stream.data.length < MINI_CUTOFF) continue
    const count = sectorsFor(stream.data.length)
    placed.set(stream.name, { start: cursor, count })
    cursor += count
  }
  let miniCursor = 0
  for (const stream of small) {
    const count = Math.ceil(stream.data.length / MINI)
    miniAt.set(stream.name, { start: miniCursor, count })
    miniCursor += count
  }
  const miniStart = cursor
  cursor += sectorsFor(miniStreamSize)
  const miniFatStart = cursor
  cursor += miniFatSectors
  const dirStart = cursor
  cursor += dirSectors
  const beforeFat = cursor
  // The FAT must describe itself, so its size settles in a step or two.
  let fatSectors = 1
  for (;;) {
    const needed = Math.max(1, Math.ceil((beforeFat + fatSectors) / (SECTOR / 4)))
    if (needed === fatSectors) break
    fatSectors = needed
  }
  const fatStart = beforeFat
  const totalSectors = fatStart + fatSectors

  const out = new Uint8Array((totalSectors + 1) * SECTOR).fill(0)
  const view = new DataView(out.buffer)
  const sectorOffset = (id: number) => (id + 1) * SECTOR

  // Header.
  out.set(SIGNATURE, 0)
  view.setUint16(0x18, 0x003e, true) // minor version
  view.setUint16(0x1a, 0x0003, true) // major version 3: 512-byte sectors
  view.setUint16(0x1c, 0xfffe, true) // little endian
  view.setUint16(0x1e, 9, true) // sector shift
  view.setUint16(0x20, 6, true) // mini sector shift
  view.setUint32(0x2c, fatSectors, true)
  view.setUint32(0x30, dirStart, true)
  view.setUint32(0x38, MINI_CUTOFF, true)
  view.setUint32(0x3c, miniFatSectors ? miniFatStart : END_OF_CHAIN, true)
  view.setUint32(0x40, miniFatSectors, true)
  view.setUint32(0x44, END_OF_CHAIN, true) // no DIFAT beyond the header
  view.setUint32(0x48, 0, true)
  for (let i = 0; i < 109; i += 1) view.setUint32(0x4c + i * 4, i < fatSectors ? fatStart + i : FREE_SECTOR, true)

  // The streams themselves: the big ones in their sectors, the small ones
  // end to end inside the mini stream.
  for (const stream of streams) {
    const where = placed.get(stream.name)
    if (where) out.set(stream.data, sectorOffset(where.start))
  }
  for (const stream of small) {
    const where = miniAt.get(stream.name)!
    out.set(stream.data, sectorOffset(miniStart) + where.start * MINI)
  }

  // The directory: the root first, then one entry per stream, as a flat
  // list - the root's child is the first stream and each names the next.
  const writeEntry = (index: number, name: string, type: number, colour: number, left: number, right: number, child: number, start: number, size: number) => {
    const base = sectorOffset(dirStart) + index * DIR_ENTRY_SIZE
    for (let i = 0; i < name.length; i += 1) view.setUint16(base + i * 2, name.charCodeAt(i), true)
    view.setUint16(base + 0x40, (name.length + 1) * 2, true)
    out[base + 0x42] = type
    out[base + 0x43] = colour
    view.setUint32(base + 0x44, left, true)
    view.setUint32(base + 0x48, right, true)
    view.setUint32(base + 0x4c, child, true)
    view.setUint32(base + 0x74, start, true)
    view.setUint32(base + 0x78, size, true)
  }
  writeEntry(0, 'Root Entry', 5, 1, FREE_SECTOR, FREE_SECTOR, streams.length ? 1 : FREE_SECTOR,
    miniStreamSize ? miniStart : END_OF_CHAIN, miniStreamSize)
  streams.forEach((stream, i) => {
    const mini = miniAt.get(stream.name)
    const big = placed.get(stream.name)
    const start = mini ? mini.start : big ? big.start : END_OF_CHAIN
    writeEntry(i + 1, stream.name, 2, 1, FREE_SECTOR, i + 2 <= streams.length ? i + 2 : FREE_SECTOR, FREE_SECTOR, start, stream.data.length)
  })
  // Unused directory slots are marked empty.
  for (let i = dirEntries; i < dirSectors * (SECTOR / DIR_ENTRY_SIZE); i += 1) {
    const base = sectorOffset(dirStart) + i * DIR_ENTRY_SIZE
    out[base + 0x42] = 0
    view.setUint32(base + 0x44, FREE_SECTOR, true)
    view.setUint32(base + 0x48, FREE_SECTOR, true)
    view.setUint32(base + 0x4c, FREE_SECTOR, true)
  }

  // The mini FAT: one chain per small stream, in the same order.
  const miniFat = new Array<number>(miniFatSectors * (SECTOR / 4)).fill(FREE_SECTOR)
  for (const stream of small) {
    const where = miniAt.get(stream.name)!
    for (let i = 0; i < where.count; i += 1) {
      miniFat[where.start + i] = i === where.count - 1 ? END_OF_CHAIN : where.start + i + 1
    }
  }
  for (let i = 0; i < miniFat.length; i += 1) view.setUint32(sectorOffset(miniFatStart) + i * 4, miniFat[i]!, true)

  // The FAT: each chain, then the FAT's own sectors.
  const fat = new Array<number>(fatSectors * (SECTOR / 4)).fill(FREE_SECTOR)
  const chain = (start: number, count: number) => {
    for (let i = 0; i < count; i += 1) fat[start + i] = i === count - 1 ? END_OF_CHAIN : start + i + 1
  }
  for (const where of placed.values()) chain(where.start, where.count)
  chain(miniStart, sectorsFor(miniStreamSize))
  chain(miniFatStart, miniFatSectors)
  chain(dirStart, dirSectors)
  for (let i = 0; i < fatSectors; i += 1) fat[fatStart + i] = FAT_SECTOR
  for (let i = 0; i < fat.length; i += 1) view.setUint32(sectorOffset(fatStart) + i * 4, fat[i]!, true)
  return out
}
