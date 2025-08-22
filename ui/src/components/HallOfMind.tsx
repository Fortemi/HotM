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
  SidebarInset,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Loader2
} from "lucide-react";
import { api, NoteFull } from "@/services/api";
import { MarkdownPreview } from "./MarkdownPreview";
import { MarkdownEditor } from "./MarkdownEditor";
import { RelatedNotes } from "./RelatedNotes";
import { EnhancedSearch } from "./EnhancedSearch";

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  starred: boolean;
  revised_content?: string;
}

export function HallOfMind() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<{
    ok: boolean;
    message?: string;
  } | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const savedNotes = useRef<Map<string, NoteFull>>(new Map());

  // Check server health and load initial notes
  useEffect(() => {
    checkServerHealth();
    loadExistingNotes();
  }, []);

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
          
          // Create simplified version for UI
          return {
            id: note.note.id,
            title: note.original.content.split('\n')[0].substring(0, 50) || "Untitled",
            content: note.original.content,
            revised_content: note.revised.content,
            createdAt: note.note.created_at_utc,
            updatedAt: note.note.updated_at_utc,
            tags: note.tags,
            starred: false
          };
        });
        setNotes(simpleNotes);
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
        revised_content: fullNote.revised.content,
        createdAt: fullNote.note.created_at_utc,
        updatedAt: fullNote.note.updated_at_utc,
        tags: fullNote.tags,
        starred: false
      };
      
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
    
    try {
      setIsLoading(true);
      await api.updateRevision(selectedNote.id, noteContent, "Manual edit");
      
      // Update local state
      const updatedNotes = notes.map(note => 
        note.id === selectedNote.id 
          ? { ...note, content: noteContent, revised_content: noteContent, updatedAt: new Date().toISOString() }
          : note
      );
      setNotes(updatedNotes);
      
      // Update the selected note too
      setSelectedNote({
        ...selectedNote,
        content: noteContent,
        revised_content: noteContent,
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

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        <Sidebar className="border-r">
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
                  <MarkdownEditor
                    value={newNoteContent}
                    onChange={setNewNoteContent}
                    height={150}
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
                          onClick={() => {
                            setSelectedNote(note);
                            setNoteContent(note.content);
                          }}
                          className={selectedNote?.id === note.id ? "bg-accent" : ""}
                        >
                          <BookOpen className="h-4 w-4" />
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

        <SidebarInset className="flex flex-1 flex-col">
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
                    <TabsTrigger value="search" className="gap-2">
                      <Search className="h-4 w-4" />
                      Smart Search
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="edit" className="h-full">
                    <Card className="border-0 shadow-none">
                      <CardHeader>
                        <input
                          type="text"
                          className="text-3xl font-bold bg-transparent outline-none placeholder:text-muted-foreground"
                          placeholder="Note title..."
                          value={selectedNote.title}
                          onChange={(e) => {
                            const updatedNote = { ...selectedNote, title: e.target.value };
                            setSelectedNote(updatedNote);
                            setNotes(notes.map(n => n.id === updatedNote.id ? updatedNote : n));
                          }}
                        />
                        <CardDescription>
                          Last edited {new Date(selectedNote.updatedAt).toLocaleString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <MarkdownEditor
                          value={noteContent}
                          onChange={setNoteContent}
                          height={500}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="preview">
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            {selectedNote.title}
                          </CardTitle>
                          <CardDescription>
                            AI-enhanced version • Updated {new Date(selectedNote.updatedAt).toLocaleString()}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[400px]">
                            <MarkdownPreview 
                              content={selectedNote.revised_content || noteContent || "Processing note..."}
                            />
                            {selectedNote.tags.length > 0 && (
                              <div className="mt-6 pt-4 border-t">
                                <div className="flex flex-wrap gap-2">
                                  {selectedNote.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                                    >
                                      <Hash className="h-3 w-3" />
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
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
                        <CardTitle>{selectedNote.title}</CardTitle>
                        <CardDescription>
                          Original note • Created {new Date(selectedNote.createdAt).toLocaleString()}
                        </CardDescription>
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
                </Tabs>
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
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}