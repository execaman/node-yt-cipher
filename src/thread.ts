import axios from "axios";
import express from "express";
import { getFromPrepared, preprocessPlayer } from "../ejs/src/yt/solver/solvers";

import type { MessagePayload, WorkerMessage } from "./types";

const signature = /(signatureTimestamp|sts):(\d+)/;
const resolvers = new Map<string, PromiseWithResolvers<string | null>>();

process.on("message", (payload: WorkerMessage) => {
  resolvers.get(payload.id)?.resolve(payload.data);
  resolvers.delete(payload.id);
});

const getCached = (op: MessagePayload["op"], key: string) => {
  if (resolvers.has(key)) return resolvers.get(key)!.promise;
  const resolver = Promise.withResolvers<string | null>();
  resolvers.set(`${op}:${key}`, resolver);
  process.send!({ op, key } satisfies MessagePayload);
  return resolver.promise;
};

const updateCache = (op: MessagePayload["op"], key: string, value: string) => {
  process.send!({ op, key, value } satisfies MessagePayload);
};

const retrieveOrRequest = async (playerUrl: string) => {
  const player = await getCached("player", playerUrl);
  if (player !== null) return player;
  const { data } = await axios.get<string>(new URL(playerUrl, "https://www.youtube.com").toString());
  updateCache("player", playerUrl, data);
  const sts = data.match(signature)?.[2];
  if (sts !== undefined) updateCache("sts", playerUrl, sts);
  return data;
};

const getSolvers = async (player_url: string) => {
  const cached = await getCached("processed", player_url);
  if (cached !== null) return getFromPrepared(cached);
  const player = await retrieveOrRequest(player_url);
  const preprocessed = preprocessPlayer(player);
  updateCache("processed", player_url, preprocessed);
  return getFromPrepared(preprocessed);
};

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  if (req.headers.authorization === process.env.AUTH) next();
  else res.sendStatus(401);
});

app.post("/get_sts", async (req, res) => {
  try {
    const player_url = req.body?.player_url;
    if (!player_url) throw 400;
    let sts: Awaited<ReturnType<typeof getCached>> | undefined = await getCached("sts", player_url);
    if (sts === null) {
      const content = await retrieveOrRequest(player_url);
      if (content === null) throw 500;
      sts = content.match(signature)?.[2];
      if (sts === undefined) throw 500;
    }
    res.status(200).json({ sts });
  } catch (code) {
    if (typeof code !== "number") {
      console.error(code);
      res.sendStatus(500);
    } else res.sendStatus(code);
  }
});

app.post("/decrypt_signature", async (req, res) => {
  try {
    if (!req.body) throw 400;
    const { player_url, n_param, encrypted_signature } = req.body;
    if (!player_url || !n_param || !encrypted_signature) throw 400;
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
    const { stream_url, player_url, n_param, encrypted_signature, signature_key } = req.body;
    if (!stream_url || !player_url) throw 400;
    const url = new URL(stream_url);
    const solvers = await getSolvers(player_url);
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

app.listen(Number.parseInt(process.env.PORT!, 10), (err) => {
  if (err !== undefined) console.error(err);
});
