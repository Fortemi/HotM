import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiCapabilitiesPanel } from '../ApiCapabilitiesPanel';
import { api } from '@/api';
import type { SystemCompatibilityResponse } from '@/api';

vi.mock('@/api', () => ({
  api: {
    client: { baseUrl: 'http://localhost:3000/api/v1' },
    systemCompatibility: { get: vi.fn() },
    health: { getStreamingHealth: vi.fn() },
    calls: { getCall: vi.fn() },
    healthCheck: vi.fn(),
  },
}));

function compatibilityFixture(
  overrides: Partial<SystemCompatibilityResponse> = {}
): SystemCompatibilityResponse {
  return {
    schema_version: 1,
    contract_revision: '2026-07-06',
    api: {
      name: 'fortemi',
      version: '2026.5.25',
      minimum_hotm_enterprise_client: '0.0.0-checkpoint',
      git_sha_present: true,
      build_date_present: true,
    },
    deployment: {
      mode: 'local_sidecar',
      edition: 'community',
      hosted_multi_tenant_ready: false,
    },
    auth: {
      required: false,
      mode: 'anonymous_local',
      oauth_issuer_configured: false,
      tenant_context_available: false,
    },
    capabilities: {
      core_notes: { state: 'available' },
      realtime_activity: { state: 'available' },
      hosted_auth: { state: 'unavailable', reason_code: 'hosted_auth_not_configured' },
      premium_components: { state: 'preview', reason_code: 'capability_catalog_preview_only' },
    },
    links: {
      openapi: '/openapi.yaml',
      asyncapi: '/asyncapi.yaml',
      health: '/health',
      streaming_health: '/api/v1/health/streaming',
    },
    ...overrides,
  };
}

