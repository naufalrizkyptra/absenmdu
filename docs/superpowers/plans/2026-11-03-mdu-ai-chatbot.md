# MDU AI Chatbot Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight floating AI chatbot assistant powered by Google Gemini API to assist OJT participants and Mentors with MDU application flows and basic product knowledge.

**Architecture:** A client-side floating action button and chat modal (`MduChatWidget`) communicates with a Next.js API route (`/api/chat`). The backend injects a structured MDU knowledge base and system prompt (`lib/knowledge/mdu-guide.ts`) into the conversation and queries the Google Gemini Flash API via server-side HTTP fetch.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Google Gemini Flash API.

**Spec:** `docs/superpowers/specs/2026-11-03-mdu-ai-chatbot-design.md`

## Global Constraints

- Must work in Next.js 16 and React 19 without hydration mismatch or window undefined SSR errors.
- Never expose `GEMINI_API_KEY` to the client-side bundle; all AI calls must be executed on the server.
- The chatbot widget must be non-intrusive, mobile-friendly (PWA compliant), and visible on `/ojt` and `/mentor` paths.
- The chatbot must strictly answer in Indonesian based on MDU context and politely decline off-topic general inquiries.
- Must provide graceful fallback responses if `GEMINI_API_KEY` is not yet configured or network requests fail.

## Review Focus

1. **Missing or Invalid `GEMINI_API_KEY`**: If the environment variable is unset, the API and widget must return a helpful Indonesian configuration message rather than a 500 error or blank UI.
2. **Empty or Whitespace-only User Prompt**: If a user submits empty text or whitespace, the client and server must prevent submission without crashing.
3. **Malformatted or Abnormally Long Messages**: If request body messages are malformatted or exceed max token constraints, the backend must return a 400 Bad Request with a clear message.
4. **Mobile Viewport Overflow (PWA)**: On small mobile screens, the chat window must not exceed the viewport width or get cut off by browser navbars (`max-h-[80vh]`, responsive width).
5. **Route Visibility Guard**: The widget should only render on authenticated dashboard routes (`/ojt/*` and `/mentor/*`), keeping clean public pages like `/login`.

---

### Task 1: Knowledge Base and System Prompt Generator

**Files:**
- Create: `lib/knowledge/mdu-guide.ts`
- Create: `tests/knowledge.test.mjs`

**Interfaces:**
- Produces:
  ```ts
  export interface MduKnowledgeTopic {
    category: string;
    items: { question: string; answer: string }[];
  }
  export const MDU_KNOWLEDGE_BASE: MduKnowledgeTopic[];
  export function buildMduSystemInstruction(): string;
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/knowledge.test.mjs` asserting that `MDU_KNOWLEDGE_BASE` contains OJT and Mentor topics, and `buildMduSystemInstruction()` returns a prompt string containing "Mandiri Digital Universe", "OJT", and "Mentor".

```js
import assert from 'node:assert/strict';
import { MDU_KNOWLEDGE_BASE, buildMduSystemInstruction } from '../lib/knowledge/mdu-guide.ts';

const prompt = buildMduSystemInstruction();
assert.ok(prompt.includes('Mandiri Digital Universe'), 'Must contain company name');
assert.ok(prompt.includes('OJT'), 'Must contain OJT instructions');
assert.ok(prompt.includes('Mentor'), 'Must contain Mentor instructions');
assert.ok(Array.isArray(MDU_KNOWLEDGE_BASE) && MDU_KNOWLEDGE_BASE.length >= 3, 'Must contain at least 3 categories');
console.log('Knowledge base tests passed!');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/knowledge.test.mjs`  
Expected: FAIL with module not found or export errors.

- [ ] **Step 3: Implement `lib/knowledge/mdu-guide.ts`**

Implement `MDU_KNOWLEDGE_BASE` covering:
- OJT SOP (presensi masuk/pulang, toleransi keterlambatan, pengajuan izin sakit/lain, pengumpulan tugas, unduh sertifikat).
- Mentor SOP (pengecekan presensi tim, presensi khusus visit/luar, penilaian & evaluasi mentee).
- Profil PT Mandiri Digital Universe (MDU) & placeholder product knowledge.
Implement `buildMduSystemInstruction()` which formats these topics into a structured system prompt in Indonesian with anti-hallucination guardrails.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/knowledge.test.mjs`  
Expected: PASS with "Knowledge base tests passed!"

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge/mdu-guide.ts tests/knowledge.test.mjs
git commit -m "feat(chat): add MDU knowledge base and system prompt generator"
```

