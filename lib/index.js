import cluster from 'node:cluster';

// src/index.ts
if (cluster.isPrimary) import('./main-GBVOEOJZ.js');
else import('./thread-J2KA4DUN.js');
