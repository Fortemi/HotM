# HotM Installer Testing Framework

Comprehensive testing framework for validating the Windows installer and service management system across all deployment scenarios.

## Test Structure

### Core Test Categories

1. **Installation Scenario Testing** (`installation/`)
   - Deployment mode testing (Desktop, Server, Hybrid, Development)
   - System configuration testing (Clean, Upgrade, Conflict Resolution)
   - Installation validation and verification

2. **Service Integration Testing** (`services/`)
   - Service lifecycle management
   - Dependency handling and startup sequencing
   - Health monitoring and auto-recovery
   - Configuration management

3. **UI and User Experience Testing** (`ui/`)
   - Service Manager Dashboard testing
   - Configuration interface validation
   - Real-time updates and WebSocket communication
   - Error handling and user feedback

4. **Data Integrity and Migration Testing** (`data/`)
   - Database schema migrations
   - Data preservation during upgrades
   - Backup and recovery operations
   - AI model management

5. **Security and Compliance Testing** (`security/`)
   - Service account and permission validation
   - Authentication and authorization testing
   - Network security and firewall rules
   - Credential management and secure storage

6. **Performance and Scalability Testing** (`performance/`)
   - Installation performance benchmarking
   - Runtime performance monitoring
   - Resource usage validation
   - Concurrent operation testing

## Test Execution

### Quick Start
```powershell
# Run comprehensive installer tests
.\Run-InstallerTests.ps1 -TestSuite All

# Run specific test category
.\Run-InstallerTests.ps1 -TestSuite Installation

# Run performance benchmarks
.\Run-InstallerTests.ps1 -TestSuite Performance -Benchmark
```

### Automated Testing
```powershell
# Continuous integration tests
.\CI\Run-CITests.ps1

# Performance regression testing
.\Performance\Run-RegressionTests.ps1

# Security compliance validation
.\Security\Run-ComplianceTests.ps1
```

## Test Reporting

- **HTML Reports**: Comprehensive test results with visual dashboard
- **JSON Reports**: Machine-readable results for automation
- **Performance Metrics**: Benchmarking data and trend analysis
- **Security Compliance**: Detailed security validation reports

## Test Environment Requirements

- Windows 10/11 with Administrator privileges
- PowerShell 5.1 or higher
- Pester testing framework
- Virtual machine support for clean install testing
- Network isolation capabilities for security testing

## Quality Gates

- **100% Installation Success** across all supported deployment modes
- **Zero Data Loss** during installation, upgrade, and migration scenarios
- **99.9%+ Service Reliability** under normal operating conditions
- **Performance Standards** meeting or exceeding defined benchmarks
- **Security Compliance** with all security requirements validated
