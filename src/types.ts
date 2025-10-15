export interface BasePayload {
  key: string;
  value?: string;
}

export interface StsPayload extends BasePayload {
  op: "sts";
}

export interface PlayerPayload extends BasePayload {
  op: "player";
}

export interface ProcessedPayload extends BasePayload {
  op: "processed";
}

export type MessagePayload = StsPayload | PlayerPayload | ProcessedPayload;

export interface WorkerMessage {
  id: string;
  data: string | null;
}
