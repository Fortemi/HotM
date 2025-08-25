# HotM Windows Service Integration Testing Strategy

## Overview

This document defines a comprehensive testing strategy for HotM Windows service integration, covering unit tests, integration tests, end-to-end scenarios, performance testing, security validation, and automated continuous integration workflows to ensure reliable service deployment and operation.

## Testing Architecture and Scope

### Testing Pyramid for Service Integration

```mermaid
graph TB
    subgraph "Service Integration Testing Pyramid"
        E2E[End-to-End Tests<br/>- Full system scenarios<br/>- User acceptance<br/>- Deployment validation]
        
        INTEGRATION[Integration Tests<br/>- Service-to-service communication<br/>- Database connectivity<br/>- API endpoint testing<br/>- Configuration validation]
        
        UNIT[Unit Tests<br/>- Service lifecycle<br/>- Configuration parsing<br/>- Error handling<br/>- Security components]
        
        STATIC[Static Analysis<br/>- Code quality<br/>- Security scanning<br/>- Dependency analysis]
    end
    
    UNIT --> INTEGRATION
    INTEGRATION --> E2E
    STATIC --> UNIT
    
    style E2E fill:#f44336
    style INTEGRATION fill:#ff9800
    style UNIT fill:#4caf50
    style STATIC fill:#2196f3
```

### Test Categories and Coverage Targets

| Test Category | Coverage Target | Execution Time | Environment |
|---------------|----------------|----------------|-------------|
| Static Analysis | 100% code coverage | < 2 minutes | CI Pipeline |
| Unit Tests | 85% code coverage | < 5 minutes | Local/CI |
| Integration Tests | 70% scenario coverage | < 15 minutes | Test Environment |
| End-to-End Tests | 90% user journeys | < 30 minutes | Staging Environment |
| Performance Tests | Key scenarios | < 60 minutes | Performance Environment |
| Security Tests | Critical paths | < 45 minutes | Security Environment |

## Unit Testing Strategy

### Service Lifecycle Unit Tests

```rust
// tests/unit/service_lifecycle_tests.rs
use hotm_service_manager::{
    services::{PostgreSQLService, OllamaService, HotMRuntimeService},
    ManagedService, ServiceStatus, HealthStatus
};
use tokio_test;
use std::time::Duration;

#[tokio::test]
async fn test_postgresql_service_startup() {
    let mut config = PostgreSQLConfig::test_default();
    config.port = 55432; // Use non-standard port for testing
    config.data_dir = temp_dir().join("postgres_test").to_string_lossy().to_string();
    
    let mut service = PostgreSQLService::new(config).unwrap();
    
    // Test startup
    let start_result = tokio::time::timeout(
        Duration::from_secs(30),
        service.start()
    ).await;
    
    assert!(start_result.is_ok(), "PostgreSQL service should start within 30 seconds");
    assert!(start_result.unwrap().is_ok(), "PostgreSQL startup should succeed");
    
    // Test health check
    let health = service.health_check().await;
    assert!(matches!(health, HealthStatus::Healthy), "Service should be healthy after startup");
    
    // Test status
    let status = service.get_status().await;
    assert!(matches!(status, ServiceStatus::Running), "Service should be running");
    
    // Test cleanup
    let stop_result = service.stop().await;
    assert!(stop_result.is_ok(), "Service should stop cleanly");
    
    let final_status = service.get_status().await;
    assert!(matches!(final_status, ServiceStatus::Stopped), "Service should be stopped");
}

#[tokio::test]
async fn test_ollama_service_startup() {
    let mut config = OllamaConfig::test_default();
    config.port = 11436; // Use non-standard port for testing
    config.model_dir = temp_dir().join("ollama_test").to_string_lossy().to_string();
    config.gpu_acceleration = false; // Disable GPU for CI testing
    
    let mut service = OllamaService::new(config).unwrap();
    
    // Test startup
    let start_result = tokio::time::timeout(
        Duration::from_secs(60), // Longer timeout for model loading
        service.start()
    ).await;
    
    assert!(start_result.is_ok(), "Ollama service should start within 60 seconds");
    
    // Test health check
    let health = service.health_check().await;
    assert!(matches!(health, HealthStatus::Healthy | HealthStatus::Degraded), 
           "Service should be healthy or degraded (no models) after startup");
    
    // Test stop
    let stop_result = service.stop().await;
    assert!(stop_result.is_ok(), "Service should stop cleanly");
}

#[tokio::test]
async fn test_service_startup_failure_handling() {
    let mut config = PostgreSQLConfig::test_default();
    config.postgres_bin = "nonexistent_binary".to_string(); // Invalid binary path
    
    let mut service = PostgreSQLService::new(config).unwrap();
    
    // Test that startup fails gracefully
    let start_result = service.start().await;
    assert!(start_result.is_err(), "Service should fail to start with invalid binary");
    
    let status = service.get_status().await;
    assert!(matches!(status, ServiceStatus::Error | ServiceStatus::Stopped), 
           "Service should be in error or stopped state");
}

#[tokio::test]
async fn test_service_dependency_order() {
    let postgres_config = PostgreSQLConfig::test_default();
    let ollama_config = OllamaConfig::test_default(); 
    let runtime_config = HotMRuntimeConfig::test_default();
    
    let mut postgres = PostgreSQLService::new(postgres_config).unwrap();
    let mut ollama = OllamaService::new(ollama_config).unwrap();
    let mut runtime = HotMRuntimeService::new(runtime_config).unwrap();
    
    // Start services in dependency order
    postgres.start().await.expect("PostgreSQL should start");
    
    // Wait for PostgreSQL to be ready
    wait_for_service_ready(&postgres, Duration::from_secs(30)).await
        .expect("PostgreSQL should become ready");
    
    ollama.start().await.expect("Ollama should start");
    
    // Wait for Ollama to be ready
    wait_for_service_ready(&ollama, Duration::from_secs(60)).await
        .expect("Ollama should become ready");
    
    runtime.start().await.expect("Runtime should start");
    
    // Verify all services are running
    assert!(matches!(postgres.get_status().await, ServiceStatus::Running));
    assert!(matches!(ollama.get_status().await, ServiceStatus::Running));
    assert!(matches!(runtime.get_status().await, ServiceStatus::Running));
    
    // Cleanup in reverse order
    runtime.stop().await.unwrap();
    ollama.stop().await.unwrap();
    postgres.stop().await.unwrap();
}

async fn wait_for_service_ready<S: ManagedService>(
    service: &S, 
    timeout: Duration
) -> Result<(), TestError> {
    let start_time = std::time::Instant::now();
    
    while start_time.elapsed() < timeout {
        match service.health_check().await {
            HealthStatus::Healthy => return Ok(()),
            HealthStatus::Degraded => return Ok(()), // Accept degraded for some services
            _ => {
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
        }
    }
    
    Err(TestError::Timeout("Service did not become ready in time".to_string()))
}
```

