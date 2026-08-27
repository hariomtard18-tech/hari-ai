const http = require('http');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

loadEnv();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = __dirname;
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const requestLog = new Map();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (requestLog.get(ip) || []).filter(time => now - time < 60_000);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > 20;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 100_000) req.destroy(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function chat(req, res) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_api_key_here') {
    return json(res, 503, { error: 'GEMINI_API_KEY missing. Add it to your .env file and restart Hari AI.' });
  }
  if (isRateLimited(req.socket.remoteAddress || 'unknown')) return json(res, 429, { error: 'Too many requests. Please wait a minute.' });
  try {
    const payload = JSON.parse(await readBody(req));
    if (!Array.isArray(payload.messages) || payload.messages.length === 0) return json(res, 400, { error: 'A message history is required.' });
    const messages = payload.messages.slice(-20)
      .filter(message => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
      .map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content.slice(0, 8_000) }] }));
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: messages,
      config: {
        systemInstruction: 'You are Hari AI, a warm and clear assistant. Reply naturally in Hindi, Hinglish, or English matching the user. Use Markdown when useful. Be concise but helpful.',
        temperature: 0.7
      }
    });
    return json(res, 200, { message: response.text || 'Mujhe response nahi mila. Please try again.' });
  } catch (error) {
    return json(res, 500, { error: error instanceof SyntaxError ? 'Invalid request format.' : error.message || 'Could not reach Gemini.' });
  }
}

function serveStatic(req, res) {
  const requested = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.resolve(PUBLIC_DIR, `.${requested === '/' ? '/index.html' : requested}`);
  if (!filePath.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'Forbidden' });
  fs.readFile(filePath, (error, file) => {
    if (error) return json(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(file);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && (req.url === '/api/chat' || req.url === '/chat')) return chat(req, res);
  if (req.method === 'GET') return serveStatic(req, res);
  return json(res, 405, { error: 'Method not allowed' });
});
server.listen(PORT, () => console.log(`Hari AI running at http://localhost:${PORT}`));

