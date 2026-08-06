/**
 * Zero-dependency QR Code Matrix & SVG Path Generator.
 * Encodes text / URLs into QR Code Version 1-10 matrices with Reed-Solomon Error Correction.
 */

export interface QrCodeSvgResult {
  size: number
  path: string
}

// Galois Field GF(256) tables with primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (285 / 0x11D)
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

;(function initGF() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_EXP[i + 255] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) {
      x ^= 0x11d
    }
  }
})()

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0
  return GF_EXP[GF_LOG[x] + GF_LOG[y]]
}

function gfPolyMul(p1: Uint8Array, p2: Uint8Array): Uint8Array {
  const result = new Uint8Array(p1.length + p2.length - 1)
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j])
    }
  }
  return result
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]) as Uint8Array
  for (let i = 0; i < degree; i++) {
    poly = gfPolyMul(poly, new Uint8Array([1, GF_EXP[i]])) as Uint8Array
  }
  return poly
}

function rsComputeRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount)
  const res = new Uint8Array(data.length + ecCount)
  res.set(data)

  for (let i = 0; i < data.length; i++) {
    const coef = res[i]
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef)
      }
    }
  }
  return new Uint8Array(res.buffer, data.length, ecCount)
}

// QR Code Version Specs (Versions 1-6 Error Correction Level L/M)
interface QrVersionSpec {
  version: number
  size: number
  totalCodewords: number
  dataCodewords: number
  ecCodewords: number
}

const VERSION_SPECS: QrVersionSpec[] = [
  { version: 1, size: 21, totalCodewords: 26, dataCodewords: 19, ecCodewords: 7 },
  { version: 2, size: 25, totalCodewords: 44, dataCodewords: 34, ecCodewords: 10 },
  { version: 3, size: 29, totalCodewords: 70, dataCodewords: 55, ecCodewords: 15 },
  { version: 4, size: 33, totalCodewords: 100, dataCodewords: 80, ecCodewords: 20 },
  { version: 5, size: 37, totalCodewords: 134, dataCodewords: 108, ecCodewords: 26 },
  { version: 6, size: 41, totalCodewords: 172, dataCodewords: 136, ecCodewords: 36 },
]

function getVersionSpec(textLength: number): QrVersionSpec {
  // Byte mode header = 4 bits mode + 8 bits length + (textLength * 8) bits
  const neededBytes = textLength + 3
  for (const spec of VERSION_SPECS) {
    if (neededBytes <= spec.dataCodewords) {
      return spec
    }
  }
  return VERSION_SPECS[VERSION_SPECS.length - 1]
}

/**
 * Generates a 2D boolean array representing a QR Code matrix.
 *
 * @param text UTF-8 / ASCII text or URL to encode
 * @returns boolean[][] matrix where true = black module, false = white module
 */