### Configuration Testing

```rust
// tests/unit/configuration_tests.rs
use hotm_service_manager::config::{ConfigurationManager, ValidationError};
use tempfile::TempDir;

#[tokio::test]
async fn test_configuration_validation() {
    let temp_dir = TempDir::new().unwrap();
    let config_manager = ConfigurationManager::new(temp_dir.path()).unwrap();
    
    // Test valid configuration
    let valid_config = r#"
        [runtime]
        mode = "server"
        log_level = "info"
        
        [database]
        port = 54321
        host = "localhost"
        
        [ai]
        port = 11435
    "#;
    
    let validation_result = config_manager.validate_toml_content(valid_config).await;
    assert!(validation_result.is_ok(), "Valid configuration should pass validation");
    
    // Test invalid configuration
    let invalid_config = r#"
        [runtime]
        mode = "invalid_mode"  # Invalid mode
        log_level = "debug"
        
        [database]
        port = 99999  # Port out of range
    "#;
    
    let validation_result = config_manager.validate_toml_content(invalid_config).await;
    assert!(validation_result.is_err(), "Invalid configuration should fail validation");
    
    let errors = validation_result.unwrap_err();
    assert!(errors.iter().any(|e| e.message.contains("invalid_mode")));
    assert!(errors.iter().any(|e| e.message.contains("port") && e.message.contains("range")));
}

#[tokio::test]
async fn test_configuration_hot_reload() {
    let temp_dir = TempDir::new().unwrap();
    let config_file = temp_dir.path().join("runtime.toml");
    
    let initial_config = r#"
        [runtime]
        log_level = "info"
        worker_count = 4
    "#;
    
    tokio::fs::write(&config_file, initial_config).await.unwrap();
    
    let mut config_manager = ConfigurationManager::new(temp_dir.path()).unwrap();
    config_manager.load_configuration().await.unwrap();
    
    assert_eq!(config_manager.get_log_level(), "info");
    assert_eq!(config_manager.get_worker_count(), 4);
    
    // Update configuration
    let updated_config = r#"
        [runtime]
        log_level = "debug"
        worker_count = 8
    "#;
    
    tokio::fs::write(&config_file, updated_config).await.unwrap();
    
    // Trigger hot reload
    config_manager.reload_configuration().await.unwrap();
    
    assert_eq!(config_manager.get_log_level(), "debug");
    assert_eq!(config_manager.get_worker_count(), 8);
}

#[tokio::test]
async fn test_registry_configuration_integration() {
    use winreg::RegKey;
    use winreg::enums::*;
    
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let test_key = hkcu.create_subkey("Software\\HotM\\Test").unwrap();
    
    // Set test registry values
    test_key.0.set_value("TestPort", &54321u32).unwrap();
    test_key.0.set_value("TestMode", &"server").unwrap();
    
    let registry_manager = RegistryConfigManager::new_with_base_key("Software\\HotM\\Test").unwrap();
    
    let port: u32 = registry_manager.get_value("TestPort").unwrap();
    let mode: String = registry_manager.get_value("TestMode").unwrap();
    
    assert_eq!(port, 54321);
    assert_eq!(mode, "server");
    
    // Cleanup
    hkcu.delete_subkey("Software\\HotM\\Test").unwrap();
}
```

## Integration Testing Strategy

### Service Communication Tests

