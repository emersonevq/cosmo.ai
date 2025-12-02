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

  const stream = renderToPipeableStream(<RemixServer context={remixContext} url={request.url} />, {
    onError(error: unknown) {
      console.error(error);
      responseStatusCode = 500;
    },
  });

  const head = renderHeadToString({ request, remixContext, Head });
  const htmlStart = `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`;
  const htmlEnd = '</div></body></html>';

  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(new Uint8Array(new TextEncoder().encode(htmlStart)));

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });

        stream.on('end', () => {
          controller.enqueue(new Uint8Array(new TextEncoder().encode(htmlEnd)));
          controller.close();
          resolve();
        });

        stream.on('error', (error: Error) => {
          controller.error(error);
          reject(error);
        });
      });
    },
  });

  if (isbot(request.headers.get('user-agent') || '')) {
    await new Promise<void>((resolve) => {
      stream.on('end', () => resolve());
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
