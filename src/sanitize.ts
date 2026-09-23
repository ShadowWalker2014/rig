// Box output is untrusted text headed for your terminal. Escape sequences can write
// your clipboard (OSC 52), retitle windows or drive terminal features, so everything
// except colour codes is dropped. State carries across chunks, so a sequence split
// between two writes is caught too.
type State = 'text' | 'esc' | 'csi' | 'string' | 'stringEsc'

const STRING_STARTS = new Set([']', 'P', '^', '_', 'X'])
const C1_STRING_STARTS = new Set([0x90, 0x98, 0x9d, 0x9e, 0x9f])

const printable = (ch: string, code: number) =>
  ch === '\n' || ch === '\r' || ch === '\t' || (code >= 0x20 && code !== 0x7f && (code < 0x80 || code > 0x9f))

export function sanitizer(): (chunk: string) => string {
  let state: State = 'text'
  let csi = ''
  return (chunk) => {
    let out = ''
    for (const ch of chunk) {
      const code = ch.codePointAt(0)!
      if (state === 'text') {
        if (ch === '\x1b') state = 'esc'
        else if (C1_STRING_STARTS.has(code)) state = 'string'
        else if (code === 0x9b) [state, csi] = ['csi', '']
        else if (printable(ch, code)) out += ch
      } else if (state === 'esc') {
        if (ch === '[') [state, csi] = ['csi', '']
        else state = STRING_STARTS.has(ch) ? 'string' : 'text'
      } else if (state === 'csi') {
        if (code >= 0x20 && code <= 0x3f && csi.length < 64) csi += ch
        else {
          if (ch === 'm' && /^[0-9;:]*$/.test(csi)) out += `\x1b[${csi}m`
          state = 'text'
        }
      } else if (state === 'string') {
        if (ch === '\x07') state = 'text'
        else if (ch === '\x1b') state = 'stringEsc'
      } else {
        state = ch === '\\' ? 'text' : 'string'
      }
    }
    return out
  }
}

// For one-off strings: log tails, error messages, repo settings echoed back.
export const clean = (text: string) => sanitizer()(text)
