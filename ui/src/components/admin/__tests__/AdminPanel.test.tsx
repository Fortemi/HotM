/**
 * AdminPanel Component Tests
 * Tests for system administration interface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPanel } from '../AdminPanel';
import type { EmbeddingConfig, KnowledgeHealth } from '@/api';

// Mock the API
vi.mock('@/api', () => ({
  api: {
    client: { baseUrl: 'http://localhost:3000', get: vi.fn() },
    healthCheck: vi.fn(),
    systemCompatibility: {
      get: vi.fn(),
    },
    embeddings: {
      listConfigs: vi.fn(),
      getDefaultConfig: vi.fn(),
    },
    health: {
      getKnowledgeHealth: vi.fn(),
    },
    documents: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    webhooks: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      test: vi.fn(),
    },
  },
}));

// Mock tauri utilities
vi.mock('@/lib/tauri', () => ({
  getCachedConfig: vi.fn(() => null),
}));

import { api } from '@/api';

describe('AdminPanel', () => {
  const mockEmbeddingConfigs: EmbeddingConfig[] = [
    {
      id: 'config-1',
      name: 'Default Config',
      model: 'nomic-embed-text',
      dimensions: 768,
      is_default: true,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'config-2',
      name: 'Alternative Config',
      model: 'all-minilm-l6-v2',
      dimensions: 384,
      is_default: false,
      created_at: '2024-01-02T00:00:00Z',
    },
  ];

  const mockHealthData: KnowledgeHealth = {
    total_notes: 150,
    orphan_notes: 5,
    stale_notes: 10,
    unlinked_notes: 8,
    avg_links_per_note: 3.5,
    tag_coverage: 0.85,
    last_activity: '2024-01-15T12:00:00Z',
  };

  const mockSystemHealth = {
    status: 'healthy',
    version: '2026.2.3',
    git_sha: 'abc1234def5678',
    build_date: '2026-02-20T17:47:29Z',
    job_processing: 'running',
    capabilities: { ner: true, vision: true, audio_transcription: true },
    sse: { active_connections: 1, connections_total: 65, events_delivered: 289, events_emitted: 615 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.embeddings.listConfigs as any).mockResolvedValue(mockEmbeddingConfigs);
    (api.embeddings.getDefaultConfig as any).mockResolvedValue(mockEmbeddingConfigs[0]);
    (api.health.getKnowledgeHealth as any).mockResolvedValue(mockHealthData);
    (api.healthCheck as any).mockResolvedValue(mockSystemHealth);
    (api.systemCompatibility.get as any).mockResolvedValue({
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
        backoffice_api: { state: 'unavailable', reason_code: 'contract_not_implemented' },
      },
      links: {
        openapi: '/openapi.yaml',
        asyncapi: '/asyncapi.yaml',
        health: '/health',
        streaming_health: '/api/v1/health/streaming',
      },
    });
    (api.client.get as any).mockResolvedValue(mockSystemHealth);
    (api.documents.list as any).mockResolvedValue([]);
    (api.webhooks.list as any).mockResolvedValue([]);
  });

  describe('Rendering', () => {
    it('should render the admin panel with tabs', async () => {
      render(<AdminPanel />);

      await waitFor(() => {
        expect(screen.getByText('System Info')).toBeInTheDocument();
        expect(screen.getByText('API Surface')).toBeInTheDocument();
        expect(screen.getByText('Embedding Config')).toBeInTheDocument();
        expect(screen.getByText('Authentication')).toBeInTheDocument();
        expect(screen.getByText('Document Types')).toBeInTheDocument();
        expect(screen.getAllByText('Webhooks').length).toBeGreaterThan(0);
        expect(screen.getByText('About')).toBeInTheDocument();
      });
    });

    it('should apply custom className', async () => {
      const { container } = render(<AdminPanel className="custom-class" />);

      await waitFor(() => {
        expect(container.firstChild).toHaveClass('custom-class');
      });
    });
  });

  describe('System Info Tab', () => {
    it('should display system health information', async () => {
      render(<AdminPanel />);

      await waitFor(() => {
        expect(screen.getByText(/API Version/i)).toBeInTheDocument();
        expect(screen.getByText('2026.2.3')).toBeInTheDocument();
        expect(screen.getByText(/API Commit/i)).toBeInTheDocument();
        expect(screen.getByText('abc1234')).toBeInTheDocument();
        expect(screen.getByText(/Job Processing/i)).toBeInTheDocument();
      });
    });

    it('should display knowledge health metrics', async () => {
      render(<AdminPanel />);

      await waitFor(() => {
        expect(screen.getByText(/Total Notes/i)).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText(/Orphan Notes/i)).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('HUX-REQ-001 should display the API surface tab with compatibility features', async () => {
      const user = userEvent.setup();
      render(<AdminPanel />);

      await user.click(screen.getByText('API Surface'));

      await waitFor(() => {
        expect(screen.getByText(/HotM Compatibility Surface/i)).toBeInTheDocument();
        expect(screen.getByText(/Enterprise Preview/i)).toBeInTheDocument();
        expect(screen.getByText('Explicit titles')).toBeInTheDocument();
        expect(screen.getByText('Backoffice Console')).toBeInTheDocument();
        expect(screen.getByText('Deferred import')).toBeInTheDocument();
        expect(screen.getAllByText('Webhooks').length).toBeGreaterThan(0);
      });
    });

    it('HUX-REQ-004 keeps local admin workflows reachable when enterprise compatibility discovery is absent', async () => {
      const user = userEvent.setup();
      (api.systemCompatibility.get as any).mockRejectedValue(new Error('not found'));
      render(<AdminPanel />);

      await user.click(screen.getByText('API Surface'));

      await waitFor(() => {
        expect(screen.getByText('legacy health')).toBeInTheDocument();
        expect(screen.getAllByText('compatibility_discovery_unavailable').length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button', { name: /Action gated/i }).length).toBeGreaterThan(0);
      });

      await user.click(screen.getByRole('tab', { name: /Document Types/i }));
      await waitFor(() => {
        expect(screen.getByText(/No document types returned by the API/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /Webhooks/i }));
      await waitFor(() => {
        expect(screen.getAllByText('Webhooks').length).toBeGreaterThan(0);
      });
    });

    it('should show loading state while fetching data', async () => {
      (api.healthCheck as any).mockImplementation(() => new Promise(() => {}));
      render(<AdminPanel />);

      await waitFor(() => {
        expect(screen.getByText(/Loading system information/i)).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (api.healthCheck as any).mockRejectedValue(new Error('API Error'));
      render(<AdminPanel />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading system info/i)).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Embedding Config Tab', () => {
    it('should switch to embedding config tab', async () => {
      const user = userEvent.setup();
      render(<AdminPanel />);

      const embeddingTab = screen.getByText('Embedding Config');
      await user.click(embeddingTab);

      await waitFor(() => {
        expect(screen.getByText(/Embedding Model Configuration/i)).toBeInTheDocument();
      });
    });

    it('should display embedding configurations', async () => {
      const user = userEvent.setup();
      render(<AdminPanel />);

      const embeddingTab = screen.getByText('Embedding Config');
      await user.click(embeddingTab);

      await waitFor(() => {
        // Use getAllByText for duplicate content
        const modelElements = screen.getAllByText('nomic-embed-text');
        expect(modelElements.length).toBeGreaterThan(0);

        // Check for dimensions (appears multiple times)
        const dimensionElements = screen.getAllByText(/768/);
        expect(dimensionElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle embedding config fetch errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (api.embeddings.listConfigs as any).mockRejectedValue(new Error('Config Error'));
      const user = userEvent.setup();
      render(<AdminPanel />);

      const embeddingTab = screen.getByText('Embedding Config');
      await user.click(embeddingTab);

      await waitFor(() => {
        expect(screen.getByText(/Error loading embedding configs/i)).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Authentication Tab', () => {
    it('should switch to authentication tab', async () => {
      const user = userEvent.setup();
      render(<AdminPanel />);

      const authTab = screen.getByText('Authentication');
      await user.click(authTab);

      await waitFor(() => {
        expect(screen.getByText(/Coming Soon/i)).toBeInTheDocument();
      });
    });

    it('should display authentication placeholder', async () => {
      const user = userEvent.setup();
      render(<AdminPanel />);

      const authTab = screen.getByText('Authentication');
      await user.click(authTab);

      await waitFor(() => {
        expect(screen.getByText(/OAuth2 login and API key management/i)).toBeInTheDocument();
      });
    });
  });

  describe('About Tab', () => {
    it('should switch to about tab', async () => {
      const user = userEvent.setup();
      render(<AdminPanel />);

      const aboutTab = screen.getByText('About');
      await user.click(aboutTab);

      await waitFor(() => {
        expect(screen.getByText(/About HotM/i)).toBeInTheDocument();
      });
    });

    it('should display version information', async () => {
      const user = userEvent.setup();
      render(<AdminPanel />);

      const aboutTab = screen.getByText('About');
      await user.click(aboutTab);

      await waitFor(() => {
        expect(screen.getAllByText(/Version/i).length).toBeGreaterThan(0);
        expect(screen.getByText('test')).toBeInTheDocument();
        expect(screen.getByText('abc1234')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should allow switching between all tabs', async () => {
      const user = userEvent.setup();
      render(<AdminPanel />);

      // Initially on System Info
      await waitFor(() => {
        expect(screen.getByText(/API Version/i)).toBeInTheDocument();
      });

      // Switch to API Surface
      await user.click(screen.getByText('API Surface'));
      await waitFor(() => {
        expect(screen.getByText('Advertised Capabilities')).toBeInTheDocument();
      });

      // Switch to Embedding Config
      await user.click(screen.getByText('Embedding Config'));
      await waitFor(() => {
        expect(screen.getByText(/Embedding Model Configuration/i)).toBeInTheDocument();
      });

      // Switch to Document Types
      await user.click(screen.getByText('Document Types'));
      await waitFor(() => {
        expect(screen.getByText(/Create Custom Type/i)).toBeInTheDocument();
      });

      // Switch to Webhooks
      await user.click(screen.getByText('Webhooks'));
      await waitFor(() => {
        expect(screen.getByLabelText('URL')).toBeInTheDocument();
      });

      // Switch to Authentication
      await user.click(screen.getByText('Authentication'));
      await waitFor(() => {
        expect(screen.getByText(/Coming Soon/i)).toBeInTheDocument();
      });

      // Switch to About
      await user.click(screen.getByText('About'));
      await waitFor(() => {
        expect(screen.getByText(/About HotM/i)).toBeInTheDocument();
      });

      // Switch back to System Info
      await user.click(screen.getByText('System Info'));
      await waitFor(() => {
        expect(screen.getByText(/API Version/i)).toBeInTheDocument();
      });
    });
  });
});