```rust
// tests/integration/service_communication_tests.rs
use hotm_service_manager::test_utils::TestEnvironment;
use std::time::Duration;

#[tokio::test]
async fn test_postgres_connectivity() {
    let test_env = TestEnvironment::new().await.unwrap();
    test_env.start_postgres().await.unwrap();
    
    // Test basic connectivity
    let conn = test_env.get_postgres_connection().await.unwrap();
    let result = conn.simple_query("SELECT 1").await.unwrap();
    assert!(!result.is_empty());
    
    // Test pgvector extension
    let result = conn.simple_query("CREATE EXTENSION IF NOT EXISTS vector").await;
    assert!(result.is_ok(), "pgvector extension should be available");
    
    // Test table creation
    let result = conn.simple_query(r#"
        CREATE TEMPORARY TABLE test_vectors (
            id SERIAL PRIMARY KEY,
            embedding vector(768)
        )
    "#).await;
    assert!(result.is_ok(), "Should be able to create vector tables");
    
    test_env.cleanup().await.unwrap();
}

#[tokio::test]
async fn test_ollama_api_integration() {
    let test_env = TestEnvironment::new().await.unwrap();
    test_env.start_ollama().await.unwrap();
    
    // Wait for Ollama to be ready
    let ollama_client = test_env.get_ollama_client();
    
    // Test health endpoint
    let health_response = ollama_client.health().await.unwrap();
    assert!(health_response.status == "ok" || health_response.status == "loading");
    
    // Test model listing (may be empty in test environment)
    let models_response = ollama_client.list_models().await.unwrap();
    // Don't assert on content as models may not be available
    
    // Test simple generation (if models available)
    if !models_response.models.is_empty() {
        let generate_request = GenerateRequest {
            model: models_response.models[0].name.clone(),
            prompt: "Test prompt".to_string(),
            stream: false,
        };
        
        let generate_response = tokio::time::timeout(
            Duration::from_secs(30),
            ollama_client.generate(generate_request)
        ).await;
        
        assert!(generate_response.is_ok(), "Generation should complete within timeout");
    }
    
    test_env.cleanup().await.unwrap();
}

#[tokio::test]
async fn test_runtime_api_endpoints() {
    let test_env = TestEnvironment::new().await.unwrap();
    test_env.start_full_stack().await.unwrap();
    
    let api_client = test_env.get_api_client();
    
    // Test health endpoint
    let health_response = api_client.get_health().await.unwrap();
    assert_eq!(health_response.status, "healthy");
    assert!(health_response.database);
    
    // Test note creation
    let create_request = CreateNoteRequest {
        title: "Test Note".to_string(),
        content: "This is a test note for integration testing.".to_string(),
        tags: vec!["test".to_string()],
        collection: None,
    };
    
    let created_note = api_client.create_note(create_request).await.unwrap();
    assert!(created_note.id.is_some());
    assert_eq!(created_note.title, "Test Note");
    
    // Test note retrieval
    let note_id = created_note.id.unwrap();
    let retrieved_note = api_client.get_note(note_id).await.unwrap();
    assert_eq!(retrieved_note.title, "Test Note");
    
    // Test search functionality
    let search_request = SearchRequest {
        query: "test".to_string(),
        limit: Some(10),
        offset: Some(0),
    };
    
    let search_response = api_client.search_notes(search_request).await.unwrap();
    assert!(search_response.results.len() > 0);
    assert!(search_response.results.iter().any(|r| r.id == note_id));
    
    test_env.cleanup().await.unwrap();
}

#[tokio::test]
async fn test_service_failure_recovery() {
    let test_env = TestEnvironment::new().await.unwrap();
    test_env.start_full_stack().await.unwrap();
    
    let api_client = test_env.get_api_client();
    
    // Verify initial state
    let initial_health = api_client.get_health().await.unwrap();
    assert_eq!(initial_health.status, "healthy");
    
    // Simulate PostgreSQL failure
    test_env.kill_postgres().await.unwrap();
    
    // Wait for recovery
    tokio::time::sleep(Duration::from_secs(10)).await;
    
    // Test that service attempts recovery
    let mut recovery_attempts = 0;
    let max_attempts = 10;
    
    while recovery_attempts < max_attempts {
        match api_client.get_health().await {
            Ok(health) if health.database => {
                // Recovery successful
                break;
            }
            Ok(_) => {
                // Still recovering
                recovery_attempts += 1;
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
            Err(_) => {
                // Service still down
                recovery_attempts += 1;
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    }
    
    assert!(recovery_attempts < max_attempts, "Service should recover from PostgreSQL failure");
    
    test_env.cleanup().await.unwrap();
}
```

### Configuration Integration Tests

```rust
// tests/integration/configuration_integration_tests.rs
use hotm_service_manager::test_utils::TestEnvironment;

#[tokio::test]
async fn test_registry_to_service_configuration_flow() {
    let test_env = TestEnvironment::new().await.unwrap();
    
    // Set registry configuration
    test_env.set_registry_value("Services\\PostgreSQL\\Port", 55432).await.unwrap();
    test_env.set_registry_value("Services\\Ollama\\Port", 11437).await.unwrap();
    test_env.set_registry_value("Services\\Runtime\\Port", 53212).await.unwrap();
    
    // Generate configuration files
    test_env.generate_configuration_files().await.unwrap();
    
    // Start services with new configuration
    test_env.start_full_stack().await.unwrap();
    
    // Verify services are using correct ports
    let postgres_info = test_env.get_postgres_info().await.unwrap();
    assert_eq!(postgres_info.port, 55432);
    
    let ollama_info = test_env.get_ollama_info().await.unwrap();
    assert_eq!(ollama_info.port, 11437);
    
    let api_client = test_env.get_api_client_with_port(53212);
    let health = api_client.get_health().await.unwrap();
    assert_eq!(health.status, "healthy");
    
    test_env.cleanup().await.unwrap();
}

#[tokio::test]
async fn test_configuration_validation_pipeline() {
    let test_env = TestEnvironment::new().await.unwrap();
    
    // Test invalid port configuration
    test_env.set_registry_value("Services\\PostgreSQL\\Port", 99999).await.unwrap();
    
    let validation_result = test_env.validate_configuration().await;
    assert!(validation_result.is_err());
    
    let errors = validation_result.unwrap_err();
    assert!(errors.iter().any(|e| e.contains("port") && e.contains("range")));
    
    // Test port conflict
    test_env.set_registry_value("Services\\PostgreSQL\\Port", 54321).await.unwrap();
    test_env.set_registry_value("Services\\Ollama\\Port", 54321).await.unwrap();
    
    let validation_result = test_env.validate_configuration().await;
    assert!(validation_result.is_err());
    
    let errors = validation_result.unwrap_err();
    assert!(errors.iter().any(|e| e.contains("port") && e.contains("conflict")));
    
    test_env.cleanup().await.unwrap();
}
```

## End-to-End Testing Strategy

### Full System Scenario Tests

