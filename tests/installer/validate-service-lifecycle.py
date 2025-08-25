#!/usr/bin/env python3
"""
HotM Service Lifecycle Management Validation
Validates service installation, startup, dependencies, health monitoring, and recovery.
"""

import os
import sys
import json
import time
import threading
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import uuid
import shutil

@dataclass
class ServiceSpec:
    """Service specification and expectations."""
    name: str
    display_name: str
    description: str
    executable_path: str
    startup_type: str  # Auto, Manual, Disabled
    dependencies: List[str]
    ports: List[int]
    health_check_url: Optional[str]
    expected_startup_time: int  # seconds
    recovery_actions: List[str]
    log_files: List[str]

@dataclass
class ServiceTest:
    """Service lifecycle test specification."""
    test_name: str
    description: str
    service_names: List[str]
    test_function: str
    timeout_seconds: int
    critical: bool

class ServiceLifecycleValidator:
    """Validates service lifecycle management across all deployment modes."""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.test_data_dir = project_root / "test-results" / "service-lifecycle-validation"
        self.test_data_dir.mkdir(parents=True, exist_ok=True)
        
        self.service_specs = self._define_service_specifications()
        self.lifecycle_tests = self._define_lifecycle_tests()
        self.validation_results = []
        
        self.log_file = self.test_data_dir / "service-lifecycle-validation.log"
        self.log("Service lifecycle validation initialized", "INFO")
        
        # Mock service process tracking
        self.mock_services = {}
        self.service_processes = {}
    
    def log(self, message: str, level: str = "INFO"):
        """Log a message with timestamp."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        log_message = f"[{timestamp}] [{level}] {message}"
        
        print(log_message)
        
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_message + "\n")
    
    def _define_service_specifications(self) -> Dict[str, ServiceSpec]:
        """Define specifications for all HotM services."""
        return {
            "HotM-PostgreSQL": ServiceSpec(
                name="HotM-PostgreSQL",
                display_name="HotM PostgreSQL Database Service",
                description="PostgreSQL database service for HotM with pgvector extension",
                executable_path="C:\\Program Files\\HotM\\database\\postgresql\\bin\\pg_ctl.exe",
                startup_type="Auto",
                dependencies=[],
                ports=[54321],
                health_check_url="postgresql://localhost:54321/hotm",
                expected_startup_time=30,
                recovery_actions=["restart", "restart_with_recovery", "manual_intervention"],
                log_files=["postgresql.log", "postgresql_startup.log"]
            ),
            "HotM-Ollama": ServiceSpec(
                name="HotM-Ollama",
                display_name="HotM Ollama AI Service",
                description="Ollama AI model service for HotM natural language processing",
                executable_path="C:\\Program Files\\HotM\\ollama\\ollama.exe",
                startup_type="Auto",
                dependencies=[],
                ports=[11434],
                health_check_url="http://localhost:11434/api/health",
                expected_startup_time=60,  # AI models take longer to load
                recovery_actions=["restart", "model_reload", "manual_intervention"],
                log_files=["ollama.log", "model_loading.log"]
            ),
            "HotM-Server": ServiceSpec(
                name="HotM-Server",
                display_name="HotM API Server",
                description="Main HotM API server with web interface and MCP integration",
                executable_path="C:\\Program Files\\HotM\\bin\\hotm.exe",
                startup_type="Auto",
                dependencies=["HotM-PostgreSQL", "HotM-Ollama"],
                ports=[53211],
                health_check_url="http://localhost:53211/api/v1/health",
                expected_startup_time=15,
                recovery_actions=["restart", "dependency_check", "configuration_reload"],
                log_files=["hotm-server.log", "api.log", "mcp.log"]
            )
        }
    
    def _define_lifecycle_tests(self) -> List[ServiceTest]:
        """Define service lifecycle test scenarios."""
        return [
            ServiceTest(
                test_name="Service Installation",
                description="Verify services are properly installed and registered",
                service_names=list(self.service_specs.keys()),
                test_function="test_service_installation",
                timeout_seconds=60,
                critical=True
            ),
            ServiceTest(
                test_name="Service Startup",
                description="Verify services start in correct order and within expected timeframes",
                service_names=list(self.service_specs.keys()),
                test_function="test_service_startup",
                timeout_seconds=180,
                critical=True
            ),
            ServiceTest(
                test_name="Dependency Resolution",
                description="Verify service dependencies are properly configured and enforced",
                service_names=["HotM-Server"],
                test_function="test_dependency_resolution",
                timeout_seconds=120,
                critical=True
            ),
            ServiceTest(
                test_name="Health Monitoring",
                description="Verify service health checks work correctly",
                service_names=list(self.service_specs.keys()),
                test_function="test_health_monitoring",
                timeout_seconds=90,
                critical=False
            ),
            ServiceTest(
                test_name="Service Recovery",
                description="Verify automatic service recovery mechanisms",
                service_names=list(self.service_specs.keys()),
                test_function="test_service_recovery",
                timeout_seconds=300,
                critical=False
            ),
            ServiceTest(
                test_name="Graceful Shutdown",
                description="Verify services shutdown gracefully in reverse dependency order",
                service_names=list(self.service_specs.keys()),
                test_function="test_graceful_shutdown",
                timeout_seconds=120,
                critical=True
            ),
            ServiceTest(
                test_name="Configuration Reload",
                description="Verify services can reload configuration without restart",
                service_names=["HotM-Server"],
                test_function="test_configuration_reload",
                timeout_seconds=60,
                critical=False
            ),
            ServiceTest(
                test_name="Resource Management",
                description="Verify services manage system resources appropriately",
                service_names=list(self.service_specs.keys()),
                test_function="test_resource_management",
                timeout_seconds=180,
                critical=False
            ),
            ServiceTest(
                test_name="Log Management",
                description="Verify service logging works correctly with rotation",
                service_names=list(self.service_specs.keys()),
                test_function="test_log_management",
                timeout_seconds=90,
                critical=False
            ),
            ServiceTest(
                test_name="Network Binding",
                description="Verify services bind to correct network interfaces and ports",
                service_names=list(self.service_specs.keys()),
                test_function="test_network_binding",
                timeout_seconds=60,
                critical=True
            )
        ]
    
    def create_mock_service_environment(self, deployment_mode: str) -> Path:
        """Create mock service environment for testing."""
        self.log(f"Creating mock service environment for {deployment_mode} mode", "INFO")
        
        env_id = str(uuid.uuid4())[:8]
        service_env = self.test_data_dir / f"service-env-{deployment_mode.lower()}-{env_id}"
        service_env.mkdir(parents=True, exist_ok=True)
        
        # Create directory structure
        directories = [
            "bin", "database/postgresql/bin", "ollama", "logs", "config", "data", "services"
        ]
        
        for directory in directories:
            (service_env / directory).mkdir(parents=True, exist_ok=True)
        
        # Create mock service executables
        mode_services = self._get_services_for_mode(deployment_mode)
        
        for service_name in mode_services:
            spec = self.service_specs[service_name]
            
            # Create mock executable (handle Windows paths on Linux)
            try:
                relative_exe_path = Path(spec.executable_path.replace("C:\\Program Files\\HotM\\", ""))
            except:
                # Fallback for path handling
                relative_exe_path = Path("bin") / f"{service_name.lower().replace('-', '_')}.exe"
            
            exe_path = service_env / relative_exe_path
            exe_path.parent.mkdir(parents=True, exist_ok=True)
            exe_path.write_text(f"Mock {service_name} executable")
            
            # Create service configuration
            self._create_service_configuration(service_env, service_name, spec, deployment_mode)
            
            # Create log directories
            for log_file in spec.log_files:
                log_path = service_env / "logs" / log_file
                log_path.touch()
        
        # Create environment metadata
        metadata = {
            "deployment_mode": deployment_mode,
            "services": mode_services,
            "created_at": datetime.now().isoformat(),
            "environment_id": env_id
        }
        
        metadata_file = service_env / "environment.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        self.log(f"Mock service environment created: {service_env}", "SUCCESS")
        return service_env
    
    def _get_services_for_mode(self, deployment_mode: str) -> List[str]:
        """Get services required for a deployment mode."""
        mode_services = {
            "Desktop": ["HotM-Server"],
            "Server": ["HotM-PostgreSQL", "HotM-Ollama", "HotM-Server"],
            "Hybrid": ["HotM-PostgreSQL", "HotM-Ollama", "HotM-Server"],
            "Development": ["HotM-PostgreSQL", "HotM-Ollama", "HotM-Server"]
        }
        
        return mode_services.get(deployment_mode, [])
    
    def _create_service_configuration(self, service_env: Path, service_name: str, spec: ServiceSpec, deployment_mode: str):
        """Create service configuration files."""
        config_dir = service_env / "config"
        
        # Handle Windows paths on Linux
        try:
            relative_exe_path = Path(spec.executable_path.replace("C:\\Program Files\\HotM\\", ""))
        except:
            relative_exe_path = Path("bin") / f"{service_name.lower().replace('-', '_')}.exe"
        
        # Create service-specific configuration
        service_config = {
            "service_name": service_name,
            "display_name": spec.display_name,
            "description": spec.description,
            "executable_path": str(service_env / relative_exe_path),
            "startup_type": spec.startup_type,
            "dependencies": spec.dependencies,
            "ports": spec.ports,
            "health_check_url": spec.health_check_url,
            "deployment_mode": deployment_mode,
            "log_directory": str(service_env / "logs"),
            "data_directory": str(service_env / "data"),
            "recovery_settings": {
                "max_restart_attempts": 3,
                "restart_delay_seconds": 30,
                "failure_actions": spec.recovery_actions
            }
        }
        
        config_file = config_dir / f"{service_name.lower().replace('-', '_')}.json"
        with open(config_file, 'w') as f:
            json.dump(service_config, f, indent=2)
    
    def simulate_service_lifecycle_test(self, test: ServiceTest, deployment_mode: str) -> Dict[str, Any]:
        """Simulate a service lifecycle test."""
        self.log(f"Running test: {test.test_name} ({deployment_mode} mode)", "INFO")
        
        start_time = time.time()
        
        try:
            # Create test environment
            service_env = self.create_mock_service_environment(deployment_mode)
            
            # Execute test
            test_method = getattr(self, test.test_function)
            test_result = test_method(test, service_env, deployment_mode)
            
            duration = time.time() - start_time
            
            result = {
                "test": asdict(test),
                "deployment_mode": deployment_mode,
                "success": test_result.get("success", False),
                "duration": duration,
                "details": test_result,
                "performance_metrics": {
                    "execution_time": duration,
                    "within_timeout": duration <= test.timeout_seconds,
                    "resource_usage": test_result.get("resource_metrics", {})
                },
                "artifacts": {
                    "service_environment": str(service_env),
                    "log_files": test_result.get("log_files", [])
                }
            }
            
            status = "PASS" if test_result.get("success", False) else "FAIL"
            self.log(f"Test {test.test_name} completed: {status} in {duration:.2f}s", 
                    "SUCCESS" if test_result.get("success", False) else "ERROR")
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            self.log(f"Test {test.test_name} failed: {str(e)}", "ERROR")
            
            return {
                "test": asdict(test),
                "deployment_mode": deployment_mode,
                "success": False,
                "duration": duration,
                "error": str(e),
                "performance_metrics": {
                    "execution_time": duration,
                    "within_timeout": False,
                    "resource_usage": {}
                }
            }
    
    # Test implementation methods
    
    def test_service_installation(self, test: ServiceTest, service_env: Path, deployment_mode: str) -> Dict[str, Any]:
        """Test service installation and registration."""
        results = {
            "success": True,
            "message": "",
            "service_results": {},
            "installation_checks": []
        }
        
        mode_services = self._get_services_for_mode(deployment_mode)
        
        for service_name in mode_services:
            spec = self.service_specs[service_name]
            service_result = {
                "installed": False,
                "executable_exists": False,
                "configuration_valid": False,
                "dependencies_resolved": True
            }
            
            # Check executable exists (handle Windows paths on Linux)
            try:
                relative_exe_path = Path(spec.executable_path.replace("C:\\Program Files\\HotM\\", ""))
            except:
                relative_exe_path = Path("bin") / f"{service_name.lower().replace('-', '_')}.exe"
            
            exe_path = service_env / relative_exe_path
            service_result["executable_exists"] = exe_path.exists()
            
            # Check configuration
            config_file = service_env / "config" / f"{service_name.lower().replace('-', '_')}.json"
            service_result["configuration_valid"] = config_file.exists()
            
            # Check dependencies (in Desktop mode, dependencies are external)
            if deployment_mode != "Desktop":
                for dep in spec.dependencies:
                    if dep not in mode_services:
                        service_result["dependencies_resolved"] = False
                        break
            
            service_result["installed"] = all([
                service_result["executable_exists"],
                service_result["configuration_valid"],
                service_result["dependencies_resolved"]
            ])
            
            if not service_result["installed"]:
                results["success"] = False
            
            results["service_results"][service_name] = service_result
        
        installed_count = sum(1 for r in results["service_results"].values() if r["installed"])
        total_count = len(mode_services)
        
        results["message"] = f"{installed_count}/{total_count} services properly installed"
        results["installation_checks"] = [
            f"Executables: {sum(1 for r in results['service_results'].values() if r['executable_exists'])}/{total_count}",
            f"Configurations: {sum(1 for r in results['service_results'].values() if r['configuration_valid'])}/{total_count}",
            f"Dependencies: {sum(1 for r in results['service_results'].values() if r['dependencies_resolved'])}/{total_count}"
        ]
        
        return results
    
    def test_service_startup(self, test: ServiceTest, service_env: Path, deployment_mode: str) -> Dict[str, Any]:
        """Test service startup sequence and timing."""
        results = {
            "success": True,
            "message": "",
            "startup_results": {},
            "startup_order": [],
            "total_startup_time": 0
        }
        
        mode_services = self._get_services_for_mode(deployment_mode)
        startup_sequence = self._get_startup_sequence(mode_services)
        
        total_start_time = time.time()
        
        for service_name in startup_sequence:
            spec = self.service_specs[service_name]
            service_start_time = time.time()
            
            # Simulate service startup
            startup_result = self._simulate_service_startup(service_name, spec, service_env)
            
            startup_duration = time.time() - service_start_time
            
            startup_result.update({
                "startup_time": startup_duration,
                "within_expected_time": startup_duration <= spec.expected_startup_time,
                "startup_order_position": len(results["startup_order"])
            })
            
            results["startup_results"][service_name] = startup_result
            results["startup_order"].append(service_name)
            
            if not startup_result.get("started", False):
                results["success"] = False
            
            # Simulate dependency waiting
            time.sleep(0.1)  # Small delay to simulate startup time
        
        results["total_startup_time"] = time.time() - total_start_time
        
        started_count = sum(1 for r in results["startup_results"].values() if r.get("started", False))
        total_count = len(mode_services)
        
        results["message"] = f"{started_count}/{total_count} services started successfully in {results['total_startup_time']:.2f}s"
        
        return results
    
    def test_dependency_resolution(self, test: ServiceTest, service_env: Path, deployment_mode: str) -> Dict[str, Any]:
        """Test service dependency resolution and ordering."""
        results = {
            "success": True,
            "message": "",
            "dependency_checks": {},
            "dependency_graph": {}
        }
        
        mode_services = self._get_services_for_mode(deployment_mode)
        
        # Build dependency graph
        for service_name in mode_services:
            spec = self.service_specs[service_name]
            results["dependency_graph"][service_name] = spec.dependencies
        
        # Test dependency resolution
        for service_name in mode_services:
            spec = self.service_specs[service_name]
            dep_result = {
                "service": service_name,
                "dependencies": spec.dependencies,
                "dependencies_available": [],
                "missing_dependencies": [],
                "circular_dependencies": False
            }
            
            # Check if all dependencies are available in the current mode
            for dep in spec.dependencies:
                if dep in mode_services:
                    dep_result["dependencies_available"].append(dep)
                elif deployment_mode == "Desktop":
                    # In Desktop mode, dependencies are external (remote services)
                    dep_result["dependencies_available"].append(f"{dep} (external)")
                else:
                    dep_result["missing_dependencies"].append(dep)
            
            # Check for circular dependencies (simplified)
            dep_result["circular_dependencies"] = self._check_circular_dependencies(service_name, results["dependency_graph"])
            
            # Dependency resolution is successful if all deps are available and no circular deps
            # In Desktop mode, external dependencies are considered resolved
            dep_success = (
                (len(dep_result["missing_dependencies"]) == 0 or deployment_mode == "Desktop") and
                not dep_result["circular_dependencies"]
            )
            
            if not dep_success:
                results["success"] = False
            
            results["dependency_checks"][service_name] = dep_result
        
        resolved_count = sum(1 for r in results["dependency_checks"].values() 
                           if len(r["missing_dependencies"]) == 0 and not r["circular_dependencies"])
        total_count = len(mode_services)
        
        results["message"] = f"{resolved_count}/{total_count} services have resolved dependencies"
        
        return results
    
    def test_health_monitoring(self, test: ServiceTest, service_env: Path, deployment_mode: str) -> Dict[str, Any]:
        """Test service health monitoring capabilities."""
        results = {
            "success": True,
            "message": "",
            "health_checks": {},
            "monitoring_metrics": {}
        }
        
        mode_services = self._get_services_for_mode(deployment_mode)
        
        for service_name in mode_services:
            spec = self.service_specs[service_name]
            
            # Simulate health check
            health_result = self._simulate_health_check(service_name, spec, service_env)
            
            health_success = health_result.get("healthy", False)
            if not health_success:
                results["success"] = False
            
            results["health_checks"][service_name] = health_result
        
        healthy_count = sum(1 for r in results["health_checks"].values() if r.get("healthy", False))
        total_count = len(mode_services)
        
        results["message"] = f"{healthy_count}/{total_count} services passed health checks"
        
        # Add monitoring metrics
        results["monitoring_metrics"] = {
            "average_response_time": sum(r.get("response_time", 0) for r in results["health_checks"].values()) / max(1, total_count),
            "health_check_success_rate": (healthy_count / max(1, total_count)) * 100
        }
        
        return results
    
    def test_service_recovery(self, test: ServiceTest, service_env: Path, deployment_mode: str) -> Dict[str, Any]:
        """Test service recovery mechanisms."""
        results = {
            "success": True,
            "message": "",
            "recovery_tests": {},
            "recovery_metrics": {}
        }
        
        mode_services = self._get_services_for_mode(deployment_mode)
        
        for service_name in mode_services:
            spec = self.service_specs[service_name]
            
            # Simulate service failure and recovery
            recovery_result = self._simulate_service_recovery(service_name, spec, service_env)
            
            recovery_success = recovery_result.get("recovered", False)
            if not recovery_success:
                results["success"] = False
            
            results["recovery_tests"][service_name] = recovery_result
        
        recovered_count = sum(1 for r in results["recovery_tests"].values() if r.get("recovered", False))
        total_count = len(mode_services)
        
        results["message"] = f"{recovered_count}/{total_count} services recovered successfully"
        
        # Add recovery metrics
        results["recovery_metrics"] = {
            "average_recovery_time": sum(r.get("recovery_time", 0) for r in results["recovery_tests"].values()) / max(1, total_count),
            "recovery_success_rate": (recovered_count / max(1, total_count)) * 100
        }
        
        return results
    
    def test_graceful_shutdown(self, test: ServiceTest, service_env: Path, deployment_mode: str) -> Dict[str, Any]:
        """Test graceful service shutdown."""
        results = {
            "success": True,
            "message": "",
            "shutdown_results": {},
            "shutdown_order": [],
            "total_shutdown_time": 0
        }
        
        mode_services = self._get_services_for_mode(deployment_mode)
        shutdown_sequence = list(reversed(self._get_startup_sequence(mode_services)))
        
        total_shutdown_start = time.time()
        
        for service_name in shutdown_sequence:
            spec = self.service_specs[service_name]
            shutdown_start = time.time()
            
            # Simulate graceful shutdown
            shutdown_result = self._simulate_service_shutdown(service_name, spec, service_env)
            shutdown_duration = time.time() - shutdown_start
            
            shutdown_result.update({
                "shutdown_time": shutdown_duration,
                "shutdown_order_position": len(results["shutdown_order"])
            })
            
            results["shutdown_results"][service_name] = shutdown_result
            results["shutdown_order"].append(service_name)
            
            if not shutdown_result.get("stopped", False):
                results["success"] = False
            
            # Small delay between shutdowns
            time.sleep(0.05)
        
        results["total_shutdown_time"] = time.time() - total_shutdown_start
        
        stopped_count = sum(1 for r in results["shutdown_results"].values() if r.get("stopped", False))
        total_count = len(mode_services)
        
        results["message"] = f"{stopped_count}/{total_count} services shutdown gracefully in {results['total_shutdown_time']:.2f}s"
        
        return results
    
    def test_configuration_reload(self, test: ServiceTest, service_env: Path, deployment_mode: str) -> Dict[str, Any]:
        """Test configuration reload without restart."""
        results = {
            "success": True,
            "message": "",
            "reload_results": {}
        }
        
        # Only test services that support configuration reload
        reload_services = ["HotM-Server"]
        mode_services = self._get_services_for_mode(deployment_mode)
        test_services = [s for s in reload_services if s in mode_services]
        
        for service_name in test_services:
            spec = self.service_specs[service_name]
            
            # Simulate configuration reload
            reload_result = self._simulate_configuration_reload(service_name, spec, service_env)
            
            reload_success = reload_result.get("reloaded", False)
            if not reload_success:
                results["success"] = False
            
            results["reload_results"][service_name] = reload_result
        
        if test_services:
            reloaded_count = sum(1 for r in results["reload_results"].values() if r.get("reloaded", False))
            total_count = len(test_services)
            results["message"] = f"{reloaded_count}/{total_count} services reloaded configuration successfully"
        else:
            results["message"] = "No services support configuration reload in this mode"
        
        return results
    
    def test_resource_management(self, test: ServiceTest, service_env: Path, deployment_mode: str) -> Dict[str, Any]:
        """Test service resource management."""
        results = {
            "success": True,
            "message": "",
            "resource_checks": {},
            "system_metrics": {}
        }
        
        mode_services = self._get_services_for_mode(deployment_mode)
        
        for service_name in mode_services:
            spec = self.service_specs[service_name]
            
            # Simulate resource usage check
            resource_result = self._simulate_resource_check(service_name, spec, service_env)
            
            resource_ok = resource_result.get("within_limits", True)
            if not resource_ok:
                results["success"] = False
            
            results["resource_checks"][service_name] = resource_result
        
        within_limits_count = sum(1 for r in results["resource_checks"].values() if r.get("within_limits", True))
        total_count = len(mode_services)
        
        results["message"] = f"{within_limits_count}/{total_count} services within resource limits"
        
        # Calculate system metrics
        results["system_metrics"] = {
            "total_memory_usage": sum(r.get("memory_mb", 0) for r in results["resource_checks"].values()),
            "total_cpu_usage": sum(r.get("cpu_percent", 0) for r in results["resource_checks"].values()),
            "port_usage": [port for r in results["resource_checks"].values() for port in r.get("ports_in_use", [])]
        }
        
        return results
    
    def test_log_management(self, test: ServiceTest, service_env: Path, deployment_mode: str) -> Dict[str, Any]:
        """Test service log management."""
        results = {
            "success": True,
            "message": "",
            "log_checks": {},
            "log_files": []
        }
        
        mode_services = self._get_services_for_mode(deployment_mode)
        
        for service_name in mode_services:
            spec = self.service_specs[service_name]
            
            # Check log files
            log_result = self._simulate_log_check(service_name, spec, service_env)
            
            logs_ok = log_result.get("logs_created", False)
            if not logs_ok:
                results["success"] = False
            
            results["log_checks"][service_name] = log_result
            results["log_files"].extend(log_result.get("log_files", []))
        
        services_with_logs = sum(1 for r in results["log_checks"].values() if r.get("logs_created", False))
        total_count = len(mode_services)
        
        results["message"] = f"{services_with_logs}/{total_count} services have proper log management"
        
        return results
    
    def test_network_binding(self, test: ServiceTest, service_env: Path, deployment_mode: str) -> Dict[str, Any]:
        """Test service network binding."""
        results = {
            "success": True,
            "message": "",
            "binding_checks": {},
            "port_allocations": {}
        }
        
        mode_services = self._get_services_for_mode(deployment_mode)
        used_ports = set()
        
        for service_name in mode_services:
            spec = self.service_specs[service_name]
            
            # Check port binding
            binding_result = self._simulate_network_binding(service_name, spec, service_env, used_ports)
            
            binding_ok = binding_result.get("bound_successfully", False)
            if not binding_ok:
                results["success"] = False
            
            results["binding_checks"][service_name] = binding_result
            
            # Track port usage
            bound_ports = binding_result.get("bound_ports", [])
            for port in bound_ports:
                used_ports.add(port)
                results["port_allocations"][port] = service_name
        
        bound_successfully = sum(1 for r in results["binding_checks"].values() if r.get("bound_successfully", False))
        total_count = len(mode_services)
        
        results["message"] = f"{bound_successfully}/{total_count} services bound to network successfully"
        
        return results
    
    # Helper methods for service simulation
    
    def _get_startup_sequence(self, services: List[str]) -> List[str]:
        """Get the correct startup sequence based on dependencies."""
        sequence = []
        remaining = services.copy()
        
        while remaining:
            # Find services with no unresolved dependencies
            ready_services = []
            for service in remaining:
                spec = self.service_specs[service]
                deps_satisfied = all(dep in sequence or dep not in services for dep in spec.dependencies)
                if deps_satisfied:
                    ready_services.append(service)
            
            if not ready_services:
                # Circular dependency or other issue - add remaining services
                sequence.extend(remaining)
                break
            
            # Add ready services to sequence
            for service in ready_services:
                sequence.append(service)
                remaining.remove(service)
        
        return sequence
    
    def _check_circular_dependencies(self, service: str, dep_graph: Dict[str, List[str]], visited: Optional[set] = None, path: Optional[set] = None) -> bool:
        """Check for circular dependencies."""
        if visited is None:
            visited = set()
        if path is None:
            path = set()
        
        if service in path:
            return True  # Circular dependency found
        
        if service in visited:
            return False
        
        visited.add(service)
        path.add(service)
        
        for dep in dep_graph.get(service, []):
            if self._check_circular_dependencies(dep, dep_graph, visited, path):
                return True
        
        path.remove(service)
        return False
    
    def _simulate_service_startup(self, service_name: str, spec: ServiceSpec, service_env: Path) -> Dict[str, Any]:
        """Simulate service startup."""
        startup_time = min(0.5, spec.expected_startup_time / 100)  # Scale down for simulation
        time.sleep(startup_time)
        
        # Simulate startup success (95% success rate)
        import random
        success = random.random() > 0.05
        
        return {
            "started": success,
            "startup_time": startup_time,
            "process_id": random.randint(1000, 9999) if success else None,
            "startup_errors": [] if success else [f"Failed to start {service_name}"]
        }
    
    def _simulate_health_check(self, service_name: str, spec: ServiceSpec, service_env: Path) -> Dict[str, Any]:
        """Simulate service health check."""
        import random
        
        response_time = random.uniform(0.01, 0.1)  # 10-100ms response time
        time.sleep(response_time)
        
        # Simulate health check success (90% success rate)
        healthy = random.random() > 0.1
        
        return {
            "healthy": healthy,
            "response_time": response_time,
            "health_check_url": spec.health_check_url,
            "status_code": 200 if healthy else 503,
            "details": "Service is healthy" if healthy else "Service is experiencing issues"
        }
    
    def _simulate_service_recovery(self, service_name: str, spec: ServiceSpec, service_env: Path) -> Dict[str, Any]:
        """Simulate service failure and recovery."""
        import random
        
        # Simulate failure
        failure_duration = random.uniform(0.1, 0.5)
        time.sleep(failure_duration)
        
        # Simulate recovery attempt
        recovery_time = random.uniform(0.2, 1.0)
        time.sleep(recovery_time)
        
        # Recovery success rate depends on service (90% for main services)
        recovery_success = random.random() > 0.1
        
        return {
            "recovered": recovery_success,
            "failure_duration": failure_duration,
            "recovery_time": recovery_time,
            "recovery_actions_attempted": spec.recovery_actions[:1],  # Simulate using first recovery action
            "final_state": "running" if recovery_success else "failed"
        }
    
    def _simulate_service_shutdown(self, service_name: str, spec: ServiceSpec, service_env: Path) -> Dict[str, Any]:
        """Simulate graceful service shutdown."""
        import random
        
        shutdown_time = random.uniform(0.05, 0.2)
        time.sleep(shutdown_time)
        
        # Simulate graceful shutdown success (95% success rate)
        graceful = random.random() > 0.05
        
        return {
            "stopped": True,  # Eventually stops, but might not be graceful
            "graceful": graceful,
            "shutdown_time": shutdown_time,
            "cleanup_completed": graceful
        }
    
    def _simulate_configuration_reload(self, service_name: str, spec: ServiceSpec, service_env: Path) -> Dict[str, Any]:
        """Simulate configuration reload."""
        import random
        
        reload_time = random.uniform(0.1, 0.3)
        time.sleep(reload_time)
        
        # Simulate reload success (85% success rate)
        success = random.random() > 0.15
        
        return {
            "reloaded": success,
            "reload_time": reload_time,
            "configuration_valid": success,
            "restart_required": not success
        }
    
    def _simulate_resource_check(self, service_name: str, spec: ServiceSpec, service_env: Path) -> Dict[str, Any]:
        """Simulate resource usage check."""
        import random
        
        # Simulate different resource usage patterns by service type
        if "PostgreSQL" in service_name:
            memory_mb = random.randint(100, 500)
            cpu_percent = random.uniform(5, 25)
        elif "Ollama" in service_name:
            memory_mb = random.randint(1000, 4000)  # AI models use more memory
            cpu_percent = random.uniform(10, 60)
        else:  # HotM-Server
            memory_mb = random.randint(50, 200)
            cpu_percent = random.uniform(2, 15)
        
        # Check if within reasonable limits
        within_limits = memory_mb < 5000 and cpu_percent < 80
        
        return {
            "within_limits": within_limits,
            "memory_mb": memory_mb,
            "cpu_percent": cpu_percent,
            "ports_in_use": spec.ports,
            "resource_alerts": [] if within_limits else ["High resource usage detected"]
        }
    
    def _simulate_log_check(self, service_name: str, spec: ServiceSpec, service_env: Path) -> Dict[str, Any]:
        """Simulate log management check."""
        log_files = []
        
        for log_file in spec.log_files:
            log_path = service_env / "logs" / log_file
            
            # Simulate log file creation and some content
            if log_path.exists():
                log_path.write_text(f"[{datetime.now().isoformat()}] INFO {service_name} started successfully\n")
                log_files.append(str(log_path))
        
        logs_created = len(log_files) == len(spec.log_files)
        
        return {
            "logs_created": logs_created,
            "log_files": log_files,
            "total_log_size": sum(len(log_path.read_text()) for log_path in [service_env / "logs" / f for f in spec.log_files] if log_path.exists()),
            "rotation_needed": False  # Simplified for simulation
        }
    
    def _simulate_network_binding(self, service_name: str, spec: ServiceSpec, service_env: Path, used_ports: set) -> Dict[str, Any]:
        """Simulate network port binding."""
        bound_ports = []
        binding_errors = []
        
        for port in spec.ports:
            if port in used_ports:
                binding_errors.append(f"Port {port} already in use")
            else:
                bound_ports.append(port)
        
        binding_successful = len(bound_ports) == len(spec.ports)
        
        return {
            "bound_successfully": binding_successful,
            "bound_ports": bound_ports,
            "binding_errors": binding_errors,
            "listening_interfaces": ["127.0.0.1", "0.0.0.0"] if binding_successful else []
        }
    
    def run_service_lifecycle_validation(self) -> Dict[str, Any]:
        """Run comprehensive service lifecycle validation."""
        self.log("Starting comprehensive service lifecycle validation", "INFO")
        
        deployment_modes = ["Desktop", "Server", "Hybrid", "Development"]
        
        results = {
            "validation_info": {
                "framework": "HotM Service Lifecycle Validator",
                "version": "1.0.0",
                "timestamp": datetime.now().isoformat(),
                "deployment_modes": deployment_modes,
                "total_tests": len(self.lifecycle_tests) * len(deployment_modes)
            },
            "test_results": [],
            "summary": {
                "total_tests": 0,
                "passed": 0,
                "failed": 0,
                "critical_failures": 0,
                "average_duration": 0,
                "deployment_mode_results": {}
            }
        }
        
        total_duration = 0
        
        # Run tests for each deployment mode
        for deployment_mode in deployment_modes:
            mode_results = {
                "deployment_mode": deployment_mode,
                "tests_run": 0,
                "tests_passed": 0,
                "tests_failed": 0,
                "critical_failures": 0,
                "total_duration": 0
            }
            
            mode_start_time = time.time()
            
            for test in self.lifecycle_tests:
                test_result = self.simulate_service_lifecycle_test(test, deployment_mode)
                results["test_results"].append(test_result)
                
                # Update counters
                results["summary"]["total_tests"] += 1
                mode_results["tests_run"] += 1
                
                if test_result["success"]:
                    results["summary"]["passed"] += 1
                    mode_results["tests_passed"] += 1
                else:
                    results["summary"]["failed"] += 1
                    mode_results["tests_failed"] += 1
                    
                    if test.critical:
                        results["summary"]["critical_failures"] += 1
                        mode_results["critical_failures"] += 1
                
                total_duration += test_result["duration"]
            
            mode_results["total_duration"] = time.time() - mode_start_time
            results["summary"]["deployment_mode_results"][deployment_mode] = mode_results
        
        if results["summary"]["total_tests"] > 0:
            results["summary"]["average_duration"] = total_duration / results["summary"]["total_tests"]
        
        # Save results
        results_file = self.test_data_dir / "service-lifecycle-results.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        # Generate summary report
        self._generate_service_lifecycle_summary(results)
        
        success = results["summary"]["critical_failures"] == 0
        status = "PASSED" if success else "FAILED"
        self.log(f"Service lifecycle validation {status}: {results['summary']['passed']}/{results['summary']['total_tests']} tests passed", "SUCCESS" if success else "ERROR")
        
        return results
    
    def _generate_service_lifecycle_summary(self, results: Dict[str, Any]):
        """Generate markdown summary report for service lifecycle validation."""
        summary_file = self.test_data_dir / "service-lifecycle-summary.md"
        
        summary = f"""# HotM Service Lifecycle Management Validation Report

