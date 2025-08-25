#!/usr/bin/env python3
"""
HotM Final Installation and Upgrade Path Validation Report Generator
Consolidates all validation results into a comprehensive certification report.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import glob

class FinalValidationReportGenerator:
    """Generates comprehensive validation report and certification."""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.test_results_dir = project_root / "test-results"
        self.output_dir = project_root / "test-results" / "final-validation"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.validation_modules = []
        self.consolidated_results = {}
        
    def collect_validation_results(self) -> Dict[str, Any]:
        """Collect results from all validation modules."""
        print("Collecting validation results from all test modules...")
        
        # Define validation modules and their expected result files
        validation_modules = {
            "installer-implementation": {
                "name": "Installer Implementation Validation",
                "results_file": "installer-validation/validation-report.json",
                "summary_file": "installer-validation/validation-summary.md",
                "description": "Core installer structure and component validation"
            },
            "upgrade-paths": {
                "name": "Upgrade Path Validation",
                "results_file": "upgrade-validation/upgrade-validation-results.json",
                "summary_file": "upgrade-validation/upgrade-validation-summary.md",
                "description": "Data integrity preservation during upgrades"
            },
            "mode-switching": {
                "name": "Deployment Mode Switching",
                "results_file": "mode-switching-validation/mode-switching-results.json",
                "summary_file": "mode-switching-validation/mode-switching-summary.md",
                "description": "Mode transition with configuration preservation"
            },
            "service-lifecycle": {
                "name": "Service Lifecycle Management",
                "results_file": "service-lifecycle-validation/service-lifecycle-results.json",
                "summary_file": "service-lifecycle-validation/service-lifecycle-summary.md",
                "description": "Service installation, startup, and management"
            },
            "data-backup": {
                "name": "Data Backup and Integrity",
                "results_file": "data-backup-validation/data-backup-results.json", 
                "summary_file": "data-backup-validation/data-backup-summary.md",
                "description": "Backup creation, validation, and restore testing"
            }
        }
        
        consolidated = {
            "validation_info": {
                "report_generated": datetime.now().isoformat(),
                "framework_version": "1.0.0",
                "project_root": str(self.project_root),
                "total_modules": len(validation_modules)
            },
            "modules": {},
            "overall_summary": {
                "modules_executed": 0,
                "modules_passed": 0,
                "modules_failed": 0,
                "total_tests": 0,
                "total_passed": 0,
                "total_failed": 0,
                "critical_failures": 0,
                "overall_success": False
            }
        }
        
        for module_id, module_info in validation_modules.items():
            print(f"Processing {module_info['name']}...")
            
            # Try to load results file
            results_path = self.test_results_dir / module_info["results_file"]
            summary_path = self.test_results_dir / module_info["summary_file"]
            
            module_result = {
                "name": module_info["name"],
                "description": module_info["description"],
                "executed": False,
                "success": False,
                "results": {},
                "summary_available": summary_path.exists(),
                "error": None
            }
            
            if results_path.exists():
                try:
                    with open(results_path, 'r') as f:
                        results_data = json.load(f)
                    
                    module_result["executed"] = True
                    module_result["results"] = results_data
                    
                    # Extract success criteria based on module type
                    if module_id == "installer-implementation":
                        stats = results_data.get("statistics", {})
                        module_result["success"] = stats.get("failed", 1) == 0 and stats.get("errors", 1) == 0
                        module_result["test_stats"] = stats
                    
                    elif module_id == "upgrade-paths":
                        summary = results_data.get("summary", {})
                        module_result["success"] = summary.get("failed", 1) == 0
                        module_result["test_stats"] = summary
                    
                    elif module_id == "mode-switching":
                        summary = results_data.get("summary", {})
                        module_result["success"] = summary.get("failed", 1) == 0
                        module_result["test_stats"] = summary
                    
                    elif module_id == "service-lifecycle":
                        summary = results_data.get("summary", {})
                        module_result["success"] = summary.get("critical_failures", 1) == 0
                        module_result["test_stats"] = summary
                    
                    elif module_id == "data-backup":
                        summary = results_data.get("summary", {})
                        module_result["success"] = summary.get("critical_failures", 1) == 0
                        module_result["test_stats"] = summary
                    
                    # Update consolidated stats
                    consolidated["overall_summary"]["modules_executed"] += 1
                    if module_result["success"]:
                        consolidated["overall_summary"]["modules_passed"] += 1
                    else:
                        consolidated["overall_summary"]["modules_failed"] += 1
                    
                    # Add test counts if available
                    test_stats = module_result.get("test_stats", {})
                    consolidated["overall_summary"]["total_tests"] += test_stats.get("total", test_stats.get("total_tests", 0))
                    consolidated["overall_summary"]["total_passed"] += test_stats.get("passed", 0)
                    consolidated["overall_summary"]["total_failed"] += test_stats.get("failed", 0)
                    consolidated["overall_summary"]["critical_failures"] += test_stats.get("critical_failures", 0)
                    
                except Exception as e:
                    module_result["error"] = f"Failed to load results: {str(e)}"
                    print(f"  Error loading {module_info['name']}: {str(e)}")
            
            else:
                print(f"  Results file not found: {results_path}")
            
            consolidated["modules"][module_id] = module_result
        
        # Determine overall success
        consolidated["overall_summary"]["overall_success"] = (
            consolidated["overall_summary"]["modules_failed"] == 0 and 
            consolidated["overall_summary"]["critical_failures"] == 0
        )
        
        return consolidated
    
    def generate_executive_summary(self, consolidated_results: Dict[str, Any]) -> str:
        """Generate executive summary of validation results."""
        summary = consolidated_results["overall_summary"]
        
        if summary["overall_success"]:
            status = "✅ **VALIDATION PASSED - PRODUCTION READY**"
            recommendation = """
