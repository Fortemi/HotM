import { useState, useEffect, useRef } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Brain,
  Plus,
  Search,
  Settings,
  Archive,
  Star,
  Hash,
  Clock,
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
  Calendar,
  Type,
  ChevronRight,
  ChevronDown,
  Folder
} from "lucide-react";
import { api, NoteFull } from "@/services/api";
import { MarkdownPreview } from "./MarkdownPreview";
import { MarkdownEditor } from "./MarkdownEditor";
import { RelatedNotes } from "./RelatedNotes";
import { NoteMetadata } from "./NoteMetadata";
import { EnhancedSearch } from "./EnhancedSearch";
import { NoteContextMenu, useGlobalContextMenuPrevention } from "./NoteContextMenu";
import { DeleteNoteDialog } from "./DeleteNoteDialog";
import { SearchDropdown } from "./SearchDropdown";
import JobQueueMonitor from "./JobQueueMonitor";
import { JobQueueIndicator } from "./JobQueueIndicator";
import { TypingAnimation } from "./TypingAnimation";

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

export function HallOfMind() {
  // Use the global context menu prevention hook
  useGlobalContextMenuPrevention();
  
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [revisedContent, setRevisedContent] = useState("");
  const [editingRevised, setEditingRevised] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"local" | "fts" | "semantic" | "hybrid">("local");
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [groupBy, setGroupBy] = useState<"none" | "category" | "topic">("none");
  const [sortBy, setSortBy] = useState<"created" | "updated" | "title">("created");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["Uncategorized"]));
  const [activeTab, setActiveTab] = useState<string>("preview");
  const [quickAccessFilter, setQuickAccessFilter] = useState<"all" | "starred" | "recent" | "archived">("all");
  const [noteLabels, setNoteLabels] = useState<Map<string, any[]>>(new Map());
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);
  const [quickNoteCollapsed, setQuickNoteCollapsed] = useState(false);
  const [quickAccessCollapsed, setQuickAccessCollapsed] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<{
    ok: boolean;
    message?: string;
  } | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [processingNotes, setProcessingNotes] = useState<Set<string>>(new Set());
  const [copiedState, setCopiedState] = useState<{ [key: string]: boolean }>({});
  
  // Refs for notification grouping and metadata caching
  const savedNotes = useRef<Map<string, NoteFull>>(new Map());
  const notificationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const metadataCache = useRef<Map<string, { data: any; timestamp: number; relatedNotes?: any }>>(new Map());
  
  // State for title animations
  const [titleAnimations, setTitleAnimations] = useState<Map<string, { oldTitle: string; newTitle: string; isAnimating: boolean }>>(new Map());
  const searchInputRef = useRef<HTMLDivElement>(null);
  const searchCache = useRef<Map<string, { results: Note[], timestamp: number }>>(new Map());

  // Check server health and load initial notes
  useEffect(() => {
    checkServerHealth();
    loadExistingNotes();
    loadAvailableTags();
  }, []);
  
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
  
  // Load available tags for filtering
  const loadAvailableTags = async () => {
    try {
      const tags = await api.getAllLabels();
      setAvailableTags(tags.slice(0, 50)); // Keep top 50 for performance
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  // Listen for WebSocket note updates
  useEffect(() => {
    // Track recent updates to prevent duplicate processing
    const recentUpdates = new Map<string, number>();
    const DUPLICATE_THRESHOLD = 1000; // 1 second
    
    const handleNoteUpdate = async (event: CustomEvent) => {
      const { note_id, title, tags, has_ai_content, has_links } = event.detail;
      
      // Check if we recently processed an update for this note
      const now = Date.now();
      const lastUpdate = recentUpdates.get(note_id);
      if (lastUpdate && (now - lastUpdate) < DUPLICATE_THRESHOLD) {
        console.log(`Ignoring duplicate update for note ${note_id}`);
        return;
      }
      
      // Record this update
      recentUpdates.set(note_id, now);
      
      console.log("Received note update:", { note_id, title, tags, has_ai_content, has_links });
      
      // If this note is being processed, fetch the full updated note and show notification
      if (processingNotes.has(note_id)) {
        try {
          const updatedNote = await api.getNote(note_id);
          if (updatedNote.revised) {
            // Simple animation logic: show animation when AI generates a title for the first time
            const currentNote = notes.find(n => n.id === updatedNote.note.id);
            const hadAiTitle = currentNote?.ai_generated_title;
            const hasNewAiTitle = updatedNote.note.title;
            
            // Trigger animation when AI title is generated for the first time
            if (!hadAiTitle && hasNewAiTitle) {
              const originalTitle = updatedNote.original.content.split('\n')[0].substring(0, 50) || "Untitled";
              setTitleAnimations(prev => new Map(prev.set(updatedNote.note.id, {
                oldTitle: originalTitle,
                newTitle: hasNewAiTitle,
                isAnimating: true
              })));
            }

            const simpleNote = {
              id: updatedNote.note.id,
              title: updatedNote.note.title || updatedNote.original.content.split('\n')[0].substring(0, 50) || "Untitled",
              content: updatedNote.original.content,
              revised_content: updatedNote.revised.content,
              createdAt: updatedNote.note.created_at_utc,
              updatedAt: updatedNote.note.updated_at_utc,
              tags: updatedNote.tags,
              starred: updatedNote.note.starred || false,
              archived: updatedNote.note.archived || false,
              ai_generated_title: updatedNote.note.title,
              revised_model: updatedNote.revised ? updatedNote.revised.model : null
            };
            
            setNotes(prev => prev.map(n => n.id === simpleNote.id ? simpleNote : n));
            
            // Update selected note if it's the one being processed
            if (selectedNote?.id === simpleNote.id) {
              setSelectedNote(simpleNote);
              setRevisedContent(simpleNote.revised_content || simpleNote.content);
              
              // Update full note cache for metadata display
              savedNotes.current.set(simpleNote.id, updatedNote);
              
              // Cache metadata with timestamp to avoid excessive API calls
              const now = Date.now();
              const cacheKey = simpleNote.id;
              const cachedData = metadataCache.current.get(cacheKey);
              const CACHE_DURATION = 30000; // 30 seconds cache
              
              if (!cachedData || (now - cachedData.timestamp) > CACHE_DURATION) {
                try {
                  const labels = await api.getMetadataLabels(simpleNote.id);
                  setNoteLabels(new Map(noteLabels.set(simpleNote.id, labels)));
                  
                  // Cache the metadata
                  metadataCache.current.set(cacheKey, {
                    data: labels,
                    timestamp: now
                  });
                } catch (error) {
                  console.error("Failed to refresh metadata labels:", error);
                }
              } else {
                // Use cached data
                setNoteLabels(new Map(noteLabels.set(simpleNote.id, cachedData.data)));
                console.log("Using cached metadata for note:", simpleNote.id);
              }
            }
            
            // Group notifications to prevent duplicates for multi-job pipelines
            // Clear any existing timeout for this note
            const existingTimeout = notificationTimeouts.current.get(note_id);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }
            
            // Set a new timeout to send notification after 2 seconds of no more updates
            const notificationTimeout = setTimeout(async () => {
              // Remove from processing set
              setProcessingNotes(prev => {
                const newSet = new Set(prev);
                newSet.delete(note_id);
                return newSet;
              });
              
              // Send notification once all jobs for this note are complete
              try {
                // Check if we're running in Tauri environment
                if (typeof window !== 'undefined' && (window as any).__TAURI__) {
                  const { 
                    isPermissionGranted, 
                    requestPermission, 
                    sendNotification 
                  } = await import('@tauri-apps/plugin-notification');
                  
                  // Check/request notification permission
                  let hasPermission = await isPermissionGranted();
                  if (!hasPermission) {
                    const permission = await requestPermission();
                    hasPermission = permission === 'granted';
                  }
                  
                  if (hasPermission) {
                    await sendNotification({
                      title: 'HotM - Processing Complete',
                      body: `Note "${simpleNote.title}" has been processed with AI enhancements. Click to view.`,
                      sound: 'default'
                    });
                    console.log("Grouped notification sent for processed note:", note_id);
                  } else {
                    console.warn("Notification permission not granted");
                  }
                } else {
                  // Fallback for development/web environment
                  console.log(`Note processing complete: ${simpleNote.title}`);
                  
                  // Try to use browser notifications as fallback
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('HotM - Processing Complete', {
                      body: `Note "${simpleNote.title}" has been processed with AI enhancements.`,
                      icon: '/favicon.ico'
                    });
                  } else if ('Notification' in window && Notification.permission === 'default') {
                    // Request permission and try again
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                      new Notification('HotM - Processing Complete', {
                        body: `Note "${simpleNote.title}" has been processed with AI enhancements.`,
                        icon: '/favicon.ico'
                      });
                    }
                  }
                }
              } catch (error) {
                console.error("Failed to send notification:", error);
              }
              
              // Clean up the timeout reference
              notificationTimeouts.current.delete(note_id);
            }, 2000); // Wait 2 seconds for additional updates
            
            notificationTimeouts.current.set(note_id, notificationTimeout);
            
            console.log("Note updated via WebSocket:", note_id);
          }
        } catch (error) {
          console.error("Failed to fetch updated note:", error);
        }
      } else {
        // Just update the note metadata (tags, etc.) without full fetch
        setNotes(prev => prev.map(note => 
          note.id === note_id
            ? { ...note, tags: tags || note.tags }
            : note
        ));
        
        // If this note is currently selected, refresh its metadata with caching
        if (selectedNote?.id === note_id) {
          const now = Date.now();
          const cacheKey = note_id;
          const cachedData = metadataCache.current.get(cacheKey);
          const CACHE_DURATION = 30000; // 30 seconds cache
          
          if (!cachedData || (now - cachedData.timestamp) > CACHE_DURATION) {
            try {
              // Refresh the full note data
              const updatedNote = await api.getNote(note_id);
              savedNotes.current.set(note_id, updatedNote);
              
              // Refresh metadata labels
              const labels = await api.getMetadataLabels(note_id);
              setNoteLabels(new Map(noteLabels.set(note_id, labels)));
              
              // Cache the metadata
              metadataCache.current.set(cacheKey, {
                data: labels,
                timestamp: now
              });
              
              console.log("Metadata refreshed for currently selected note:", note_id);
            } catch (error) {
              console.error("Failed to refresh metadata for selected note:", error);
            }
          } else {
            // Use cached data
            setNoteLabels(new Map(noteLabels.set(note_id, cachedData.data)));
            console.log("Using cached metadata for selected note:", note_id);
          }
        }
      }
    };
    
    window.addEventListener('noteUpdated', handleNoteUpdate as unknown as EventListener);
    
    return () => {
      window.removeEventListener('noteUpdated', handleNoteUpdate as unknown as EventListener);
    };
  }, [processingNotes, selectedNote, api]);

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

  const loadExistingNotes = async () => {
    try {
      setIsLoading(true);
      const existingNotes = await api.getRecentNotes();
      
      if (existingNotes.length > 0) {
        const simpleNotes = existingNotes.map(note => {
          // Store the full note data
          savedNotes.current.set(note.note.id, note);
          
          // Log if we have revised content
          if (note.revised && note.revised.content) {
            console.log(`Note ${note.note.id} has AI revision (${note.revised.content.length} chars)`);
          }
          
          // Create simplified version for UI
          console.log(`Loading note ${note.note.id}: starred=${note.note.starred}, archived=${note.note.archived}`);
          return {
            id: note.note.id,
            title: note.note.title || note.original.content.split('\n')[0].substring(0, 50) || "Untitled",
            content: note.original.content,
            revised_content: note.revised ? note.revised.content : null,
            createdAt: note.note.created_at_utc,
            updatedAt: note.note.updated_at_utc,
            tags: note.tags,
            starred: note.note.starred || false,
            archived: note.note.archived || false,
            ai_generated_title: note.note.title,
            revised_model: note.revised ? note.revised.model : null
          };
        });
        setNotes(simpleNotes);
        
        // If we have a selected note, update it with the fresh data
        if (selectedNote) {
          const updatedSelected = simpleNotes.find(n => n.id === selectedNote.id);
          if (updatedSelected) {
            setSelectedNote(updatedSelected);
            setNoteContent(updatedSelected.content);
          }
        }
        
        console.log(`Loaded ${simpleNotes.length} notes from server`);
      } else {
        console.log("No existing notes found");
      }
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
      const response = await api.createNote(newNoteContent);
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
      // The WebSocket noteUpdated event will handle updating the UI when jobs complete
      
      setNotes([simpleNote, ...notes]);
      setSelectedNote(simpleNote);
      setNoteContent(simpleNote.content);
      setNewNoteContent("");
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

  const regenerateAI = async () => {
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
      await api.regenerateAI(selectedNote.id);
      
      console.log("AI regeneration triggered for note:", selectedNote.id);
      // The WebSocket noteUpdated event will handle updating the UI when jobs complete
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

  // Apply quick access filter first
  let quickFilteredNotes = sortedNotes;
  if (quickAccessFilter === "starred") {
    quickFilteredNotes = sortedNotes.filter(note => note.starred);
  } else if (quickAccessFilter === "recent") {
    // Show the 10 most recent notes (excluding archived)
    quickFilteredNotes = sortedNotes.filter(note => !note.archived).slice(0, 10);
  } else if (quickAccessFilter === "archived") {
    // Show only archived notes
    quickFilteredNotes = sortedNotes.filter(note => note.archived);
  } else {
    // Default: show all non-archived notes
    quickFilteredNotes = sortedNotes.filter(note => !note.archived);
  }
  
  // Apply tag filter if any tags are selected
  if (selectedTags.size > 0) {
    quickFilteredNotes = quickFilteredNotes.filter(note => {
      if (!note.tags || note.tags.length === 0) return false;
      // Check if note has ALL selected tags (AND operation)
      return Array.from(selectedTags).every(tag => 
        note.tags.includes(tag)
      );
    });
  }
  
  const filteredNotes = searchMode === "local" 
    ? quickFilteredNotes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : quickFilteredNotes; // When in search mode, notes are already filtered from server
  
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
                <p className="text-xs text-muted-foreground">Your personal sanctuary</p>
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
                  checkServerHealth();
                  loadExistingNotes();
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="flex flex-col">
            <SidebarGroup>
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

            <SidebarGroup>
              <SidebarGroupLabel>
                <button
                  onClick={() => setQuickAccessCollapsed(!quickAccessCollapsed)}
                  className="flex items-center justify-between w-full hover:bg-accent/50 rounded px-1 py-0.5 transition-colors"
                >
                  <span>Quick Access</span>
                  {quickAccessCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </SidebarGroupLabel>
              {!quickAccessCollapsed && (
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setQuickAccessFilter(quickAccessFilter === "starred" ? "all" : "starred")}
                      className={quickAccessFilter === "starred" ? "bg-primary/10" : ""}
                    >
                      <Star className="h-4 w-4" />
                      <span>Starred</span>
                      <Badge variant="secondary" className="ml-auto">
                        {notes.filter(n => n.starred).length}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setQuickAccessFilter(quickAccessFilter === "archived" ? "all" : "archived")}
                      className={quickAccessFilter === "archived" ? "bg-primary/10" : ""}
                    >
                      <Archive className="h-4 w-4" />
                      <span>Archived</span>
                      <Badge variant="secondary" className="ml-auto">
                        {notes.filter(n => n.archived).length}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              )}
            </SidebarGroup>
            
            {/* Tag Filter Section */}
            <SidebarGroup>
              <SidebarGroupLabel>
                <button
                  onClick={() => setTagsCollapsed(!tagsCollapsed)}
                  className="flex items-center gap-1 w-full hover:bg-accent/50 rounded px-1 py-0.5 transition-colors"
                >
                  <span>Tag Filter</span>
                  {selectedTags.size > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {selectedTags.size}
                    </Badge>
                  )}
                  {tagsCollapsed ? (
                    <ChevronRight className="h-3 w-3 ml-auto" />
                  ) : (
                    <ChevronDown className="h-3 w-3 ml-auto" />
                  )}
                </button>
              </SidebarGroupLabel>
              {!tagsCollapsed && (
                <SidebarGroupContent>
                  <div className="px-3 py-2 space-y-2">
                    {/* Tag search input */}
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search tags..."
                        value={tagSearchQuery}
                        onChange={(e) => setTagSearchQuery(e.target.value)}
                        className="w-full pl-7 pr-2 py-1.5 text-xs bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    
                    {/* Selected tags */}
                    {selectedTags.size > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Active filters:</span>
                          <button
                            onClick={() => setSelectedTags(new Set())}
                            className="text-xs text-muted-foreground hover:text-primary"
                          >
                            Clear all
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(selectedTags).map((tag) => (
                            <Badge
                              key={`selected-${tag}`}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tag}
                              <button
                                onClick={() => {
                                  const newSelected = new Set(selectedTags);
                                  newSelected.delete(tag);
                                  setSelectedTags(newSelected);
                                }}
                                className="ml-1 hover:text-destructive"
                              >
                                <X className="h-2 w-2" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Available tags - only show when searching */}
                    {tagSearchQuery && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">
                          Available tags:
                        </div>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                          {(() => {
                            const filtered = availableTags
                              .filter(tag => 
                                tag.toLowerCase().includes(tagSearchQuery.toLowerCase()) &&
                                !selectedTags.has(tag)
                              )
                              .slice(0, 10); // Limit to 10 tags
                            
                            if (filtered.length === 0) {
                              return (
                                <div className="text-xs text-muted-foreground py-2">
                                  No matching tags found
                                </div>
                              );
                            }
                            
                            // Group tags into rows of 2-3 for dynamic layout
                            const rows: string[][] = [];
                            let currentRow: string[] = [];
                            let currentRowLength = 0;
                            
                            filtered.forEach(tag => {
                              const tagLength = tag.length;
                              // Start new row if current is getting too long
                              if (currentRowLength + tagLength > 20 && currentRow.length > 0) {
                                rows.push(currentRow);
                                currentRow = [tag];
                                currentRowLength = tagLength;
                              } else {
                                currentRow.push(tag);
                                currentRowLength += tagLength + 1;
                                // Max 3 per row
                                if (currentRow.length >= 3) {
                                  rows.push(currentRow);
                                  currentRow = [];
                                  currentRowLength = 0;
                                }
                              }
                            });
                            
                            if (currentRow.length > 0) {
                              rows.push(currentRow);
                            }
                            
                            return rows.map((row, rowIndex) => (
                              <div key={`row-${rowIndex}`} className="flex flex-wrap gap-1">
                                {row.map(tag => (
                                  <Badge
                                    key={tag}
                                    variant="outline"
                                    className="text-xs cursor-pointer hover:bg-accent transition-colors"
                                    onClick={() => {
                                      const newSelected = new Set(selectedTags);
                                      newSelected.add(tag);
                                      setSelectedTags(newSelected);
                                      setTagSearchQuery(""); // Clear search after selection
                                    }}
                                  >
                                    <Plus className="h-2 w-2 mr-1" />
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {/* Help text when no search */}
                    {!tagSearchQuery && selectedTags.size === 0 && (
                      <div className="text-xs text-muted-foreground">
                        Type to search and filter by tags
                      </div>
                    )}
                  </div>
                </SidebarGroupContent>
              )}
            </SidebarGroup>

            <Separator className="my-2 flex-shrink-0" />

            <SidebarGroup className="flex-1 flex flex-col min-h-0">
              <div className="px-3 py-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <SidebarGroupLabel className="p-0">
                    Notes ({filteredNotes.length})
                    {quickAccessFilter !== "all" && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {quickAccessFilter}
                      </Badge>
                    )}
                    {selectedTags.size > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {selectedTags.size} tag{selectedTags.size > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </SidebarGroupLabel>
                  <div className="flex items-center gap-1">
                    {quickAccessFilter !== "all" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => setQuickAccessFilter("all")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clear filter</TooltipContent>
                      </Tooltip>
                    )}
                    <TooltipProvider>
                      {/* Sort Control */}
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                {sortBy === "created" ? (
                                  <Calendar className="h-3 w-3" />
                                ) : sortBy === "updated" ? (
                                  <Clock className="h-3 w-3" />
                                ) : (
                                  <Type className="h-3 w-3" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p>Sort: {sortBy === "created" ? "Created" : sortBy === "updated" ? "Updated" : "Title"} {sortOrder === "asc" ? "↑" : "↓"}</p>
                          </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSortBy("created"); setSortOrder("desc"); }}>
                            <Calendar className="h-3 w-3 mr-2" />
                            Newest First
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSortBy("created"); setSortOrder("asc"); }}>
                            <Calendar className="h-3 w-3 mr-2" />
                            Oldest First
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSortBy("updated"); setSortOrder("desc"); }}>
                            <Clock className="h-3 w-3 mr-2" />
                            Recently Updated
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSortBy("updated"); setSortOrder("asc"); }}>
                            <Clock className="h-3 w-3 mr-2" />
                            Least Recently Updated
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSortBy("title"); setSortOrder("asc"); }}>
                            <Type className="h-3 w-3 mr-2" />
                            Title A-Z
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSortBy("title"); setSortOrder("desc"); }}>
                            <Type className="h-3 w-3 mr-2" />
                            Title Z-A
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      {/* Group Control */}
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Folder className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p>Group: {groupBy === "none" ? "None" : groupBy === "category" ? "Category" : "Topic"}</p>
                          </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setGroupBy("none")}>
                            <X className="h-3 w-3 mr-2" />
                            No Grouping
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setGroupBy("category")}>
                            <Hash className="h-3 w-3 mr-2" />
                            By Category
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setGroupBy("topic")}>
                            <Archive className="h-3 w-3 mr-2" />
                            By Topic
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1 overflow-y-auto">
                <SidebarMenu>
                  {filteredNotes.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {isLoading ? "Loading notes..." : "No notes yet. Create your first note above!"}
                    </div>
                  ) : (
                    Object.entries(groupedNotes()).map(([groupName, groupNotes]) => (
                      <div key={groupName || "all"}>
                        {groupName && (
                          <div 
                            className="px-3 py-1 flex items-center gap-1 text-xs text-muted-foreground hover:bg-accent/50 cursor-pointer sticky top-0 bg-background z-10"
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
                          </div>
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
                            <SidebarMenuItem data-allow-context="true" className={groupName ? "pl-6" : ""}>
                              <SidebarMenuButton
                                onClick={async () => {
                                  // First set the local state
                                  setSelectedNote(note);
                                  setNoteContent(note.content);
                                  setRevisedContent(note.revised_content || note.content);
                                  setEditingRevised(false); // Default to editing original
                                  setHasUnsavedChanges(false); // Reset unsaved changes flag
                                  
                                  // Then fetch fresh data from server
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
                                    console.log(`Fetched note ${note.id} - starred: ${updatedNote.starred}, archived: ${updatedNote.archived}`);
                                    
                                    // Update the note in the list
                                    setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
                                    
                                    // Update selected note with fresh data
                                    setSelectedNote(updatedNote);
                                    setNoteContent(updatedNote.content);
                                    setRevisedContent(updatedNote.revised_content || updatedNote.content);
                                    
                                    // Update saved notes cache
                                    savedNotes.current.set(freshNote.note.id, freshNote);
                                    
                                    // Load metadata labels for this note
                                    try {
                                      const labels = await api.getMetadataLabels(note.id);
                                      setNoteLabels(new Map(noteLabels.set(note.id, labels)));
                                    } catch (error) {
                                      console.error("Failed to load labels:", error);
                                    }
                                    
                                    console.log("Note refreshed from server:", note.id);
                                  } catch (error) {
                                    console.error("Failed to refresh note:", error);
                                  }
                                }}
                                className={selectedNote?.id === note.id ? "bg-primary/10 border-l-2 border-l-primary" : ""}
                              >
                                {processingNotes.has(note.id) && !note.revised_content ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                ) : (
                                  <BookOpen className="h-4 w-4" />
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
                                      className="text-sidebar-foreground"
                                    />
                                  ) : (
                                    note.title
                                  )}
                                </span>
                                {note.starred && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          </NoteContextMenu>
                        ))}
                      </div>
                    ))
                  )}
                </SidebarMenu>
              </ScrollArea>
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
              <Button variant="ghost" size="icon">
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
                      // Navigate to search tab - select first note if none selected
                      if (!selectedNote && notes.length > 0) {
                        const firstNote = notes[0];
                        setSelectedNote(firstNote);
                        setNoteContent(firstNote.content);
                        setRevisedContent(firstNote.revised_content || firstNote.content);
                      }
                      setActiveTab('search');
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
                    // Navigate to search tab
                    if (!selectedNote && notes.length > 0) {
                      const firstNote = notes[0];
                      setSelectedNote(firstNote);
                      setNoteContent(firstNote.content);
                      setRevisedContent(firstNote.revised_content || firstNote.content);
                    }
                    setActiveTab('search');
                    setShowSearchResults(false);
                  }}
                  anchorRef={searchInputRef}
                  savedNotes={savedNotes.current}
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
                {selectedNote && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleStar(selectedNote.id)}
                    title={selectedNote.starred ? "Unstar note" : "Star note"}
                  >
                    <Star className={`h-4 w-4 ${selectedNote.starred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                  </Button>
                )}
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

          <main className="flex-1 p-6">
            {selectedNote ? (
              <div className="mx-auto max-w-4xl">
                {(() => {
                  const fullNote = savedNotes.current.get(selectedNote.id);
                  return (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                  <TabsList className="mb-4">
                    {activeTab !== 'search' && (
                      <>
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
                      </>
                    )}
                    {activeTab === 'search' && (
                      <TabsTrigger value="search" className="gap-2">
                        <Search className="h-4 w-4" />
                        Search Results
                      </TabsTrigger>
                    )}
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
                            <Button
                              onClick={regenerateAI}
                              disabled={isLoading}
                              size="sm"
                              variant="outline"
                            >
                              {processingNotes.has(selectedNote.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                              <span className="ml-2">Regenerate AI</span>
                            </Button>
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

                  <TabsContent value="search">
                    <EnhancedSearch 
                      searchQuery={searchQuery}
                      searchMode={searchMode === 'local' ? 'hybrid' : searchMode as 'hybrid' | 'fts' | 'semantic'}
                      onSearchModeChange={(mode) => setSearchMode(mode)}
                      onSelectNote={(noteId) => {
                        const note = notes.find(n => n.id === noteId);
                        if (note) {
                          setSelectedNote(note);
                          setNoteContent(note.content);
                          setRevisedContent(note.revised_content || note.content);
                          // Jump to AI enhanced view
                          setActiveTab('preview');
                        }
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="metadata">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2">
                        <NoteMetadata
                          tags={fullNote?.tags || []}
                          links={fullNote?.links || []}
                          starred={fullNote?.note?.starred}
                          archived={fullNote?.note?.archived}
                          aiMetadata={fullNote?.revised?.ai_metadata}
                          onTagClick={(tag) => {
                            // Search for the tag
                            setSearchQuery(`#${tag}`);
                          }}
                          onLinkClick={async (noteId) => {
                            // Load the linked note
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
                              
                              // Add to notes if not already there
                              setNotes(prev => {
                                const exists = prev.find(n => n.id === simpleNote.id);
                                if (!exists) {
                                  return [...prev, simpleNote];
                                }
                                return prev;
                              });
                              
                              // Select the linked note
                              setSelectedNote(simpleNote);
                              setNoteContent(simpleNote.content);
                              setRevisedContent(simpleNote.revised_content || simpleNote.content);
                              setHasUnsavedChanges(false);
                              
                              // Cache the full note
                              savedNotes.current.set(linkedNote.note.id, linkedNote);
                            } catch (error) {
                              console.error("Failed to load linked note:", error);
                            }
                          }}
                        />
                      </div>
                      
                      {/* Related Notes */}
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
                              
                              // Add to notes if not already there
                              setNotes(prev => {
                                const exists = prev.find(n => n.id === simpleNote.id);
                                if (!exists) {
                                  return [...prev, simpleNote];
                                }
                                return prev;
                              });
                              
                              // Select the linked note
                              setSelectedNote(simpleNote);
                              setNoteContent(simpleNote.content);
                              setRevisedContent(simpleNote.revised_content || simpleNote.content);
                              setHasUnsavedChanges(false);
                              
                              // Cache the full note
                              savedNotes.current.set(linkedNote.note.id, linkedNote);
                            } catch (error) {
                              console.error("Failed to load linked note:", error);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                );
                })()}
              </div>
            ) : (
              <div className="flex flex-col h-full gap-6">
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Brain className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No note selected</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Create a new note or select an existing one to get started
                    </p>
                    <Button onClick={createNewNote} className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Create New Note
                    </Button>
                  </div>
                </div>
                <div className="max-w-2xl mx-auto w-full">
                  <JobQueueMonitor />
                </div>
              </div>
            )}
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