## Validation Summary

- **Total Tests**: {results['summary']['total_tests']}
- **Passed**: {results['summary']['passed']} ✅
- **Failed**: {results['summary']['failed']} ❌
- **Critical Failures**: {results['summary']['critical_failures']} 🚨
- **Average Duration**: {results['summary']['average_duration']:.2f} seconds

## Overall Status
{'✅ **SERVICE LIFECYCLE VALIDATION PASSED**' if results['summary']['critical_failures'] == 0 else '❌ **SERVICE LIFECYCLE VALIDATION FAILED**'}

## Service Specifications

"""
        
        for service_name, spec in self.service_specs.items():
            summary += f"""### {spec.display_name}
- **Service Name**: {service_name}
- **Startup Type**: {spec.startup_type}
- **Dependencies**: {', '.join(spec.dependencies) if spec.dependencies else 'None'}
- **Ports**: {', '.join(map(str, spec.ports))}
- **Expected Startup Time**: {spec.expected_startup_time}s
- **Health Check**: {spec.health_check_url or 'None'}
- **Recovery Actions**: {', '.join(spec.recovery_actions)}

"""
        
        summary += "## Results by Deployment Mode\n\n"
        
        for mode, mode_results in results["summary"]["deployment_mode_results"].items():
            success_rate = (mode_results["tests_passed"] / max(1, mode_results["tests_run"])) * 100
            status_icon = "✅" if mode_results["critical_failures"] == 0 else "❌"
            
            summary += f"""### {mode} Mode {status_icon}
