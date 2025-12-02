import type { AppLoadContext } from '@remix-run/cloudflare';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
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

  let shellReady = false;
  let allReady = false;

  const stream = renderToPipeableStream(<RemixServer context={remixContext} url={request.url} />, {
    onShellReady() {
      shellReady = true;
    },
    onAllReady() {
      allReady = true;
    },
    onError(error: unknown) {
      console.error(error);
      responseStatusCode = 500;
    },
  });

  const body = new ReadableStream({
    async start(controller) {
      // Enqueue the HTML start
      controller.enqueue(new Uint8Array(new TextEncoder().encode(htmlStart)));

      // Pipe the Node stream to the Web ReadableStream
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer | Uint8Array) => {
          if (chunk instanceof Uint8Array) {
            controller.enqueue(chunk);
          } else {
            controller.enqueue(new Uint8Array(chunk));
          }
        });

        stream.on('end', () => {
          controller.enqueue(new Uint8Array(new TextEncoder().encode(htmlEnd)));
          controller.close();
          resolve();
        });

        stream.on('error', (error: unknown) => {
          console.error('Stream error:', error);
          controller.error(error);
          reject(error);
        });
      });
    },
  });

  if (isbot(request.headers.get('user-agent') || '')) {
    await new Promise<void>((resolve, reject) => {
      const checkReady = () => {
        if (allReady) {
          resolve();
        } else {
          stream.once('allReady', resolve);
          stream.once('error', reject);
        }
      };
      checkReady();
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
