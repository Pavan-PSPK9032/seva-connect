import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastType, { ring: string; icon: ReactNode; iconClasses: string }> = {
  success: {
    ring: 'border-primary-500/30',
    icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-500" />,
    iconClasses: 'text-primary-500',
  },
  error: {
    ring: 'border-red-500/30',
    icon: <XCircle className="h-5 w-5 shrink-0 text-red-500" />,
    iconClasses: 'text-red-500',
  },
  info: {
    ring: 'border-sky-500/30',
    icon: <Info className="h-5 w-5 shrink-0 text-sky-500" />,
    iconClasses: 'text-sky-500',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = ++counter.current;
    setItems((prev) => [...prev.slice(-3), { id, type, title, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-3">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 24, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.97 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-card dark:bg-navy-800 ${STYLES[item.type].ring}`}
            >
              {STYLES[item.type].icon}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-800 dark:text-white">{item.title}</p>
                {item.message && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{item.message}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}