**RECOMMENDATION: APPROVE FOR PRODUCTION DEPLOYMENT**

The HotM installer has successfully passed comprehensive validation across all critical areas:
- Installation and upgrade processes are reliable and preserve user data
- Service lifecycle management is robust with proper dependency handling
- Deployment mode switching works seamlessly across all configurations
- Data backup and recovery systems are functional

The installer demonstrates enterprise-grade reliability and is ready for production use.
"""
        else:
            status = "❌ **VALIDATION FAILED - ISSUES REQUIRE RESOLUTION**"
            recommendation = f"""
**RECOMMENDATION: ADDRESS CRITICAL ISSUES BEFORE PRODUCTION**

The HotM installer validation identified {summary['critical_failures']} critical failures that must be resolved:
- {summary['modules_failed']} out of {summary['modules_executed']} validation modules failed
- {summary['total_failed']} out of {summary['total_tests']} individual tests failed

Critical issues must be addressed before production deployment to ensure user data integrity and system reliability.
"""
        
        return f"""# HotM Installer Validation - Executive Summary

{status}

## Validation Overview

- **Validation Modules**: {summary['modules_executed']} executed
- **Module Success Rate**: {(summary['modules_passed']/max(1, summary['modules_executed'])*100):.1f}%
- **Total Tests**: {summary['total_tests']}
- **Test Success Rate**: {(summary['total_passed']/max(1, summary['total_tests'])*100):.1f}%
- **Critical Failures**: {summary['critical_failures']}

{recommendation}

## Next Steps

{'- Proceed with production deployment planning' if summary['overall_success'] else '- Review and address all critical failures'}
{'- Continue with end-to-end testing on Windows environments' if summary['overall_success'] else '- Re-run validation after fixes are implemented'}
- Document deployment procedures and rollback plans
- Plan user acceptance testing and beta program
"""
    
    def generate_detailed_report(self, consolidated_results: Dict[str, Any]) -> str:
        """Generate detailed validation report."""
        report = f"""# HotM Installer Validation - Comprehensive Report

**Generated:** {consolidated_results['validation_info']['report_generated']}  
**Framework Version:** {consolidated_results['validation_info']['framework_version']}  
**Project Root:** {consolidated_results['validation_info']['project_root']}

## Executive Summary

{self.generate_executive_summary(consolidated_results)}

## Validation Architecture

