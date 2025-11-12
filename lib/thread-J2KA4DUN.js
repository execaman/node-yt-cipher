import axios from 'axios';
import express from 'express';
import { parse } from 'meriyah';
import { generate } from 'astring';

// src/thread.ts

// ejs/src/utils.ts
function matchesStructure(obj, structure) {
  if (Array.isArray(structure)) {
    if (!Array.isArray(obj)) {
      return false;
    }
    return structure.length === obj.length && structure.every((value, index) => matchesStructure(obj[index], value));
  }
  if (typeof structure === "object") {
    if (!obj) {
      return !structure;
    }
    if ("or" in structure) {
      return structure.or.some((node) => matchesStructure(obj, node));
    }
    if ("anykey" in structure && Array.isArray(structure.anykey)) {
      const haystack = Array.isArray(obj) ? obj : Object.values(obj);
      return structure.anykey.every(
        (value) => haystack.some((el) => matchesStructure(el, value))
      );
    }
    for (const [key, value] of Object.entries(structure)) {
      if (!matchesStructure(obj[key], value)) {
        return false;
      }
    }
    return true;
  }
  return structure === obj;
}

// ejs/src/yt/solver/sig.ts
var logicalExpression = {
  type: "ExpressionStatement",
  expression: {
    type: "LogicalExpression",
    left: {
      type: "Identifier"
    },
    right: {
      type: "SequenceExpression",
      expressions: [
        {
          type: "AssignmentExpression",
          left: {
            type: "Identifier"
          },
          operator: "=",
          right: {
            type: "CallExpression",
            callee: {
              type: "Identifier"
            },
            arguments: {
              or: [
                [
                  { type: "Literal" },
                  {
                    type: "CallExpression",
                    callee: {
                      type: "Identifier",
                      name: "decodeURIComponent"
                    },
                    arguments: [{ type: "Identifier" }],
                    optional: false
                  }
                ],
                [
                  {
                    type: "CallExpression",
                    callee: {
                      type: "Identifier",
                      name: "decodeURIComponent"
                    },
                    arguments: [{ type: "Identifier" }],
                    optional: false
                  }
                ]
              ]
            },
            optional: false
          }
        },
        {
          type: "CallExpression"
        }
      ]
    },
    operator: "&&"
  }
};
var identifier = {
  or: [
    {
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: {
          type: "Identifier"
        },
        right: {
          type: "FunctionExpression",
          params: [{}, {}, {}]
        }
      }
    },
    {
      type: "FunctionDeclaration",
      params: [{}, {}, {}]
    },
    {
      type: "VariableDeclaration",
      declarations: {
        anykey: [
          {
            type: "VariableDeclarator",
            init: {
              type: "FunctionExpression",
              params: [{}, {}, {}]
            }
          }
        ]
      }
    }
  ]
};
function extract(node) {
  if (!matchesStructure(node, identifier)) {
    return null;
  }
  let block;
  if (node.type === "ExpressionStatement" && node.expression.type === "AssignmentExpression" && node.expression.right.type === "FunctionExpression") {
    block = node.expression.right.body;
  } else if (node.type === "VariableDeclaration") {
    for (const decl of node.declarations) {
      if (decl.type === "VariableDeclarator" && decl.init?.type === "FunctionExpression" && decl.init?.params.length === 3) {
        block = decl.init.body;
        break;
      }
    }
  } else if (node.type === "FunctionDeclaration") {
    block = node.body;
  } else {
    return null;
  }
  const relevantExpression = block?.body.at(-2);
  if (!matchesStructure(relevantExpression, logicalExpression)) {
    return null;
  }
  if (relevantExpression?.type !== "ExpressionStatement" || relevantExpression.expression.type !== "LogicalExpression" || relevantExpression.expression.right.type !== "SequenceExpression" || relevantExpression.expression.right.expressions[0].type !== "AssignmentExpression") {
    return null;
  }
  const call = relevantExpression.expression.right.expressions[0].right;
  if (call.type !== "CallExpression" || call.callee.type !== "Identifier") {
    return null;
  }
  return {
    type: "ArrowFunctionExpression",
    params: [
      {
        type: "Identifier",
        name: "sig"
      }
    ],
    body: {
      type: "CallExpression",
      callee: {
        type: "Identifier",
        name: call.callee.name
      },
      arguments: call.arguments.length === 1 ? [
        {
          type: "Identifier",
          name: "sig"
        }
      ] : [
        call.arguments[0],
        {
          type: "Identifier",
          name: "sig"
        }
      ],
      optional: false
    },
    async: false,
    expression: false,
    generator: false
  };
}

