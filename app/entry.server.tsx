import type { AppLoadContext } from '@remix-run/cloudflare';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { PassThrough } from 'node:stream';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  _loadContext: AppLoadContext,
) {
  // await initializeModelList({});

  const head = renderHeadToString({ request, remixContext, Head });
  const htmlStart = `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`;
  const htmlEnd = '</div></body></html>';

  const passThrough = new PassThrough();

  const stream = renderToPipeableStream(<RemixServer context={remixContext} url={request.url} />, {
    onError(error: unknown) {
      console.error(error);
      responseStatusCode = 500;
    },
  });

  let shellRendered = false;

  stream.on('shellReady', () => {
    shellRendered = true;
    passThrough.write(htmlStart);
    stream.pipe(passThrough);
  });

  stream.on('error', (error: unknown) => {
    console.error('Stream error:', error);
  });

  const body = new ReadableStream({
    async start(controller) {
      await new Promise<void>((resolve, reject) => {
        passThrough.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });

        passThrough.on('end', () => {
          controller.enqueue(new Uint8Array(new TextEncoder().encode(htmlEnd)));
          controller.close();
          resolve();
        });

        passThrough.on('error', (error: Error) => {
          controller.error(error);
          reject(error);
        });
      });
    },
  });

  if (isbot(request.headers.get('user-agent') || '')) {
    await new Promise<void>((resolve, reject) => {
      stream.on('allReady', resolve);
      stream.on('error', reject);
    });
  }

  responseHeaders.set('Content-Type', 'text/html');

  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
