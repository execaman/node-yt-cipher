import cluster from "node:cluster";
import { availableParallelism } from "node:os";
import { URL } from "node:url";
import express from "express";
import axios from "axios";
import { getFromPrepared, preprocessPlayer } from "../ejs/src/yt/solver/solvers";

import type { Worker } from "node:cluster";

interface BasePayload {
  key: string;
  value?: string;
}

interface StsPayload extends BasePayload {
  op: "sts";
}

interface PlayerPayload extends BasePayload {
  op: "player";
}

interface ProcessedPayload extends BasePayload {
  op: "processed";
}

type MessagePayload = StsPayload | PlayerPayload | ProcessedPayload;

interface WorkerMessage {
  id: string;
  data: string | null;
}

if (cluster.isPrimary) {
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
} else {
  const signature = /(signatureTimestamp|sts):(\d+)/;
  const resolvers = new Map<string, PromiseWithResolvers<string | null>>();
  process.on("message", (payload: WorkerMessage) => {
    resolvers.get(payload.id)?.resolve(payload.data);
    resolvers.delete(payload.id);
  });
  const getCached = async (op: MessagePayload["op"], key: string) => {
    if (resolvers.has(key)) return resolvers.get(key)!.promise;
    const resolver = Promise.withResolvers<string | null>();
    resolvers.set(`${op}:${key}`, resolver);
    process.send?.({ op, key } satisfies MessagePayload);
    return resolver.promise;
  };
  const updateCache = (op: MessagePayload["op"], key: string, value: string) => {
    process.send?.({ op, key, value } satisfies MessagePayload);
  };
  const retrieveOrRequest = async (playerUrl: string) => {
    const player = await getCached("player", playerUrl);
    if (player !== null) return player;
    try {
      const { data } = await axios.get<string>(new URL(playerUrl, "https://www.youtube.com").href);
      updateCache("player", playerUrl, data);
      const sts = data.match(signature)?.[2];
      if (sts !== undefined) updateCache("sts", playerUrl, sts);
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  };
  const getSolvers = async (player_url: string) => {
    try {
      const cached = await getCached("processed", player_url);
      if (cached !== null) return getFromPrepared(cached);
      const player = await retrieveOrRequest(player_url);
      if (player === null) return null;
      const preprocessed = preprocessPlayer(player);
      updateCache("processed", player_url, preprocessed);
      return getFromPrepared(preprocessed);
    } catch {
      return null;
    }
  };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.headers.authorization !== process.env.AUTH) {
      res.sendStatus(401);
      return;
    }
    next();
  });
  app.post("/decrypt_signature", async (req, res) => {
    try {
      if (!req.body) throw 400;
      const { encrypted_signature, n_param, player_url } = req.body;
      if (!encrypted_signature || !n_param || !player_url) throw 400;
      const solvers = await getSolvers(player_url);
      const output = {
        decrypted_signature: solvers?.sig?.(encrypted_signature),
        decrypted_n_sig: solvers?.n?.(n_param),
      };
      if (!output.decrypted_signature || !output.decrypted_n_sig) throw 500;
      res.status(200).json(output);
    } catch (code) {
      if (typeof code !== "number") {
        console.error(code);
        res.sendStatus(500);
      } else res.sendStatus(code);
    }
  });
  app.post("/resolve_url", async (req, res) => {
    try {
      if (!req.body) throw 400;
      const { encrypted_signature, signature_key, n_param, player_url, stream_url } = req.body;
      if (!player_url || !stream_url) throw 400;
      const url = new URL(stream_url);
      const solvers = await getSolvers(player_url);
      if (!solvers) throw 500;
      if (encrypted_signature) {
        if (!solvers.sig) throw 500;
        url.searchParams.set(signature_key || "sig", solvers.sig(encrypted_signature));
        url.searchParams.delete("s");
      }
      if (solvers.n) {
        const n = n_param || url.searchParams.get("n");
        if (!n) throw 400;
        url.searchParams.set("n", solvers.n(n));
      }
      res.status(200).json({ resolved_url: url.toString() });
    } catch (code) {
      if (typeof code !== "number") {
        console.error(code);
        res.sendStatus(500);
      } else res.sendStatus(code);
    }
  });
  app.post("/get_sts", async (req, res) => {
    const playerUrl = req.body?.player_url;
    if (!playerUrl) return res.sendStatus(400);
    const sts = await getCached("sts", playerUrl);
    if (sts !== null) return res.status(200).json({ sts });
    const content = await retrieveOrRequest(playerUrl);
    if (content === null) return res.sendStatus(500);
    const _sts = content.match(signature)?.[2];
    if (_sts !== undefined) return res.status(200).json({ sts: _sts });
    return res.sendStatus(500);
  });
  app.listen(Number.parseInt(process.env.PORT!, 10), (err) => {
    if (err !== undefined) console.error(err);
  });
}
