'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface Message {
  role: 'user' | 'model';
  content: string;
}

const QUICK_PROMPTS = [
  'Cara absen masuk & pulang',
  'Cara ajukan izin sakit',
  'Cara kumpul tugas OJT',
  'Panduan penilaian mentor',
];

export function MduChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content:
        'Halo! Saya **Digi.AI** (Digiverse AI). Ada yang bisa saya bantu terkait aplikasi atau panduan magang/mentoring hari ini?',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hanya tampil pada dashboard /ojt, /mentor, dan /admin
  const shouldRender =
    pathname?.startsWith('/ojt') ||
    pathname?.startsWith('/mentor') ||
    pathname?.startsWith('/admin');

  // Auto-scroll saat ada pesan baru atau sedang loading
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isLoading]);

  // Autofocus hanya saat jendela chat baru pertama kali dibuka
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!shouldRender) {
    return null;
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setHasInteracted(true);
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await response.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'model', content: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            content: 'Maaf, belum ada jawaban dari sistem asisten. Silakan ulangi pertanyaanmu.',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: 'Koneksi terputus. Pastikan perangkatmu terhubung ke internet dan coba kembali.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Render teks sederhana dengan bold markdown (warna menyesuaikan bubble)
  const renderFormattedText = (content: string, isUser: boolean) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong
            key={index}
            className={`font-semibold ${isUser ? 'text-white underline decoration-blue-300' : 'text-slate-900'}`}
          >
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="fixed bottom-20 md:bottom-5 right-4 md:right-5 z-50 select-none">
      {/* Floating Action Button (Ketika Chat Tertutup) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white shadow-xl shadow-blue-500/25 transition-all duration-200 hover:scale-105 hover:shadow-blue-500/40 active:scale-95"
          aria-label="Buka Chat Digi.AI"
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
          </span>
          <svg
            className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <span className="hidden text-sm font-semibold sm:inline-block">Tanya Digi.AI</span>
        </button>
      )}

      {/* Jendela Obrolan (Ketika Chat Terbuka) */}
      {isOpen && (
        <div className="flex h-[500px] max-h-[calc(100dvh-6.5rem)] sm:max-h-[580px] w-[calc(100vw-2rem)] sm:w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl transition-all duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-indigo-700/20 bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Digi.AI</h3>
                <p className="flex items-center gap-1.5 text-xs text-blue-100">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  Digiverse AI • Panduan MDU
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              aria-label="Tutup Obrolan"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Area Pesan */}
          <div className="flex-1 space-y-3.5 overflow-y-auto p-4 select-text">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={index}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'rounded-tr-none bg-blue-600 text-white shadow-sm'
                        : 'rounded-tl-none border border-slate-200/80 bg-slate-50 text-slate-800 shadow-xs'
                    }`}
                  >
                    {renderFormattedText(msg.content, isUser)}
                  </div>
                </div>
              );
            })}

            {/* Indikator Mengetik */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none border border-slate-200/80 bg-slate-50 px-4 py-3 text-slate-500 shadow-xs">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.3s]"></span>
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.15s]"></span>
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts (Muncul jika obrolan belum panjang) */}
          {!hasInteracted && (
            <div className="border-t border-slate-100 bg-slate-50/70 p-2.5">
              <p className="mb-1.5 px-1 text-[11px] font-medium text-slate-400">Pertanyaan Cepat:</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="rounded-full border border-blue-200/80 bg-white px-2.5 py-1 text-xs text-blue-700 shadow-xs transition-colors hover:bg-blue-50 active:bg-blue-100"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Tanya Digi.AI seputar aplikasi atau SOP MDU..."
              disabled={isLoading}
              maxLength={4000}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              aria-label="Kirim Pesan"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