---

### Task 2: Chat API Route Handler

**Files:**
- Create: `app/api/chat/route.ts`
- Create: `tests/chat-api.test.mjs`

**Interfaces:**
- Consumes: `buildMduSystemInstruction` from `lib/knowledge/mdu-guide.ts`
- Produces: Next.js Route Handler `POST(request: Request): Promise<Response>` accepting `{ messages: { role: 'user' | 'model', content: string }[] }` and returning JSON `{ reply: string, error?: string }`.

- [ ] **Step 1: Write the failing test**

Create `tests/chat-api.test.mjs` testing request validation and fallback handling:
- Rejects empty body with 400.
- Rejects empty messages array with 400.
- Handles missing `GEMINI_API_KEY` by returning a friendly 200 response informing the user to set up the API key in `.env.local`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/chat-api.test.mjs`  
Expected: FAIL with route not found.

- [ ] **Step 3: Implement `app/api/chat/route.ts`**

Implement POST handler:
1. Parse and validate JSON request: ensure `messages` is a non-empty array of `{ role, content }`.
2. Check `process.env.GEMINI_API_KEY`:
   - If not set: return JSON with a friendly Indonesian reply: `"Asisten AI MDU siap digunakan. Silakan tambahkan GEMINI_API_KEY pada file .env.local untuk mengaktifkan koneksi AI."`
3. If set: call Google Gemini REST API (`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`) with `system_instruction` from `buildMduSystemInstruction()` and formatted `contents`.
4. Handle timeout and fetch errors gracefully with safe fallback error message.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/chat-api.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/chat/route.ts tests/chat-api.test.mjs
git commit -m "feat(chat): implement chat route handler with Gemini API integration"
```

---

### Task 3: Floating Chat Widget Component (`MduChatWidget`)

**Files:**
- Create: `components/MduChatWidget.tsx`

**Interfaces:**
- Consumes: `/api/chat` endpoint.
- Produces: `export function MduChatWidget(): React.JSX.Element | null`

- [ ] **Step 1: Write component specification & verification**

Verify that `MduChatWidget`:
1. Uses Next.js `usePathname()` to only render when pathname starts with `/ojt` or `/mentor`.
2. Has floating action button at `bottom-5 right-5 z-50` with nice shadow, MDU blue badge, and robot/chat icon.
3. Toggles an expanded chat dialog (`w-[90vw] sm:w-[380px] max-h-[580px] h-[75vh] flex flex-col rounded-2xl shadow-2xl border border-slate-200 bg-white`).
4. Shows header with "Asisten AI MDU", subtitle "Siap bantu OJT & Mentor", and close/minimize button.
5. Has quick suggestion chips at start (e.g. "Cara absen masuk", "Pengajuan izin sakit", "Cara kumpul tugas", "Panduan mentor").
6. Message bubbles with clear differentiation: user (blue, right-aligned) vs assistant (slate-100, left-aligned) with Markdown/line-break rendering.
7. Shows loading spinner or pulsing dots when awaiting API reply.
8. Allows pressing 'Enter' to send, disables send button when input is empty or loading.

- [ ] **Step 2: Implement `components/MduChatWidget.tsx`**

Write `'use client'` component with React hooks (`useState`, `useRef`, `useEffect`, `usePathname`).

- [ ] **Step 3: Run TypeScript compiler & lint check**

Run: `npx tsc --noEmit`  
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/MduChatWidget.tsx
git commit -m "feat(chat): create MduChatWidget component with responsive popup and quick prompts"
```

---

### Task 4: Layout Integration & Verification

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `MduChatWidget` from `@/components/MduChatWidget`

- [ ] **Step 1: Add `MduChatWidget` to `app/layout.tsx`**

Import `MduChatWidget` and place it inside `RootLayout` right alongside `<InstallPWA />`.

- [ ] **Step 2: Run TypeScript and ESLint verification**

Run: `npx tsc --noEmit`  
Run: `npm run lint`  
Expected: 0 errors.

- [ ] **Step 3: Run build check**

Run: `npm run build`  
Expected: Next.js build succeeds with static and dynamic routes compiled.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(chat): mount MduChatWidget into root layout and verify build"
```

