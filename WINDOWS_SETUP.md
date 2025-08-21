# Windows Setup Instructions for HotM

## Prerequisites

### On Windows:
1. **Visual Studio Build Tools 2022** or Visual Studio 2022
   - Download from: https://visualstudio.microsoft.com/downloads/
   - Select "Desktop development with C++" workload

2. **Node.js 18+** 
   - Download from: https://nodejs.org/

3. **Rust**
   - Download from: https://rustup.rs/
   - Run: `rustup default stable`

4. **Docker Desktop** (for PostgreSQL database)
   - Download from: https://www.docker.com/products/docker-desktop/

## Building the Windows Installer

### Step 1: Start the Backend Services (Windows)

Open PowerShell as Administrator:

```powershell
# Navigate to project directory
cd C:\Users\YOUR_USERNAME\dev\hotm

# Start PostgreSQL with Docker
docker-compose -f docker-compose.documentdb.yml up -d

# Start the backend server
cd server
$env:DATABASE_URL="postgresql://hotm:hotm_dev_pass@localhost:5432/hotm_dev"
cargo run
```

Keep this terminal open - the server needs to stay running.

### Step 2: Build the MSI Installer

Open a new PowerShell terminal:

```powershell
# Navigate to UI directory
cd C:\Users\YOUR_USERNAME\dev\hotm\ui

# Install dependencies
npm install

# Build the MSI installer
npm run tauri build
```

This will create the installer at:
`ui\src-tauri\target\release\bundle\msi\HotM_0.1.0_x64_en-US.msi`

### Step 3: Install the Application

1. Navigate to `ui\src-tauri\target\release\bundle\msi\`
2. Double-click `HotM_0.1.0_x64_en-US.msi`
3. Follow the installation wizard
4. The app will be installed to `C:\Program Files\HotM\`

### Step 4: Run as Taskbar App

After installation:
1. Find "HotM" in your Start Menu
2. Right-click and select "Pin to taskbar"
3. Launch the app from the taskbar

## Running Development Mode (Without Installing)

If you just want to test without creating an installer:

```powershell
cd C:\Users\YOUR_USERNAME\dev\hotm\ui
npm run tauri dev
```

This opens the app directly without installation.

## Troubleshooting

### "Cannot connect to server" Error
- Ensure the backend server is running (Step 1)
- Check that Docker is running and PostgreSQL container is up
- Verify server is listening on port 53211

### Build Errors
- Ensure all prerequisites are installed
- Run `rustup update` to get latest Rust
- Delete `node_modules` and run `npm install` again

### Database Connection Issues
```powershell
# Check if Docker container is running
docker ps

# Check PostgreSQL logs
docker logs hotm-documentdb-dev

# Test database connection
docker exec -it hotm-documentdb-dev psql -U hotm -d hotm_dev
```

## Quick Start Script (Windows)

Save this as `start_hotm.ps1`:

```powershell
# Start all services and run the app
Write-Host "Starting HotM Services..." -ForegroundColor Green

# Start Docker containers
docker-compose -f docker-compose.documentdb.yml up -d

# Wait for database
Start-Sleep -Seconds 5

# Start backend server in background
Start-Process powershell -ArgumentList "-Command", "cd server; `$env:DATABASE_URL='postgresql://hotm:hotm_dev_pass@localhost:5432/hotm_dev'; cargo run"

# Wait for server to start
Start-Sleep -Seconds 10

# Start UI
cd ui
npm run tauri dev
```

Run with: `.\start_hotm.ps1`