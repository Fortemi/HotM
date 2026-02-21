# Client Sync Agent Interfaces (Sketch)

## TypeScript (UI App)
```ts
export type JournalCursor = string;

export interface Change {
  id: string;            // deterministic UUID (idempotency key)
  type: 'note.create' | 'note.update' | 'note.tag.add' | 'note.tag.remove' | 'link.add' | 'link.remove';
  payload: unknown;      // semantic delta; encrypted if E2EE
  createdAt: string;     // ISO timestamp
}

export interface PushResult { applied: number; cursor: JournalCursor; }
export interface PullResult { cursor: JournalCursor; changes: Change[]; }

export interface SyncAgent {
  getDeviceId(): Promise<string>;
  getCursor(): Promise<JournalCursor | null>;
  setCursor(cursor: JournalCursor): Promise<void>;

  registerDevice(): Promise<{ deviceId: string }>;
  enqueue(change: Change): Promise<void>;              // append to local queue
  push(batchSize?: number): Promise<PushResult>;       // POST /sync/push
  pull(limit?: number): Promise<PullResult>;           // GET /sync/pull
  apply(change: Change): Promise<void>;                // apply to local state

  resolveConflicts(): Promise<void>;                   // surface merge UI if needed
  on(event: 'pushed' | 'pulled' | 'conflict', fn: (...args: any[]) => void): void;
}

export interface Entitlements { sync: boolean; inference: boolean; plan: 'free'|'pro'|'pro_plus'; }
```

## Rust (Tauri/Device or Library)
```rust
use async_trait::async_trait;

pub type JournalCursor = String;

#[derive(Clone, Debug)]
pub struct Change {
    pub id: String,
    pub kind: String,        // e.g., "note.create"
    pub payload: Vec<u8>,    // encrypted if E2EE enabled
    pub created_at: String,
}

#[derive(Clone, Debug)]
pub struct PushResult { pub applied: u32, pub cursor: JournalCursor }

#[derive(Clone, Debug)]
pub struct PullResult { pub cursor: JournalCursor, pub changes: Vec<Change> }

#[async_trait]
pub trait SyncAgent {
    async fn device_id(&self) -> anyhow::Result<String>;
    async fn cursor(&self) -> anyhow::Result<Option<JournalCursor>>;
    async fn set_cursor(&self, cursor: &JournalCursor) -> anyhow::Result<()>;

    async fn register_device(&self) -> anyhow::Result<String>;
    async fn enqueue(&self, change: Change) -> anyhow::Result<()>;
    async fn push(&self, batch_size: Option<usize>) -> anyhow::Result<PushResult>;
    async fn pull(&self, limit: Option<usize>) -> anyhow::Result<PullResult>;
    async fn apply(&self, change: Change) -> anyhow::Result<()>;
    async fn resolve_conflicts(&self) -> anyhow::Result<()>;
}
```

Notes
- All write requests include an idempotency key (`Change.id`).
- Cursors are per-account; stored locally per device alongside E2EE materials.
- Implement backoff/jitter on network errors; treat 409/412 as retriable with pull-then-push.

