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
import { Textarea } from "@/components/ui/textarea";
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
  XCircle
} from "lucide-react";
import { api, NoteFull } from "@/services/api";

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
      // Try to load the test note we created
      const testNoteId = "66a8e5c6-d5f8-4b3d-a197-2e7ff207fcc7";
      try {
        const note = await api.getNote(testNoteId);
        const simpleNote: Note = {
          id: note.note.id,
          title: note.original.content.substring(0, 50) + "...",
          content: note.original.content,
          revised_content: note.revised.content,
          createdAt: note.note.created_at_utc,
          updatedAt: note.note.updated_at_utc,
          tags: note.tags,
          starred: false
        };
        setNotes([simpleNote]);
        savedNotes.current.set(note.note.id, note);
      } catch (e) {
        // Note doesn't exist, that's ok
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
    if (!newNoteContent.trim()) {
      // Create an empty local note if no content
      const newNote: Note = {
        id: Date.now().toString(),
        title: "Untitled Note",
        content: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        starred: false
      };
      setNotes([newNote, ...notes]);
      setSelectedNote(newNote);
      setNoteContent("");
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
        title: fullNote.original.content.substring(0, 50) + "...",
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
    } catch (error) {
      console.error("Failed to create note:", error);
      alert("Failed to create note. Check if the server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveNote = async () => {
    if (!selectedNote) return;
    
    // Check if this is a server-backed note
    if (savedNotes.current.has(selectedNote.id)) {
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
        console.log("Note saved successfully");
      } catch (error) {
        console.error("Failed to save note:", error);
        alert("Failed to save note. Check if the server is running.");
      } finally {
        setIsLoading(false);
      }
    } else {
      // Local-only note
      const updatedNotes = notes.map(note => 
        note.id === selectedNote.id 
          ? { ...note, content: noteContent, updatedAt: new Date().toISOString() }
          : note
      );
      setNotes(updatedNotes);
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
            <div className="mt-2 flex items-center gap-2 text-xs">
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
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <div className="px-3 py-2 space-y-2">
                  <Textarea 
                    placeholder="Quick capture... (Ctrl+Enter to save)"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="min-h-[80px] resize-none text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        createNewNote();
                      }
                    }}
                  />
                  <Button 
                    onClick={createNewNote}
                    className="w-full justify-start gap-2"
                    variant="default"
                    disabled={isLoading || (!serverStatus?.ok && !!newNoteContent.trim())}
                  >
                    <Plus className="h-4 w-4" />
                    {newNoteContent.trim() ? 'Save to Server' : 'New Local Note'}
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
              <SidebarGroupLabel>Your Notes</SidebarGroupLabel>
              <ScrollArea className="h-[400px]">
                <SidebarMenu>
                  {filteredNotes.map((note) => (
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
                  ))}
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
                <Tabs defaultValue="edit" className="h-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="edit" className="gap-2">
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="gap-2">
                      <BookOpen className="h-4 w-4" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="insights" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI Insights
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
                        <Textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Start writing your thoughts..."
                          className="min-h-[500px] resize-none border-0 bg-transparent text-base leading-relaxed focus-visible:ring-0"
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="preview">
                    <Card>
                      <CardHeader>
                        <CardTitle>{selectedNote.title}</CardTitle>
                        <CardDescription>
                          Created {new Date(selectedNote.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          {noteContent || <p className="text-muted-foreground">Nothing to preview yet...</p>}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="insights">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          AI Insights
                        </CardTitle>
                        <CardDescription>
                          AI-powered analysis of your note
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="rounded-lg bg-muted p-4">
                            <h4 className="mb-2 font-medium">Summary</h4>
                            <p className="text-sm text-muted-foreground">
                              AI insights will appear here once the backend is connected...
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted p-4">
                            <h4 className="mb-2 font-medium">Key Topics</h4>
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
                        </div>
                      </CardContent>
                    </Card>
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