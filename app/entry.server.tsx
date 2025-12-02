import type { AppLoadContext } from '@remix-run/cloudflare';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToString } from 'react-dom/server';
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

  try {
    const content = renderToString(<RemixServer context={remixContext} url={request.url} />);

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const html = htmlStart + content + htmlEnd;
        controller.enqueue(new Uint8Array(new TextEncoder().encode(html)));
        controller.close();
      },
    });

    responseHeaders.set('Content-Type', 'text/html');
    responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
    responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

    return new Response(body, {
      headers: responseHeaders,
      status: responseStatusCode,
    });
  } catch (error) {
    console.error('Error rendering:', error);
    responseStatusCode = 500;

    const errorBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new Uint8Array(
            new TextEncoder().encode(
              `<!DOCTYPE html><html><body><h1>Internal Server Error</h1><pre>${error instanceof Error ? error.message : String(error)}</pre></body></html>`,
            ),
          ),
        );
        controller.close();
      },
    });

    responseHeaders.set('Content-Type', 'text/html');

    return new Response(errorBody, {
      headers: responseHeaders,
      status: 500,
    });
  }
}
