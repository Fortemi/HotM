# HotM Desktop Installation Guide

This guide helps end users install and configure HotM Desktop Mode for personal knowledge management on Windows 11.

## Quick Install

**System Requirements:**
- Windows 11 (22H2 or newer)
- 4GB RAM minimum, 8GB recommended
- 2GB free disk space
- Internet connection for initial setup

**One-Click Installation:**
1. Download `HotM-Desktop-Setup-v0.2.0.msi` from [releases](https://github.com/jmagly/hotm/releases)
2. Double-click the MSI file and follow the installer
3. HotM will appear in your Start Menu and system tray
4. Use global hotkey `Ctrl+Alt+H` to quickly access

## Installation Options

### Express Installation (Recommended)

The installer automatically handles all dependencies:

```powershell
# Silent install (runs automatically)
HotM-Desktop-Setup-v0.2.0.msi

# Or via command line
msiexec /i HotM-Desktop-Setup-v0.2.0.msi /qn DEPLOYMENT_MODE=desktop
```

**What's Installed:**
- HotM Desktop application with system tray
- Embedded PostgreSQL database (port 54321)
- Embedded Ollama AI service (port 11435)
- Windows Service for automatic startup

### Custom Installation

For advanced users who want to configure database and AI services:

1. **Run Installer in Custom Mode**
   ```powershell
   msiexec /i HotM-Desktop-Setup-v0.2.0.msi
   ```

2. **Choose Custom Configuration**
   - Select "Custom" installation type
   - Configure database connection (PostgreSQL required)
   - Configure AI service settings (Ollama optional)
   - Set startup preferences

3. **Database Options:**
   - **Embedded PostgreSQL** (default): Installed automatically on port 54321
   - **Existing PostgreSQL**: Connect to your existing database with pgvector extension
   - **Azure Database for PostgreSQL**: Connect to cloud instance

4. **AI Service Options:**
   - **Embedded Ollama** (default): Installed automatically with `gpt-oss:20b` model
   - **Existing Ollama**: Connect to your existing Ollama service
   - **Remote AI Service**: Connect to external API (requires configuration)
   - **Disable AI Features**: Skip AI installation (reduced functionality)

## First Launch Setup

### Automatic Configuration (Express Install)

After installation, HotM will:
1. Start embedded PostgreSQL database
2. Initialize database schema with pgvector extension
3. Start embedded Ollama service  
4. Download required AI models (`gpt-oss:20b`, `nomic-embed-text`)
5. Launch desktop application
6. Show welcome screen

**Initial model download may take 10-15 minutes depending on internet speed.**

### Manual Configuration (Custom Install)

1. **Database Setup**
   - HotM will prompt for database connection details
   - For PostgreSQL, ensure the `pgvector` extension is available:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;
     ```

2. **AI Model Setup**
   - Choose which models to download
   - `gpt-oss:20b` (12GB) - Text generation and summarization
   - `nomic-embed-text` (274MB) - Semantic search embeddings
   - Models are downloaded automatically on first use

3. **Desktop Settings**
   - Enable/disable system tray integration
   - Configure global hotkey (default: `Ctrl+Alt+H`)
   - Set startup behavior

## Using HotM Desktop

### Basic Operations

**Access Methods:**
- Global hotkey: `Ctrl+Alt+H`
- System tray icon (right-click for menu)
- Start Menu shortcut
- Desktop shortcut (if selected during install)

**Core Features:**
- Create and edit notes with rich text formatting
- Automatic AI-powered summarization and revision
- Semantic search across all your notes
- Automatic tagging and entity extraction
- Smart linking between related notes

### File Locations

**Data Directory:**
```
%USERPROFILE%\AppData\Local\HotM\
├── database\        # PostgreSQL data files
├── models\          # Ollama AI models
├── config\          # Application configuration
├── logs\            # Application logs
└── backups\         # Automated backups
```

**Configuration File:**
```
%USERPROFILE%\AppData\Local\HotM\config\desktop.toml
```

### Backup and Sync

**Automated Backups:**
- Daily database backups to `%USERPROFILE%\AppData\Local\HotM\backups\`
- Retention: 30 days for daily, 12 weeks for weekly, 12 months for monthly
- Manual backup: System tray → Backup Now

**Export Options:**
- Export all notes to Markdown files
- Export database to SQL dump
- Export configuration for migration

## Troubleshooting

### Common Issues

**Application Won't Start:**
1. Check Windows Event Viewer for HotM service errors
2. Verify PostgreSQL service is running:
   ```powershell
   Get-Service | Where-Object {$_.Name -like "*HotM*"}
   ```
3. Restart HotM services:
   ```powershell
   net stop "HotM PostgreSQL"
   net stop "HotM Ollama" 
   net stop "HotM Runtime"
   net start "HotM PostgreSQL"
   net start "HotM Ollama"
   net start "HotM Runtime"
   ```

**Database Connection Error:**
1. Ensure PostgreSQL service is running
2. Check connection in configuration file:
   ```toml
   [database]
   url = "postgresql://hotm:hotm_local@localhost:54321/hotm"
   ```
3. Verify pgvector extension:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

**AI Features Not Working:**
1. Check Ollama service status:
   ```powershell
   curl http://localhost:11435/api/version
   ```
2. Verify models are downloaded:
   ```powershell
   curl http://localhost:11435/api/tags
   ```
3. Re-download models if missing:
   - System tray → Settings → AI Models → Re-download

**Global Hotkey Not Working:**
1. Check for conflicts with other applications
2. Change hotkey in Settings → Desktop → Global Hotkey
3. Run HotM as Administrator if needed

### Performance Optimization

**For Lower-End Systems:**
- Disable AI features during initial import of large note collections
- Use smaller AI models: `gpt-oss:3b` instead of `gpt-oss:20b`
- Increase database checkpoint interval in PostgreSQL settings
- Close HotM when not in active use

**For Power Users:**
- Enable full-text indexing for faster search
- Use SSD storage for database location
- Allocate more RAM to PostgreSQL and Ollama services
- Configure automatic model preloading

### Getting Help

**Built-in Help:**
- Help menu in application
- System tray → Help & Support
- Settings → About → System Information

**Online Resources:**
- [HotM Documentation](https://github.com/jmagly/hotm/tree/main/docs)
- [Troubleshooting Guide](https://github.com/jmagly/hotm/wiki/Troubleshooting)
- [Community Discussions](https://github.com/jmagly/hotm/discussions)

**Log Files:**
Logs are automatically collected in `%USERPROFILE%\AppData\Local\HotM\logs\`:
- `hotm-runtime.log` - Main application log
- `postgresql.log` - Database service log
- `ollama.log` - AI service log
- `installer.log` - Installation log

## Advanced Configuration

### Network Mode

HotM Desktop can connect to a remote HotM server instead of using embedded services:

1. **Edit Configuration File**
   ```toml
   [deployment]
   mode = "desktop"
   remote_server = true
   
   [server]
   url = "http://your-server:53211"
   api_key = "your_api_key"
   
   [database]
   embedded = false
   
   [ai]
   embedded_ollama = false
   ```

2. **Restart HotM Services**
   ```powershell
   net stop "HotM Runtime"
   net start "HotM Runtime"
   ```

### Custom AI Models

Add custom Ollama models for specialized use cases:

1. **Download Models**
   ```powershell
   curl -X POST http://localhost:11435/api/pull -d '{"name":"custom-model:latest"}'
   ```

2. **Update Configuration**
   ```toml
   [ai]
   models = ["custom-model:latest", "nomic-embed-text"]
   generation_model = "custom-model:latest"
   ```

### Security Settings

For enhanced security in sensitive environments:

1. **Enable Data Encryption**
   ```toml
   [security]
   encrypt_at_rest = true
   require_auth = true
   ```

2. **Network Security**
   ```toml
   [server]
   bind_address = "127.0.0.1"  # Localhost only
   tls_enabled = true
   ```

## Uninstalling

### Clean Uninstall

1. **Via Control Panel**
   - Apps & Features → HotM Desktop → Uninstall

2. **Via Command Line**
   ```powershell
   msiexec /x HotM-Desktop-Setup-v0.2.0.msi /quiet
   ```

### Data Preservation

**Backup Before Uninstall:**
```powershell
# Backup all data
xcopy "%USERPROFILE%\AppData\Local\HotM" "C:\HotM-Backup\" /E /H /C /I

# Or just database
pg_dump -h localhost -p 54321 -U hotm -d hotm > hotm-backup.sql
```

**Clean Removal:**
The uninstaller removes:
- Application files
- Windows services
- Start menu shortcuts
- Registry entries

**Manual Cleanup (if needed):**
```powershell
# Remove data directory
rmdir /S "%USERPROFILE%\AppData\Local\HotM"

# Remove any remaining registry entries
reg delete "HKLM\SOFTWARE\HotM" /f
reg delete "HKCU\SOFTWARE\HotM" /f
```

## System Integration

### Windows 11 Features

**Fluent Design:**
- Mica background effects
- Acrylic transparency
- Adaptive icons and colors

**Native Integration:**
- System tray with contextual menu
- Windows notifications for processing status
- Global hotkey support
- File association for .hotm files
- Windows Search integration (planned)

### Productivity Workflows

**Quick Capture:**
1. `Ctrl+Alt+H` → Opens HotM
2. Start typing immediately
3. AI automatically processes and enhances
4. Auto-save and smart categorization

**Research Mode:**
1. Import web clips and documents
2. AI generates summaries and extracts key insights
3. Automatic linking discovers connections
4. Export refined knowledge as reports

---

*This installation guide is maintained as part of HotM v0.2.0 documentation. For technical support, see the [troubleshooting guide](../troubleshooting/) or [community discussions](https://github.com/jmagly/hotm/discussions).*