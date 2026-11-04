import { buildMduSystemInstruction } from '../../../lib/knowledge/mdu-guide.ts';

interface ChatMessage {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

const MAX_CHAR_LIMIT = 4000;

export async function POST(request: Request) {
  try {
    let body: { messages?: ChatMessage[] } | null = null;
    try {
      body = (await request.json()) as { messages?: ChatMessage[] };
    } catch {
      return Response.json({ error: 'Format JSON tidak valid' }, { status: 400 });
    }

    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: 'Daftar pesan (messages) harus berupa array yang tidak kosong' },
        { status: 400 }
      );
    }

    const isMalformed = messages.some(
      (m) => !m || typeof m !== 'object' || typeof m.content !== 'string' || !m.content.trim()
    );
    if (isMalformed) {
      return Response.json(
        { error: 'Format pesan dalam riwayat obrolan tidak valid atau berisi pesan kosong' },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.content.length > MAX_CHAR_LIMIT) {
      return Response.json(
        { error: `Pesan terlalu panjang (maksimum ${MAX_CHAR_LIMIT} karakter)` },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({
        reply:
          'Halo! Digi.AI (Digiverse AI) siap membantu. Namun kunci API belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY pada file .env.local untuk mengaktifkan kecerdasan buatan.',
      });
    }

    // Google Gemini API mewajibkan percakapan multi-turn dimulai dari role 'user'
    const rawContents = messages.map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // Buang pesan sambutan bot di awal agar urutan percakapan valid untuk Gemini
    const firstUserIdx = rawContents.findIndex((m) => m.role === 'user');
    let contents = firstUserIdx !== -1 ? rawContents.slice(firstUserIdx) : [];
    contents = contents.slice(-10);

    while (contents.length > 0 && contents[0].role !== 'user') {
      contents.shift();
    }

    if (contents.length === 0) {
      contents = [{ role: 'user', parts: [{ text: lastMessage.content }] }];
    }

    const systemInstruction = buildMduSystemInstruction();
    const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

    const callGemini = async (model: string) => {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
      try {
        return await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
            contents,
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 1000,
            },
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    let geminiRes = await callGemini(primaryModel);

    // Jika model utama mengalami error status (misal 503 high demand), coba fallback ke model flash-lite atau 3.8
    if (!geminiRes.ok) {
      const fallbackCandidates = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'].filter(
        (m) => m !== primaryModel
      );
      for (const candidate of fallbackCandidates) {
        console.warn(`Model gagal (${geminiRes.status}), mencoba fallback ke ${candidate}...`);
        const fallbackRes = await callGemini(candidate);
        if (fallbackRes.ok) {
          geminiRes = fallbackRes;
          break;
        }
      }
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API Error:', geminiRes.status, errText);
      return Response.json({
        reply:
          'Maaf, terjadi kendala saat menghubungi server Digi.AI. Silakan coba sesaat lagi atau pastikan kuota API masih tersedia.',
        error: `Gemini API returned status ${geminiRes.status}`,
      });
    }

    const geminiData = await geminiRes.json();
    const replyText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Maaf, saya tidak dapat merumuskan jawaban saat ini. Silakan ulangi pertanyaanmu.';

    return Response.json({ reply: replyText });
  } catch (error: unknown) {
    console.error('Chat endpoint error:', error);
    const err = error as { name?: string; message?: string };
    const isAbort = err?.name === 'AbortError';
    return Response.json(
      {
        reply: isAbort
          ? 'Permintaan membutuhkan waktu terlalu lama. Silakan coba lagi.'
          : 'Maaf, terjadi kesalahan internal pada sistem asisten.',
        error: err?.message || 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
