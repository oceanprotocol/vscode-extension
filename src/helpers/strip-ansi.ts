/**
 * Returns a RegExp that matches ANSI escape sequences.
 * Based on the strip-ansi package (MIT license, Sindre Sorhus).
 */
function ansiRegex({ onlyFirst = false } = {}): RegExp {
  // Valid string terminator sequences are BEL, ESC\, and 0x9c
  const ST = '(?:\\u0007|\\u001B\\u005C|\\u009C)'

  // OSC sequences only: ESC ] ... ST (non-greedy until the first ST)
  const osc = `(?:\\u001B\\][\\s\\S]*?${ST})`

  // CSI and related: ESC/C1, optional intermediates, optional params (supports ; and :) then final byte
  const csi =
    '[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]'

  const pattern = `${osc}|${csi}`

  return new RegExp(pattern, onlyFirst ? undefined : 'g')
}

const regex = ansiRegex()

/**
 * Strips ANSI escape codes from a string so that raw output from terminals
 * renders cleanly in VSCode's Output panel (which does not interpret ANSI).
 */
export function stripAnsi(string: string): string {
  if (typeof string !== 'string') {
    throw new TypeError(`Expected a \`string\`, got \`${typeof string}\``)
  }

  // Fast path: ANSI codes require ESC (7-bit) or CSI (8-bit) introducer
  if (!string.includes('\u001B') && !string.includes('\u009B')) {
    return string
  }

  return string.replace(regex, '')
}
