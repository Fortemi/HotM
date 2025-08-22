import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent,
  SidebarHeader,
  SidebarInset,
} from "@/components/ui/sidebar";

export function TestSidebar() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4">
            <h2>Test Sidebar Header</h2>
          </SidebarHeader>
          <SidebarContent>
            <div className="p-4">
              <p>Sidebar content is here!</p>
              <button className="bg-blue-500 text-white px-4 py-2 rounded">
                Test Button
              </button>
            </div>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <div className="p-4">
            <h1>Main Content Area</h1>
            <p>If you can see this, the sidebar system is working.</p>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}