export function generateQrCodeMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text)
  const spec = getVersionSpec(bytes.length)
  const size = spec.size

  // Step 1: Data encoding (Byte Mode: 0100)
  const bitBuffer: number[] = []
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bitBuffer.push((val >> i) & 1)
    }
  }

  pushBits(0b0100, 4) // Mode: Byte
  pushBits(bytes.length, 8) // Length
  for (let i = 0; i < bytes.length; i++) {
    pushBits(bytes[i], 8)
  }

  // Terminator
  const maxBits = spec.dataCodewords * 8
  const termLen = Math.min(4, maxBits - bitBuffer.length)
  for (let i = 0; i < termLen; i++) bitBuffer.push(0)

  // Pad to byte boundary
  while (bitBuffer.length % 8 !== 0) {
    bitBuffer.push(0)
  }

  // Pad bytes (0xEC, 0x11)
  const padBytes = [0xec, 0x11]
  let padIdx = 0
  while (bitBuffer.length < maxBits) {
    pushBits(padBytes[padIdx % 2], 8)
    padIdx++
  }

  // Convert bit buffer to data byte array
  const dataBytes = new Uint8Array(spec.dataCodewords)
  for (let i = 0; i < spec.dataCodewords; i++) {
    let b = 0
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bitBuffer[i * 8 + j]
    }
    dataBytes[i] = b
  }

  // Step 2: Reed-Solomon Error Correction
  const ecBytes = rsComputeRemainder(dataBytes, spec.ecCodewords)
  const finalCodewords = new Uint8Array(spec.totalCodewords)
  finalCodewords.set(dataBytes)
  finalCodewords.set(ecBytes, spec.dataCodewords)

  // Convert codewords back to bit sequence
  const finalBits: number[] = []
  for (let i = 0; i < finalCodewords.length; i++) {
    for (let j = 7; j >= 0; j--) {
      finalBits.push((finalCodewords[i] >> j) & 1)
    }
  }

  // Step 3: Build Matrix Grid
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  const isReserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  const setModule = (r: number, c: number, val: boolean, reserved = true) => {
    matrix[r][c] = val
    if (reserved) isReserved[r][c] = true
  }

  // Finder Patterns (7x7)
  const drawFinderPattern = (rCenter: number, cCenter: number) => {
    for (let r = -3; r <= 3; r++) {
      for (let c = -3; c <= 3; c++) {
        const row = rCenter + r
        const col = cCenter + c
        if (row >= 0 && row < size && col >= 0 && col < size) {
          const dist = Math.max(Math.abs(r), Math.abs(c))
          setModule(row, col, dist !== 2)
        }
      }
    }
  }

  drawFinderPattern(3, 3)
  drawFinderPattern(3, size - 4)
  drawFinderPattern(size - 4, 3)

  // Separators around finders
  for (let i = 0; i < 8; i++) {
    // Top-left
    if (i < size) {
      if (size > 7) {
        setModule(7, i, false)
        setModule(i, 7, false)
      }
    }
    // Top-right
    if (size - 8 + i >= 0 && size - 8 + i < size) {
      setModule(7, size - 8 + i, false)
      setModule(i, size - 8, false)
    }
    // Bottom-left
    if (size - 8 + i >= 0 && size - 8 + i < size) {
      setModule(size - 8 + i, 7, false)
      setModule(size - 8, i, false)
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isReserved[6][i]) setModule(6, i, i % 2 === 0)
    if (!isReserved[i][6]) setModule(i, 6, i % 2 === 0)
  }

  // Dark module
  setModule(size - 8, 8, true)

  // Alignment Pattern (for Version 2+)
  if (spec.version >= 2) {
    const alignCenter = size - 7
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const row = alignCenter + r
        const col = alignCenter + c
        if (!isReserved[row][col]) {
          const dist = Math.max(Math.abs(r), Math.abs(c))
          setModule(row, col, dist !== 1)
        }
      }
    }
  }

  // Format info area reservation
  for (let i = 0; i < 9; i++) {
    if (!isReserved[8][i]) setModule(8, i, false)
    if (!isReserved[i][8]) setModule(i, 8, false)
    if (i < 8) {
      setModule(8, size - 1 - i, false)
      setModule(size - 1 - i, 8, false)
    }
  }

  // Place data bits in matrix (zigzag pattern)
  let bitIndex = 0
  let dir = -1 // Upwards
  let col = size - 1

  while (col > 0) {
    if (col === 6) col-- // Skip vertical timing column

    for (let rowIdx = 0; rowIdx < size; rowIdx++) {
      const row = dir === -1 ? size - 1 - rowIdx : rowIdx

      for (let cOffset = 0; cOffset < 2; cOffset++) {
        const c = col - cOffset
        if (!isReserved[row][c]) {
          let val = false
          if (bitIndex < finalBits.length) {
            val = finalBits[bitIndex] === 1
            bitIndex++
          }
          // Data Masking (Pattern 0: (row + col) % 2 == 0)
          if ((row + c) % 2 === 0) {
            val = !val
          }
          matrix[row][c] = val
        }
      }
    }
    dir = -dir
    col -= 2
  }

  // Format Info: Mask 0 + EC Level L (01) -> BCH 15,5 Code = 0x77C4 (0b111011111000100)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0]

  // Top-left format placement
  const tlCoords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ]
  for (let i = 0; i < 15; i++) {
    const [r, c] = tlCoords[i]
    matrix[r][c] = formatBits[i] === 1
  }

  // Split format placement around edges
  for (let i = 0; i < 7; i++) {
    matrix[size - 1 - i][8] = formatBits[i] === 1
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][size - 8 + i] = formatBits[7 + i] === 1
  }

  return matrix
}

/**
 * Generates an SVG path string for a QR Code matrix.
 *
 * @param text URL or payload string
 * @returns Object with `size` and SVG `path` data string
 */
export function generateQrCodeSvgPath(text: string): QrCodeSvgResult {
  const matrix = generateQrCodeMatrix(text)
  const size = matrix.length
  let pathStr = ""

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        pathStr += `M${c},${r}h1v1h-1z `
      }
    }
  }

  return {
    size,
    path: pathStr.trim(),
  }
}
