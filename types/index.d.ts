export type Avisado = boolean

declare module 'claude-code' {
  interface PluginState {
    calado: { avisado: Avisado }
  }
}
