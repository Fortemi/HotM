#!/usr/bin/env python3
"""
HotM Deployment Mode Switching Validation
Validates switching between deployment modes with data preservation.
"""

import os
import sys
import json
import shutil
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass, asdict
import time
import uuid

@dataclass
class ModeSwitchScenario:
    """Defines a deployment mode switching scenario."""
    name: str
    description: str
    from_mode: str
    to_mode: str
    data_preservation_required: bool
    service_reconfiguration_required: bool
    network_access_change: bool
    expected_duration_max: int  # seconds
    rollback_supported: bool

@dataclass
class ServiceExpectation:
    """Expected service configuration for a deployment mode."""
    mode: str
    services: List[str]
    ports: List[int]
    network_accessible: bool
    desktop_interface: bool
    web_interface: bool

class ModeSwitchingValidator:
    """Validates deployment mode switching scenarios."""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.test_data_dir = project_root / "test-results" / "mode-switching-validation"
        self.test_data_dir.mkdir(parents=True, exist_ok=True)
        
        self.service_expectations = self._define_service_expectations()
        self.switch_scenarios = self._define_switch_scenarios()
        self.validation_results = []
        
        self.log_file = self.test_data_dir / "mode-switching-validation.log"
        self.log("Mode switching validation initialized", "INFO")
    
    def log(self, message: str, level: str = "INFO"):
        """Log a message with timestamp."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        log_message = f"[{timestamp}] [{level}] {message}"
        
        print(log_message)
        
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_message + "\n")
    
    def _define_service_expectations(self) -> Dict[str, ServiceExpectation]:
        """Define expected service configurations for each deployment mode."""
        return {
            "Desktop": ServiceExpectation(
                mode="Desktop",
                services=["HotM-Server"],
                ports=[53211],
                network_accessible=False,
                desktop_interface=True,
                web_interface=False
            ),
            "Server": ServiceExpectation(
                mode="Server",
                services=["HotM-PostgreSQL", "HotM-Ollama", "HotM-Server"],
                ports=[54321, 11434, 53211],
                network_accessible=True,
                desktop_interface=False,
                web_interface=True
            ),
            "Hybrid": ServiceExpectation(
                mode="Hybrid",
                services=["HotM-PostgreSQL", "HotM-Ollama", "HotM-Server"],
                ports=[54321, 11434, 53211],
                network_accessible=True,
                desktop_interface=True,
                web_interface=True
            ),
            "Development": ServiceExpectation(
                mode="Development",
                services=["HotM-PostgreSQL", "HotM-Ollama", "HotM-Server"],
                ports=[54321, 11434, 53211],
                network_accessible=True,
                desktop_interface=True,
                web_interface=True
            )
        }
    
    def _define_switch_scenarios(self) -> List[ModeSwitchScenario]:
        """Define mode switching test scenarios."""
        return [
            # Adding capabilities (expansion scenarios)
            ModeSwitchScenario(
                name="Desktop to Hybrid",
                description="Add server capabilities to desktop installation",
                from_mode="Desktop",
                to_mode="Hybrid",
                data_preservation_required=True,
                service_reconfiguration_required=True,
                network_access_change=True,
                expected_duration_max=300,  # 5 minutes
                rollback_supported=True
            ),
            ModeSwitchScenario(
                name="Server to Hybrid",
                description="Add desktop interface to server installation",
                from_mode="Server",
                to_mode="Hybrid",
                data_preservation_required=True,
                service_reconfiguration_required=False,  # Same services
                network_access_change=False,
                expected_duration_max=180,  # 3 minutes
                rollback_supported=True
            ),
            ModeSwitchScenario(
                name="Desktop to Development",
                description="Enable development features on desktop installation",
                from_mode="Desktop",
                to_mode="Development",
                data_preservation_required=True,
                service_reconfiguration_required=True,
                network_access_change=True,
                expected_duration_max=360,  # 6 minutes
                rollback_supported=True
            ),
            
            # Removing capabilities (reduction scenarios)
            ModeSwitchScenario(
                name="Hybrid to Desktop",
                description="Remove server capabilities, keep desktop interface",
                from_mode="Hybrid",
                to_mode="Desktop",
                data_preservation_required=True,
                service_reconfiguration_required=True,
                network_access_change=True,
                expected_duration_max=240,  # 4 minutes
                rollback_supported=True
            ),
            ModeSwitchScenario(
                name="Hybrid to Server",
                description="Remove desktop interface, keep server capabilities",
                from_mode="Hybrid", 
                to_mode="Server",
                data_preservation_required=True,
                service_reconfiguration_required=False,
                network_access_change=False,
                expected_duration_max=120,  # 2 minutes
                rollback_supported=True
            ),
            ModeSwitchScenario(
                name="Development to Desktop",
                description="Disable development features, keep desktop functionality",
                from_mode="Development",
                to_mode="Desktop",
                data_preservation_required=True,
                service_reconfiguration_required=True,
                network_access_change=True,
                expected_duration_max=180,  # 3 minutes
                rollback_supported=True
            ),
            
            # Complex transitions
            ModeSwitchScenario(
                name="Server to Desktop",
                description="Convert server installation to desktop use",
                from_mode="Server",
                to_mode="Desktop",
                data_preservation_required=True,
                service_reconfiguration_required=True,
                network_access_change=True,
                expected_duration_max=300,  # 5 minutes
                rollback_supported=True
            ),
            ModeSwitchScenario(
                name="Desktop to Server",
                description="Convert desktop installation to server use",
                from_mode="Desktop",
                to_mode="Server",
                data_preservation_required=True,
                service_reconfiguration_required=True,
                network_access_change=True,
                expected_duration_max=360,  # 6 minutes
                rollback_supported=True
            )
        ]
    
    def create_mock_deployment(self, mode: str) -> Path:
        """Create a mock deployment in the specified mode."""
        self.log(f"Creating mock {mode} deployment", "INFO")
        
        deploy_id = str(uuid.uuid4())[:8]
        deployment_dir = self.test_data_dir / f"deployment-{mode.lower()}-{deploy_id}"
        deployment_dir.mkdir(parents=True, exist_ok=True)
        
        # Create directory structure
        directories = ["bin", "config", "data", "logs", "database", "web", "desktop"]
        for directory in directories:
            (deployment_dir / directory).mkdir()
        
        # Create mode-specific configuration
        config_data = self._generate_mode_config(mode)
        config_file = deployment_dir / "config" / "hotm.toml"
        self._write_config_file(config_file, config_data)
        
        # Create mock database with test data
        self._create_mode_database(deployment_dir / "database" / "hotm.db", mode)
        
        # Create mode-specific files
        self._create_mode_specific_files(deployment_dir, mode)
        
        # Create deployment metadata
        metadata = {
            "mode": mode,
            "version": "0.2.0",
            "created_at": datetime.now().isoformat(),
            "services": self.service_expectations[mode].services,
            "ports": self.service_expectations[mode].ports,
            "capabilities": self._get_mode_capabilities(mode)
        }
        
        metadata_file = deployment_dir / "deployment.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        self.log(f"Mock {mode} deployment created: {deployment_dir}", "SUCCESS")
        return deployment_dir
    
    def _generate_mode_config(self, mode: str) -> Dict[str, Any]:
        """Generate configuration for a deployment mode."""
        expectation = self.service_expectations[mode]
        
        config = {
            "deployment_mode": mode.lower(),
            "version": "0.2.0",
            "server_port": 53211,
            "log_level": "info"
        }
        
        # Add database configuration for modes that need it
        if "HotM-PostgreSQL" in expectation.services:
            config.update({
                "database_url": "postgresql://localhost:54321/hotm",
                "database_embedded": True
            })
        else:
            config.update({
                "database_url": "sqlite://data/hotm.db",
                "database_embedded": False
            })
        
        # Add AI service configuration
        if "HotM-Ollama" in expectation.services:
            config.update({
                "ollama_url": "http://localhost:11434",
                "ai_model_name": "gpt-oss:20b",
                "embedding_model": "nomic-embed-text"
            })
        
        # Add network configuration
        if expectation.network_accessible:
            config.update({
                "network_interface": "0.0.0.0",
                "cors_enabled": True,
                "web_interface_enabled": expectation.web_interface
            })
        else:
            config.update({
                "network_interface": "127.0.0.1",
                "cors_enabled": False,
                "web_interface_enabled": False
            })
        
        # Add desktop configuration
        if expectation.desktop_interface:
            config.update({
                "desktop_interface_enabled": True,
                "system_tray_enabled": True,
                "global_hotkey": "Ctrl+Alt+H"
            })
        
        # Add development-specific configuration
        if mode == "Development":
            config.update({
                "debug_mode": True,
                "api_debug_endpoints": True,
                "hot_reload": True,
                "metrics_enabled": True
            })
        
        return config
    
    def _write_config_file(self, config_file: Path, config_data: Dict[str, Any]):
        """Write configuration to TOML file."""
        with open(config_file, 'w') as f:
            for key, value in config_data.items():
                if isinstance(value, str):
                    f.write(f'{key} = "{value}"\n')
                elif isinstance(value, bool):
                    f.write(f'{key} = {str(value).lower()}\n')
                elif isinstance(value, (int, float)):
                    f.write(f'{key} = {value}\n')
                else:
                    f.write(f'{key} = "{str(value)}"\n')
    
    def _create_mode_database(self, db_path: Path, mode: str):
        """Create database with mode-appropriate test data."""
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Create tables
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
            CREATE TABLE mode_settings (
                id INTEGER PRIMARY KEY,
                deployment_mode TEXT,
                setting_key TEXT,
                setting_value TEXT,
                created_at TIMESTAMP
            )
        """)
        
        # Insert test data appropriate for the mode
        test_notes = [
            (f"{mode} Meeting Notes", f"Meeting notes for {mode} mode", "2024-01-15 10:00:00"),
            (f"{mode} Project Plan", f"Project plan configured for {mode}", "2024-01-16 14:00:00"),
            (f"{mode} Configuration", f"Configuration notes for {mode} deployment", "2024-01-17 09:00:00")
        ]
        
        for title, content, created in test_notes:
            cursor.execute(
                "INSERT INTO notes (title, original_content, revised_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (title, content, f"Revised: {content}", created, created)
            )
        
        # Insert collections
        collections = [
            (f"{mode} Work", f"Work notes for {mode} mode"),
            (f"{mode} Personal", f"Personal notes in {mode}"),
            (f"{mode} System", f"System configuration for {mode}")
        ]
        
        for name, description in collections:
            cursor.execute(
                "INSERT INTO collections (name, description, metadata) VALUES (?, ?, ?)",
                (name, description, f'{{"mode": "{mode}"}}')
            )
        
        # Insert mode-specific settings
        mode_settings = [
            (mode, "configured_services", ",".join(self.service_expectations[mode].services)),
            (mode, "network_accessible", str(self.service_expectations[mode].network_accessible)),
            (mode, "desktop_interface", str(self.service_expectations[mode].desktop_interface))
        ]
        
        for setting_mode, key, value in mode_settings:
            cursor.execute(
                "INSERT INTO mode_settings (deployment_mode, setting_key, setting_value, created_at) VALUES (?, ?, ?, ?)",
                (setting_mode, key, value, datetime.now().isoformat())
            )
        
        conn.commit()
        conn.close()
    
    def _create_mode_specific_files(self, deployment_dir: Path, mode: str):
        """Create mode-specific files and directories."""
        expectation = self.service_expectations[mode]
        
        # Create desktop interface files if needed
        if expectation.desktop_interface:
            desktop_dir = deployment_dir / "desktop"
            (desktop_dir / "hotm.exe").write_text(f"Mock {mode} desktop executable")
            (desktop_dir / "resources").mkdir()
            
            # Create desktop configuration
            desktop_config = {
                "mode": mode,
                "auto_start": True,
                "minimize_to_tray": True,
                "show_notifications": True
            }
            
            with open(desktop_dir / "desktop.json", 'w') as f:
                json.dump(desktop_config, f, indent=2)
        
        # Create web interface files if needed
        if expectation.web_interface:
            web_dir = deployment_dir / "web"
            (web_dir / "static").mkdir()
            (web_dir / "templates").mkdir()
            (web_dir / "static" / "index.html").write_text(f"<html><body><h1>{mode} Web Interface</h1></body></html>")
        
        # Create service control scripts
        service_dir = deployment_dir / "services"
        service_dir.mkdir()
        
        for service in expectation.services:
            service_script = service_dir / f"{service.lower().replace('-', '_')}.py"
            service_script.write_text(f"# Mock service script for {service} in {mode} mode\nprint('Service {service} running')")
        
        # Create mode documentation
        docs_dir = deployment_dir / "docs"
        docs_dir.mkdir()
        
        readme = docs_dir / "README.md"
        readme.write_text(f"""# HotM {mode} Mode

This deployment is configured for {mode} mode.

## Services
{chr(10).join(f"- {service}" for service in expectation.services)}

## Ports
{chr(10).join(f"- {port}" for port in expectation.ports)}

## Capabilities
- Network Accessible: {expectation.network_accessible}
- Desktop Interface: {expectation.desktop_interface}
- Web Interface: {expectation.web_interface}
""")
    
    def _get_mode_capabilities(self, mode: str) -> List[str]:
        """Get capabilities for a deployment mode."""
        expectation = self.service_expectations[mode]
        capabilities = []
        
        if expectation.desktop_interface:
            capabilities.append("desktop_interface")
        
        if expectation.web_interface:
            capabilities.append("web_interface")
        
        if expectation.network_accessible:
            capabilities.append("network_access")
        
        if "HotM-PostgreSQL" in expectation.services:
            capabilities.append("embedded_database")
        
        if "HotM-Ollama" in expectation.services:
            capabilities.append("ai_processing")
        
        if mode == "Development":
            capabilities.extend(["debug_tools", "hot_reload", "metrics"])
        
        return capabilities
    
    def simulate_mode_switch(self, scenario: ModeSwitchScenario) -> Dict[str, Any]:
        """Simulate a deployment mode switching scenario."""
        self.log(f"Simulating mode switch: {scenario.name}", "INFO")
        
        start_time = time.time()
        
        try:
            # Create source deployment
            source_deployment = self.create_mock_deployment(scenario.from_mode)
            
            # Backup original state
            backup_data = self._backup_deployment_state(source_deployment)
            
            # Perform mode switch
            target_deployment = self._perform_mode_switch(
                source_deployment, scenario.from_mode, scenario.to_mode
            )
            
            # Validate switch results
            validation_results = self._validate_mode_switch(
                backup_data, target_deployment, scenario
            )
            
            duration = time.time() - start_time
            
            # Test rollback if supported and validation passed
            rollback_result = None
            if scenario.rollback_supported and validation_results["success"]:
                rollback_result = self._test_rollback(
                    target_deployment, scenario.to_mode, scenario.from_mode, backup_data
                )
            
            switch_result = {
                "scenario": asdict(scenario),
                "success": validation_results["success"],
                "duration": duration,
                "validation_results": validation_results,
                "rollback_result": rollback_result,
                "performance_metrics": {
                    "switch_duration": duration,
                    "within_expected_time": duration <= scenario.expected_duration_max,
                    "data_integrity_score": validation_results.get("integrity_score", 0),
                    "rollback_successful": rollback_result.get("success", False) if rollback_result else None
                },
                "artifacts": {
                    "source_backup": str(backup_data["backup_path"]),
                    "target_deployment": str(target_deployment)
                }
            }
            
            status = "PASS" if validation_results["success"] else "FAIL"
            self.log(f"Mode switch completed: {status} in {duration:.2f}s", 
                    "SUCCESS" if validation_results["success"] else "ERROR")
            
            return switch_result
            
        except Exception as e:
            duration = time.time() - start_time
            self.log(f"Mode switch failed: {str(e)}", "ERROR")
            
            return {
                "scenario": asdict(scenario),
                "success": False,
                "duration": duration,
                "error": str(e),
                "performance_metrics": {
                    "switch_duration": duration,
                    "within_expected_time": False,
                    "data_integrity_score": 0,
                    "rollback_successful": False
                }
            }
    
    def _backup_deployment_state(self, deployment_dir: Path) -> Dict[str, Any]:
        """Backup deployment state for comparison."""
        backup_id = str(uuid.uuid4())[:8]
        backup_path = self.test_data_dir / f"state-backup-{backup_id}"
        
        # Copy entire deployment
        shutil.copytree(deployment_dir, backup_path)
        
        # Extract key metrics
        backup_data = {
            "backup_path": backup_path,
            "deployment_metadata": {},
            "database_stats": {},
            "configuration": {}
        }
        
        # Load deployment metadata
        metadata_file = deployment_dir / "deployment.json"
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                backup_data["deployment_metadata"] = json.load(f)
        
        # Get database statistics
        db_path = deployment_dir / "database" / "hotm.db"
        if db_path.exists():
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            
            # Count records in each table
            for table in ["notes", "collections", "mode_settings"]:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    backup_data["database_stats"][f"{table}_count"] = cursor.fetchone()[0]
                except sqlite3.OperationalError:
                    backup_data["database_stats"][f"{table}_count"] = 0
            
            conn.close()
        
        # Load configuration
        config_file = deployment_dir / "config" / "hotm.toml"
        if config_file.exists():
            backup_data["configuration"] = config_file.read_text()
        
        return backup_data
    
    def _perform_mode_switch(self, source_deployment: Path, from_mode: str, to_mode: str) -> Path:
        """Perform the actual mode switching process."""
        self.log(f"Performing mode switch: {from_mode} → {to_mode}", "INFO")
        
        # Create target deployment directory
        switch_id = str(uuid.uuid4())[:8]
        target_deployment = self.test_data_dir / f"switched-{to_mode.lower()}-{switch_id}"
        
        # Copy source deployment
        shutil.copytree(source_deployment, target_deployment)
        
        # Update deployment metadata
        metadata_file = target_deployment / "deployment.json"
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        metadata.update({
            "mode": to_mode,
            "previous_mode": from_mode,
            "switched_at": datetime.now().isoformat(),
            "services": self.service_expectations[to_mode].services,
            "ports": self.service_expectations[to_mode].ports,
            "capabilities": self._get_mode_capabilities(to_mode)
        })
        
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Update configuration
        config_data = self._generate_mode_config(to_mode)
        config_file = target_deployment / "config" / "hotm.toml"
        self._write_config_file(config_file, config_data)
        
        # Update database mode settings
        self._update_database_mode_settings(target_deployment / "database" / "hotm.db", to_mode)
        
        # Add or remove mode-specific files
        self._adjust_mode_specific_files(target_deployment, from_mode, to_mode)
        
        # Update service configurations
        self._update_service_configurations(target_deployment, from_mode, to_mode)
        
        return target_deployment
    
    def _update_database_mode_settings(self, db_path: Path, new_mode: str):
        """Update database mode settings."""
        if not db_path.exists():
            return
        
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        try:
            # Update mode settings
            expectation = self.service_expectations[new_mode]
            
            cursor.execute(
                "UPDATE mode_settings SET setting_value = ? WHERE setting_key = 'configured_services'",
                (",".join(expectation.services),)
            )
            
            cursor.execute(
                "UPDATE mode_settings SET setting_value = ? WHERE setting_key = 'network_accessible'",
                (str(expectation.network_accessible),)
            )
            
            cursor.execute(
                "UPDATE mode_settings SET setting_value = ? WHERE setting_key = 'desktop_interface'",
                (str(expectation.desktop_interface),)
            )
            
            # Add new mode entry
            cursor.execute(
                "INSERT INTO mode_settings (deployment_mode, setting_key, setting_value, created_at) VALUES (?, ?, ?, ?)",
                (new_mode, "mode_switched", "true", datetime.now().isoformat())
            )
            
            conn.commit()
            
        except sqlite3.OperationalError as e:
            self.log(f"Database update warning: {str(e)}", "WARNING")
        
        conn.close()
    
    def _adjust_mode_specific_files(self, deployment_dir: Path, from_mode: str, to_mode: str):
        """Add or remove mode-specific files based on the switch."""
        from_expectation = self.service_expectations[from_mode]
        to_expectation = self.service_expectations[to_mode]
        
        # Handle desktop interface changes
        desktop_dir = deployment_dir / "desktop"
        if to_expectation.desktop_interface and not from_expectation.desktop_interface:
            # Add desktop interface
            if not desktop_dir.exists():
                desktop_dir.mkdir()
                (desktop_dir / "hotm.exe").write_text(f"Mock {to_mode} desktop executable")
                (desktop_dir / "resources").mkdir()
        elif not to_expectation.desktop_interface and from_expectation.desktop_interface:
            # Remove desktop interface
            if desktop_dir.exists():
                shutil.rmtree(desktop_dir)
        
        # Handle web interface changes
        web_dir = deployment_dir / "web"
        if to_expectation.web_interface and not from_expectation.web_interface:
            # Add web interface
            if not web_dir.exists():
                web_dir.mkdir()
                (web_dir / "static").mkdir(exist_ok=True)
                (web_dir / "templates").mkdir(exist_ok=True)
                (web_dir / "static" / "index.html").write_text(f"<html><body><h1>{to_mode} Web Interface</h1></body></html>")
        elif to_expectation.web_interface and from_expectation.web_interface:
            # Update existing web interface
            if web_dir.exists():
                (web_dir / "static" / "index.html").write_text(f"<html><body><h1>{to_mode} Web Interface</h1></body></html>")
        elif not to_expectation.web_interface and from_expectation.web_interface:
            # Remove web interface
            if web_dir.exists():
                shutil.rmtree(web_dir)
    
    def _update_service_configurations(self, deployment_dir: Path, from_mode: str, to_mode: str):
        """Update service configurations for the new mode."""
        service_dir = deployment_dir / "services"
        
        from_services = set(self.service_expectations[from_mode].services)
        to_services = set(self.service_expectations[to_mode].services)
        
        # Add new services
        for service in to_services - from_services:
            service_script = service_dir / f"{service.lower().replace('-', '_')}.py"
            service_script.write_text(f"# Service script for {service} in {to_mode} mode\nprint('Service {service} running in {to_mode} mode')")
        
        # Remove services no longer needed
        for service in from_services - to_services:
            service_script = service_dir / f"{service.lower().replace('-', '_')}.py"
            if service_script.exists():
                service_script.unlink()
        
        # Update existing services
        for service in from_services & to_services:
            service_script = service_dir / f"{service.lower().replace('-', '_')}.py"
            if service_script.exists():
                service_script.write_text(f"# Updated service script for {service} in {to_mode} mode\nprint('Service {service} running in {to_mode} mode')")
    
    def _validate_mode_switch(self, backup_data: Dict[str, Any], target_deployment: Path, scenario: ModeSwitchScenario) -> Dict[str, Any]:
        """Validate the results of a mode switch."""
        self.log("Validating mode switch results", "INFO")
        
        validation_results = {
            "success": True,
            "integrity_score": 100,
            "failed_tests": [],
            "warnings": [],
            "test_results": {}
        }
        
        # Test data preservation
        if scenario.data_preservation_required:
            data_preservation_result = self._validate_data_preservation(backup_data, target_deployment)
            validation_results["test_results"]["Data Preservation"] = data_preservation_result
            
            if not data_preservation_result["passed"]:
                validation_results["success"] = False
                validation_results["failed_tests"].append("Data Preservation")
                validation_results["integrity_score"] -= 30
        
        # Test service configuration
        service_config_result = self._validate_service_configuration(target_deployment, scenario.to_mode)
        validation_results["test_results"]["Service Configuration"] = service_config_result
        
        if not service_config_result["passed"]:
            validation_results["success"] = False
            validation_results["failed_tests"].append("Service Configuration")
            validation_results["integrity_score"] -= 20
        
        # Test network access changes
        if scenario.network_access_change:
            network_result = self._validate_network_access_change(target_deployment, scenario.to_mode)
            validation_results["test_results"]["Network Access"] = network_result
            
            if not network_result["passed"]:
                validation_results["warnings"].append("Network Access")
                validation_results["integrity_score"] -= 10
        
        # Test interface availability
        interface_result = self._validate_interface_availability(target_deployment, scenario.to_mode)
        validation_results["test_results"]["Interface Availability"] = interface_result
        
        if not interface_result["passed"]:
            validation_results["warnings"].append("Interface Availability")
            validation_results["integrity_score"] -= 10
        
        # Test configuration consistency
        config_result = self._validate_configuration_consistency(target_deployment, scenario.to_mode)
        validation_results["test_results"]["Configuration Consistency"] = config_result
        
        if not config_result["passed"]:
            validation_results["success"] = False
            validation_results["failed_tests"].append("Configuration Consistency")
            validation_results["integrity_score"] -= 15
        
        # Ensure score doesn't go below 0
        validation_results["integrity_score"] = max(0, validation_results["integrity_score"])
        
        return validation_results
    
    def _validate_data_preservation(self, backup_data: Dict[str, Any], target_deployment: Path) -> Dict[str, Any]:
        """Validate that user data is preserved during mode switch."""
        try:
            # Compare database record counts
            target_db = target_deployment / "database" / "hotm.db"
            if not target_db.exists():
                return {"passed": False, "message": "Database not found in target deployment"}
            
            conn = sqlite3.connect(str(target_db))
            cursor = conn.cursor()
            
            for table, expected_count in backup_data["database_stats"].items():
                if table.endswith("_count"):
                    table_name = table[:-6]  # Remove "_count" suffix
                    try:
                        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                        actual_count = cursor.fetchone()[0]
                        
                        if table_name == "mode_settings":
                            # Mode settings can increase during mode switching (new settings added)
                            if actual_count < expected_count:
                                conn.close()
                                return {"passed": False, "message": f"Data loss in {table_name}: expected at least {expected_count}, found {actual_count}"}
                        else:
                            # Other tables should have exact count preservation
                            if actual_count != expected_count:
                                conn.close()
                                return {"passed": False, "message": f"Data loss in {table_name}: expected {expected_count}, found {actual_count}"}
                    
                    except sqlite3.OperationalError:
                        # Table might not exist - check if it should
                        if expected_count > 0:
                            conn.close()
                            return {"passed": False, "message": f"Table {table_name} missing with expected data"}
            
            conn.close()
            return {"passed": True, "message": "All data preserved successfully"}
            
        except Exception as e:
            return {"passed": False, "message": f"Data validation error: {str(e)}"}
    
    def _validate_service_configuration(self, deployment_dir: Path, target_mode: str) -> Dict[str, Any]:
        """Validate service configuration for target mode."""
        try:
            expectation = self.service_expectations[target_mode]
            
            # Check service scripts exist
            service_dir = deployment_dir / "services"
            if not service_dir.exists():
                return {"passed": False, "message": "Services directory not found"}
            
            for service in expectation.services:
                service_script = service_dir / f"{service.lower().replace('-', '_')}.py"
                if not service_script.exists():
                    return {"passed": False, "message": f"Service script missing: {service}"}
                
                # Check service script content mentions target mode
                content = service_script.read_text()
                if target_mode not in content:
                    return {"passed": False, "message": f"Service {service} not updated for {target_mode} mode"}
            
            return {"passed": True, "message": "Service configuration valid"}
            
        except Exception as e:
            return {"passed": False, "message": f"Service validation error: {str(e)}"}
    
    def _validate_network_access_change(self, deployment_dir: Path, target_mode: str) -> Dict[str, Any]:
        """Validate network access configuration changes."""
        try:
            expectation = self.service_expectations[target_mode]
            
            config_file = deployment_dir / "config" / "hotm.toml"
            if not config_file.exists():
                return {"passed": False, "message": "Configuration file not found"}
            
            config_content = config_file.read_text()
            
            if expectation.network_accessible:
                if "network_interface = \"0.0.0.0\"" not in config_content:
                    return {"passed": False, "message": "Network interface not configured for network access"}
            else:
                if "network_interface = \"127.0.0.1\"" not in config_content:
                    return {"passed": False, "message": "Network interface not configured for local access"}
            
            return {"passed": True, "message": "Network access configuration correct"}
            
        except Exception as e:
            return {"passed": False, "message": f"Network validation error: {str(e)}"}
    
    def _validate_interface_availability(self, deployment_dir: Path, target_mode: str) -> Dict[str, Any]:
        """Validate interface availability matches target mode."""
        try:
            expectation = self.service_expectations[target_mode]
            
            # Check desktop interface
            desktop_dir = deployment_dir / "desktop"
            desktop_available = desktop_dir.exists() and (desktop_dir / "hotm.exe").exists()
            
            if expectation.desktop_interface != desktop_available:
                status = "expected" if expectation.desktop_interface else "not expected"
                actual = "available" if desktop_available else "not available"
                return {"passed": False, "message": f"Desktop interface {status} but {actual}"}
            
            # Check web interface
            web_dir = deployment_dir / "web"
            web_available = web_dir.exists() and (web_dir / "static" / "index.html").exists()
            
            if expectation.web_interface != web_available:
                status = "expected" if expectation.web_interface else "not expected"
                actual = "available" if web_available else "not available"
                return {"passed": False, "message": f"Web interface {status} but {actual}"}
            
            return {"passed": True, "message": "Interface availability correct"}
            
        except Exception as e:
            return {"passed": False, "message": f"Interface validation error: {str(e)}"}
    
    def _validate_configuration_consistency(self, deployment_dir: Path, target_mode: str) -> Dict[str, Any]:
        """Validate configuration consistency for target mode."""
        try:
            # Check deployment metadata
            metadata_file = deployment_dir / "deployment.json"
            if not metadata_file.exists():
                return {"passed": False, "message": "Deployment metadata not found"}
            
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
            
            if metadata.get("mode") != target_mode:
                return {"passed": False, "message": f"Deployment mode mismatch: expected {target_mode}, found {metadata.get('mode')}"}
            
            # Check configuration file
            config_file = deployment_dir / "config" / "hotm.toml"
            config_content = config_file.read_text()
            
            if f'deployment_mode = "{target_mode.lower()}"' not in config_content:
                return {"passed": False, "message": f"Configuration mode not set to {target_mode}"}
            
            return {"passed": True, "message": "Configuration consistency validated"}
            
        except Exception as e:
            return {"passed": False, "message": f"Configuration validation error: {str(e)}"}
    
    def _test_rollback(self, target_deployment: Path, current_mode: str, original_mode: str, backup_data: Dict[str, Any]) -> Dict[str, Any]:
        """Test rollback capability from current mode to original mode."""
        self.log(f"Testing rollback: {current_mode} → {original_mode}", "INFO")
        
        try:
            # Create rollback scenario
            rollback_scenario = ModeSwitchScenario(
                name=f"Rollback {current_mode} to {original_mode}",
                description=f"Rollback from {current_mode} to original {original_mode} mode",
                from_mode=current_mode,
                to_mode=original_mode,
                data_preservation_required=True,
                service_reconfiguration_required=True,
                network_access_change=True,
                expected_duration_max=180,  # 3 minutes for rollback
                rollback_supported=False  # Don't test recursive rollback
            )
            
            # Perform rollback
            rolled_back_deployment = self._perform_mode_switch(
                target_deployment, current_mode, original_mode
            )
            
            # Validate rollback
            rollback_validation = self._validate_mode_switch(
                backup_data, rolled_back_deployment, rollback_scenario
            )
            
            return {
                "success": rollback_validation["success"],
                "integrity_score": rollback_validation["integrity_score"],
                "message": "Rollback completed successfully" if rollback_validation["success"] else "Rollback failed validation",
                "deployment_path": str(rolled_back_deployment)
            }
            
        except Exception as e:
            return {
                "success": False,
                "integrity_score": 0,
                "message": f"Rollback failed: {str(e)}",
                "deployment_path": None
            }
    
    def run_all_mode_switching_scenarios(self) -> Dict[str, Any]:
        """Run all mode switching scenarios and generate report."""
        self.log("Starting comprehensive mode switching validation", "INFO")
        
        results = {
            "validation_info": {
                "framework": "HotM Mode Switching Validator",
                "version": "1.0.0",
                "timestamp": datetime.now().isoformat(),
                "total_scenarios": len(self.switch_scenarios)
            },
            "scenarios": [],
            "summary": {
                "total_tests": 0,
                "passed": 0,
                "failed": 0,
                "rollbacks_tested": 0,
                "rollbacks_successful": 0,
                "average_duration": 0,
                "average_integrity_score": 0
            }
        }
        
        total_duration = 0
        total_integrity_score = 0
        
        for scenario in self.switch_scenarios:
            scenario_result = self.simulate_mode_switch(scenario)
            results["scenarios"].append(scenario_result)
            
            results["summary"]["total_tests"] += 1
            if scenario_result["success"]:
                results["summary"]["passed"] += 1
            else:
                results["summary"]["failed"] += 1
            
            total_duration += scenario_result["duration"]
            total_integrity_score += scenario_result["performance_metrics"]["data_integrity_score"]
            
            # Track rollback statistics
            if scenario_result.get("rollback_result"):
                results["summary"]["rollbacks_tested"] += 1
                if scenario_result["rollback_result"]["success"]:
                    results["summary"]["rollbacks_successful"] += 1
        
        if results["summary"]["total_tests"] > 0:
            results["summary"]["average_duration"] = total_duration / results["summary"]["total_tests"]
            results["summary"]["average_integrity_score"] = total_integrity_score / results["summary"]["total_tests"]
        
        # Save results
        results_file = self.test_data_dir / "mode-switching-results.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        # Generate summary report
        self._generate_mode_switching_summary(results)
        
        success = results["summary"]["failed"] == 0
        status = "PASSED" if success else "FAILED"
        self.log(f"Mode switching validation {status}: {results['summary']['passed']}/{results['summary']['total_tests']} scenarios passed", "SUCCESS" if success else "ERROR")
        
        return results
    
    def _generate_mode_switching_summary(self, results: Dict[str, Any]):
        """Generate markdown summary report for mode switching validation."""
        summary_file = self.test_data_dir / "mode-switching-summary.md"
        
        summary = f"""# HotM Deployment Mode Switching Validation Report

## Validation Summary

- **Total Scenarios**: {results['summary']['total_tests']}
- **Passed**: {results['summary']['passed']} ✅
- **Failed**: {results['summary']['failed']} ❌
- **Average Duration**: {results['summary']['average_duration']:.2f} seconds
- **Average Integrity Score**: {results['summary']['average_integrity_score']:.1f}%

## Rollback Testing

- **Rollback Tests**: {results['summary']['rollbacks_tested']}
- **Rollback Successful**: {results['summary']['rollbacks_successful']} ✅
- **Rollback Success Rate**: {(results['summary']['rollbacks_successful'] / max(1, results['summary']['rollbacks_tested']) * 100):.1f}%

## Overall Status
{'✅ **ALL MODE SWITCHING SCENARIOS VALIDATED**' if results['summary']['failed'] == 0 else '❌ **MODE SWITCHING VALIDATION FAILED**'}

## Deployment Mode Service Expectations

"""
        
        for mode, expectation in self.service_expectations.items():
            summary += f"""### {mode} Mode
- **Services**: {", ".join(expectation.services)}
- **Ports**: {", ".join(map(str, expectation.ports))}
- **Network Accessible**: {'Yes' if expectation.network_accessible else 'No'}
- **Desktop Interface**: {'Yes' if expectation.desktop_interface else 'No'}
- **Web Interface**: {'Yes' if expectation.web_interface else 'No'}

"""
        
        summary += "## Scenario Results\n\n"
        
        for scenario_result in results["scenarios"]:
            scenario = scenario_result["scenario"]
            status_icon = "✅" if scenario_result["success"] else "❌"
            duration = scenario_result["duration"]
            integrity_score = scenario_result["performance_metrics"]["data_integrity_score"]
            
            summary += f"""### {scenario['name']} {status_icon}
- **Description**: {scenario['description']}
- **Transition**: {scenario['from_mode']} → {scenario['to_mode']}
- **Duration**: {duration:.2f}s (Max: {scenario['expected_duration_max']}s)
- **Data Integrity Score**: {integrity_score}%
- **Data Preservation**: {'Required' if scenario['data_preservation_required'] else 'Not Required'}
- **Service Reconfiguration**: {'Required' if scenario['service_reconfiguration_required'] else 'Not Required'}
- **Network Access Change**: {'Yes' if scenario['network_access_change'] else 'No'}
"""
            
            if scenario_result.get("rollback_result"):
                rollback = scenario_result["rollback_result"]
                rollback_icon = "✅" if rollback["success"] else "❌"
                summary += f"- **Rollback Test**: {rollback_icon} (Score: {rollback['integrity_score']}%)\n"
            
            if "validation_results" in scenario_result:
                validation = scenario_result["validation_results"]
                if validation.get("failed_tests"):
                    summary += f"- **Failed Tests**: {', '.join(validation['failed_tests'])}\n"
                if validation.get("warnings"):
                    summary += f"- **Warnings**: {', '.join(validation['warnings'])}\n"
            
            summary += "\n"
        
        summary += """## Mode Switching Categories

### Expansion Scenarios (Adding Capabilities)
- **Desktop → Hybrid**: Add server capabilities to desktop
- **Server → Hybrid**: Add desktop interface to server
- **Desktop → Development**: Enable development features

### Reduction Scenarios (Removing Capabilities)  
- **Hybrid → Desktop**: Remove server capabilities
- **Hybrid → Server**: Remove desktop interface
- **Development → Desktop**: Disable development features

### Complex Transitions
- **Server ↔ Desktop**: Complete architecture change
- **Any → Development**: Enable/disable development mode

## Recommendations

"""
        
        if results["summary"]["failed"] == 0:
            summary += "✅ All deployment mode switching scenarios validated successfully.\n\n"
            summary += "**Key Findings:**\n"
            summary += "- User data preservation works across all mode transitions\n"
            summary += "- Service reconfiguration happens correctly\n"
            summary += "- Network access controls are properly updated\n"
            summary += "- Interface availability matches deployment mode expectations\n"
            summary += "- Rollback functionality provides reliable recovery path\n\n"
            summary += "**Next Steps:**\n"
            summary += "1. Implement actual MSI-based mode switching mechanism\n"
            summary += "2. Test on real Windows environments with actual services\n"
            summary += "3. Validate network security changes during transitions\n"
            summary += "4. Test mode switching under load conditions\n"
        else:
            summary += "❌ Some mode switching scenarios failed validation. Address the following issues:\n\n"
            
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
*Generated by HotM Mode Switching Validator on {results['validation_info']['timestamp']}*
"""
        
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write(summary)
        
        self.log(f"Mode switching validation summary saved: {summary_file}", "SUCCESS")

def main():
    """Main mode switching validation entry point."""
    project_root = Path.cwd()
    
    validator = ModeSwitchingValidator(project_root)
    results = validator.run_all_mode_switching_scenarios()
    
    print(f"\nMode switching validation completed. Results saved to: {validator.test_data_dir}")
    
    success = results["summary"]["failed"] == 0
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()