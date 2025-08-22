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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  Check
} from "lucide-react";
import { api, NoteFull } from "@/services/api";
import { MarkdownPreview } from "./MarkdownPreview";
import { MarkdownEditor } from "./MarkdownEditor";
import { RelatedNotes } from "./RelatedNotes";
import { NoteMetadata } from "./NoteMetadata";
import { EnhancedSearch } from "./EnhancedSearch";

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  starred: boolean;
  revised_content?: string | null;
}

export function HallOfMind() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [revisedContent, setRevisedContent] = useState("");
  const [editingRevised, setEditingRevised] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"local" | "fts" | "semantic" | "hybrid">("local");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<{
    ok: boolean;
    message?: string;
  } | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [processingNotes, setProcessingNotes] = useState<Set<string>>(new Set());
  const [copiedState, setCopiedState] = useState<{ [key: string]: boolean }>({});
  const savedNotes = useRef<Map<string, NoteFull>>(new Map());

  // Check server health and load initial notes
  useEffect(() => {
    checkServerHealth();
    loadExistingNotes();
  }, []);

  // Auto-refresh every 10 seconds if there are processing notes
  useEffect(() => {
    if (processingNotes.size === 0) return;
    
    const interval = setInterval(() => {
      console.log("Auto-refreshing processing notes...");
      processingNotes.forEach(async (noteId) => {
        try {
          const updatedNote = await api.getNote(noteId);
          if (updatedNote.revised) {
            const simpleNote = {
              id: updatedNote.note.id,
              title: updatedNote.original.content.split('\n')[0].substring(0, 50) || "Untitled",
              content: updatedNote.original.content,
              revised_content: updatedNote.revised.content,
              createdAt: updatedNote.note.created_at_utc,
              updatedAt: updatedNote.note.updated_at_utc,
              tags: updatedNote.tags,
              starred: false
            };
            
            setNotes(prev => prev.map(n => n.id === simpleNote.id ? simpleNote : n));
            
            if (selectedNote?.id === simpleNote.id) {
              setSelectedNote(simpleNote);
              setRevisedContent(simpleNote.revised_content || simpleNote.content);
            }
            
            // Remove from processing set
            setProcessingNotes(prev => {
              const newSet = new Set(prev);
              newSet.delete(noteId);
              return newSet;
            });
            
            console.log("AI revision auto-loaded for note:", noteId);
          }
        } catch (error) {
          console.error("Failed to auto-refresh note:", error);
        }
      });
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [processingNotes, selectedNote]);

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
          return {
            id: note.note.id,
            title: note.original.content.split('\n')[0].substring(0, 50) || "Untitled",
            content: note.original.content,
            revised_content: note.revised ? note.revised.content : null,
            createdAt: note.note.created_at_utc,
            updatedAt: note.note.updated_at_utc,
            tags: note.tags,
            starred: false
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
        title: fullNote.original.content.split('\n')[0].substring(0, 50) || "Untitled",
        content: fullNote.original.content,
        revised_content: fullNote.revised ? fullNote.revised.content : null,
        createdAt: fullNote.note.created_at_utc,
        updatedAt: fullNote.note.updated_at_utc,
        tags: fullNote.tags,
        starred: false
      };
      
      // Mark note as processing
      setProcessingNotes(prev => new Set(prev).add(response.note_id));
      
      // Set a timer to reload after AI processing
      setTimeout(async () => {
        try {
          const updatedNote = await api.getNote(response.note_id);
          if (updatedNote.revised) {
            // Update the note with AI revision
            const updatedSimpleNote = {
              ...simpleNote,
              revised_content: updatedNote.revised.content
            };
            setNotes(prev => prev.map(n => n.id === updatedSimpleNote.id ? updatedSimpleNote : n));
            if (selectedNote?.id === updatedSimpleNote.id) {
              setSelectedNote(updatedSimpleNote);
            }
            console.log("AI revision loaded for note:", response.note_id);
          }
        } catch (error) {
          console.error("Failed to load AI revision:", error);
        } finally {
          // Remove from processing set
          setProcessingNotes(prev => {
            const newSet = new Set(prev);
            newSet.delete(response.note_id);
            return newSet;
          });
        }
      }, 5000); // Check for AI revision after 5 seconds
      
      setNotes([simpleNote, ...notes]);
      setSelectedNote(simpleNote);
      setNoteContent(simpleNote.content);
      setNewNoteContent("");
      
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
      // Mark as processing
      setProcessingNotes(prev => new Set(prev).add(selectedNote.id));
      
      // Trigger AI regeneration using the dedicated endpoint
      await api.regenerateAI(selectedNote.id);
      
      // Wait and fetch the new AI revision
      setTimeout(async () => {
        try {
          const updatedNote = await api.getNote(selectedNote.id);
          if (updatedNote.revised) {
            setRevisedContent(updatedNote.revised.content);
            const updatedSimpleNote = {
              ...selectedNote,
              revised_content: updatedNote.revised.content
            };
            setNotes(prev => prev.map(n => n.id === updatedSimpleNote.id ? updatedSimpleNote : n));
            setSelectedNote(updatedSimpleNote);
            console.log("AI revision regenerated for note:", selectedNote.id);
          }
        } catch (error) {
          console.error("Failed to load regenerated AI revision:", error);
        } finally {
          setProcessingNotes(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedNote.id);
            return newSet;
          });
        }
      }, 5000);
    } catch (error) {
      console.error("Failed to regenerate AI enhancement:", error);
      alert("Failed to regenerate AI enhancement");
    } finally {
      setIsLoading(false);
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
      await api.updateRevision(selectedNote.id, contentToSave, rationale);
      
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
      
      console.log("Note saved successfully to server");
    } catch (error) {
      console.error("Failed to save note:", error);
      alert("Failed to save note. Check if the server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStar = (noteId: string) => {
    const updatedNotes = notes.map(note =>
      note.id === noteId ? { ...note, starred: !note.starred } : note
    );
    setNotes(updatedNotes);
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
      setSearchMode("local");
      return;
    }

    // Check for special search patterns
    if (query.startsWith('#')) {
      // Tag search - convert #tag to tag:tagname filter
      const tag = query.substring(1).trim();
      if (tag) {
        try {
          // Search for the tag using the filter parameter
          const results = await api.searchNotes(tag, "fts", `tag:${tag}`);
          if (results && results.length > 0) {
            // Map search results to our note format
            const searchNotes = results.map((hit: any) => ({
              id: hit.note_id,
              title: hit.snippet?.split('\n')[0] || "Search result",
              content: hit.snippet || "",
              revised_content: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tags: [],
              starred: false
            }));
            setNotes(searchNotes);
            setSearchMode("fts");
          } else {
            // No results, but still in search mode
            setNotes([]);
            setSearchMode("fts");
          }
        } catch (error) {
          console.error("Search failed:", error);
        }
      }
    } else if (query.length >= 3) {
      // Regular search - use hybrid mode for best results
      try {
        const results = await api.searchNotes(query, "hybrid");
        if (results && results.length > 0) {
          const searchNotes = results.map((hit: any) => ({
            id: hit.note_id,
            title: hit.snippet?.split('\n')[0] || "Search result",
            content: hit.snippet || "",
            revised_content: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: [],
            starred: false
          }));
          setNotes(searchNotes);
          setSearchMode("hybrid");
        }
      } catch (error) {
        console.error("Search failed:", error);
        setSearchMode("local");
      }
    } else {
      setSearchMode("local");
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && searchQuery.length >= 2) {
        performSearch(searchQuery);
      } else if (!searchQuery) {
        // Reset to all notes when search is cleared
        loadExistingNotes();
        setSearchMode("local");
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredNotes = searchMode === "local" 
    ? notes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes; // When in search mode, notes are already filtered from server

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
          
          <SidebarContent>
            <SidebarGroup>
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
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Quick Access</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Star className="h-4 w-4" />
                    <span>Starred</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Clock className="h-4 w-4" />
                    <span>Recent</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Archive className="h-4 w-4" />
                    <span>Archive</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <Separator className="my-2" />

            <SidebarGroup>
              <SidebarGroupLabel>
                Your Notes {notes.length > 0 && `(${filteredNotes.length})`}
              </SidebarGroupLabel>
              <ScrollArea className="h-[400px]">
                <SidebarMenu>
                  {filteredNotes.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {isLoading ? "Loading notes..." : "No notes yet. Create your first note above!"}
                    </div>
                  ) : (
                    filteredNotes.map((note) => (
                      <SidebarMenuItem key={note.id}>
                        <SidebarMenuButton
                          onClick={async () => {
                            // First set the local state
                            setSelectedNote(note);
                            setNoteContent(note.content);
                            setRevisedContent(note.revised_content || note.content);
                            setEditingRevised(false); // Default to editing original
                            
                            // Then fetch fresh data from server
                            try {
                              const freshNote = await api.getNote(note.id);
                              const updatedNote = {
                                id: freshNote.note.id,
                                title: freshNote.original.content.split('\n')[0].substring(0, 50) || "Untitled",
                                content: freshNote.original.content,
                                revised_content: freshNote.revised ? freshNote.revised.content : null,
                                createdAt: freshNote.note.created_at_utc,
                                updatedAt: freshNote.note.updated_at_utc,
                                tags: freshNote.tags,
                                starred: note.starred // Preserve starred state
                              };
                              
                              // Update the note in the list
                              setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
                              
                              // Update selected note with fresh data
                              setSelectedNote(updatedNote);
                              setNoteContent(updatedNote.content);
                              setRevisedContent(updatedNote.revised_content || updatedNote.content);
                              
                              // Update saved notes cache
                              savedNotes.current.set(freshNote.note.id, freshNote);
                              
                              console.log("Note refreshed from server:", note.id);
                            } catch (error) {
                              console.error("Failed to refresh note:", error);
                            }
                          }}
                          className={selectedNote?.id === note.id ? "bg-accent" : ""}
                        >
                          {processingNotes.has(note.id) && !note.revised_content ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <BookOpen className="h-4 w-4" />
                          )}
                          <span className="flex-1 truncate">{note.title}</span>
                          {note.starred && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
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
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search your mind..."
                  className="bg-transparent outline-none placeholder:text-muted-foreground flex-1"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => selectedNote && toggleStar(selectedNote.id)}
                >
                  <Star className={`h-4 w-4 ${selectedNote?.starred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveNote}
                  className="gap-2"
                  disabled={isLoading || (!!selectedNote && savedNotes.current.has(selectedNote.id) && !serverStatus?.ok)}
                >
                  <Save className="h-4 w-4" />
                  {isLoading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6">
            {selectedNote ? (
              <div className="mx-auto max-w-4xl">
                {(() => {
                  const fullNote = savedNotes.current.get(selectedNote.id);
                  return (
                <Tabs defaultValue="preview" className="h-full">
                  <TabsList className="mb-4">
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
                    <TabsTrigger value="search" className="gap-2">
                      <Search className="h-4 w-4" />
                      Smart Search
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
                          onChange={editingRevised ? setRevisedContent : setNoteContent}
                          height={500}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="preview">
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                {selectedNote.title}
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
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[400px]">
                            {processingNotes.has(selectedNote.id) && !selectedNote.revised_content ? (
                              <div className="flex flex-col items-center justify-center h-full space-y-4">
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
                          </ScrollArea>
                        </CardContent>
                      </Card>
                      
                      {/* Related Notes */}
                      <RelatedNotes 
                        noteId={selectedNote.id} 
                        onSelectNote={(noteId) => {
                          const note = notes.find(n => n.id === noteId);
                          if (note) {
                            setSelectedNote(note);
                            setNoteContent(note.content);
                          }
                        }}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="original">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>{selectedNote.title}</CardTitle>
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
                      onSelectNote={(noteId) => {
                        const note = notes.find(n => n.id === noteId);
                        if (note) {
                          setSelectedNote(note);
                          setNoteContent(note.content);
                        }
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="metadata">
                    <NoteMetadata
                      metadata={fullNote?.note?.metadata}
                      aiMetadata={fullNote?.revised?.ai_metadata}
                      tags={fullNote?.tags || []}
                      links={fullNote?.links || []}
                      starred={fullNote?.note?.starred}
                      archived={fullNote?.note?.archived}
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
                            starred: linkedNote.note.starred || false
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
                          
                          // Cache the full note
                          savedNotes.current.set(linkedNote.note.id, linkedNote);
                        } catch (error) {
                          console.error("Failed to load linked note:", error);
                        }
                      }}
                    />
                  </TabsContent>
                </Tabs>
                );
                })()}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
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
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}