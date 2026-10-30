export type LogListener = (line: string) => void;

const listeners = new Set<LogListener>();
const buffer: string[] = [];

function stamp(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

export const logger = {
  log(msg: string) {
    const line = `[${stamp()}] ${msg}`;
    buffer.push(line);
    if (buffer.length > 500) buffer.shift();
    listeners.forEach((l) => l(line));
  },
  getBuffer(): string[] {
    return [...buffer];
  },
  subscribe(l: LogListener): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  clear() {
    buffer.length = 0;
    listeners.forEach((l) => l('__CLEARED__'));
  },
};
