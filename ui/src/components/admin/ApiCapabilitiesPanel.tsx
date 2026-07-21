import * as React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, Loader2, Lock, Package, RefreshCw, Server } from 'lucide-react';
import { api } from '@/api';
import type { CallDetailResponse, StreamingHealthResponse, SystemCompatibilityResponse } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type CapabilityValue = boolean | string | number | null | Record<string, unknown>;

interface ApiSurfaceHealth {
  status?: string;
  version?: string;
  git_sha?: string;
  build_date?: string;
  database?: string;
  ollama?: string;
  job_processing?: string;
  capabilities?: Record<string, CapabilityValue>;
  sse?: {
    active_connections?: number;
    connections_total?: number;
    events_delivered?: number;
    events_emitted?: number;
  };
}

const UI_FEATURES = [
  { label: 'Explicit titles', detail: 'Create note skips title generation when a title is supplied' },
  { label: 'Revision modes', detail: 'None, light, standard, contextual, and filtered contextual capture' },
  { label: 'Processing toggles', detail: 'Title, concepts, embeddings, links, and media extraction controls' },
  { label: 'Deferred import', detail: 'Backup import can defer inference until reprocess is queued' },
  { label: 'Bulk reprocess', detail: 'All-note or bounded reprocessing can be queued from backup workflows' },
  { label: 'Document types', detail: 'Admin can list, create, and delete custom document types' },
  { label: 'Webhooks', detail: 'Admin can list, register, test, and delete outbound event hooks' },
] as const;

const ENTERPRISE_SURFACES = [
  {
    key: 'hosted_auth',
    label: 'Hosted Auth',
    detail: 'Sign-in and tenant context for hosted workflows',
  },
  {
    key: 'realtime_activity',
    label: 'Realtime Activity',
    detail: 'Connection, job, sync, and admin event visibility',
  },
  {
    key: 'premium_components',
    label: 'Premium Components',
    detail: 'Premium catalog state and entitlement-safe previews',
  },
  {
    key: 'backoffice_api',
    label: 'Backoffice Console',
    detail: 'Tenant health, support, and operator tooling',
  },
  {
    key: 'audit_posture',
    label: 'Audit Posture',
    detail: 'Coarse audit pipeline readiness for admin review',
  },
  {
    key: 'quota_status',
    label: 'Quota Status',
    detail: 'Tenant quota and usage posture',
  },
  {
    key: 'kms_status',
    label: 'KMS Status',
    detail: 'Key-provider readiness without exposing key material',
  },
  {
    key: 'mcp_scope_gate',
    label: 'MCP Scope Gate',
    detail: 'Scope and tool-gate readiness for enterprise agents',
  },
] as const;

function toTitle(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const normalized = status?.toLowerCase();
  if (!normalized) return 'outline';
  if (['healthy', 'ok', 'operational', 'running', 'connected', 'available'].includes(normalized)) return 'default';
  if (['degraded', 'preview', 'unavailable', 'unknown'].includes(normalized)) return 'outline';
  if (['unhealthy', 'offline', 'failed', 'disconnected', 'shutdown'].includes(normalized)) return 'destructive';
  return 'secondary';
}

function capabilityState(value: CapabilityValue): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; detail?: string } {
  if (typeof value === 'boolean') {
    return value
      ? { label: 'available', variant: 'default' }
      : { label: 'unavailable', variant: 'outline' };
  }

  if (value && typeof value === 'object') {
    const available = value.available;
    const configured = value.configured;
    const enabled = value.enabled;
    const status = typeof value.status === 'string' ? value.status : undefined;
    const contractState = typeof value.state === 'string' ? value.state : undefined;
    const isUnavailable = available === false || configured === false || enabled === false || contractState === 'unavailable';
    const label = contractState ?? status ?? (isUnavailable ? 'degraded' : 'available');
    const detail = Object.entries(value)
      .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))
      .map(([key, item]) => key + ': ' + String(item))
      .join(', ');

    return {
      label,
      variant: isUnavailable ? 'outline' : statusVariant(label),
      detail: detail || undefined,
    };
  }

  if (value == null) return { label: 'unknown', variant: 'outline' };
  return { label: String(value), variant: statusVariant(String(value)) };
}

