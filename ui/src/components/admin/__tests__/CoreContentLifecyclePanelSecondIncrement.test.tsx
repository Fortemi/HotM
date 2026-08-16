import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoreContentLifecyclePanel } from '../CoreContentLifecyclePanel';

const mocks = vi.hoisted(() => ({
  admission: {
    state: 'compatible' as const,
    message: null as string | null,
    retry: vi.fn(async () => undefined),
    allows: vi.fn(() => true),
    blockReason: vi.fn(() => null),
  },
  collections: {
    getNotes: vi.fn(async () => []),
    exportMarkdown: vi.fn(async () => '# collection'),
    moveNote: vi.fn(async () => undefined),
  },
  templates: {
    get: vi.fn(async () => ({ id: 'template-1', name: 'Brief', content: '{{topic}}', variables: ['topic'] })),
    instantiate: vi.fn(async () => ({ id: 'result-1', note_id: 'note-created', status: 'created' })),
  },
  documents: {
    detect: vi.fn(async (): Promise<{
      matched: boolean;
      document_type: { display_name: string } | null;
      confidence: number | null;
      detection_method: string | null;
    }> => ({ matched: false, document_type: null, confidence: null, detection_method: null })),
    update: vi.fn(async () => ({ name: 'report', display_name: 'Report' })),
  },
  jobs: {
    get: vi.fn(async () => ({ id: 'job-1', job_type: 'extract', status: 'failed', progress_percent: 40 })),
    getPendingCount: vi.fn(async () => 2),
    getQueueStats: vi.fn(async () => ({ total: 5, pending: 2, processing: 1, completed: 1, failed: 1, failed_last_hour: 1, dead: 0, incompatible: 0 })),
    getPauseStatus: vi.fn(async () => ({ global: 'running', archives: {}, queue: { pending: 2, running: 1 } })),
    getExtractionStats: vi.fn(async () => ({ total_jobs: 4, completed_jobs: 2, failed_jobs: 1, pending_jobs: 1 })),
    pauseGlobal: vi.fn(async () => ({ status: 'paused', scope: 'global' })),
    resumeGlobal: vi.fn(async () => ({ status: 'running', scope: 'global' })),
    pauseArchive: vi.fn(async (archive: string) => ({ status: 'paused', scope: 'archive', archive })),
    resumeArchive: vi.fn(async (archive: string) => ({ status: 'running', scope: 'archive', archive })),
  },
  concepts: {
    getBroaderRelations: vi.fn(async () => [{ concept_id: 'parent', pref_label: 'Parent', relationship: 'broader' }]),
    getNarrowerRelations: vi.fn(async () => []),
    getRelatedRelations: vi.fn(async () => []),
    addBroader: vi.fn(async () => ({ success: true })),
    addNarrower: vi.fn(async () => ({ success: true })),
    addRelated: vi.fn(async () => ({ success: true })),
    removeBroader: vi.fn(async () => undefined),
    removeNarrower: vi.fn(async () => undefined),
    removeRelated: vi.fn(async () => undefined),
    listCollections: vi.fn(async () => []),
    createCollection: vi.fn(async () => ({ id: 'skos-1' })),
    getCollection: vi.fn(async () => ({ id: 'skos-1', pref_label: 'Topics', members: [] })),
    updateCollection: vi.fn(async () => ({ id: 'skos-1', pref_label: 'Updated topics', members: [] })),
    deleteCollection: vi.fn(async () => undefined),
    setCollectionMembers: vi.fn(async () => ({ id: 'skos-1', pref_label: 'Topics', members: [{ concept_id: 'concept-2' }] })),
    addCollectionMember: vi.fn(async () => undefined),
    removeCollectionMember: vi.fn(async () => undefined),
    exploreKnowledgeGraph: vi.fn(async () => ({ node_count: 3, edge_count: 2, truncated_nodes: 0, truncated_edges: 0 })),
    getKnowledgeGraphTopology: vi.fn(async () => ({ total_notes: 10, total_links: 8, connected_components: 3, isolated_nodes: 2, avg_degree: 1.6 })),
    getKnowledgeGraphDiagnostics: vi.fn(async () => ({ note_count: 10, edge_count: 8, embedding_count: 9, anisotropy_score: 0.2, degree_cv: 0.4 })),
    listKnowledgeGraphSnapshots: vi.fn(async () => []),
    compareKnowledgeGraphSnapshots: vi.fn(async () => ({ before: { label: 'Before' }, after: { label: 'After' }, summary: ['changed'], degree_cv_delta: 0.1 })),
    getKnowledgeGraphColdSpots: vi.fn(async () => ({ isolated_count: 2, cold_access_count: 3, overlap_count: 1, recommendation_count: 2 })),
    captureKnowledgeGraphSnapshot: vi.fn(async () => ({ id: 'snapshot-1', captured_at: '2026-08-16T00:00:00Z' })),
    recomputeKnowledgeGraphSnn: vi.fn(async ({ dry_run }: { dry_run: boolean }) => ({ updated: 4, pruned: 1, dry_run })),
    sparsifyKnowledgeGraphPfnet: vi.fn(async ({ dry_run }: { dry_run: boolean }) => ({ retained: 7, total_edges: 10, pruned: 3, dry_run })),
    detectKnowledgeGraphCommunities: vi.fn(async () => ({ community_count: 2, note_count: 10, modularity_q: 0.6 })),
    triggerKnowledgeGraphMaintenance: vi.fn(async () => ({ id: null, status: 'already_pending', steps: ['normalize', 'snn'] })),
  },
}));

