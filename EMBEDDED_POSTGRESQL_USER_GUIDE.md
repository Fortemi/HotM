# HotM Embedded Database User Guide

## Quick Start

Hall of the Mind includes a built-in database that works automatically - no setup required! This guide explains what's happening behind the scenes and how to use advanced features.

## What's Included

When you install HotM with the "API Server" option, you get:

✅ **PostgreSQL Database** - Enterprise-grade data storage  
✅ **pgvector Extension** - Advanced AI search capabilities  
✅ **Automatic Backups** - Your data is protected  
✅ **Zero Configuration** - Works out of the box  

## Installation Choices

### Recommended: Embedded Database

**Perfect for:**
- Individual users and small teams
- Home users and students
- Development and testing
- Anyone who wants "it just works" experience

**What you get:**
- Completely automatic setup
- Daily backups
- Performance optimization
- No technical knowledge required

### Advanced: External Database

**Perfect for:**
- Large organizations
- Existing PostgreSQL infrastructure
- Custom security requirements
- Multi-server deployments

**Requirements:**
- PostgreSQL server with pgvector extension
- Network access to database server
- Database administration knowledge

## How It Works

### During Installation

1. **Database Setup**: Creates a private PostgreSQL database on your computer
2. **Schema Creation**: Sets up all tables and indexes needed for HotM
3. **Service Installation**: Installs Windows service for automatic startup
4. **Configuration**: Optimizes settings for your specific hardware

### Daily Operation

- **Automatic Startup**: Database starts when your computer boots
- **Background Operation**: Runs quietly in the background
- **Daily Backups**: Creates backups automatically at 2:00 AM
- **Performance Monitoring**: Continuously optimizes performance

## Understanding Your Data

### Where Your Data Lives

```
Your Documents and Settings:
%PROGRAMDATA%\HotM\
├── database\           # Your notes and data
├── backups\           # Automatic backups
├── config\            # Settings
└── logs\              # System logs (for troubleshooting)
```

### What's Stored

- **Your Notes**: Original and AI-enhanced versions
- **Search Indexes**: For fast text and AI search
- **Tags and Collections**: Your organization system
- **Activity History**: What you've done (for undo/redo)

## Backup and Safety

### Automatic Backups

Your data is automatically backed up:

- **Daily Backups**: Every night at 2:00 AM
- **Upgrade Backups**: Before each HotM update
- **30-Day Retention**: Keeps backups for a month
- **Automatic Cleanup**: Removes old backups to save space

### Manual Backups

Create a backup anytime through HotM settings or using the command line:

```powershell
# Create backup now
& "C:\Program Files\HotM\bin\hotm-db-manager.exe" backup --type manual
```

### Restore Your Data

If something goes wrong:

1. **Open Command Prompt as Administrator**
2. **List available backups:**
   ```powershell
   & "C:\Program Files\HotM\bin\hotm-db-manager.exe" list-backups
   ```
3. **Restore from backup:**
   ```powershell
   & "C:\Program Files\HotM\bin\hotm-db-manager.exe" restore --backup-id "your-backup-id"
   ```

## Performance and Optimization

### Automatic Optimization

The database automatically optimizes itself based on:

- **Your Computer's Memory**: Uses appropriate amounts of RAM
- **Storage Type**: Optimizes for SSD vs traditional hard drives  
- **Usage Patterns**: Adapts to how you use HotM
- **Data Growth**: Adjusts as your note collection grows

### Manual Optimization

If HotM feels slow, try these steps:

1. **Restart HotM**: Close and reopen the application
2. **Reboot Computer**: Restart your computer
3. **Check Disk Space**: Ensure you have at least 2GB free space
4. **Run Maintenance**: Use the maintenance command:
   ```powershell
   & "C:\Program Files\HotM\bin\hotm-db-manager.exe" maintenance --comprehensive
   ```

## Troubleshooting

### Common Issues

**"Cannot connect to database"**

1. Check if the database service is running:
   ```powershell
   Get-Service "HotM-PostgreSQL"
   ```

2. If stopped, start it:
   ```powershell
   Start-Service "HotM-PostgreSQL"
   ```

3. If problem persists, restart your computer

**HotM is running slowly**

1. Check available disk space (need 2GB minimum)
2. Close other applications using lots of memory
3. Run database maintenance:
   ```powershell
   & "C:\Program Files\HotM\bin\hotm-db-manager.exe" vacuum --analyze
   ```

**Backup failed**

1. Check disk space in backup location
2. Manually create backup:
   ```powershell
   & "C:\Program Files\HotM\bin\hotm-db-manager.exe" backup --type manual
   ```

