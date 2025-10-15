import cluster from "node:cluster";
import { availableParallelism } from "node:os";

import type { Worker } from "node:cluster";
import type { MessagePayload, WorkerMessage } from "./types";

process.loadEnvFile();

const env = {
  PORT: process.env.PORT,
  AUTH: process.env.AUTH,
};

const sts = new Map<string, string>();
const player = new Map<string, string>();
const processed = new Map<string, string>();

function onOnline(this: Worker) {
  console.log(`Worker ${this.id} online`);
}

function onMessage(this: Worker, payload: MessagePayload) {
  const map = payload.op === "player" ? player : payload.op === "processed" ? processed : sts;
  if (payload.value !== undefined) map.set(payload.key, payload.value);
  else this.send({ id: `${payload.op}:${payload.key}`, data: map.get(payload.key) ?? null } satisfies WorkerMessage);
  if (sts.has(payload.key) && processed.has(payload.key)) player.delete(payload.key);
}

function onError(this: Worker, err: Error) {
  console.log(`Worker ${this.id} errored:`, err);
}

function onExit(this: Worker, code: number) {
  console.log(`Worker ${this.id} exited with code ${code}`);
  if (code !== 0) attachEvents(cluster.fork({ env }));
}

function attachEvents(worker: Worker) {
  worker.on("online", onOnline);
  worker.on("message", onMessage);
  worker.on("error", onError);
  worker.on("exit", onExit);
}

let workers = Math.max(1, Number.parseInt(process.env.WORKERS!, 10)) || availableParallelism();

while (workers !== 0) attachEvents(cluster.fork({ env })), --workers;