function isDegraded(health: ApiSurfaceHealth | null, compatibility: SystemCompatibilityResponse | null): boolean {
  if (compatibility) {
    return Object.values(compatibility.capabilities).some((value) => value.state !== 'available');
  }

  if (!health) return false;
  const status = health.status?.toLowerCase();
  if (status === 'degraded') return true;
  if (health.ollama?.toLowerCase() === 'unavailable') return true;

  const capabilities = health.capabilities ?? {};
  return Object.values(capabilities).some((value) => {
    if (!value || typeof value !== 'object') return value === false;
    return value.available === false || value.configured === false || value.enabled === false;
  });
}

function enterpriseSurfaceState(
  compatibility: SystemCompatibilityResponse | null,
  key: string
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; reason: string; productionEnabled: boolean } {
  if (!compatibility) {
    return {
      label: 'unknown',
      variant: 'outline',
      reason: 'compatibility_discovery_unavailable',
      productionEnabled: false,
    };
  }

  const capability = compatibility.capabilities[key];
  if (!capability) {
    return {
      label: 'unknown',
      variant: 'outline',
      reason: 'capability_not_advertised',
      productionEnabled: false,
    };
  }

  return {
    label: capability.state,
    variant: statusVariant(capability.state),
    reason: capability.reason_code ?? (capability.state === 'available' ? 'ready' : 'no_reason_code'),
    productionEnabled: capability.state === 'available',
  };
}

function hostedAuthPreviewRows(compatibility: SystemCompatibilityResponse | null) {
  const unknown = {
    state: 'unknown',
    variant: 'outline' as const,
    reason: 'compatibility_discovery_unavailable',
  };

  if (!compatibility) {
    return [
      { label: 'Local Mode', detail: 'Local workflows stay available while hosted auth is unknown.', ...unknown },
      { label: 'Sign-In Path', detail: 'Hosted sign-in is hidden until compatibility metadata is available.', ...unknown },
      { label: 'Tenant Context', detail: 'Tenant context is not assumed without an advertised session contract.', ...unknown },
      { label: 'Admin Authorization', detail: 'Admin surfaces stay disabled without role or scope evidence.', ...unknown },
      { label: 'Auth Failure Handling', detail: 'Failures use fixed categories when hosted auth reports an error.', ...unknown },
    ];
  }

  const hostedAuth = enterpriseSurfaceState(compatibility, 'hosted_auth');
  const mode = compatibility.auth.mode.toLowerCase();
  const localMode = compatibility.deployment.mode === 'local_sidecar' || mode.includes('anonymous_local');
  const authFailure = mode.includes('fail') || mode.includes('error');
  const insufficientRole = mode.includes('insufficient') || mode.includes('forbidden') || mode.includes('missing_scope');
  const tenantContext = compatibility.auth.tenant_context_available;
  const hostedAdvertised = hostedAuth.label === 'available' || hostedAuth.label === 'preview';

  return [
    {
      label: 'Local Mode',
      detail: localMode
        ? 'Local/private workflows remain available; hosted controls stay gated.'
        : 'Hosted endpoint selected; local-mode fallback is not the active auth posture.',
      state: localMode ? 'available' : 'unavailable',
      variant: localMode ? 'default' as const : 'outline' as const,
      reason: localMode ? 'anonymous_local_mode' : 'hosted_mode_selected',
    },
    {
      label: 'Sign-In Path',
      detail: hostedAdvertised
        ? 'Hosted sign-in can be shown without rendering tokens or provider diagnostics.'
        : 'Hosted sign-in remains disabled until Fortemi advertises hosted auth.',
      state: hostedAdvertised && !authFailure ? 'preview' : 'unavailable',
      variant: hostedAdvertised && !authFailure ? 'secondary' as const : 'outline' as const,
      reason: authFailure ? 'auth_failure' : hostedAuth.reason,
    },
    {
      label: 'Tenant Context',
      detail: tenantContext
        ? 'Tenant context is present for preview surfaces.'
        : 'Tenant context is absent; enterprise panels stay disabled or local-only.',
      state: tenantContext ? 'available' : 'unavailable',
      variant: tenantContext ? 'default' as const : 'outline' as const,
      reason: tenantContext ? 'tenant_context_available' : 'tenant_context_absent',
    },
    {
      label: 'Admin Authorization',
      detail: insufficientRole
        ? 'Session is valid but lacks the admin role or scope required for enterprise controls.'
        : 'Admin scope is treated as preview-only until the hosted auth contract exposes role evidence.',
      state: insufficientRole ? 'unavailable' : tenantContext && hostedAdvertised ? 'preview' : 'unavailable',
      variant: insufficientRole ? 'outline' as const : tenantContext && hostedAdvertised ? 'secondary' as const : 'outline' as const,
      reason: insufficientRole ? 'insufficient_role_or_scope' : tenantContext && hostedAdvertised ? 'scope_contract_pending' : 'admin_scope_unverified',
    },
    {
      label: 'Auth Failure Handling',
      detail: authFailure
        ? 'A fixed auth failure category is visible; raw provider diagnostics remain hidden.'
        : 'Failure copy is ready for hosted auth errors without exposing raw provider output.',
      state: authFailure ? 'unavailable' : 'preview',
      variant: authFailure ? 'outline' as const : 'secondary' as const,
      reason: authFailure ? 'fixed_error_category' : 'no_auth_failure_reported',
    },
  ];
}

