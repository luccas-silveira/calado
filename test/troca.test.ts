import { test, expect } from 'claude-code/testing'

// Mesma entrada completa do esqueleto: sem ela o motor pula o hook do mod em silêncio.
const ENTRADA = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: [],
  tools: [],
  outputStyle: null,
  traits: [],
}

// Cópia exata do TEXTO do plano (etapa 1).
const TEXTO = `# Communicating with the user

Your text output is what the user reads; they usually can't see your thinking or the raw tool results. Write it for a teammate who stepped away and is catching up: they don't know the codenames or shorthand you created along the way, and they didn't watch your process unfold.

Between tool calls, write nothing. Text before a tool call is justified only by one of four things: a decision you need from the user before continuing; a finding that changes the direction of the work; the result, when the work is done; an answer to a question the user asked. A message that fits in under a line and is followed by a tool call ("Now the CSS.", "Running the tests.", "Found 4 spots, fixing.") is a caption of what the tool log already shows: don't write it. While you work, silence is a complete answer.

Everything the user needs from this turn, including answers, findings, conclusions and deliverables, goes in the final message of the turn, with no tool calls after it.

Lead with the outcome. Your first sentence after finishing should answer "what happened" or "what did you find". Supporting detail and reasoning come after, for readers who want them.

Being readable and being concise are different things, and readable matters more. Keep output short by being selective about what you include, not by compressing the writing into fragments, abbreviations, arrow chains or jargon. Write in complete sentences with technical terms spelled out.`

const comunicacao = (text: string) => ({ id: 'communication', text, scope: 'shared' }) as const

async function trocar($: any, on: any, text: string): Promise<string> {
  on('prompt.compose', () => ({ sections: [comunicacao(text)] }))
  const { sections } = await $.prompt.compose(ENTRADA)
  return sections.find((s: { id: string }) => s.id === 'communication').text
}

const CODIGO_FABLE =
  'Write code that reads like the surrounding code: match its comment density, naming, and idiom.\n' +
  "Only write a code comment to state a constraint the code itself can't show."

const FABLE =
  '# Communicating with the user\n\n' +
  "Your text output is what the user reads... Before your first tool call, say in a sentence what you're about to do; while working, give brief updates when you find something load-bearing or change direction.\n\n" +
  'Lead with the outcome. ...\n\n' +
  CODIGO_FABLE

const CODIGO_HAIKU =
  "In code: default to writing no comments. Don't create planning, decision, or analysis documents unless the user asks for them."

const HAIKU =
  '# Text output (does not apply to tool calls)\n' +
  "Assume users can't see most tool calls or thinking. Before your first tool call, state in one sentence what you're about to do. ... Brief is good — silent is not.\n\n" +
  CODIGO_HAIKU

const TURN_UPDATES =
  "Before you start, say in a line what you're about to do; brief updates while you work help the user follow along. Close with a short recap…"

const CURTO = 'Write code that reads like the surrounding code: match its comment density, naming, and idiom.'

test('variante do Fable: tira a narração, põe o texto do mod e guarda o parágrafo de código depois dele', async ($, on) => {
  const text = await trocar($, on, FABLE)

  expect(text).not.toContain('Before your first tool call')
  expect(text).not.toContain('brief updates')
  expect(text).toContain('Between tool calls, write nothing')
  expect(text).toBe(TEXTO + '\n\n' + CODIGO_FABLE)
})

test('variante do Haiku: tira "silent is not" e guarda o parágrafo "In code:" inteiro', async ($, on) => {
  const text = await trocar($, on, HAIKU)

  expect(text).not.toContain('silent is not')
  expect(text).toBe(TEXTO + '\n\n' + CODIGO_HAIKU)
})

test('variante turn_updates: sem parágrafo de código, sai exatamente o texto do mod', async ($, on) => {
  const text = await trocar($, on, TURN_UPDATES)

  expect(text).not.toContain('Before you start, say')
  expect(text).toBe(TEXTO)
})

test('prompt curto: texto do mod, linha em branco e a linha de código', async ($, on) => {
  expect(await trocar($, on, CURTO)).toBe(TEXTO + '\n\n' + CURTO)
})

test('as outras seções e a posição e o escopo de communication ficam intactos', async ($, on) => {
  const LEAN = { id: 'lean_body', text: 'Corpo enxuto do prompt.', scope: 'shared' } as const
  const MEMORY = { id: 'memory', text: 'Lembre que o usuário prefere respostas curtas.', scope: 'session' } as const
  on('prompt.compose', () => ({ sections: [LEAN, comunicacao(FABLE), MEMORY] }))

  const { sections } = await $.prompt.compose(ENTRADA)

  expect(sections).toEqual([LEAN, { id: 'communication', text: TEXTO + '\n\n' + CODIGO_FABLE, scope: 'shared' }, MEMORY])
})

test('duas composições da mesma lista dão o mesmo texto', async ($, on) => {
  on('prompt.compose', () => ({ sections: [comunicacao(FABLE)] }))

  const a = await $.prompt.compose(ENTRADA)
  const b = await $.prompt.compose(ENTRADA)

  expect(a.sections[0].text).toBe(TEXTO + '\n\n' + CODIGO_FABLE)
  expect(b.sections).toEqual(a.sections)
})

test('parágrafo de código no meio, antes da narração, é mantido', async ($, on) => {
  const text = await trocar(
    $,
    on,
    '# Communicating with the user\n\n' + CURTO + "\n\nBefore your first tool call, say what you're about to do.",
  )

  expect(text).toBe(TEXTO + '\n\n' + CURTO)
})

test('parágrafo que só menciona "code" no meio da frase não é guardado', async ($, on) => {
  const text = await trocar(
    $,
    on,
    '# Communicating with the user\n\n' +
      'When you write code, give brief updates as you go.\n\n' +
      'After you Write code for the user, narrate what changed.\n\n' +
      'Explain the diff. In code: reviews, say what you are about to do.',
  )

  expect(text).toBe(TEXTO)
})
