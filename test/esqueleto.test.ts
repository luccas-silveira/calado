import { test, expect } from 'claude-code/testing'

const INTRO = { id: 'intro', text: 'Você é o Claude Code.', scope: 'shared' } as const
const MEMORY = { id: 'memory', text: 'Lembre que o usuário prefere respostas curtas.', scope: 'session' } as const

// O executor não preenche o que falta da sessão: com entrada parcial, o next(e) do mod é recusado
// e o hook do mod é pulado em silêncio, o que faria o teste passar sem o mod rodar.
const ENTRADA = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: [],
  tools: [],
  outputStyle: null,
  traits: [],
}

test('a montagem do prompt devolve as seções do motor intactas e na ordem', async ($, on) => {
  on('prompt.compose', () => ({ sections: [INTRO, MEMORY] }))

  const { sections } = await $.prompt.compose(ENTRADA)

  // A reserva da etapa 2 entra depois, quando falta `communication`.
  expect(sections.slice(0, 2)).toEqual([INTRO, MEMORY])
})
