type LogListener = (log: string) => void;

class BleDebugLoggerImpl {
  private listeners: Set<LogListener> = new Set();
  private logs: string[] = [];

  public log(text: string) {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${text}`;
    this.logs.push(formatted);
    if (this.logs.length > 200) {
      this.logs.shift();
    }
    this.listeners.forEach(l => {
      try {
        l(formatted);
      } catch (e) {
        console.error(e);
      }
    });
  }

  public addListener(l: LogListener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  public getLogs() {
    return this.logs;
  }

  public clear() {
    this.logs = [];
    this.listeners.forEach(l => {
      try {
        l('');
      } catch (e) {}
    });
  }
}

export const BleDebugLogger = new BleDebugLoggerImpl();
