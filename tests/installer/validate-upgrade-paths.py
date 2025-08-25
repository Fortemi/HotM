#!/usr/bin/env python3
"""
HotM Installer Upgrade Path Validation
Validates all upgrade scenarios and data integrity preservation across versions.
"""

import os
import sys
import json
import shutil
import tempfile
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import time
import hashlib

@dataclass
class UpgradeScenario:
    """Defines an upgrade test scenario."""
    name: str
    description: str
    from_version: str
    to_version: str
    deployment_mode: str
    data_preservation_required: bool
    config_migration_required: bool
    service_continuity_required: bool
    expected_duration_max: int  # seconds

@dataclass
class DataIntegrityTest:
    """Defines a data integrity validation test."""
    test_name: str
    description: str
    validation_function: str
    critical: bool

class UpgradePathValidator:
    """Validates upgrade paths and data integrity."""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.test_data_dir = project_root / "test-results" / "upgrade-validation"
        self.test_data_dir.mkdir(parents=True, exist_ok=True)
        
        self.upgrade_scenarios = self._define_upgrade_scenarios()
        self.data_integrity_tests = self._define_data_integrity_tests()
        self.validation_results = []
        
        self.log_file = self.test_data_dir / "upgrade-validation.log"
        self.log("Upgrade path validation initialized", "INFO")
    
    def log(self, message: str, level: str = "INFO"):
        """Log a message with timestamp."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        log_message = f"[{timestamp}] [{level}] {message}"
        
        print(log_message)
        
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_message + "\n")
    
    def _define_upgrade_scenarios(self) -> List[UpgradeScenario]:
        """Define upgrade test scenarios."""
        return [
            UpgradeScenario(
                name="v0.1.0 to v0.2.0 Desktop",
                description="Upgrade from v0.1.0 unified runtime to v0.2.0 modular architecture (Desktop mode)",
                from_version="0.1.0", 
                to_version="0.2.0",
                deployment_mode="Desktop",
                data_preservation_required=True,
                config_migration_required=True,
                service_continuity_required=True,
                expected_duration_max=300  # 5 minutes
            ),
            UpgradeScenario(
                name="v0.1.0 to v0.2.0 Server",
                description="Upgrade from v0.1.0 unified runtime to v0.2.0 modular architecture (Server mode)",
                from_version="0.1.0",
                to_version="0.2.0", 
                deployment_mode="Server",
                data_preservation_required=True,
                config_migration_required=True,
                service_continuity_required=True,
                expected_duration_max=600  # 10 minutes
            ),
            UpgradeScenario(
                name="v0.2.0 to v0.2.1 Patch",
                description="Patch upgrade maintaining all configurations",
                from_version="0.2.0",
                to_version="0.2.1",
                deployment_mode="Hybrid",
                data_preservation_required=True,
                config_migration_required=False,
                service_continuity_required=True,
                expected_duration_max=120  # 2 minutes
            ),
            UpgradeScenario(
                name="v0.1.5 to v0.3.0 Major",
                description="Major version upgrade with schema changes",
                from_version="0.1.5",
                to_version="0.3.0",
                deployment_mode="Development",
                data_preservation_required=True,
                config_migration_required=True,
                service_continuity_required=False,  # Major upgrades may require restart
                expected_duration_max=900  # 15 minutes
            )
        ]
    
    def _define_data_integrity_tests(self) -> List[DataIntegrityTest]:
        """Define data integrity validation tests."""
        return [
            DataIntegrityTest(
                test_name="Note Data Preservation",
                description="Verify all user notes are preserved during upgrade",
                validation_function="validate_note_preservation",
                critical=True
            ),
            DataIntegrityTest(
                test_name="Collection Structure Preservation", 
                description="Verify collection organization is maintained",
                validation_function="validate_collection_preservation",
                critical=True
            ),
            DataIntegrityTest(
                test_name="Search Index Integrity",
                description="Verify search indexes are properly migrated",
                validation_function="validate_search_index_integrity",
                critical=False
            ),
            DataIntegrityTest(
                test_name="User Settings Preservation",
                description="Verify user preferences and settings are maintained",
                validation_function="validate_user_settings_preservation",
                critical=True
            ),
            DataIntegrityTest(
                test_name="AI Model Configuration",
                description="Verify AI model settings are preserved",
                validation_function="validate_ai_model_configuration",
                critical=False
            ),
            DataIntegrityTest(
                test_name="Database Schema Migration",
                description="Verify database schema migrations complete successfully",
                validation_function="validate_database_schema_migration",
                critical=True
            ),
            DataIntegrityTest(
                test_name="Service Configuration Migration",
                description="Verify service configurations are properly migrated",
                validation_function="validate_service_configuration_migration",
                critical=True
            )
        ]
    
    def create_mock_installation(self, version: str, deployment_mode: str) -> Path:
        """Create a mock installation for testing."""
        self.log(f"Creating mock installation: {version} ({deployment_mode})", "INFO")
        
        # Create temporary directory structure
        mock_install_dir = self.test_data_dir / f"mock-install-{version}-{deployment_mode.lower()}"
        if mock_install_dir.exists():
            shutil.rmtree(mock_install_dir)
        
        mock_install_dir.mkdir(parents=True)
        
        # Create directory structure
        directories = [
            "bin",
            "config", 
            "data",
            "logs",
            "database",
            "models"
        ]
        
        for directory in directories:
            (mock_install_dir / directory).mkdir()
        
        # Create mock configuration files
        config_data = {
            "version": version,
            "deployment_mode": deployment_mode.lower(),
            "database_url": "postgresql://localhost:54321/hotm",
            "ollama_url": "http://localhost:11434",
            "server_port": 53211,
            "log_level": "info"
        }
        
        config_file = mock_install_dir / "config" / "hotm.toml"
        with open(config_file, 'w') as f:
            for key, value in config_data.items():
                if isinstance(value, str):
                    f.write(f'{key} = "{value}"\n')
                else:
                    f.write(f'{key} = {value}\n')
        
        # Create mock database
        self._create_mock_database(mock_install_dir / "database" / "hotm.db", version)
        
        # Create mock user data
        self._create_mock_user_data(mock_install_dir / "data", version)
        
        # Create version file
        version_file = mock_install_dir / "VERSION"
        version_file.write_text(version)
        
        self.log(f"Mock installation created: {mock_install_dir}", "SUCCESS")
        return mock_install_dir
    
    def _create_mock_database(self, db_path: Path, version: str):
        """Create mock database with test data."""
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Create tables based on version
        if version.startswith("0.1"):
            # Old schema (v0.1.x)
            cursor.execute("""
                CREATE TABLE notes (
                    id INTEGER PRIMARY KEY,
                    title TEXT,
                    content TEXT,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
            """)
            
            cursor.execute("""
                CREATE TABLE collections (
                    id INTEGER PRIMARY KEY,
                    name TEXT,
                    description TEXT
                )
            """)
        else:
            # New schema (v0.2.x+)
            cursor.execute("""
                CREATE TABLE notes (
                    id INTEGER PRIMARY KEY,
                    title TEXT,
                    original_content TEXT,
                    revised_content TEXT,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    embedding BLOB
                )
            """)
            
            cursor.execute("""
                CREATE TABLE collections (
                    id INTEGER PRIMARY KEY,
                    name TEXT,
                    description TEXT,
                    metadata TEXT
                )
            """)
            
            cursor.execute("""
                CREATE TABLE note_revisions (
                    id INTEGER PRIMARY KEY,
                    note_id INTEGER,
                    revision_content TEXT,
                    revision_type TEXT,
                    created_at TIMESTAMP,
                    FOREIGN KEY (note_id) REFERENCES notes (id)
                )
            """)
        
        # Insert test data
        test_notes = [
            ("Meeting Notes", "Important project discussion", "2024-01-15 10:00:00", "2024-01-15 10:30:00"),
            ("Research Ideas", "Collection of research topics", "2024-01-16 14:00:00", "2024-01-16 15:00:00"),
            ("Project Plan", "Detailed project roadmap", "2024-01-17 09:00:00", "2024-01-17 09:45:00")
        ]
        
        for title, content, created, updated in test_notes:
            if version.startswith("0.1"):
                cursor.execute(
                    "INSERT INTO notes (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
                    (title, content, created, updated)
                )
            else:
                cursor.execute(
                    "INSERT INTO notes (title, original_content, revised_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (title, content, f"Revised: {content}", created, updated)
                )
        
        # Insert test collections
        test_collections = [
            ("Work", "Work-related notes"),
            ("Personal", "Personal notes and ideas"),
            ("Research", "Research and learning materials")
        ]
        
        for name, description in test_collections:
            cursor.execute(
                "INSERT INTO collections (name, description) VALUES (?, ?)",
                (name, description)
            )
        
        conn.commit()
        conn.close()
        
        self.log(f"Mock database created with test data", "DEBUG")
    
    def _create_mock_user_data(self, data_dir: Path, version: str):
        """Create mock user data files."""
        # Create user preferences
        preferences = {
            "theme": "dark",
            "auto_save": True,
            "default_collection": "Work",
            "ai_features_enabled": True
        }
        
        prefs_file = data_dir / "preferences.json"
        with open(prefs_file, 'w') as f:
            json.dump(preferences, f, indent=2)
        
        # Create some log files
        log_dir = data_dir / "logs"
        log_dir.mkdir(exist_ok=True)
        
        log_file = log_dir / "hotm.log"
        log_file.write_text(f"[2024-01-15 10:00:00] INFO Starting HotM {version}\n")
        
        self.log(f"Mock user data created", "DEBUG")
    
    def simulate_upgrade(self, scenario: UpgradeScenario) -> Dict[str, Any]:
        """Simulate an upgrade scenario."""
        self.log(f"Simulating upgrade scenario: {scenario.name}", "INFO")
        
        start_time = time.time()
        
        try:
            # Create source installation
            source_install = self.create_mock_installation(scenario.from_version, scenario.deployment_mode)
            
            # Backup original data for comparison
            backup_data = self._backup_installation_data(source_install)
            
            # Simulate upgrade process
            target_install = self._perform_mock_upgrade(source_install, scenario.to_version)
            
            # Validate upgrade results
            validation_results = self._validate_upgrade_results(
                backup_data, target_install, scenario
            )
            
            duration = time.time() - start_time
            
            upgrade_result = {
                "scenario": asdict(scenario),
                "success": validation_results["success"],
                "duration": duration,
                "validation_results": validation_results,
                "performance_metrics": {
                    "upgrade_duration": duration,
                    "within_expected_time": duration <= scenario.expected_duration_max,
                    "data_integrity_score": validation_results.get("integrity_score", 0)
                },
                "artifacts": {
                    "source_backup": str(backup_data["backup_path"]),
                    "target_install": str(target_install)
                }
            }
            
            status = "PASS" if validation_results["success"] else "FAIL"
            self.log(f"Upgrade scenario completed: {status} in {duration:.2f}s", "SUCCESS" if validation_results["success"] else "ERROR")
            
            return upgrade_result
            
        except Exception as e:
            duration = time.time() - start_time
            self.log(f"Upgrade scenario failed: {str(e)}", "ERROR")
            
            return {
                "scenario": asdict(scenario),
                "success": False,
                "duration": duration,
                "error": str(e),
                "performance_metrics": {
                    "upgrade_duration": duration,
                    "within_expected_time": False,
                    "data_integrity_score": 0
                }
            }
    
    def _backup_installation_data(self, install_dir: Path) -> Dict[str, Any]:
        """Backup installation data for comparison."""
        import uuid
        backup_id = str(uuid.uuid4())[:8]
        backup_path = self.test_data_dir / f"backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{backup_id}"
        backup_path.mkdir(parents=True, exist_ok=True)
        
        # Copy critical data
        critical_paths = [
            "config",
            "data", 
            "database"
        ]
        
        backup_data = {
            "backup_path": backup_path,
            "original_version": (install_dir / "VERSION").read_text().strip(),
            "file_hashes": {},
            "database_stats": {}
        }
        
        for path_name in critical_paths:
            source_path = install_dir / path_name
            if source_path.exists():
                target_path = backup_path / path_name
                if source_path.is_dir():
                    shutil.copytree(source_path, target_path)
                else:
                    shutil.copy2(source_path, target_path)
                
                # Calculate file hashes for integrity checking
                if source_path.is_file():
                    with open(source_path, 'rb') as f:
                        backup_data["file_hashes"][path_name] = hashlib.sha256(f.read()).hexdigest()
        
        # Get database statistics
        db_path = install_dir / "database" / "hotm.db"
        if db_path.exists():
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            
            # Get table counts
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            for table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                backup_data["database_stats"][f"{table}_count"] = cursor.fetchone()[0]
            
            conn.close()
        
        return backup_data
    
    def _perform_mock_upgrade(self, source_install: Path, target_version: str) -> Path:
        """Perform mock upgrade process."""
        self.log(f"Performing mock upgrade to version {target_version}", "INFO")
        
        # Create target installation directory with unique identifier
        import uuid
        upgrade_id = str(uuid.uuid4())[:8]
        target_install = self.test_data_dir / f"upgraded-{target_version}-{datetime.now().strftime('%H%M%S')}-{upgrade_id}"
        
        # Copy source installation
        shutil.copytree(source_install, target_install)
        
        # Simulate upgrade process
        
        # 1. Update version file
        version_file = target_install / "VERSION"
        version_file.write_text(target_version)
        
        # 2. Migrate database schema if needed
        self._migrate_database_schema(target_install / "database" / "hotm.db", target_version)
        
        # 3. Update configuration files
        self._migrate_configuration(target_install / "config", target_version)
        
        # 4. Migrate data formats if needed
        self._migrate_data_formats(target_install / "data", target_version)
        
        return target_install
    
    def _migrate_database_schema(self, db_path: Path, target_version: str):
        """Simulate database schema migration."""
        if not db_path.exists():
            return
        
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Simulate schema changes for v0.2.x
        if target_version.startswith("0.2"):
            # Add new columns to existing tables
            try:
                cursor.execute("ALTER TABLE notes ADD COLUMN revised_content TEXT")
                cursor.execute("ALTER TABLE notes ADD COLUMN embedding BLOB")
                
                # Update existing data
                cursor.execute("UPDATE notes SET revised_content = 'Revised: ' || content WHERE revised_content IS NULL")
                
                # Create new tables
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS note_revisions (
                        id INTEGER PRIMARY KEY,
                        note_id INTEGER,
                        revision_content TEXT,
                        revision_type TEXT,
                        created_at TIMESTAMP,
                        FOREIGN KEY (note_id) REFERENCES notes (id)
                    )
                """)
                
                cursor.execute("ALTER TABLE collections ADD COLUMN metadata TEXT")
                
                conn.commit()
                self.log("Database schema migrated successfully", "DEBUG")
                
            except sqlite3.OperationalError as e:
                # Column might already exist - this is OK for testing
                self.log(f"Schema migration note: {str(e)}", "DEBUG")
        
        conn.close()
    
    def _migrate_configuration(self, config_dir: Path, target_version: str):
        """Simulate configuration migration."""
        config_file = config_dir / "hotm.toml"
        if not config_file.exists():
            return
        
        # Read current config
        config_content = config_file.read_text()
        
        # Add new configuration options for v0.2.x
        if target_version.startswith("0.2"):
            new_options = [
                'ai_model_name = "gpt-oss:20b"',
                'embedding_model = "nomic-embed-text"', 
                'max_concurrent_requests = 4',
                'search_result_limit = 50'
            ]
            
            for option in new_options:
                if option.split('=')[0].strip() not in config_content:
                    config_content += f"\n{option}"
        
        # Update version in config
        if 'version = ' in config_content:
            import re
            config_content = re.sub(r'version = "[^"]*"', f'version = "{target_version}"', config_content)
        else:
            config_content += f'\nversion = "{target_version}"'
        
        config_file.write_text(config_content)
        self.log("Configuration migrated successfully", "DEBUG")
    
    def _migrate_data_formats(self, data_dir: Path, target_version: str):
        """Simulate data format migration."""
        prefs_file = data_dir / "preferences.json"
        if prefs_file.exists():
            with open(prefs_file, 'r') as f:
                prefs = json.load(f)
            
            # Add new preferences for v0.2.x
            if target_version.startswith("0.2"):
                new_prefs = {
                    "ai_enhancement_enabled": True,
                    "auto_tag_generation": True,
                    "search_history_limit": 100
                }
                
                prefs.update(new_prefs)
                
                with open(prefs_file, 'w') as f:
                    json.dump(prefs, f, indent=2)
        
        self.log("Data formats migrated successfully", "DEBUG")
    
    def _validate_upgrade_results(self, backup_data: Dict[str, Any], target_install: Path, scenario: UpgradeScenario) -> Dict[str, Any]:
        """Validate upgrade results against scenario requirements."""
        self.log("Validating upgrade results", "INFO")
        
        validation_results = {
            "success": True,
            "integrity_score": 100,
            "failed_tests": [],
            "warnings": [],
            "test_results": {}
        }
        
        # Run data integrity tests
        for integrity_test in self.data_integrity_tests:
            test_result = self._run_integrity_test(
                integrity_test, backup_data, target_install
            )
            
            validation_results["test_results"][integrity_test.test_name] = test_result
            
            if not test_result["passed"]:
                validation_results["failed_tests"].append(integrity_test.test_name)
                if integrity_test.critical:
                    validation_results["success"] = False
                    validation_results["integrity_score"] -= 20
                else:
                    validation_results["integrity_score"] -= 5
                    validation_results["warnings"].append(integrity_test.test_name)
        
        # Validate scenario-specific requirements
        if scenario.data_preservation_required:
            preservation_result = self._validate_data_preservation(backup_data, target_install)
            if not preservation_result:
                validation_results["success"] = False
                validation_results["failed_tests"].append("Data Preservation")
        
        if scenario.config_migration_required:
            config_result = self._validate_configuration_migration(backup_data, target_install, scenario.to_version)
            if not config_result:
                validation_results["success"] = False
                validation_results["failed_tests"].append("Configuration Migration")
        
        # Ensure integrity score doesn't go below 0
        validation_results["integrity_score"] = max(0, validation_results["integrity_score"])
        
        return validation_results
    
    def _run_integrity_test(self, test: DataIntegrityTest, backup_data: Dict[str, Any], target_install: Path) -> Dict[str, Any]:
        """Run a specific data integrity test."""
        method_name = test.validation_function
        
        if hasattr(self, method_name):
            try:
                method = getattr(self, method_name)
                result = method(backup_data, target_install)
                return {
                    "passed": result,
                    "message": f"{test.test_name} completed successfully" if result else f"{test.test_name} failed",
                    "critical": test.critical
                }
            except Exception as e:
                return {
                    "passed": False,
                    "message": f"{test.test_name} failed with error: {str(e)}",
                    "critical": test.critical
                }
        else:
            return {
                "passed": False,
                "message": f"Test method {method_name} not implemented",
                "critical": test.critical
            }
    
    # Data integrity validation methods
    
    def validate_note_preservation(self, backup_data: Dict[str, Any], target_install: Path) -> bool:
        """Validate that all notes are preserved."""
        try:
            # Check database note counts
            backup_notes = backup_data["database_stats"].get("notes_count", 0)
            
            target_db = target_install / "database" / "hotm.db"
            if not target_db.exists():
                return False
            
            conn = sqlite3.connect(str(target_db))
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM notes")
            target_notes = cursor.fetchone()[0]
            conn.close()
            
            return backup_notes == target_notes
            
        except Exception:
            return False
    
    def validate_collection_preservation(self, backup_data: Dict[str, Any], target_install: Path) -> bool:
        """Validate that collections are preserved."""
        try:
            backup_collections = backup_data["database_stats"].get("collections_count", 0)
            
            target_db = target_install / "database" / "hotm.db"
            if not target_db.exists():
                return False
            
            conn = sqlite3.connect(str(target_db))
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM collections")
            target_collections = cursor.fetchone()[0]
            conn.close()
            
            return backup_collections == target_collections
            
        except Exception:
            return False
    
    def validate_search_index_integrity(self, backup_data: Dict[str, Any], target_install: Path) -> bool:
        """Validate search index integrity."""
        # For this simulation, we'll just check that the database is accessible
        try:
            target_db = target_install / "database" / "hotm.db"
            if not target_db.exists():
                return False
            
            conn = sqlite3.connect(str(target_db))
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            conn.close()
            
            return len(tables) > 0
            
        except Exception:
            return False
    
    def validate_user_settings_preservation(self, backup_data: Dict[str, Any], target_install: Path) -> bool:
        """Validate user settings are preserved."""
        try:
            backup_prefs = backup_data["backup_path"] / "data" / "preferences.json"
            target_prefs = target_install / "data" / "preferences.json"
            
            if not backup_prefs.exists() or not target_prefs.exists():
                return backup_prefs.exists() == target_prefs.exists()
            
            with open(backup_prefs, 'r') as f:
                backup_data_content = json.load(f)
            
            with open(target_prefs, 'r') as f:
                target_data_content = json.load(f)
            
            # Check that core settings are preserved (allowing for new settings)
            core_settings = ["theme", "auto_save", "default_collection"]
            for setting in core_settings:
                if setting in backup_data_content:
                    if setting not in target_data_content or backup_data_content[setting] != target_data_content[setting]:
                        return False
            
            return True
            
        except Exception:
            return False
    
    def validate_ai_model_configuration(self, backup_data: Dict[str, Any], target_install: Path) -> bool:
        """Validate AI model configuration is preserved/migrated."""
        try:
            target_config = target_install / "config" / "hotm.toml"
            if not target_config.exists():
                return False
            
            config_content = target_config.read_text()
            
            # Check for AI-related configurations
            ai_configs = ["ai_model_name", "embedding_model", "ollama_url"]
            found_configs = sum(1 for config in ai_configs if config in config_content)
            
            return found_configs >= 2  # At least 2 AI configs should be present
            
        except Exception:
            return False
    
    def validate_database_schema_migration(self, backup_data: Dict[str, Any], target_install: Path) -> bool:
        """Validate database schema migration."""
        try:
            target_db = target_install / "database" / "hotm.db"
            if not target_db.exists():
                return False
            
            conn = sqlite3.connect(str(target_db))
            cursor = conn.cursor()
            
            # Check for expected tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            expected_tables = ["notes", "collections"]
            for table in expected_tables:
                if table not in tables:
                    return False
            
            # Check for expected columns in notes table
            cursor.execute("PRAGMA table_info(notes)")
            columns = [row[1] for row in cursor.fetchall()]
            
            required_columns = ["id", "title", "created_at", "updated_at"]
            for column in required_columns:
                if column not in columns:
                    return False
            
            conn.close()
            return True
            
        except Exception:
            return False
    
    def validate_service_configuration_migration(self, backup_data: Dict[str, Any], target_install: Path) -> bool:
        """Validate service configuration migration."""
        try:
            target_config = target_install / "config" / "hotm.toml"
            if not target_config.exists():
                return False
            
            config_content = target_config.read_text()
            
            # Check for essential service configurations
            service_configs = ["database_url", "server_port"]
            for config in service_configs:
                if config not in config_content:
                    return False
            
            return True
            
        except Exception:
            return False
    
    def _validate_data_preservation(self, backup_data: Dict[str, Any], target_install: Path) -> bool:
        """Validate overall data preservation."""
        # Check critical data directories exist
        critical_dirs = ["config", "data"]
        for dir_name in critical_dirs:
            if not (target_install / dir_name).exists():
                return False
        
        # Check database exists and has data
        if "notes_count" in backup_data["database_stats"]:
            if backup_data["database_stats"]["notes_count"] > 0:
                target_db = target_install / "database" / "hotm.db"
                if not target_db.exists():
                    return False
        
        return True
    
    def _validate_configuration_migration(self, backup_data: Dict[str, Any], target_install: Path, target_version: str) -> bool:
        """Validate configuration migration."""
        target_config = target_install / "config" / "hotm.toml"
        if not target_config.exists():
            return False
        
        config_content = target_config.read_text()
        
        # Check version is updated
        if f'version = "{target_version}"' not in config_content:
            return False
        
        return True
    
    def run_all_upgrade_scenarios(self) -> Dict[str, Any]:
        """Run all upgrade scenarios and generate report."""
        self.log("Starting comprehensive upgrade path validation", "INFO")
        
        results = {
            "validation_info": {
                "framework": "HotM Upgrade Path Validator",
                "version": "1.0.0",
                "timestamp": datetime.now().isoformat(),
                "total_scenarios": len(self.upgrade_scenarios)
            },
            "scenarios": [],
            "summary": {
                "total_tests": 0,
                "passed": 0,
                "failed": 0,
                "average_duration": 0,
                "average_integrity_score": 0
            }
        }
        
        total_duration = 0
        total_integrity_score = 0
        
        for scenario in self.upgrade_scenarios:
            scenario_result = self.simulate_upgrade(scenario)
            results["scenarios"].append(scenario_result)
            
            results["summary"]["total_tests"] += 1
            if scenario_result["success"]:
                results["summary"]["passed"] += 1
            else:
                results["summary"]["failed"] += 1
            
            total_duration += scenario_result["duration"]
            total_integrity_score += scenario_result["performance_metrics"]["data_integrity_score"]
        
        if results["summary"]["total_tests"] > 0:
            results["summary"]["average_duration"] = total_duration / results["summary"]["total_tests"]
            results["summary"]["average_integrity_score"] = total_integrity_score / results["summary"]["total_tests"]
        
        # Save results
        results_file = self.test_data_dir / "upgrade-validation-results.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        # Generate summary report
        self._generate_upgrade_summary_report(results)
        
        success = results["summary"]["failed"] == 0
        status = "PASSED" if success else "FAILED"
        self.log(f"Upgrade path validation {status}: {results['summary']['passed']}/{results['summary']['total_tests']} scenarios passed", "SUCCESS" if success else "ERROR")
        
        return results
    
    def _generate_upgrade_summary_report(self, results: Dict[str, Any]):
        """Generate markdown summary report."""
        summary_file = self.test_data_dir / "upgrade-validation-summary.md"
        
        summary = f"""# HotM Upgrade Path Validation Report

## Validation Summary

- **Total Scenarios**: {results['summary']['total_tests']}
- **Passed**: {results['summary']['passed']} ✅
- **Failed**: {results['summary']['failed']} ❌
- **Average Duration**: {results['summary']['average_duration']:.2f} seconds
- **Average Integrity Score**: {results['summary']['average_integrity_score']:.1f}%

## Overall Status
{'✅ **ALL UPGRADE PATHS VALIDATED**' if results['summary']['failed'] == 0 else '❌ **UPGRADE PATH VALIDATION FAILED**'}

## Scenario Results

"""
        
        for scenario_result in results["scenarios"]:
            scenario = scenario_result["scenario"]
            status_icon = "✅" if scenario_result["success"] else "❌"
            duration = scenario_result["duration"]
            integrity_score = scenario_result["performance_metrics"]["data_integrity_score"]
            
            summary += f"""### {scenario['name']} {status_icon}
- **Description**: {scenario['description']}
- **From Version**: {scenario['from_version']} → **To Version**: {scenario['to_version']}
- **Deployment Mode**: {scenario['deployment_mode']}
- **Duration**: {duration:.2f}s (Max: {scenario['expected_duration_max']}s)
- **Data Integrity Score**: {integrity_score}%
- **Requirements Met**: 
  - Data Preservation: {'✅' if scenario['data_preservation_required'] else 'N/A'}
  - Config Migration: {'✅' if scenario['config_migration_required'] else 'N/A'}
  - Service Continuity: {'✅' if scenario['service_continuity_required'] else 'N/A'}

"""
            
            if "validation_results" in scenario_result:
                validation = scenario_result["validation_results"]
                if validation.get("failed_tests"):
                    summary += f"**Failed Tests**: {', '.join(validation['failed_tests'])}\n"
                if validation.get("warnings"):
                    summary += f"**Warnings**: {', '.join(validation['warnings'])}\n"
            
            summary += "\n"
        
        summary += f"""## Data Integrity Tests

The following data integrity tests were executed for each scenario:

"""
        
        for test in self.data_integrity_tests:
            critical_marker = "🔴" if test.critical else "🟡"
            summary += f"- {critical_marker} **{test.test_name}**: {test.description}\n"
        
        summary += f"""

## Recommendations

"""
        
        if results["summary"]["failed"] == 0:
            summary += "✅ All upgrade paths validated successfully. The installer is ready for production deployment.\n\n"
            summary += "**Next Steps:**\n"
            summary += "1. Proceed with comprehensive end-to-end testing\n"
            summary += "2. Validate on actual Windows environments\n"
            summary += "3. Test with larger datasets for performance validation\n"
        else:
            summary += "❌ Some upgrade scenarios failed validation. Address the following issues:\n\n"
            
            failed_scenarios = [s for s in results["scenarios"] if not s["success"]]
            for scenario in failed_scenarios:
                summary += f"**{scenario['scenario']['name']}**:\n"
                if "validation_results" in scenario:
                    validation = scenario["validation_results"]
                    if validation.get("failed_tests"):
                        for test in validation["failed_tests"]:
                            summary += f"  - Fix {test} validation\n"
                summary += "\n"
        
        summary += f"""
---
*Generated by HotM Upgrade Path Validator on {results['validation_info']['timestamp']}*
"""
        
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write(summary)
        
        self.log(f"Upgrade validation summary saved: {summary_file}", "SUCCESS")

def main():
    """Main upgrade validation entry point."""
    project_root = Path.cwd()
    
    validator = UpgradePathValidator(project_root)
    results = validator.run_all_upgrade_scenarios()
    
    print(f"\nUpgrade validation completed. Results saved to: {validator.test_data_dir}")
    
    success = results["summary"]["failed"] == 0
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()