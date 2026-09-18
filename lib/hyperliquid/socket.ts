import type { WsBook, WsTrade } from "./types";

const WS_URL = "wss://api.hyperliquid.xyz/ws";
const PING_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 10_000;

interface L2BookSubscription {
  type: "l2Book";
  coin: string;
  nSigFigs: 2 | 3 | 4 | 5 | null;
  mantissa?: 1 | 2 | 5;
}

interface TradesSubscription {
  type: "trades";
  coin: string;
}

interface BookEntry {
  subscription: L2BookSubscription;
  listeners: Set<(book: WsBook) => void>;
}

interface TradesEntry {
  subscription: TradesSubscription;
  listeners: Set<(trades: WsTrade[]) => void>;
}

const bookRegistry = new Map<string, BookEntry>();
const tradesRegistry = new Map<string, TradesEntry>();

let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

export type ConnectionStatus = "connecting" | "open" | "reconnecting";

let status: ConnectionStatus = "connecting";
const statusListeners = new Set<(status: ConnectionStatus) => void>();

function setStatus(next: ConnectionStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener(status));
}

export function subscribeStatus(onChange: (status: ConnectionStatus) => void): () => void {
  statusListeners.add(onChange);
  onChange(status);
  return () => statusListeners.delete(onChange);
}

export function getConnectionStatus(): ConnectionStatus {
  return status;
}

function bookPayload(sub: L2BookSubscription) {
  const payload: L2BookSubscription = { type: "l2Book", coin: sub.coin, nSigFigs: sub.nSigFigs };
  if (sub.mantissa !== undefined) payload.mantissa = sub.mantissa;
  return payload;
}

function sendBook(method: "subscribe" | "unsubscribe", sub: L2BookSubscription) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ method, subscription: bookPayload(sub) }));
  }
}

function sendTrades(method: "subscribe" | "unsubscribe", sub: TradesSubscription) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ method, subscription: { type: "trades", coin: sub.coin } }));
  }
}

function sendPing() {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ method: "ping" }));
  }
}

function handleMessage(event: MessageEvent<string>) {
  const msg = JSON.parse(event.data) as
    | { channel: "l2Book"; data: WsBook }
    | { channel: "trades"; data: WsTrade[] };

  if (msg.channel === "l2Book") {
    for (const entry of bookRegistry.values()) {
      if (entry.subscription.coin === msg.data.coin) {
        entry.listeners.forEach((listener) => listener(msg.data));
      }
    }
  } else if (msg.channel === "trades" && msg.data.length > 0) {
    const coin = msg.data[0].coin;
    for (const entry of tradesRegistry.values()) {
      if (entry.subscription.coin === coin) {
        entry.listeners.forEach((listener) => listener(msg.data));
      }
    }
  }
}

function scheduleReconnect() {
  if (reconnectTimer !== null) return;
  const backoff = Math.min(1000 * 2 ** reconnectAttempt, MAX_BACKOFF_MS);
  const jitter = Math.random() * backoff * 0.3;
  reconnectAttempt++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, backoff + jitter);
}

function connect() {
  if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
    return;
  }

  const socket = new WebSocket(WS_URL);
  ws = socket;
  setStatus(reconnectAttempt === 0 ? "connecting" : "reconnecting");

  socket.onopen = () => {
    reconnectAttempt = 0;
    setStatus("open");
    for (const entry of bookRegistry.values()) sendBook("subscribe", entry.subscription);
    for (const entry of tradesRegistry.values()) sendTrades("subscribe", entry.subscription);
    pingTimer = setInterval(sendPing, PING_INTERVAL_MS);
  };

  socket.onmessage = handleMessage;

  socket.onclose = () => {
    if (pingTimer !== null) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    setStatus("reconnecting");
    scheduleReconnect();
  };

  socket.onerror = () => socket.close();
}

export function subscribeBook(
  coin: string,
  nSigFigs: 2 | 3 | 4 | 5 | null,
  mantissa: (1 | 2 | 5) | undefined,
  onMessage: (book: WsBook) => void
): () => void {
  const key = `${coin}:${nSigFigs}:${mantissa ?? ""}`;
  const existing = bookRegistry.get(key);
  const entry: BookEntry = existing ?? {
    subscription: { type: "l2Book", coin, nSigFigs, mantissa },
    listeners: new Set(),
  };
  if (!existing) {
    bookRegistry.set(key, entry);
    connect();
    sendBook("subscribe", entry.subscription);
  }
  entry.listeners.add(onMessage);

  return () => {
    entry.listeners.delete(onMessage);
    if (entry.listeners.size === 0) {
      bookRegistry.delete(key);
      sendBook("unsubscribe", entry.subscription);
    }
  };
}

export function subscribeTrades(coin: string, onMessage: (trades: WsTrade[]) => void): () => void {
  const key = coin;
  const existing = tradesRegistry.get(key);
  const entry: TradesEntry = existing ?? {
    subscription: { type: "trades", coin },
    listeners: new Set(),
  };
  if (!existing) {
    tradesRegistry.set(key, entry);
    connect();
    sendTrades("subscribe", entry.subscription);
  }
  entry.listeners.add(onMessage);

  return () => {
    entry.listeners.delete(onMessage);
    if (entry.listeners.size === 0) {
      tradesRegistry.delete(key);
      sendTrades("unsubscribe", entry.subscription);
    }
  };
}
