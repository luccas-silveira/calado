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

type Secao = { id: string; text: string; scope: 'shared' | 'session' }

const LEAN = { id: 'lean_body', text: 'Corpo enxuto do prompt.', scope: 'shared' } as const
const MEMORY = { id: 'memory', text: 'Lembre que o usuário prefere respostas curtas.', scope: 'session' } as const
const CURTO = 'Write code that reads like the surrounding code: match its comment density, naming, and idiom.'
const comunicacao = (text: string) => ({ id: 'communication', text, scope: 'shared' }) as const

// As quatro variantes de communication que trazem marcas antes da troca.
const FABLE =
  '# Communicating with the user\n\n' +
  "Before your first tool call, say in a sentence what you're about to do; while working, give brief updates when you find something load-bearing.\n\n" +
  CURTO
const HAIKU =
  '# Text output (does not apply to tool calls)\n' +
  "Before your first tool call, state in one sentence what you're about to do. Brief is good — silent is not."
const TURN_UPDATES = "Before you start, say in a line what you're about to do; brief updates while you work help the user follow along."

// Cada marca, numa seção com id próprio, para o teste ver que o aviso cita a seção certa.
const MARCAS = [
  { marca: 'Before your first tool call', secao: { id: 'tone', text: "Before your first tool call, say what you're about to do.", scope: 'shared' } },
  { marca: 'Before you start, say', secao: { id: 'style', text: 'Before you start, say in a line what you will do.', scope: 'shared' } },
  { marca: 'brief updates', secao: { id: 'progress', text: 'Give brief updates while you work.', scope: 'session' } },
  { marca: 'silent is not', secao: { id: 'voice', text: 'Brief is good — silent is not.', scope: 'shared' } },
] as const

// O mod dispara o toast sem esperar: dá ao aviso tempo de chegar antes de contar.
const assentar = () => new Promise(r => setTimeout(r, 50))

function sessao($: any, on: any, lista: readonly Secao[]) {
  const avisos: string[] = []
  on('prompt.compose', () => ({ sections: lista }))
  on('ui.toast', (_$: any, e: { text: string }) => {
    avisos.push(e.text)
    return { value: undefined }
  })
  const compor = async (): Promise<Secao[]> => {
    const { sections } = await $.prompt.compose(ENTRADA)
    await assentar()
    return sections
  }
  return { avisos, compor }
}

test('sem communication: a reserva entra no fim, com escopo session e o texto do mod', async ($, on) => {
  const { avisos, compor } = sessao($, on, [LEAN, MEMORY])

  expect(await compor()).toEqual([LEAN, MEMORY, { id: 'calado:communication', text: TEXTO, scope: 'session' }])
  expect(avisos).toEqual([])
})

test('com communication: nenhuma seção nova', async ($, on) => {
  const { compor } = sessao($, on, [LEAN, comunicacao(CURTO), MEMORY])

  const sections = await compor()

  expect(sections.map(s => s.id)).toEqual(['lean_body', 'communication', 'memory'])
})

for (const { marca, secao } of MARCAS) {
  test(`marca "${marca}" noutra seção: um aviso com o nome do mod e o id ${secao.id}`, async ($, on) => {
    const { avisos, compor } = sessao($, on, [LEAN, comunicacao(FABLE), secao, MEMORY])

    await compor()

    expect(avisos.length).toBe(1)
    expect(avisos[0]).toContain('calado')
    expect(avisos[0]).toContain(secao.id)
  })
}

test('marca noutra seção numa lista sem communication: avisa e reserva', async ($, on) => {
  const { avisos, compor } = sessao($, on, [LEAN, MARCAS[0].secao])

  const sections = await compor()

  expect(sections.at(-1)).toEqual({ id: 'calado:communication', text: TEXTO, scope: 'session' })
  expect(avisos.length).toBe(1)
  expect(avisos[0]).toContain('tone')
})

test('segunda composição na mesma sessão, com a marca ainda lá: nenhum aviso novo', async ($, on) => {
  const { avisos, compor } = sessao($, on, [LEAN, comunicacao(FABLE), MARCAS[2].secao])

  await compor()
  await compor()
  await compor()

  expect(avisos.length).toBe(1)
})

test('lista sem marca nenhuma: nenhum aviso', async ($, on) => {
  const { avisos, compor } = sessao($, on, [LEAN, comunicacao(CURTO), MEMORY])

  await compor()

  expect(avisos).toEqual([])
})

for (const [nome, variante] of [['Fable', FABLE], ['Haiku', HAIKU], ['turn_updates', TURN_UPDATES]] as const) {
  test(`communication ${nome}, com marcas antes da troca, não dispara: a busca roda depois da troca`, async ($, on) => {
    const { avisos, compor } = sessao($, on, [LEAN, comunicacao(variante), MEMORY])

    const sections = await compor()

    expect(sections[1].text.startsWith(TEXTO)).toBe(true)
    expect(avisos).toEqual([])
  })
}