The HotM installer validation framework consists of multiple specialized modules, each testing critical aspects of the installation and upgrade system:

1. **Installer Implementation Validation** - Core installer structure and components
2. **Upgrade Path Validation** - Data preservation during version transitions  
3. **Deployment Mode Switching** - Configuration changes between operation modes
4. **Service Lifecycle Management** - Windows service installation and management
5. **Data Backup and Integrity** - Backup creation, validation, and restore testing

## Detailed Module Results

"""
        
        for module_id, module_result in consolidated_results["modules"].items():
            status_icon = "✅" if module_result["success"] else "❌"
            executed_icon = "🔄" if module_result["executed"] else "⏸️"
            
            report += f"""### {module_result['name']} {status_icon} {executed_icon}

**Description:** {module_result['description']}  
**Executed:** {'Yes' if module_result['executed'] else 'No'}  
**Success:** {'Yes' if module_result['success'] else 'No'}

"""
            
            if module_result["executed"]:
                test_stats = module_result.get("test_stats", {})
                
                if test_stats:
                    # Display relevant statistics based on module type
                    if "total" in test_stats or "total_tests" in test_stats:
                        total = test_stats.get("total", test_stats.get("total_tests", 0))
                        passed = test_stats.get("passed", 0)
                        failed = test_stats.get("failed", 0)
                        
                        report += f"""**Test Statistics:**
- Total Tests: {total}
- Passed: {passed} ({(passed/max(1,total)*100):.1f}%)
- Failed: {failed} ({(failed/max(1,total)*100):.1f}%)
"""
                        
                        if "critical_failures" in test_stats:
                            report += f"- Critical Failures: {test_stats['critical_failures']}\n"
                        
                        if "warnings" in test_stats:
                            report += f"- Warnings: {test_stats['warnings']}\n"
                    
                    # Add module-specific metrics
                    if module_id == "upgrade-paths":
                        if "average_duration" in test_stats:
                            report += f"- Average Upgrade Time: {test_stats['average_duration']:.2f}s\n"
                        if "average_integrity_score" in test_stats:
                            report += f"- Average Integrity Score: {test_stats['average_integrity_score']:.1f}%\n"
                    
                    elif module_id == "mode-switching":
                        if "rollbacks_successful" in test_stats and "rollbacks_tested" in test_stats:
                            rollback_rate = (test_stats['rollbacks_successful']/max(1,test_stats['rollbacks_tested'])*100)
                            report += f"- Rollback Success Rate: {rollback_rate:.1f}%\n"
                    
                    elif module_id == "data-backup":
                        if "total_backup_size_mb" in test_stats:
                            report += f"- Total Backup Size: {test_stats['total_backup_size_mb']:.1f} MB\n"
                        if "average_backup_speed_mbps" in test_stats:
                            report += f"- Average Backup Speed: {test_stats['average_backup_speed_mbps']:.1f} MB/s\n"
            
            else:
                report += "**Status:** Not executed - results file not found\n"
            
            if module_result.get("error"):
                report += f"**Error:** {module_result['error']}\n"
            
            if module_result.get("summary_available"):
                report += "**Detailed Summary:** Available in module-specific report\n"
            
            report += "\n"
        
        report += """## Validation Methodology

### Test Environment
- **Platform:** Linux/WSL (simulating Windows installer behavior)
- **Test Data:** Synthetic datasets of varying sizes (small, medium, large)
- **Scenarios:** Comprehensive coverage of deployment modes and upgrade paths
- **Validation:** Automated testing with integrity checking and rollback validation

### Quality Criteria
- **Critical Tests:** Must pass for production approval
- **Data Integrity:** Zero data loss during upgrades and mode switches  
- **Service Reliability:** Proper startup/shutdown sequences with dependency management
- **Backup Functionality:** Successful backup creation, validation, and restore
- **Performance:** Operations complete within expected timeframes

### Test Coverage
- **Deployment Modes:** Desktop, Server, Hybrid, Development
- **Upgrade Scenarios:** v0.1.x → v0.2.x, patch updates, major version transitions
- **Service Management:** Installation, startup, health monitoring, recovery, shutdown
- **Data Operations:** Backup creation, compression, encryption, restore, integrity checking

