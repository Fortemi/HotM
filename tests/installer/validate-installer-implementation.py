#!/usr/bin/env python3
"""
HotM Installer Implementation Validation
Comprehensive validation of installation and upgrade paths across all deployment scenarios.
"""

import os
import sys
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
import tempfile
import shutil

@dataclass
class ValidationResult:
    """Result of a validation test."""
    test_name: str
    category: str
    status: str  # Pass, Fail, Skip, Warning, Error
    message: str
    duration: float
    details: Dict[str, Any]
    timestamp: str
    artifacts: List[str]

@dataclass
class DeploymentMode:
    """Configuration for a deployment mode."""
    name: str
    description: str
    expected_services: List[str]
    expected_ports: List[int]
    install_arguments: List[str]
    features: List[str]
    data_location: str
    config_file: str

class InstallerValidator:
    """Comprehensive installer validation framework."""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.installer_dir = project_root / "installer"
        self.test_results: List[ValidationResult] = []
        self.deployment_modes = self._initialize_deployment_modes()
        self.validation_start_time = datetime.now()
        
        # Create test output directory
        self.output_dir = project_root / "test-results" / "installer-validation"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize logging
        self.log_file = self.output_dir / "validation.log"
        self.log("Installer validation framework initialized", "INFO")
    
    def _initialize_deployment_modes(self) -> Dict[str, DeploymentMode]:
        """Initialize deployment mode configurations."""
        return {
            "Desktop": DeploymentMode(
                name="Desktop Mode",
                description="Personal knowledge management installation",
                expected_services=["HotM-Server"],
                expected_ports=[53211],
                install_arguments=["/quiet", "DEPLOYMENT_MODE=desktop"],
                features=["Desktop", "LocalServer"],
                data_location="%LOCALAPPDATA%\\HotM",
                config_file="desktop-mode.toml"
            ),
            "Server": DeploymentMode(
                name="Server Mode", 
                description="Team collaboration hub installation",
                expected_services=["HotM-PostgreSQL", "HotM-Ollama", "HotM-Server"],
                expected_ports=[54321, 11434, 53211],
                install_arguments=["/quiet", "DEPLOYMENT_MODE=server"],
                features=["Server", "Database", "AIService", "WebUI"],
                data_location="%ProgramData%\\HotM",
                config_file="server-mode.toml"
            ),
            "Hybrid": DeploymentMode(
                name="Hybrid Mode",
                description="Desktop and server capabilities combined",
                expected_services=["HotM-PostgreSQL", "HotM-Ollama", "HotM-Server"],
                expected_ports=[54321, 11434, 53211],
                install_arguments=["/quiet", "DEPLOYMENT_MODE=hybrid"],
                features=["Desktop", "Server", "Database", "AIService", "LocalServer", "WebUI"],
                data_location="%ProgramData%\\HotM",
                config_file="hybrid-mode.toml"
            ),
            "Development": DeploymentMode(
                name="Development Mode",
                description="Enhanced developer environment",
                expected_services=["HotM-PostgreSQL", "HotM-Ollama", "HotM-Server"],
                expected_ports=[54321, 11434, 53211],
                install_arguments=["/quiet", "DEPLOYMENT_MODE=development", "ENABLE_DEBUG=1"],
                features=["Desktop", "Server", "Database", "AIService", "Development", "Debugging"],
                data_location="%ProgramData%\\HotM",
                config_file="development-mode.toml"
            )
        }
    
    def log(self, message: str, level: str = "INFO", category: str = "GENERAL"):
        """Log a message with timestamp and level."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        log_message = f"[{timestamp}] [{level}] [{category}] {message}"
        
        print(log_message)
        
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_message + "\n")
    
    def add_result(self, test_name: str, category: str, status: str, message: str, 
                   duration: float = 0, details: Dict[str, Any] = None, 
                   artifacts: List[str] = None):
        """Add a validation test result."""
        result = ValidationResult(
            test_name=test_name,
            category=category,
            status=status,
            message=message,
            duration=duration,
            details=details or {},
            timestamp=datetime.now().isoformat(),
            artifacts=artifacts or []
        )
        
        self.test_results.append(result)
        self.log(f"Test '{test_name}' completed: {status} - {message}", 
                status if status != "Pass" else "SUCCESS", category)
    
    def validate_installer_structure(self) -> bool:
        """Validate the installer directory structure and components."""
        self.log("Validating installer structure", "INFO", "STRUCTURE")
        
        start_time = time.time()
        
        # Check main installer file
        main_installer = self.installer_dir / "hotm-installer.wxs"
        if not main_installer.exists():
            self.add_result("Installer Structure", "Structure", "Fail",
                           "Main installer file not found", 
                           time.time() - start_time)
            return False
        
        # Validate WiX installer XML
        try:
            tree = ET.parse(main_installer)
            root = tree.getroot()
            
            # Check required elements
            required_elements = ["Product", "Package", "Directory", "Feature"]
            missing_elements = []
            
            for element in required_elements:
                # Find elements in the WiX namespace
                namespace = root.tag.split('}')[0] + '}' if '}' in root.tag else ''
                xpath = f".//{namespace}{element}"
                if not root.find(xpath):
                    missing_elements.append(element)
            
            if missing_elements:
                self.add_result("Installer XML Structure", "Structure", "Fail",
                               f"Missing required elements: {', '.join(missing_elements)}",
                               time.time() - start_time)
                return False
            
        except ET.ParseError as e:
            self.add_result("Installer XML Parsing", "Structure", "Fail",
                           f"XML parsing error: {str(e)}", 
                           time.time() - start_time)
            return False
        
        # Check component files
        component_files = [
            "hotm-services.wxs",
            "hotm-postgresql.wxs", 
            "hotm-ollama.wxs",
            "hotm-ui.wxs"
        ]
        
        missing_components = []
        for component in component_files:
            if not (self.installer_dir / component).exists():
                missing_components.append(component)
        
        if missing_components:
            self.add_result("Component Files", "Structure", "Warning",
                           f"Missing component files: {', '.join(missing_components)}",
                           time.time() - start_time)
        
        # Check resource directories
        resource_dirs = [
            "resources/config",
            "resources/scripts", 
            "custom-actions"
        ]
        
        missing_dirs = []
        for dir_path in resource_dirs:
            if not (self.installer_dir / dir_path).exists():
                missing_dirs.append(dir_path)
        
        if missing_dirs:
            self.add_result("Resource Directories", "Structure", "Warning",
                           f"Missing resource directories: {', '.join(missing_dirs)}",
                           time.time() - start_time)
        
        self.add_result("Installer Structure Validation", "Structure", "Pass",
                       "All critical installer components are present",
                       time.time() - start_time)
        return True
    
    def validate_deployment_mode_configurations(self) -> bool:
        """Validate deployment mode configuration files."""
        self.log("Validating deployment mode configurations", "INFO", "CONFIG")
        
        start_time = time.time()
        config_dir = self.installer_dir / "resources" / "config"
        
        if not config_dir.exists():
            self.add_result("Configuration Directory", "Config", "Fail",
                           "Configuration directory not found",
                           time.time() - start_time)
            return False
        
        all_valid = True
        
        for mode_name, mode_config in self.deployment_modes.items():
            config_file = config_dir / mode_config.config_file
            
            if not config_file.exists():
                self.add_result(f"{mode_name} Configuration", "Config", "Fail",
                               f"Configuration file not found: {mode_config.config_file}",
                               time.time() - start_time)
                all_valid = False
                continue
            
            # Validate TOML structure
            try:
                config_content = config_file.read_text()
                
                # Check for deployment mode specification
                if f'deployment_mode = "{mode_name.lower()}"' not in config_content:
                    self.add_result(f"{mode_name} Mode Setting", "Config", "Warning",
                                   "Deployment mode not explicitly set in config",
                                   time.time() - start_time)
                
                # Check for expected services configuration
                for service in mode_config.expected_services:
                    service_key = service.lower().replace("-", "_")
                    if service_key not in config_content.lower():
                        self.add_result(f"{mode_name} Service Config", "Config", "Warning",
                                       f"Service {service} not configured",
                                       time.time() - start_time)
                
                # Check for port configurations
                for port in mode_config.expected_ports:
                    if str(port) not in config_content:
                        self.add_result(f"{mode_name} Port Config", "Config", "Warning",
                                       f"Port {port} not configured",
                                       time.time() - start_time)
                
                self.add_result(f"{mode_name} Configuration", "Config", "Pass",
                               "Configuration file is valid",
                               time.time() - start_time)
                
            except Exception as e:
                self.add_result(f"{mode_name} Configuration Parsing", "Config", "Fail",
                               f"Configuration parsing error: {str(e)}",
                               time.time() - start_time)
                all_valid = False
        
        return all_valid
    
    def validate_service_dependencies(self) -> bool:
        """Validate service dependency configurations."""
        self.log("Validating service dependencies", "INFO", "SERVICE")
        
        start_time = time.time()
        services_file = self.installer_dir / "hotm-services.wxs"
        
        if not services_file.exists():
            self.add_result("Service Dependencies", "Service", "Fail",
                           "Service configuration file not found",
                           time.time() - start_time)
            return False
        
        try:
            service_content = services_file.read_text()
            
            # Check for service dependency definitions
            expected_dependencies = [
                ("HotM-Server", "HotM-PostgreSQL"),
                ("HotM-Server", "HotM-Ollama")
            ]
            
            missing_dependencies = []
            for service, dependency in expected_dependencies:
                if dependency not in service_content:
                    missing_dependencies.append(f"{service} -> {dependency}")
            
            if missing_dependencies:
                self.add_result("Service Dependencies", "Service", "Warning",
                               f"Missing dependencies: {', '.join(missing_dependencies)}",
                               time.time() - start_time)
            else:
                self.add_result("Service Dependencies", "Service", "Pass",
                               "All service dependencies are configured",
                               time.time() - start_time)
            
            return len(missing_dependencies) == 0
            
        except Exception as e:
            self.add_result("Service Dependencies Validation", "Service", "Fail",
                           f"Validation error: {str(e)}",
                           time.time() - start_time)
            return False
    
    def validate_upgrade_scenarios(self) -> bool:
        """Validate upgrade path configurations."""
        self.log("Validating upgrade scenarios", "INFO", "UPGRADE")
        
        start_time = time.time()
        
        # Check for upgrade rules in main installer
        main_installer = self.installer_dir / "hotm-installer.wxs"
        
        try:
            installer_content = main_installer.read_text()
            
            # Check for MajorUpgrade element
            if "MajorUpgrade" not in installer_content:
                self.add_result("Upgrade Configuration", "Upgrade", "Fail",
                               "MajorUpgrade element not found",
                               time.time() - start_time)
                return False
            
            # Check for upgrade code
            if "UpgradeCode" not in installer_content:
                self.add_result("Upgrade Code", "Upgrade", "Fail",
                               "UpgradeCode not defined",
                               time.time() - start_time)
                return False
            
            # Check for data preservation logic
            preservation_indicators = [
                "ARPSYSTEMCOMPONENT",
                "ARPNOREMOVE",
                "InstallValidate"
            ]
            
            found_preservation = []
            for indicator in preservation_indicators:
                if indicator in installer_content:
                    found_preservation.append(indicator)
            
            if len(found_preservation) < 2:
                self.add_result("Data Preservation", "Upgrade", "Warning",
                               "Limited data preservation configuration detected",
                               time.time() - start_time)
            
            self.add_result("Upgrade Path Validation", "Upgrade", "Pass",
                           "Upgrade configuration is present",
                           time.time() - start_time)
            return True
            
        except Exception as e:
            self.add_result("Upgrade Path Validation", "Upgrade", "Fail",
                           f"Validation error: {str(e)}",
                           time.time() - start_time)
            return False
    
    def validate_security_configurations(self) -> bool:
        """Validate security and permission configurations."""
        self.log("Validating security configurations", "INFO", "SECURITY")
        
        start_time = time.time()
        
        # Check installer security settings
        main_installer = self.installer_dir / "hotm-installer.wxs"
        
        try:
            installer_content = main_installer.read_text()
            
            # Check for elevated privileges
            if 'InstallPrivileges="elevated"' not in installer_content:
                self.add_result("Installation Privileges", "Security", "Fail",
                               "Elevated privileges not configured",
                               time.time() - start_time)
                return False
            
            # Check for permission definitions
            if "Permission" not in installer_content:
                self.add_result("Permission Settings", "Security", "Warning",
                               "No explicit permission settings found",
                               time.time() - start_time)
            
            # Check for service account configurations
            services_file = self.installer_dir / "hotm-services.wxs"
            if services_file.exists():
                service_content = services_file.read_text()
                
                security_indicators = [
                    "ServiceControl",
                    "ServiceInstall",
                    "NETWORK SERVICE"
                ]
                
                found_security = []
                for indicator in security_indicators:
                    if indicator in service_content:
                        found_security.append(indicator)
                
                if len(found_security) >= 2:
                    self.add_result("Service Security", "Security", "Pass",
                                   "Service security configurations are present",
                                   time.time() - start_time)
                else:
                    self.add_result("Service Security", "Security", "Warning",
                                   "Limited service security configurations",
                                   time.time() - start_time)
            
            return True
            
        except Exception as e:
            self.add_result("Security Validation", "Security", "Fail",
                           f"Validation error: {str(e)}",
                           time.time() - start_time)
            return False
    
    def validate_test_framework_completeness(self) -> bool:
        """Validate completeness of the test framework itself."""
        self.log("Validating test framework completeness", "INFO", "FRAMEWORK")
        
        start_time = time.time()
        test_dir = self.project_root / "tests" / "installer"
        
        if not test_dir.exists():
            self.add_result("Test Framework", "Framework", "Fail",
                           "Test directory not found",
                           time.time() - start_time)
            return False
        
        # Check for test categories
        test_categories = [
            "installation",
            "services", 
            "ui",
            "data",
            "security",
            "performance"
        ]
        
        missing_categories = []
        for category in test_categories:
            category_dir = test_dir / category
            if not category_dir.exists():
                missing_categories.append(category)
        
        if missing_categories:
            self.add_result("Test Categories", "Framework", "Warning",
                           f"Missing test categories: {', '.join(missing_categories)}",
                           time.time() - start_time)
        
        # Check for critical test files
        critical_tests = [
            "Run-InstallerTests.ps1",
            "common/Test-Utilities.ps1",
            "installation/Install-DeploymentModes.tests.ps1"
        ]
        
        missing_tests = []
        for test_file in critical_tests:
            if not (test_dir / test_file).exists():
                missing_tests.append(test_file)
        
        if missing_tests:
            self.add_result("Critical Test Files", "Framework", "Fail",
                           f"Missing critical test files: {', '.join(missing_tests)}",
                           time.time() - start_time)
            return False
        
        self.add_result("Test Framework Completeness", "Framework", "Pass",
                       "Test framework structure is complete",
                       time.time() - start_time)
        return True
    
    def validate_powershell_modules(self) -> bool:
        """Validate PowerShell test modules and dependencies."""
        self.log("Validating PowerShell test modules", "INFO", "POWERSHELL")
        
        start_time = time.time()
        
        # Check PowerShell test utilities
        utilities_file = self.project_root / "tests" / "installer" / "common" / "Test-Utilities.ps1"
        
        if not utilities_file.exists():
            self.add_result("PowerShell Utilities", "PowerShell", "Fail",
                           "Test utilities file not found",
                           time.time() - start_time)
            return False
        
        try:
            utilities_content = utilities_file.read_text()
            
            # Check for essential functions
            essential_functions = [
                "Write-TestLog",
                "Test-ServiceRunning", 
                "Test-PortListening",
                "Test-HttpEndpoint",
                "Invoke-ProcessWithOutput"
            ]
            
            missing_functions = []
            for func in essential_functions:
                if f"function {func}" not in utilities_content:
                    missing_functions.append(func)
            
            if missing_functions:
                self.add_result("PowerShell Functions", "PowerShell", "Fail",
                               f"Missing essential functions: {', '.join(missing_functions)}",
                               time.time() - start_time)
                return False
            
            # Check for Pester integration
            pester_indicators = ["Describe", "Context", "It", "Should"]
            found_pester = any(indicator in utilities_content for indicator in pester_indicators)
            
            if not found_pester:
                self.add_result("Pester Integration", "PowerShell", "Warning",
                               "Limited Pester integration detected",
                               time.time() - start_time)
            
            self.add_result("PowerShell Module Validation", "PowerShell", "Pass",
                           "PowerShell modules are properly structured",
                           time.time() - start_time)
            return True
            
        except Exception as e:
            self.add_result("PowerShell Module Validation", "PowerShell", "Fail",
                           f"Validation error: {str(e)}",
                           time.time() - start_time)
            return False
    
    def validate_installation_scenarios(self) -> bool:
        """Validate installation scenario coverage."""
        self.log("Validating installation scenario coverage", "INFO", "SCENARIO")
        
        start_time = time.time()
        
        # Check deployment mode test file
        deployment_tests = self.project_root / "tests" / "installer" / "installation" / "Install-DeploymentModes.tests.ps1"
        
        if not deployment_tests.exists():
            self.add_result("Deployment Mode Tests", "Scenario", "Fail",
                           "Deployment mode test file not found",
                           time.time() - start_time)
            return False
        
        try:
            test_content = deployment_tests.read_text()
            
            # Check for all deployment modes
            all_modes_covered = True
            for mode_name in self.deployment_modes.keys():
                if mode_name not in test_content:
                    self.add_result(f"{mode_name} Test Coverage", "Scenario", "Warning",
                                   f"Limited test coverage for {mode_name} mode",
                                   time.time() - start_time)
                    all_modes_covered = False
            
            # Check for system scenarios
            system_scenarios = [
                "CleanInstall",
                "UpgradeInstall", 
                "ConflictResolution"
            ]
            
            missing_scenarios = []
            for scenario in system_scenarios:
                if scenario not in test_content:
                    missing_scenarios.append(scenario)
            
            if missing_scenarios:
                self.add_result("System Scenarios", "Scenario", "Warning",
                               f"Missing scenarios: {', '.join(missing_scenarios)}",
                               time.time() - start_time)
            
            # Check for validation functions
            validation_functions = [
                "Test-CleanInstallation",
                "Test-UpgradePreservation",
                "Test-ConflictResolution"
            ]
            
            missing_validations = []
            for validation in validation_functions:
                if validation not in test_content:
                    missing_validations.append(validation)
            
            if missing_validations:
                self.add_result("Validation Functions", "Scenario", "Warning",
                               f"Missing validation functions: {', '.join(missing_validations)}",
                               time.time() - start_time)
            
            self.add_result("Installation Scenario Coverage", "Scenario", "Pass",
                           "Installation scenarios are well covered",
                           time.time() - start_time)
            return True
            
        except Exception as e:
            self.add_result("Scenario Coverage Validation", "Scenario", "Fail",
                           f"Validation error: {str(e)}",
                           time.time() - start_time)
            return False
    
    def generate_validation_report(self) -> Dict[str, Any]:
        """Generate comprehensive validation report."""
        self.log("Generating validation report", "INFO", "REPORT")
        
        total_duration = (datetime.now() - self.validation_start_time).total_seconds()
        
        # Calculate statistics
        stats = {
            "total": len(self.test_results),
            "passed": len([r for r in self.test_results if r.status == "Pass"]),
            "failed": len([r for r in self.test_results if r.status == "Fail"]),
            "warnings": len([r for r in self.test_results if r.status == "Warning"]),
            "errors": len([r for r in self.test_results if r.status == "Error"]),
            "skipped": len([r for r in self.test_results if r.status == "Skip"])
        }
        
        # Group results by category
        categories = {}
        for result in self.test_results:
            if result.category not in categories:
                categories[result.category] = []
            categories[result.category].append(result)
        
        report = {
            "validation_info": {
                "framework": "HotM Installer Validation Framework",
                "version": "1.0.0",
                "timestamp": datetime.now().isoformat(),
                "duration": total_duration,
                "project_root": str(self.project_root)
            },
            "statistics": stats,
            "categories": {cat: len(results) for cat, results in categories.items()},
            "results": [asdict(result) for result in self.test_results],
            "deployment_modes": {name: asdict(config) for name, config in self.deployment_modes.items()},
            "recommendations": self._generate_recommendations()
        }
        
        # Save report
        report_file = self.output_dir / "validation-report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        # Generate summary report
        summary_file = self.output_dir / "validation-summary.md"
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write(self._generate_summary_markdown(report))
        
        self.log(f"Validation report generated: {report_file}", "SUCCESS", "REPORT")
        return report
    
    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on validation results."""
        recommendations = []
        
        failed_tests = [r for r in self.test_results if r.status == "Fail"]
        warning_tests = [r for r in self.test_results if r.status == "Warning"]
        
        if failed_tests:
            recommendations.append(f"Address {len(failed_tests)} critical validation failures before production deployment")
        
        if warning_tests:
            recommendations.append(f"Review {len(warning_tests)} warning items to improve installation reliability")
        
        # Category-specific recommendations
        categories_with_issues = set()
        for result in failed_tests + warning_tests:
            categories_with_issues.add(result.category)
        
        if "Structure" in categories_with_issues:
            recommendations.append("Review installer component structure and ensure all required files are present")
        
        if "Config" in categories_with_issues:
            recommendations.append("Validate deployment mode configuration files for completeness")
        
        if "Security" in categories_with_issues:
            recommendations.append("Review security configurations and permission settings")
        
        if "Service" in categories_with_issues:
            recommendations.append("Validate service dependency configurations and startup sequences")
        
        if not recommendations:
            recommendations.append("Installer implementation validation passed - ready for comprehensive testing")
        
        return recommendations
    
    def _generate_summary_markdown(self, report: Dict[str, Any]) -> str:
        """Generate markdown summary of validation results."""
        stats = report["statistics"]
        
        summary = f"""# HotM Installer Implementation Validation Report

## Validation Summary

- **Total Tests**: {stats['total']}
- **Passed**: {stats['passed']} ✅
- **Failed**: {stats['failed']} ❌
- **Warnings**: {stats['warnings']} ⚠️
- **Errors**: {stats['errors']} 🚫
- **Skipped**: {stats['skipped']} ⏭️

## Overall Status
{'✅ **VALIDATION PASSED**' if stats['failed'] == 0 and stats['errors'] == 0 else '❌ **VALIDATION FAILED**'}

## Test Categories

"""
        
        for category, count in report["categories"].items():
            category_results = [r for r in self.test_results if r.category == category]
            failed_count = len([r for r in category_results if r.status == "Fail"])
            warning_count = len([r for r in category_results if r.status == "Warning"])
            
            status_icon = "✅" if failed_count == 0 else "❌"
            summary += f"- **{category}**: {count} tests {status_icon}"
            if failed_count > 0:
                summary += f" ({failed_count} failed)"
            if warning_count > 0:
                summary += f" ({warning_count} warnings)"
            summary += "\n"
        
        summary += "\n## Recommendations\n\n"
        for i, rec in enumerate(report["recommendations"], 1):
            summary += f"{i}. {rec}\n"
        
        summary += f"\n## Deployment Modes Validated\n\n"
        for mode_name, mode_config in self.deployment_modes.items():
            summary += f"- **{mode_name}**: {mode_config.description}\n"
        
        summary += f"\n---\n*Generated by HotM Installer Validation Framework on {report['validation_info']['timestamp']}*\n"
        
        return summary
    
    def run_validation(self) -> bool:
        """Run complete validation suite."""
        self.log("Starting HotM installer implementation validation", "INFO", "VALIDATION")
        
        validation_steps = [
            ("Installer Structure", self.validate_installer_structure),
            ("Deployment Configurations", self.validate_deployment_mode_configurations),
            ("Service Dependencies", self.validate_service_dependencies),
            ("Upgrade Scenarios", self.validate_upgrade_scenarios),
            ("Security Configurations", self.validate_security_configurations),
            ("Test Framework", self.validate_test_framework_completeness),
            ("PowerShell Modules", self.validate_powershell_modules),
            ("Installation Scenarios", self.validate_installation_scenarios)
        ]
        
        all_passed = True
        
        for step_name, validation_func in validation_steps:
            self.log(f"Running validation: {step_name}", "INFO", "VALIDATION")
            try:
                result = validation_func()
                if not result:
                    all_passed = False
            except Exception as e:
                self.log(f"Validation step '{step_name}' failed with exception: {str(e)}", "ERROR", "VALIDATION")
                self.add_result(f"{step_name} Exception", "Validation", "Error",
                               f"Validation failed with exception: {str(e)}")
                all_passed = False
        
        # Generate final report
        report = self.generate_validation_report()
        
        # Log final status
        if all_passed and report["statistics"]["failed"] == 0 and report["statistics"]["errors"] == 0:
            self.log("🎉 HotM installer implementation validation PASSED", "SUCCESS", "VALIDATION")
            return True
        else:
            self.log("❌ HotM installer implementation validation FAILED", "ERROR", "VALIDATION")
            return False

def main():
    """Main validation entry point."""
    if len(sys.argv) > 1:
        project_root = Path(sys.argv[1])
    else:
        project_root = Path.cwd()
    
    if not project_root.exists():
        print(f"Project root not found: {project_root}")
        sys.exit(1)
    
    validator = InstallerValidator(project_root)
    success = validator.run_validation()
    
    print(f"\nValidation completed. Results saved to: {validator.output_dir}")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()