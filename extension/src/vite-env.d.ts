// CSS module type declaration — tells TypeScript to accept CSS imports.
// Vite handles the actual processing at build time.
declare module '*.css' {
  const content: Record<string, string>
  export default content
}

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}