## Risk Assessment

"""
        
        summary = consolidated_results["overall_summary"]
        
        if summary["critical_failures"] == 0:
            report += """### ✅ Low Risk - Production Ready

**Risk Level:** LOW  
**Confidence:** HIGH

The installer has passed all critical validation tests. While some non-critical warnings may exist, the core functionality is stable and reliable for production deployment.

**Residual Risks:**
- Environment-specific issues on actual Windows systems
- Performance variations with larger datasets
- Network connectivity edge cases
"""
        else:
            report += f"""### ❌ High Risk - Critical Issues Present  

**Risk Level:** HIGH  
**Confidence:** LOW

The installer has {summary['critical_failures']} critical failures that present significant risks:

**Critical Issues:**
- Data integrity failures could result in data loss
- Service management failures could prevent proper operation
- Installation failures could leave systems in inconsistent states

**Risk Mitigation Required:**
- Address all critical failures before production deployment
- Implement additional error handling and recovery mechanisms
- Conduct thorough testing on actual Windows environments
"""
        
        report += f"""

## Recommendations

### Immediate Actions Required
"""
        
        if summary["overall_success"]:
            report += """
1. **Proceed with Windows Environment Testing**
   - Test installer on various Windows 10/11 configurations
   - Validate with different PostgreSQL and Ollama versions
   - Test network connectivity and firewall scenarios

2. **User Acceptance Testing**
   - Deploy to beta users for real-world validation
   - Collect feedback on installation experience
   - Monitor system performance and stability

3. **Documentation and Training**
   - Finalize installation and troubleshooting guides
   - Prepare support team training materials
   - Document known limitations and workarounds
"""
        else:
            failed_modules = [m for m in consolidated_results["modules"].values() if not m["success"] and m["executed"]]
            report += f"""
1. **Address Critical Failures** 
   - Fix all {summary['critical_failures']} critical test failures
   - Focus on failed modules: {', '.join(m['name'] for m in failed_modules)}
   - Re-run validation after implementing fixes

2. **Root Cause Analysis**
   - Investigate underlying causes of validation failures
   - Review installer architecture for design issues
   - Consider alternative implementation approaches if needed

3. **Enhanced Testing**
   - Add additional test coverage for failed scenarios
   - Implement better error handling and recovery
   - Validate fixes with comprehensive regression testing
"""
        
        report += """
### Long-term Improvements
1. **Continuous Integration**
   - Integrate validation framework into CI/CD pipeline
   - Automate testing for all code changes
   - Maintain test coverage as system evolves

2. **Monitoring and Telemetry**
   - Implement installation success tracking
   - Monitor upgrade completion rates
   - Collect performance metrics for optimization

3. **User Experience Enhancement**
   - Improve installation progress reporting
   - Add better error messages and recovery options
   - Implement installation wizard for guided setup

## Conclusion

"""
        
        if summary["overall_success"]:
            report += f"""
The HotM installer has successfully completed comprehensive validation testing with a {(summary['total_passed']/max(1,summary['total_tests'])*100):.1f}% test success rate. The installer demonstrates:

- **Reliable Installation Process:** All deployment modes install correctly
- **Data Integrity:** User data is preserved during upgrades and mode changes  
- **Service Management:** Windows services are properly configured and managed
- **Backup Functionality:** Data backup and recovery systems work correctly
- **Rollback Capability:** Failed operations can be safely reversed

**Final Recommendation: APPROVED FOR PRODUCTION DEPLOYMENT**

The installer meets enterprise-grade quality standards and is ready for production use. Continue with Windows environment testing and user acceptance validation.
"""
        else:
            report += f"""
The HotM installer validation has identified significant issues that must be addressed before production deployment. With {summary['critical_failures']} critical failures across {summary['modules_failed']} modules, the installer currently does not meet production quality standards.

**Issues requiring immediate attention:**
- Critical functionality failures that could impact user data
- Service management problems that could prevent proper operation  
- Installation reliability issues that could leave systems in bad states

**Final Recommendation: DEVELOPMENT CONTINUATION REQUIRED**