// ejs/src/yt/solver/n.ts
var identifier2 = {
  or: [
    {
      type: "VariableDeclaration",
      kind: "var",
      declarations: {
        anykey: [
          {
            type: "VariableDeclarator",
            id: {
              type: "Identifier"
            },
            init: {
              type: "ArrayExpression",
              elements: [
                {
                  type: "Identifier"
                }
              ]
            }
          }
        ]
      }
    },
    {
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        left: {
          type: "Identifier"
        },
        operator: "=",
        right: {
          type: "ArrayExpression",
          elements: [
            {
              type: "Identifier"
            }
          ]
        }
      }
    }
  ]
};
var catchBlockBody = [
  {
    type: "ReturnStatement",
    argument: {
      type: "BinaryExpression",
      left: {
        type: "MemberExpression",
        object: {
          type: "Identifier"
        },
        computed: true,
        property: {
          type: "Literal"
        },
        optional: false
      },
      right: {
        type: "Identifier"
      },
      operator: "+"
    }
  }
];
function extract2(node) {
  if (!matchesStructure(node, identifier2)) {
    let name = null;
    let block = null;
    switch (node.type) {
      case "ExpressionStatement": {
        if (node.expression.type === "AssignmentExpression" && node.expression.left.type === "Identifier" && node.expression.right.type === "FunctionExpression" && node.expression.right.params.length === 1) {
          name = node.expression.left.name;
          block = node.expression.right.body;
        }
        break;
      }
      case "FunctionDeclaration": {
        if (node.params.length === 1) {
          name = node.id?.name;
          block = node.body;
        }
        break;
      }
    }
    if (!block || !name) {
      return null;
    }
    const tryNode = block.body.at(-2);
    if (tryNode?.type !== "TryStatement" || tryNode.handler?.type !== "CatchClause") {
      return null;
    }
    const catchBody = tryNode.handler.body.body;
    if (matchesStructure(catchBody, catchBlockBody)) {
      return makeSolverFuncFromName(name);
    }
    return null;
  }
  if (node.type === "VariableDeclaration") {
    for (const declaration of node.declarations) {
      if (declaration.type !== "VariableDeclarator" || !declaration.init || declaration.init.type !== "ArrayExpression" || declaration.init.elements.length !== 1) {
        continue;
      }
      const [firstElement] = declaration.init.elements;
      if (firstElement && firstElement.type === "Identifier") {
        return makeSolverFuncFromName(firstElement.name);
      }
    }
  } else if (node.type === "ExpressionStatement") {
    const expr = node.expression;
    if (expr.type === "AssignmentExpression" && expr.left.type === "Identifier" && expr.operator === "=" && expr.right.type === "ArrayExpression" && expr.right.elements.length === 1) {
      const [firstElement] = expr.right.elements;
      if (firstElement && firstElement.type === "Identifier") {
        return makeSolverFuncFromName(firstElement.name);
      }
    }
  }
  return null;
}
function makeSolverFuncFromName(name) {
  return {
    type: "ArrowFunctionExpression",
    params: [
      {
        type: "Identifier",
        name: "n"
      }
    ],
    body: {
      type: "CallExpression",
      callee: {
        type: "Identifier",
        name
      },
      arguments: [
        {
          type: "Identifier",
          name: "n"
        }
      ],
      optional: false
    },
    async: false,
    expression: false,
    generator: false
  };
}
var setupNodes = parse(`
if (typeof globalThis.XMLHttpRequest === "undefined") {
    globalThis.XMLHttpRequest = { prototype: {} };
}
const window = Object.create(null);
if (typeof URL === "undefined") {
    window.location = {
        hash: "",
        host: "www.youtube.com",
        hostname: "www.youtube.com",
        href: "https://www.youtube.com/watch?v=yt-dlp-wins",
        origin: "https://www.youtube.com",
        password: "",
        pathname: "/watch",
        port: "",
        protocol: "https:",
        search: "?v=yt-dlp-wins",
        username: "",
    };
} else {
    window.location = new URL("https://www.youtube.com/watch?v=yt-dlp-wins");
}
if (typeof globalThis.document === "undefined") {
    globalThis.document = Object.create(null);
}
if (typeof globalThis.navigator === "undefined") {
    globalThis.navigator = Object.create(null);
}
if (typeof globalThis.self === "undefined") {
    globalThis.self = globalThis;
}
`).body;

