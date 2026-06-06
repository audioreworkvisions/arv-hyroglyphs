import path from 'path';
import net from 'net';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { createServer as createHttpServer } from 'http';
import { createFoundryRoutes } from './routes/foundryRoutes';
import { createGifRoutes } from './routes/gifRoutes';
import { createOpenAIRoutes } from './routes/openAIRoutes';
import { createStillframeRoutes } from './routes/stillframeRoutes';
import { createThumbnailStudioRoutes } from './routes/thumbnailStudioRoutes';

dotenv.config({ path: '.env.local' });

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

interface RuntimeServerOptions {
  host: string;
  port: number;
  portWasExplicit: boolean;
}

const DEFAULT_DEV_PORT = 4173;

function readCliFlag(flag: string, shortFlag?: string): string | undefined {
  const argv = process.argv.slice(2);

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === flag || (shortFlag && value === shortFlag)) {
      return argv[index + 1];
    }

    if (value.startsWith(`${flag}=`)) {
      return value.slice(flag.length + 1);
    }

    if (shortFlag && value.startsWith(`${shortFlag}=`)) {
      return value.slice(shortFlag.length + 1);
    }
  }

  return undefined;
}

function readPort(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    return null;
  }

  return port;
}

function resolveRuntimeServerOptions(): RuntimeServerOptions {
  const cliPort = readPort(readCliFlag('--port', '-p'));
  const envPort = readPort(process.env.PORT);
  const host = readCliFlag('--host', '-H') || process.env.HOST || '0.0.0.0';

  if (cliPort !== null) {
    return { host, port: cliPort, portWasExplicit: true };
  }

  if (envPort !== null) {
    return { host, port: envPort, portWasExplicit: true };
  }

  return { host, port: DEFAULT_DEV_PORT, portWasExplicit: false };
}

async function canListenOnPort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();

    probe.once('error', () => {
      resolve(false);
    });

    probe.once('listening', () => {
      probe.close(() => resolve(true));
    });

    probe.listen(port, host);
  });
}

async function resolveListeningPort({ port, host, portWasExplicit }: RuntimeServerOptions): Promise<number> {
  if (portWasExplicit || process.env.NODE_ENV === 'production') {
    return port;
  }

  let candidatePort = port;

  while (!(await canListenOnPort(candidatePort, host))) {
    candidatePort += 1;
  }

  return candidatePort;
}

export async function startServer() {
  const app = express();
  const runtimeServerOptions = resolveRuntimeServerOptions();
  const port = await resolveListeningPort(runtimeServerOptions);
  const host = runtimeServerOptions.host;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.use(createOpenAIRoutes());
  app.use(createGifRoutes());
  app.use(createFoundryRoutes());
  app.use(createStillframeRoutes());
  app.use(createThumbnailStudioRoutes());

  const httpServer = createHttpServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(port, host, () => {
    const displayHost = host === '0.0.0.0' ? 'localhost' : host;
    console.log(`Server running on http://${displayHost}:${port}`);
  });
}