```rust
// tests/e2e/full_system_scenarios.rs
use hotm_service_manager::test_utils::{TestEnvironment, WindowsServiceTestHarness};

#[tokio::test]
async fn test_complete_installation_and_operation_flow() {
    let test_harness = WindowsServiceTestHarness::new().await.unwrap();
    
    // Phase 1: Installation
    let install_result = test_harness.run_installer().await;
    assert!(install_result.is_ok(), "Installation should succeed");
    
    // Verify services are installed
    let services = test_harness.get_installed_services().await.unwrap();
    assert!(services.contains(&"hotm-postgres".to_string()));
    assert!(services.contains(&"hotm-ollama".to_string()));
    assert!(services.contains(&"hotm-runtime".to_string()));
    assert!(services.contains(&"hotm-monitor".to_string()));
    
    // Phase 2: Service Startup
    let startup_result = test_harness.start_all_services().await;
    assert!(startup_result.is_ok(), "All services should start successfully");
    
    // Wait for services to be fully ready
    test_harness.wait_for_all_services_ready(Duration::from_secs(180)).await.unwrap();
    
    // Phase 3: System Operation
    let api_client = test_harness.get_api_client();
    
    // Test full note lifecycle
    let note = api_client.create_note(CreateNoteRequest {
        title: "E2E Test Note".to_string(),
        content: "This is a comprehensive end-to-end test note with detailed content for processing.".to_string(),
        tags: vec!["e2e".to_string(), "testing".to_string()],
        collection: Some("test-collection".to_string()),
    }).await.unwrap();
    
    // Wait for background processing
    tokio::time::sleep(Duration::from_secs(30)).await;
    
    // Verify AI processing completed
    let processed_note = api_client.get_note(note.id.unwrap()).await.unwrap();
    assert!(processed_note.revised_content.is_some(), "Note should have AI-generated revision");
    assert!(processed_note.tags.len() >= 2, "Note should have tags");
    
    // Test search functionality
    let search_results = api_client.search_notes(SearchRequest {
        query: "comprehensive".to_string(),
        limit: Some(10),
        offset: Some(0),
    }).await.unwrap();
    
    assert!(search_results.results.len() > 0, "Search should return results");
    
    // Phase 4: Service Management
    let management_client = test_harness.get_management_client();
    
    // Test service control
    management_client.restart_service("hotm-runtime").await.unwrap();
    
    // Wait for restart
    tokio::time::sleep(Duration::from_secs(10)).await;
    
    // Verify service is back online
    let health = api_client.get_health().await.unwrap();
    assert_eq!(health.status, "healthy");
    
    // Phase 5: Configuration Changes
    management_client.update_configuration("runtime.log_level", "debug").await.unwrap();
    
    // Verify configuration change took effect
    let config = management_client.get_configuration().await.unwrap();
    assert_eq!(config.runtime.log_level, "debug");
    
    // Phase 6: Cleanup and Uninstall
    test_harness.stop_all_services().await.unwrap();
    test_harness.uninstall_services().await.unwrap();
    
    // Verify cleanup
    let remaining_services = test_harness.get_installed_services().await.unwrap();
    assert!(remaining_services.is_empty(), "All services should be uninstalled");
}

#[tokio::test]
async fn test_disaster_recovery_scenario() {
    let test_harness = WindowsServiceTestHarness::new().await.unwrap();
    test_harness.install_and_start_services().await.unwrap();
    
    let api_client = test_harness.get_api_client();
    
    // Create test data
    let mut note_ids = Vec::new();
    for i in 0..10 {
        let note = api_client.create_note(CreateNoteRequest {
            title: format!("Disaster Recovery Test Note {}", i),
            content: format!("Content for disaster recovery test note number {}", i),
            tags: vec!["disaster-recovery".to_string()],
            collection: Some("disaster-test".to_string()),
        }).await.unwrap();
        note_ids.push(note.id.unwrap());
    }
    
    // Wait for processing
    tokio::time::sleep(Duration::from_secs(30)).await;
    
    // Simulate catastrophic failures
    test_harness.simulate_power_failure().await.unwrap(); // Kills all services ungracefully
    
    // Wait before recovery attempt
    tokio::time::sleep(Duration::from_secs(5)).await;
    
    // Start recovery
    let recovery_result = test_harness.start_all_services().await;
    assert!(recovery_result.is_ok(), "Services should recover from power failure");
    
    test_harness.wait_for_all_services_ready(Duration::from_secs(180)).await.unwrap();
    
    // Verify data integrity
    for note_id in note_ids {
        let note = api_client.get_note(note_id).await.unwrap();
        assert!(note.title.contains("Disaster Recovery Test Note"));
    }
    
    // Verify search still works
    let search_results = api_client.search_notes(SearchRequest {
        query: "disaster-recovery".to_string(),
        limit: Some(20),
        offset: Some(0),
    }).await.unwrap();
    
    assert_eq!(search_results.results.len(), 10, "All notes should be recoverable");
    
    test_harness.cleanup().await.unwrap();
}
```

## Performance Testing Strategy

### Service Performance Benchmarks

