import * as React from 'react';
import { FileText, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '@/api';
import type { CreateDocumentTypeRequest, DocumentType } from '@/api/types-extended';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

const EMPTY_FORM: CreateDocumentTypeRequest = {
  name: '',
  display_name: '',
  category: '',
  description: '',
  chunking_strategy: '',
  file_extensions: [],
  filename_patterns: [],
  content_magic: [],
  syntax_language: '',
  embedding_model_hint: '',
};

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value?: string[]): string {
  return value?.join(', ') ?? '';
}

function toRequest(form: CreateDocumentTypeRequest): CreateDocumentTypeRequest {
  return {
    name: form.name.trim(),
    display_name: form.display_name.trim(),
    category: form.category.trim(),
    description: form.description?.trim() || undefined,
    chunking_strategy: form.chunking_strategy.trim(),
    file_extensions: form.file_extensions?.filter(Boolean),
    filename_patterns: form.filename_patterns?.filter(Boolean),
    content_magic: form.content_magic?.filter(Boolean),
    syntax_language: form.syntax_language?.trim() || null,
    embedding_model_hint: form.embedding_model_hint?.trim() || null,
  };
}

export function DocumentTypesPanel() {
  const [documentTypes, setDocumentTypes] = React.useState<DocumentType[]>([]);
  const [form, setForm] = React.useState<CreateDocumentTypeRequest>(EMPTY_FORM);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deletingName, setDeletingName] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadDocumentTypes = React.useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const types = await api.documents.list();
      setDocumentTypes(types);
    } catch (err) {
      console.error('Failed to load document types:', err);
      setStatus({ type: 'error', message: 'Failed to load document types' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDocumentTypes();
  }, [loadDocumentTypes]);

  const updateForm = <K extends keyof CreateDocumentTypeRequest>(key: K, value: CreateDocumentTypeRequest[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit = form.name.trim() && form.display_name.trim() && form.category.trim() && form.chunking_strategy.trim();

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || saving) return;

    setSaving(true);
    setStatus(null);
    try {
      const created = await api.documents.create(toRequest(form));
      setDocumentTypes((prev) => [created, ...prev.filter((item) => item.name !== created.name)]);
      setForm(EMPTY_FORM);
      setStatus({ type: 'success', message: 'Document type created' });
    } catch (err) {
      console.error('Failed to create document type:', err);
      setStatus({ type: 'error', message: 'Failed to create document type' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: DocumentType) => {
    if (type.is_system || deletingName) return;

    setDeletingName(type.name);
    setStatus(null);
    try {
      await api.documents.delete(type.name);
      setDocumentTypes((prev) => prev.filter((item) => item.name !== type.name));
      setStatus({ type: 'success', message: 'Document type deleted' });
    } catch (err) {
      console.error('Failed to delete document type:', err);
      setStatus({ type: 'error', message: 'Failed to delete document type' });
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Document Types
          </CardTitle>
          <CardDescription>Review system types and manage custom detection/chunking profiles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {loading ? 'Loading document types...' : documentTypes.length + ' document types'}
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadDocumentTypes()} disabled={loading}>
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
              Loading document types...
            </div>
          ) : documentTypes.length === 0 ? (
            <div className="rounded border p-4 text-sm text-muted-foreground">No document types returned by the API.</div>
          ) : (
            <div className="grid gap-3">
              {documentTypes.map((type) => (
                <div key={type.name} className="rounded border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">{type.display_name}</div>
                        <Badge variant={type.is_system ? 'secondary' : 'outline'}>{type.is_system ? 'system' : 'custom'}</Badge>
                        <Badge variant="outline">{type.category}</Badge>
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">{type.name}</div>
                      {type.description && <p className="mt-2 text-sm text-muted-foreground">{type.description}</p>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={type.is_system || deletingName === type.name}
                      onClick={() => void handleDelete(type)}
                    >
                      {deletingName === type.name ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      Delete
                    </Button>
                  </div>

                  <Separator className="my-3" />
                  <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Chunking</div>
                      <div>{type.chunking_strategy}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Extensions</div>
                      <div>{type.file_extensions?.length ? type.file_extensions.join(', ') : 'none'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Syntax</div>
                      <div>{type.syntax_language || 'none'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Embedding hint</div>
                      <div>{type.embedding_model_hint || 'default'}</div>
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
            Create Custom Type
          </CardTitle>
          <CardDescription>Custom types extend Fortemi detection without changing system defaults.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleCreate}>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="doc-type-name">Name</label>
              <Input id="doc-type-name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="research_note" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="doc-type-display">Display name</label>
              <Input id="doc-type-display" value={form.display_name} onChange={(event) => updateForm('display_name', event.target.value)} placeholder="Research Note" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="doc-type-category">Category</label>
              <Input id="doc-type-category" value={form.category} onChange={(event) => updateForm('category', event.target.value)} placeholder="research" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="doc-type-chunking">Chunking strategy</label>
              <Input id="doc-type-chunking" value={form.chunking_strategy} onChange={(event) => updateForm('chunking_strategy', event.target.value)} placeholder="semantic" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="doc-type-extensions">File extensions</label>
              <Input id="doc-type-extensions" value={joinList(form.file_extensions)} onChange={(event) => updateForm('file_extensions', splitList(event.target.value))} placeholder=".md, .txt" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="doc-type-patterns">Filename patterns</label>
              <Input id="doc-type-patterns" value={joinList(form.filename_patterns)} onChange={(event) => updateForm('filename_patterns', splitList(event.target.value))} placeholder="*_notes.md" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="doc-type-description">Description</label>
              <Textarea id="doc-type-description" value={form.description ?? ''} onChange={(event) => updateForm('description', event.target.value)} placeholder="How this type should be used" className="min-h-20" />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={!canSubmit || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create Document Type
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
