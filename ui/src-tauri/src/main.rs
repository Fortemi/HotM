use tauri::{Manager, tray::TrayIconBuilder, menu::{Menu, MenuItem}, global_shortcut::Shortcut};

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      // Tray icon
      let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&Menu::with_items(app, &[&MenuItem::with_id(app, "show", "Show", true, None::<&str>)?, &MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?])?)
        .on_menu_event(|app, event| {
          match event.id().as_ref() {
            "show" => {
              if let Some(win) = app.get_window("main") { let _ = win.show(); let _ = win.set_focus(); }
            }
            "quit" => { app.exit(0); }
            _ => {}
          }
        })
        .build(app)?;

      // Main window
      app.create_window("main", tauri::WindowUrl::App("/".into()), |w| w.title("HotM").decorations(true).inner_size(1200.0, 800.0))?;

      // Global shortcut Ctrl+Alt+H to toggle window
      let handle = app.handle();
      handle.global_shortcut().register(Shortcut::new("CTRL+ALT+H").unwrap(), move || {
        if let Some(win) = handle.get_window("main") {
          if win.is_visible().unwrap_or(true) { let _ = win.hide(); } else { let _ = win.show(); let _ = win.set_focus(); }
        }
      })?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
