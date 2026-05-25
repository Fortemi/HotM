import * as React from 'react';
import { Loader2, Plus, RefreshCw, Send, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { api } from '@/api';
import type { Webhook } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

const DEFAULT_EVENTS = 'note.created,note.updated,job.completed,job.failed';

function splitEvents(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function WebhooksPanel() {
  const [webhooks, setWebhooks] = React.useState<Webhook[]>([]);
  const [url, setUrl] = React.useState('');
  const [events, setEvents] = React.useState(DEFAULT_EVENTS);
  const [secret, setSecret] = React.useState('');
  const [maxRetries, setMaxRetries] = React.useState('3');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadWebhooks = React.useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      setWebhooks(await api.webhooks.list());
    } catch (err) {
      console.error('Failed to load webhooks:', err);
      setStatus({ type: 'error', message: 'Failed to load webhooks' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadWebhooks();
  }, [loadWebhooks]);

  const canCreate = url.trim().length > 0 && splitEvents(events).length > 0;

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || saving) return;

    setSaving(true);
    setStatus(null);
    try {
      const created = await api.webhooks.create({
        url: url.trim(),
        events: splitEvents(events),
        ...(secret.trim() && { secret: secret.trim() }),
        ...(maxRetries.trim() && { max_retries: Number(maxRetries) }),
      });
      setWebhooks((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setUrl('');
      setSecret('');
      setEvents(DEFAULT_EVENTS);
      setMaxRetries('3');
      setStatus({ type: 'success', message: 'Webhook created' });
    } catch (err) {
      console.error('Failed to create webhook:', err);
      setStatus({ type: 'error', message: 'Failed to create webhook' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (webhook: Webhook) => {
    if (pendingId) return;
    setPendingId(webhook.id);
    setStatus(null);
    try {
      await api.webhooks.delete(webhook.id);
      setWebhooks((prev) => prev.filter((item) => item.id !== webhook.id));
      setStatus({ type: 'success', message: 'Webhook deleted' });
    } catch (err) {
      console.error('Failed to delete webhook:', err);
      setStatus({ type: 'error', message: 'Failed to delete webhook' });
    } finally {
      setPendingId(null);
    }
  };

  const handleTest = async (webhook: Webhook) => {
    if (pendingId) return;
    setPendingId(webhook.id);
    setStatus(null);
    try {
      const delivery = await api.webhooks.test(webhook.id);
      setStatus({
        type: delivery.success ? 'success' : 'error',
        message: delivery.success ? 'Test delivery succeeded' : 'Test delivery failed',
      });
    } catch (err) {
      console.error('Failed to test webhook:', err);
      setStatus({ type: 'error', message: 'Failed to send test event' });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WebhookIcon className="size-5" />
            Webhooks
          </CardTitle>
          <CardDescription>Register outbound event callbacks for integrations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {loading ? 'Loading webhooks...' : webhooks.length + ' webhooks'}
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadWebhooks()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
              Refresh
            </Button>
          </div>

          {status && (
            <div
              role="status"
              className={status.type === 'success' ? 'rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-300' : 'rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300'}
            >
              {status.message}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading webhooks...
            </div>
          ) : webhooks.length === 0 ? (
            <div className="rounded border p-4 text-sm text-muted-foreground">No webhooks registered.</div>
          ) : (
            <div className="grid gap-3">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="rounded border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-medium">{webhook.url}</div>
                        <Badge variant={webhook.is_active ? 'secondary' : 'outline'}>{webhook.is_active ? 'active' : 'inactive'}</Badge>
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">{webhook.id}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2" disabled={pendingId === webhook.id} onClick={() => void handleTest(webhook)}>
                        {pendingId === webhook.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        Test
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" disabled={pendingId === webhook.id} onClick={() => void handleDelete(webhook)}>
                        {pendingId === webhook.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        Delete
                      </Button>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Events</div>
                      <div>{webhook.events.join(', ')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Failures</div>
                      <div>{webhook.failure_count} / {webhook.max_retries}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Last triggered</div>
                      <div>{webhook.last_triggered_at ? new Date(webhook.last_triggered_at).toLocaleString() : 'never'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" />
            Register Webhook
          </CardTitle>
          <CardDescription>Use HTTPS endpoints and rotate secrets when integrations change owners.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleCreate}>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="webhook-url">URL</label>
              <Input id="webhook-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/hotm-webhook" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="webhook-events">Events</label>
              <Input id="webhook-events" value={events} onChange={(event) => setEvents(event.target.value)} placeholder={DEFAULT_EVENTS} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="webhook-secret">Secret</label>
              <Input id="webhook-secret" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="optional signing secret" type="password" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="webhook-retries">Max retries</label>
              <Input id="webhook-retries" value={maxRetries} onChange={(event) => setMaxRetries(event.target.value)} inputMode="numeric" />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={!canCreate || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Register Webhook
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
