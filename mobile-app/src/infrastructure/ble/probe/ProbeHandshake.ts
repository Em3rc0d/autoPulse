import { Device, Subscription } from 'react-native-ble-plx';
import { CandidateCombination } from './CharacteristicCandidateSelector';
import { Buffer } from 'buffer';

export interface HandshakeResult {
  writeAccepted: boolean;
  responseReceived: boolean;
  rawByteCount: number;
  fragmentCount: number;
  lineCount: number;
  sanitizedResponse: string | null;
  echoDetected: boolean;
  promptDetected: boolean;
  latencyMs: number;
  timedOut: boolean;
  disconnectObserved: boolean;
}

export class ProbeHandshake {
  static async execute(
    device: Device,
    combination: CandidateCombination,
    command: string, // e.g. "ATI\r"
    timeoutMs: number,
    cancellationSignal: { cancelled: boolean }
  ): Promise<HandshakeResult> {

    let subscription: Subscription | null = null;
    let accumulated = '';
    let fragmentCount = 0;
    let isFinished = false;
    let disconnectObserved = false;
    const startTime = Date.now();
    let writeAccepted = false;
    let timeoutHandle: NodeJS.Timeout;

    return new Promise<HandshakeResult>(async (resolve) => {
      const finish = (timedOut: boolean) => {
        if (isFinished) return;
        isFinished = true;
        clearTimeout(timeoutHandle);
        if (subscription) {
          subscription.remove();
        }

        const latency = Date.now() - startTime;
        const { sanitized, echo, prompt } = this.sanitizeResponse(accumulated, command);
        const lineCount = accumulated
          .split(/[\r\n]+/)
          .map(line => line.replace(/>/g, '').trim())
          .filter(Boolean)
          .length;

        resolve({
          writeAccepted,
          responseReceived: accumulated.length > 0,
          rawByteCount: accumulated.length,
          fragmentCount,
          lineCount,
          sanitizedResponse: sanitized || null,
          echoDetected: echo,
          promptDetected: prompt,
          latencyMs: latency,
          timedOut,
          disconnectObserved
        });
      };

      if (cancellationSignal.cancelled) {
        return finish(false);
      }

      timeoutHandle = setTimeout(() => {
        finish(true);
      }, timeoutMs);

      try {
        const { writeCharacteristic, receiveCharacteristic } = combination;

        // 1. Install monitor BEFORE writing to not miss fast responses
        if (receiveCharacteristic.isNotifiable || receiveCharacteristic.isIndicatable) {
          subscription = device.monitorCharacteristicForService(
            receiveCharacteristic.serviceUuid,
            receiveCharacteristic.uuid,
            (error, characteristic) => {
              if (error) {
                // If it's a disconnection error, flag it
                if (error.errorCode === 201) disconnectObserved = true; // Device disconnected
                return;
              }
              if (characteristic?.value) {
                const chunk = Buffer.from(characteristic.value, 'base64').toString('ascii');
                fragmentCount++;
                accumulated += chunk;

                // Terminate condition: we see the prompt '>'
                if (accumulated.includes('>')) {
                  finish(false);
                }
              }
            }
          );
        }

        if (cancellationSignal.cancelled) {
           return finish(false);
        }

        // 2. Write command
        const base64Command = Buffer.from(command, 'ascii').toString('base64');

        if (writeCharacteristic.isWritableWithResponse) {
          await device.writeCharacteristicWithResponseForService(
            writeCharacteristic.serviceUuid,
            writeCharacteristic.uuid,
            base64Command
          );
          writeAccepted = true;
        } else if (writeCharacteristic.isWritableWithoutResponse) {
          await device.writeCharacteristicWithoutResponseForService(
            writeCharacteristic.serviceUuid,
            writeCharacteristic.uuid,
            base64Command
          );
          writeAccepted = true;
        } else {
          // No valid write method? Wait, CandidateSelector guarantees it, but just in case.
          finish(false);
          return;
        }

        // If receive is READ-only fallback (not monitorable)
        if (!subscription && receiveCharacteristic.isReadable) {
           // We poll read manually a few times
           let attempts = 0;
           const pollInterval = setInterval(async () => {
             if (isFinished || cancellationSignal.cancelled || attempts > 5) {
               clearInterval(pollInterval);
               if (!isFinished) finish(false);
               return;
             }
             attempts++;
             try {
               const char = await device.readCharacteristicForService(
                 receiveCharacteristic.serviceUuid,
                 receiveCharacteristic.uuid
               );
               if (char.value) {
                 const chunk = Buffer.from(char.value, 'base64').toString('ascii');
                 fragmentCount++;
                 accumulated += chunk;
                 if (accumulated.includes('>')) {
                   clearInterval(pollInterval);
                   finish(false);
                 }
               }
             } catch (e) {
               // Read error
             }
           }, 300);
        }

      } catch (e: any) {
         // Write failed or subscription failed
         if (e?.errorCode === 201) disconnectObserved = true;
         finish(false);
      }
    });
  }

  static sanitizeResponse(raw: string, originalCommand: string): { sanitized: string, echo: boolean, prompt: boolean } {
    let clean = raw;
    let echo = false;
    let prompt = false;

    // Detect prompt
    if (clean.includes('>')) {
      prompt = true;
      clean = clean.replace(/>/g, '');
    }

    // Detect and remove echo
    const cleanCmd = originalCommand.trim(); // "ATI"
    if (clean.includes(cleanCmd)) {
      echo = true;
      clean = clean.replace(cleanCmd, '');
    }

    // Strip unprintable characters, \r, \n, spaces
    clean = clean.replace(/[\r\n\0]/g, ' ').replace(/\s+/g, ' ').trim();

    return { sanitized: clean, echo, prompt };
  }
}
