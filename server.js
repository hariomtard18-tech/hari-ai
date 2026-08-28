const http = require('http');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

console.log('HARI AI MODEL:', GEMINI_MODEL);
console.log('OPENROUTER MODEL:', OPENROUTER_MODEL);

function loadEnv() {
  const envPath = path.join(__dirname, '.env');

  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);

    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });

  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;

      if (body.length > 100000) {
        req.destroy();
      }
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const SYSTEM_PROMPT =
  'You are Hari AI, created by Hari Om Tard. If someone asks who created you, who made you, who developed you, or who owns you, answer: "Mera naam Hari AI hai aur mujhe Hari Om Tard ne banaya hai. 😊" Reply naturally in Hindi, Hinglish, or English matching the user language. Be concise and helpful.';

async function askGemini(messages) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY missing');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: messages,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7
    }
  });

  return response.text || '';
}

async function askOpenRouter(messages) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY missing');
  }

  const openRouterMessages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    }
  ];

  for (const message of messages) {
    let text = '';

    if (Array.isArray(message.parts)) {
      for (const part of message.parts) {
        text += part.text || '';
      }
    }

    openRouterMessages.push({
      role: message.role === 'model' ? 'assistant' : 'user',
      content: text
    });
  }

  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
        'HTTP-Referer': 'https://hari-ai-jgia.onrender.com',
        'X-Title': 'Hari AI'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: openRouterMessages,
        temperature: 0.7
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data &&
      data.error &&
      data.error.message
        ? data.error.message
        : 'OpenRouter error ' + response.status
    );
  }

  return (
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
  ) || '';
}

async function chat(req, res) {
  try {
    const body = await readBody(req);
    const payload = JSON.parse(body);

    if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
      return sendJSON(res, 400, {
        error: 'A message history is required.'
      });
    }

    const messages = payload.messages
      .slice(-20)
      .filter(message =>
        ['user', 'assistant'].includes(message.role) &&
        typeof message.content === 'string'
      )
      .map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [
          {
            text: message.content.slice(0, 8000)
          }
        ]
      }));

    try {
      console.log('Trying Gemini...');

      const answer = await askGemini(messages);

      console.log('Gemini response OK');

      return sendJSON(res, 200, {
        message: answer || 'Mujhe response nahi mila.',
        provider: 'gemini'
      });

    } catch (geminiError) {
      console.log('Gemini failed:', geminiError.message);
      console.log('Switching to OpenRouter...');
    }

    try {
      const answer = await askOpenRouter(messages);

      console.log('OpenRouter response OK');

      return sendJSON(res, 200, {
        message: answer || 'Mujhe response nahi mila.',
        provider: 'openrouter'
      });

    } catch (openRouterError) {
      console.log('OpenRouter failed:', openRouterError.message);

      return sendJSON(res, 503, {
        error: 'Gemini aur OpenRouter dono available nahi hain.',
        details: openRouterError.message
      });
    }

  } catch (error) {
    console.log('Chat error:', error.message);

    return sendJSON(res, 500, {
      error: error.message || 'Server error'
    });
  }
}

function serveStatic(req, res) {
  const requested = decodeURIComponent(req.url.split('?')[0]);

  const filePath = path.resolve(
    PUBLIC_DIR,
    requested === '/' ? 'index.html' : '.' + requested
  );

  if (
    filePath !== PUBLIC_DIR &&
    !filePath.startsWith(PUBLIC_DIR + path.sep)
  ) {
    return sendJSON(res, 403, {
      error: 'Forbidden'
    });
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      return sendJSON(res, 404, {
        error: 'Not found'
      });
    }

    const ext = path.extname(filePath);

    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml'
    };

    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream'
    });

    res.end(file);
  });
}

const server = http.createServer((req, res) => {
  if (
    req.method === 'POST' &&
    (req.url === '/api/chat' || req.url === '/chat')
  ) {
    return chat(req, res);
  }

  if (req.method === 'GET') {
    return serveStatic(req, res);
  }

  return sendJSON(res, 405, {
    error: 'Method not allowed'
  });
});

server.listen(PORT, () => {
  console.log('Hari AI running at http://localhost:' + PORT);
});
