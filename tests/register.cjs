// tsc conserva los alias de Next; resolverlos contra la salida aislada de pruebas.
const Module = require("node:module");
const path = require("node:path");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith("@/") ? path.join(__dirname, "../.test-build", request.slice(2)) : request, ...args);
};
// Next inicializa su almacenamiento de requests desde este global en el servidor.
globalThis.AsyncLocalStorage ||= require("node:async_hooks").AsyncLocalStorage;