type CatalogStatus = 'available' | 'degraded' | 'unavailable' | 'license required' | 'admin required' | 'preview only' | 'unknown';
type BackofficePanelStatus = 'enabled' | 'disabled' | 'degraded' | 'preview-only' | 'unavailable' | 'unknown';

function catalogVariant(status: CatalogStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'available') return 'default';
  if (status === 'preview only') return 'secondary';
  return 'outline';
}

function catalogStatusFromCapability(
  compatibility: SystemCompatibilityResponse | null,
  key: string
): CatalogStatus {
  if (!compatibility) return 'unknown';

  const capability = compatibility.capabilities[key];
  if (!capability) return 'unknown';
  if (capability.state === 'available') return 'available';
  if (capability.state === 'degraded') return 'degraded';
  if (capability.state === 'preview') return 'preview only';
  if (capability.state === 'unavailable') return 'unavailable';
  return 'unknown';
}

function premiumCatalogRows(compatibility: SystemCompatibilityResponse | null) {
  const premiumStatus = catalogStatusFromCapability(compatibility, 'premium_components');
  const hostedAuthStatus = catalogStatusFromCapability(compatibility, 'hosted_auth');
  const backofficeStatus = catalogStatusFromCapability(compatibility, 'backoffice_api');
  const kmsStatus = catalogStatusFromCapability(compatibility, 'kms_status');
  const mcpStatus = catalogStatusFromCapability(compatibility, 'mcp_scope_gate');
  const tenantContext = compatibility?.auth.tenant_context_available === true;
  const enterpriseEdition = compatibility?.deployment.edition === 'enterprise';

  return [
    {
      name: 'Premium Components',
      status: premiumStatus,
      description: 'Catalog shell for licensed enterprise UI modules.',
      role: 'Tenant admin',
      dependency: 'premium_components capability',
      actionEnabled: premiumStatus === 'available' && tenantContext,
      reason: premiumStatus === 'available' && tenantContext ? 'preview_details_available' : 'component_gate_not_satisfied',
    },
    {
      name: 'Licensed Server Components',
      status: enterpriseEdition && premiumStatus === 'available' ? 'available' as CatalogStatus : 'license required' as CatalogStatus,
      description: 'Coarse licensed-server readiness without exposing license material.',
      role: 'Operator',
      dependency: 'Fortemi/licensing#1',
      actionEnabled: false,
      reason: enterpriseEdition && premiumStatus === 'available' ? 'license_review_pending' : 'license_required',
    },
    {
      name: 'Backoffice Widgets',
      status: backofficeStatus,
      description: 'Tenant health, quota, audit, KMS, and support preview widgets.',
      role: 'Tenant admin',
      dependency: 'Fortemi/fortemi#1020',
      actionEnabled: false,
      reason: backofficeStatus === 'available' ? 'production_action_still_gated' : 'backoffice_contract_pending',
    },
    {
      name: 'Enterprise MCP Tools',
      status: mcpStatus === 'available' && tenantContext ? 'admin required' as CatalogStatus : mcpStatus,
      description: 'Scope-gated tool access shown as preview metadata only.',
      role: 'Tenant admin',
      dependency: 'mcp_scope_gate capability',
      actionEnabled: false,
      reason: mcpStatus === 'available' && tenantContext ? 'admin_scope_contract_pending' : 'mcp_scope_gate_not_satisfied',
    },
    {
      name: 'Hosted Auth Components',
      status: hostedAuthStatus,
      description: 'Hosted identity, tenant context, and role-gated surface wiring.',
      role: 'Tenant admin',
      dependency: 'Fortemi/fortemi-auth#25',
      actionEnabled: false,
      reason: hostedAuthStatus === 'available' ? 'session_contract_pending' : 'hosted_auth_not_ready',
    },
    {
      name: 'KMS Integrations',
      status: kmsStatus,
      description: 'Key-provider readiness displayed as coarse status only.',
      role: 'Operator',
      dependency: 'Fortemi/fortemi#1019',
      actionEnabled: false,
      reason: kmsStatus === 'available' ? 'key_material_hidden' : 'kms_gate_not_satisfied',
    },
  ];
}