```rust
// tests/performance/service_benchmarks.rs
use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};
use hotm_service_manager::test_utils::TestEnvironment;
use std::time::Duration;

fn benchmark_service_startup_times(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    
    c.bench_function("postgres_startup", |b| {
        b.to_async(&rt).iter(|| async {
            let test_env = TestEnvironment::new().await.unwrap();
            let start_time = std::time::Instant::now();
            
            test_env.start_postgres().await.unwrap();
            test_env.wait_for_postgres_ready(Duration::from_secs(60)).await.unwrap();
            
            let startup_time = start_time.elapsed();
            test_env.cleanup().await.unwrap();
            
            startup_time
        });
    });
    
    c.bench_function("ollama_startup", |b| {
        b.to_async(&rt).iter(|| async {
            let test_env = TestEnvironment::new().await.unwrap();
            let start_time = std::time::Instant::now();
            
            test_env.start_ollama().await.unwrap();
            test_env.wait_for_ollama_ready(Duration::from_secs(120)).await.unwrap();
            
            let startup_time = start_time.elapsed();
            test_env.cleanup().await.unwrap();
            
            startup_time
        });
    });
    
    c.bench_function("full_stack_startup", |b| {
        b.to_async(&rt).iter(|| async {
            let test_env = TestEnvironment::new().await.unwrap();
            let start_time = std::time::Instant::now();
            
            test_env.start_full_stack().await.unwrap();
            test_env.wait_for_all_services_ready(Duration::from_secs(180)).await.unwrap();
            
            let startup_time = start_time.elapsed();
            test_env.cleanup().await.unwrap();
            
            startup_time
        });
    });
}

fn benchmark_api_performance(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let test_env = rt.block_on(TestEnvironment::new()).unwrap();
    rt.block_on(test_env.start_full_stack()).unwrap();
    
    let api_client = test_env.get_api_client();
    
    // Benchmark note creation
    c.bench_function("note_creation", |b| {
        b.to_async(&rt).iter(|| async {
            api_client.create_note(CreateNoteRequest {
                title: "Performance Test Note".to_string(),
                content: "This is a performance test note with standard length content.".to_string(),
                tags: vec!["performance".to_string()],
                collection: None,
            }).await.unwrap()
        });
    });
    
    // Benchmark search performance with different result sizes
    let mut search_group = c.benchmark_group("search_performance");
    for result_count in [10, 50, 100, 500].iter() {
        search_group.bench_with_input(
            BenchmarkId::new("search_results", result_count),
            result_count,
            |b, &result_count| {
                b.to_async(&rt).iter(|| async {
                    api_client.search_notes(SearchRequest {
                        query: "test".to_string(),
                        limit: Some(result_count),
                        offset: Some(0),
                    }).await.unwrap()
                });
            },
        );
    }
    search_group.finish();
}

fn benchmark_concurrent_operations(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let test_env = rt.block_on(TestEnvironment::new()).unwrap();
    rt.block_on(test_env.start_full_stack()).unwrap();
    
    let api_client = test_env.get_api_client();
    
    // Benchmark concurrent note creation
    let mut concurrent_group = c.benchmark_group("concurrent_operations");
    for concurrency in [1, 5, 10, 20].iter() {
        concurrent_group.bench_with_input(
            BenchmarkId::new("concurrent_note_creation", concurrency),
            concurrency,
            |b, &concurrency| {
                b.to_async(&rt).iter(|| async {
                    let tasks: Vec<_> = (0..concurrency).map(|i| {
                        let client = api_client.clone();
                        async move {
                            client.create_note(CreateNoteRequest {
                                title: format!("Concurrent Test Note {}", i),
                                content: "Content for concurrent testing".to_string(),
                                tags: vec!["concurrent".to_string()],
                                collection: None,
                            }).await.unwrap()
                        }
                    }).collect();
                    
                    futures::future::join_all(tasks).await
                });
            },
        );
    }
    concurrent_group.finish();
}

criterion_group!(
    benches,
    benchmark_service_startup_times,
    benchmark_api_performance, 
    benchmark_concurrent_operations
);
criterion_main!(benches);
```

### Memory and Resource Monitoring

```rust
// tests/performance/resource_monitoring.rs
use sysinfo::{System, SystemExt, ProcessExt};
use std::time::Duration;

#[tokio::test]
async fn test_service_memory_usage() {
    let test_env = TestEnvironment::new().await.unwrap();
    test_env.start_full_stack().await.unwrap();
    
    let mut system = System::new_all();
    system.refresh_all();
    
    // Monitor resource usage over time
    let monitoring_duration = Duration::from_secs(300); // 5 minutes
    let monitoring_interval = Duration::from_secs(10);
    let start_time = std::time::Instant::now();
    
    let mut postgres_memory_samples = Vec::new();
    let mut ollama_memory_samples = Vec::new();
    let mut runtime_memory_samples = Vec::new();
    
    while start_time.elapsed() < monitoring_duration {
        system.refresh_all();
        
        // Find HotM processes
        for process in system.processes().values() {
            let process_name = process.name();
            let memory_kb = process.memory();
            
            if process_name.contains("postgres") {
                postgres_memory_samples.push(memory_kb);
            } else if process_name.contains("ollama") {
                ollama_memory_samples.push(memory_kb);
            } else if process_name.contains("hotm-runtime") {
                runtime_memory_samples.push(memory_kb);
            }
        }
        
        tokio::time::sleep(monitoring_interval).await;
    }
    
    // Analyze memory usage patterns
    let postgres_avg_memory = postgres_memory_samples.iter().sum::<u64>() / postgres_memory_samples.len() as u64;
    let ollama_avg_memory = ollama_memory_samples.iter().sum::<u64>() / ollama_memory_samples.len() as u64;
    let runtime_avg_memory = runtime_memory_samples.iter().sum::<u64>() / runtime_memory_samples.len() as u64;
    
    // Assert memory usage is within acceptable limits
    assert!(postgres_avg_memory < 512 * 1024, "PostgreSQL memory usage should be < 512MB"); // 512MB
    assert!(ollama_avg_memory < 4 * 1024 * 1024, "Ollama memory usage should be < 4GB"); // 4GB
    assert!(runtime_avg_memory < 256 * 1024, "Runtime memory usage should be < 256MB"); // 256MB
    
    // Check for memory leaks (memory should not grow continuously)
    let postgres_memory_growth = postgres_memory_samples.last().unwrap() - postgres_memory_samples.first().unwrap();
    let ollama_memory_growth = ollama_memory_samples.last().unwrap() - ollama_memory_samples.first().unwrap();
    let runtime_memory_growth = runtime_memory_samples.last().unwrap() - runtime_memory_samples.first().unwrap();
    
    assert!(postgres_memory_growth < 100 * 1024, "PostgreSQL should not have significant memory growth"); // <100MB growth
    assert!(ollama_memory_growth < 500 * 1024, "Ollama should not have significant memory growth"); // <500MB growth  
    assert!(runtime_memory_growth < 50 * 1024, "Runtime should not have significant memory growth"); // <50MB growth
    
    test_env.cleanup().await.unwrap();
}

#[tokio::test]
async fn test_service_cpu_usage_under_load() {
    let test_env = TestEnvironment::new().await.unwrap();
    test_env.start_full_stack().await.unwrap();
    
    let api_client = test_env.get_api_client();
    let mut system = System::new_all();
    
    // Generate load
    let load_generation_task = tokio::spawn(async move {
        for i in 0..100 {
            let _ = api_client.create_note(CreateNoteRequest {
                title: format!("Load Test Note {}", i),
                content: format!("This is load test note {} with substantial content to process.", i),
                tags: vec!["load-test".to_string()],
                collection: None,
            }).await;
            
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    });
    
    // Monitor CPU usage during load
    let monitoring_task = tokio::spawn(async move {
        let mut cpu_samples = Vec::new();
        let start_time = std::time::Instant::now();
        
        while start_time.elapsed() < Duration::from_secs(60) {
            system.refresh_all();
            
            let total_cpu = system.processes().values()
                .filter(|p| {
                    let name = p.name();
                    name.contains("postgres") || name.contains("ollama") || name.contains("hotm")
                })
                .map(|p| p.cpu_usage())
                .sum::<f32>();
            
            cpu_samples.push(total_cpu);
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        
        cpu_samples
    });
    
    let (_, cpu_samples) = tokio::join!(load_generation_task, monitoring_task);
    let cpu_samples = cpu_samples.unwrap();
    
    let avg_cpu = cpu_samples.iter().sum::<f32>() / cpu_samples.len() as f32;
    let max_cpu = cpu_samples.iter().fold(0.0_f32, |a, &b| a.max(b));
    
    // Assert CPU usage is reasonable under load
    assert!(avg_cpu < 80.0, "Average CPU usage should be < 80% under load");
    assert!(max_cpu < 95.0, "Peak CPU usage should be < 95%");
    
    test_env.cleanup().await.unwrap();
}
```