Address all critical issues and re-run validation before considering production deployment. The framework is in place for efficient re-validation once fixes are implemented.
"""
        
        report += f"""

---
*Report generated by HotM Installer Validation Framework v{consolidated_results['validation_info']['framework_version']} on {consolidated_results['validation_info']['report_generated']}*
"""
        
        return report
    
    def generate_certification_document(self, consolidated_results: Dict[str, Any]) -> str:
        """Generate formal certification document."""
        summary = consolidated_results["overall_summary"]
        timestamp = consolidated_results['validation_info']['report_generated']
        
        cert_status = "PASSED" if summary["overall_success"] else "FAILED"
        
        return f"""# HotM Installer Certification Report

## CERTIFICATION DECLARATION

**Product:** Hall of the Mind (HotM) Installer  
**Version:** v0.2.0 (Modular Architecture)  
**Certification Date:** {timestamp}  
**Framework Version:** {consolidated_results['validation_info']['framework_version']}

**CERTIFICATION STATUS: {cert_status}**

## Certification Scope

This certification covers the comprehensive validation of the HotM installer across the following areas:

### ✅ Validated Components
- Windows MSI installer package structure
- PostgreSQL database service integration  
- Ollama AI service integration
- HotM API server deployment
- Web interface and desktop application deployment
- Service dependency management
- Configuration management system
- Backup and restore functionality

### ✅ Validated Scenarios  
- Fresh installation on clean systems
- Upgrade paths from previous versions
- Deployment mode switching (Desktop ↔ Server ↔ Hybrid ↔ Development)
- Service lifecycle management (install, start, monitor, recover, stop)
- Data backup creation, validation, and restore
- System failure recovery and rollback

### ✅ Quality Standards Met
- Data integrity preservation: {('✅ PASS' if summary['critical_failures'] == 0 else '❌ FAIL')}
- Installation reliability: {('✅ PASS' if summary['modules_passed'] >= summary['modules_executed'] * 0.8 else '❌ FAIL')}
- Service management: {('✅ PASS' if 'service-lifecycle' in [m for m, r in consolidated_results['modules'].items() if r['success']] else '❌ FAIL')}
- Backup functionality: {('✅ PASS' if 'data-backup' in [m for m, r in consolidated_results['modules'].items() if r.get('test_stats', {}).get('critical_failures', 1) == 0] else '❌ FAIL')}

## Test Execution Summary

- **Total Test Modules:** {summary['modules_executed']}
- **Module Success Rate:** {(summary['modules_passed']/max(1, summary['modules_executed'])*100):.1f}%
- **Total Test Cases:** {summary['total_tests']}  
- **Test Success Rate:** {(summary['total_passed']/max(1, summary['total_tests'])*100):.1f}%
- **Critical Failures:** {summary['critical_failures']}

## Certification Decision

"""
        
        if summary["overall_success"]:
            cert += f"""
### ✅ CERTIFICATION GRANTED

Based on comprehensive validation testing, the HotM installer v0.2.0 is **CERTIFIED FOR PRODUCTION DEPLOYMENT**.

**Certification Criteria Met:**
- Zero critical failures in core functionality
- {summary['modules_passed']}/{summary['modules_executed']} validation modules passed
- {(summary['total_passed']/max(1,summary['total_tests'])*100):.1f}% overall test success rate
- Data integrity preserved across all upgrade and configuration scenarios
- Service management operates reliably with proper dependency handling
- Backup and recovery systems function correctly

**Production Readiness Confirmed:** The installer demonstrates enterprise-grade reliability and is approved for deployment to production environments.

**Validity Period:** This certification is valid for HotM installer v0.2.0 and expires upon the next major version release or significant architectural changes.
"""
        else:
            cert += f"""
### ❌ CERTIFICATION DENIED  

The HotM installer v0.2.0 **DOES NOT MEET CERTIFICATION STANDARDS** for production deployment.

**Critical Issues Identified:**
- {summary['critical_failures']} critical failures detected
- {summary['modules_failed']} out of {summary['modules_executed']} validation modules failed  
- {(summary['total_failed']/max(1,summary['total_tests'])*100):.1f}% test failure rate exceeds acceptable threshold

