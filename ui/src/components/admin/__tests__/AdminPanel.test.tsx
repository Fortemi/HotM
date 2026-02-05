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
    embeddings: {
      listConfigs: vi.fn(),
      getDefaultConfig: vi.fn(),
    },
    health: {
      getKnowledgeHealth: vi.fn(),
    },
    healthCheck: vi.fn(),
  },
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
    version: '0.1.2',
    database: 'connected',
    ollama: 'available',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.embeddings.listConfigs as any).mockResolvedValue(mockEmbeddingConfigs);
    (api.embeddings.getDefaultConfig as any).mockResolvedValue(mockEmbeddingConfigs[0]);
    (api.health.getKnowledgeHealth as any).mockResolvedValue(mockHealthData);
    (api.healthCheck as any).mockResolvedValue(mockSystemHealth);
  });

  describe('Rendering', () => {
    it('should render the admin panel with tabs', async () => {
      render(<AdminPanel />);

      await waitFor(() => {
        expect(screen.getByText('System Info')).toBeInTheDocument();
        expect(screen.getByText('Embedding Config')).toBeInTheDocument();
        expect(screen.getByText('Authentication')).toBeInTheDocument();
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
        expect(screen.getByText('0.1.2')).toBeInTheDocument();
        expect(screen.getByText(/Database/i)).toBeInTheDocument();
        expect(screen.getByText('connected')).toBeInTheDocument();
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
        expect(screen.getByText('0.1.2')).toBeInTheDocument();
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

      // Switch to Embedding Config
      await user.click(screen.getByText('Embedding Config'));
      await waitFor(() => {
        expect(screen.getByText(/Embedding Model Configuration/i)).toBeInTheDocument();
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
