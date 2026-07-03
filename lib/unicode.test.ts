import assert from 'node:assert/strict'
import test from 'node:test'
import {
  stripBom,
  stripInvisibleCharacters,
  stripControlCharacters,
  getGraphemeLength,
  normalizeForStorage,
  normalizeForSearch,
  normalizeForCompare,
  normalizeFilename,
  preventCSVInjection,
} from './unicode'

test('stripBom removes UTF-8 BOM if present', () => {
  assert.equal(stripBom('\uFEFFhello'), 'hello')
  assert.equal(stripBom('hello'), 'hello')
  assert.equal(stripBom('\uFEFF'), '')
})

test('stripInvisibleCharacters removes ZWSP, WJ, and BOM but keeps ZWJ', () => {
  const input = 'hello\u200Bworld\uFEFFtest\u2060'
  assert.equal(stripInvisibleCharacters(input), 'helloworldtest')

  // Keep Zero Width Joiner (ZWJ) and Zero Width Non-Joiner (ZWNJ) for emojis/Arabic
  const familyEmoji = '👨\u200D👩\u200D👧\u200D👦'
  assert.equal(stripInvisibleCharacters(familyEmoji), familyEmoji)
})

test('stripControlCharacters removes C0/C1 control characters but preserves white space and newlines', () => {
  const input = 'line1\nline2\r\t\x00bad\x1Ftext'
  assert.equal(stripControlCharacters(input), 'line1\nline2\r\tbadtext')
})

test('getGraphemeLength counts exact visual symbols instead of UTF-16 code units', () => {
  // Family Emoji (contains 4 emojis + 3 ZWJs = 11 UTF-16 code units)
  const family = '👨‍👩‍👧‍👦'
  assert.equal(family.length, 11)
  assert.equal(getGraphemeLength(family), 1)

  // Thai script with diacritics: "เก้าอี้"
  // เ = U+0E40 (vowel)
  // ก = U+0E01 (consonant)
  // า = U+0E32 (vowel)
  // อ = U+0E25 (consonant)
  // ี = U+0E35 (vowel)
  // ้ = U+0E49 (tone mark)
  const thaiText = 'เก้าอี้'
  assert.equal(getGraphemeLength(thaiText), 4) // เ-ก้-า-อี้ (visual graphemes: เ, ก้, า, อี้)
  
  // Latin characters
  assert.equal(getGraphemeLength('hello'), 5)
})

test('normalizeForStorage cleans up strings cleanly', () => {
  assert.equal(normalizeForStorage('  \uFEFFhello \u200Bworld  '), 'hello world')
  // Check NFC normalization
  const nfd = 'cafe\u0301' // cafe + acute accent
  const nfc = 'caf\u00E9' // café
  assert.notEqual(nfd, nfc)
  assert.equal(normalizeForStorage(nfd), nfc)
  assert.equal(normalizeForStorage(''), '')
})

test('normalizeForSearch lowercases and normalizes', () => {
  const nfd = 'Caf\u00E9\u200B'
  assert.equal(normalizeForSearch(nfd), 'café')
  assert.equal(normalizeForSearch(''), '')
})

test('normalizeForCompare normalizes and strips invisible characters for strict comparison', () => {
  const val1 = 'IT\u200BSupport' // Has zero-width space
  assert.equal(normalizeForCompare(val1), 'itsupport')
  assert.equal(normalizeForCompare('  Caf\u00E9  '), 'café')
  assert.equal(normalizeForCompare('cafe\u0301'), 'café')
  assert.equal(normalizeForCompare(''), '')
})

test('normalizeFilename cleans filenames while preserving Unicode', () => {
  assert.equal(normalizeFilename('ภาษาไทย.PNG'), 'ภาษาไทย.png')
  assert.equal(normalizeFilename('😀.jpg'), '😀.jpg')
  assert.equal(normalizeFilename('../../etc/passwd.txt'), '.._.._etc_passwd.txt')
  assert.equal(normalizeFilename('bad:name*.txt'), 'bad_name_.txt')
  assert.equal(normalizeFilename('   '), 'unnamed_file')
  assert.equal(normalizeFilename(''), '')
  assert.equal(normalizeFilename('justname'), 'justname')
})

test('preventCSVInjection prefixes spreadsheet formula characters with a single quote', () => {
  assert.equal(preventCSVInjection('=1+2'), "'=1+2")
  assert.equal(preventCSVInjection('+1+2'), "'+1+2")
  assert.equal(preventCSVInjection('-1+2'), "'-1+2")
  assert.equal(preventCSVInjection('@1+2'), "'@1+2")
  assert.equal(preventCSVInjection('\t1+2'), "'\t1+2")
  assert.equal(preventCSVInjection('\r1+2'), "'\r1+2")
  assert.equal(preventCSVInjection('hello'), 'hello')
  assert.equal(preventCSVInjection('1+2'), '1+2')
  assert.equal(preventCSVInjection(''), '')
})


