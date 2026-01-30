import { Timeframe } from '@/utils/types';

type DataCallback = (data: any) => void;

class WebSocketService {
  private static instance: WebSocketService;
  private socket: WebSocket | null = null;
  private subscribers: Map<string, Set<DataCallback>> = new Map();
  private pendingRequests: any[] = [];
  private isConnecting: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public connect() {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;
    this.socket = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.isConnecting = false;
      this.processPendingRequests();
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.socket.onclose = () => {
      console.log('WebSocket closed');
      this.socket = null;
      this.isConnecting = false;
      this.scheduleReconnect();
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  private getKey(symbol: string, granularity: number): string {
    return `${symbol}-${granularity}`;
  }

  public subscribe(
    symbol: string,
    timeframe: Timeframe,
    granularity: number,
    callback: DataCallback
  ) {
    if (!this.socket) {
      this.connect();
    }

    const key = this.getKey(symbol, granularity);
    
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    // Send subscription request
    const request = {
      ticks_history: symbol,
      subscribe: 1,
      end: 'latest',
      style: 'candles',
      granularity,
      count: timeframe === '1H' ? 100 : 200,
    };

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(request));
    } else {
      this.pendingRequests.push(request);
    }
  }

  public unsubscribe(symbol: string, granularity: number, callback: DataCallback) {
    const key = this.getKey(symbol, granularity);
    const callbacks = this.subscribers.get(key);
    
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscribers.delete(key);
        // Optionally send forget request to API
        // For now, we just stop listening to save bandwidth optimization complexity
      }
    }
  }

  private processPendingRequests() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    while (this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift();
      this.socket.send(JSON.stringify(request));
    }
  }

  private handleMessage(data: any) {
    let symbol: string | undefined;
    let granularity: number | undefined;

    if (data.msg_type === 'candles') {
      symbol = data.echo_req.ticks_history;
      granularity = data.echo_req.granularity;
    } else if (data.msg_type === 'ohlc') {
      symbol = data.ohlc.symbol;
      granularity = data.ohlc.granularity; // Note: API might return string or number, strict check needed? usually number
    }

    if (symbol && granularity) {
      const key = this.getKey(symbol, granularity);
      const callbacks = this.subscribers.get(key);
      
      if (callbacks) {
        callbacks.forEach((callback) => callback(data));
      }
    }
  }
}

export default WebSocketService;
