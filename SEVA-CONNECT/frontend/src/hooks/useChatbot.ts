import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { ApiResponse, ChatMessage, ChatReply, ChatStatus } from '../types';

const STORAGE_KEY = 'sc_chat';
const MAX_MESSAGES = 40;
const MAX_HISTORY = 10;
/** Generous enough for a grounded model turn; the shared client defaults to 15s. */
const REQUEST_TIMEOUT = 60000;

const FALLBACK_SUGGESTIONS = [
  'What volunteering events are open?',
  'Which NGOs are on this platform?',
  'How can I find events in my city?',
  'How do I get started as a volunteer?',
];

let sequence = 0;
const nextId = () => `m${Date.now().toString(36)}-${++sequence}`;

function readStored(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is ChatMessage =>
          !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string'
      )
      .slice(-MAX_MESSAGES)
      // Ids are React keys, so any entry stored without one is re-keyed here.
      .map((m, i) => ({ ...m, id: typeof m.id === 'string' && m.id ? m.id : `restored-${i}` }));
  } catch {
    return [];
  }
}

function writeStored(messages: ChatMessage[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  } catch {
    // Private-mode storage failures must never break the chat.
  }
}

export interface UseChatbotResult {
  messages: ChatMessage[];
  suggestions: string[];
  status: ChatStatus | null;
  pending: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  reset: () => void;
}

export function useChatbot(): UseChatbotResult {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(readStored);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const append = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, message].slice(-MAX_MESSAGES);
      writeStored(next);
      return next;
    });
  }, []);

  // Starter prompts and model status are personal, so they are refetched
  // whenever the visitor signs in or out.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get<ApiResponse<{ suggestions: string[] }>>('/chatbot/suggestions');
        if (active && res.data.data?.suggestions?.length) setSuggestions(res.data.data.suggestions);
      } catch {
        if (active) setSuggestions(FALLBACK_SUGGESTIONS);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?._id]);

  useEffect(() => {
    let active = true;
    api
      .get<ApiResponse<ChatStatus>>('/chatbot/status')
      .then((res) => {
        if (active) setStatus(res.data.data ?? null);
      })
      .catch(() => {
        if (active) setStatus(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || inFlight.current) return;

      inFlight.current = true;
      setError(null);
      setPending(true);
      append({ id: nextId(), role: 'user', text: trimmed });

      // Snapshot the turns sent before this message so the model has context.
      const history = messages
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, text: m.text }));

      try {
        const res = await api.post<ApiResponse<ChatReply>>(
          '/chatbot/message',
          { message: trimmed, history },
          { timeout: REQUEST_TIMEOUT }
        );
        const reply = res.data.data;
        if (reply?.reply) {
          append({ id: nextId(), role: 'assistant', text: reply.reply });
        } else {
          setError('The assistant sent an empty reply. Please try rephrasing your question.');
        }
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not reach the assistant. Please try again.'));
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [append, messages]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    writeStored([]);
  }, []);

  return {
    messages,
    suggestions: suggestions.length ? suggestions : FALLBACK_SUGGESTIONS,
    status,
    pending,
    error,
    send,
    reset,
  };
}
