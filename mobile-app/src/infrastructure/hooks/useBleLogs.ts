import { useState, useEffect } from 'react';
import { BleDebugLogger } from '../ble/real/BleDebugLogger';

export function useBleLogs() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    setLogs(BleDebugLogger.getLogs());
    const unsubscribe = BleDebugLogger.addListener(() => {
      setLogs([...BleDebugLogger.getLogs()]);
    });
    return unsubscribe;
  }, []);

  return logs;
}
