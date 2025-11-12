import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

// src/main.ts
process.loadEnvFile();
var env = {
  PORT: process.env.PORT,
  AUTH: process.env.AUTH
};
var sts = /* @__PURE__ */ new Map();
var player = /* @__PURE__ */ new Map();
var processed = /* @__PURE__ */ new Map();
function onOnline() {
  console.log(`Worker ${this.id} online`);
}
function onMessage(payload) {
  const map = payload.op === "player" ? player : payload.op === "processed" ? processed : sts;
  if (payload.value !== void 0) map.set(payload.key, payload.value);
  else this.send({ id: `${payload.op}:${payload.key}`, data: map.get(payload.key) ?? null });
  if (sts.has(payload.key) && processed.has(payload.key)) player.delete(payload.key);
}
function onError(err) {
  console.log(`Worker ${this.id} errored:`, err);
}
function onExit(code) {
  console.log(`Worker ${this.id} exited with code ${code}`);
  if (code !== 0) attachEvents(cluster.fork({ env }));
}
function attachEvents(worker) {
  worker.on("online", onOnline);
  worker.on("message", onMessage);
  worker.on("error", onError);
  worker.on("exit", onExit);
}
var workers = Math.max(1, Number.parseInt(process.env.WORKERS, 10)) || availableParallelism();
while (workers !== 0) attachEvents(cluster.fork({ env })), --workers;
