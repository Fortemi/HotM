import * as React from 'react';
import { Loader2, Plus, RefreshCw, Send, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { api } from '@/api';
import type { InboundSource, IncomingWebhookReceiver, Webhook } from '@/api';
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
  const [incomingReceivers, setIncomingReceivers] = React.useState<IncomingWebhookReceiver[]>([]);
  const [inboundSources, setInboundSources] = React.useState<InboundSource[]>([]);
  const [url, setUrl] = React.useState('');
  const [events, setEvents] = React.useState(DEFAULT_EVENTS);
  const [secret, setSecret] = React.useState('');
  const [maxRetries, setMaxRetries] = React.useState('3');
  const [incomingSlug, setIncomingSlug] = React.useState('');
  const [incomingProvider, setIncomingProvider] = React.useState('');
  const [incomingSchemaRef, setIncomingSchemaRef] = React.useState('');
  const [incomingSecret, setIncomingSecret] = React.useState('');
  const [incomingSignatureHeader, setIncomingSignatureHeader] = React.useState('X-Fortemi-Signature');
  const [validationSchemaRef, setValidationSchemaRef] = React.useState('');
  const [inboundName, setInboundName] = React.useState('');
  const [inboundKind, setInboundKind] = React.useState('sse');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadWebhooks = React.useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const [outbound, incoming, inbound] = await Promise.all([
        api.webhooks.list(),
        api.webhooks.listIncomingReceivers(),
        api.webhooks.listInboundSources(),
      ]);
      setWebhooks(outbound);
      setIncomingReceivers(incoming);
      setInboundSources(inbound);
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
  const canCreateIncoming =
    incomingSlug.trim().length > 0 &&
    incomingProvider.trim().length > 0 &&
    incomingSchemaRef.trim().length > 0 &&
    incomingSecret.trim().length > 0;
  const canCreateInbound = inboundName.trim().length > 0 && inboundKind.trim().length > 0;

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

  const handleCreateIncoming = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateIncoming || saving) return;

    setSaving(true);
    setStatus(null);
    try {
      const created = await api.webhooks.createIncomingReceiver({
        slug: incomingSlug.trim(),
        provider: incomingProvider.trim(),
        schema_ref: incomingSchemaRef.trim(),
        hmac_secret: incomingSecret.trim(),
        ...(incomingSignatureHeader.trim() && { signature_header: incomingSignatureHeader.trim() }),
        is_active: true,
      });
      setIncomingReceivers((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setIncomingSlug('');
      setIncomingProvider('');
      setIncomingSchemaRef('');
      setIncomingSecret('');
      setIncomingSignatureHeader('X-Fortemi-Signature');
      setStatus({ type: 'success', message: 'Incoming receiver created; secret cleared' });
    } catch (err) {
      console.error('Failed to create incoming receiver:', err);
      setStatus({ type: 'error', message: 'Failed to create incoming receiver' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIncoming = async () => {
    if (!incomingSlug.trim() || pendingId) return;
    const slug = incomingSlug.trim();
    setPendingId('incoming:' + slug);
    setStatus(null);
    try {
      await api.webhooks.deleteIncomingReceiver(slug);
      await loadWebhooks();
      setIncomingSlug('');
      setStatus({ type: 'success', message: 'Incoming receiver deleted' });
    } catch (err) {
      console.error('Failed to delete incoming receiver:', err);
      setStatus({ type: 'error', message: 'Failed to delete incoming receiver' });
    } finally {
      setPendingId(null);
    }
  };

  const handleValidateIncoming = async () => {
    if (!validationSchemaRef.trim() || pendingId) return;
    const schemaRef = validationSchemaRef.trim();
    setPendingId('validate:' + schemaRef);
    setStatus(null);
    try {
      const result = await api.webhooks.validateIncomingPayload(schemaRef, {});
      setStatus({
        type: result.valid ? 'success' : 'error',
        message: result.valid ? 'Incoming payload schema accepted' : `Incoming payload invalid (${result.errors.length} errors)`,
      });
    } catch (err) {
      console.error('Failed to validate incoming payload:', err);
      setStatus({ type: 'error', message: 'Failed to validate incoming payload' });
    } finally {
      setPendingId(null);
    }
  };

  const handleCreateInbound = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateInbound || saving) return;

    setSaving(true);
    setStatus(null);
    try {
      await api.webhooks.createInboundSource({
        name: inboundName.trim(),
        kind: inboundKind.trim(),
        enabled: false,
      });
      await loadWebhooks();
      setInboundName('');
      setInboundKind('sse');
      setStatus({ type: 'success', message: 'Inbound source registered disabled' });
    } catch (err) {
      console.error('Failed to register inbound source:', err);
      setStatus({ type: 'error', message: 'Failed to register inbound source' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInbound = async () => {
    if (!inboundName.trim() || pendingId) return;
    const name = inboundName.trim();
    setPendingId('inbound:' + name);
    setStatus(null);
    try {
      await api.webhooks.deleteInboundSource(name);
      await loadWebhooks();
      setInboundName('');
      setStatus({ type: 'success', message: 'Inbound source deleted' });
    } catch (err) {
      console.error('Failed to delete inbound source:', err);
      setStatus({ type: 'error', message: 'Failed to delete inbound source' });
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

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WebhookIcon className="size-5" />
            Incoming Receivers
          </CardTitle>
          <CardDescription>Inbound webhook receiver metadata. Raw slugs, providers, schema documents, and HMAC secrets are not rendered after submission.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {loading ? 'Loading incoming receivers...' : incomingReceivers.length + ' incoming receivers'}
            </div>
            {incomingReceivers.length === 0 ? (
              <div className="rounded border p-4 text-sm text-muted-foreground">No incoming receivers registered.</div>
            ) : (
              <div className="grid gap-3">
                {incomingReceivers.map((receiver) => (
                  <div key={receiver.id} className="rounded border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">{receiver.id}</div>
                        <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                          <div>Slug length: {receiver.slug_len}</div>
                          <div>Provider length: {receiver.provider_len}</div>
                          <div>Schema ref length: {receiver.schema_ref_len}</div>
                          <div>Signature: {receiver.signature_header_class}</div>
                          <div>Schema doc: {receiver.schema_doc_class ?? 'none'}</div>
                          <div>Schema doc length: {receiver.schema_doc_len ?? 0}</div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Badge variant={receiver.is_active ? 'secondary' : 'outline'}>{receiver.is_active ? 'active' : 'inactive'}</Badge>
                        <Badge variant={receiver.secret_set ? 'outline' : 'destructive'}>{receiver.secret_set ? 'secret set' : 'secret missing'}</Badge>
                        {receiver.schema_doc_secret_candidate && <Badge variant="outline">schema sensitive</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form className="space-y-3" onSubmit={handleCreateIncoming}>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="incoming-slug">Receiver slug</label>
              <Input id="incoming-slug" value={incomingSlug} onChange={(event) => setIncomingSlug(event.target.value)} placeholder="customer-created" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="incoming-provider">Provider</label>
              <Input id="incoming-provider" value={incomingProvider} onChange={(event) => setIncomingProvider(event.target.value)} placeholder="generic" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="incoming-schema-ref">Schema ref</label>
              <Input id="incoming-schema-ref" value={incomingSchemaRef} onChange={(event) => setIncomingSchemaRef(event.target.value)} placeholder="generic.event.v1" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="incoming-signature-header">Signature header</label>
              <Input id="incoming-signature-header" value={incomingSignatureHeader} onChange={(event) => setIncomingSignatureHeader(event.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="incoming-secret">HMAC secret</label>
              <Input id="incoming-secret" value={incomingSecret} onChange={(event) => setIncomingSecret(event.target.value)} type="password" placeholder="copy-once secret" />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={!canCreateIncoming || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Register Incoming Receiver
            </Button>
            <Button type="button" className="w-full gap-2" variant="outline" disabled={!incomingSlug.trim() || !!pendingId} onClick={() => void handleDeleteIncoming()}>
              {pendingId?.startsWith('incoming:') ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete Receiver By Slug
            </Button>
            <Separator />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="incoming-validation-schema">Validation schema ref</label>
              <Input id="incoming-validation-schema" value={validationSchemaRef} onChange={(event) => setValidationSchemaRef(event.target.value)} placeholder="generic.event.v1" />
            </div>
            <Button type="button" className="w-full gap-2" variant="outline" disabled={!validationSchemaRef.trim() || !!pendingId} onClick={() => void handleValidateIncoming()}>
              {pendingId?.startsWith('validate:') ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Validate Empty Payload
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WebhookIcon className="size-5" />
            Inbound Sources
          </CardTitle>
          <CardDescription>Connector metadata only. Raw names, kinds, URLs, headers, and connector config are not rendered.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {loading ? 'Loading inbound sources...' : inboundSources.length + ' inbound sources'}
            </div>
            {inboundSources.length === 0 ? (
              <div className="rounded border p-4 text-sm text-muted-foreground">No inbound sources registered.</div>
            ) : (
              <div className="grid gap-3">
                {inboundSources.map((source) => (
                  <div key={source.id} className="rounded border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">{source.id}</div>
                        <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                          <div>Name length: {source.name_len}</div>
                          <div>Kind length: {source.kind_len}</div>
                          <div>Config class: {source.config_class}</div>
                          <div>Config length: {source.config_len}</div>
                          <div>Config keys: {source.config_key_count ?? 0}</div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Badge variant={source.enabled ? 'secondary' : 'outline'}>{source.enabled ? 'enabled' : 'disabled'}</Badge>
                        {source.config_secret_candidate && <Badge variant="outline">config sensitive</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form className="space-y-3" onSubmit={handleCreateInbound}>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="inbound-name">Source name</label>
              <Input id="inbound-name" value={inboundName} onChange={(event) => setInboundName(event.target.value)} placeholder="redis-events" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="inbound-kind">Kind</label>
              <Input id="inbound-kind" value={inboundKind} onChange={(event) => setInboundKind(event.target.value)} placeholder="sse" />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={!canCreateInbound || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Register Disabled Source
            </Button>
            <Button type="button" className="w-full gap-2" variant="outline" disabled={!inboundName.trim() || !!pendingId} onClick={() => void handleDeleteInbound()}>
              {pendingId?.startsWith('inbound:') ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete Source By Name
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