## Security Testing Strategy

### Security Validation Tests

```rust
// tests/security/security_validation.rs
use hotm_service_manager::test_utils::{TestEnvironment, SecurityTestHarness};

#[tokio::test]
async fn test_service_account_permissions() {
    let security_harness = SecurityTestHarness::new().await.unwrap();
    
    // Test that service accounts have minimal required permissions
    let postgres_permissions = security_harness.get_account_permissions("hotm-postgres").await.unwrap();
    
    assert!(postgres_permissions.contains("SeServiceLogonRight"));
    assert!(postgres_permissions.contains("SeLockMemoryPrivilege"));
    assert!(!postgres_permissions.contains("SeDebugPrivilege")); // Should not have debug privilege
    assert!(!postgres_permissions.contains("SeSystemtimePrivilege")); // Should not have system time privilege
    
    let ollama_permissions = security_harness.get_account_permissions("hotm-ollama").await.unwrap();
    
    assert!(ollama_permissions.contains("SeServiceLogonRight"));
    assert!(ollama_permissions.contains("SeIncreaseWorkingSetPrivilege"));
    assert!(!ollama_permissions.contains("SeBackupPrivilege")); // Should not have backup privilege
    
    let runtime_permissions = security_harness.get_account_permissions("hotm-runtime").await.unwrap();
    
    assert!(runtime_permissions.contains("SeServiceLogonRight"));
    assert!(!runtime_permissions.contains("SeShutdownPrivilege")); // Should not have shutdown privilege
}

#[tokio::test]
async fn test_file_system_permissions() {
    let security_harness = SecurityTestHarness::new().await.unwrap();
    
    let programdata_path = std::env::var("PROGRAMDATA").unwrap();
    let hotm_base_path = format!("{programdata_path}\\HotM");
    
    // Test PostgreSQL data directory permissions
    let postgres_data_permissions = security_harness
        .get_directory_permissions(&format!("{hotm_base_path}\\PostgreSQL\\data"))
        .await.unwrap();
    
    assert!(postgres_data_permissions.has_full_control("hotm-postgres"));
    assert!(postgres_data_permissions.has_full_control("Administrators"));
    assert!(!postgres_data_permissions.has_any_access("Users"));
    assert!(!postgres_data_permissions.has_any_access("Everyone"));
    
    // Test configuration directory permissions
    let config_permissions = security_harness
        .get_directory_permissions(&format!("{hotm_base_path}\\config"))
        .await.unwrap();
    
    assert!(config_permissions.has_read_access("hotm-runtime"));
    assert!(config_permissions.has_full_control("Administrators"));
    assert!(!config_permissions.has_write_access("Users"));
    
    // Test certificate store permissions
    let cert_permissions = security_harness
        .get_directory_permissions(&format!("{hotm_base_path}\\certs"))
        .await.unwrap();
    
    assert!(cert_permissions.has_full_control("SYSTEM"));
    assert!(cert_permissions.has_read_access("Administrators"));
    assert!(!cert_permissions.has_any_access("Users"));
    assert!(!cert_permissions.has_any_access("Everyone"));
}

#[tokio::test]
async fn test_registry_security() {
    let security_harness = SecurityTestHarness::new().await.unwrap();
    
    // Test HotM registry key permissions
    let hotm_registry_permissions = security_harness
        .get_registry_permissions("HKEY_LOCAL_MACHINE\\SOFTWARE\\HotM")
        .await.unwrap();
    
    assert!(hotm_registry_permissions.has_full_control("Administrators"));
    assert!(hotm_registry_permissions.has_full_control("SYSTEM"));
    assert!(hotm_registry_permissions.has_read_access("hotm-runtime"));
    assert!(!hotm_registry_permissions.has_write_access("Users"));
    
    // Test security configuration key permissions (highly restricted)
    let security_key_permissions = security_harness
        .get_registry_permissions("HKEY_LOCAL_MACHINE\\SOFTWARE\\HotM\\Security")
        .await.unwrap();
    
    assert!(security_key_permissions.has_full_control("Administrators"));
    assert!(security_key_permissions.has_full_control("SYSTEM"));
    assert!(!security_key_permissions.has_any_access("Users"));
    assert!(!security_key_permissions.has_any_access("Everyone"));
}

#[tokio::test]
async fn test_network_security() {
    let test_env = TestEnvironment::new().await.unwrap();
    test_env.start_full_stack().await.unwrap();
    
    // Test that internal services are only accessible locally
    let external_client = reqwest::Client::new();
    
    // PostgreSQL should not be accessible from external IP (simulate)
    let postgres_external_result = external_client
        .get("http://192.168.1.100:54321")  // Simulate external access
        .timeout(Duration::from_secs(5))
        .send()
        .await;
    
    assert!(postgres_external_result.is_err(), "PostgreSQL should not be accessible externally");
    
    // Ollama should not be accessible from external IP
    let ollama_external_result = external_client
        .get("http://192.168.1.100:11435/api/health")
        .timeout(Duration::from_secs(5))
        .send()
        .await;
    
    assert!(ollama_external_result.is_err(), "Ollama should not be accessible externally");
    
    // Test local access works
    let api_client = test_env.get_api_client();
    let health = api_client.get_health().await;
    assert!(health.is_ok(), "Local access should work");
    
    test_env.cleanup().await.unwrap();
}

#[tokio::test]
async fn test_authentication_security() {
    let test_env = TestEnvironment::new().await.unwrap();
    test_env.start_full_stack().await.unwrap();
    
    let management_client = test_env.get_management_client();
    
    // Test API key generation and validation
    let api_key = management_client.generate_api_key("test-key", vec!["ReadOnly"]).await.unwrap();
    assert!(api_key.starts_with("hotm_"));
    assert!(api_key.len() > 32);
    
    // Test that API key works for authorized operations
    let readonly_client = test_env.get_api_client_with_key(&api_key);
    let health = readonly_client.get_health().await;
    assert!(health.is_ok(), "Valid API key should allow access");
    
    // Test that API key doesn't work for unauthorized operations
    let config_result = readonly_client.update_configuration("test.key", "value").await;
    assert!(config_result.is_err(), "ReadOnly API key should not allow configuration changes");
    
    // Test invalid API key
    let invalid_client = test_env.get_api_client_with_key("invalid_key");
    let invalid_health = invalid_client.get_health().await;
    assert!(invalid_health.is_err(), "Invalid API key should be rejected");
    
    // Test JWT token expiration
    let short_lived_token = management_client.generate_jwt_token("test-user", Duration::from_secs(1)).await.unwrap();
    let jwt_client = test_env.get_api_client_with_jwt(&short_lived_token);
    
    // Should work immediately
    let immediate_result = jwt_client.get_health().await;
    assert!(immediate_result.is_ok(), "Fresh JWT should work");
    
    // Wait for expiration
    tokio::time::sleep(Duration::from_secs(2)).await;
    
    // Should fail after expiration
    let expired_result = jwt_client.get_health().await;
    assert!(expired_result.is_err(), "Expired JWT should be rejected");
    
    test_env.cleanup().await.unwrap();
}
```

