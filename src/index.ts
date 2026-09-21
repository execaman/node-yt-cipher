import axios from "axios";
import express from "express";
import { getFromPrepared, preprocessPlayer } from "../ejs/src/yt/solver/solvers";

process.loadEnvFile();

const app = express();
const signature = /(signatureTimestamp|sts):(\d+)/;

const caches = {
  sts: new Map<string, string>(),
  player: new Set<string>(),
  solver: new Map<string, ReturnType<typeof getFromPrepared>>(),
};
const promises = new Map<string, Promise<void>>();

const processPlayer = (player: string, url: string) => {
  const sts = player.match(signature)?.[2];
  if (sts !== undefined) caches.sts.set(url, sts);
  const solver = getFromPrepared(preprocessPlayer(player));
  caches.solver.set(url, solver);
};

const fetchPlayer = async (player_url: string) => {
  if (promises.has(player_url)) return promises.get(player_url)!;
  const resolver = Promise.withResolvers<void>();
  promises.set(player_url, resolver.promise);
  try {
    const { data } = await axios.get<string>(new URL(player_url, "https://www.youtube.com").toString());
    processPlayer(data, player_url);
    caches.player.add(player_url);
    resolver.resolve();
  } catch (err) {
    resolver.reject(err);
    throw err;
  } finally {
    promises.delete(player_url);
  }
};

app.use(express.json());

app.use((req, res, next) => {
  if (req.headers.authorization === process.env.AUTH) next();
  else res.sendStatus(401);
});

app.post("/decrypt_signature", async (req, res) => {
  try {
    if (!req.body) throw 400;
    const { player_url, n_param, encrypted_signature } = req.body;
    if (!player_url || !n_param || !encrypted_signature) throw 400;
    if (!caches.player.has(player_url)) await fetchPlayer(player_url);
    const solver = caches.solver.get(player_url);
    const result = {
      decrypted_signature: solver?.sig?.(encrypted_signature),
      decrypted_n_sig: solver?.n?.(n_param),
    };
    if (!result.decrypted_signature || !result.decrypted_n_sig) throw 500;
    res.json(result);
  } catch (err) {
    if (typeof err !== "number") {
      console.error(err);
      res.sendStatus(500);
    } else res.sendStatus(err);
  }
});

app.post("/get_sts", async (req, res) => {
  try {
    const player_url = req.body?.player_url;
    if (!player_url) throw 400;
    if (!caches.player.has(player_url)) await fetchPlayer(player_url);
    const sts = caches.sts.get(player_url);
    if (sts === undefined) throw 500;
    res.json({ sts });
  } catch (err) {
    if (typeof err !== "number") {
      console.error(err);
      res.sendStatus(500);
    } else res.sendStatus(err);
  }
});

app.post("/resolve_url", async (req, res) => {
  try {
    if (!req.body) throw 400;
    const { stream_url, player_url, n_param, encrypted_signature, signature_key } = req.body;
    if (!stream_url || !player_url) throw 400;
    const url = new URL(stream_url);
    if (!caches.player.has(player_url)) await fetchPlayer(player_url);
    const solver = caches.solver.get(player_url);
    if (!solver) throw 500;
    if (encrypted_signature) {
      if (!solver.sig) throw 500;
      url.searchParams.set(signature_key || "sig", solver.sig(encrypted_signature));
      url.searchParams.delete("s");
    }
    if (solver.n) {
      const n = n_param || url.searchParams.get("n");
      if (!n) throw 400;
      url.searchParams.set("n", solver.n(n));
    }
    res.json({ resolved_url: url.toString() });
  } catch (err) {
    if (typeof err !== "number") {
      console.error(err);
      res.sendStatus(500);
    } else res.sendStatus(err);
  }
});

app.use(((err, _req, res, _next) => {
  console.error(err);
  res.sendStatus(500);
}) satisfies express.ErrorRequestHandler);

app.listen(Number.parseInt(process.env.PORT!, 10), (err) => {
  if (err !== undefined) console.error(err);
  else console.log(`Listening on port ${process.env.PORT}`);
});
