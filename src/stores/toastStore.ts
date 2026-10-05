import { create } from 'zustand'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  action?: { label: string; run: () => void }
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, kind?: ToastKind, action?: Toast['action']) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, kind = 'info', action) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, message, action }] }))
    setTimeout(() => get().dismiss(id), action ? 8000 : 4500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  info: (m: string) => useToastStore.getState().push(m, 'info'),
  success: (m: string) => useToastStore.getState().push(m, 'success'),
  error: (m: string) => useToastStore.getState().push(m, 'error'),
  withAction: (m: string, action: Toast['action']) => useToastStore.getState().push(m, 'info', action),
}