## Continuous Integration Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/service-integration-tests.yml
name: Service Integration Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  RUST_BACKTRACE: 1
  CARGO_TERM_COLOR: always

jobs:
  static-analysis:
    runs-on: windows-latest
    timeout-minutes: 10
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        components: rustfmt, clippy
        override: true
    
    - name: Cache cargo registry
      uses: actions/cache@v3
      with:
        path: ~/.cargo/registry
        key: ${{ runner.os }}-cargo-registry-${{ hashFiles('**/Cargo.lock') }}
    
    - name: Rust format check
      run: cargo fmt --all -- --check
    
    - name: Clippy analysis
      run: cargo clippy --all-targets --all-features -- -D warnings
    
    - name: Security audit
      run: |
        cargo install cargo-audit
        cargo audit
    
    - name: Dependency check
      run: |
        cargo install cargo-outdated
        cargo outdated --exit-code 1

  unit-tests:
    runs-on: windows-latest
    timeout-minutes: 15
    needs: static-analysis
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        override: true
    
    - name: Cache cargo
      uses: actions/cache@v3
      with:
        path: |
          ~/.cargo/registry
          ~/.cargo/git
          target
        key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
    
    - name: Install test dependencies
      run: |
        # Install PostgreSQL portable
        choco install postgresql --version 14.8 --params '/NoPath'
        
        # Install Ollama for testing
        Invoke-WebRequest -Uri "https://ollama.ai/install.ps1" -OutFile "install-ollama.ps1"
        PowerShell -ExecutionPolicy Bypass -File install-ollama.ps1
    
    - name: Run unit tests
      run: cargo test --lib --bins
      env:
        DATABASE_URL: postgres://postgres:password@localhost:5432/hotm_test
    
    - name: Generate coverage report
      run: |
        cargo install cargo-tarpaulin
        cargo tarpaulin --out xml --timeout 300
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./cobertura.xml

  integration-tests:
    runs-on: windows-latest
    timeout-minutes: 30
    needs: unit-tests
    
    services:
      postgres:
        image: pgvector/pgvector:pg14
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: hotm_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        override: true
    
    - name: Cache cargo
      uses: actions/cache@v3
      with:
        path: |
          ~/.cargo/registry
          ~/.cargo/git
          target
        key: ${{ runner.os }}-integration-cargo-${{ hashFiles('**/Cargo.lock') }}
    
    - name: Set up test environment
      run: |
        # Install Ollama
        Invoke-WebRequest -Uri "https://ollama.ai/install.ps1" -OutFile "install-ollama.ps1"
        PowerShell -ExecutionPolicy Bypass -File install-ollama.ps1
        
        # Pull test models (lightweight)
        ollama pull all-minilm  # Small embedding model for testing
        
        # Set up test directories
        New-Item -Path "$env:PROGRAMDATA\HotM" -ItemType Directory -Force
        New-Item -Path "$env:PROGRAMDATA\HotM\test" -ItemType Directory -Force
    
    - name: Run integration tests
      run: cargo test --test '*integration*' -- --test-threads=1
      env:
        DATABASE_URL: postgres://postgres:password@localhost:5432/hotm_test
        OLLAMA_URL: http://localhost:11434
        RUST_LOG: hotm_service_manager=debug,integration_tests=debug
    
    - name: Collect test artifacts
      if: failure()
      run: |
        New-Item -Path "test-artifacts" -ItemType Directory -Force
        Copy-Item -Path "$env:PROGRAMDATA\HotM\test\logs\*" -Destination "test-artifacts\" -Recurse -ErrorAction SilentlyContinue
        Get-Service | Where-Object { $_.Name -like "hotm*" } | Out-File "test-artifacts\services.txt"
    
    - name: Upload test artifacts
      if: failure()
      uses: actions/upload-artifact@v3
      with:
        name: integration-test-artifacts
        path: test-artifacts/

  e2e-tests:
    runs-on: windows-latest
    timeout-minutes: 45
    needs: integration-tests
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        override: true
    
    - name: Cache cargo
      uses: actions/cache@v3
      with:
        path: |
          ~/.cargo/registry
          ~/.cargo/git
          target
        key: ${{ runner.os }}-e2e-cargo-${{ hashFiles('**/Cargo.lock') }}
    
    - name: Build service binaries
      run: cargo build --release --bin hotm-service-manager
    
    - name: Set up full test environment
      run: |
        # Install PostgreSQL
        choco install postgresql --version 14.8
        
        # Install Ollama
        Invoke-WebRequest -Uri "https://ollama.ai/install.ps1" -OutFile "install-ollama.ps1"
        PowerShell -ExecutionPolicy Bypass -File install-ollama.ps1
        
        # Create service accounts (simulated in test environment)
        PowerShell -File scripts\setup-test-service-accounts.ps1
        
        # Set up test registry configuration
        PowerShell -File scripts\setup-test-registry.ps1
    
    - name: Run end-to-end tests
      run: cargo test --test '*e2e*' -- --test-threads=1 --nocapture
      env:
        RUST_LOG: hotm_service_manager=info,e2e_tests=debug
        TEST_MODE: true
    
    - name: Collect comprehensive logs
      if: always()
      run: |
        New-Item -Path "e2e-artifacts" -ItemType Directory -Force
        
        # System logs
        Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=(Get-Date).AddHours(-1)} | 
          Export-Csv "e2e-artifacts\system-events.csv"
        
        # Application logs
        Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=(Get-Date).AddHours(-1)} | 
          Export-Csv "e2e-artifacts\application-events.csv"
        
        # Service status
        Get-Service | Where-Object { $_.Name -like "hotm*" } | 
          Export-Csv "e2e-artifacts\service-status.csv"
        
        # Test logs
        Copy-Item -Path "$env:PROGRAMDATA\HotM\logs\*" -Destination "e2e-artifacts\" -Recurse -ErrorAction SilentlyContinue
    
    - name: Upload E2E artifacts
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: e2e-test-artifacts
        path: e2e-artifacts/

  performance-tests:
    runs-on: windows-latest
    timeout-minutes: 60
    needs: integration-tests
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        override: true
    
    - name: Install performance testing tools
      run: |
        cargo install criterion
        choco install postgresql ollama
    
    - name: Run performance benchmarks
      run: cargo bench --bench service_benchmarks
    
    - name: Generate performance report
      run: |
        # Generate criterion report
        Copy-Item -Path "target\criterion" -Destination "performance-report" -Recurse
    
    - name: Upload performance report
      uses: actions/upload-artifact@v3
      with:
        name: performance-report
        path: performance-report/

  security-tests:
    runs-on: windows-latest
    timeout-minutes: 30
    needs: integration-tests
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        override: true
    
    - name: Install security testing tools
      run: |
        cargo install cargo-audit
        # Install additional security scanning tools
    
    - name: Run security tests
      run: cargo test --test '*security*'
      env:
        TEST_MODE: security
        RUST_LOG: hotm_service_manager=debug,security_tests=debug
    
    - name: Security audit
      run: cargo audit --deny warnings
    
    - name: Generate security report
      run: |
        New-Item -Path "security-report" -ItemType Directory -Force
        cargo audit --output json > security-report\audit-report.json
    
    - name: Upload security report
      uses: actions/upload-artifact@v3
      with:
        name: security-report
        path: security-report/
