//! HotM Windows Service Manager
//! 
//! Comprehensive Windows service management for HotM with dependency handling,
//! health monitoring, automatic recovery, and configuration management.

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod service;
mod monitor;
mod config;
mod registry;
mod recovery;

use service::ServiceManager;
use config::ServiceConfiguration;

#[derive(Parser)]
#[command(name = "hotm-service-manager")]
#[command(about = "HotM Windows Service Manager")]
#[command(version = env!("CARGO_PKG_VERSION"))]
struct Cli {
    /// Configuration file path
    #[arg(short, long)]
    config: Option<PathBuf>,
    
    /// Verbose logging
    #[arg(short, long)]
    verbose: bool,
    
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Install all HotM services with dependencies
    Install {
        /// Installation directory
        #[arg(long, default_value = "C:\\Program Files\\HotM")]
        install_path: PathBuf,
        
        /// Data directory  
        #[arg(long, default_value = "C:\\ProgramData\\HotM")]
        data_path: PathBuf,
        
        /// Force reinstall if services already exist
        #[arg(long)]
        force: bool,
    },
    
    /// Uninstall all HotM services
    Uninstall {
        /// Remove data directories
        #[arg(long)]
        remove_data: bool,
    },
    
    /// Start all HotM services in dependency order
    Start {
        /// Timeout in seconds for each service start
        #[arg(long, default_value = "60")]
        timeout: u64,
    },
    
    /// Stop all HotM services in reverse dependency order
    Stop {
        /// Force stop services
        #[arg(long)]
        force: bool,
        
        /// Timeout in seconds for each service stop
        #[arg(long, default_value = "30")]
        timeout: u64,
    },
    
    /// Restart all HotM services
    Restart {
        /// Timeout for stop/start operations
        #[arg(long, default_value = "60")]
        timeout: u64,
    },
    
    /// Show status and health of all services
    Status {
        /// Show detailed health information
        #[arg(long)]
        detailed: bool,
        
        /// Output format (text, json)
        #[arg(long, default_value = "text")]
        format: String,
    },
    
    /// Run health checks on all services
    Health {
        /// Fix issues automatically where possible
        #[arg(long)]
        repair: bool,
    },
    
    /// Monitor services continuously
    Monitor {
        /// Monitoring interval in seconds
        #[arg(long, default_value = "30")]
        interval: u64,
        
        /// Enable automatic recovery
        #[arg(long)]
        auto_recover: bool,
    },
    
    /// Run as Windows service (internal use)
    RunService,
    
    /// Configure service settings
    Configure {
        /// Service name to configure
        service: Option<String>,
        
        /// Show current configuration
        #[arg(long)]
        show: bool,
        
        /// Reset to default configuration
        #[arg(long)]
        reset: bool,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    // Initialize logging
    let log_level = if cli.verbose { "debug" } else { "info" };
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| format!("hotm_service_manager={},windows_service=info", log_level).into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    // Load configuration
    let config_path = cli.config.unwrap_or_else(|| {
        PathBuf::from("C:\\ProgramData\\HotM\\config\\service-manager.toml")
    });
    
    let config = ServiceConfiguration::load(&config_path)
        .await
        .context("Failed to load service configuration")?;
    
    info!("HotM Service Manager starting - Command: {:?}", cli.command);
    
    // Create service manager
    let mut service_manager = ServiceManager::new(config)
        .await
        .context("Failed to initialize service manager")?;
    
    match cli.command {
        Commands::Install { install_path, data_path, force } => {
            info!("Installing HotM services");
            service_manager.install_services(&install_path, &data_path, force)
                .await
                .context("Failed to install services")?;
            info!("All services installed successfully");
        }
        
        Commands::Uninstall { remove_data } => {
            info!("Uninstalling HotM services");
            service_manager.uninstall_services(remove_data)
                .await
                .context("Failed to uninstall services")?;
            info!("All services uninstalled successfully");
        }
        
        Commands::Start { timeout } => {
            info!("Starting HotM services");
            service_manager.start_all_services(std::time::Duration::from_secs(timeout))
                .await
                .context("Failed to start services")?;
            info!("All services started successfully");
        }
        
        Commands::Stop { force, timeout } => {
            info!("Stopping HotM services");
            service_manager.stop_all_services(force, std::time::Duration::from_secs(timeout))
                .await
                .context("Failed to stop services")?;
            info!("All services stopped successfully");
        }
        
        Commands::Restart { timeout } => {
            info!("Restarting HotM services");
            let timeout_duration = std::time::Duration::from_secs(timeout);
            service_manager.stop_all_services(false, timeout_duration)
                .await
                .context("Failed to stop services during restart")?;
            
            // Brief pause between stop and start
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            
            service_manager.start_all_services(timeout_duration)
                .await
                .context("Failed to start services during restart")?;
            info!("All services restarted successfully");
        }
        
        Commands::Status { detailed, format } => {
            let status = service_manager.get_service_status(detailed)
                .await
                .context("Failed to get service status")?;
            
            match format.as_str() {
                "json" => {
                    println!("{}", serde_json::to_string_pretty(&status)?);
                }
                _ => {
                    service_manager.print_service_status(&status).await;
                }
            }
        }
        
        Commands::Health { repair } => {
            info!("Running health checks");
            let health_results = service_manager.run_health_checks(repair)
                .await
                .context("Failed to run health checks")?;
            
            service_manager.print_health_results(&health_results).await;
            
            // Exit with error code if any service is unhealthy
            if health_results.iter().any(|result| !result.healthy) {
                std::process::exit(1);
            }
        }
        
        Commands::Monitor { interval, auto_recover } => {
            info!("Starting service monitoring (interval: {}s, auto_recover: {})", interval, auto_recover);
            service_manager.run_monitor(std::time::Duration::from_secs(interval), auto_recover)
                .await
                .context("Service monitoring failed")?;
        }
        
        Commands::RunService => {
            info!("Running as Windows service");
            #[cfg(windows)]
            {
                use crate::service::run_windows_service;
                run_windows_service(service_manager)
                    .await
                    .context("Windows service execution failed")?;
            }
            #[cfg(not(windows))]
            {
                anyhow::bail!("Windows service mode is only available on Windows");
            }
        }
        
        Commands::Configure { service, show, reset } => {
            if show {
                service_manager.show_configuration(service.as_deref())
                    .await
                    .context("Failed to show configuration")?;
            } else if reset {
                service_manager.reset_configuration(service.as_deref())
                    .await
                    .context("Failed to reset configuration")?;
            } else {
                service_manager.configure_interactive(service.as_deref())
                    .await
                    .context("Failed to configure service")?;
            }
        }
    }
    
    Ok(())
}