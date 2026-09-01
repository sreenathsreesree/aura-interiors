import { Font } from '@react-pdf/renderer'

// .woff, deliberately not .woff2: react-pdf's font engine (fontkit) subsets
// the embedded font to only the glyphs actually used, and its WOFF2 decode
// path throws ("Offset is outside the bounds of the DataView") while
// re-encoding certain glyph tables from these fonts — .woff hits a more
// mature/stable code path in fontkit and embeds cleanly. Confirmed by
// generating a real PDF and inspecting it; don't switch back without
// re-testing an actual export.
import manropeRegular from '@fontsource/manrope/files/manrope-latin-400-normal.woff'
import manropeMedium from '@fontsource/manrope/files/manrope-latin-500-normal.woff'
import manropeSemibold from '@fontsource/manrope/files/manrope-latin-600-normal.woff'
import manropeBold from '@fontsource/manrope/files/manrope-latin-700-normal.woff'
import frauncesMedium from '@fontsource/fraunces/files/fraunces-latin-500-normal.woff'
import frauncesSemibold from '@fontsource/fraunces/files/fraunces-latin-600-normal.woff'
import frauncesSemiboldItalic from '@fontsource/fraunces/files/fraunces-latin-600-italic.woff'

let registered = false

/** Registers Aura's brand typefaces with react-pdf once, so PDF output matches the app/preview instead of falling back to Helvetica. */
export function registerPdfFonts() {
  if (registered) return
  registered = true

  Font.register({
    family: 'Manrope',
    fonts: [
      { src: manropeRegular, fontWeight: 400 },
      { src: manropeMedium, fontWeight: 500 },
      { src: manropeSemibold, fontWeight: 600 },
      { src: manropeBold, fontWeight: 700 },
    ],
  })

  Font.register({
    family: 'Fraunces',
    fonts: [
      { src: frauncesMedium, fontWeight: 500 },
      { src: frauncesSemibold, fontWeight: 600 },
      { src: frauncesSemiboldItalic, fontWeight: 600, fontStyle: 'italic' },
    ],
  })

  // react-pdf hyphenates by default, which fractures item names and terms
  // mid-word ("Wall-\nPaneling") — disable it for clean, predictable wraps.
  Font.registerHyphenationCallback((word) => [word])
}