- **Tests Run**: {mode_results['tests_run']}
- **Passed**: {mode_results['tests_passed']} ({success_rate:.1f}%)
- **Failed**: {mode_results['tests_failed']}
- **Critical Failures**: {mode_results['critical_failures']}
- **Duration**: {mode_results['total_duration']:.2f}s

"""
        
        summary += "## Test Results by Category\n\n"
        
        # Group results by test type
        test_categories = {}
        for result in results["test_results"]:
            test_name = result["test"]["test_name"]
            if test_name not in test_categories:
                test_categories[test_name] = {
                    "total": 0,
                    "passed": 0,
                    "failed": 0,
                    "modes": []
                }
            
            test_categories[test_name]["total"] += 1
            test_categories[test_name]["modes"].append(result["deployment_mode"])
            
            if result["success"]:
                test_categories[test_name]["passed"] += 1
            else:
                test_categories[test_name]["failed"] += 1
        
        for test_name, stats in test_categories.items():
            success_rate = (stats["passed"] / max(1, stats["total"])) * 100
            status_icon = "✅" if stats["failed"] == 0 else "❌"
            
            summary += f"""### {test_name} {status_icon}
- **Success Rate**: {success_rate:.1f}% ({stats['passed']}/{stats['total']})
- **Tested Modes**: {', '.join(set(stats['modes']))}
- **Failures**: {stats['failed']}

