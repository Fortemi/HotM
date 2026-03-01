import { useState, useEffect, useRef, useCallback, type UIEvent } from "react";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Boxes,
  Brain,
  Plus,
  Search,
  Settings,
  Star,
  Hash,
  Edit3,
  Save,
  Moon,
  Sun,
  Sparkles,
  BookOpen,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Activity,

  Network,
  LayoutTemplate,
  Shield,
  Clock3,
  Paperclip,
  HardDrive,
  BookMarked,
  SlidersHorizontal,
  Database,
  Bug,
  Zap,
  PenLine,
  FileText,
  ListChecks,
  Bot,
} from "lucide-react";
import { api, NoteFull, NoteSummary } from "@/services/api";
import { realtimeEventBus, type RealtimeEvent } from "@/services/realtimeEventBus";
import { api as coreApi } from "@/api";
import { MEMORY_CHANGED_EVENT, getActiveMemory } from "@/api/memory-context";
import type { NoteConceptSummary } from "@/api/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MemoryArchive } from "@/api";
import { MarkdownPreview } from "./MarkdownPreview";
import { MarkdownEditor } from "./MarkdownEditor";
import { RelatedNotes } from "./RelatedNotes";
import { NoteMetadata } from "./NoteMetadata";
import { NoteContextMenu, useGlobalContextMenuPrevention } from "./NoteContextMenu";
import { DeleteNoteDialog } from "./DeleteNoteDialog";
import { SearchDropdown } from "./SearchDropdown";
import JobQueueMonitor from "./JobQueueMonitor";
import { JobQueueIndicator } from "./JobQueueIndicator";
import { TypingAnimation } from "./TypingAnimation";
import { CollectionsManager } from "./collections";
import { KnowledgeHealthDashboard } from "./health/KnowledgeHealthDashboard";

import { GraphExplorer } from "./graph";
import { TemplateManager } from "./templates/TemplateManager";
import { AdminPanel } from "./admin";
import { RealtimeEventInspector } from "./debug/RealtimeEventInspector";
import { TimelineView } from "./timeline";
import { AttachmentsPanel } from "./attachments/AttachmentsPanel";
import { AttachmentsBrowser } from "./attachments/AttachmentsBrowser";
import { ConceptBrowser } from "./concepts/ConceptBrowser";
import { VersionHistory } from "./versions/VersionHistory";
import { BackupManager } from "./backup/BackupManager";
import { ArchiveManager } from "./archives/ArchiveManager";
import { EmbeddingSetManager } from "./embeddings";
import { TagManager } from "./tags";
import { SearchPage } from "./search";
import { useWebSocket } from "@/services/websocket";
import { JobManagementPanel } from "./JobManagementPanel";
import { JobQueueView } from "./jobs";
import { QuickCapturePage } from "./capture";
import { AgentPanel } from "./agent";

type AppView =
  | "dashboard"
  | "notes"
  | "capture"
  | "collections"
  | "health"

  | "graph"
  | "templates"
  | "admin"
  | "timeline"
  | "attachments"
  | "concepts"
  | "versions"
  | "backup"
  | "archives"
  | "embeddings"
  | "tags"
  | "search"
  | "jobs"
  | "agent"
  | "realtime-debug";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  starred: boolean;
  archived: boolean;
  revised_content?: string | null;
  ai_generated_title?: string | null;
  revised_model?: string | null;
}

interface SystemSnapshot {
  status: string;
  version: string;
  database: string;
  ollama?: string;
}

interface NotesPageResponse {
  notes: NoteSummary[];
  total: number;
}

interface ArchiveHealthSnapshot {
  score: number;
  totalNotes: number;
}

const NOTES_NAV_EXPANDED_DESKTOP_KEY = "hotm.notesNavigatorExpanded.desktop";
const NOTES_NAV_EXPANDED_MOBILE_KEY = "hotm.notesNavigatorExpanded.mobile";
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

const getNotesNavigatorStorageKey = (isDesktop: boolean): string =>
  isDesktop ? NOTES_NAV_EXPANDED_DESKTOP_KEY : NOTES_NAV_EXPANDED_MOBILE_KEY;

const readNotesNavigatorExpanded = (isDesktop: boolean): boolean => {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const raw = window.localStorage.getItem(getNotesNavigatorStorageKey(isDesktop));
    if (raw === null) {
      return true;
    }
    return raw === "true";
  } catch {
    return true;
  }
};

const writeNotesNavigatorExpanded = (isDesktop: boolean, value: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getNotesNavigatorStorageKey(isDesktop), String(value));
  } catch {
    // Ignore localStorage failures (private mode, restricted contexts).
  }
};

