/**
 * ToolResultCard — renders rich cards for AI agent tool results.
 *
 * Each tool type gets a distinct visual presentation:
 * - search_notes → list of note preview cards with score, snippet, tags
 * - create_note → confirmation with link to the new note
 * - get_note → note content preview with metadata
 * - revise_note → status card showing revision progress
 * - update_tags → tag list showing current state
 * - link_notes → link confirmation between two notes
 * - list_collections → collection list
 * - search_concepts → concept taxonomy results
 * - get_related → related notes with similarity scores
 */

import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Search,
  Plus,
  RefreshCw,
  Tag,
  Link2,
  FolderOpen,
  BookOpen,
  GitBranch,
} from "lucide-react";

interface ToolResultCardProps {
  toolName: string;
  result: unknown;
}

export function ToolResultCard({ toolName, result }: ToolResultCardProps) {
  switch (toolName) {
    case "search_notes":
      return <SearchNotesCard result={result as SearchNotesData} />;
    case "create_note":
      return <CreateNoteCard result={result as CreateNoteData} />;
    case "get_note":
      return <GetNoteCard result={result as GetNoteData} />;
    case "revise_note":
      return <ReviseNoteCard result={result as ReviseNoteData} />;
    case "update_tags":
      return <UpdateTagsCard result={result as UpdateTagsData} />;
    case "link_notes":
      return <LinkNotesCard result={result as LinkNotesData} />;
    case "list_collections":
      return <ListCollectionsCard result={result as ListCollectionsData} />;
    case "search_concepts":
      return <SearchConceptsCard result={result as SearchConceptsData} />;
    case "get_related":
      return <GetRelatedCard result={result as GetRelatedData} />;
    default:
      return <GenericCard toolName={toolName} result={result} />;
  }
}

// ---------------------------------------------------------------------------
// Result data shapes (kept simple — no import cycle with tools.ts)
// ---------------------------------------------------------------------------

interface SearchNotesData {
  note_id: string;
  title?: string;
  snippet: string;
  score: number;
  tags?: string[];
}

interface CreateNoteData {
  note_id: string;
  title?: string | null;
  revision_mode: string;
}

interface GetNoteData {
  note_id: string;
  title?: string | null;
  content: string;
  tags: string[];
  created_at: string;
}

interface ReviseNoteData {
  note_id: string;
  status: string;
}

interface UpdateTagsData {
  note_id: string;
  tags: string[];
}

interface LinkNotesData {
  source_id: string;
  target_id: string;
  kind: string;
}

interface ListCollectionsData {
  collections: Array<{ id: string; name: string; description?: string }>;
}

interface SearchConceptsData {
  concepts: Array<{
    id: string;
    label: string;
    notation?: string;
    status?: string;
    note_count?: number;
    definition?: string; // legacy compat
  }>;
}

interface GetRelatedData {
  notes: SearchNotesData[];
}

// ---------------------------------------------------------------------------
// Individual card components
// ---------------------------------------------------------------------------

function CardShell({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

function NotePreview({
  item,
  showScore,
}: {
  item: SearchNotesData;
  showScore?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border-b py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {item.title ?? item.note_id}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {item.snippet}
        </p>
        {item.tags && item.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
            {item.tags.length > 4 && (
              <span className="text-[10px] text-muted-foreground">
                +{item.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
      {showScore && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {(item.score * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
}

function SearchNotesCard({ result }: { result: SearchNotesData | SearchNotesData[] }) {
  const items = Array.isArray(result) ? result : [result];
  return (
    <CardShell icon={Search} title={`${items.length} result${items.length === 1 ? "" : "s"}`}>
      <div className="max-h-60 space-y-0 overflow-y-auto">
        {items.map((item) => (
          <NotePreview key={item.note_id} item={item} showScore />
        ))}
      </div>
    </CardShell>
  );
}

function CreateNoteCard({ result }: { result: CreateNoteData }) {
  return (
    <CardShell icon={Plus} title="Note created">
      <p className="text-sm">{result.title ?? "New note"}</p>
      <p className="text-xs text-muted-foreground">
        ID: {result.note_id} &middot; Mode: {result.revision_mode}
      </p>
    </CardShell>
  );
}

function GetNoteCard({ result }: { result: GetNoteData }) {
  return (
    <CardShell icon={FileText} title={result.title ?? result.note_id}>
      <p className="line-clamp-4 text-sm text-muted-foreground">
        {result.content}
      </p>
      {result.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {result.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </CardShell>
  );
}

function ReviseNoteCard({ result }: { result: ReviseNoteData }) {
  return (
    <CardShell icon={RefreshCw} title="Revision queued">
      <p className="text-sm">
        Note {result.note_id} — {result.status}
      </p>
    </CardShell>
  );
}

function UpdateTagsCard({ result }: { result: UpdateTagsData }) {
  return (
    <CardShell icon={Tag} title="Tags updated">
      <div className="flex flex-wrap gap-1">
        {result.tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs">
            {tag}
          </Badge>
        ))}
        {result.tags.length === 0 && (
          <span className="text-xs text-muted-foreground">No tags</span>
        )}
      </div>
    </CardShell>
  );
}

function LinkNotesCard({ result }: { result: LinkNotesData }) {
  return (
    <CardShell icon={Link2} title="Link created">
      <p className="text-sm">
        {result.source_id}{" "}
        <span className="text-muted-foreground">→ {result.kind} →</span>{" "}
        {result.target_id}
      </p>
    </CardShell>
  );
}

function ListCollectionsCard({ result }: { result: ListCollectionsData }) {
  return (
    <CardShell
      icon={FolderOpen}
      title={`${result.collections.length} collection${result.collections.length === 1 ? "" : "s"}`}
    >
      <div className="space-y-1">
        {result.collections.map((c) => (
          <div key={c.id} className="text-sm">
            <span className="font-medium">{c.name}</span>
            {c.description && (
              <span className="ml-1 text-xs text-muted-foreground">
                — {c.description}
              </span>
            )}
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function SearchConceptsCard({ result }: { result: SearchConceptsData }) {
  return (
    <CardShell
      icon={BookOpen}
      title={`${result.concepts.length} concept${result.concepts.length === 1 ? "" : "s"}`}
    >
      <div className="space-y-1">
        {result.concepts.map((c) => (
          <div key={c.id} className="text-sm">
            <span className="font-medium">{c.label}</span>
            {c.notation && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {c.notation}
              </span>
            )}
            {c.note_count != null && c.note_count > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({c.note_count} note{c.note_count === 1 ? "" : "s"})
              </span>
            )}
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function GetRelatedCard({ result }: { result: GetRelatedData }) {
  return (
    <CardShell
      icon={GitBranch}
      title={`${result.notes.length} related note${result.notes.length === 1 ? "" : "s"}`}
    >
      <div className="max-h-48 space-y-0 overflow-y-auto">
        {result.notes.map((item) => (
          <NotePreview key={item.note_id} item={item} showScore />
        ))}
      </div>
    </CardShell>
  );
}

function GenericCard({
  toolName,
  result,
}: {
  toolName: string;
  result: unknown;
}) {
  return (
    <CardShell icon={FileText} title={toolName}>
      <pre className="max-h-32 overflow-auto text-xs text-muted-foreground">
        {JSON.stringify(result, null, 2)}
      </pre>
    </CardShell>
  );
}
