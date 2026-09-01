import { Font } from '@react-pdf/renderer'

import manropeRegular from '@fontsource/manrope/files/manrope-latin-400-normal.woff2'
import manropeMedium from '@fontsource/manrope/files/manrope-latin-500-normal.woff2'
import manropeSemibold from '@fontsource/manrope/files/manrope-latin-600-normal.woff2'
import manropeBold from '@fontsource/manrope/files/manrope-latin-700-normal.woff2'
import frauncesMedium from '@fontsource/fraunces/files/fraunces-latin-500-normal.woff2'
import frauncesSemibold from '@fontsource/fraunces/files/fraunces-latin-600-normal.woff2'
import frauncesSemiboldItalic from '@fontsource/fraunces/files/fraunces-latin-600-italic.woff2'

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
