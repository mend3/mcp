declare global {
  interface Window {
    mcpHelper: {
      logs: string[]
      originalConsole: typeof console
    }
  }
}

export { }
