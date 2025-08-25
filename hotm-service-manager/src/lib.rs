//! HotM Service Manager Library
//! 
//! This library provides the core functionality for Windows service management
//! and can be used both as a standalone binary and as a library for integration.

pub mod service;
pub mod monitor;
pub mod config;
pub mod recovery;
pub mod registry;

// Re-export main types for external use
pub use service::{ServiceManager, ServiceStatus, ServiceState};
pub use config::{ServiceConfiguration, ServiceDefinition, MonitoringConfiguration, RecoveryConfiguration};
pub use monitor::{ServiceMonitor, HealthResult, HealthCheckType};
pub use recovery::{RecoveryManager, RecoveryAction, RecoveryAttempt};
pub use registry::{RegistryManager, RegistryServiceConfig};

#[cfg(test)]
mod integration_tests {
    use super::*;
    use std::collections::HashMap;
    use tokio_test;
    
    fn create_test_config() -> ServiceConfiguration {
        let mut services = HashMap::new();
        
        services.insert("Test-Service".to_string(), ServiceDefinition {
            name: "Test-Service".to_string(),
            display_name: "Test Service".to_string(),
            description: "A test service for integration testing".to_string(),
            executable_path: "test.exe".to_string(),
            arguments: vec!["--test".to_string()],
            working_directory: Some("C:\\test".to_string()),
            dependencies: vec![],
            startup_type: "Manual".to_string(),
            account: "NetworkService".to_string(),
            priority: 1,
            ports: vec![8080],
            environment: HashMap::new(),
            health_checks: vec!["tcp".to_string()],
        });
        
        ServiceConfiguration {
            services,
            monitoring: MonitoringConfiguration::default(),
            recovery: RecoveryConfiguration::default(),
            logging: config::LoggingConfiguration::default(),
        }
    }
    
    #[tokio::test]
    async fn test_service_manager_creation() {
        let config = create_test_config();
        let manager = ServiceManager::new(config).await;
        
        assert!(manager.is_ok(), "Service manager should be created successfully");
    }
    
    #[tokio::test]
    async fn test_service_configuration_validation() {
        let config = create_test_config();
        let validation_result = config.validate();
        
        assert!(validation_result.is_ok(), "Test configuration should be valid");
    }
    
    #[tokio::test]
    async fn test_health_monitor_creation() {
        let config = MonitoringConfiguration::default();
        let monitor = ServiceMonitor::new(&config);
        
        assert!(monitor.is_ok(), "Service monitor should be created successfully");
    }
    
    #[tokio::test]
    async fn test_recovery_manager_creation() {
        let config = RecoveryConfiguration::default();
        let recovery_manager = RecoveryManager::new(&config);
        
        assert!(recovery_manager.is_ok(), "Recovery manager should be created successfully");
    }
    
    #[tokio::test]
    async fn test_registry_manager_creation() {
        let registry_manager = RegistryManager::new();
        
        assert!(registry_manager.is_ok(), "Registry manager should be created successfully");
    }
    
    #[cfg(windows)]
    #[tokio::test]
    async fn test_service_dependency_order() {
        let mut config = create_test_config();
        
        // Add services with dependencies
        config.services.insert("Service-A".to_string(), ServiceDefinition {
            name: "Service-A".to_string(),
            display_name: "Service A".to_string(),
            description: "First service".to_string(),
            executable_path: "a.exe".to_string(),
            arguments: vec![],
            working_directory: None,
            dependencies: vec![],
            startup_type: "Automatic".to_string(),
            account: "NetworkService".to_string(),
            priority: 1,
            ports: vec![],
            environment: HashMap::new(),
            health_checks: vec![],
        });
        
        config.services.insert("Service-B".to_string(), ServiceDefinition {
            name: "Service-B".to_string(),
            display_name: "Service B".to_string(),
            description: "Second service".to_string(),
            executable_path: "b.exe".to_string(),
            arguments: vec![],
            working_directory: None,
            dependencies: vec!["Service-A".to_string()],
            startup_type: "Automatic".to_string(),
            account: "NetworkService".to_string(),
            priority: 2,
            ports: vec![],
            environment: HashMap::new(),
            health_checks: vec![],
        });
        
        let manager = ServiceManager::new(config).await.unwrap();
        
        // Test that dependency order is calculated correctly
        // This is a simplified test - full implementation would test actual dependency resolution
        assert!(manager.services.contains_key("Service-A"));
        assert!(manager.services.contains_key("Service-B"));
    }
}