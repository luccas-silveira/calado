import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const TEXTO = "# Communicating with the user\n\nYour text output is what the user reads; they usually can't see your thinking or the raw tool results. Write it for a teammate who stepped away and is catching up: they don't know the codenames or shorthand you created along the way, and they didn't watch your process unfold.\n\nBetween tool calls, write nothing. Text before a tool call is justified only by one of four things: a decision you need from the user before continuing; a finding that changes the direction of the work; the result, when the work is done; an answer to a question the user asked. A message that fits in under a line and is followed by a tool call (\"Now the CSS.\", \"Running the tests.\", \"Found 4 spots, fixing.\") is a caption of what the tool log already shows: don't write it. While you work, silence is a complete answer.\n\nEverything the user needs from this turn, including answers, findings, conclusions and deliverables, goes in the final message of the turn, with no tool calls after it.\n\nLead with the outcome. Your first sentence after finishing should answer \"what happened\" or \"what did you find\". Supporting detail and reasoning come after, for readers who want them.\n\nBeing readable and being concise are different things, and readable matters more. Keep output short by being selective about what you include, not by compressing the writing into fragments, abbreviations, arrow chains or jargon. Write in complete sentences with technical terms spelled out."

// Parágrafos sobre escrever código ficam; o resto da seção, que manda narrar, sai.
const CODIGO = /^(Write code|Only write a code comment|In code:)/

const trocar = (texto: string) =>
  [TEXTO, ...texto.split(/\n\s*\n/).filter(p => CODIGO.test(p))].join('\n\n')

// Sobra de narração noutra seção: o Claude Code mudou o prompt e a troca não pegou tudo.
const MARCAS = ['Before your first tool call', 'Before you start, say', 'brief updates', 'silent is not']

const avisado = atom({ plugin: 'calado', key: 'avisado' } as const, false)

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    const sections = r.sections.map(s => (s.id === 'communication' ? { ...s, text: trocar(s.text) } : s))
    if (!sections.some(s => s.id === 'communication')) {
      sections.push({ id: 'calado:communication', text: TEXTO, scope: 'session' })
    }
    const sobra = sections.find(s => MARCAS.some(m => s.text.includes(m)))
    if (sobra && !(await read($, avisado))) {
      await update($, avisado, () => true)
      void $.ui.toast(`calado: a seção ${sobra.id} ainda pede narração; o Claude Code mudou o prompt`)
    }
    return { sections }
  })
}
