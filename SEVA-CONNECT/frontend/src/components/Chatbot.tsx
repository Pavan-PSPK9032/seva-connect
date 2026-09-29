import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, HeartHandshake, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useChatbot, type UseChatbotResult } from '../hooks/useChatbot';
import { useAuth } from '../context/AuthContext';

/**
 * Seva AI chat surface.
 *  - ChatSurface   — header + transcript + composer, owns one useChatbot()
 *  - ChatbotWidget — collapsible launcher that hosts ChatSurface (app-wide)
 *
 * The dedicated /chatbot page renders the same ChatSurface, so the two views
 * stay identical by construction.
 */

const GREETING =
  "Hi! I'm Seva AI. Ask me about volunteering events, the NGOs on the platform, or which opportunities match your skills.";

/** Splits assistant copy into paragraphs and bulleted lists. */
function renderReply(text: string) {
  const blocks: { type: 'text' | 'list'; lines: string[] }[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const isBullet = /^[-*]\s+/.test(line);
    const content = isBullet ? line.replace(/^[-*]\s+/, '') : line;
    const type = isBullet ? 'list' : 'text';

    if (!content) continue;

    const last = blocks[blocks.length - 1];
    if (last && last.type === type) last.lines.push(content);
    else blocks.push({ type, lines: [content] });
  }

  return blocks.map((block, i) =>
    block.type === 'list' ? (
      <ul key={i} className="my-1.5 list-disc space-y-1 pl-4">
        {block.lines.map((item, j) => (
          <li key={j}>{item}</li>
        ))}
      </ul>
    ) : (
      <p key={i} className="my-1.5 first:mt-0 last:mb-0">
        {block.lines.join(' ')}
      </p>
    )
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-primary-500"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

function Avatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white">
      <Bot className="h-4 w-4" />
    </div>
  );
}

function Header({
  status,
  onReset,
  onClose,
}: {
  status: boolean | null;
  onReset: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-navy-700/10 bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 text-white dark:border-white/10">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
        <HeartHandshake className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold leading-tight">Seva AI</p>
        <p className="truncate text-xs text-white/75">
          {status === false ? 'Built-in assistant · live listings' : 'Ask about events, NGOs & volunteering'}
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        aria-label="Clear conversation"
        className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Panel({ chat }: { chat: UseChatbotResult }) {
  const { messages, suggestions, pending, error, send } = chat;
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Layout effect so the scroll happens in the same frame the bubble renders.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  useEffect(() => {
    if (!pending) inputRef.current?.focus();
  }, [pending]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || pending) return;
    void send(draft);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (draft.trim() && !pending) {
        void send(draft);
        setDraft('');
      }
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Transcript */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-navy-900"
      >
        {messages.length === 0 && (
          <div className="flex gap-2.5">
            <Avatar />
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm text-navy-700 shadow-soft dark:bg-navy-800 dark:text-slate-200">
              {GREETING}
              {!user && (
                <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                  Log in and I'll tailor answers to your skills and interests.
                </span>
              )}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <Avatar />
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm text-navy-700 shadow-soft dark:bg-navy-800 dark:text-slate-200">
                {renderReply(m.text)}
              </div>
            </div>
          )
        )}

        {pending && (
          <div className="flex gap-2.5">
            <Avatar />
            <div className="rounded-2xl rounded-tl-sm bg-white px-4 shadow-soft dark:bg-navy-800">
              <TypingDots />
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-50 px-3.5 py-2.5 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
      </div>

      {/* Starter prompts */}
      {messages.length === 0 && (
        <div className="flex shrink-0 flex-wrap gap-2 border-t border-navy-700/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-navy-800">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="chip border border-primary-500/30 bg-primary-50 text-primary-700 transition hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-300 dark:hover:bg-primary-500/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={submit}
        className="flex shrink-0 items-end gap-2 border-t border-navy-700/10 bg-white px-3 py-3 dark:border-white/10 dark:bg-navy-800"
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={1000}
          placeholder={user ? `Ask Seva AI, ${user.name.split(' ')[0]}…` : 'Ask about events or NGOs…'}
          className="max-h-28 flex-1 resize-none rounded-xl border border-navy-700/15 bg-white px-3.5 py-2.5 text-sm text-navy-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-white/15 dark:bg-navy-900 dark:text-slate-100"
        />
        <button type="submit" disabled={!draft.trim() || pending} aria-label="Send message" className="btn-primary h-10 w-10 !px-0">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export function ChatSurface({ onClose, showStatus = false }: { onClose?: () => void; showStatus?: boolean }) {
  const chat = useChatbot();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header status={chat.status?.aiEnabled ?? null} onReset={chat.reset} onClose={onClose} />
      <Panel chat={chat} />
      {showStatus && chat.status && (
        <p className="shrink-0 border-t border-navy-700/10 bg-white px-4 py-2 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-navy-800 dark:text-slate-400">
          Powered by Google Gemini ({chat.status.model})
          {chat.status.aiEnabled ? '' : ' · no API key set, using the built-in assistant'}
        </p>
      )}
    </div>
  );
}

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const chat = useChatbot();

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-24 right-4 z-50 flex h-[30rem] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-navy-700/10 bg-white shadow-card sm:right-6 dark:border-white/10 dark:bg-navy-800"
          >
            <ChatSurface onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Seva AI assistant' : 'Open Seva AI assistant'}
        aria-expanded={open}
        className="fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-card transition-all hover:scale-105 sm:right-6"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span
              key="bot"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative"
            >
              <Bot className="h-6 w-6" />
              {chat.messages.length === 0 && (
                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-accent-500" />
                </span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </>
  );
}