// ejs/src/yt/solver/solvers.ts
function preprocessPlayer(data) {
  const ast = parse(data);
  const body = ast.body;
  const block = (() => {
    switch (body.length) {
      case 1: {
        const func = body[0];
        if (func?.type === "ExpressionStatement" && func.expression.type === "CallExpression" && func.expression.callee.type === "MemberExpression" && func.expression.callee.object.type === "FunctionExpression") {
          return func.expression.callee.object.body;
        }
        break;
      }
      case 2: {
        const func = body[1];
        if (func?.type === "ExpressionStatement" && func.expression.type === "CallExpression" && func.expression.callee.type === "FunctionExpression") {
          const block2 = func.expression.callee.body;
          block2.body.splice(0, 1);
          return block2;
        }
        break;
      }
    }
    throw "unexpected structure";
  })();
  const found = {
    n: [],
    sig: []
  };
  const plainExpressions = block.body.filter((node) => {
    const n = extract2(node);
    if (n) {
      found.n.push(n);
    }
    const sig = extract(node);
    if (sig) {
      found.sig.push(sig);
    }
    if (node.type === "ExpressionStatement") {
      if (node.expression.type === "AssignmentExpression") {
        return true;
      }
      return node.expression.type === "Literal";
    }
    return true;
  });
  block.body = plainExpressions;
  for (const [name, options] of Object.entries(found)) {
    const unique = new Set(options.map((x) => JSON.stringify(x)));
    if (unique.size !== 1) {
      const message = `found ${unique.size} ${name} function possibilities`;
      throw message + (unique.size ? `: ${options.map((x) => generate(x)).join(", ")}` : "");
    }
    plainExpressions.push({
      type: "ExpressionStatement",
      expression: {
        type: "AssignmentExpression",
        operator: "=",
        left: {
          type: "MemberExpression",
          computed: false,
          object: {
            type: "Identifier",
            name: "_result"
          },
          property: {
            type: "Identifier",
            name
          }
        },
        right: options[0]
      }
    });
  }
  ast.body.splice(0, 0, ...setupNodes);
  return generate(ast);
}
function getFromPrepared(code) {
  const resultObj = { n: null, sig: null };
  Function("_result", code)(resultObj);
  return resultObj;
}

// src/thread.ts
var signature = /(signatureTimestamp|sts):(\d+)/;
var resolvers = /* @__PURE__ */ new Map();
process.on("message", (payload) => {
  resolvers.get(payload.id)?.resolve(payload.data);
  resolvers.delete(payload.id);
});
var getCached = (op, key) => {
  if (resolvers.has(key)) return resolvers.get(key).promise;
  const resolver = Promise.withResolvers();
  resolvers.set(`${op}:${key}`, resolver);
  process.send({ op, key });
  return resolver.promise;
};
var updateCache = (op, key, value) => {
  process.send({ op, key, value });
};
var retrieveOrRequest = async (playerUrl) => {
  const player = await getCached("player", playerUrl);
  if (player !== null) return player;
  const { data } = await axios.get(new URL(playerUrl, "https://www.youtube.com").toString());
  updateCache("player", playerUrl, data);
  const sts = data.match(signature)?.[2];
  if (sts !== void 0) updateCache("sts", playerUrl, sts);
  return data;
};
var getSolvers = async (player_url) => {
  const cached = await getCached("processed", player_url);
  if (cached !== null) return getFromPrepared(cached);
  const player = await retrieveOrRequest(player_url);
  const preprocessed = preprocessPlayer(player);
  updateCache("processed", player_url, preprocessed);
  return getFromPrepared(preprocessed);
};
var app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (req.headers.authorization === process.env.AUTH) next();
  else res.sendStatus(401);
});
app.post("/get_sts", async (req, res) => {
  try {
    const player_url = req.body?.player_url;
    if (!player_url) throw 400;
    let sts = await getCached("sts", player_url);
    if (sts === null) {
      const content = await retrieveOrRequest(player_url);
      if (content === null) throw 500;
      sts = content.match(signature)?.[2];
      if (sts === void 0) throw 500;
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
      decrypted_n_sig: solvers?.n?.(n_param)
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
app.listen(Number.parseInt(process.env.PORT, 10), (err) => {
  if (err !== void 0) console.error(err);
});
