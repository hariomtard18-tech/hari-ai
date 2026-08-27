# Hari AI

A complete, secure, futuristic AI chatbot with Hindi, Hinglish, and English support.

## Requirements

Install Node.js 18 or newer from https://nodejs.org. No npm package installation is required because the server uses Node's built-in `http` and `fetch` APIs.

## Setup

1. Open this folder in VS Code.
2. Copy `.env.example` and rename the copy to `.env`.
3. Open `.env` and set `GEMINI_API_KEY` to your Google AI Studio key. You can also change `GEMINI_MODEL` or `PORT`.
4. Open the VS Code terminal in this folder.
5. Run:

```bash
npm start
```

6. Open http://localhost:3000 in your browser.

For development with automatic server reload, use `npm run dev`.

## Project map

- `server.js`: Secure Gemini backend using the official `@google/genai` SDK, environment loading, rate limiting, static file server, and AI provider proxy.
- `public/index.html`: Chat structure, welcome screen, controls, and accessible labels.
- `public/style.css`: Responsive dark futuristic design, glow effects, bubbles, animations, and mobile layout.
- `public/app.js`: Conversation state, API calls, Enter-to-send, typing indicator, Markdown-style rendering, code blocks, copy response, and clear chat.
- `.env.example`: Safe configuration template. The real `.env` file is ignored by Git.
- `package.json`: Start and development commands.

The Gemini API key is read only by `server.js`; it is never placed in frontend JavaScript or sent to the browser. The backend supports both `POST /chat` and the existing frontend route `POST /api/chat`, returning `{ "message": "..." }`.
