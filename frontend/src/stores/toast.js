import { writable } from 'svelte/store';

function createToastStore() {
  const { subscribe, update } = writable([]);
  let nextId = 0;

  return {
    subscribe,
    show: (message, type = 'info', duration = 3000) => {
      const id = nextId++;
      const toast = { id, message, type, duration };
      
      update(toasts => [...toasts, toast]);
      
      if (duration > 0) {
        setTimeout(() => {
          update(toasts => toasts.filter(t => t.id !== id));
        }, duration);
      }
      
      return id;
    },
    dismiss: (id) => {
      update(toasts => toasts.filter(t => t.id !== id));
    },
    clear: () => {
      update(() => []);
    }
  };
}

export const toast = createToastStore();
