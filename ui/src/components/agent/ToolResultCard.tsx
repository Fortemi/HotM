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

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/api";
import { StreamingVideoPlayer, StreamingAudioPlayer } from "@/components/attachments/StreamingMedia";
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
  Archive,
  List,
  Paperclip,
  Image,
  Film,
  Music,
  FileIcon,
  Download,
  ExternalLink,
} from "lucide-react";

interface ToolResultCardProps {
  toolName: string;
  result: unknown;
  onNoteClick?: (noteId: string) => void;
}

export function ToolResultCard({ toolName, result, onNoteClick }: ToolResultCardProps) {
  switch (toolName) {
    case "search_notes":
      return <SearchNotesCard result={result as SearchNotesData} onNoteClick={onNoteClick} />;
    case "create_note":
      return <CreateNoteCard result={result as CreateNoteData} onNoteClick={onNoteClick} />;
    case "get_note":
      return <GetNoteCard result={result as GetNoteData} onNoteClick={onNoteClick} />;
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
      return <GetRelatedCard result={result as GetRelatedData} onNoteClick={onNoteClick} />;
    case "list_archives":
      return <ListArchivesCard result={result as ListArchivesData} />;
    case "list_notes":
      return <ListNotesCard result={result as ListNotesData} onNoteClick={onNoteClick} />;
    case "get_attachments":
      return <GetAttachmentsCard result={result as GetAttachmentsData} />;
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

interface AttachmentItem {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status?: string;
  ai_description?: string | null;
  extracted_text?: string | null;
  has_preview?: boolean;
}

interface GetNoteData {
  note_id: string;
  title?: string | null;
  content: string;
  tags: string[];
  created_at: string;
  attachment_count?: number;
  attachments?: AttachmentItem[];
}

interface GetAttachmentsData {
  note_id: string;
  attachments: AttachmentItem[];
  total: number;
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

interface ListArchivesData {
  archives: Array<{
    name: string;
    description?: string;
    is_default: boolean;
    note_count?: number;
    size_bytes?: number;
    created_at: string;
  }>;
}

interface ListNotesData {
  notes: Array<{
    note_id: string;
    title?: string;
    snippet: string;
    tags: string[];
    created_at: string;
    has_attachments?: boolean;
  }>;
  total: number;
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
  onClick,
}: {
  item: SearchNotesData;
  showScore?: boolean;
  onClick?: (noteId: string) => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      className={`group flex w-full items-start justify-between gap-2 rounded-md border-b py-2 text-left last:border-0 ${
        onClick
          ? "cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          : ""
      }`}
      {...(onClick ? { onClick: () => onClick(item.note_id), type: "button" as const } : {})}
    >
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${onClick ? "text-primary underline-offset-2 group-hover:underline" : ""}`}>
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
      {showScore && item.score != null && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {(item.score * 100).toFixed(0)}%
        </span>
      )}
    </Wrapper>
  );
}

function SearchNotesCard({ result, onNoteClick }: { result: SearchNotesData | SearchNotesData[]; onNoteClick?: (noteId: string) => void }) {
  const items = Array.isArray(result) ? result : [result];
  return (
    <CardShell icon={Search} title={`${items.length} result${items.length === 1 ? "" : "s"}`}>
      <div className="max-h-60 space-y-0 overflow-y-auto">
        {items.map((item) => (
          <NotePreview key={item.note_id} item={item} showScore onClick={onNoteClick} />
        ))}
      </div>
    </CardShell>
  );
}

function CreateNoteCard({ result, onNoteClick }: { result: CreateNoteData; onNoteClick?: (noteId: string) => void }) {
  return (
    <CardShell icon={Plus} title="Note created">
      <p className="text-sm">{result.title ?? "New note"}</p>
      <p className="text-xs text-muted-foreground">
        ID:{" "}
        {onNoteClick ? (
          <button
            type="button"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            onClick={() => onNoteClick(result.note_id)}
          >
            {result.note_id}
          </button>
        ) : (
          result.note_id
        )}{" "}
        &middot; Mode: {result.revision_mode}
      </p>
    </CardShell>
  );
}

function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-1 border-t pt-2">
      {children}
    </div>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function GetNoteCard({ result, onNoteClick }: { result: GetNoteData; onNoteClick?: (noteId: string) => void }) {
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
      {result.attachment_count != null && result.attachment_count > 0 && (
        <div className="mt-2 border-t pt-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            {result.attachment_count} attachment{result.attachment_count === 1 ? "" : "s"}
          </div>
          {result.attachments && result.attachments.length > 0 && (
            <div className="mt-1 space-y-1">
              {result.attachments.slice(0, 4).map((att) => (
                <AttachmentRow key={att.id} attachment={att} />
              ))}
              {result.attachments.length > 4 && (
                <p className="text-[10px] text-muted-foreground">
                  +{result.attachments.length - 4} more
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <ActionBar>
        {onNoteClick && (
          <ActionButton
            onClick={() => onNoteClick(result.note_id)}
            icon={ExternalLink}
            label="Open note"
          />
        )}
        <ActionButton
          onClick={() => navigator.clipboard.writeText(result.content)}
          icon={FileText}
          label="Copy content"
        />
      </ActionBar>
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

function GetRelatedCard({ result, onNoteClick }: { result: GetRelatedData; onNoteClick?: (noteId: string) => void }) {
  return (
    <CardShell
      icon={GitBranch}
      title={`${result.notes.length} related note${result.notes.length === 1 ? "" : "s"}`}
    >
      <div className="max-h-48 space-y-0 overflow-y-auto">
        {result.notes.map((item) => (
          <NotePreview key={item.note_id} item={item} showScore onClick={onNoteClick} />
        ))}
      </div>
    </CardShell>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function ListArchivesCard({ result }: { result: ListArchivesData }) {
  return (
    <CardShell
      icon={Archive}
      title={`${result.archives.length} archive${result.archives.length === 1 ? "" : "s"}`}
    >
      <div className="space-y-2">
        {result.archives.map((a) => (
          <div key={a.name} className="rounded-md border p-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{a.name}</span>
              {a.is_default && (
                <Badge variant="outline" className="text-[10px]">
                  default
                </Badge>
              )}
            </div>
            {a.description && (
              <p className="text-xs text-muted-foreground">{a.description}</p>
            )}
            <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
              {a.note_count != null && <span>{a.note_count} notes</span>}
              {a.size_bytes != null && <span>{formatBytes(a.size_bytes)}</span>}
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function ListNotesCard({ result, onNoteClick }: { result: ListNotesData; onNoteClick?: (noteId: string) => void }) {
  return (
    <CardShell
      icon={List}
      title={`${result.notes.length} note${result.notes.length === 1 ? "" : "s"}`}
    >
      <div className="max-h-60 space-y-0 overflow-y-auto">
        {result.notes.map((n) => (
          <NotePreview
            key={n.note_id}
            item={{ note_id: n.note_id, title: n.title, snippet: n.snippet, score: 0, tags: n.tags }}
            onClick={onNoteClick}
          />
        ))}
      </div>
    </CardShell>
  );
}

function AttachmentIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith("image/")) return <Image className="h-3.5 w-3.5 text-blue-500" />;
  if (contentType.startsWith("video/")) return <Film className="h-3.5 w-3.5 text-purple-500" />;
  if (contentType.startsWith("audio/")) return <Music className="h-3.5 w-3.5 text-green-500" />;
  return <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />;
}

function AttachmentThumbnail({ attachment }: { attachment: AttachmentItem }) {
  const [error, setError] = useState(false);
  const isImage = attachment.content_type.startsWith("image/");

  if (!isImage || !attachment.id || error) {
    return <AttachmentIcon contentType={attachment.content_type} />;
  }

  const thumbnailUrl = api.attachments.getThumbnailUrl(attachment.id);

  return (
    <img
      src={thumbnailUrl}
      alt={attachment.filename}
      loading="lazy"
      onError={() => setError(true)}
      className="h-10 w-10 shrink-0 rounded object-cover"
    />
  );
}

function AttachmentRow({ attachment }: { attachment: AttachmentItem }) {
  const isVideo = attachment.content_type.startsWith("video/");
  const isAudio = attachment.content_type.startsWith("audio/");
  const isImage = attachment.content_type.startsWith("image/");
  const isMedia = isVideo || isAudio || isImage;
  const downloadUrl = attachment.id ? api.attachments.getDownloadUrl(attachment.id) : undefined;

  // Inline video player
  if (isVideo && attachment.id) {
    return (
      <div className="space-y-1 rounded-md border p-1.5">
        <StreamingVideoPlayer
          attachmentId={attachment.id}
          filename={attachment.filename}
          sizeBytes={attachment.size_bytes}
          className="max-h-64"
        />
        <AttachmentMeta attachment={attachment} downloadUrl={downloadUrl} />
      </div>
    );
  }

  // Inline audio player
  if (isAudio && attachment.id) {
    return (
      <div className="space-y-1 rounded-md border p-1.5">
        <StreamingAudioPlayer
          attachmentId={attachment.id}
          filename={attachment.filename}
          sizeBytes={attachment.size_bytes}
        />
        <AttachmentMeta attachment={attachment} downloadUrl={downloadUrl} />
      </div>
    );
  }

  // Inline image preview
  if (isImage && attachment.id) {
    return (
      <div className="space-y-1 rounded-md border p-1.5">
        <img
          src={api.attachments.getDownloadUrl(attachment.id)}
          alt={attachment.filename}
          loading="lazy"
          className="max-h-64 w-full rounded object-contain"
        />
        <AttachmentMeta attachment={attachment} downloadUrl={downloadUrl} />
      </div>
    );
  }

  // Non-media fallback — compact row with icon and download
  return (
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
      <AttachmentThumbnail attachment={attachment} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{attachment.filename}</p>
        <p className="text-[10px] text-muted-foreground">
          {attachment.content_type.split("/")[1]?.toUpperCase() ?? attachment.content_type}
          {attachment.size_bytes > 0 && ` · ${formatBytes(attachment.size_bytes)}`}
        </p>
        {attachment.ai_description && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/70 italic">
            {attachment.ai_description}
          </p>
        )}
      </div>
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title={isMedia ? "Open media" : "Download file"}
        >
          {isMedia ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        </a>
      )}
    </div>
  );
}

/** Compact metadata + download link shown below inline media previews. */
function AttachmentMeta({ attachment, downloadUrl }: { attachment: AttachmentItem; downloadUrl?: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{attachment.filename}</p>
        <p className="text-[10px] text-muted-foreground">
          {attachment.content_type.split("/")[1]?.toUpperCase() ?? attachment.content_type}
          {attachment.size_bytes > 0 && ` · ${formatBytes(attachment.size_bytes)}`}
        </p>
        {attachment.ai_description && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/70 italic">
            {attachment.ai_description}
          </p>
        )}
      </div>
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Download"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

function GetAttachmentsCard({ result }: { result: GetAttachmentsData }) {
  return (
    <CardShell
      icon={Paperclip}
      title={`${result.total} attachment${result.total === 1 ? "" : "s"}`}
    >
      {result.attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No attachments found.</p>
      ) : (
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {result.attachments.map((att) => (
            <AttachmentRow key={att.id} attachment={att} />
          ))}
        </div>
      )}
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
