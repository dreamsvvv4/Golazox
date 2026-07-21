// Lanzador local: parchea node-fetch -> fetch global (Node 24) y arranca el server.
const Module = require('module');
const orig = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'node-fetch') return (...a) => fetch(...a);
  return orig.apply(this, arguments);
};
process.env.PORT = process.env.PORT || '3999';
require('./server');
