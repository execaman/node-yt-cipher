import cluster from "node:cluster";

if (cluster.isPrimary) import("./main.js");
else import("./thread.js");