**After Windows update, HotM won't start**

1. Restart your computer
2. Check Windows Event Logs for errors
3. Reinstall HotM if necessary

### Getting Help

**Check System Status:**
```powershell
# See overall system health
& "C:\Program Files\HotM\bin\hotm-db-manager.exe" health-check

# See detailed status
& "C:\Program Files\HotM\bin\hotm-db-manager.exe" status --full
```

**View Recent Activity:**
```powershell
# Check what's been happening
Get-EventLog -LogName Application -Source "HotM-PostgreSQL" -Newest 10
```

## Advanced Features

### Custom Backup Schedule

Change when backups happen:

1. **Edit configuration file**: `%PROGRAMDATA%\HotM\config\backup.toml`
2. **Change backup time**: 
   ```toml
   daily_backup_time = "03:30"  # 3:30 AM instead of 2:00 AM
   ```
3. **Restart HotM** for changes to take effect

### Database Statistics

See how HotM is performing:

```powershell
# Performance statistics
& "C:\Program Files\HotM\bin\hotm-db-manager.exe" stats --performance

# Connection info  
& "C:\Program Files\HotM\bin\hotm-db-manager.exe" stats --connections

# Storage usage
& "C:\Program Files\HotM\bin\hotm-db-manager.exe" stats --storage
```

### Export Your Data

Export all your notes:

```powershell
# Create complete data export
& "C:\Program Files\HotM\bin\hotm-db-manager.exe" export --format json --file "my-notes-backup.json"
```

## Security and Privacy

### Your Data Stays Local

- **No Internet Required**: Database runs entirely on your computer
- **No Data Sharing**: Your notes never leave your computer
- **Encrypted Storage**: Database files are protected
- **Local-Only Access**: Only you can access your data

### Default Security

- Database only accepts connections from your computer (localhost)
- Uses secure authentication methods
- No external network access
- Protected by Windows user account permissions

### Additional Security

For extra security:

1. **Enable Full Disk Encryption**: Use Windows BitLocker
2. **Regular Backups**: Keep backups on external storage
3. **Strong User Password**: Protect your Windows account
4. **Antivirus Software**: Keep your system protected

## Uninstalling

### Remove HotM

When you uninstall HotM:

- **Application Removed**: HotM software is deleted
- **Data Preserved**: Your notes and backups are kept
- **Service Removed**: Database service is uninstalled
- **Settings Kept**: Configuration files remain

### Complete Removal

To remove everything including your data:

1. **Uninstall HotM** through Windows Settings
2. **Delete data folder**:
   ```powershell
   Remove-Item "$env:PROGRAMDATA\HotM" -Recurse -Force
   ```
3. **Clean registry** (optional):
   ```powershell
   reg delete "HKLM\SOFTWARE\HotM" /f
   ```

⚠️ **Warning**: Complete removal deletes all your notes and backups permanently!

## Frequently Asked Questions

**Q: How much disk space does the database use?**

A: The database starts small (under 100MB) and grows based on your usage:
- 1,000 notes ≈ 50-100MB
- 10,000 notes ≈ 500MB-1GB  
- Backups use additional space (compressed)

**Q: Can I move HotM to another computer?**

A: Yes! Create a backup, install HotM on the new computer, then restore from backup.

**Q: Does the database slow down my computer?**

A: No. The database is designed for desktop use and uses minimal resources when idle.

**Q: Can I use my own PostgreSQL server?**

A: Yes! Choose "External PostgreSQL Connection" during installation and provide your database details.

**Q: What happens if Windows crashes while HotM is running?**

A: The database is designed to handle unexpected shutdowns. It will automatically recover when restarted.

**Q: Can I run multiple copies of HotM?**

A: Each Windows user account gets their own separate HotM installation and database.

**Q: How do I know if my backups are working?**

A: Check the backup directory or run:
```powershell
& "C:\Program Files\HotM\bin\hotm-db-manager.exe" list-backups
```

**Q: Can I access my data with other applications?**

A: Yes, but you'll need PostgreSQL knowledge. The database uses standard PostgreSQL format.

## Getting Support

If you need help:

1. **Check this guide** for common solutions
2. **Run diagnostics**:
   ```powershell
   & "C:\Program Files\HotM\bin\hotm-db-manager.exe" health-check --comprehensive
   ```
3. **Check Windows Event Logs** for error messages
4. **Visit HotM Support** with diagnostic information

Remember: The embedded database is designed to "just work" - most users never need to think about it!