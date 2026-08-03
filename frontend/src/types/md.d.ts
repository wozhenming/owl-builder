/** Vite 的 `?raw` 导入声明（用于内嵌 Markdown 文档） */
declare module '*.md?raw' {
  const content: string
  export default content
}
