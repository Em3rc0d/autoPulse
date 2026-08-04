// src/services/webhookClient.ts
import { localStore } from './localStore';
import { telemetryBus } from './telemetryBus';

class WebhookClient {
  private webhookUrl: string | null = null;
  private isSubscribed = false;

  async init() {
    this.webhookUrl = await localStore.getWebhookUrl();
    if (!this.isSubscribed) {
      telemetryBus.on('telemetry_update', this.handleTelemetry);
      this.isSubscribed = true;
    }
  }

  async updateUrl(url: string) {
    this.webhookUrl = url;
    await localStore.saveWebhookUrl(url);
  }

  private handleTelemetry = async (data: any) => {
    if (!this.webhookUrl) return;

    try {
      // Usamos fetch directo sin esperar bloqueos
      fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(() => {
        // Fallos silenciosos en webhooks para no interrumpir el thread principal
      });
    } catch (e) {
      // Ignorar
    }
  };
}

export const webhookClient = new WebhookClient();
