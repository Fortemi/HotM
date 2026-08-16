import * as React from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  BookMarked,
  FileSearch,
  FileStack,
  FolderKanban,
  LayoutTemplate,
  ListChecks,
  Loader2,
  MapPin,
  Network,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { api } from '@/api';
import { decodeCoreOperationFailure } from '@/api/contract-codecs';
import type { BulkCreateNoteItem, FullDocumentResult, NotesActivityResult, NotesTimelineResult } from '@/api/notes';
import type { SkosRelationKind } from '@/api/concepts';
import { useCoreOperationAdmission } from '@/hooks/useCoreOperationAdmission';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type ReceiptOutcome = 'success' | 'partial' | 'error';

interface OperationReceipt {
  operationId: string;
  outcome: ReceiptOutcome;
  detail: string;
  at: string;
}

interface ConfirmationRequest {
  operationId: string;
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  run: () => Promise<void>;
}

type ProvenanceKind = 'device' | 'location' | 'named_location' | 'file' | 'note';

function downloadText(filename: string, content: string, contentType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: contentType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AdmissionBanner({ admission }: { admission: ReturnType<typeof useCoreOperationAdmission> }) {
  const variant = admission.state === 'compatible' ? 'default' : admission.state === 'checking' ? 'secondary' : 'destructive';
  return (
    <div className="flex flex-col gap-3 border p-3 sm:flex-row sm:items-center sm:justify-between" role="status">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={variant}>{admission.state}</Badge>
          <span className="text-sm font-medium">Pinned Fortemi operation admission</span>
        </div>
        {admission.state !== 'compatible' && (
          <p className="mt-1 text-sm text-muted-foreground">
            {admission.message ?? 'Advanced remote operations are unavailable. Note capture and search remain available.'}
          </p>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void admission.retry()} disabled={admission.state === 'checking'}>
        <RefreshCw className={admission.state === 'checking' ? 'size-4 animate-spin' : 'size-4'} />
        Retry
      </Button>
    </div>
  );
}

function ReceiptView({ receipt }: { receipt: OperationReceipt | null }) {
  if (!receipt) return <p className="text-sm text-muted-foreground">No operation receipt yet.</p>;
  return (
    <div className="border-l-2 border-primary px-3 py-2" role="status" data-outcome={receipt.outcome}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={receipt.outcome === 'error' ? 'destructive' : receipt.outcome === 'partial' ? 'secondary' : 'default'}>
          {receipt.outcome}
        </Badge>
        <span className="font-mono text-xs">{receipt.operationId}</span>
        <time className="text-xs text-muted-foreground">{new Date(receipt.at).toLocaleString()}</time>
      </div>
      <p className="mt-1 break-words text-sm">{receipt.detail}</p>
    </div>
  );
}

export function CoreContentLifecyclePanel() {
  const admission = useCoreOperationAdmission();
  const [busyOperation, setBusyOperation] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<OperationReceipt | null>(null);
  const [confirmation, setConfirmation] = React.useState<ConfirmationRequest | null>(null);
  const [noteId, setNoteId] = React.useState('');
  const [version, setVersion] = React.useState('1');
  const [bulkContent, setBulkContent] = React.useState('');
  const [starred, setStarred] = React.useState(false);
  const [archived, setArchived] = React.useState(false);
  const [activity, setActivity] = React.useState<NotesActivityResult | null>(null);
  const [timeline, setTimeline] = React.useState<NotesTimelineResult | null>(null);
  const [fullDocument, setFullDocument] = React.useState<FullDocumentResult | null>(null);
  const [provenanceKind, setProvenanceKind] = React.useState<ProvenanceKind>('note');
  const [provenanceForm, setProvenanceForm] = React.useState({
    noteId: '', attachmentId: '', make: '', model: '', name: '', locationType: 'poi', latitude: '', longitude: '',
  });
  const [collectionId, setCollectionId] = React.useState('');
  const [collectionNoteId, setCollectionNoteId] = React.useState('');
  const [collectionNotesCount, setCollectionNotesCount] = React.useState<number | null>(null);
  const [templateId, setTemplateId] = React.useState('');
  const [templateVariables, setTemplateVariables] = React.useState('');
  const [templateSummary, setTemplateSummary] = React.useState<string | null>(null);
  const [documentFilename, setDocumentFilename] = React.useState('');
  const [documentContent, setDocumentContent] = React.useState('');
  const [documentTypeName, setDocumentTypeName] = React.useState('');
  const [documentDisplayName, setDocumentDisplayName] = React.useState('');
  const [documentDetection, setDocumentDetection] = React.useState<string | null>(null);
  const [jobId, setJobId] = React.useState('');
  const [jobArchive, setJobArchive] = React.useState('');
  const [jobSummary, setJobSummary] = React.useState<string | null>(null);
  const [relationKind, setRelationKind] = React.useState<SkosRelationKind>('broader');
  const [conceptId, setConceptId] = React.useState('');
  const [targetConceptId, setTargetConceptId] = React.useState('');
  const [relationCount, setRelationCount] = React.useState<number | null>(null);
  const [skosCollectionId, setSkosCollectionId] = React.useState('');
  const [skosCollectionLabel, setSkosCollectionLabel] = React.useState('');
  const [skosMemberId, setSkosMemberId] = React.useState('');
  const [skosMemberIds, setSkosMemberIds] = React.useState('');
  const [skosSummary, setSkosSummary] = React.useState<string | null>(null);
  const [graphNoteId, setGraphNoteId] = React.useState('');
  const [snapshotLabel, setSnapshotLabel] = React.useState('');
  const [beforeSnapshotId, setBeforeSnapshotId] = React.useState('');
  const [afterSnapshotId, setAfterSnapshotId] = React.useState('');
  const [graphDryRun, setGraphDryRun] = React.useState(true);
  const [graphSummary, setGraphSummary] = React.useState<string | null>(null);

  const record = React.useCallback((operationId: string, outcome: ReceiptOutcome, detail: string) => {
    setReceipt({ operationId, outcome, detail, at: new Date().toISOString() });
  }, []);

  const run = React.useCallback(async (
    operationId: string,
    action: () => Promise<{ detail: string; outcome?: ReceiptOutcome }>,
  ) => {
    if (!admission.allows(operationId)) {
      record(operationId, 'error', admission.blockReason(operationId) ?? 'Operation is not admitted.');
      return;
    }
    setBusyOperation(operationId);
    try {
      const result = await action();
      record(operationId, result.outcome ?? 'success', result.detail);
    } catch (error) {
      const failure = decodeCoreOperationFailure(error);
      const detail: Record<typeof failure.kind, string> = {
        unauthorized: 'Authentication is required for this operation.',
        forbidden: 'This identity is not authorized for this operation.',
        incompatible: 'The pinned Fortemi contract does not admit this operation.',
        degraded: 'Fortemi is unavailable or degraded.',
        not_found: 'The requested resource was not found.',
        invalid_response: 'Fortemi returned a response that did not match the pinned contract.',
        unknown: 'The operation failed without a recognized result.',
      };
      record(operationId, 'error', `${failure.kind}: ${detail[failure.kind]}`);
    } finally {
      setBusyOperation(null);
    }
  }, [admission, record]);

  const requireNote = (): string => {
    const id = noteId.trim();
    if (!id) throw new Error('Enter a note ID first.');
    return id;
  };

  const requireValue = (value: string, label: string): string => {
    const normalized = value.trim();
    if (!normalized) throw new Error(`${label} is required.`);
    return normalized;
  };

  const parseTemplateVariables = (): Record<string, string> => {
    const variables: Record<string, string> = {};
    for (const line of templateVariables.split('\n').map((entry) => entry.trim()).filter(Boolean)) {
      const separator = line.indexOf('=');
      if (separator < 1) throw new Error('Template variables must use key=value lines.');
      variables[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
    return variables;
  };

  const relationOperationId = (action: 'get' | 'add' | 'remove'): string => `${action}_${relationKind}`;

  const loadRelations = () => void run(relationOperationId('get'), async () => {
    const id = requireValue(conceptId, 'Concept ID');
    const relations = relationKind === 'broader'
      ? await api.concepts.getBroaderRelations(id)
      : relationKind === 'narrower'
        ? await api.concepts.getNarrowerRelations(id)
        : await api.concepts.getRelatedRelations(id);
    setRelationCount(relations.length);
    return { detail: `Loaded ${relations.length} ${relationKind} relation(s).` };
  });

  const addRelation = () => void run(relationOperationId('add'), async () => {
    const id = requireValue(conceptId, 'Concept ID');
    const target = requireValue(targetConceptId, 'Target concept ID');
    if (relationKind === 'broader') await api.concepts.addBroader(id, target);
    else if (relationKind === 'narrower') await api.concepts.addNarrower(id, target);
    else await api.concepts.addRelated(id, target);
    return { detail: `Added ${relationKind} relation from ${id} to ${target}.` };
  });

  const removeRelation = () => requestConfirmation(
    relationOperationId('remove'),
    `Remove ${relationKind} relation?`,
    'The selected semantic relationship will be permanently removed.',
    'Remove relation',
    async () => {
      const id = requireValue(conceptId, 'Concept ID');
      const target = requireValue(targetConceptId, 'Target concept ID');
      if (relationKind === 'broader') await api.concepts.removeBroader(id, target);
      else if (relationKind === 'narrower') await api.concepts.removeNarrower(id, target);
      else await api.concepts.removeRelated(id, target);
      return { detail: `Removed ${relationKind} relation from ${id} to ${target}.` };
    },
    true,
  );

  const requestConfirmation = (
    operationId: string,
    title: string,
    description: string,
    actionLabel: string,
    action: () => Promise<{ detail: string; outcome?: ReceiptOutcome }>,
    destructive = false,
  ) => {
    setConfirmation({
      operationId,
      title,
      description,
      actionLabel,
      destructive,
      run: () => run(operationId, action),
    });
  };

  const parseBulkNotes = (): BulkCreateNoteItem[] => bulkContent
    .split(/^---$/m)
    .map((content) => content.trim())
    .filter(Boolean)
    .map((content) => ({ content, format: 'markdown', source: 'hotm_bulk' }));

  const submitProvenance = async () => {
    const latitude = Number(provenanceForm.latitude);
    const longitude = Number(provenanceForm.longitude);
    const operationByKind: Record<ProvenanceKind, string> = {
      device: 'create_prov_device',
      location: 'create_prov_location',
      named_location: 'create_named_location',
      file: 'create_file_provenance',
      note: 'create_note_provenance',
    };
    const operationId = operationByKind[provenanceKind];
    await run(operationId, async () => {
      const result = provenanceKind === 'device'
        ? await api.provenance.createDevice({ device_make: provenanceForm.make, device_model: provenanceForm.model })
        : provenanceKind === 'location'
          ? await api.provenance.createLocation({ latitude, longitude, source: 'user_manual', confidence: 'high' })
          : provenanceKind === 'named_location'
            ? await api.provenance.createNamedLocation({ name: provenanceForm.name, location_type: provenanceForm.locationType, latitude, longitude })
            : provenanceKind === 'file'
              ? await api.provenance.createFileProvenance({ attachment_id: provenanceForm.attachmentId, note_id: provenanceForm.noteId || null })
              : await api.provenance.createNoteProvenance({ note_id: provenanceForm.noteId, event_type: 'created', time_source: 'manual' });
      return { detail: `Created provenance record ${result.id}.` };
    });
  };

  const actionDisabled = (operationId: string) => busyOperation !== null || !admission.allows(operationId);
  const operationButton = (operationId: string, label: string, onClick: () => void, destructive = false) => (
    <Button
      type="button"
      variant={destructive ? 'destructive' : 'outline'}
      size="sm"
      disabled={actionDisabled(operationId)}
      title={admission.blockReason(operationId) ?? undefined}
      onClick={onClick}
    >
      {busyOperation === operationId && <Loader2 className="size-4 animate-spin" />}
      {label}
    </Button>
  );

  return (
    <div className="space-y-4" data-testid="core-content-lifecycle">
      <AdmissionBanner admission={admission} />
      <Tabs defaultValue="notes">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="notes"><FileStack className="size-4" />Note lifecycle</TabsTrigger>
          <TabsTrigger value="provenance"><MapPin className="size-4" />Provenance</TabsTrigger>
          <TabsTrigger value="content"><FolderKanban className="size-4" />Content tools</TabsTrigger>
          <TabsTrigger value="jobs"><ListChecks className="size-4" />Jobs</TabsTrigger>
          <TabsTrigger value="knowledge"><BookMarked className="size-4" />SKOS</TabsTrigger>
          <TabsTrigger value="graph"><Network className="size-4" />Graph</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Selected note</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <div>
                    <label className="text-xs text-muted-foreground" htmlFor="lifecycle-note-id">Note ID</label>
                    <Input id="lifecycle-note-id" value={noteId} onChange={(event) => setNoteId(event.target.value)} placeholder="UUID" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground" htmlFor="lifecycle-version">Version</label>
                    <Input id="lifecycle-version" type="number" min="1" value={version} onChange={(event) => setVersion(event.target.value)} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {operationButton('get_full_document', 'Full document', () => void run('get_full_document', async () => {
                    const result = await api.notes.getFullDocument(requireNote());
                    setFullDocument(result);
                    return { detail: `Loaded ${result.is_chunked ? result.total_chunks ?? 0 : 1} document part(s).` };
                  }))}
                  {operationButton('export_note', 'Export markdown', () => void run('export_note', async () => {
                    const id = requireNote();
                    const markdown = await api.notes.exportMarkdown(id);
                    downloadText(`note-${id}.md`, markdown, 'text/markdown');
                    return { detail: `Exported ${new TextEncoder().encode(markdown).byteLength} bytes.` };
                  }))}
                  {operationButton('update_note_status', 'Apply status', () => requestConfirmation(
                    'update_note_status',
                    'Apply note status?',
                    `Set starred=${starred} and archived=${archived} for ${noteId || 'the selected note'}.`,
                    'Apply status',
                    async () => {
                      await api.notes.updateStatus(requireNote(), { starred, archived });
                      return { detail: `Applied starred=${starred}, archived=${archived}.` };
                    },
                  ))}
                  {operationButton('restore_note', 'Restore note', () => requestConfirmation(
                    'restore_note', 'Restore soft-deleted note?', 'The note will be restored and its processing pipeline queued again.', 'Restore',
                    async () => {
                      const result = await api.notes.restore(requireNote(), 'light');
                      return { detail: `Restored note ${result.id}; restored=${result.restored}.` };
                    },
                  ))}
                  {operationButton('purge_note', 'Purge note', () => requestConfirmation(
                    'purge_note', 'Permanently purge note?', 'This queues irreversible deletion of the note and related data.', 'Queue purge',
                    async () => {
                      const result = await api.notes.purge(requireNote());
                      return { detail: `Purge ${result.status}; job ${result.job_id} for note ${result.note_id}.` };
                    }, true,
                  ), true)}
                  {operationButton('restore_note_version', 'Restore version', () => requestConfirmation(
                    'restore_note_version', 'Restore this version?', `Version ${version} will become a new current version.`, 'Restore version',
                    async () => {
                      const result = await api.notes.restoreVersion(requireNote(), Number(version), true);
                      return { detail: `Restored version ${result.restored_from_version} as version ${result.new_version}; tags=${result.restore_tags}.` };
                    },
                  ))}
                  {operationButton('delete_note_version', 'Delete version', () => requestConfirmation(
                    'delete_note_version', 'Delete this historical version?', `Version ${version} will be permanently removed from history.`, 'Delete version',
                    async () => {
                      const result = await api.notes.deleteVersion(requireNote(), Number(version));
                      return { detail: `Deleted version ${result.deleted_version}; success=${result.success}.` };
                    }, true,
                  ), true)}
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={starred} onChange={(event) => setStarred(event.target.checked)} />Starred</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />Archived</label>
                </div>

                {fullDocument && (
                  <div className="max-h-64 overflow-auto border p-3">
                    <div className="font-medium">{fullDocument.title}</div>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{fullDocument.content}</pre>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bulk operations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea aria-label="Bulk note content" value={bulkContent} onChange={(event) => setBulkContent(event.target.value)} className="min-h-40 font-mono text-xs" />
                <div className="flex flex-wrap gap-2">
                  {operationButton('bulk_create_notes', 'Create notes', () => requestConfirmation(
                    'bulk_create_notes', 'Create notes in bulk?', `${parseBulkNotes().length} notes will be created in the active memory.`, 'Create notes',
                    async () => {
                      const requested = parseBulkNotes();
                      const result = await api.notes.bulkCreate(requested);
                      return {
                        outcome: result.count === requested.length ? 'success' : 'partial',
                        detail: `Created ${result.count}/${requested.length} notes; ${result.ids.length} IDs returned.`,
                      };
                    },
                  ))}
                  {operationButton('bulk_reprocess_notes', 'Reprocess', () => requestConfirmation(
                    'bulk_reprocess_notes', 'Queue bulk reprocessing?', noteId ? 'The selected note will be reprocessed.' : 'All active notes may be reprocessed.', 'Queue reprocess',
                    async () => {
                      const result = await api.notes.reprocessAll({ noteIds: noteId.trim() ? [noteId.trim()] : undefined, revisionMode: 'light' });
                      return {
                        outcome: result.notes_count !== undefined && result.notes_count > 0 && result.jobs_queued === 0 ? 'partial' : 'success',
                        detail: `${result.message ?? 'Queued'}: ${result.notes_count ?? 0} notes, ${result.jobs_queued} jobs.`,
                      };
                    },
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Activity and timeline</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {operationButton('get_notes_activity', 'Load activity', () => void run('get_notes_activity', async () => {
                  const result = await api.notes.getActivity({ since: '7d', limit: 50 });
                  setActivity(result);
                  return { detail: `Loaded ${result.activity.length} activity entries.` };
                }))}
                {operationButton('get_notes_timeline', 'Load timeline', () => void run('get_notes_timeline', async () => {
                  const result = await api.notes.getTimeline({ period: 'day', periods: 30 });
                  setTimeline(result);
                  return { detail: `Loaded ${result.buckets.length} timeline buckets.` };
                }))}
              </div>
              {activity && (activity.activity.length === 0
                ? <p className="text-sm text-muted-foreground">No recent note activity.</p>
                : <div className="grid gap-2 sm:grid-cols-2">{activity.activity.slice(0, 8).map((entry) => <div key={entry.note_id} className="border p-2 text-sm"><div className="truncate font-medium">{entry.title || entry.note_id}</div><div className="text-xs text-muted-foreground">{new Date(entry.updated_at).toLocaleString()}</div></div>)}</div>)}
              {timeline && (timeline.buckets.length === 0
                ? <p className="text-sm text-muted-foreground">No timeline buckets.</p>
                : <div className="flex flex-wrap gap-2">{timeline.buckets.slice(0, 12).map((bucket) => <Badge key={bucket.period_start} variant="outline">{new Date(bucket.period_start).toLocaleDateString()}: {bucket.count}</Badge>)}</div>)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="provenance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create provenance record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Provenance record type">
                {(['note', 'file', 'device', 'location', 'named_location'] as ProvenanceKind[]).map((kind) => (
                  <Button key={kind} type="button" size="sm" variant={provenanceKind === kind ? 'default' : 'outline'} onClick={() => setProvenanceKind(kind)}>
                    {kind.replace('_', ' ')}
                  </Button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(provenanceKind === 'note' || provenanceKind === 'file') && <Input aria-label="Provenance note ID" placeholder="Note ID" value={provenanceForm.noteId} onChange={(event) => setProvenanceForm((form) => ({ ...form, noteId: event.target.value }))} />}
                {provenanceKind === 'file' && <Input aria-label="Attachment ID" placeholder="Attachment ID" value={provenanceForm.attachmentId} onChange={(event) => setProvenanceForm((form) => ({ ...form, attachmentId: event.target.value }))} />}
                {provenanceKind === 'device' && <><Input aria-label="Device make" placeholder="Device make" value={provenanceForm.make} onChange={(event) => setProvenanceForm((form) => ({ ...form, make: event.target.value }))} /><Input aria-label="Device model" placeholder="Device model" value={provenanceForm.model} onChange={(event) => setProvenanceForm((form) => ({ ...form, model: event.target.value }))} /></>}
                {(provenanceKind === 'location' || provenanceKind === 'named_location') && <><Input aria-label="Latitude" type="number" placeholder="Latitude" value={provenanceForm.latitude} onChange={(event) => setProvenanceForm((form) => ({ ...form, latitude: event.target.value }))} /><Input aria-label="Longitude" type="number" placeholder="Longitude" value={provenanceForm.longitude} onChange={(event) => setProvenanceForm((form) => ({ ...form, longitude: event.target.value }))} /></>}
                {provenanceKind === 'named_location' && <><Input aria-label="Location name" placeholder="Location name" value={provenanceForm.name} onChange={(event) => setProvenanceForm((form) => ({ ...form, name: event.target.value }))} /><Input aria-label="Location type" placeholder="Location type" value={provenanceForm.locationType} onChange={(event) => setProvenanceForm((form) => ({ ...form, locationType: event.target.value }))} /></>}
              </div>
              <Button type="button" onClick={() => void submitProvenance()} disabled={busyOperation !== null || !admission.allows({ device: 'create_prov_device', location: 'create_prov_location', named_location: 'create_named_location', file: 'create_file_provenance', note: 'create_note_provenance' }[provenanceKind])}>
                {busyOperation?.startsWith('create_') ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Create provenance
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-base"><FolderKanban className="mr-2 inline size-4" />Collections</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input aria-label="Collection ID" placeholder="Collection ID" value={collectionId} onChange={(event) => setCollectionId(event.target.value)} />
                <Input aria-label="Collection note ID" placeholder="Note ID" value={collectionNoteId} onChange={(event) => setCollectionNoteId(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {operationButton('get_collection_notes', 'Load collection notes', () => void run('get_collection_notes', async () => {
                    const notes = await api.collections.getNotes(requireValue(collectionId, 'Collection ID'), { limit: 100 });
                    setCollectionNotesCount(notes.length);
                    return { detail: notes.length ? `Loaded ${notes.length} collection note(s).` : 'Collection has no notes.' };
                  }))}
                  {operationButton('export_collection', 'Export collection', () => void run('export_collection', async () => {
                    const id = requireValue(collectionId, 'Collection ID');
                    const markdown = await api.collections.exportMarkdown(id, { includeFrontmatter: true });
                    downloadText(`collection-${id}.md`, markdown, 'text/markdown');
                    return { detail: `Exported ${new TextEncoder().encode(markdown).byteLength} bytes.` };
                  }))}
                  {operationButton('move_note_to_collection', 'Move note', () => void run('move_note_to_collection', async () => {
                    const note = requireValue(collectionNoteId, 'Note ID');
                    const target = requireValue(collectionId, 'Collection ID');
                    await api.collections.moveNote(note, { collection_id: target });
                    return { detail: `Moved note ${note} to collection ${target}.` };
                  }))}
                  {operationButton('move_note_to_collection', 'Remove from collection', () => void run('move_note_to_collection', async () => {
                    const note = requireValue(collectionNoteId, 'Note ID');
                    await api.collections.moveNote(note, { collection_id: null });
                    return { detail: `Removed note ${note} from its collection.` };
                  }))}
                </div>
                {collectionNotesCount !== null && <p className="text-sm text-muted-foreground">Notes returned: {collectionNotesCount}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base"><LayoutTemplate className="mr-2 inline size-4" />Templates</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input aria-label="Template ID" placeholder="Template ID" value={templateId} onChange={(event) => setTemplateId(event.target.value)} />
                <Textarea aria-label="Template variables" placeholder="key=value" value={templateVariables} onChange={(event) => setTemplateVariables(event.target.value)} className="min-h-24 font-mono text-xs" />
                <div className="flex flex-wrap gap-2">
                  {operationButton('get_template', 'Load template', () => void run('get_template', async () => {
                    const template = await api.templates.get(requireValue(templateId, 'Template ID'));
                    setTemplateSummary(`${template.name}: ${template.variables?.length ?? 0} variable(s)`);
                    return { detail: `Loaded template ${template.id}; ${template.content.length} characters.` };
                  }))}
                  {operationButton('instantiate_template', 'Instantiate template', () => requestConfirmation(
                    'instantiate_template', 'Create note from template?', 'A new note will be created in the active memory.', 'Create note',
                    async () => {
                      const result = await api.templates.instantiate(requireValue(templateId, 'Template ID'), { variables: parseTemplateVariables() });
                      return { detail: `Created note ${result.note_id} from template; status=${result.status}.` };
                    },
                  ))}
                </div>
                {templateSummary && <p className="break-words text-sm text-muted-foreground">{templateSummary}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base"><FileSearch className="mr-2 inline size-4" />Document types</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input aria-label="Detection filename" placeholder="Filename" value={documentFilename} onChange={(event) => setDocumentFilename(event.target.value)} />
                <Textarea aria-label="Detection content" placeholder="Content sample" value={documentContent} onChange={(event) => setDocumentContent(event.target.value)} className="min-h-20 text-xs" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input aria-label="Document type name" placeholder="Type name" value={documentTypeName} onChange={(event) => setDocumentTypeName(event.target.value)} />
                  <Input aria-label="Document display name" placeholder="Display name" value={documentDisplayName} onChange={(event) => setDocumentDisplayName(event.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {operationButton('detect_document_type', 'Detect type', () => void run('detect_document_type', async () => {
                    const result = await api.documents.detect({ filename: documentFilename.trim() || undefined, content: documentContent.trim() || undefined });
                    const summary = result.matched && result.document_type
                      ? `${result.document_type.display_name}: ${Math.round((result.confidence ?? 0) * 100)}% via ${result.detection_method}`
                      : 'Unknown document type';
                    setDocumentDetection(summary);
                    return { detail: summary };
                  }))}
                  {operationButton('update_document_type', 'Update type', () => void run('update_document_type', async () => {
                    const result = await api.documents.update(requireValue(documentTypeName, 'Document type name'), {
                      ...(documentDisplayName.trim() ? { display_name: documentDisplayName.trim() } : {}),
                    });
                    setDocumentDetection(`Updated ${result.display_name}`);
                    return { detail: `Updated document type ${result.name}.` };
                  }))}
                </div>
                {documentDetection && <p className="break-words text-sm text-muted-foreground">{documentDetection}</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="jobs">
          <Card>
            <CardHeader><CardTitle className="text-base">Job and extraction controls</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input aria-label="Lifecycle job ID" placeholder="Job ID" value={jobId} onChange={(event) => setJobId(event.target.value)} />
                <Input aria-label="Job archive" placeholder="Archive" value={jobArchive} onChange={(event) => setJobArchive(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                {operationButton('get_job', 'Load job', () => void run('get_job', async () => {
                  const job = await api.jobs.get(requireValue(jobId, 'Job ID'));
                  const summary = `${job.job_type}: ${job.status}, ${job.progress_percent ?? 0}%`;
                  setJobSummary(summary);
                  const complete = job.status === 'completed';
                  return { detail: `Loaded job ${job.id}; ${summary}.`, outcome: complete ? 'success' : 'partial' };
                }))}
                {operationButton('pending_jobs_count', 'Pending count', () => void run('pending_jobs_count', async () => {
                  const pending = await api.jobs.getPendingCount();
                  setJobSummary(`${pending} pending job(s)`);
                  return { detail: `${pending} pending job(s).`, outcome: pending > 0 ? 'partial' : 'success' };
                }))}
                {operationButton('queue_stats', 'Queue stats', () => void run('queue_stats', async () => {
                  const stats = await api.jobs.getQueueStats();
                  setJobSummary(`${stats.pending} pending, ${stats.processing} processing`);
                  const unhealthy = stats.failed_last_hour + (stats.dead ?? 0) + (stats.incompatible ?? 0);
                  return { detail: `${stats.total} total; ${stats.pending} pending; ${stats.processing} processing; ${unhealthy} unhealthy.`, outcome: unhealthy > 0 ? 'partial' : 'success' };
                }))}
                {operationButton('get_job_pause_status', 'Pause status', () => void run('get_job_pause_status', async () => {
                  const state = await api.jobs.getPauseStatus();
                  setJobSummary(`Global ${state.global}; ${Object.keys(state.archives).length} archive override(s)`);
                  return { detail: `Global queue is ${state.global}; pending=${state.queue?.pending ?? 0}, running=${state.queue?.running ?? 0}.` };
                }))}
                {operationButton('extraction_stats', 'Extraction stats', () => void run('extraction_stats', async () => {
                  const stats = await api.jobs.getExtractionStats();
                  setJobSummary(`${stats.completed_jobs}/${stats.total_jobs} extraction jobs completed`);
                  return { detail: `${stats.completed_jobs}/${stats.total_jobs} completed; ${stats.failed_jobs} failed; ${stats.pending_jobs} pending.`, outcome: stats.failed_jobs > 0 || stats.pending_jobs > 0 ? 'partial' : 'success' };
                }))}
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {operationButton('pause_jobs_global', 'Pause all jobs', () => requestConfirmation('pause_jobs_global', 'Pause all jobs?', 'Global background processing will stop after active work yields.', 'Pause jobs', async () => {
                  const result = await api.jobs.pauseGlobal(); return { detail: `Job processing ${result.status}; scope=${result.scope}.` };
                }))}
                {operationButton('resume_jobs_global', 'Resume all jobs', () => requestConfirmation('resume_jobs_global', 'Resume all jobs?', 'Global background processing will resume.', 'Resume jobs', async () => {
                  const result = await api.jobs.resumeGlobal(); return { detail: `Job processing ${result.status}; scope=${result.scope}.` };
                }))}
                {operationButton('pause_jobs_archive', 'Pause archive jobs', () => requestConfirmation('pause_jobs_archive', 'Pause archive jobs?', `Background processing for ${jobArchive || 'the selected archive'} will pause.`, 'Pause archive', async () => {
                  const result = await api.jobs.pauseArchive(requireValue(jobArchive, 'Archive')); return { detail: `${result.archive} jobs ${result.status}.` };
                }))}
                {operationButton('resume_jobs_archive', 'Resume archive jobs', () => requestConfirmation('resume_jobs_archive', 'Resume archive jobs?', `Background processing for ${jobArchive || 'the selected archive'} will resume.`, 'Resume archive', async () => {
                  const result = await api.jobs.resumeArchive(requireValue(jobArchive, 'Archive')); return { detail: `${result.archive} jobs ${result.status}.` };
                }))}
              </div>
              {jobSummary && <p className="break-words text-sm text-muted-foreground">{jobSummary}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Semantic relationships</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input aria-label="Concept ID" placeholder="Concept ID" value={conceptId} onChange={(event) => setConceptId(event.target.value)} />
                  <Input aria-label="Target concept ID" placeholder="Target concept ID" value={targetConceptId} onChange={(event) => setTargetConceptId(event.target.value)} />
                </div>
                <label className="block text-xs text-muted-foreground" htmlFor="relation-kind">Relationship</label>
                <select id="relation-kind" className="h-9 w-full border bg-background px-3 text-sm" value={relationKind} onChange={(event) => setRelationKind(event.target.value as SkosRelationKind)}>
                  <option value="broader">Broader</option><option value="narrower">Narrower</option><option value="related">Related</option>
                </select>
                <div className="flex flex-wrap gap-2">
                  {operationButton(relationOperationId('get'), 'Load relationships', loadRelations)}
                  {operationButton(relationOperationId('add'), 'Add relationship', addRelation)}
                  {operationButton(relationOperationId('remove'), 'Remove relationship', removeRelation, true)}
                </div>
                {relationCount !== null && <p className="text-sm text-muted-foreground">Relationships returned: {relationCount}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">SKOS collections</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input aria-label="SKOS collection ID" placeholder="Collection ID" value={skosCollectionId} onChange={(event) => setSkosCollectionId(event.target.value)} />
                  <Input aria-label="SKOS collection label" placeholder="Label" value={skosCollectionLabel} onChange={(event) => setSkosCollectionLabel(event.target.value)} />
                  <Input aria-label="SKOS member concept ID" placeholder="Member concept ID" value={skosMemberId} onChange={(event) => setSkosMemberId(event.target.value)} />
                  <Input aria-label="SKOS replacement members" placeholder="Comma-separated concept IDs" value={skosMemberIds} onChange={(event) => setSkosMemberIds(event.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {operationButton('list_skos_collections', 'List SKOS collections', () => void run('list_skos_collections', async () => {
                    const results = await api.concepts.listCollections(); setSkosSummary(`${results.length} collection(s)`); return { detail: `Loaded ${results.length} SKOS collection(s).` };
                  }))}
                  {operationButton('create_skos_collection', 'Create SKOS collection', () => void run('create_skos_collection', async () => {
                    const result = await api.concepts.createCollection({ pref_label: requireValue(skosCollectionLabel, 'Collection label'), is_ordered: false });
                    setSkosCollectionId(result.id); setSkosSummary(`Created ${result.id}`); return { detail: `Created SKOS collection ${result.id}.` };
                  }))}
                  {operationButton('get_skos_collection', 'Load SKOS collection', () => void run('get_skos_collection', async () => {
                    const result = await api.concepts.getCollection(requireValue(skosCollectionId, 'Collection ID'));
                    setSkosSummary(`${result.pref_label}: ${result.members.length} member(s)`); return { detail: `Loaded ${result.members.length} member(s) from ${result.id}.` };
                  }))}
                  {operationButton('update_skos_collection', 'Update SKOS collection', () => void run('update_skos_collection', async () => {
                    const result = await api.concepts.updateCollection(requireValue(skosCollectionId, 'Collection ID'), { pref_label: requireValue(skosCollectionLabel, 'Collection label') });
                    setSkosSummary(`Updated ${result.pref_label}`); return { detail: `Updated SKOS collection ${result.id}.` };
                  }))}
                  {operationButton('delete_skos_collection', 'Delete SKOS collection', () => requestConfirmation('delete_skos_collection', 'Delete SKOS collection?', 'The collection grouping will be permanently removed.', 'Delete collection', async () => {
                    const id = requireValue(skosCollectionId, 'Collection ID'); await api.concepts.deleteCollection(id); return { detail: `Deleted SKOS collection ${id}.` };
                  }, true), true)}
                  {operationButton('replace_skos_collection_members', 'Replace members', () => requestConfirmation('replace_skos_collection_members', 'Replace every collection member?', 'Existing membership and ordering will be replaced by the supplied concept IDs.', 'Replace members', async () => {
                    const ids = skosMemberIds.split(',').map((id) => id.trim()).filter(Boolean);
                    const result = await api.concepts.setCollectionMembers(requireValue(skosCollectionId, 'Collection ID'), { concept_ids: ids });
                    setSkosSummary(`${result.members.length} member(s)`); return { detail: `Replaced membership; server reports ${result.members.length} member(s).` };
                  }, true), true)}
                  {operationButton('add_skos_collection_member', 'Add member', () => void run('add_skos_collection_member', async () => {
                    const collection = requireValue(skosCollectionId, 'Collection ID'); const member = requireValue(skosMemberId, 'Member concept ID');
                    await api.concepts.addCollectionMember(collection, member); return { detail: `Added concept ${member} to collection ${collection}.` };
                  }))}
                  {operationButton('remove_skos_collection_member', 'Remove member', () => requestConfirmation('remove_skos_collection_member', 'Remove collection member?', 'The concept will be removed from this collection.', 'Remove member', async () => {
                    const collection = requireValue(skosCollectionId, 'Collection ID'); const member = requireValue(skosMemberId, 'Member concept ID');
                    await api.concepts.removeCollectionMember(collection, member); return { detail: `Removed concept ${member} from collection ${collection}.` };
                  }, true), true)}
                </div>
                {skosSummary && <p className="break-words text-sm text-muted-foreground">{skosSummary}</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="graph">
          <Card>
            <CardHeader><CardTitle className="text-base">Graph knowledge operations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Input aria-label="Graph note ID" placeholder="Root note ID" value={graphNoteId} onChange={(event) => setGraphNoteId(event.target.value)} />
                <Input aria-label="Graph snapshot label" placeholder="Snapshot label" value={snapshotLabel} onChange={(event) => setSnapshotLabel(event.target.value)} />
                <Input aria-label="Before snapshot ID" placeholder="Before snapshot ID" value={beforeSnapshotId} onChange={(event) => setBeforeSnapshotId(event.target.value)} />
                <Input aria-label="After snapshot ID" placeholder="After snapshot ID" value={afterSnapshotId} onChange={(event) => setAfterSnapshotId(event.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={graphDryRun} onChange={(event) => setGraphDryRun(event.target.checked)} />Dry run graph algorithms</label>
              <div className="flex flex-wrap gap-2">
                {operationButton('explore_graph', 'Explore graph', () => void run('explore_graph', async () => {
                  const result = await api.concepts.exploreKnowledgeGraph(requireValue(graphNoteId, 'Graph note ID'));
                  setGraphSummary(`${result.node_count} nodes, ${result.edge_count} edges`); return { detail: `${result.node_count} nodes and ${result.edge_count} edges; ${result.truncated_nodes + result.truncated_edges} truncated.` };
                }))}
                {operationButton('graph_topology_stats', 'Topology stats', () => void run('graph_topology_stats', async () => {
                  const result = await api.concepts.getKnowledgeGraphTopology(); setGraphSummary(`${result.total_notes} notes, ${result.total_links} links`); return { detail: `${result.connected_components} components; ${result.isolated_nodes} isolated; average degree ${result.avg_degree}.`, outcome: result.isolated_nodes > 0 ? 'partial' : 'success' };
                }))}
                {operationButton('graph_diagnostics', 'Graph diagnostics', () => void run('graph_diagnostics', async () => {
                  const result = await api.concepts.getKnowledgeGraphDiagnostics(); setGraphSummary(`${result.edge_count} edges; anisotropy ${result.anisotropy_score}`); return { detail: `${result.note_count} notes; ${result.embedding_count} embeddings; degree CV ${result.degree_cv}.` };
                }))}
                {operationButton('list_diagnostics_snapshots', 'Snapshot history', () => void run('list_diagnostics_snapshots', async () => {
                  const results = await api.concepts.listKnowledgeGraphSnapshots(); setGraphSummary(`${results.length} snapshot(s)`); return { detail: `Loaded ${results.length} diagnostics snapshot(s).` };
                }))}
                {operationButton('compare_diagnostics_snapshots', 'Compare snapshots', () => void run('compare_diagnostics_snapshots', async () => {
                  const result = await api.concepts.compareKnowledgeGraphSnapshots(requireValue(beforeSnapshotId, 'Before snapshot ID'), requireValue(afterSnapshotId, 'After snapshot ID'));
                  setGraphSummary(`${result.before.label} to ${result.after.label}`); return { detail: `${result.summary.length} comparison finding(s); degree CV delta ${result.degree_cv_delta ?? 0}.` };
                }))}
                {operationButton('get_cold_spots', 'Cold spots', () => void run('get_cold_spots', async () => {
                  const result = await api.concepts.getKnowledgeGraphColdSpots(); setGraphSummary(`${result.isolated_count} isolated, ${result.cold_access_count} cold`); return { detail: `${result.overlap_count} overlapping cold/isolated notes; ${result.recommendation_count} recommendation(s).`, outcome: result.overlap_count > 0 ? 'partial' : 'success' };
                }))}
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {operationButton('capture_diagnostics_snapshot', 'Capture snapshot', () => requestConfirmation('capture_diagnostics_snapshot', 'Capture graph diagnostics?', 'A bounded diagnostics snapshot will be stored.', 'Capture snapshot', async () => {
                  const result = await api.concepts.captureKnowledgeGraphSnapshot(requireValue(snapshotLabel, 'Snapshot label')); return { detail: `Captured snapshot ${result.id} at ${result.captured_at}.` };
                }))}
                {operationButton('recompute_snn_scores', 'Recompute SNN', () => requestConfirmation('recompute_snn_scores', graphDryRun ? 'Run SNN preview?' : 'Apply SNN recomputation?', graphDryRun ? 'No edge changes will be persisted.' : 'Edge scores may be updated or pruned.', graphDryRun ? 'Run preview' : 'Apply SNN', async () => {
                  const result = await api.concepts.recomputeKnowledgeGraphSnn({ dry_run: graphDryRun }); return { detail: `${result.updated} updated, ${result.pruned} pruned; dry_run=${result.dry_run}.` };
                }, !graphDryRun), !graphDryRun)}
                {operationButton('pfnet_sparsify', 'Run PFNET', () => requestConfirmation('pfnet_sparsify', graphDryRun ? 'Run PFNET preview?' : 'Apply PFNET sparsification?', graphDryRun ? 'No edges will be removed.' : 'Redundant graph edges may be removed.', graphDryRun ? 'Run preview' : 'Apply PFNET', async () => {
                  const result = await api.concepts.sparsifyKnowledgeGraphPfnet({ dry_run: graphDryRun }); return { detail: `${result.retained}/${result.total_edges} retained; ${result.pruned} pruned; dry_run=${result.dry_run}.` };
                }, !graphDryRun), !graphDryRun)}
                {operationButton('coarse_community_detection', 'Detect communities', () => requestConfirmation('coarse_community_detection', 'Detect and store graph communities?', 'Community assignments may change for knowledge nodes.', 'Detect communities', async () => {
                  const result = await api.concepts.detectKnowledgeGraphCommunities(); return { detail: `${result.community_count} communities across ${result.note_count} notes; modularity=${result.modularity_q}.` };
                }, true), true)}
                {operationButton('trigger_graph_maintenance', 'Run graph maintenance', () => requestConfirmation('trigger_graph_maintenance', 'Queue graph maintenance?', 'Normalize, SNN, PFNET, and snapshot steps will be queued.', 'Queue maintenance', async () => {
                  const result = await api.concepts.triggerKnowledgeGraphMaintenance(); return { detail: `${result.status}; job=${result.id ?? 'existing'}; ${result.steps.length} step(s).`, outcome: result.status === 'already_pending' ? 'partial' : 'success' };
                }, true), true)}
              </div>
              {graphSummary && <p className="break-words text-sm text-muted-foreground">{graphSummary}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="text-base">Operation receipt</CardTitle></CardHeader>
        <CardContent><ReceiptView receipt={receipt} /></CardContent>
      </Card>

      <AlertDialog open={confirmation !== null} onOpenChange={(open) => { if (!open) setConfirmation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmation?.destructive ? <ShieldAlert className="size-5 text-destructive" /> : <ArchiveRestore className="size-5" />}
              {confirmation?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmation?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmation?.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
              onClick={() => {
                const pending = confirmation;
                setConfirmation(null);
                void pending?.run();
              }}
            >
              {confirmation?.destructive && <Trash2 className="size-4" />}
              {confirmation?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