function backofficeVariant(status: BackofficePanelStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'enabled') return 'default';
  if (status === 'preview-only') return 'secondary';
  if (status === 'degraded') return 'outline';
  return 'outline';
}

function panelStatusFromCapability(
  compatibility: SystemCompatibilityResponse | null,
  key: string
): BackofficePanelStatus {
  if (!compatibility) return 'unavailable';

  const capability = compatibility.capabilities[key];
  if (!capability) return 'unknown';
  if (capability.state === 'available') return 'enabled';
  if (capability.state === 'degraded') return 'degraded';
  if (capability.state === 'preview') return 'preview-only';
  if (capability.state === 'unavailable') return 'unavailable';
  return 'unknown';
}

function backofficePanelRows(
  compatibility: SystemCompatibilityResponse | null,
  health: ApiSurfaceHealth | null,
  degraded: boolean
) {
  const backofficeStatus = panelStatusFromCapability(compatibility, 'backoffice_api');
  const auditStatus = panelStatusFromCapability(compatibility, 'audit_posture');
  const quotaStatus = panelStatusFromCapability(compatibility, 'quota_status');
  const kmsStatus = panelStatusFromCapability(compatibility, 'kms_status');
  const supportStatus = panelStatusFromCapability(compatibility, 'support_diagnostics');
  const tenantContext = compatibility?.auth.tenant_context_available === true;
  const insufficientRole = compatibility?.auth.mode.toLowerCase().includes('insufficient') === true;
  const hostedProductionBlocked = compatibility ? !compatibility.deployment.hosted_multi_tenant_ready : true;

  const tenantHealthStatus: BackofficePanelStatus = !compatibility
    ? 'unavailable'
    : insufficientRole
      ? 'disabled'
      : backofficeStatus === 'enabled' && tenantContext
        ? 'enabled'
        : backofficeStatus;

  return [
    {
      name: 'Tenant Health',
      status: tenantHealthStatus,
      preview: compatibility
        ? `${toTitle(compatibility.deployment.mode)} / ${toTitle(compatibility.deployment.edition)}; ${compatibilityStatusLabel(degraded)}`
        : 'Compatibility discovery unavailable; local workflows remain separate.',
      dependency: 'Fortemi/fortemi#1018, Fortemi/fortemi#1020',
      action: 'Production action disabled',
      reason: hostedProductionBlocked ? 'hosted_production_blocked_rls_gate' : 'read_only_preview',
    },
    {
      name: 'Audit Posture',
      status: auditStatus === 'preview-only' ? 'degraded' as BackofficePanelStatus : auditStatus,
      preview: 'Audit availability, redaction status, and event-count class only.',
      dependency: 'Fortemi/fortemi#1020, enterprise audit sinks',
      action: 'Production action disabled',
      reason: auditStatus === 'enabled' ? 'audit_contract_pending' : 'audit_sink_gate_not_satisfied',
    },
    {
      name: 'Quota Status',
      status: quotaStatus,
      preview: 'Coarse quota posture only: ok, warning, exceeded, or unknown.',
      dependency: 'Fortemi/fortemi#1020',
      action: 'Production action disabled',
      reason: quotaStatus === 'enabled' ? 'quota_action_requires_fixture' : 'quota_contract_pending',
    },
    {
      name: 'KMS Status',
      status: kmsStatus,
      preview: 'Key-provider readiness without key IDs, fingerprints, or provider resource names.',
      dependency: 'Fortemi/fortemi#1019, Fortemi-Enterprise/kms#2',
      action: 'Production action disabled',
      reason: kmsStatus === 'enabled' ? 'key_material_hidden' : 'kms_gate_not_satisfied',
    },
    {
      name: 'Support Diagnostics',
      status: insufficientRole ? 'disabled' as BackofficePanelStatus : supportStatus,
      preview: health?.sse
        ? `Safe categories only; ${health.sse.events_delivered ?? 0} realtime events delivered.`
        : 'Safe diagnostic categories only; support bundles unavailable.',
      dependency: 'Fortemi/fortemi#1020 and audit gate',
      action: 'Export disabled',
      reason: supportStatus === 'enabled' && !insufficientRole ? 'support_export_requires_audit_gate' : 'support_contract_pending',
    },
  ];
}

