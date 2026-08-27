const form = document.querySelector('#form');
const input = document.querySelector('#input');
const messages = document.querySelector('#messages');
const welcome = document.querySelector('#welcome');
const chat = document.querySelector('#chat');
const conversation = [];

function escapeHtml(value) { return value.replace(/[&<>\"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#039;' })[character]); }
function markdown(value) {
  let html = escapeHtml(value);
  const blocks = [];
  html = html.replace(/```(?:[a-zA-Z]+)?\n?([\s\S]*?)```/g, (_, code) => { blocks.push(`<pre><code>${code.trim()}</code></pre>`); return `@@CODE${blocks.length - 1}@@`; });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/^### (.*)$/gm, '<strong>$1</strong>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  return html.replace(/@@CODE(\d+)@@/g, (_, index) => blocks[index]);
}
function scrollDown() { chat.scrollTop = chat.scrollHeight; }
function addMessage(text, role) {
  const row = document.createElement('div'); row.className = `message ${role}`;
  if (role === 'user') row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  else row.innerHTML = `<div class="tiny-logo">H</div><div class="bubble-wrap"><div class="message-label">HARI AI</div><div class="bubble">${markdown(text)}</div><button class="copy-btn" type="button">Copy response</button></div>`;
  if (role === 'assistant') row.querySelector('.copy-btn').addEventListener('click', event => { navigator.clipboard?.writeText(text); event.target.textContent = 'Copied'; setTimeout(() => event.target.textContent = 'Copy response', 1200); });
  messages.appendChild(row); scrollDown();
}
function showTyping() { const row = document.createElement('div'); row.className = 'message assistant'; row.id = 'typing'; row.innerHTML = '<div class="tiny-logo">H</div><div><div class="message-label">HARI AI</div><div class="bubble typing"><i></i><i></i><i></i></div></div>'; messages.appendChild(row); scrollDown(); }
async function sendMessage(text) {
  const clean = text.trim(); if (!clean) return;
  welcome.hidden = true; conversation.push({ role: 'user', content: clean }); addMessage(clean, 'user'); input.value = ''; input.style.height = 'auto'; showTyping();
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: conversation }) });
    const data = await response.json(); document.querySelector('#typing')?.remove();
    if (!response.ok) throw new Error(data.error || 'Something went wrong.');
    conversation.push({ role: 'assistant', content: data.message }); addMessage(data.message, 'assistant');
  } catch (error) { document.querySelector('#typing')?.remove(); addMessage(`Sorry, ${error.message}`, 'assistant'); }
}
form.addEventListener('submit', event => { event.preventDefault(); sendMessage(input.value); });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 130)}px`; });
input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => sendMessage(button.dataset.prompt)));
function clearChat() { conversation.length = 0; messages.replaceChildren(); welcome.hidden = false; input.focus(); }
document.querySelector('#clearChat').addEventListener('click', clearChat); document.querySelector('#newChat').addEventListener('click', () => { clearChat(); document.querySelector('#sidebar').classList.remove('open'); }); document.querySelector('#menu').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