describe('ApiCapabilitiesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.healthCheck).mockResolvedValue({
      status: 'healthy',
      version: '2026.5.25',
      database: 'connected',
      ollama: 'unavailable',
      job_processing: 'running',
      capabilities: {
        chat: { available: false, configured: true },
        webhooks: true,
        vision: true,
      },
      sse: { active_connections: 2, events_delivered: 42 },
    } as any);
    vi.mocked(api.health.getStreamingHealth).mockResolvedValue({
      status: 'healthy',
      chat: {
        state: 'reported',
        metrics: {
          chat_stream_started_total: { type: 'counter', value: 7 },
          chat_stream_completed_total: { type: 'counter', value: 6 },
          chat_stream_errored_total: { type: 'counter', value: 1 },
          chat_stream_dropped_tokens_total: { type: 'counter', value: 2 },
        },
      },
      ingest: {
        state: 'reported',
        metrics: {
          ingest_stream_buffer_pressure: { type: 'gauge', value: 17 },
          ingest_stream_buffer_pressure_peak: { type: 'gauge', value: 42 },
          ingest_stream_backpressure_warnings_total: { type: 'counter', value: 3 },
          ingest_stream_throttled_total: { type: 'counter', value: 1 },
          ingest_stream_rate_limited_total: { type: 'counter', value: 0 },
        },
      },
      sse: {
        state: 'reported',
        metrics: {
          active_connections: { type: 'unknown', value: 2 },
          events_delivered: { type: 'unknown', value: 42 },
          events_lagged: { type: 'unknown', value: 0 },
          events_emitted: { type: 'unknown', value: 45 },
        },
      },
      inbound: {
        state: 'reported',
        metrics: {
          connectors: { type: 'unknown', value: 2 },
          events_total: { type: 'unknown', value: 120 },
          errors_total: { type: 'unknown', value: 1 },
          lag_max: { type: 'unknown', value: 9 },
        },
      },
      rtp: {
        state: 'reported',
        metrics: {
          active_sessions: { type: 'unknown', value: 1 },
          sessions_total: { type: 'unknown', value: 8 },
          asr_cost_per_minute: { type: 'unknown', value: '0.02' },
          transcript_events_total: { type: 'unknown', value: 14 },
        },
      },
    });
    vi.mocked(api.calls.getCall).mockResolvedValue({
      call_id: 'call-default',
      provider: 'twilio',
      provider_call: {
        provider_call_id_present: true,
        provider_call_id_len: 34,
      },
      started_at: '2026-07-14T13:00:00Z',
      ended_at: '2026-07-14T13:03:00Z',
      end_reason: 'completed',
      duration_secs: 180,
      asr_backend_len: 7,
      remote_party_present: true,
      remote_party_len: 12,
      archive_id: 'archive-default',
      metadata_class: 'summary',
      metadata_len: 128,
      segment_count: 0,
      segments: [],
      pagination: {
        total: 0,
        limit: 50,
        offset: 0,
        has_more: false,
      },
    });
    vi.mocked(api.systemCompatibility.get).mockResolvedValue(compatibilityFixture());
  });

  it('HUX-REQ-001 HUX-REQ-002 HUX-REQ-003 renders endpoint, compatibility contract, degraded state, and advertised capabilities', async () => {
    render(<ApiCapabilitiesPanel />);

    expect(await screen.findByText('http://localhost:3000/api/v1')).toBeInTheDocument();
    expect(screen.getByText('v2026.5.25')).toBeInTheDocument();
    expect(screen.getByText('2026-07-06')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'OpenAPI' })).toHaveAttribute('href', '/openapi.yaml');
    expect(screen.getByRole('link', { name: 'AsyncAPI' })).toHaveAttribute('href', '/asyncapi.yaml');
    expect(screen.getByText(/one or more advertised capabilities are degraded/i)).toBeInTheDocument();
    expect(screen.getAllByText('Hosted Auth').length).toBeGreaterThan(0);
    expect(screen.getByText('Streaming Health')).toBeInTheDocument();
    expect(screen.getByText('Chat Stream')).toBeInTheDocument();
    expect(screen.getByText(/7 started, 6 completed, 1 errored/i)).toBeInTheDocument();
    expect(screen.getByText(/17 pressure, 42 peak/i)).toBeInTheDocument();
    expect(screen.getByText(/2 connectors, 120 events/i)).toBeInTheDocument();
    expect(screen.getByText(/reason_code: hosted_auth_not_configured/i)).toBeInTheDocument();
    expect(screen.getByText('Enterprise Preview')).toBeInTheDocument();
    expect(screen.getByText('Hosted Auth Preview')).toBeInTheDocument();
    expect(screen.getByText('anonymous_local_mode')).toBeInTheDocument();
    expect(screen.getByText('tenant_context_absent')).toBeInTheDocument();
    expect(screen.getByText('Premium Components Catalog')).toBeInTheDocument();
    expect(screen.getByText('Licensed Server Components')).toBeInTheDocument();
    expect(screen.getAllByText('license required').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Premium Components').length).toBeGreaterThan(0);
    expect(screen.getByText('Backoffice Console')).toBeInTheDocument();
    expect(screen.getAllByText('production disabled').length).toBeGreaterThan(0);
    expect(screen.getByText('Document types')).toBeInTheDocument();
  }, 10000);

  it('HUX-REQ-005 HUX-REQ-009 renders hosted tenant-admin auth preview without enabling production controls', async () => {
    vi.mocked(api.systemCompatibility.get).mockResolvedValue(compatibilityFixture({
      deployment: {
        mode: 'hosted_multi_tenant',
        edition: 'enterprise',
        hosted_multi_tenant_ready: false,
      },
      auth: {
        required: true,
        mode: 'hosted_tenant_admin',
        oauth_issuer_configured: true,
        tenant_context_available: true,
      },
      capabilities: {
        hosted_auth: { state: 'available' },
        premium_components: { state: 'preview', reason_code: 'capability_catalog_preview_only' },
        backoffice_api: { state: 'preview', reason_code: 'backoffice_contract_pending' },
      },
    }));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Hosted Auth Preview')).toBeInTheDocument();
      expect(screen.getByText('hosted_mode_selected')).toBeInTheDocument();
      expect(screen.getByText('tenant_context_available')).toBeInTheDocument();
      expect(screen.getByText('scope_contract_pending')).toBeInTheDocument();
      expect(screen.getAllByText('production disabled').length).toBeGreaterThan(0);
    });
  });

  it('HUX-REQ-003 HUX-REQ-005 keeps enterprise auth controls disabled for insufficient role fixtures', async () => {
    vi.mocked(api.systemCompatibility.get).mockResolvedValue(compatibilityFixture({
      deployment: {
        mode: 'hosted_multi_tenant',
        edition: 'enterprise',
        hosted_multi_tenant_ready: false,
      },
      auth: {
        required: true,
        mode: 'hosted_insufficient_role',
        oauth_issuer_configured: true,
        tenant_context_available: true,
      },
      capabilities: {
        hosted_auth: { state: 'available' },
        backoffice_api: { state: 'preview', reason_code: 'backoffice_contract_pending' },
      },
    }));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('insufficient_role_or_scope')).toBeInTheDocument();
      expect(screen.getByText(/lacks the admin role or scope/i)).toBeInTheDocument();
      expect(screen.getAllByText('production disabled').length).toBeGreaterThan(0);
    });
  });

  it('HUX-REQ-005 HUX-REQ-011 renders fixed auth failure state without raw provider diagnostics', async () => {
    vi.mocked(api.systemCompatibility.get).mockResolvedValue(compatibilityFixture({
      deployment: {
        mode: 'hosted_multi_tenant',
        edition: 'enterprise',
        hosted_multi_tenant_ready: false,
      },
      auth: {
        required: true,
        mode: 'hosted_auth_failure',
        oauth_issuer_configured: true,
        tenant_context_available: false,
      },
      capabilities: {
        hosted_auth: { state: 'available' },
      },
    }));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('fixed_error_category')).toBeInTheDocument();
      expect(screen.getByText(/raw provider diagnostics remain hidden/i)).toBeInTheDocument();
      expect(screen.queryByText(/invalid_grant/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/refresh_token/i)).not.toBeInTheDocument();
    });
  });

  it('HUX-REQ-007 HUX-REQ-011 renders premium component catalog states without exposing license internals', async () => {
    vi.mocked(api.systemCompatibility.get).mockResolvedValue(compatibilityFixture({
      deployment: {
        mode: 'hosted_multi_tenant',
        edition: 'enterprise',
        hosted_multi_tenant_ready: false,
      },
      auth: {
        required: true,
        mode: 'hosted_tenant_admin',
        oauth_issuer_configured: true,
        tenant_context_available: true,
      },
      capabilities: {
        premium_components: { state: 'available' },
        hosted_auth: { state: 'unavailable', reason_code: 'hosted_auth_not_configured' },
        backoffice_api: { state: 'preview', reason_code: 'backoffice_contract_pending' },
        mcp_scope_gate: { state: 'available' },
        kms_status: { state: 'unknown' },
      },
    }));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Premium Components Catalog')).toBeInTheDocument();
      expect(screen.getByText('Licensed Server Components')).toBeInTheDocument();
      expect(screen.getByText('Backoffice Widgets')).toBeInTheDocument();
      expect(screen.getByText('Enterprise MCP Tools')).toBeInTheDocument();
      expect(screen.getByText('Hosted Auth Components')).toBeInTheDocument();
      expect(screen.getByText('KMS Integrations')).toBeInTheDocument();
      expect(screen.getAllByText('available').length).toBeGreaterThan(0);
      expect(screen.getAllByText('preview only').length).toBeGreaterThan(0);
      expect(screen.getAllByText('admin required').length).toBeGreaterThan(0);
      expect(screen.getAllByText('unavailable').length).toBeGreaterThan(0);
      expect(screen.getAllByText('unknown').length).toBeGreaterThan(0);
      expect(screen.getByText(/Fortemi\/licensing#1/)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Action gated/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /View preview details/i })).toBeEnabled();
      expect(screen.queryByText(/license_token/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/registry_password/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/kms-key-/i)).not.toBeInTheDocument();
    });
  });

  it('HUX-REQ-003 HUX-REQ-007 disables premium catalog actions when compatibility metadata is unknown', async () => {
    vi.mocked(api.systemCompatibility.get).mockRejectedValue(new Error('not found'));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Premium Components Catalog')).toBeInTheDocument();
      expect(screen.getAllByText('unknown').length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /Action gated/i }).length).toBeGreaterThan(0);
    });
  });

  it('HUX-REQ-008 HUX-REQ-009 HUX-REQ-011 renders backoffice preview panels with production actions disabled and blockers visible', async () => {
    vi.mocked(api.systemCompatibility.get).mockResolvedValue(compatibilityFixture({
      deployment: {
        mode: 'hosted_multi_tenant',
        edition: 'enterprise',
        hosted_multi_tenant_ready: false,
      },
      auth: {
        required: true,
        mode: 'hosted_tenant_admin',
        oauth_issuer_configured: true,
        tenant_context_available: true,
      },
      capabilities: {
        backoffice_api: { state: 'available' },
        audit_posture: { state: 'preview', reason_code: 'audit_sink_preview_only' },
        quota_status: { state: 'unavailable', reason_code: 'quota_contract_missing' },
        kms_status: { state: 'unknown' },
        support_diagnostics: { state: 'preview', reason_code: 'support_export_disabled' },
      },
    }));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Backoffice Console Preview')).toBeInTheDocument();
      expect(screen.getByText('Tenant Health')).toBeInTheDocument();
      expect(screen.getAllByText('Audit Posture').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Quota Status').length).toBeGreaterThan(0);
      expect(screen.getAllByText('KMS Status').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Support Diagnostics').length).toBeGreaterThan(0);
      expect(screen.getAllByText('enabled').length).toBeGreaterThan(0);
      expect(screen.getAllByText('degraded').length).toBeGreaterThan(0);
      expect(screen.getAllByText('unavailable').length).toBeGreaterThan(0);
      expect(screen.getAllByText('unknown').length).toBeGreaterThan(0);
      expect(screen.getAllByText('preview-only').length).toBeGreaterThan(0);
      expect(screen.getByText(/hosted_production_blocked_rls_gate/)).toBeInTheDocument();
      expect(screen.getByText(/Fortemi\/fortemi#1019, Fortemi-Enterprise\/kms#2/)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Production action disabled/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Export disabled/i })).toBeDisabled();
      expect(screen.queryByText(/tenant_secret/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/raw_tenant_id/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/kms-key-/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/support_bundle/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/stack trace/i)).not.toBeInTheDocument();
    });
  });

  it('HUX-REQ-003 HUX-REQ-008 HUX-REQ-009 disables backoffice panels for insufficient role fixtures', async () => {
    vi.mocked(api.systemCompatibility.get).mockResolvedValue(compatibilityFixture({
      deployment: {
        mode: 'hosted_multi_tenant',
        edition: 'enterprise',
        hosted_multi_tenant_ready: false,
      },
      auth: {
        required: true,
        mode: 'hosted_insufficient_role',
        oauth_issuer_configured: true,
        tenant_context_available: true,
      },
      capabilities: {
        backoffice_api: { state: 'available' },
        audit_posture: { state: 'available' },
        quota_status: { state: 'available' },
        kms_status: { state: 'preview' },
        support_diagnostics: { state: 'available' },
      },
    }));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Backoffice Console Preview')).toBeInTheDocument();
      expect(screen.getAllByText('disabled').length).toBeGreaterThan(0);
      expect(screen.getByText(/support_contract_pending/)).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Production action disabled|Export disabled/i }).every((button) => button.hasAttribute('disabled'))).toBe(true);
    });
  });

  it('HUX-REQ-001 HUX-REQ-003 shows unknown compatibility states without marking them available', async () => {
    vi.mocked(api.systemCompatibility.get).mockResolvedValue(compatibilityFixture({
      capabilities: {
        backoffice_api: { state: 'unknown' },
      },
    }));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Backoffice Api')).toBeInTheDocument();
      expect(screen.getAllByText('unknown').length).toBeGreaterThan(0);
      expect(screen.getAllByText('capability_not_advertised').length).toBeGreaterThan(0);
      expect(screen.getByText(/one or more advertised capabilities are degraded/i)).toBeInTheDocument();
    });
  });

  it('HUX-REQ-004 falls back to legacy health metadata when compatibility discovery is unreachable', async () => {
    vi.mocked(api.systemCompatibility.get).mockRejectedValue(new Error('not found'));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('legacy health')).toBeInTheDocument();
      expect(screen.getByText('Chat')).toBeInTheDocument();
      expect(screen.getAllByText('Webhooks').length).toBeGreaterThan(0);
      expect(screen.getAllByText('compatibility_discovery_unavailable').length).toBeGreaterThan(0);
      expect(screen.getByText(/Hosted sign-in is hidden until compatibility metadata is available/i)).toBeInTheDocument();
    });
  });

  it('UX-FORTEMI-002 renders missing and malformed streaming health blocks as non-healthy states', async () => {
    vi.mocked(api.health.getStreamingHealth).mockResolvedValue({
      status: 'healthy',
      chat: { state: 'malformed', metrics: {} },
      ingest: { state: 'missing', metrics: {} },
      sse: { state: 'reported', metrics: { active_connections: { type: 'unknown', value: 1 } } },
      inbound: { state: 'missing', metrics: {} },
      rtp: { state: 'missing', metrics: {} },
    });

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Streaming Health')).toBeInTheDocument();
      expect(screen.getAllByText('malformed').length).toBeGreaterThan(0);
      expect(screen.getAllByText('missing').length).toBeGreaterThan(0);
      expect(screen.getByText(/1 active, -- delivered/i)).toBeInTheDocument();
      expect(screen.getByText(/-- pressure, -- peak/i)).toBeInTheDocument();
    });
  });

  it('UX-FORTEMI-002 leaves streaming health unknown when the endpoint is unavailable', async () => {
    vi.mocked(api.health.getStreamingHealth).mockRejectedValue(new Error('streaming health unavailable'));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Streaming Health')).toBeInTheDocument();
      expect(screen.getByText('Streaming health endpoint unavailable or not reported.')).toBeInTheDocument();
      expect(screen.getAllByText('missing').length).toBeGreaterThan(0);
    });
  });

  it('UX-FORTEMI-007 loads redacted call diagnostics without rendering transcript text or provider IDs', async () => {
    const user = userEvent.setup();
    vi.mocked(api.calls.getCall).mockResolvedValue({
      call_id: 'call-abc',
      provider: 'twilio',
      provider_call: {
        provider_call_id_present: true,
        provider_call_id_len: 39,
        raw_provider_call_id: 'CA-secret-provider-call-id',
      },
      started_at: '2026-07-14T13:00:00Z',
      ended_at: '2026-07-14T13:05:00Z',
      end_reason: 'completed',
      duration_secs: 300,
      asr_backend_len: 9,
      remote_party_present: true,
      remote_party_len: 14,
      archive_id: 'archive-secret-id',
      metadata_class: 'redacted',
      metadata_len: 512,
      segment_count: 2,
      segments: [
        {
          start_secs: 0,
          end_secs: 3,
          text: 'customer secret transcript',
          speaker_id: 'speaker-secret',
          words: [
            { word: 'customer', start_secs: 0, end_secs: 1, confidence: 0.98 },
            { word: 'secret', start_secs: 1, end_secs: 2, confidence: 0.9 },
          ],
        },
      ],
      pagination: {
        total: 2,
        limit: 50,
        offset: 0,
        has_more: false,
      },
    });

    render(<ApiCapabilitiesPanel />);

    await screen.findByText('Call Diagnostics');
    await user.type(screen.getByLabelText('Call ID'), 'call-abc');
    await user.click(screen.getByRole('button', { name: /Load call/i }));

    await waitFor(() => {
      expect(api.calls.getCall).toHaveBeenCalledWith('call-abc', { limit: 50, offset: 0 });
      expect(screen.getByText(/Provider: twilio; duration 300 seconds/i)).toBeInTheDocument();
      expect(screen.getByText(/Provider call ID present: yes/i)).toBeInTheDocument();
      expect(screen.getByText(/Provider call ID length: 39/i)).toBeInTheDocument();
      expect(screen.getByText(/Remote party length: 14/i)).toBeInTheDocument();
      expect(screen.getByText(/Archive reference present: yes/i)).toBeInTheDocument();
      expect(screen.getByText(/2 segments; page 0 offset, 50 limit, 2 total/i)).toBeInTheDocument();
      expect(screen.getByText(/Segment 1: 0s-3s; text length 26; words 2/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Twilio realtime WebSocket diagnostics are not exposed in HotM/i)).toBeInTheDocument();
    expect(screen.queryByText(/customer secret transcript/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CA-secret-provider-call-id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/archive-secret-id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/speaker-secret/i)).not.toBeInTheDocument();
  });

  it('UX-FORTEMI-007 requires a call ID before requesting call diagnostics', async () => {
    const user = userEvent.setup();
    render(<ApiCapabilitiesPanel />);

    await screen.findByText('Call Diagnostics');
    await user.click(screen.getByRole('button', { name: /Load call/i }));

    expect(screen.getByText('Call ID is required.')).toBeInTheDocument();
    expect(api.calls.getCall).not.toHaveBeenCalled();
  });

  it('refreshes health on demand', async () => {
    const user = userEvent.setup();
    render(<ApiCapabilitiesPanel />);

    await screen.findByText('API Surface');
    await user.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(api.healthCheck).toHaveBeenCalledTimes(2);
      expect(api.systemCompatibility.get).toHaveBeenCalledTimes(2);
      expect(api.health.getStreamingHealth).toHaveBeenCalledTimes(2);
    });
  });

  it('shows a load error without hiding the screen', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.systemCompatibility.get).mockRejectedValue(new Error('not found'));
    vi.mocked(api.healthCheck).mockRejectedValue(new Error('offline'));

    render(<ApiCapabilitiesPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading API surface/i)).toBeInTheDocument();
      expect(screen.getByText(/No capability metadata reported/i)).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });
});