export function HallOfMind() {
  // Use the global context menu prevention hook
  useGlobalContextMenuPrevention();
  
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesTotalCount, setNotesTotalCount] = useState(0);
  const [notesOffset, setNotesOffset] = useState(0);
  const [hasMoreNotes, setHasMoreNotes] = useState(false);
  const [isLoadingMoreNotes, setIsLoadingMoreNotes] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [revisedContent, setRevisedContent] = useState("");
  const [editingRevised, setEditingRevised] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"local" | "fts" | "semantic" | "hybrid">("local");
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [groupBy, setGroupBy] = useState<"none" | "category" | "topic">("none");
  const [sortBy, setSortBy] = useState<"created" | "updated" | "title">("created");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["Uncategorized"]));
  const [activeTab, setActiveTab] = useState<string>("preview");
  const [selectedNoteConceptTags, setSelectedNoteConceptTags] = useState<NoteConceptSummary[]>([]);
  const [selectedNoteProvenance, setSelectedNoteProvenance] = useState<any | null>(null);
  const [metadataConceptOptions, setMetadataConceptOptions] = useState<
    Array<{ concept_id: string; pref_label: string; notation?: string }>
  >([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);
  const [quickNoteCollapsed, setQuickNoteCollapsed] = useState(true);
  const [featuresCollapsed, setFeaturesCollapsed] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<{
    ok: boolean;
    message?: string;
  } | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteDocType, setNewNoteDocType] = useState<string>("");
  const [newNoteRevisionMode, setNewNoteRevisionMode] = useState<string>("");
  const [newNoteAdvancedOpen, setNewNoteAdvancedOpen] = useState(false);
  const [processingNotes, setProcessingNotes] = useState<Set<string>>(new Set());
  const [extractionProgress, setExtractionProgress] = useState<Map<string, {
    status: string;
    strategy?: string;
    progress?: number;
    textPreview?: string;
  }>>(new Map());
  const [copiedState, setCopiedState] = useState<{ [key: string]: boolean }>({});
  const [currentView, setCurrentView] = useState<AppView>("notes");
  const [notesNavigatorExpanded, setNotesNavigatorExpanded] = useState(() => {
    const isDesktop =
      typeof window !== "undefined" && window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
    return readNotesNavigatorExpanded(isDesktop);
  });
  const [availableMemories, setAvailableMemories] = useState<MemoryArchive[]>([]);
  const [activeMemoryName, setActiveMemoryName] = useState<string | null>(getActiveMemory());
  const [defaultMemoryName, setDefaultMemoryName] = useState<string | null>(null);
  const [archiveHealthByName, setArchiveHealthByName] = useState<Record<string, ArchiveHealthSnapshot>>({});
  const [isLoadingArchiveHealth, setIsLoadingArchiveHealth] = useState(false);
  const [systemSnapshot, setSystemSnapshot] = useState<SystemSnapshot | null>(null);
  const [systemSnapshotError, setSystemSnapshotError] = useState<string | null>(null);
  const [isRefreshingSystemSnapshot, setIsRefreshingSystemSnapshot] = useState(false);
  const showRealtimeDebug =
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_REALTIME_INSPECTOR === "true";
  const {
    connected: realtimeConnected,
    connectionState: realtimeConnectionState,
    transportMode: realtimeTransportMode,
    replayCursor,
  } = useWebSocket();
  
  // Refs for notification grouping and metadata caching
  const savedNotes = useRef<Map<string, NoteFull>>(new Map());
  const notificationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const metadataCache = useRef<Map<string, { data: any; timestamp: number; relatedNotes?: any }>>(new Map());
  const notesRef = useRef<Note[]>([]);
  
  // State for title animations
  const [titleAnimations, setTitleAnimations] = useState<Map<string, { oldTitle: string; newTitle: string; isAnimating: boolean }>>(new Map());
  const searchInputRef = useRef<HTMLDivElement>(null);
  const searchCache = useRef<Map<string, { results: Note[], timestamp: number }>>(new Map());

  // Check server health and load initial notes
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    checkServerHealth();
    loadExistingNotes();
    void loadMemoryRoutingState();
    void refreshSystemSnapshot();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const syncFromViewport = (matches: boolean) => {
      setNotesNavigatorExpanded(readNotesNavigatorExpanded(matches));
    };

    syncFromViewport(mediaQuery.matches);

    const handleViewportChange = (event: MediaQueryListEvent) => {
      syncFromViewport(event.matches);
    };

    mediaQuery.addEventListener("change", handleViewportChange);
    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
    writeNotesNavigatorExpanded(isDesktop, notesNavigatorExpanded);
  }, [notesNavigatorExpanded]);

  useEffect(() => {
    const handleMemoryChanged = () => {
      setActiveMemoryName(getActiveMemory());
      void loadMemoryRoutingState();
      setSelectedNote(null);
      setNoteContent("");
      setRevisedContent("");
      loadExistingNotes();
    };

    window.addEventListener(MEMORY_CHANGED_EVENT, handleMemoryChanged as EventListener);
    return () => {
      window.removeEventListener(MEMORY_CHANGED_EVENT, handleMemoryChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!selectedNote?.id) {
      setSelectedNoteConceptTags([]);
      return;
    }

    let isCancelled = false;
    const noteId = selectedNote.id;

    const loadSelectedNoteConceptTags = async () => {
      try {
        const concepts = await coreApi.concepts.getNoteConcepts(noteId);
        if (isCancelled) return;

        const normalized: NoteConceptSummary[] = [];
        for (const concept of concepts) {
          const prefLabel = concept.pref_label?.trim();
          if (!prefLabel) {
            continue;
          }

          normalized.push({
            concept_id: concept.concept_id ?? concept.id,
            pref_label: prefLabel,
            notation: concept.notation,
            confidence: concept.confidence,
            relevance_score: concept.relevance_score,
            is_primary: concept.is_primary,
            source: concept.source,
          });
        }

        const deduped = Array.from(
          normalized.reduce((acc, concept) => {
            const key = concept.concept_id || concept.pref_label.toLowerCase();
            if (!acc.has(key)) {
              acc.set(key, concept);
            }
            return acc;
          }, new Map<string, NoteConceptSummary>()).values()
        ).sort((a, b) => {
          if ((a.is_primary ?? false) !== (b.is_primary ?? false)) {
            return (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0);
          }
          const relevanceA = a.relevance_score ?? -1;
          const relevanceB = b.relevance_score ?? -1;
          if (relevanceA !== relevanceB) {
            return relevanceB - relevanceA;
          }
          const confidenceA = a.confidence ?? -1;
          const confidenceB = b.confidence ?? -1;
          if (confidenceA !== confidenceB) {
            return confidenceB - confidenceA;
          }
          return a.pref_label.localeCompare(b.pref_label);
        });

        setSelectedNoteConceptTags(deduped);
      } catch (error) {
        if (isCancelled) return;
        console.error("Failed to load SKOS concept tags:", error);
        setSelectedNoteConceptTags([]);
      }
    };

    loadSelectedNoteConceptTags();

    return () => {
      isCancelled = true;
    };
  }, [selectedNote?.id]);

  useEffect(() => {
    if (!selectedNote?.id) {
      setSelectedNoteProvenance(null);
      return;
    }

    let isCancelled = false;
    const noteId = selectedNote.id;

    const loadSelectedNoteProvenance = async () => {
      try {
        const provenance = await coreApi.provenance.getProvenance(noteId);
        if (isCancelled) return;
        setSelectedNoteProvenance(provenance);
      } catch (error) {
        if (isCancelled) return;
        console.error("Failed to load note provenance:", error);
        setSelectedNoteProvenance(null);
      }
    };

    loadSelectedNoteProvenance();

    return () => {
      isCancelled = true;
    };
  }, [selectedNote?.id]);

  useEffect(() => {
    if (activeTab !== "metadata") return;

    let cancelled = false;
    const loadConceptOptions = async () => {
      try {
        const concepts = await coreApi.concepts.listConcepts({ limit: 500 });
        if (cancelled) return;

        const deduped = Array.from(
          concepts.reduce((acc, concept) => {
            const conceptId = concept.concept_id ?? concept.id;
            if (!conceptId) return acc;
            if (!acc.has(conceptId)) {
              acc.set(conceptId, {
                concept_id: conceptId,
                pref_label: concept.pref_label || conceptId,
                notation: concept.notation,
              });
            }
            return acc;
          }, new Map<string, { concept_id: string; pref_label: string; notation?: string }>())
          .values()
        ).sort((a, b) => a.pref_label.localeCompare(b.pref_label));

        setMetadataConceptOptions(deduped);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load concept options for metadata editing:", error);
        setMetadataConceptOptions([]);
      }
    };

    void loadConceptOptions();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);
  
  // Browser history management with debouncing and navigation lock
  const navigationLock = useRef(false);
  const historyTimer = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Handle browser back/forward buttons
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && !navigationLock.current) {
        navigationLock.current = true;
        
        // Restore previous state
        if (event.state.noteId) {
          const note = notes.find(n => n.id === event.state.noteId);
          if (note) {
            setSelectedNote(note);
            setNoteContent(note.content);
            setRevisedContent(note.revised_content || note.content);
          }
        }
        if (event.state.tab) {
          setActiveTab(event.state.tab);
        }
        if (event.state.searchQuery !== undefined) {
          setSearchQuery(event.state.searchQuery);
        }
        
        // Unlock after a short delay
        setTimeout(() => {
          navigationLock.current = false;
        }, 100);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [notes]);
  
  // Debounced history push - only push after user stops navigating
  useEffect(() => {
    // Clear any pending history push
    if (historyTimer.current) {
      clearTimeout(historyTimer.current);
    }
    
    // Don't push if we're in a navigation lock (from popstate)
    if (navigationLock.current) {
      return;
    }
    
    // Debounce history pushes by 500ms
    historyTimer.current = setTimeout(() => {
      const state = {
        noteId: selectedNote?.id,
        tab: activeTab,
        searchQuery: searchQuery
      };
      
      // Only push if state actually changed significantly
      const currentState = window.history.state;
      if (!currentState || 
          currentState.noteId !== state.noteId || 
          currentState.tab !== state.tab) {
        window.history.replaceState(state, '');
      }
    }, 500);
    
    return () => {
      if (historyTimer.current) {
        clearTimeout(historyTimer.current);
      }
    };
  }, [selectedNote?.id, activeTab, searchQuery]);


  // Listen for typed realtime note events and converge local state.
  useEffect(() => {
    const recentUpdates = new Map<string, number>();
    const DUPLICATE_THRESHOLD = 1000;

    const isDuplicateEvent = (eventType: string, noteId: string): boolean => {
      const key = `${eventType}:${noteId}`;
      const now = Date.now();
      const lastUpdate = recentUpdates.get(key);
      if (lastUpdate && now - lastUpdate < DUPLICATE_THRESHOLD) {
        return true;
      }
      recentUpdates.set(key, now);
      return false;
    };

    const mapFullNoteToSimple = (fullNote: NoteFull): Note => ({
      id: fullNote.note.id,
      title: fullNote.note.title || fullNote.original.content.split('\n')[0].substring(0, 50) || "Untitled",
      content: fullNote.original.content,
      revised_content: fullNote.revised ? fullNote.revised.content : null,
      createdAt: fullNote.note.created_at_utc,
      updatedAt: fullNote.note.updated_at_utc,
      tags: fullNote.tags,
      starred: fullNote.note.starred || false,
      archived: fullNote.note.archived || false,
      ai_generated_title: fullNote.note.title,
      revised_model: fullNote.revised ? fullNote.revised.model : null,
    });

    const refreshSelectedNoteMetadata = async (noteId: string) => {
      try {
        const labels = await api.getMetadataLabels(noteId);
        metadataCache.current.set(noteId, { data: labels, timestamp: Date.now() });
      } catch (error) {
        console.error("Failed to refresh metadata labels for selected note:", error);
      }

      try {
        const concepts = await coreApi.concepts.getNoteConcepts(noteId);
        const normalized: NoteConceptSummary[] = [];
        for (const concept of concepts) {
          const prefLabel = concept.pref_label?.trim();
          if (!prefLabel) continue;
          normalized.push({
            concept_id: concept.concept_id ?? concept.id,
            pref_label: prefLabel,
            notation: concept.notation,
            confidence: concept.confidence,
            relevance_score: concept.relevance_score,
            is_primary: concept.is_primary,
            source: concept.source,
          });
        }
        const deduped = Array.from(
          normalized.reduce((acc, concept) => {
            const key = concept.concept_id || concept.pref_label.toLowerCase();
            if (!acc.has(key)) {
              acc.set(key, concept);
            }
            return acc;
          }, new Map<string, NoteConceptSummary>()).values()
        );
        setSelectedNoteConceptTags(deduped);
      } catch (error) {
        console.error("Failed to refresh concept tags for selected note:", error);
      }

      try {
        const provenance = await coreApi.provenance.getProvenance(noteId);
        setSelectedNoteProvenance(provenance);
      } catch (error) {
        console.error("Failed to refresh provenance for selected note:", error);
      }
    };

    const upsertNoteFromServer = async (noteId: string, options?: { addIfMissing?: boolean; emitCompletion?: boolean }) => {
      try {
        const updatedNote = await api.getNote(noteId);
        const simpleNote = mapFullNoteToSimple(updatedNote);
        const existingNote = notesRef.current.find((n) => n.id === noteId) || null;
        savedNotes.current.set(noteId, updatedNote);

        if (existingNote && existingNote.title !== simpleNote.title) {
          setTitleAnimations((current) => {
            const next = new Map(current);
            next.set(noteId, {
              oldTitle: existingNote.title || "Untitled",
              newTitle: simpleNote.title || "Untitled",
              isAnimating: true,
            });
            return next;
          });
        }

        setNotes((prev) => {
          const existingIdx = prev.findIndex((n) => n.id === noteId);
          if (existingIdx >= 0) {
            const next = [...prev];
            next[existingIdx] = simpleNote;
            return next;
          }
          if (options?.addIfMissing) {
            return [simpleNote, ...prev];
          }
          return prev;
        });

        if (selectedNote?.id === noteId) {
          if (selectedNote.title !== simpleNote.title) {
            setTitleAnimations((current) => {
              const next = new Map(current);
              next.set(noteId, {
                oldTitle: selectedNote.title || "Untitled",
                newTitle: simpleNote.title || "Untitled",
                isAnimating: true,
              });
              return next;
            });
          }
          setSelectedNote(simpleNote);
          setRevisedContent(simpleNote.revised_content || simpleNote.content);
          await refreshSelectedNoteMetadata(noteId);
        }

        if (options?.emitCompletion && processingNotes.has(noteId)) {
          const existingTimeout = notificationTimeouts.current.get(noteId);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }
          const notificationTimeout = setTimeout(async () => {
            setProcessingNotes(prev => {
              const next = new Set(prev);
              next.delete(noteId);
              return next;
            });
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('HotM - Processing Complete', {
                  body: `Note "${simpleNote.title}" has been processed with AI enhancements.`,
                  icon: '/favicon.svg'
                });
              } else if ('Notification' in window && Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                  new Notification('HotM - Processing Complete', {
                    body: `Note "${simpleNote.title}" has been processed with AI enhancements.`,
                    icon: '/favicon.svg'
                  });
                }
              }
            } catch (error) {
              console.error("Failed to send notification:", error);
            }
            notificationTimeouts.current.delete(noteId);
          }, 2000);
          notificationTimeouts.current.set(noteId, notificationTimeout);
        }
      } catch (error) {
        console.error("Failed to refresh note from realtime event:", error);
      }
    };

    const handleNoteUpdated = async (event: RealtimeEvent) => {
      const noteId = event.note_id;
      if (!noteId || isDuplicateEvent('NoteRefresh', noteId)) {
        return;
      }
      await upsertNoteFromServer(noteId, { addIfMissing: false, emitCompletion: true });
    };

    const handleNoteCreated = async (event: RealtimeEvent) => {
      const noteId = event.note_id;
      if (!noteId || isDuplicateEvent('NoteCreated', noteId)) {
        return;
      }
      await upsertNoteFromServer(noteId, { addIfMissing: true, emitCompletion: false });
      setNotesTotalCount((prev) => prev + 1);
      setNotesOffset((prev) => prev + 1);
    };

    const handleNoteDeleted = (event: RealtimeEvent) => {
      const noteId = event.note_id;
      if (!noteId || isDuplicateEvent('NoteDeleted', noteId)) {
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      savedNotes.current.delete(noteId);
      metadataCache.current.delete(noteId);
      const existingTimeout = notificationTimeouts.current.get(noteId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        notificationTimeouts.current.delete(noteId);
      }
      setProcessingNotes((prev) => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
      setNotesTotalCount((prev) => Math.max(0, prev - 1));
      setNotesOffset((prev) => Math.max(0, prev - 1));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        setNoteContent("");
        setRevisedContent("");
        setSelectedNoteConceptTags([]);
        setSelectedNoteProvenance(null);
      }
    };

    const handleJobCompleted = async (event: RealtimeEvent) => {
      const noteId = event.note_id;
      if (!noteId || isDuplicateEvent('NoteRefresh', noteId)) {
        return;
      }
      await upsertNoteFromServer(noteId, { addIfMissing: false, emitCompletion: true });
    };

    const handleJobFailed = (event: RealtimeEvent) => {
      const noteId = event.note_id;
      if (!noteId || isDuplicateEvent('JobFailed', noteId)) {
        return;
      }
      setProcessingNotes((prev) => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    };

    const unsubscribe = realtimeEventBus.subscribe((event) => {
      if (event.type === 'NoteUpdated') {
        void handleNoteUpdated(event);
        return;
      }
      if (event.type === 'NoteCreated') {
        void handleNoteCreated(event);
        return;
      }
      if (event.type === 'NoteDeleted') {
        handleNoteDeleted(event);
        return;
      }
      if (event.type === 'JobCompleted') {
        void handleJobCompleted(event);
        return;
      }
      if (event.type === 'JobFailed') {
        handleJobFailed(event);
        return;
      }
      if (event.type === 'ResyncRequired') {
        // Full state refresh triggered by SSE replay buffer expiry
        void loadExistingNotes();
        return;
      }
      if (event.type === 'GraphUpdated') {
        // Invalidate cached metadata so next panel open fetches fresh link/graph data
        if (event.note_id) {
          metadataCache.current.delete(event.note_id);
        }
        return;
      }
      if (event.type === 'SearchIndexUpdated') {
        // Clear search cache so next search uses freshly indexed results
        searchCache.current.clear();
        return;
      }
      if (event.type === 'ExtractionUpdated') {
        const attachId = event.attachment_id;
        if (attachId) {
          const status = event.extraction_status ?? event.status ?? 'processing';
          if (status === 'completed' || status === 'failed') {
            // Remove progress entry on completion
            setExtractionProgress(prev => {
              const next = new Map(prev);
              next.delete(attachId);
              return next;
            });
          } else {
            setExtractionProgress(prev => {
              const next = new Map(prev);
              next.set(attachId, {
                status,
                strategy: event.extraction_strategy,
                progress: event.extraction_progress,
                textPreview: event.extracted_text_preview,
              });
              return next;
            });
          }
        }
        return;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [processingNotes, selectedNote]);

  // Handle bringing app to foreground when notification is clicked
  // This is handled by the notification system automatically in most cases

  useEffect(() => {
    // Set initial dark mode
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  const checkServerHealth = async () => {
    try {
      const health = await api.checkHealth();
      setServerStatus({ ok: health.ok });
      console.log("Server health:", health);
    } catch (error) {
      console.error("Server health check failed:", error);
      setServerStatus({ 
        ok: false, 
        message: "Cannot connect to HotM server" 
      });
    }
  };

  const refreshSystemSnapshot = useCallback(async () => {
    try {
      setIsRefreshingSystemSnapshot(true);
      setSystemSnapshotError(null);
      const snapshot = await coreApi.healthCheck();
      setSystemSnapshot(snapshot);
    } catch (error) {
      console.error("Failed to load system snapshot:", error);
      setSystemSnapshot(null);
      setSystemSnapshotError("Unable to load system snapshot");
    } finally {
      setIsRefreshingSystemSnapshot(false);
    }
  }, []);

  const loadMemoryRoutingState = async () => {
    try {
      const archivesRaw = await coreApi.archives.list();
      const archives = Array.isArray(archivesRaw)
        ? archivesRaw
        : [];
      setAvailableMemories(archives);
      const defaultArchive = archives.find((archive) => archive.is_default);
      setDefaultMemoryName(defaultArchive?.name ?? null);
      setActiveMemoryName(getActiveMemory());
    } catch (error) {
      console.error("Failed to load memory routing state:", error);
    }
  };

  const handleGlobalMemoryChange = (value: string) => {
    if (value === "__default__") {
      coreApi.archives.select(null);
    } else {
      coreApi.archives.select(value);
    }
    setActiveMemoryName(getActiveMemory());
  };

  const refreshDashboardData = useCallback(async () => {
    await Promise.all([
      checkServerHealth(),
      loadMemoryRoutingState(),
      refreshSystemSnapshot(),
    ]);
  }, [loadMemoryRoutingState, refreshSystemSnapshot]);

  const calculateHealthScore = useCallback((metrics: {
    total_notes: number;
    orphan_notes: number;
    stale_notes: number;
    unlinked_notes: number;
    avg_links_per_note: number;
    tag_coverage: number;
  }): number => {
    let score = 100;
    const totalNotes = Math.max(metrics.total_notes, 1);
    score -= Math.min((metrics.orphan_notes / totalNotes) * 100, 20);
    score -= Math.min((metrics.stale_notes / totalNotes) * 75, 15);
    score -= Math.min((metrics.unlinked_notes / totalNotes) * 50, 15);
    score += Math.min(metrics.avg_links_per_note * 2, 10);
    score += metrics.tag_coverage * 10;
    return Math.max(0, Math.min(100, Math.round(score)));
  }, []);

  const loadArchiveHealthSummary = useCallback(async () => {
    const archiveNames = availableMemories.map((archive) => archive.name);
    if (archiveNames.length === 0) {
      setArchiveHealthByName({});
      return;
    }

    try {
      setIsLoadingArchiveHealth(true);
      const rows = await Promise.all(
        archiveNames.map(async (archiveName) => {
          const health = await coreApi.health.getKnowledgeHealth(archiveName);
          return [
            archiveName,
            {
              score: calculateHealthScore(health),
              totalNotes: health.total_notes,
            },
          ] as const;
        })
      );
      setArchiveHealthByName(Object.fromEntries(rows));
    } catch (error) {
      console.error("Failed to load archive health summary:", error);
    } finally {
      setIsLoadingArchiveHealth(false);
    }
  }, [availableMemories, calculateHealthScore]);

  useEffect(() => {
    void loadArchiveHealthSummary();
  }, [loadArchiveHealthSummary]);

  const fetchNotesPage = useCallback(
    async (limit: number, offset: number): Promise<NotesPageResponse> => {
      const compatApi = api as unknown as {
        getNotesPage?: (
          sortBy?: 'created_at' | 'updated_at' | 'accessed_at',
          filter?: 'all' | 'starred' | 'archived' | 'recent',
          limit?: number,
          offset?: number
        ) => Promise<NotesPageResponse>;
      };

      if (typeof compatApi.getNotesPage === "function") {
        const paged = await compatApi.getNotesPage("created_at", "all", limit, offset);
        if (paged && Array.isArray(paged.notes) && typeof paged.total === "number") {
          return paged;
        }
      }

      const notes = await api.getNotes("created_at", "all", limit, offset);
      return {
        notes,
        total: offset + notes.length + (notes.length === limit ? limit : 0),
      };
    },
    []
  );

  /**
   * Build Note objects from summaries without individual API calls.
   * Uses snippet as initial content — full content loads on selection
   * via selectNoteFromNavigator(). This eliminates the N+1 query
   * pattern that made Tauri desktop loads slow.
   */
  const notesFromSummaries = useCallback((summaries: NoteSummary[]): Note[] => {
    return summaries.map((s) => ({
      id: s.id,
      title: s.title || (s.snippet ? s.snippet.split('\n')[0].substring(0, 50) : "") || "Untitled",
      content: s.snippet || "",
      revised_content: s.has_revision ? null : null,
      createdAt: s.created_at_utc,
      updatedAt: s.updated_at_utc,
      tags: s.tags || [],
      starred: s.starred || false,
      archived: s.archived || false,
      ai_generated_title: s.title || null,
      revised_model: null,
    }));
  }, []);

  const loadExistingNotes = useCallback(async () => {
    const pageSize = 100;
    try {
      setIsLoading(true);
      setIsLoadingMoreNotes(false);
      setNotesOffset(0);
      setHasMoreNotes(false);
      savedNotes.current.clear();

      const page = await fetchNotesPage(pageSize, 0);
      setNotesTotalCount(page.total);

      const simpleNotes = notesFromSummaries(page.notes);
      setNotes(simpleNotes);
      setNotesOffset(simpleNotes.length);
      setHasMoreNotes(simpleNotes.length < page.total);

      if (selectedNote) {
        const updatedSelected = simpleNotes.find((n) => n.id === selectedNote.id);
        if (updatedSelected) {
          setSelectedNote(updatedSelected);
          setNoteContent(updatedSelected.content);
        }
      }

      if (simpleNotes.length === 0) {
        console.log("No existing notes found");
      } else {
        console.log(`Loaded ${simpleNotes.length}/${page.total} notes from server`);
      }
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchNotesPage, notesFromSummaries, selectedNote]);

  const loadMoreNotes = useCallback(async () => {
    if (isLoadingMoreNotes || isLoading || !hasMoreNotes) {
      return;
    }

    const pageSize = 100;
    try {
      setIsLoadingMoreNotes(true);
      const page = await fetchNotesPage(pageSize, notesOffset);
      setNotesTotalCount(page.total);

      const simpleNotes = notesFromSummaries(page.notes);
      if (simpleNotes.length > 0) {
        setNotes((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const unique = simpleNotes.filter((n) => !existingIds.has(n.id));
          return [...prev, ...unique];
        });
      }

      const nextOffset = notesOffset + simpleNotes.length;
      setNotesOffset(nextOffset);
      setHasMoreNotes(nextOffset < page.total);
    } catch (error) {
      console.error("Failed to load additional notes:", error);
    } finally {
      setIsLoadingMoreNotes(false);
    }
  }, [fetchNotesPage, hasMoreNotes, notesFromSummaries, isLoading, isLoadingMoreNotes, notesOffset]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  const createNewNote = async () => {
    // Always require content for now - simplify the logic
    if (!newNoteContent.trim()) {
      alert("Please enter some content for the note");
      return;
    }
    
    // Only create notes on the server when connected
    if (!serverStatus?.ok) {
      alert("Cannot create notes while offline. Please check your connection.");
      return;
    }
    
    try {
      setIsLoading(true);
      const createOptions = (newNoteDocType || newNoteRevisionMode)
        ? {
            ...(newNoteDocType && { document_type: newNoteDocType }),
            ...(newNoteRevisionMode && { revision_mode: newNoteRevisionMode }),
          }
        : undefined;
      const response = await api.createNote(newNoteContent, createOptions);
      console.log("Note created:", response);
      
      // Fetch the full note details
      const fullNote = await api.getNote(response.note_id);
      savedNotes.current.set(fullNote.note.id, fullNote);
      
      // Add to our notes list
      const simpleNote: Note = {
        id: fullNote.note.id,
        title: fullNote.note.title || fullNote.original.content.split('\n')[0].substring(0, 50) || "Untitled",
        content: fullNote.original.content,
        revised_content: fullNote.revised ? fullNote.revised.content : null,
        createdAt: fullNote.note.created_at_utc,
        updatedAt: fullNote.note.updated_at_utc,
        tags: fullNote.tags,
        starred: fullNote.note.starred || false,
        archived: fullNote.note.archived || false,
        ai_generated_title: fullNote.note.title,
        revised_model: fullNote.revised ? fullNote.revised.model : null
      };
      
      // Mark note as processing - WebSocket events will clear this when jobs complete
      setProcessingNotes(prev => new Set(prev).add(response.note_id));
      
      console.log("Note created and marked for AI processing:", response.note_id);
      // The realtime NoteUpdated event will handle updating the UI when jobs complete
      
      setNotes((prev) => [simpleNote, ...prev]);
      setNotesTotalCount((prev) => prev + 1);
      setNotesOffset((prev) => prev + 1);
      setSelectedNote(simpleNote);
      setNoteContent(simpleNote.content);
      setNewNoteContent("");
      setNewNoteDocType("");
      setNewNoteRevisionMode("");
      setNewNoteAdvancedOpen(false);
      setHasUnsavedChanges(false);
      
      // Refresh the notes list to ensure sync
      await loadExistingNotes();
    } catch (error) {
      console.error("Failed to create note:", error);
      alert("Failed to create note. Check if the server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateAI = async (revisionMode?: string) => {
    if (!selectedNote) return;

    if (!serverStatus?.ok) {
      alert("Cannot regenerate while offline. Please check your connection.");
      return;
    }

    try {
      setIsLoading(true);
      // Mark as processing - WebSocket events will clear this when jobs complete
      setProcessingNotes(prev => new Set(prev).add(selectedNote.id));

      // Trigger AI regeneration using the dedicated endpoint
      await api.regenerateAI(selectedNote.id, revisionMode);

      console.log("AI regeneration triggered for note:", selectedNote.id, "mode:", revisionMode ?? "default");
      // The realtime NoteUpdated event will handle updating the UI when jobs complete
    } catch (error) {
      console.error("Failed to regenerate AI enhancement:", error);
      alert("Failed to regenerate AI enhancement");

      // Remove from processing on error
      setProcessingNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedNote.id);
        return newSet;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectNoteFromNavigator = async (note: Note) => {
    setSelectedNote(note);
    setNoteContent(note.content);
    setRevisedContent(note.revised_content || note.content);
    setEditingRevised(false);
    setHasUnsavedChanges(false);

    try {
      const freshNote = await api.getNote(note.id);
      const updatedNote = {
        id: freshNote.note.id,
        title: freshNote.note.title || freshNote.original.content.split('\n')[0].substring(0, 50) || "Untitled",
        content: freshNote.original.content,
        revised_content: freshNote.revised ? freshNote.revised.content : null,
        createdAt: freshNote.note.created_at_utc,
        updatedAt: freshNote.note.updated_at_utc,
        tags: freshNote.tags,
        starred: freshNote.note.starred || false,
        archived: freshNote.note.archived || false,
        ai_generated_title: freshNote.note.title,
        revised_model: freshNote.revised ? freshNote.revised.model : null
      };

      setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
      setSelectedNote(updatedNote);
      setNoteContent(updatedNote.content);
      setRevisedContent(updatedNote.revised_content || updatedNote.content);

      savedNotes.current.set(freshNote.note.id, freshNote);

    } catch (error) {
      console.error("Failed to refresh note:", error);
    }
  };

  // Context menu handlers
  const handleEditNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setSelectedNote(note);
      setNoteContent(note.content);
      setRevisedContent(note.revised_content || note.content);
      setEditingRevised(false);
      // Switch to the Edit tab
      setActiveTab("edit");
    }
  };

  const handleViewMetadata = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setSelectedNote(note);
      // Switch to metadata tab
      setActiveTab("metadata");
    }
  };

  const handleRegenerateAI = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setSelectedNote(note);
      await regenerateAI();
    }
  };

  const handleDeleteNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setNoteToDelete({ id: noteId, title: note.title });
      setDeleteDialogOpen(true);
    }
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    
    try {
      setIsLoading(true);
      await api.deleteNote(noteToDelete.id);
      
      // Remove from local state
      setNotes(prev => prev.filter(n => n.id !== noteToDelete.id));
      savedNotes.current.delete(noteToDelete.id);
      
      // Clear selection if this was the selected note
      if (selectedNote?.id === noteToDelete.id) {
        setSelectedNote(null);
        setNoteContent("");
        setRevisedContent("");
      }
      
      console.log("Note deleted:", noteToDelete.id);
      
      // Close dialog and clear state
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    } catch (error) {
      console.error("Failed to delete note:", error);
      // We'll handle this more gracefully in the dialog
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchiveNote = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    const newArchived = !note.archived;
    
    try {
      // Update UI optimistically
      const updatedNotes = notes.map(n =>
        n.id === noteId ? { ...n, archived: newArchived } : n
      );
      setNotes(updatedNotes);
      
      // Update selected note if it's the one being archived
      if (selectedNote?.id === noteId) {
        setSelectedNote({ ...selectedNote, archived: newArchived });
      }
      
      // Actually persist to backend
      console.log(`Updating archive status for note ${noteId}: ${newArchived}`);
      await api.updateNoteStatus(noteId, undefined, newArchived);
      console.log(`Successfully updated archive status for note ${noteId}: ${newArchived}`);
    } catch (error) {
      console.error("Failed to update archive status:", error);
      // Revert on error
      const revertedNotes = notes.map(n =>
        n.id === noteId ? { ...n, archived: !newArchived } : n
      );
      setNotes(revertedNotes);
      if (selectedNote?.id === noteId) {
        setSelectedNote({ ...selectedNote, archived: !newArchived });
      }
    }
  };

  const saveNote = async () => {
    if (!selectedNote) return;
    
    // Only save to server
    if (!serverStatus?.ok) {
      alert("Cannot save while offline. Please check your connection.");
      return;
    }
    
    // Check if this note exists on the server
    if (!savedNotes.current.has(selectedNote.id)) {
      alert("This note doesn't exist on the server. Please create a new note.");
      return;
    }
    
    const contentToSave = editingRevised ? revisedContent : noteContent;
    const rationale = editingRevised ? "Edit AI-enhanced version" : "Manual edit";
    
    try {
      setIsLoading(true);
      
      // Use the correct API endpoint based on what we're editing
      if (editingRevised) {
        // Editing revised content - use /revised endpoint
        await api.updateRevision(selectedNote.id, contentToSave, rationale);
      } else {
        // Editing original content - use /original endpoint
        await api.updateOriginalContent(selectedNote.id, contentToSave);
      }
      
      // Update local state based on what was edited
      const updatedNotes = notes.map(note => 
        note.id === selectedNote.id 
          ? { 
              ...note, 
              content: editingRevised ? note.content : contentToSave,
              revised_content: editingRevised ? contentToSave : note.revised_content,
              updatedAt: new Date().toISOString() 
            }
          : note
      );
      setNotes(updatedNotes);
      
      // Update the selected note too
      setSelectedNote({
        ...selectedNote,
        content: editingRevised ? selectedNote.content : contentToSave,
        revised_content: editingRevised ? contentToSave : selectedNote.revised_content,
        updatedAt: new Date().toISOString()
      });
      
      console.log(`Note ${editingRevised ? 'revised' : 'original'} content saved successfully to server`);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save note:", error);
      alert("Failed to save note. Check if the server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStar = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    const newStarred = !note.starred;
    
    // Optimistically update UI
    const updatedNotes = notes.map(n =>
      n.id === noteId ? { ...n, starred: newStarred } : n
    );
    setNotes(updatedNotes);
    
    // Update selected note if it's the one being starred
    if (selectedNote?.id === noteId) {
      setSelectedNote({ ...selectedNote, starred: newStarred });
    }
    
    // Actually persist to backend
    try {
      console.log(`Updating star status for note ${noteId}: ${newStarred}`);
      await api.updateNoteStatus(noteId, newStarred, undefined);
      console.log(`Successfully updated star status for note ${noteId}`);
    } catch (error) {
      console.error("Failed to update star status:", error);
      // Revert on error
      const revertedNotes = notes.map(n =>
        n.id === noteId ? { ...n, starred: !newStarred } : n
      );
      setNotes(revertedNotes);
      if (selectedNote?.id === noteId) {
        setSelectedNote({ ...selectedNote, starred: !newStarred });
      }
    }
  };

  const copyToClipboard = async (content: string, key: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedState({ ...copiedState, [key]: true });
      setTimeout(() => {
        setCopiedState(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleMetadataTagClick = (tag: string) => {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return;

    setSearchQuery(`#${trimmedTag}`);
    setShowSearchResults(true);
    setActiveTab("search");
  };

  const handleSaveMetadataEdits = async (payload: {
    tags: string[];
    conceptIds: string[];
    metadata: Record<string, unknown>;
  }) => {
    if (!selectedNote) {
      throw new Error("No note selected");
    }

    const noteId = selectedNote.id;
    try {
      const currentFullNote = savedNotes.current.get(noteId);
      const currentTags = currentFullNote?.tags ?? [];
      const nextTags = Array.from(new Set(payload.tags.map((tag) => tag.trim()).filter(Boolean)));

      const addTags = nextTags.filter((tag) => !currentTags.includes(tag));
      const removeTags = currentTags.filter((tag) => !nextTags.includes(tag));
      if (addTags.length > 0 || removeTags.length > 0) {
        await api.updateNoteTags(noteId, addTags, removeTags);
      }

      const currentConceptIds = Array.from(
        new Set(
          selectedNoteConceptTags
            .map((concept) => concept.concept_id?.trim())
            .filter((conceptId): conceptId is string => Boolean(conceptId))
        )
      );
      const nextConceptIds = Array.from(
        new Set(payload.conceptIds.map((conceptId) => conceptId.trim()).filter(Boolean))
      );

      const addConceptIds = nextConceptIds.filter((conceptId) => !currentConceptIds.includes(conceptId));
      const removeConceptIds = currentConceptIds.filter((conceptId) => !nextConceptIds.includes(conceptId));

      if (removeConceptIds.length > 0) {
        await Promise.all(removeConceptIds.map((conceptId) => coreApi.concepts.untagNote(noteId, conceptId)));
      }
      if (addConceptIds.length > 0) {
        await Promise.all(addConceptIds.map((conceptId) => coreApi.concepts.tagNote(noteId, conceptId)));
      }

      await coreApi.notes.update(noteId, { metadata: payload.metadata });

      const refreshedNote = await api.getNote(noteId);
      savedNotes.current.set(noteId, refreshedNote);

      const refreshedSimpleNote: Note = {
        id: refreshedNote.note.id,
        title:
          refreshedNote.note.title ||
          refreshedNote.original.content.split("\n")[0].substring(0, 50) ||
          "Untitled",
        content: refreshedNote.original.content,
        revised_content: refreshedNote.revised ? refreshedNote.revised.content : null,
        createdAt: refreshedNote.note.created_at_utc,
        updatedAt: refreshedNote.note.updated_at_utc,
        tags: refreshedNote.tags,
        starred: refreshedNote.note.starred || false,
        archived: refreshedNote.note.archived || false,
        ai_generated_title: refreshedNote.note.title,
        revised_model: refreshedNote.revised ? refreshedNote.revised.model : null,
      };

      setNotes((prev) => prev.map((note) => (note.id === noteId ? refreshedSimpleNote : note)));
      setSelectedNote(refreshedSimpleNote);
      setNoteContent(refreshedSimpleNote.content);
      setRevisedContent(refreshedSimpleNote.revised_content || refreshedSimpleNote.content);

      try {
        const concepts = await coreApi.concepts.getNoteConcepts(noteId);
        const normalized: NoteConceptSummary[] = [];
        for (const concept of concepts) {
          const prefLabel = concept.pref_label?.trim();
          const conceptId = concept.concept_id ?? concept.id;
          if (!prefLabel || !conceptId) continue;
          normalized.push({
            concept_id: conceptId,
            pref_label: prefLabel,
            notation: concept.notation,
            confidence: concept.confidence,
            relevance_score: concept.relevance_score,
            is_primary: concept.is_primary,
            source: concept.source,
          });
        }
        setSelectedNoteConceptTags(normalized);
      } catch (error) {
        console.error("Failed to refresh concept tags after metadata edit:", error);
      }

      try {
        const provenance = await coreApi.provenance.getProvenance(noteId);
        setSelectedNoteProvenance(provenance);
      } catch (error) {
        console.error("Failed to refresh provenance after metadata edit:", error);
      }
    } catch (error) {
      console.error("Failed to save metadata edits:", error);
      throw error;
    }
  };

  // Perform server search when query changes
  const performSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setShowSearchResults(false);
      setSearchResults([]);
      setSearchMode("local");
      return;
    }
    
    // Check cache first (cache for 5 minutes)
    const cacheKey = `${query}-${searchMode}`;
    const cached = searchCache.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      setSearchResults(cached.results);
      setShowSearchResults(true);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    // Check for special search patterns
    if (query.startsWith('#')) {
      // Tag search - convert #tag to tag:tagname filter
      const tag = query.substring(1).trim();
      if (tag) {
        try {
          // Search for the tag using the filter parameter
          const results = await api.searchNotes(tag, "fts", `tag:${tag}`);
          if (results && results.length > 0) {
            // Load full note details for each search result
            const fullNotes = await Promise.all(
              results.map(async (hit: any) => {
                try {
                  const fullNote = await api.getNote(hit.note_id);
                  savedNotes.current.set(fullNote.note.id, fullNote);
                  // Extract proper title from content
                  const lines = fullNote.original.content.split('\n');
                  let title = "Untitled";
                  for (const line of lines) {
                    const cleanLine = line.trim().replace(/^#+\s*/, '').trim();
                    if (cleanLine) {
                      title = cleanLine.substring(0, 100);
                      break;
                    }
                  }
                  return {
                    id: fullNote.note.id,
                    title: title,
                    content: fullNote.original.content,
                    revised_content: fullNote.revised ? fullNote.revised.content : null,
                    createdAt: fullNote.note.created_at_utc,
                    updatedAt: fullNote.note.updated_at_utc,
                    tags: fullNote.tags,
                    starred: fullNote.note.starred || false,
                    archived: fullNote.note.archived || false,
                    revised_model: fullNote.revised ? fullNote.revised.model : null
                  };
                } catch (err) {
                  // Fallback to search result if can't load full note
                  return {
                    id: hit.note_id,
                    title: hit.snippet?.split('\n')[0].substring(0, 50) || "Search result",
                    content: hit.snippet || "",
                    revised_content: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    tags: [],
                    starred: false,
                    archived: false,
                    revised_model: null
                  };
                }
              })
            );
            setSearchResults(fullNotes);
            // Cache the results
            searchCache.current.set(`${query}-fts`, { results: fullNotes, timestamp: Date.now() });
            setSearchMode("fts");
          } else {
            // No results, but still in search mode
            setSearchResults([]);
            setSearchMode("fts");
          }
          setIsSearching(false);
        } catch (error) {
          console.error("Search failed:", error);
        }
      }
    } else if (query.length >= 3) {
      // Regular search - use hybrid mode for best results
      try {
        const results = await api.searchNotes(query, "hybrid");
        if (results && results.length > 0) {
          // Load full note details for each search result
          const fullNotes = await Promise.all(
            results.map(async (hit: any) => {
              try {
                const fullNote = await api.getNote(hit.note_id);
                savedNotes.current.set(fullNote.note.id, fullNote);
                // Extract proper title from content (first non-empty line, remove markdown)
                const lines = fullNote.original.content.split('\n');
                let title = "Untitled";
                for (const line of lines) {
                  const cleanLine = line.trim().replace(/^#+\s*/, '').trim();
                  if (cleanLine) {
                    title = cleanLine.substring(0, 100);
                    break;
                  }
                }
                return {
                  id: fullNote.note.id,
                  title: title,
                  content: fullNote.original.content,
                  revised_content: fullNote.revised ? fullNote.revised.content : null,
                  createdAt: fullNote.note.created_at_utc,
                  updatedAt: fullNote.note.updated_at_utc,
                  tags: fullNote.tags,
                  starred: fullNote.note.starred || false,
                  archived: fullNote.note.archived || false,
                  revised_model: fullNote.revised ? fullNote.revised.model : null
                };
              } catch (err) {
                // Fallback to search result if can't load full note
                return {
                  id: hit.note_id,
                  title: hit.snippet?.split('\n')[0].substring(0, 50) || "Search result",
                  content: hit.snippet || "",
                  revised_content: null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  tags: [],
                  starred: false,
                  archived: false,
                  revised_model: null
                };
              }
            })
          );
          setSearchResults(fullNotes);
          // Cache the results
          searchCache.current.set(`${query}-hybrid`, { results: fullNotes, timestamp: Date.now() });
          setSearchMode("hybrid");
        } else {
          // No results
          setSearchResults([]);
          setSearchMode("hybrid");
        }
        setIsSearching(false);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchMode("local");
        setIsSearching(false);
      }
    } else {
      setSearchMode("local");
      setIsSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && searchQuery.length >= 2) {
        performSearch(searchQuery);
      } else if (!searchQuery) {
        // Clear search results when query is cleared
        setShowSearchResults(false);
        setSearchResults([]);
        setSearchMode("local");
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sort notes based on selected criteria
  const sortedNotes = [...notes].sort((a, b) => {
    if (sortBy === "created") {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    } else if (sortBy === "updated") {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    } else {
      // Sort by title
      const titleA = a.title.toLowerCase();
      const titleB = b.title.toLowerCase();
      if (sortOrder === "asc") {
        return titleA < titleB ? -1 : titleA > titleB ? 1 : 0;
      } else {
        return titleA > titleB ? -1 : titleA < titleB ? 1 : 0;
      }
    }
  });

  // Hide archived notes by default
  const activeNotes = sortedNotes.filter(note => !note.archived);

  const filteredNotes = searchMode === "local"
    ? activeNotes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeNotes; // When in search mode, notes are already filtered from server
  
  // Group notes by category or topic
  const groupedNotes = (): Record<string, Note[]> => {
    if (groupBy === "none") {
      return { "": filteredNotes }; // Empty key means no group heading
    }
    
    const groups: Record<string, Note[]> = {};
    
    for (const note of filteredNotes) {
      let groupKey = "Uncategorized";
      
      // Get the full note data to access metadata
      // TODO: Add metadata grouping when available
      // const fullNote = savedNotes.current.get(note.id);
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(note);
    }
    
    // Sort group keys alphabetically
    const sortedGroups: Record<string, Note[]> = {};
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key];
    });
    
    return sortedGroups;
  };

  const toggleGroupExpansion = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const handleNotesListScroll = (event: UIEvent<HTMLDivElement>) => {
    if (isLoading || isLoadingMoreNotes || !hasMoreNotes) {
      return;
    }

    const target = event.currentTarget;
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 120;
    if (nearBottom) {
      void loadMoreNotes();
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background">
        <Sidebar variant="sidebar" className="border-r w-64 relative">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Hall of the Mind</h2>
                <p className="text-xs text-muted-foreground">Intelligent data curation</p>
              </div>
            </div>
            {/* Server Status */}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                {serverStatus?.ok ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">API Connected</span>
                  </>
                ) : serverStatus === null ? (
                  <>
                    <AlertCircle className="h-3 w-3 text-yellow-500" />
                    <span className="text-yellow-600 dark:text-yellow-400">Connecting...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">Offline Mode</span>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  void refreshDashboardData();
                  loadExistingNotes();
                }}
                disabled={isLoading || isRefreshingSystemSnapshot}
              >
                {isLoading || isRefreshingSystemSnapshot ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Archive Routing</span>
                <span>
                  default: {defaultMemoryName ?? "server default"}
                </span>
              </div>
              <Select
                value={activeMemoryName ?? "__default__"}
                onValueChange={handleGlobalMemoryChange}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select archive routing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">
                    Default ({defaultMemoryName ?? "server default"})
                  </SelectItem>
                  {Array.isArray(availableMemories) && availableMemories.map((archive) => (
                    <SelectItem key={archive.id} value={archive.name}>
                      {archive.name}
                      {archive.is_default ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="flex flex-col">
            {/* Feature Navigation - Primary */}
            <SidebarGroup>
              <SidebarGroupLabel>
                <button
                  onClick={() => setFeaturesCollapsed(!featuresCollapsed)}
                  className="flex items-center justify-between w-full hover:bg-accent/50 rounded px-1 py-0.5 transition-colors"
                >
                  <span>Navigate</span>
                  {featuresCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </SidebarGroupLabel>
              {!featuresCollapsed && (
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("dashboard")}
                      className={currentView === "dashboard" ? "bg-primary/10" : ""}
                    >
                      <Activity className="h-4 w-4" />
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("notes")}
                      className={currentView === "notes" ? "bg-primary/10" : ""}
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Notes</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("capture")}
                      className={currentView === "capture" ? "bg-primary/10" : ""}
                    >
                      <Zap className="h-4 w-4" />
                      <span>Capture</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("collections")}
                      className={currentView === "collections" ? "bg-primary/10" : ""}
                    >
                      <FolderOpen className="h-4 w-4" />
                      <span>Collections</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("tags")}
                      className={currentView === "tags" ? "bg-primary/10" : ""}
                    >
                      <Hash className="h-4 w-4" />
                      <span>Tags</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("search")}
                      className={currentView === "search" ? "bg-primary/10" : ""}
                    >
                      <Search className="h-4 w-4" />
                      <span>Search</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("graph")}
                      className={currentView === "graph" ? "bg-primary/10" : ""}
                    >
                      <Network className="h-4 w-4" />
                      <span>Graph</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("timeline")}
                      className={currentView === "timeline" ? "bg-primary/10" : ""}
                    >
                      <Clock3 className="h-4 w-4" />
                      <span>Timeline</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("templates")}
                      className={currentView === "templates" ? "bg-primary/10" : ""}
                    >
                      <LayoutTemplate className="h-4 w-4" />
                      <span>Templates</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("concepts")}
                      className={currentView === "concepts" ? "bg-primary/10" : ""}
                    >
                      <BookMarked className="h-4 w-4" />
                      <span>Concepts</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("health")}
                      className={currentView === "health" ? "bg-primary/10" : ""}
                    >
                      <Activity className="h-4 w-4" />
                      <span>Health</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("attachments")}
                      className={currentView === "attachments" ? "bg-primary/10" : ""}
                    >
                      <Paperclip className="h-4 w-4" />
                      <span>Attachments</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("backup")}
                      className={currentView === "backup" ? "bg-primary/10" : ""}
                    >
                      <HardDrive className="h-4 w-4" />
                      <span>Backup</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("archives")}
                      className={currentView === "archives" ? "bg-primary/10" : ""}
                    >
                      <Database className="h-4 w-4" />
                      <span>Archives</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("embeddings")}
                      className={currentView === "embeddings" ? "bg-primary/10" : ""}
                    >
                      <Boxes className="h-4 w-4" />
                      <span>Embeddings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("admin")}
                      className={currentView === "admin" ? "bg-primary/10" : ""}
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("agent")}
                      className={currentView === "agent" ? "bg-primary/10" : ""}
                    >
                      <Bot className="h-4 w-4" />
                      <span>Agent</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCurrentView("jobs")}
                      className={currentView === "jobs" ? "bg-primary/10" : ""}
                    >
                      <ListChecks className="h-4 w-4" />
                      <span>Job Queue</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {showRealtimeDebug && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setCurrentView("realtime-debug")}
                        className={currentView === "realtime-debug" ? "bg-primary/10" : ""}
                      >
                        <Bug className="h-4 w-4" />
                        <span>Realtime Debug</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              )}
            </SidebarGroup>

            <Separator className="my-1 flex-shrink-0" />

            {/* Quick Note */}
            <SidebarGroup className="flex-shrink-0">
              <SidebarGroupLabel>
                <button
                  onClick={() => setQuickNoteCollapsed(!quickNoteCollapsed)}
                  className="flex items-center justify-between w-full hover:bg-accent/50 rounded px-1 py-0.5 transition-colors"
                >
                  <span>Quick Note</span>
                  {quickNoteCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </SidebarGroupLabel>
              {!quickNoteCollapsed && (
                <SidebarGroupContent>
                  <div className="px-3 py-2 space-y-2">
                    <Textarea
                      placeholder="Quick note... (Ctrl+Enter to save)"
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="min-h-[100px] resize-none text-sm font-mono"
                      onKeyDown={(e) => {
                        if (e.ctrlKey && e.key === 'Enter') {
                          e.preventDefault();
                          createNewNote();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setNewNoteAdvancedOpen(!newNoteAdvancedOpen)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {newNoteAdvancedOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      Advanced
                    </button>
                    {newNoteAdvancedOpen && (
                      <div className="space-y-2 pl-1">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Document type</label>
                          <Select value={newNoteDocType} onValueChange={setNewNoteDocType}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Auto-detect" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="academic">Academic</SelectItem>
                              <SelectItem value="technical">Technical</SelectItem>
                              <SelectItem value="personal">Personal</SelectItem>
                              <SelectItem value="meeting_notes">Meeting Notes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Revision mode</label>
                          <Select value={newNoteRevisionMode} onValueChange={setNewNoteRevisionMode}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Default" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="contextual">Contextual</SelectItem>
                              <SelectItem value="contextual_filtered">Contextual (filtered)</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    <Button
                      onClick={createNewNote}
                      className="w-full justify-start gap-2"
                      variant="default"
                      disabled={isLoading || !serverStatus?.ok || !newNoteContent.trim()}
                    >
                      <Plus className="h-4 w-4" />
                      {isLoading ? 'Creating...' : 'Create Note'}
                    </Button>
                  </div>
                </SidebarGroupContent>
              )}
            </SidebarGroup>

          </SidebarContent>

          <SidebarFooter className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentView("admin")}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 items-center gap-4 border-b px-6">
            <SidebarTrigger />
            <div className="flex flex-1 items-center gap-4">
              <div className="flex items-center gap-2 flex-1 relative" ref={searchInputRef}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                ) : (
                  <Search className="h-4 w-4 text-muted-foreground" />
                )}
                <input
                  type="text"
                  placeholder={searchMode !== "local" ? `Searching (${searchMode})...` : "Search your mind..."}
                  className="bg-transparent outline-none placeholder:text-muted-foreground flex-1"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery) {
                      // Navigate to the full Search page with the query preloaded
                      setPendingSearchQuery(searchQuery);
                      setCurrentView("search");
                      setShowSearchResults(false);
                    }
                  }}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchResults(false);
                      setSearchResults([]);
                      // Clear cache when clearing search
                      searchCache.current.clear();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
                
                {/* Search Dropdown */}
                <SearchDropdown
                  isOpen={showSearchResults && searchResults.length > 0}
                  searchQuery={searchQuery}
                  searchMode={searchMode}
                  isSearching={isSearching}
                  searchResults={searchResults.slice(0, 5)}
                  onSelectNote={(note) => {
                    setSelectedNote(note);
                    setNoteContent(note.content);
                    setRevisedContent(note.revised_content || note.content);
                    setEditingRevised(false);
                    setHasUnsavedChanges(false);
                    setSearchQuery("");
                    setShowSearchResults(false);
                  }}
                  onClose={() => setShowSearchResults(false)}
                  onViewAll={() => {
                    // Navigate to the full Search page with the query preloaded
                    setPendingSearchQuery(searchQuery);
                    setCurrentView("search");
                    setShowSearchResults(false);
                  }}
                  anchorRef={searchInputRef}
                  savedNotes={savedNotes.current}
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
                {selectedNote && hasUnsavedChanges && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={saveNote}
                    className="gap-2"
                    disabled={isLoading || (savedNotes.current.has(selectedNote.id) && !serverStatus?.ok)}
                  >
                    <Save className="h-4 w-4" />
                    {isLoading ? 'Saving...' : 'Save'}
                  </Button>
                )}
                <JobQueueIndicator />
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            {currentView === "capture" ? (
              <QuickCapturePage />
            ) : currentView === "collections" ? (
              <CollectionsManager
                onNoteSelect={(noteId) => {
                  const note = notes.find(n => n.id === noteId);
                  if (note) {
                    setSelectedNote(note);
                    setNoteContent(note.content);
                    setRevisedContent(note.revised_content || note.content);
                    setCurrentView("notes");
                  }
                }}
              />
            ) : currentView === "health" ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Health Scope</CardTitle>
                    <CardDescription>
                      Showing health metrics for archive:{" "}
                      <span className="font-medium">
                        {activeMemoryName ?? defaultMemoryName ?? "server default"}
                      </span>
                    </CardDescription>
                  </CardHeader>
                </Card>
                <KnowledgeHealthDashboard />
              </div>
            ) : currentView === "graph" ? (
              <GraphExplorer
                initialNoteId={selectedNote?.id || notes[0]?.id}
                onNoteSelect={(noteId) => {
                  const note = notes.find(n => n.id === noteId);
                  if (note) {
                    setSelectedNote(note);
                    setNoteContent(note.content);
                    setRevisedContent(note.revised_content || note.content);
                    setCurrentView("notes");
                  }
                }}
              />
            ) : currentView === "timeline" ? (
              <TimelineView
                onNoteSelect={(noteId) => {
                  const note = notes.find(n => n.id === noteId);
                  if (note) {
                    setSelectedNote(note);
                    setNoteContent(note.content);
                    setRevisedContent(note.revised_content || note.content);
                    setCurrentView("notes");
                  }
                }}
              />
            ) : currentView === "templates" ? (
              <TemplateManager />
            ) : currentView === "admin" ? (
              <AdminPanel />
            ) : currentView === "attachments" ? (
              <AttachmentsBrowser />
            ) : currentView === "concepts" ? (
              <ConceptBrowser />
            ) : currentView === "versions" ? (
              <VersionHistory
                noteId={selectedNote?.id || ""}
                isOpen={true}
                onClose={() => setCurrentView("notes")}
                onRestore={async () => {
                  // Refresh the selected note after version restore
                  if (selectedNote?.id) {
                    try {
                      const freshNote = await api.getNote(selectedNote.id);
                      const updatedNote = {
                        id: freshNote.note.id,
                        title: freshNote.note.title || freshNote.original.content.split('\n')[0].substring(0, 50) || "Untitled",
                        content: freshNote.original.content,
                        revised_content: freshNote.revised ? freshNote.revised.content : null,
                        createdAt: freshNote.note.created_at_utc,
                        updatedAt: freshNote.note.updated_at_utc,
                        tags: freshNote.tags,
                        starred: freshNote.note.starred || false,
                        archived: freshNote.note.archived || false,
                        ai_generated_title: freshNote.note.title,
                        revised_model: freshNote.revised ? freshNote.revised.model : null
                      };
                      setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
                      setSelectedNote(updatedNote);
                      setNoteContent(updatedNote.content);
                      setRevisedContent(updatedNote.revised_content || updatedNote.content);
                    } catch (error) {
                      console.error("Failed to refresh note after version restore:", error);
                    }
                  }
                }}
              />
            ) : currentView === "backup" ? (
              <BackupManager />
            ) : currentView === "archives" ? (
              <ArchiveManager />
            ) : currentView === "embeddings" ? (
              <EmbeddingSetManager />
            ) : currentView === "tags" ? (
              <TagManager />
            ) : currentView === "search" ? (
              <SearchPage
                initialQuery={pendingSearchQuery}
                initialMode={searchMode !== 'local' ? searchMode : undefined}
                onSelectResult={(noteId) => {
                  const note = notes.find((n) => n.id === noteId);
                  if (note) {
                    setSelectedNote(note);
                    setCurrentView("notes");
                  }
                }}
              />
            ) : currentView === "agent" ? (
              <AgentPanel
                context={{
                  noteId: selectedNote?.id,
                }}
                onNoteClick={async (noteId) => {
                  try {
                    const fullNote = await api.getNote(noteId);
                    const simpleNote: Note = {
                      id: fullNote.note.id,
                      title: fullNote.note.title || fullNote.original.content.split('\n')[0].substring(0, 50) || "Untitled",
                      content: fullNote.original.content,
                      revised_content: fullNote.revised ? fullNote.revised.content : null,
                      createdAt: fullNote.note.created_at_utc,
                      updatedAt: fullNote.note.updated_at_utc,
                      tags: fullNote.tags,
                      starred: fullNote.note.starred || false,
                      archived: fullNote.note.archived || false,
                      ai_generated_title: fullNote.note.title,
                      revised_model: fullNote.revised ? fullNote.revised.model : null,
                    };
                    savedNotes.current.set(fullNote.note.id, fullNote);
                    setSelectedNote(simpleNote);
                    setNoteContent(simpleNote.content);
                    setRevisedContent(simpleNote.revised_content || simpleNote.content);
                    setCurrentView("notes");
                  } catch (err) {
                    console.error(`[AgentPanel] Failed to fetch note ${noteId}:`, err);
                    // Navigate anyway with minimal data so the click isn't silent.
                    // The note view will show the ID; the user can retry manually.
                    setSelectedNote({
                      id: noteId,
                      title: noteId.slice(0, 8) + "…",
                      content: "",
                      revised_content: null,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      tags: [],
                      starred: false,
                      archived: false,
                      ai_generated_title: null,
                      revised_model: null,
                    });
                    setNoteContent("");
                    setRevisedContent("");
                    setCurrentView("notes");
                  }
                }}
              />
            ) : currentView === "jobs" ? (
              <JobQueueView archives={availableMemories} />
            ) : currentView === "realtime-debug" ? (
              <RealtimeEventInspector />
            ) : currentView === "dashboard" ? (
              <div className="flex flex-col h-full gap-6">
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">System Dashboard</h2>
                      <p className="text-sm text-muted-foreground">
                        Unified operational view of server state, realtime transport, and job activity.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void refreshDashboardData()}
                      disabled={isRefreshingSystemSnapshot}
                    >
                      {isRefreshingSystemSnapshot ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Refresh States
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          API
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <Badge variant={serverStatus?.ok ? "secondary" : "destructive"}>
                          {serverStatus?.ok ? "online" : "offline"}
                        </Badge>
                        {serverStatus?.message && (
                          <p className="text-xs text-muted-foreground">{serverStatus.message}</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Services
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <div className="font-medium">status: {systemSnapshot?.status ?? "unknown"}</div>
                        <div className="text-muted-foreground">db: {systemSnapshot?.database ?? "unknown"}</div>
                        <div className="text-muted-foreground">llm: {systemSnapshot?.ollama ?? "unknown"}</div>
                        {systemSnapshotError && (
                          <div className="text-xs text-red-500">{systemSnapshotError}</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock3 className="h-4 w-4" />
                          Realtime
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <Badge variant={realtimeConnected ? "secondary" : "destructive"}>
                          {realtimeConnectionState ?? (realtimeConnected ? "connected" : "disconnected")}
                        </Badge>
                        <div className="text-muted-foreground">
                          transport: {realtimeTransportMode ?? "none"}
                        </div>
                        <div className="text-muted-foreground">
                          replay: {replayCursor ?? "n/a"}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BookMarked className="h-4 w-4" />
                          Runtime
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <div>version: {systemSnapshot?.version ?? "unknown"}</div>
                        <div className="text-muted-foreground">notes loaded: {notes.length}</div>
                        <div className="text-muted-foreground">processing: {processingNotes.size}</div>
                        <div className="text-muted-foreground">
                          archive: {activeMemoryName ?? "__default__"}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Version + Routing</CardTitle>
                        <CardDescription>Current API and archive targeting state</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div>API version: {systemSnapshot?.version ?? "unknown"}</div>
                        <div>Default archive: {defaultMemoryName ?? "server default"}</div>
                        <div>Selected archive: {activeMemoryName ?? "__default__"}</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Archive Health Summary</CardTitle>
                      <CardDescription>
                        Snapshot health score (%) for each archive
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {isLoadingArchiveHealth ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading archive health...
                        </div>
                      ) : availableMemories.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No archives available.
                        </div>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {availableMemories.map((archive) => {
                            const snapshot = archiveHealthByName[archive.name];
                            return (
                              <div
                                key={archive.id}
                                className="rounded border p-3 text-sm"
                              >
                                <div className="font-medium">{archive.name}</div>
                                <div className="text-muted-foreground">
                                  health: {snapshot?.score ?? "--"}%
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  notes: {snapshot?.totalNotes ?? "--"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <JobManagementPanel archives={availableMemories} />

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Job Activity</CardTitle>
                      <CardDescription>Queue progress and recent completed work</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <JobQueueMonitor />
                    </CardContent>
                  </Card>

                  <KnowledgeHealthDashboard />

                  <RealtimeEventInspector />
                </div>
              </div>
            ) : currentView === "notes" ? (
              <div className="flex h-full flex-col gap-4 lg:flex-row">
                {!notesNavigatorExpanded && (
                  <div className="lg:hidden">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNotesNavigatorExpanded(true)}
                      className="gap-2"
                    >
                      <BookOpen className="h-4 w-4" />
                      Open Notes Navigator
                    </Button>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {selectedNote ? (
                    <div className="mx-auto max-w-6xl">
                      {(() => {
                        const fullNote = savedNotes.current.get(selectedNote.id);
                        const metadataConceptTags =
                          selectedNoteConceptTags.length > 0
                            ? selectedNoteConceptTags
                            : (fullNote?.concepts ?? [])
                                .filter(
                                  (concept): concept is NoteConceptSummary =>
                                    typeof concept?.concept_id === "string" &&
                                    concept.concept_id.length > 0 &&
                                    typeof concept?.pref_label === "string" &&
                                    concept.pref_label.trim().length > 0
                                )
                                .sort((a, b) => {
                                  if ((a.is_primary ?? false) !== (b.is_primary ?? false)) {
                                    return (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0);
                                  }
                                  const relevanceA = a.relevance_score ?? -1;
                                  const relevanceB = b.relevance_score ?? -1;
                                  if (relevanceA !== relevanceB) {
                                    return relevanceB - relevanceA;
                                  }
                                  const confidenceA = a.confidence ?? -1;
                                  const confidenceB = b.confidence ?? -1;
                                  if (confidenceA !== confidenceB) {
                                    return confidenceB - confidenceA;
                                  }
                                  return a.pref_label.localeCompare(b.pref_label);
                                });
                        return (
                      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                        <TabsList className="mb-4 flex w-full flex-wrap justify-start gap-1">
                              <TabsTrigger value="preview" className="gap-2">
                                <Sparkles className="h-4 w-4" />
                                AI Enhanced
                              </TabsTrigger>
                              <TabsTrigger value="original" className="gap-2">
                                <BookOpen className="h-4 w-4" />
                                Original
                              </TabsTrigger>
                              <TabsTrigger value="edit" className="gap-2">
                                <Edit3 className="h-4 w-4" />
                                Edit
                              </TabsTrigger>
                              <TabsTrigger value="metadata" className="gap-2">
                                <Hash className="h-4 w-4" />
                                Metadata
                              </TabsTrigger>
                              <TabsTrigger value="attachments" className="gap-2">
                                <Paperclip className="h-4 w-4" />
                                Attachments
                              </TabsTrigger>
                        </TabsList>

                        <TabsContent value="edit" className="h-full">
                          <Card className="border-0 shadow-none">
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <input
                                  type="text"
                                  className="text-3xl font-bold bg-transparent outline-none placeholder:text-muted-foreground flex-1"
                                  placeholder="Note title..."
                                  value={selectedNote.title}
                                  onChange={(e) => {
                                    const updatedNote = { ...selectedNote, title: e.target.value };
                                    setSelectedNote(updatedNote);
                                    setNotes(notes.map(n => n.id === updatedNote.id ? updatedNote : n));
                                  }}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    variant={editingRevised ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                      setEditingRevised(true);
                                      if (!revisedContent && selectedNote.revised_content) {
                                        setRevisedContent(selectedNote.revised_content);
                                      }
                                    }}
                                  >
                                    <Sparkles className="h-4 w-4 mr-1" />
                                    Edit AI Version
                                  </Button>
                                  <Button
                                    variant={!editingRevised ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setEditingRevised(false)}
                                  >
                                    <Edit3 className="h-4 w-4 mr-1" />
                                    Edit Original
                                  </Button>
                                </div>
                              </div>
                              <CardDescription>
                                {editingRevised ? "Editing AI-enhanced version" : "Editing original note"} • Last edited {new Date(selectedNote.updatedAt).toLocaleString()}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <MarkdownEditor
                                value={editingRevised ? revisedContent : noteContent}
                                onChange={(value) => {
                                  if (editingRevised) {
                                    setRevisedContent(value);
                                  } else {
                                    setNoteContent(value);
                                  }
                                  setHasUnsavedChanges(true);
                                }}
                                height={500}
                              />
                            </CardContent>
                          </Card>
                        </TabsContent>

                        <TabsContent value="preview">
                          <Card className="overflow-hidden">
                            <CardHeader className="border-b bg-muted/30">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                    {titleAnimations.has(selectedNote.id) && titleAnimations.get(selectedNote.id)?.isAnimating ? (
                                      <TypingAnimation
                                        oldText={titleAnimations.get(selectedNote.id)!.oldTitle}
                                        newText={titleAnimations.get(selectedNote.id)!.newTitle}
                                        onComplete={() => {
                                          setTitleAnimations(prev => {
                                            const newMap = new Map(prev);
                                            newMap.delete(selectedNote.id);
                                            return newMap;
                                          });
                                        }}
                                        speed="normal"
                                        className="text-card-foreground"
                                      />
                                    ) : (
                                      selectedNote.title
                                    )}
                                  </CardTitle>
                                  <CardDescription className="mt-1">
                                    AI-enhanced version • Updated {new Date(selectedNote.updatedAt).toLocaleString()}
                                  </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => toggleStar(selectedNote.id)}
                                    size="sm"
                                    variant={selectedNote.starred ? "default" : "outline"}
                                    title={selectedNote.starred ? "Unstar note" : "Star note"}
                                  >
                                    <Star className={`h-4 w-4 ${selectedNote.starred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                                  </Button>
                                  <Button
                                    onClick={() => copyToClipboard(selectedNote.revised_content || selectedNote.content, 'preview-markdown')}
                                    size="sm"
                                    variant="outline"
                                    title="Copy markdown"
                                  >
                                    {copiedState['preview-markdown'] ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                    <span className="ml-2">Copy MD</span>
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        disabled={isLoading || processingNotes.has(selectedNote.id)}
                                        size="sm"
                                        variant="outline"
                                      >
                                        {processingNotes.has(selectedNote.id) ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <RefreshCw className="h-4 w-4" />
                                        )}
                                        <span className="ml-2">Regenerate AI</span>
                                        <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => regenerateAI("standard")}>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        <div>
                                          <div className="font-medium">Standard</div>
                                          <div className="text-xs text-muted-foreground">Default NLP revision</div>
                                        </div>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => regenerateAI("light")}>
                                        <PenLine className="h-4 w-4 mr-2" />
                                        <div>
                                          <div className="font-medium">Light</div>
                                          <div className="text-xs text-muted-foreground">Formatting only</div>
                                        </div>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => regenerateAI("contextual")}>
                                        <Brain className="h-4 w-4 mr-2" />
                                        <div>
                                          <div className="font-medium">Contextual</div>
                                          <div className="text-xs text-muted-foreground">Full contextual expansion</div>
                                        </div>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => regenerateAI("contextual_filtered")}>
                                        <SlidersHorizontal className="h-4 w-4 mr-2" />
                                        <div>
                                          <div className="font-medium">Contextual (Filtered)</div>
                                          <div className="text-xs text-muted-foreground">Focused contextual enhancement</div>
                                        </div>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => regenerateAI("none")}>
                                        <FileText className="h-4 w-4 mr-2" />
                                        <div>
                                          <div className="font-medium">None</div>
                                          <div className="text-xs text-muted-foreground">Revert to original</div>
                                        </div>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="p-0">
                              <ScrollArea className="h-[500px]">
                                <div className="p-6">
                                  {processingNotes.has(selectedNote.id) && !selectedNote.revised_content ? (
                                    <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
                                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                      <div className="text-center">
                                        <p className="text-sm font-medium">AI is enhancing your note...</p>
                                        <p className="text-xs text-muted-foreground mt-1">This usually takes 5-10 seconds</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <MarkdownPreview
                                      content={selectedNote.revised_content || noteContent}
                                    />
                                  )}
                                </div>
                              </ScrollArea>
                            </CardContent>
                            <div className="border-t bg-muted/30 px-6 py-3">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Enhanced with AI • Powered by {selectedNote.revised_model || 'gpt-oss:20b'}</span>
                                <span>{selectedNote.revised_content ? `${selectedNote.revised_content.length} characters` : 'Original content'}</span>
                              </div>
                            </div>
                          </Card>
                        </TabsContent>

                        <TabsContent value="original">
                          <Card>
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle>
                                    {titleAnimations.has(selectedNote.id) && titleAnimations.get(selectedNote.id)?.isAnimating ? (
                                      <TypingAnimation
                                        oldText={titleAnimations.get(selectedNote.id)!.oldTitle}
                                        newText={titleAnimations.get(selectedNote.id)!.newTitle}
                                        onComplete={() => {
                                          setTitleAnimations(prev => {
                                            const newMap = new Map(prev);
                                            newMap.delete(selectedNote.id);
                                            return newMap;
                                          });
                                        }}
                                        speed="normal"
                                        className="text-card-foreground"
                                      />
                                    ) : (
                                      selectedNote.title
                                    )}
                                  </CardTitle>
                                  <CardDescription>
                                    Original note • Created {new Date(selectedNote.createdAt).toLocaleString()}
                                  </CardDescription>
                                </div>
                                <Button
                                  onClick={() => copyToClipboard(noteContent, 'original-markdown')}
                                  size="sm"
                                  variant="outline"
                                  title="Copy markdown"
                                >
                                  {copiedState['original-markdown'] ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                  <span className="ml-2">Copy MD</span>
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <ScrollArea className="h-[600px]">
                                <MarkdownPreview content={noteContent} />
                              </ScrollArea>
                            </CardContent>
                          </Card>
                        </TabsContent>

                        <TabsContent value="metadata">
                          <div className="mb-3 flex justify-end">
                            <Button
                              onClick={() => toggleStar(selectedNote.id)}
                              size="sm"
                              variant={selectedNote.starred ? "default" : "outline"}
                              title={selectedNote.starred ? "Unstar note" : "Star note"}
                            >
                              <Star className={`h-4 w-4 ${selectedNote.starred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2">
                              <NoteMetadata
                                metadata={fullNote?.note?.metadata}
                                provenance={selectedNoteProvenance}
                                tags={fullNote?.tags || []}
                                conceptTags={metadataConceptTags}
                                availableConcepts={metadataConceptOptions}
                                links={fullNote?.links || []}
                                starred={fullNote?.note?.starred}
                                archived={fullNote?.note?.archived}
                                aiMetadata={fullNote?.revised?.ai_metadata}
                                onTagClick={handleMetadataTagClick}
                                onSaveEdits={handleSaveMetadataEdits}
                                onLinkClick={async (noteId) => {
                                  try {
                                    const linkedNote = await api.getNote(noteId);
                                    const simpleNote = {
                                      id: linkedNote.note.id,
                                      title: linkedNote.original.content.split('\n')[0].substring(0, 50) || "Untitled",
                                      content: linkedNote.original.content,
                                      revised_content: linkedNote.revised ? linkedNote.revised.content : null,
                                      createdAt: linkedNote.note.created_at_utc,
                                      updatedAt: linkedNote.note.updated_at_utc,
                                      tags: linkedNote.tags,
                                      starred: linkedNote.note.starred || false,
                                      archived: linkedNote.note.archived || false,
                                      revised_model: linkedNote.revised ? linkedNote.revised.model : null
                                    };

                                    setNotes(prev => {
                                      const exists = prev.find(n => n.id === simpleNote.id);
                                      if (!exists) {
                                        return [...prev, simpleNote];
                                      }
                                      return prev;
                                    });

                                    setSelectedNote(simpleNote);
                                    setNoteContent(simpleNote.content);
                                    setRevisedContent(simpleNote.revised_content || simpleNote.content);
                                    setHasUnsavedChanges(false);
                                    savedNotes.current.set(linkedNote.note.id, linkedNote);
                                  } catch (error) {
                                    console.error("Failed to load linked note:", error);
                                  }
                                }}
                              />
                            </div>

                            <div className="h-full">
                              <RelatedNotes
                                noteId={selectedNote.id}
                                onSelectNote={async (noteId) => {
                                  try {
                                    const linkedNote = await api.getNote(noteId);
                                    const simpleNote = {
                                      id: linkedNote.note.id,
                                      title: linkedNote.original.content.split('\n')[0].substring(0, 50) || "Untitled",
                                      content: linkedNote.original.content,
                                      revised_content: linkedNote.revised ? linkedNote.revised.content : null,
                                      createdAt: linkedNote.note.created_at_utc,
                                      updatedAt: linkedNote.note.updated_at_utc,
                                      tags: linkedNote.tags,
                                      starred: linkedNote.note.starred || false,
                                      archived: linkedNote.note.archived || false,
                                      revised_model: linkedNote.revised ? linkedNote.revised.model : null
                                    };

                                    setNotes(prev => {
                                      const exists = prev.find(n => n.id === simpleNote.id);
                                      if (!exists) {
                                        return [...prev, simpleNote];
                                      }
                                      return prev;
                                    });

                                    setSelectedNote(simpleNote);
                                    setNoteContent(simpleNote.content);
                                    setRevisedContent(simpleNote.revised_content || simpleNote.content);
                                    setHasUnsavedChanges(false);
                                    savedNotes.current.set(linkedNote.note.id, linkedNote);
                                  } catch (error) {
                                    console.error("Failed to load linked note:", error);
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="attachments">
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Paperclip className="h-5 w-5" />
                                Note Attachments
                              </CardTitle>
                              <CardDescription>
                                Review, upload, download, and manage files attached to this note
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                              <AttachmentsPanel
                                noteId={selectedNote.id}
                                className="h-[620px]"
                                extractionProgress={extractionProgress}
                              />
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </Tabs>
                      );
                      })()}
                    </div>
                  ) : (
                    <Card className="h-full">
                      <CardHeader>
                        <CardTitle>Notes Workspace</CardTitle>
                        <CardDescription>Select a note from the navigator to begin.</CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        Use filters and grouping on the right panel to find notes quickly.
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div
                  className={`shrink-0 rounded-lg border bg-card transition-all duration-200 lg:h-[calc(100vh-11rem)] ${
                    notesNavigatorExpanded
                      ? "block w-full lg:w-[360px] xl:w-[420px]"
                      : "hidden lg:block lg:w-12"
                  }`}
                >
                  <div className="flex items-center justify-between border-b p-2">
                    {notesNavigatorExpanded && (
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <BookOpen className="h-4 w-4" />
                        <span>Notes Navigator</span>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setNotesNavigatorExpanded(prev => !prev)}
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${notesNavigatorExpanded ? "rotate-180" : ""}`} />
                    </Button>
                  </div>

                  {notesNavigatorExpanded && (
                    <>
                      <div className="space-y-2 border-b p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline">showing {filteredNotes.length}</Badge>
                          <Badge variant="outline">loaded {notes.length}/{notesTotalCount}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                Sort
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSortBy("created"); setSortOrder("desc"); }}>Newest First</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSortBy("created"); setSortOrder("asc"); }}>Oldest First</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSortBy("updated"); setSortOrder("desc"); }}>Recently Updated</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSortBy("updated"); setSortOrder("asc"); }}>Least Recently Updated</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSortBy("title"); setSortOrder("asc"); }}>Title A-Z</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSortBy("title"); setSortOrder("desc"); }}>Title Z-A</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                Group
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setGroupBy("none")}>No Grouping</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setGroupBy("category")}>By Category</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setGroupBy("topic")}>By Topic</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <ScrollArea className="max-h-[60vh] overflow-y-auto lg:h-[calc(100%-116px)] lg:max-h-none" onScrollCapture={handleNotesListScroll}>
                        <div className="space-y-1 p-2">
                          {filteredNotes.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              {isLoading ? "Loading notes..." : "No notes match the current filters."}
                            </div>
                          ) : (
                            Object.entries(groupedNotes()).map(([groupName, groupNotes]) => (
                              <div key={groupName || "all"} className="space-y-1">
                                {groupName && (
                                  <button
                                    className="flex w-full items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50"
                                    onClick={() => toggleGroupExpansion(groupName)}
                                  >
                                    {expandedGroups.has(groupName) ? (
                                      <ChevronDown className="h-3 w-3" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3" />
                                    )}
                                    <Folder className="h-3 w-3" />
                                    <span className="font-medium">{groupName}</span>
                                    <span className="ml-auto">({groupNotes.length})</span>
                                  </button>
                                )}
                                {(!groupName || expandedGroups.has(groupName)) && groupNotes.map((note) => (
                                  <NoteContextMenu
                                    key={note.id}
                                    noteId={note.id}
                                    isArchived={note.archived}
                                    isStarred={note.starred}
                                    onEdit={() => handleEditNote(note.id)}
                                    onViewMetadata={() => handleViewMetadata(note.id)}
                                    onRegenerate={() => handleRegenerateAI(note.id)}
                                    onDelete={() => handleDeleteNote(note.id)}
                                    onArchive={() => handleArchiveNote(note.id)}
                                    onToggleStar={() => toggleStar(note.id)}
                                  >
                                    <button
                                      className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm transition-colors hover:bg-accent ${
                                        selectedNote?.id === note.id ? "bg-primary/10" : ""
                                      }`}
                                      onClick={() => {
                                        void selectNoteFromNavigator(note);
                                      }}
                                    >
                                      {processingNotes.has(note.id) && !note.revised_content ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                      ) : (
                                        <BookOpen className="h-4 w-4 shrink-0" />
                                      )}
                                      <span className="flex-1 truncate">
                                        {titleAnimations.has(note.id) && titleAnimations.get(note.id)?.isAnimating ? (
                                          <TypingAnimation
                                            oldText={titleAnimations.get(note.id)!.oldTitle}
                                            newText={titleAnimations.get(note.id)!.newTitle}
                                            onComplete={() => {
                                              setTitleAnimations(prev => {
                                                const newMap = new Map(prev);
                                                newMap.delete(note.id);
                                                return newMap;
                                              });
                                            }}
                                            speed="fast"
                                            className="text-card-foreground"
                                          />
                                        ) : (
                                          note.title
                                        )}
                                      </span>
                                      {note.starred && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                                    </button>
                                  </NoteContextMenu>
                                ))}
                              </div>
                            ))
                          )}
                          {isLoadingMoreNotes && (
                            <div className="px-2 py-2 text-xs text-muted-foreground flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading more notes...
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <DeleteNoteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        noteTitle={noteToDelete?.title}
        onConfirm={confirmDeleteNote}
      />
    </SidebarProvider>
  );
}