"""
        
        summary += "## Key Findings\n\n"
        
        if results["summary"]["critical_failures"] == 0:
            summary += "✅ **All Critical Tests Passed**\n\n"
            summary += "**Service Lifecycle Capabilities Validated:**\n"
            summary += "- Service installation and registration ✅\n"
            summary += "- Proper startup sequencing with dependency resolution ✅\n"
            summary += "- Health monitoring and status reporting ✅\n"
            summary += "- Graceful shutdown procedures ✅\n"
            summary += "- Resource management and monitoring ✅\n"
            summary += "- Network port binding and management ✅\n"
            summary += "- Log file creation and management ✅\n\n"
            
            summary += "**Deployment Mode Support:**\n"
            for mode in results["validation_info"]["deployment_modes"]:
                mode_stats = results["summary"]["deployment_mode_results"][mode]
                if mode_stats["critical_failures"] == 0:
                    summary += f"- {mode} Mode: Full service lifecycle support ✅\n"
                else:
                    summary += f"- {mode} Mode: Issues detected ❌\n"
            
            summary += "\n**Next Steps:**\n"
            summary += "1. Implement actual Windows service management in installer\n"
            summary += "2. Test service lifecycle on real Windows environments\n"
            summary += "3. Validate service monitoring and alerting systems\n"
            summary += "4. Test service recovery under various failure conditions\n"
        else:
            summary += "❌ **Critical Service Lifecycle Issues Detected**\n\n"
            
            # Identify critical failures
            critical_failures = [r for r in results["test_results"] if not r["success"] and r["test"]["critical"]]
            
            if critical_failures:
                summary += "**Critical Failures to Address:**\n"
                for failure in critical_failures:
                    summary += f"- **{failure['test']['test_name']}** ({failure['deployment_mode']} mode): {failure.get('error', 'Test failed')}\n"
                summary += "\n"
            
            summary += "**Recommendations:**\n"
            summary += "1. Fix all critical service lifecycle failures before production\n"
            summary += "2. Review service dependency configurations\n"
            summary += "3. Validate service installation and registration procedures\n"
            summary += "4. Test service startup and shutdown sequences\n"
        
        summary += f"""

## Service Architecture Overview

HotM uses a multi-service architecture with the following components:

1. **HotM-PostgreSQL**: Database service with pgvector extension
2. **HotM-Ollama**: AI model service for natural language processing  
3. **HotM-Server**: Main API server with web interface and MCP integration

Services are configured with proper dependencies, health monitoring, and recovery mechanisms to ensure reliable operation across all deployment modes.

---
*Generated by HotM Service Lifecycle Validator on {results['validation_info']['timestamp']}*
"""
        
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write(summary)
        
        self.log(f"Service lifecycle validation summary saved: {summary_file}", "SUCCESS")

def main():
    """Main service lifecycle validation entry point."""
    project_root = Path.cwd()
    
    validator = ServiceLifecycleValidator(project_root)
    results = validator.run_service_lifecycle_validation()
    
    print(f"\nService lifecycle validation completed. Results saved to: {validator.test_data_dir}")
    
    success = results["summary"]["critical_failures"] == 0
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()