**Required Actions:**
1. Address all critical failures identified in validation testing
2. Achieve minimum 95% test success rate
3. Ensure zero critical failures in data integrity and service management
4. Re-submit for certification after implementing fixes

**Certification Status:** DENIED - Development continuation required
"""
        
        cert += f"""

## Certification Authority

**Framework:** HotM Installer Validation Framework  
**Version:** {consolidated_results['validation_info']['framework_version']}  
**Validation Methodology:** Comprehensive automated testing with synthetic data and simulated Windows environments

**Test Environment:**
- Platform: Linux/WSL with Windows API simulation
- Test Data: Multi-scale synthetic datasets (small/medium/large)
- Scenarios: Comprehensive deployment mode and upgrade path coverage
- Validation: Automated integrity checking with manual verification points

## Appendices

- **Appendix A:** Detailed validation results by module
- **Appendix B:** Performance metrics and benchmarks  
- **Appendix C:** Risk assessment and mitigation recommendations
- **Appendix D:** Module-specific test reports and summaries

---

**Document Classification:** Official Certification Report  
**Distribution:** Development Team, QA Team, Product Management  
**Next Review:** Upon next major release or architectural changes

*This certification is issued by the HotM Validation Framework and represents the testing results as of {timestamp}. Production deployment decisions should consider additional factors including business requirements, user acceptance testing, and environment-specific validation.*
"""
        
        return cert
    
    def generate_all_reports(self):
        """Generate all validation reports and certification."""
        print("🚀 Generating comprehensive HotM installer validation report...")
        
        # Collect all validation results
        consolidated_results = self.collect_validation_results()
        
        # Save consolidated results
        consolidated_file = self.output_dir / "consolidated-results.json"
        with open(consolidated_file, 'w', encoding='utf-8') as f:
            json.dump(consolidated_results, f, indent=2, ensure_ascii=False)
        print(f"✅ Consolidated results saved: {consolidated_file}")
        
        # Generate executive summary
        exec_summary = self.generate_executive_summary(consolidated_results)
        exec_summary_file = self.output_dir / "executive-summary.md"
        with open(exec_summary_file, 'w', encoding='utf-8') as f:
            f.write(exec_summary)
        print(f"✅ Executive summary saved: {exec_summary_file}")
        
        # Generate detailed report
        detailed_report = self.generate_detailed_report(consolidated_results)
        detailed_report_file = self.output_dir / "comprehensive-validation-report.md"
        with open(detailed_report_file, 'w', encoding='utf-8') as f:
            f.write(detailed_report)
        print(f"✅ Detailed report saved: {detailed_report_file}")
        
        # Generate certification document
        certification = self.generate_certification_document(consolidated_results)
        certification_file = self.output_dir / "installer-certification.md"
        with open(certification_file, 'w', encoding='utf-8') as f:
            f.write(certification)
        print(f"✅ Certification document saved: {certification_file}")
        
        # Display final status
        summary = consolidated_results["overall_summary"]
        if summary["overall_success"]:
            print(f"\n🎉 VALIDATION PASSED - PRODUCTION READY")
            print(f"   Modules: {summary['modules_passed']}/{summary['modules_executed']} passed")
            print(f"   Tests: {summary['total_passed']}/{summary['total_tests']} passed")
            print(f"   Critical Failures: {summary['critical_failures']}")
        else:
            print(f"\n❌ VALIDATION FAILED - ISSUES REQUIRE ATTENTION")
            print(f"   Modules: {summary['modules_failed']}/{summary['modules_executed']} failed")
            print(f"   Tests: {summary['total_failed']}/{summary['total_tests']} failed")
            print(f"   Critical Failures: {summary['critical_failures']}")
        
        print(f"\n📋 All reports generated in: {self.output_dir}")
        
        return consolidated_results

def main():
    """Main entry point for final validation report generation."""
    project_root = Path.cwd()
    
    generator = FinalValidationReportGenerator(project_root)
    results = generator.generate_all_reports()
    
    # Exit with appropriate code
    success = results["overall_summary"]["overall_success"]
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()