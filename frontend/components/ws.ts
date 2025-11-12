// Reconnecting WebSocket helper with exponential backoff and simple event callbacks
export type WSMessage = any;

type Callbacks = {
  onopen?: (self?: ReconnectingWebSocket) => void;
  onmessage?: (data: WSMessage) => void;
  onclose?: (ev?: CloseEvent) => void;
  onerror?: (ev?: Event) => void;
};

export class ReconnectingWebSocket {
  private url: string;
  private ws: WebSocket | null = null;
  private shouldReconnect = true;
  private backoff = 500; // ms
  private maxBackoff = 30_000;
  private callbacks: Callbacks;

  constructor(url: string, callbacks: Callbacks = {}) {
    this.url = url;
    this.callbacks = callbacks;
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.backoff = 500;
      this.callbacks.onopen?.(this);
    };

    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        this.callbacks.onmessage?.(data);
      } catch (err) {
        // not JSON, pass raw
        this.callbacks.onmessage?.(evt.data);
      }
    };

    this.ws.onclose = (ev) => {
      this.callbacks.onclose?.(ev);
      if (this.shouldReconnect) this.scheduleReconnect();
    };

    this.ws.onerror = (ev) => {
      this.callbacks.onerror?.(ev);
      // let onclose handle reconnection
    };
  }

  private scheduleReconnect() {
    setTimeout(() => {
      this.backoff = Math.min(this.backoff * 1.8, this.maxBackoff);
      this.connect();
    }, this.backoff + Math.random() * 200);
  }

  send(obj: any) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(obj));
      }
    } catch (e) {
      // ignore send errors
    }
  }

  close() {
    this.shouldReconnect = false;
    this.ws?.close();
  }
}
