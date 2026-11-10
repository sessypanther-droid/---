export function getMessageText(message = {}) {
  const text = message.conversation
    ?? message.extendedTextMessage?.text
    ?? message.imageMessage?.caption
    ?? message.videoMessage?.caption;
  return typeof text === 'string' ? text : '';
}

export function parseCommand(text, prefix = '.') {
  if (typeof text !== 'string' || typeof prefix !== 'string' || prefix.length === 0) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith(prefix)) return null;
  const parts = trimmed.slice(prefix.length).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return { name: parts[0].toLowerCase(), args: parts.slice(1) };
}
