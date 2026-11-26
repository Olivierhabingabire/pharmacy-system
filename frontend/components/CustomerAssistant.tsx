"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, LoaderCircle, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { API_URL, authFetch } from "@/lib/api";
import { useLanguage } from "@/lib/language";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const suggestedQuestions = [
  "What is Pharmacy Desk?",
  "How do pickup requests work?",
  "How can I track an order?",
  "How do I update my profile?",
];

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    detail?: string;
  };
  return body.detail ?? `The server answered ${response.status}.`;
}

export default function CustomerAssistant() {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const endOfMessages = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      endOfMessages.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, messages, sending, problem]);

  async function sendMessage(value: string) {
    const message = value.trim();
    if (!message || sending) return;

    setMessages((current) => [...current, { role: "user", content: message }]);
    setInput("");
    setProblem(null);
    setSending(true);

    try {
      const response = await authFetch(`${API_URL}/customer/assistant/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, language }),
      });
      if (!response.ok) throw new Error(await responseError(response));

      const result = (await response.json()) as { reply: string };
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.reply },
      ]);
    } catch (error) {
      setProblem(
        error instanceof Error
          ? t(error.message)
          : t("The assistant is temporarily unavailable. Please contact Pharmacy Desk support."),
      );
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="customer-assistant-title"
          className="fixed bottom-20 right-4 z-50 flex h-[min(36rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-rule bg-white shadow-[0_20px_60px_-20px_rgba(23,33,58,0.35)] sm:bottom-24 sm:right-6 print:hidden"
        >
          <header className="flex items-center justify-between border-b border-rule bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fde2f0] text-[#c90062]">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2
                  id="customer-assistant-title"
                  className="truncate text-sm font-bold text-pine"
                >
                  {t("Pharmacy Desk assistant")}
                </h2>
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Sparkles className="h-3 w-3 text-[#c90062]" aria-hidden="true" />
                  {t("AI support, not a pharmacist")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("Close assistant")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-[#fff1f7] hover:text-[#c90062]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div
            className="flex-1 space-y-4 overflow-y-auto bg-[#fffafd] px-4 py-4"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <div>
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-rule bg-white px-3.5 py-3 text-sm leading-6 text-pine shadow-sm">
                  <p className="font-semibold">
                    {t("How can I help with Pharmacy Desk?")}
                  </p>
                  <p className="mt-1 text-muted">
                    {t("Ask about your account, orders, or pickup requests.")}
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => void sendMessage(t(question))}
                      disabled={sending}
                      className="block max-w-full rounded-xl border border-[#f1c7dc] bg-white px-3 py-2 text-left text-xs font-semibold text-[#bd005d] transition hover:bg-[#fff1f7] disabled:opacity-50"
                    >
                      {t(question)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <p
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                    message.role === "user"
                      ? "rounded-br-sm bg-[#e90074] text-white"
                      : "rounded-bl-sm border border-rule bg-white text-pine shadow-sm"
                  }`}
                >
                  {message.content}
                </p>
              </div>
            ))}

            {sending && (
              <div
                role="status"
                className="flex items-center gap-2 text-xs font-medium text-muted"
              >
                <LoaderCircle
                  className="h-4 w-4 animate-spin text-[#c90062]"
                  aria-hidden="true"
                />
                {t("Thinking…")}
              </div>
            )}
            {problem && (
              <p
                role="alert"
                className="rounded-xl border border-red/20 bg-red-bg px-3 py-2 text-xs leading-5 text-red"
              >
                {problem}
              </p>
            )}
            <div ref={endOfMessages} />
          </div>

          <div className="border-t border-rule bg-white px-4 py-3">
            <p className="mb-2 text-[10px] leading-4 text-muted">
              {t("For privacy, Gemini receives only the help topic, selected language, and public help information—not your message or chat history. Don’t include personal, order, or health details.")}
            </p>
            <form onSubmit={submit} className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={500}
                placeholder={t("Type a question…")}
                aria-label={t("Type a question…")}
                className="min-w-0 flex-1 rounded-xl border border-rule bg-white px-3 py-2.5 text-sm text-pine outline-none transition placeholder:text-slate-400 focus:border-cross focus:ring-2 focus:ring-cross/15"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                aria-label={t("Send message")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e90074] text-white transition hover:bg-[#c90062] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-label={t(open ? "Close assistant" : "Open customer assistant")}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-50 inline-flex h-14 items-center gap-2 rounded-full bg-[#e90074] px-5 text-sm font-bold text-white shadow-lg shadow-pink-300/50 transition hover:-translate-y-0.5 hover:bg-[#c90062] focus-visible:outline-offset-4 sm:bottom-6 sm:right-6 print:hidden"
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        )}
        <span>{t("Help")}</span>
      </button>
    </>
  );
}
