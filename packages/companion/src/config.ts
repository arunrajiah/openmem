import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

export interface Config {
  host: string;
  port: number;
  dataDir: string;
  dbPath: string;
}

export function loadConfig(): Config {
  const host = process.env.OPENMEM_HOST ?? "127.0.0.1";
  const port = Number(process.env.OPENMEM_PORT ?? 7410);
  const dataDir =
    process.env.OPENMEM_DATA_DIR ?? join(homedir(), ".openmem");
  mkdirSync(dataDir, { recursive: true });
  return {
    host,
    port,
    dataDir,
    dbPath: join(dataDir, "openmem.db"),
  };
}
