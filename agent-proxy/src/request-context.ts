import { AsyncLocalStorage } from 'node:async_hooks';
import type { ToolSet } from 'ai';
import type { FortemiAuthContext } from './auth/index.js';

export interface FortemiRequestContext {
  auth: FortemiAuthContext | null;
  authorization: string | null;
  memory: string | null;
  mode: 'authenticated' | 'anonymous_local';
}

const requestContext = new AsyncLocalStorage<FortemiRequestContext>();

export function runWithFortemiRequestContext<T>(
  context: FortemiRequestContext,
  callback: () => T,
): T {
  return requestContext.run(context, callback);
}

export function getFortemiRequestContext(): FortemiRequestContext | undefined {
  return requestContext.getStore();
}

export function requestContextIdentity(context: FortemiRequestContext): string {
  if (!context.auth) return `anonymous_local:${context.memory ?? 'public'}`;
  return `${context.auth.tenantId}:${context.auth.principalId}:${context.memory ?? 'public'}`;
}

export function bindToolsToFortemiRequestContext<T extends ToolSet>(
  tools: T,
  context: FortemiRequestContext,
): T {
  return Object.fromEntries(Object.entries(tools).map(([name, definition]) => {
    const source = definition as unknown as {
      execute?: (input: unknown, options: Record<string, unknown>) => unknown;
      [key: string]: unknown;
    };
    if (typeof source.execute !== 'function') return [name, definition];
    return [name, {
      ...source,
      execute: (input: unknown, options: Record<string, unknown>) =>
        runWithFortemiRequestContext(context, () => source.execute!(input, options)),
    }];
  })) as unknown as T;
}