vi.mock('@/hooks/useCoreOperationAdmission', () => ({
  useCoreOperationAdmission: () => mocks.admission,
}));

vi.mock('@/api', () => ({
  api: {
    collections: mocks.collections,
    templates: mocks.templates,
    documents: mocks.documents,
    jobs: mocks.jobs,
    concepts: mocks.concepts,
    notes: {},
    provenance: {},
  },
}));

async function openTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('tab', { name }));
}

async function confirm(user: ReturnType<typeof userEvent.setup>, action: string) {
  expect(screen.getByRole('alertdialog')).toBeVisible();
  await user.click(screen.getByRole('button', { name: action }));
}

describe('CoreContentLifecyclePanel second increment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.admission, {
      state: 'compatible',
      message: null,
      allows: vi.fn(() => true),
      blockReason: vi.fn(() => null),
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:collection'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('dispatches collection, template, and document workflows with explicit states', async () => {
    const user = userEvent.setup();
    render(<CoreContentLifecyclePanel />);
    await openTab(user, 'Content tools');

    await user.type(screen.getByLabelText('Collection ID'), 'collection-1');
    await user.type(screen.getByLabelText('Collection note ID'), 'note-1');
    await user.click(screen.getByRole('button', { name: 'Load collection notes' }));
    expect(await screen.findByText('Collection has no notes.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Export collection' }));
    await waitFor(() => expect(mocks.collections.exportMarkdown).toHaveBeenCalledWith('collection-1', { includeFrontmatter: true }));
    await user.click(screen.getByRole('button', { name: 'Move note' }));
    await waitFor(() => expect(mocks.collections.moveNote).toHaveBeenCalledWith('note-1', { collection_id: 'collection-1' }));
    await user.click(screen.getByRole('button', { name: 'Remove from collection' }));
    await waitFor(() => expect(mocks.collections.moveNote).toHaveBeenLastCalledWith('note-1', { collection_id: null }));

    await user.type(screen.getByLabelText('Template ID'), 'template-1');
    await user.type(screen.getByLabelText('Template variables'), 'topic=contracts');
    await user.click(screen.getByRole('button', { name: 'Load template' }));
    expect(await screen.findByText('Brief: 1 variable(s)')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Instantiate template' }));
    await confirm(user, 'Create note');
    await waitFor(() => expect(mocks.templates.instantiate).toHaveBeenCalledWith('template-1', { variables: { topic: 'contracts' } }));
    expect(screen.getByText('Created note note-created from template; status=created.')).toBeVisible();

    await user.type(screen.getByLabelText('Detection filename'), 'unknown.bin');
    await user.click(screen.getByRole('button', { name: 'Detect type' }));
    expect((await screen.findAllByText('Unknown document type')).length).toBeGreaterThanOrEqual(1);
    mocks.documents.detect.mockResolvedValueOnce({ matched: true, document_type: { display_name: 'Report' }, confidence: 0.83, detection_method: 'content' });
    await user.click(screen.getByRole('button', { name: 'Detect type' }));
    expect((await screen.findAllByText('Report: 83% via content')).length).toBeGreaterThanOrEqual(1);
    await user.type(screen.getByLabelText('Document type name'), 'report');
    await user.type(screen.getByLabelText('Document display name'), 'Report');
    await user.click(screen.getByRole('button', { name: 'Update type' }));
    await waitFor(() => expect(mocks.documents.update).toHaveBeenCalledWith('report', { display_name: 'Report' }));
  }, 10_000);

  it('reports job partial states and confirms global and archive transitions', async () => {
    const user = userEvent.setup();
    render(<CoreContentLifecyclePanel />);
    await openTab(user, 'Jobs');
    await user.type(screen.getByLabelText('Lifecycle job ID'), 'job-1');
    await user.type(screen.getByLabelText('Job archive'), 'research');

    await user.click(screen.getByRole('button', { name: 'Load job' }));
    expect(await screen.findByText('Loaded job job-1; extract: failed, 40%.')).toBeVisible();
    expect(screen.getByText('partial')).toBeVisible();
    for (const button of ['Pending count', 'Queue stats', 'Pause status', 'Extraction stats']) {
      await user.click(screen.getByRole('button', { name: button }));
    }
    expect(await screen.findByText('2/4 extraction jobs completed')).toBeVisible();
    expect(screen.getByText('partial')).toBeVisible();

    for (const [button, action] of [
      ['Pause all jobs', 'Pause jobs'],
      ['Resume all jobs', 'Resume jobs'],
      ['Pause archive jobs', 'Pause archive'],
      ['Resume archive jobs', 'Resume archive'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: button }));
      await confirm(user, action);
    }
    expect(mocks.jobs.pauseGlobal).toHaveBeenCalledOnce();
    expect(mocks.jobs.resumeGlobal).toHaveBeenCalledOnce();
    expect(mocks.jobs.pauseArchive).toHaveBeenCalledWith('research');
    expect(mocks.jobs.resumeArchive).toHaveBeenCalledWith('research');
    expect(screen.getByText('research jobs running.')).toBeVisible();
  });

  it('dispatches typed SKOS relationship and collection workflows with destructive confirmations', async () => {
    const user = userEvent.setup();
    render(<CoreContentLifecyclePanel />);
    await openTab(user, 'SKOS');
    await user.type(screen.getByLabelText('Concept ID'), 'concept-1');
    await user.type(screen.getByLabelText('Target concept ID'), 'concept-2');
    await user.selectOptions(screen.getByLabelText('Relationship'), 'narrower');
    await user.click(screen.getByRole('button', { name: 'Load relationships' }));
    await user.click(screen.getByRole('button', { name: 'Add relationship' }));
    await user.click(screen.getByRole('button', { name: 'Remove relationship' }));
    await confirm(user, 'Remove relation');
    expect(mocks.concepts.getNarrowerRelations).toHaveBeenCalledWith('concept-1');
    expect(mocks.concepts.addNarrower).toHaveBeenCalledWith('concept-1', 'concept-2');
    expect(mocks.concepts.removeNarrower).toHaveBeenCalledWith('concept-1', 'concept-2');
    expect(screen.getByText('remove_narrower')).toBeVisible();

    await user.type(screen.getByLabelText('SKOS collection label'), 'Topics');
    await user.click(screen.getByRole('button', { name: 'List SKOS collections' }));
    await user.click(screen.getByRole('button', { name: 'Create SKOS collection' }));
    await waitFor(() => expect(screen.getByLabelText('SKOS collection ID')).toHaveValue('skos-1'));
    await user.type(screen.getByLabelText('SKOS member concept ID'), 'concept-2');
    await user.type(screen.getByLabelText('SKOS replacement members'), 'concept-2, concept-3');
    for (const button of ['Load SKOS collection', 'Update SKOS collection', 'Add member']) {
      await user.click(screen.getByRole('button', { name: button }));
    }
    await user.click(screen.getByRole('button', { name: 'Replace members' }));
    await confirm(user, 'Replace members');
    await user.click(screen.getByRole('button', { name: 'Remove member' }));
    await confirm(user, 'Remove member');
    await user.click(screen.getByRole('button', { name: 'Delete SKOS collection' }));
    await confirm(user, 'Delete collection');
    expect(mocks.concepts.setCollectionMembers).toHaveBeenCalledWith('skos-1', { concept_ids: ['concept-2', 'concept-3'] });
    expect(mocks.concepts.addCollectionMember).toHaveBeenCalledWith('skos-1', 'concept-2');
    expect(mocks.concepts.removeCollectionMember).toHaveBeenCalledWith('skos-1', 'concept-2');
    expect(mocks.concepts.deleteCollection).toHaveBeenCalledWith('skos-1');
  });

  it('covers graph read, preview, destructive apply, and partial maintenance states', async () => {
    const user = userEvent.setup();
    render(<CoreContentLifecyclePanel />);
    await openTab(user, 'Graph');
    await user.type(screen.getByLabelText('Graph note ID'), 'note-1');
    await user.type(screen.getByLabelText('Graph snapshot label'), 'baseline');
    await user.type(screen.getByLabelText('Before snapshot ID'), 'before');
    await user.type(screen.getByLabelText('After snapshot ID'), 'after');

    for (const button of ['Explore graph', 'Topology stats', 'Graph diagnostics', 'Snapshot history', 'Compare snapshots', 'Cold spots']) {
      await user.click(screen.getByRole('button', { name: button }));
    }
    expect(await screen.findByText('1 overlapping cold/isolated notes; 2 recommendation(s).')).toBeVisible();
    expect(screen.getByText('partial')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Capture snapshot' }));
    await confirm(user, 'Capture snapshot');
    await user.click(screen.getByRole('button', { name: 'Recompute SNN' }));
    await confirm(user, 'Run preview');
    expect(mocks.concepts.recomputeKnowledgeGraphSnn).toHaveBeenCalledWith({ dry_run: true });

    await user.click(screen.getByRole('checkbox', { name: 'Dry run graph algorithms' }));
    await user.click(screen.getByRole('button', { name: 'Run PFNET' }));
    await confirm(user, 'Apply PFNET');
    expect(mocks.concepts.sparsifyKnowledgeGraphPfnet).toHaveBeenCalledWith({ dry_run: false });
    await user.click(screen.getByRole('button', { name: 'Detect communities' }));
    await confirm(user, 'Detect communities');
    await user.click(screen.getByRole('button', { name: 'Run graph maintenance' }));
    await confirm(user, 'Queue maintenance');
    expect(screen.getByText('already_pending; job=existing; 2 step(s).')).toBeVisible();
    expect(screen.getByText('partial')).toBeVisible();
  });

  it('gates every second-increment surface and never renders raw server failures', async () => {
    Object.assign(mocks.admission, {
      state: 'incompatible',
      message: 'Pinned contract mismatch.',
      allows: vi.fn(() => false),
      blockReason: vi.fn(() => 'Not admitted by pinned contract.'),
    });
    const user = userEvent.setup();
    const first = render(<CoreContentLifecyclePanel />);
    for (const [tab, button] of [
      ['Content tools', 'Export collection'],
      ['Jobs', 'Pause all jobs'],
      ['SKOS', 'Delete SKOS collection'],
      ['Graph', 'Run graph maintenance'],
    ] as const) {
      await openTab(user, tab);
      expect(screen.getByRole('button', { name: button })).toBeDisabled();
    }
    first.unmount();

    Object.assign(mocks.admission, { state: 'compatible', message: null, allows: vi.fn(() => true), blockReason: vi.fn(() => null) });
    mocks.jobs.getPendingCount.mockRejectedValueOnce(new Error('secret server body: token=do-not-render'));
    render(<CoreContentLifecyclePanel />);
    await openTab(user, 'Jobs');
    await user.click(screen.getByRole('button', { name: 'Pending count' }));
    expect(await screen.findByText(/unknown: The operation failed without a recognized result/)).toBeVisible();
    expect(screen.queryByText(/do-not-render/)).not.toBeInTheDocument();
  });

  it.each([375, 1280])('keeps all second-increment workflow tabs reachable at %ipx', async (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    window.dispatchEvent(new Event('resize'));
    const user = userEvent.setup();
    const { container } = render(<CoreContentLifecyclePanel />);
    await openTab(user, 'Content tools');
    expect(Array.from(container.querySelectorAll('*')).flatMap((element) => Array.from(element.classList))).toContain('xl:grid-cols-3');
    for (const tab of ['Jobs', 'SKOS']) await openTab(user, tab);
    await openTab(user, 'Graph');
    const graphClassTokens = Array.from(container.querySelectorAll('*')).flatMap((element) => Array.from(element.classList));
    expect(screen.getByRole('tabpanel')).toBeVisible();
    expect(graphClassTokens).toContain('overflow-x-auto');
    expect(graphClassTokens).toContain('xl:grid-cols-4');
  });
});
