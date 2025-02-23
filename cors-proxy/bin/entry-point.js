#!/usr/bin/env node

const path = require('path');

process.chdir(path.resolve(__dirname, '..'));

require('ts-node').register({
    project: './tsconfig.json',
  });
require('../cors-proxy.ts');