```

### Test Utilities and Helpers

```rust
// src/test_utils.rs
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::process::Command;
use tempfile::TempDir;
use uuid::Uuid;

pub struct TestEnvironment {
    temp_dir: TempDir,
    postgres_port: u16,
    ollama_port: u16,
    api_port: u16,
    services: Vec<Box<dyn TestService>>,
}

impl TestEnvironment {
    pub async fn new() -> Result<Self, TestError> {
        let temp_dir = TempDir::new()?;
        
        // Allocate free ports
        let postgres_port = find_free_port().await?;
        let ollama_port = find_free_port().await?;
        let api_port = find_free_port().await?;
        
        Ok(Self {
            temp_dir,
            postgres_port,
            ollama_port,
            api_port,
            services: Vec::new(),
        })
    }
    
    pub async fn start_postgres(&mut self) -> Result<(), TestError> {
        let postgres_service = TestPostgreSQLService::new(
            self.temp_dir.path(),
            self.postgres_port
        ).await?;
        
        postgres_service.start().await?;
        self.services.push(Box::new(postgres_service));
        
        Ok(())
    }
    
    pub async fn start_ollama(&mut self) -> Result<(), TestError> {
        let ollama_service = TestOllamaService::new(
            self.temp_dir.path(),
            self.ollama_port
        ).await?;
        
        ollama_service.start().await?;
        self.services.push(Box::new(ollama_service));
        
        Ok(())
    }
    
    pub async fn start_full_stack(&mut self) -> Result<(), TestError> {
        self.start_postgres().await?;
        self.wait_for_postgres_ready(Duration::from_secs(30)).await?;
        
        self.start_ollama().await?;
        self.wait_for_ollama_ready(Duration::from_secs(60)).await?;
        
        self.start_runtime().await?;
        self.wait_for_runtime_ready(Duration::from_secs(30)).await?;
        
        Ok(())
    }
    
    pub async fn cleanup(&mut self) -> Result<(), TestError> {
        for service in &mut self.services {
            let _ = service.stop().await; // Best effort cleanup
        }
        
        self.services.clear();
        Ok(())
    }
    
    pub fn get_api_client(&self) -> TestApiClient {
        TestApiClient::new(format!("http://localhost:{}", self.api_port))
    }
}

async fn find_free_port() -> Result<u16, TestError> {
    use tokio::net::TcpListener;
    
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

#[derive(Debug, thiserror::Error)]
pub enum TestError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Service error: {0}")]
    Service(String),
    #[error("Timeout: {0}")]
    Timeout(String),
    #[error("Configuration error: {0}")]
    Configuration(String),
}
```

This comprehensive testing strategy ensures reliable, secure, and performant Windows service integration for HotM through automated validation at every level of the system.