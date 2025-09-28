import cluster from "node:cluster";
import { availableParallelism } from "node:os";
import express from "express";
import axios from "axios";
import solve from "../ejs/src/yt/solver/main";

import type { Worker } from "node:cluster";
import type { Input } from "../ejs/src/yt/solver/main";

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
  }
  function onError(this: Worker, err: Error) {
    console.log(`Worker ${this.id} errored:`, err);
  }
  function onExit(this: Worker, code: number) {
    console.log(`Worker ${this.id} exited with code ${code}`);
    if (code !== 0) attachEvents(cluster.fork({ env: process.env }));
  }
  function attachEvents(worker: Worker) {
    worker.on("online", onOnline);
    worker.on("message", onMessage);
    worker.on("error", onError);
    worker.on("exit", onExit);
  }
  for (let i = availableParallelism(); i; --i) attachEvents(cluster.fork({ env: process.env }));
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
      const { data } = await axios.get<string>(playerUrl);
      updateCache("player", playerUrl, data);
      const sts = data.match(signature)?.[2];
      if (sts !== undefined) updateCache("sts", playerUrl, sts);
      return data;
    } catch (err) {
      console.error(err);
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
      const cached = await getCached("processed", player_url);
      const player = cached ?? (await retrieveOrRequest(player_url));
      if (player === null) throw 500;
      const requests: Input["requests"] = [
        { type: "n", challenges: [n_param] },
        { type: "sig", challenges: [encrypted_signature] },
      ];
      const answer = solve(
        cached === null
          ? { type: "player", player, output_preprocessed: true, requests }
          : { type: "preprocessed", preprocessed_player: cached, requests }
      );
      if (answer.type === "error") throw 500;
      const output = { decrypted_signature: "", decrypted_n_sig: "" };
      for (const _res of answer.responses) {
        if (_res.type !== "result") continue;
        if (_res.data[encrypted_signature]) output.decrypted_signature = _res.data[encrypted_signature];
        if (_res.data[n_param]) output.decrypted_n_sig = _res.data[n_param];
      }
      if (!output.decrypted_n_sig || !output.decrypted_signature) throw 500;
      if (answer.preprocessed_player) updateCache("processed", player_url, answer.preprocessed_player);
      res.status(200).json(output);
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
  app.listen(process.env.PORT, (err) => {
    if (err !== undefined) console.error(err);
  });
}