function compatibilityStatusLabel(degraded: boolean): string {
  return degraded ? 'capability attention required' : 'compatible metadata available';
}

function metricValue(
  block: StreamingHealthResponse[keyof Pick<StreamingHealthResponse, 'sse' | 'rtp' | 'chat' | 'ingest' | 'inbound'>] | undefined,
  key: string
): string {
  const value = block?.metrics[key]?.value;
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return '--';
}

function streamingBlockVariant(state?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (state === 'reported') return 'default';
  if (state === 'malformed') return 'destructive';
  return 'outline';
}

function streamingHealthRows(streamingHealth: StreamingHealthResponse | null) {
  return [
    {
      name: 'Chat Stream',
      block: streamingHealth?.chat,
      summary: `${metricValue(streamingHealth?.chat, 'chat_stream_started_total')} started, ${metricValue(streamingHealth?.chat, 'chat_stream_completed_total')} completed, ${metricValue(streamingHealth?.chat, 'chat_stream_errored_total')} errored`,
      detail: `${metricValue(streamingHealth?.chat, 'chat_stream_dropped_tokens_total')} dropped tokens`,
    },
    {
      name: 'Ingest Stream',
      block: streamingHealth?.ingest,
      summary: `${metricValue(streamingHealth?.ingest, 'ingest_stream_buffer_pressure')} pressure, ${metricValue(streamingHealth?.ingest, 'ingest_stream_buffer_pressure_peak')} peak`,
      detail: `${metricValue(streamingHealth?.ingest, 'ingest_stream_backpressure_warnings_total')} warnings, ${metricValue(streamingHealth?.ingest, 'ingest_stream_throttled_total')} throttled, ${metricValue(streamingHealth?.ingest, 'ingest_stream_rate_limited_total')} rate limited`,
    },
    {
      name: 'Realtime Events',
      block: streamingHealth?.sse,
      summary: `${metricValue(streamingHealth?.sse, 'active_connections')} active, ${metricValue(streamingHealth?.sse, 'events_delivered')} delivered`,
      detail: `${metricValue(streamingHealth?.sse, 'events_lagged')} lagged, ${metricValue(streamingHealth?.sse, 'events_emitted')} emitted`,
    },
    {
      name: 'Inbound Connectors',
      block: streamingHealth?.inbound,
      summary: `${metricValue(streamingHealth?.inbound, 'connectors')} connectors, ${metricValue(streamingHealth?.inbound, 'events_total')} events`,
      detail: `${metricValue(streamingHealth?.inbound, 'errors_total')} errors, ${metricValue(streamingHealth?.inbound, 'lag_max')} max lag`,
    },
    {
      name: 'Realtime Calls',
      block: streamingHealth?.rtp,
      summary: `${metricValue(streamingHealth?.rtp, 'active_sessions')} active, ${metricValue(streamingHealth?.rtp, 'sessions_total')} total`,
      detail: `${metricValue(streamingHealth?.rtp, 'asr_cost_per_minute')} ASR cost/min, ${metricValue(streamingHealth?.rtp, 'transcript_events_total')} transcript events`,
    },
  ];
}

function formatOptionalNumber(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toLocaleString() : 'unknown';
}

function formatOptionalDate(value: string | null | undefined): string {
  if (!value) return 'unknown';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'reported' : parsed.toLocaleString();
}

