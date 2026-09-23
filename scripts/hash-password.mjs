import { pbkdf2Sync, randomUUID } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error("Uso: node scripts/hash-password.mjs \"contrasena-segura\"");
  process.exit(1);
}

const salt = randomUUID();
const iterations = 120000;
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
console.log(`pbkdf2$${iterations}$${salt}$${hash}`);
