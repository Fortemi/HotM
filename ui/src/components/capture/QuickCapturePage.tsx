import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type DragEvent,
} from "react";
import {
  Zap,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Paperclip,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/api";
import type { Collection, MemoryArchive, Tag } from "@/api";
import type { Concept, DocumentType } from "@/api/types-extended";
import { useStickySettings } from "./useStickySettings";
import { useNoteCommit, type CommitResult } from "./useNoteCommit";
import { SessionLog } from "./SessionLog";
import { ProcessingOptionsPanel } from "./ProcessingOptionsPanel";

const NONE_VALUE = "__none__";

export function QuickCapturePage() {
  const {
    settings,
    setArchive,
    setCollection,
    setConcept,
    addTag,
    removeTag,
    setFormat,
    setRevisionMode,
    setDocumentType,
    setContextFilter,
    setProcessingOption,
  } = useStickySettings();
  const { commit, isCommitting, lastError, retry, clearError } =
    useNoteCommit();

  // Data loading
  const [archives, setArchives] = useState<MemoryArchive[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});

  // Capture state
  const [content, setContent] = useState("");
  const [sessionNotes, setSessionNotes] = useState<CommitResult[]>([]);
  const [successFlash, setSuccessFlash] = useState(false);

  // Pending file attachments
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Concept autocomplete
  const [conceptQuery, setConceptQuery] = useState("");
  const [conceptSuggestions, setConceptSuggestions] = useState<Concept[]>([]);
  const [conceptOpen, setConceptOpen] = useState(false);
  const [conceptLoading, setConceptLoading] = useState(false);

  // Tag input
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestionsOpen, setTagSuggestionsOpen] = useState(false);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const errorRegionRef = useRef<HTMLDivElement>(null);
  const conceptDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Focus textarea on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Load data on mount
  useEffect(() => {
    const errors: Record<string, boolean> = {};

    api.archives
      .list()
      .then((a) => setArchives(Array.isArray(a) ? a : []))
      .catch(() => {
        errors.archives = true;
        setLoadErrors((prev) => ({ ...prev, archives: true }));
      });

    api.collections
      .list()
      .then((raw) => {
        const cols = Array.isArray(raw) ? raw : [];
        setCollections(cols);
        // Clear stale collection reference
        if (
          settings.collectionId &&
          !cols.some((c) => c.id === settings.collectionId)
        ) {
          setCollection(null, "");
        }
      })
      .catch(() => {
        errors.collections = true;
        setLoadErrors((prev) => ({ ...prev, collections: true }));
      });

    api.tags
      .list()
      .then((t) => setAllTags(Array.isArray(t) ? t : []))
      .catch(() => {
        errors.tags = true;
        setLoadErrors((prev) => ({ ...prev, tags: true }));
      });

    api.documents
      .list()
      .then((types) => setDocumentTypes(Array.isArray(types) ? types : []))
      .catch(() => {
        setLoadErrors((prev) => ({ ...prev, documentTypes: true }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Concept autocomplete debounce
  useEffect(() => {
    if (conceptDebounce.current) clearTimeout(conceptDebounce.current);

    if (conceptQuery.length < 2) {
      setConceptSuggestions([]);
      return;
    }

    setConceptLoading(true);
    conceptDebounce.current = setTimeout(async () => {
      try {
        const result = await api.concepts.autocompleteConcepts(conceptQuery);
        const suggestions = Array.isArray(result)
          ? (result as Concept[])
          : ((result as { suggestions?: Concept[] }).suggestions ?? []);
        setConceptSuggestions(suggestions);
      } catch {
        setConceptSuggestions([]);
      } finally {
        setConceptLoading(false);
      }
    }, 200);

    return () => {
      if (conceptDebounce.current) clearTimeout(conceptDebounce.current);
    };
  }, [conceptQuery]);

  // Auto-grow textarea
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const minH = 120; // ~5 lines
    const maxH = 288; // ~12 lines
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minH), maxH)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [content, adjustTextareaHeight]);

  // Format auto-detection on paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;

      // Auto-detect markdown patterns
      const markdownPatterns = [/^#+\s/, /\*\*[^*]+\*\*/, /```/, /\[.+\]\(.+\)/];
      const hasMarkdown = markdownPatterns.some((p) => p.test(text));
      if (hasMarkdown && settings.format !== "markdown") {
        setFormat("markdown");
      }
    },
    [settings.format, setFormat]
  );

  // File attachment handlers
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setPendingFiles((prev) => [...prev, ...arr]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  // Commit handler
  const handleCommit = useCallback(async () => {
    const trimmed = content.trim();
    const hasFiles = pendingFiles.length > 0;

    // Need either text or files
    if ((!trimmed && !hasFiles) || isCommitting) return;

    // "Attachment-as-note": if files but no text, auto-generate content from filenames
    const noteContent = trimmed
      ? trimmed
      : pendingFiles
          .map((f) => f.name)
          .join(", ");

    const savedContent = content;
    const savedFiles = [...pendingFiles];

    try {
      const result = await commit(noteContent, settings, pendingFiles.length > 0 ? pendingFiles : undefined);
      setContent("");
      setPendingFiles([]);
      setSessionNotes((prev) => [result, ...prev]);
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 400);

      // Announce to screen reader
      if (liveRegionRef.current) {
        let announcement = `Note committed${
          result.attachmentCount > 0
            ? ` with ${result.attachmentCount} attachment${result.attachmentCount > 1 ? "s" : ""}`
            : ""
        }.`;
        if (result.warnings.length > 0) {
          announcement += ` ${result.warnings.length} warning${result.warnings.length > 1 ? "s" : ""}: ${result.warnings[0]}`;
        }
        announcement += ` ${sessionNotes.length + 1} notes captured this session.`;
        liveRegionRef.current.textContent = announcement;
      }

      // Restore focus
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch {
      // Content preserved, error shown via lastError
      setContent(savedContent);
      setPendingFiles(savedFiles);
      if (errorRegionRef.current) {
        errorRegionRef.current.textContent =
          "Failed to save note. Your text is preserved.";
      }
    }
  }, [content, pendingFiles, isCommitting, commit, settings, sessionNotes.length]);

  // Keyboard handler for textarea
  const handleTextareaKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Shift+Enter or Ctrl/Cmd+Enter to commit
      if (
        (e.shiftKey && e.key === "Enter") ||
        ((e.ctrlKey || e.metaKey) && e.key === "Enter")
      ) {
        e.preventDefault();
        handleCommit();
        return;
      }

      // Escape to clear (with confirmation if > 20 chars)
      if (e.key === "Escape" && content.length > 0) {
        if (content.length <= 20 || window.confirm("Clear note content?")) {
          setContent("");
        }
      }
    },
    [handleCommit, content]
  );

  // Tag input handlers
  const handleTagKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (
        (e.key === "Enter" || e.key === "Tab") &&
        tagInput.trim()
      ) {
        e.preventDefault();
        addTag(tagInput.trim());
        setTagInput("");
        setTagSuggestionsOpen(false);
      }

      if (
        e.key === "Backspace" &&
        tagInput === "" &&
        settings.tags.length > 0
      ) {
        removeTag(settings.tags[settings.tags.length - 1]);
      }
    },
    [tagInput, addTag, removeTag, settings.tags]
  );

  const filteredTagSuggestions = allTags.filter(
    (t) =>
      !settings.tags.includes(t.name) &&
      t.name.toLowerCase().includes(tagInput.toLowerCase())
  );

  const charCount = content.length;
  const charColor =
    charCount > 5000
      ? "text-red-500"
      : charCount > 2000
      ? "text-amber-500"
      : "text-muted-foreground";

  const sessionCount = sessionNotes.length;

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Screen reader live regions */}
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="polite"
        className="sr-only"
      />
      <div
        ref={errorRegionRef}
        role="alert"
        aria-live="assertive"
        className="sr-only"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold tracking-tight">
            Quick Capture
          </h2>
        </div>
        <Badge variant="secondary" className="transition-transform">
          <span aria-label={`${sessionCount} notes captured this session`}>
            {sessionCount} {sessionCount === 1 ? "note" : "notes"}
          </span>
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground px-1 pb-4">
        Capture ideas fast. Settings stay until you change them.
      </p>

      {/* Classification Bar */}
      <div className="bg-muted/40 border border-border rounded-lg px-4 py-3 space-y-3 mb-4">
        <div className="flex flex-wrap gap-3">
          {/* Archive Selector (hidden if only one archive) */}
          {archives.length > 1 && (
            <div className="min-w-[140px]">
              <label className="text-xs text-muted-foreground block mb-1">
                Archive
              </label>
              {loadErrors.archives ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    api.archives
                      .list()
                      .then(setArchives)
                      .then(() =>
                        setLoadErrors((prev) => ({
                          ...prev,
                          archives: false,
                        }))
                      )
                  }
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Retry
                </Button>
              ) : (
                <Select
                  value={settings.archive ?? NONE_VALUE}
                  onValueChange={(v) =>
                    setArchive(v === NONE_VALUE ? null : v)
                  }
                >
                  <SelectTrigger
                    className="h-8 text-xs"
                    aria-label="Archive"
                  >
                    <SelectValue placeholder="(default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>(default)</SelectItem>
                    {archives.map((a) => (
                      <SelectItem key={a.name} value={a.name}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Collection Selector */}
          <div className="min-w-[160px] flex-1">
            <label className="text-xs text-muted-foreground block mb-1">
              Collection
            </label>
            {loadErrors.collections ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  api.collections
                    .list()
                    .then(setCollections)
                    .then(() =>
                      setLoadErrors((prev) => ({
                        ...prev,
                        collections: false,
                      }))
                    )
                }
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Retry
              </Button>
            ) : (
              <Select
                value={settings.collectionId ?? NONE_VALUE}
                onValueChange={(v) => {
                  if (v === NONE_VALUE) {
                    setCollection(null, "");
                  } else {
                    const col = collections.find((c) => c.id === v);
                    setCollection(v, col?.name ?? "");
                  }
                }}
              >
                <SelectTrigger
                  className="h-8 text-xs"
                  aria-label="Collection"
                >
                  <SelectValue placeholder="(none)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>(none)</SelectItem>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Document Type Selector */}
          <div className="min-w-[160px] flex-1">
            <label className="text-xs text-muted-foreground block mb-1">
              Document Type
            </label>
            {loadErrors.documentTypes ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  api.documents
                    .list()
                    .then(setDocumentTypes)
                    .then(() =>
                      setLoadErrors((prev) => ({
                        ...prev,
                        documentTypes: false,
                      }))
                    )
                }
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Retry
              </Button>
            ) : (
              <Select
                value={settings.documentType ?? NONE_VALUE}
                onValueChange={(v) => {
                  if (v === NONE_VALUE) {
                    setDocumentType(null, "");
                  } else {
                    const dt = documentTypes.find((d) => d.name === v);
                    setDocumentType(v, dt?.display_name ?? v);
                  }
                }}
              >
                <SelectTrigger
                  className="h-8 text-xs"
                  aria-label="Document type"
                >
                  <SelectValue placeholder="(auto-detect)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>(auto-detect)</SelectItem>
                  {documentTypes.map((dt) => (
                    <SelectItem key={dt.name} value={dt.name}>
                      {dt.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Concept Picker */}
          <div className="min-w-[160px] flex-1 relative">
            <label className="text-xs text-muted-foreground block mb-1">
              Concept
            </label>
            {settings.conceptId ? (
              <div className="flex items-center gap-1 h-8 px-2 border rounded-md text-xs bg-background">
                <span className="truncate flex-1">
                  {settings.conceptLabel}
                </span>
                <button
                  onClick={() => {
                    setConcept(null, "");
                    setConceptQuery("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear concept"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={conceptQuery}
                  onChange={(e) => {
                    setConceptQuery(e.target.value);
                    setConceptOpen(true);
                  }}
                  onFocus={() => {
                    if (conceptQuery.length >= 2) setConceptOpen(true);
                  }}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => setConceptOpen(false), 200);
                  }}
                  placeholder="Search concepts..."
                  className="h-8 w-full px-2 border rounded-md text-xs bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  role="combobox"
                  aria-expanded={conceptOpen}
                  aria-autocomplete="list"
                  aria-label="Concept"
                />
                {conceptLoading && (
                  <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!conceptLoading && conceptQuery.length < 2 && (
                  <ChevronDown className="absolute right-2 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
                )}
                {conceptOpen && conceptSuggestions.length > 0 && (
                  <div className="absolute z-50 top-9 left-0 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
                    {conceptSuggestions.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setConcept(c.id, c.pref_label);
                          setConceptQuery("");
                          setConceptOpen(false);
                        }}
                      >
                        <span>{c.pref_label}</span>
                        {c.notation && (
                          <Badge
                            variant="outline"
                            className="text-[10px] ml-2"
                          >
                            {c.notation}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tag Bar */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Tags
          </label>
          <div
            className="flex flex-wrap items-center gap-1.5 p-1.5 border rounded-md bg-background min-h-[34px]"
            role="group"
            aria-label="Selected tags"
          >
            {settings.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 text-xs gap-1"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="opacity-60 hover:opacity-100"
                  aria-label={`Remove tag: ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <div className="relative flex-1 min-w-[100px]">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setTagSuggestionsOpen(e.target.value.length > 0);
                }}
                onKeyDown={handleTagKeyDown}
                onFocus={() => {
                  if (tagInput.length > 0) setTagSuggestionsOpen(true);
                }}
                onBlur={() =>
                  setTimeout(() => setTagSuggestionsOpen(false), 200)
                }
                placeholder={
                  settings.tags.length === 0 ? "Add tag..." : ""
                }
                className="w-full border-0 bg-transparent text-xs h-6 focus:outline-none"
                aria-label="Add tag"
              />
              {tagSuggestionsOpen && filteredTagSuggestions.length > 0 && (
                <div className="absolute z-50 top-7 left-0 w-48 bg-popover border rounded-md shadow-md max-h-36 overflow-auto">
                  {filteredTagSuggestions.slice(0, 10).map((t) => (
                    <button
                      key={t.name}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addTag(t.name);
                        setTagInput("");
                        setTagSuggestionsOpen(false);
                      }}
                    >
                      <span>{t.name}</span>
                      <span className="text-muted-foreground">
                        {t.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Format */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">Format:</span>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="radio"
              name="format"
              value="markdown"
              checked={settings.format === "markdown"}
              onChange={() => setFormat("markdown")}
              className="h-3.5 w-3.5"
            />
            Markdown
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="radio"
              name="format"
              value="plaintext"
              checked={settings.format === "plaintext"}
              onChange={() => setFormat("plaintext")}
              className="h-3.5 w-3.5"
            />
            Plain text
          </label>
        </div>
      </div>

      {/* Processing Options Panel (revision mode, context filters, pipeline toggles) */}
      <ProcessingOptionsPanel
        revisionMode={settings.revisionMode}
        contextFilter={settings.contextFilter}
        processing={settings.processing}
        collections={collections}
        allTags={allTags}
        onRevisionModeChange={setRevisionMode}
        onContextFilterChange={setContextFilter}
        onProcessingOptionChange={setProcessingOption}
      />

      {/* Error Banner */}
      {lastError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-md px-4 py-3 mb-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="text-destructive font-medium">
              Could not save — check connection.
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              {lastError}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => retry().then((r) => {
                setContent("");
                setSessionNotes((prev) => [r, ...prev]);
                clearError();
              }).catch(() => {})}
            >
              Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Capture Area with drag-and-drop */}
      <div
        className={`mb-4 relative rounded-md transition-colors ${
          isDragOver ? "ring-2 ring-primary bg-primary/5" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-md pointer-events-none">
            <div className="flex flex-col items-center gap-1 text-primary">
              <Upload className="h-6 w-6" />
              <span className="text-sm font-medium">Drop files to attach</span>
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          onPaste={handlePaste}
          placeholder={
            pendingFiles.length > 0
              ? "Add a description (optional with attachments)... (Shift+Enter to commit)"
              : "Capture your thought... (Shift+Enter to commit)"
          }
          disabled={isCommitting}
          className={`w-full font-mono text-sm border rounded-md px-3 py-2 resize-none bg-background transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            successFlash ? "bg-green-500/10" : ""
          } ${isCommitting ? "opacity-60" : ""}`}
          style={{ minHeight: 120, maxHeight: 288 }}
          aria-label="Note content"
          aria-describedby="char-counter shortcut-hint"
        />

        {/* Pending files list */}
        {pendingFiles.length > 0 && (
          <div className="border border-t-0 rounded-b-md px-3 py-2 bg-muted/30 space-y-1">
            {pendingFiles.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 text-xs"
              >
                <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-muted-foreground flex-shrink-0">
                  {file.size < 1024
                    ? `${file.size} B`
                    : file.size < 1024 * 1024
                    ? `${(file.size / 1024).toFixed(1)} KB`
                    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                </span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCommit}
              disabled={(!content.trim() && pendingFiles.length === 0) || isCommitting}
              className="gap-2"
            >
              {isCommitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Commit note
                  <kbd
                    id="shortcut-hint"
                    className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-primary/20 rounded"
                  >
                    Shift+Enter
                  </kbd>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCommitting}
              title="Attach files"
              aria-label="Attach files"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
          <span
            id="char-counter"
            className={`text-xs ${charColor}`}
          >
            {charCount} chars
            {pendingFiles.length > 0 && (
              <span className="ml-2">
                {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Session Log */}
      {sessionNotes.length > 0 && (
        <SessionLog notes={sessionNotes} />
      )}
    </div>
  );
}
