import DOMPurify from 'dompurify'

export function renderMarkdownSimple(text: string): string {
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold mt-2 mb-0.5">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-sm font-bold mt-2 mb-0.5">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-sm font-bold mt-2 mb-0.5">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n/g, '<br />')
  // XSS 対策: 許可タグ・属性のみに絞ったサニタイズ
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'strong', 'em', 'code', 'li', 'br'],
    ALLOWED_ATTR: ['class'],
  })
}
