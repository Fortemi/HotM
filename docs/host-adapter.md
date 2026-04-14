# HotM Host Adapter

A generic contract that lets any embedding shell host HotM without
HotM needing to know about the shell. Used by Tauri-based white-label
apps that wrap the HotM UI and handle the network layer themselves.

HotM's standalone modes (browser SPA, standalone Tauri desktop) are
unaffected — the adapter is optional and HotM falls back to the Tauri
HTTP plugin / native `fetch` / `EventSource` when no adapter is present.

## When to implement this

Implement the adapter when:

- Your shell embeds HotM in an iframe with a custom URI scheme (e.g.
  `myshell://hotm/…`) where CORS or `EventSource` restrictions block
  HotM from reaching the Fortemi API directly.
- Your shell already routes organ HTTP through its own proxy and you
  want HotM to use the same pipe.
- You hit WebKit2GTK reading synthetic `ReadableStream` responses and
  want to bypass the Tauri plugin's SSE shim.

Do **not** implement this if your shell runs HotM as a plain HTTP app
with CORS working — the existing Tauri / web paths handle it.

## Contract

Publish an object on `window.__HOTM_HOST__` before HotM's main bundle
executes (typically in an `env-config.js` loaded as a classic script
in `<head>`):

```ts
interface HotmHostAdapter {
  network: {
    sse: {
      /**
       * Open an SSE connection to `url` from the shell's process and
       * begin forwarding events to the iframe via `postMessage`.
       *
       * Returns a handle the shell uses to route events back to the
       * right subscriber, and an event name the shell may use for
       * its internal plumbing (opaque to HotM).
       */
      connect(args: { url: string }): Promise<{ handle: string; event: string }>;

      /** Stop a previously-opened SSE connection. Best-effort. */
      close?(args: { handle: string }): Promise<void>;
    };

    /**
     * Perform a regular HTTP request from the shell's process. Body is
     * base64-encoded to survive the postMessage boundary cleanly.
     * Response body is base64 for the same reason.
     */
    fetch(args: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body_b64?: string;
    }): Promise<{
      status: number;
      status_text?: string;
      headers?: Record<string, string>;
      body_b64?: string;
    }>;
  };

  /** Optional: API base URL the shell wants HotM to use. */
  config?: {
    api_base_url?: string;
  };
}
```

Both `network.sse.connect` and `network.fetch` must be present for HotM
to treat the adapter as active (`getHostAdapter()` in `lib/tauri.ts`).

### SSE event forwarding

After `connect()` resolves, the shell `postMessage`s each SSE event to
the iframe's `window` with this envelope:

```ts
{
  __hotm_host_event: true,
  event: 'network.sse',
  handle: string,         // same value returned by connect()
  payload: {
    type?: string,        // SSE event type, or "message"
    id?: string,          // SSE event id
    data?: string,        // SSE data line (already a plain string)
  },
}
```

Two terminal payloads tell HotM to stop listening:

- `payload.type === '__close'` — the stream ended cleanly.
- `payload.type === '__error'` — the stream errored.

Either triggers cleanup on HotM's side.

HotM also recognises `__bt6_host_event: true` for backward compatibility
with the BT6 Arsenal shell that predates this contract. New hosts
should use `__hotm_host_event`.

## Minimal host example

A shell that already has a host-proxy object (`window.__MY_HOST__`)
routing through its own Rust/Electron backend can adapt with a thin
wrapper in an `env-config.js` injected before the main HotM bundle:

```js
// env-config.js, loaded in <head> as: <script src="env-config.js"></script>
window.__HOTM_HOST__ = {
  network: window.__MY_HOST__.network,    // assumes matching shape
  config: { api_base_url: 'http://localhost:3000' },
};
```

For shells whose proxy has a different shape, translate in the wrapper
rather than reaching into HotM source.

## Why not just use native fetch + EventSource?

- **Custom URI scheme origins.** `bt6organ://hotm` or `myshell://hotm`
  origins cannot make `EventSource` connections to `http://localhost:*`
  on Linux WebKit2GTK. CORS is respected for `fetch` but `EventSource`
  lifecycle differs.
- **Synthetic ReadableStream.** The standalone Tauri build's SSE path
  wraps `plugin-http` in a synthetic `ReadableStream<Response>` to
  replay events. WebKit2GTK 2.50+ cannot reliably read from those
  streams; events are enqueued but `reader.read()` never yields.
- **One pipe for organs.** Shells that already proxy HTTP and WebSocket
  for other organs get SSE on the same pipe for free — no new IPC
  channel, same audit trail.

## Backward compatibility

Pre-v2026.2.x HotM had no host adapter; shells worked around it by
patching the bundle or deleting `__TAURI_INTERNALS__`. Those shells
can keep their existing behavior — publishing `__HOTM_HOST__` is
purely additive.
