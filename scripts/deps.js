import { readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync("package.json", "utf8"));
const ejs = JSON.parse(readFileSync("./ejs/package.json", "utf8"));

for (const dep in ejs.dependencies) {
  src.dependencies[dep] = ejs.dependencies[dep];
}

writeFileSync("package.json", JSON.stringify(src, null, 2) + "\n", "utf8");
