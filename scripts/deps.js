import { readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync("package.json", "utf8"));
const ejs = JSON.parse(readFileSync("./ejs/package.json", "utf8"));

for (const dep in src.ejsDependencies) {
  delete src.dependencies[dep];
}

for (const dep in ejs.dependencies) {
  src.dependencies[dep] = ejs.dependencies[dep];
}

src.ejsDependencies = ejs.dependencies;

writeFileSync("package.json", JSON.stringify(src, null, 2) + "\n", "utf8");
