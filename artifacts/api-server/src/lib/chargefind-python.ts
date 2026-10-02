import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { logger } from "./logger";

interface PythonApiProcess {
  baseUrl: string;
  child: ChildProcess;
}

let runningApi: PythonApiProcess | null = null;
let startingApi: Promise<PythonApiProcess> | null = null;

async function reserveLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not reserve a local port for the Python API.");
  }

  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function launchPythonApi(): Promise<PythonApiProcess> {
  const workingDirectory = path.resolve(
    process.cwd(),
    "chargefind-python/EV-Charging-Station-Finder",
  );
  const pythonExecutable = path.resolve(
    process.cwd(),
    "../../.pythonlibs/bin/python",
  );
  const port = await reserveLoopbackPort();
  const child = spawn(
    pythonExecutable,
    [
      "-m",
      "uvicorn",
      "api:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--log-level",
      "warning",
    ],
    {
      cwd: workingDirectory,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout?.on("data", (chunk: Buffer) => {
    logger.debug({ output: chunk.toString().trim() }, "ChargeFind Python API");
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    logger.warn(
      { output: chunk.toString().trim() },
      "ChargeFind Python API output",
    );
  });
  child.once("error", (err) => {
    logger.error({ err }, "Could not start the ChargeFind Python API");
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      break;
    }

    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        const api = { baseUrl, child };
        runningApi = api;
        child.once("exit", (code, signal) => {
          logger.warn(
            { code, signal },
            "ChargeFind Python API process exited",
          );
          if (runningApi?.child === child) {
            runningApi = null;
            startingApi = null;
          }
        });
        return api;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  child.kill("SIGTERM");
  throw new Error("ChargeFind Python API did not become ready.", {
    cause: lastError,
  });
}

async function getPythonApi(): Promise<PythonApiProcess> {
  if (runningApi && runningApi.child.exitCode === null) {
    return runningApi;
  }
  if (!startingApi) {
    startingApi = launchPythonApi().finally(() => {
      if (!runningApi) {
        startingApi = null;
      }
    });
  }
  return startingApi;
}

export async function requestChargeFind(
  endpoint: string,
): Promise<{ status: number; body: unknown }> {
  const api = await getPythonApi();
  const response = await fetch(`${api.baseUrl}${endpoint}`, {
    signal: AbortSignal.timeout(10_000),
  });
  const body: unknown = await response.json().catch(() => null);
  return { status: response.status, body };
}

function stopPythonApi(): void {
  runningApi?.child.kill("SIGTERM");
  runningApi = null;
  startingApi = null;
}

process.once("SIGTERM", stopPythonApi);
process.once("SIGINT", stopPythonApi);