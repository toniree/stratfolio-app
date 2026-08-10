/**
 * Text helpers shared by the tile charts, so the company wordmark behind a
 * position chart and the one behind a thesis chart are laid out identically.
 */

/**
 * Balances a company name across two lines, breaking on the word boundary
 * closest to the middle so neither line dominates.
 */
export function splitTwoLines(text: string): string[] {
  const words = text.trim().split(/\s+/)
  if (words.length < 2) return [text]

  let bestIndex = 1
  let bestGap = Number.POSITIVE_INFINITY
  for (let i = 1; i < words.length; i++) {
    const head = words.slice(0, i).join(' ').length
    const tail = words.slice(i).join(' ').length
    const gap = Math.abs(head - tail)
    if (gap < bestGap) {
      bestGap = gap
      bestIndex = i
    }
  }
  return [words.slice(0, bestIndex).join(' '), words.slice(bestIndex).join(' ')]
}

/**
 * Sized so the longest line still clears the plot's side margins. The 0.56
 * factor approximates the average glyph width of the bold face.
 */
export function watermarkFontSize(lines: string[], available: number): number {
  const longest = Math.max(...lines.map((line) => line.length), 1)
  return Math.max(9, Math.min(34, available / (longest * 0.56)))
}