interface CallDiagnosticsProps {
  callDetail: CallDetailResponse | null;
  callError: string | null;
  callId: string;
  callLoading: boolean;
  onCallIdChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

function CallDiagnosticsPanel({
  callDetail,
  callError,
  callId,
  callLoading,
  onCallIdChange,
  onSubmit,
}: CallDiagnosticsProps) {
  const providerRef = callDetail?.provider_call ?? {};
  const segmentPreview = callDetail?.segments.slice(0, 3) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-5" />
          Call Diagnostics
        </CardTitle>
        <CardDescription>Redacted call-session lookup for Fortemi REST diagnostics.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label htmlFor="call-diagnostic-id" className="text-xs font-medium text-muted-foreground">
              Call ID
            </label>
            <Input
              id="call-diagnostic-id"
              value={callId}
              onChange={(event) => onCallIdChange(event.target.value)}
              placeholder="Fortemi call UUID"
            />
          </div>
          <Button type="submit" className="self-end" disabled={callLoading}>
            {callLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Load call
          </Button>
        </form>

        {callError && (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            {callError}
          </div>
        )}

        <div className="rounded border p-3 text-sm text-muted-foreground">
          Twilio realtime WebSocket diagnostics are not exposed in HotM. Live provider stream validation remains a documented exclusion.
        </div>

        {callDetail ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Session</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Provider: {callDetail.provider}; duration {formatOptionalNumber(callDetail.duration_secs)} seconds
                  </p>
                </div>
                <Badge variant={statusVariant(callDetail.ended_at ? 'available' : 'preview')}>
                  {callDetail.ended_at ? 'ended' : 'active'}
                </Badge>
              </div>
              <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                <div>Started: {formatOptionalDate(callDetail.started_at)}</div>
                <div>Ended: {formatOptionalDate(callDetail.ended_at)}</div>
                <div>End reason: {callDetail.end_reason ?? 'unknown'}</div>
              </div>
            </div>

            <div className="rounded border p-3">
              <div className="text-sm font-medium">Redaction Summary</div>
              <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                <div>Provider call ID present: {providerRef.provider_call_id_present ? 'yes' : 'no'}</div>
                <div>Provider call ID length: {formatOptionalNumber(providerRef.provider_call_id_len)}</div>
                <div>Remote party present: {callDetail.remote_party_present ? 'yes' : 'no'}</div>
                <div>Remote party length: {formatOptionalNumber(callDetail.remote_party_len)}</div>
                <div>ASR backend length: {formatOptionalNumber(callDetail.asr_backend_len)}</div>
                <div>Archive reference present: {callDetail.archive_id ? 'yes' : 'no'}</div>
                <div>Metadata: {callDetail.metadata_class}, {callDetail.metadata_len.toLocaleString()} bytes</div>
              </div>
            </div>

            <div className="rounded border p-3 md:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Transcript Summary</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {callDetail.segment_count.toLocaleString()} segments; page {callDetail.pagination.offset.toLocaleString()} offset, {callDetail.pagination.limit.toLocaleString()} limit, {callDetail.pagination.total.toLocaleString()} total
                  </p>
                </div>
                <Badge variant="outline">{callDetail.pagination.has_more ? 'has more' : 'complete page'}</Badge>
              </div>
              {segmentPreview.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {segmentPreview.map((segment) => (
                    <div key={segment.id} className="rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
                      Segment {segment.sequence + 1}: {formatOptionalNumber(segment.start_ts)}s-{formatOptionalNumber(segment.end_ts)}s; text length {segment.text.length.toLocaleString()}; confidence {formatOptionalNumber(segment.confidence)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-muted-foreground">No transcript segments returned for this page.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
            Enter a Fortemi call ID to inspect safe call metadata and transcript counts.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ApiCapabilitiesPanel() {
  const [health, setHealth] = React.useState<ApiSurfaceHealth | null>(null);
  const [streamingHealth, setStreamingHealth] = React.useState<StreamingHealthResponse | null>(null);
  const [compatibility, setCompatibility] = React.useState<SystemCompatibilityResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [callId, setCallId] = React.useState('');
  const [callDetail, setCallDetail] = React.useState<CallDetailResponse | null>(null);
  const [callLoading, setCallLoading] = React.useState(false);
  const [callError, setCallError] = React.useState<string | null>(null);

  const loadHealth = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setCompatibility(null);
    setStreamingHealth(null);
    try {
      const [compatibilityResult, healthResult, streamingHealthResult] = await Promise.allSettled([
        api.systemCompatibility.get(),
        api.healthCheck() as Promise<ApiSurfaceHealth>,
        api.health.getStreamingHealth(),
      ]);

      if (compatibilityResult.status === 'fulfilled') {
        setCompatibility(compatibilityResult.value);
      }

      if (healthResult.status === 'fulfilled') {
        setHealth(healthResult.value);
      } else if (compatibilityResult.status === 'fulfilled') {
        setHealth(null);
      } else {
        throw healthResult.reason;
      }

      if (streamingHealthResult.status === 'fulfilled') {
        setStreamingHealth(streamingHealthResult.value);
      }
    } catch (err) {
      console.error('Failed to load API surface:', err);
      setError('Error loading API surface');
      setHealth(null);
      setCompatibility(null);
      setStreamingHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const loadCallDetail = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = callId.trim();
    setCallError(null);
    if (!trimmed) {
      setCallDetail(null);
      setCallError('Call ID is required.');
      return;
    }

    setCallLoading(true);
    try {
      const detail = await api.calls.getCall(trimmed, { limit: 50, offset: 0 });
      setCallDetail(detail);
    } catch (err) {
      console.error('Failed to load call diagnostics:', err);
      setCallDetail(null);
      setCallError('Call diagnostic fetch failed. Check the call ID and server diagnostics.');
    } finally {
      setCallLoading(false);
    }
  }, [callId]);

  const capabilityEntries = Object.entries(compatibility?.capabilities ?? health?.capabilities ?? {});
  const degraded = isDegraded(health, compatibility);
  const compatibilityStatus = compatibility
    ? (degraded ? 'needs attention' : 'compatible')
    : 'legacy health';

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-5" />
              API Surface
            </CardTitle>
            <CardDescription>Fortemi sidecar endpoint, status, and advertised capabilities.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadHealth()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
          {loading && !health ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading API surface...
            </div>
          ) : (
            <>
              {degraded && (
                <div className="flex items-start gap-2 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>Fortemi is reachable, but one or more advertised capabilities are degraded.</span>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Endpoint</div>
                  <div className="mt-1 break-all font-mono text-sm">{api.client.baseUrl}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Compatibility</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={degraded ? 'outline' : 'default'}>{compatibilityStatus}</Badge>
                    {compatibility?.contract_revision && (
                      <span className="text-sm text-muted-foreground">{compatibility.contract_revision}</span>
                    )}
                  </div>
                  {compatibility?.links && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <a className="text-primary hover:underline" href={compatibility.links.openapi}>OpenAPI</a>
                      <a className="text-primary hover:underline" href={compatibility.links.asyncapi}>AsyncAPI</a>
                    </div>
                  )}
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">API</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={statusVariant(health?.status)}>{health?.status ?? compatibility?.api.name ?? 'unknown'}</Badge>
                    {(compatibility?.api.version ?? health?.version) && (
                      <span className="text-sm text-muted-foreground">v{compatibility?.api.version ?? health?.version}</span>
                    )}
                  </div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Database</div>
                  <Badge className="mt-1" variant={statusVariant(health?.database)}>{health?.database ?? 'unknown'}</Badge>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Ollama</div>
                  <Badge className="mt-1" variant={statusVariant(health?.ollama)}>{health?.ollama ?? 'unknown'}</Badge>
                </div>
                {health?.job_processing && (
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground">Job processing</div>
                    <Badge className="mt-1" variant={statusVariant(health.job_processing)}>{health.job_processing}</Badge>
                  </div>
                )}
                {health?.sse && (
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground">Realtime events</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {health.sse.active_connections ?? 0} active, {health.sse.events_delivered ?? 0} delivered
                    </div>
                  </div>
                )}
                {compatibility && (
                  <>
                    <div className="rounded border p-3">
                      <div className="text-xs text-muted-foreground">Deployment</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {toTitle(compatibility.deployment.mode)} / {toTitle(compatibility.deployment.edition)}
                      </div>
                    </div>
                    <div className="rounded border p-3">
                      <div className="text-xs text-muted-foreground">Auth</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {toTitle(compatibility.auth.mode)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            Streaming Health
          </CardTitle>
          <CardDescription>Chat, ingest, realtime event, inbound connector, and call stream telemetry from Fortemi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <div className="text-sm font-medium">Endpoint status</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {streamingHealth ? 'Fortemi streaming health endpoint responded.' : 'Streaming health endpoint unavailable or not reported.'}
              </div>
            </div>
            <Badge variant={statusVariant(streamingHealth?.status)}>{streamingHealth?.status ?? 'unknown'}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {streamingHealthRows(streamingHealth).map((row) => (
              <div key={row.name} className="rounded border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{row.name}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{row.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
                  </div>
                  <Badge variant={streamingBlockVariant(row.block?.state)}>{row.block?.state ?? 'missing'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CallDiagnosticsPanel
        callDetail={callDetail}
        callError={callError}
        callId={callId}
        callLoading={callLoading}
        onCallIdChange={setCallId}
        onSubmit={loadCallDetail}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-5" />
            Backoffice Console Preview
          </CardTitle>
          <CardDescription>Tenant operations panels with production actions disabled until backend, role, audit, and fixture gates pass.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {backofficePanelRows(compatibility, health, degraded).map((panel) => (
            <div key={panel.name} className="rounded border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{panel.name}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{panel.preview}</p>
                </div>
                <Badge variant={backofficeVariant(panel.status)}>{panel.status}</Badge>
              </div>
              <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                <div>Dependency: {panel.dependency}</div>
                <div>Reason: {panel.reason}</div>
              </div>
              <Button className="mt-3 w-full" size="sm" variant="outline" disabled>
                {panel.action}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Premium Components Catalog
          </CardTitle>
          <CardDescription>Coarse premium component states with license, role, and backend gates preserved.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {premiumCatalogRows(compatibility).map((item) => (
            <div key={item.name} className="rounded border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{item.name}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Badge variant={catalogVariant(item.status)}>{item.status}</Badge>
              </div>
              <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                <div>Role: {item.role}</div>
                <div>Dependency: {item.dependency}</div>
                <div>Reason: {item.reason}</div>
              </div>
              <Button className="mt-3 w-full" size="sm" variant="outline" disabled={!item.actionEnabled}>
                {item.actionEnabled ? 'View preview details' : 'Action gated'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5" />
            Hosted Auth Preview
          </CardTitle>
          <CardDescription>Local, sign-in, tenant, role, and failure states for the enterprise demo path.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {hostedAuthPreviewRows(compatibility).map((row) => (
            <div key={row.label} className="rounded border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{row.label}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
                </div>
                <Badge variant={row.variant}>{row.state}</Badge>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{row.reason}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            Advertised Capabilities
          </CardTitle>
          <CardDescription>Capability metadata reported by the active Fortemi sidecar.</CardDescription>
        </CardHeader>
        <CardContent>
          {capabilityEntries.length === 0 ? (
            <div className="rounded border p-4 text-sm text-muted-foreground">No capability metadata reported by this sidecar.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {capabilityEntries.map(([name, value]) => {
                const state = capabilityState(value);
                return (
                  <div key={name} className="rounded border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{toTitle(name)}</div>
                      <Badge variant={state.variant}>{state.label}</Badge>
                    </div>
                    {state.detail && <div className="mt-2 text-xs text-muted-foreground">{state.detail}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5" />
            HotM Compatibility Surface
          </CardTitle>
          <CardDescription>Fortemi API features wired into this UI build.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {UI_FEATURES.map((feature) => (
            <div key={feature.label} className="rounded border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{feature.label}</span>
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="mr-1 size-3" />
                  wired
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{feature.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-5" />
            Enterprise Preview
          </CardTitle>
          <CardDescription>Premium and backoffice surfaces gated by Fortemi compatibility metadata.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {ENTERPRISE_SURFACES.map((surface) => {
            const state = enterpriseSurfaceState(compatibility, surface.key);
            return (
              <div key={surface.key} className="rounded border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{surface.label}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{surface.detail}</p>
                  </div>
                  <Badge variant={state.variant}>{state.label}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={state.productionEnabled ? 'default' : 'outline'} className="text-xs">
                    {state.productionEnabled ? 'production enabled' : 'production disabled'}
                  </Badge>
                  <span>{state.reason}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
