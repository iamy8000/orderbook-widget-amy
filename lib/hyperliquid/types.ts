export interface WsLevel {
  px: string;
  sz: string;
  n: number;
}

export interface WsBook {
  coin: string;
  time: number;
  levels: [WsLevel[], WsLevel[]];
}

export interface WsTrade {
  coin: string;
  side: "B" | "A";
  px: string;
  time: number;
}
