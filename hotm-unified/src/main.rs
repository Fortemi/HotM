//! HotM Unified Runtime
//! 
//! This is the unified runtime that can operate in different modes:
//! - Server: HTTP API server only
//! - Desktop: Tauri desktop application only  
//! - Hybrid: Both server and desktop in single process

use clap::{Parser, Subcommand, ValueEnum};
use std::env;
use tracing::{info, error, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[cfg(feature = "server")]
mod server_mode;

#[cfg(feature = "desktop")]
mod desktop_mode;

mod config;

use config::AppConfig;

#[derive(ValueEnum, Clone, Debug)]
enum ForcedMode {
    Server,
    Desktop,
    Hybrid,
}

#[derive(Clone, Debug)]
struct DetectedEnvironment {
    has_database_url: bool,
    has_desktop_environment: bool,
    server_port_available: bool,
    existing_server_running: bool,
}

#[derive(Debug)]
enum ValidationError {
    ServerModeRequiresDatabaseUrl,
    ServerModeRequiresPortAvailable,
    DesktopModeNotSupported,
    ServerModeNotSupported,
    HybridModeNotSupported,
    NoFeaturesEnabled,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::ServerModeRequiresDatabaseUrl => {
                write!(f, "Server mode requires a database URL. Set DATABASE_URL environment variable or use --database-url")
            }
            ValidationError::ServerModeRequiresPortAvailable => {
                write!(f, "Server mode requires the specified port to be available")
            }
            ValidationError::DesktopModeNotSupported => {
                write!(f, "Desktop mode is not supported in this build. Enable the 'desktop' feature.")
            }
            ValidationError::ServerModeNotSupported => {
                write!(f, "Server mode is not supported in this build. Enable the 'server' feature.")
            }
            ValidationError::HybridModeNotSupported => {
                write!(f, "Hybrid mode is not supported in this build. Enable both 'server' and 'desktop' features.")
            }
            ValidationError::NoFeaturesEnabled => {
                write!(f, "No features enabled. Enable at least one of 'server' or 'desktop' features.")
            }
        }
    }
}

impl std::error::Error for ValidationError {}

#[derive(Parser)]
#[command(name = "hotm")]
#[command(about = "HotM - Local-first notes and analysis tool")]
#[command(version = env!("CARGO_PKG_VERSION"))]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Run as HTTP API server only
    #[cfg(feature = "server")]
    Server {
        /// Database URL
        #[arg(short, long)]
        database_url: Option<String>,
        
        /// Bind address
        #[arg(short = 'a', long, default_value = "127.0.0.1")]
        bind_address: String,
        
        /// Bind port
        #[arg(short, long, default_value = "53211")]
        bind_port: u16,
    },
    
    /// Run as desktop application only
    #[cfg(feature = "desktop")]
    Desktop {
        /// HotM API server URL to connect to
        #[arg(short, long, default_value = "http://127.0.0.1:53211")]
        api_url: String,
    },
    
    /// Run in hybrid mode (both server and desktop)
    #[cfg(all(feature = "server", feature = "desktop"))]
    Hybrid {
        /// Database URL
        #[arg(short, long)]
        database_url: Option<String>,
        
        /// Bind address for server
        #[arg(short = 'a', long, default_value = "127.0.0.1")]
        bind_address: String,
        
        /// Bind port for server
        #[arg(short, long, default_value = "53211")]
        bind_port: u16,
    },
    
    /// Auto-detect best mode based on environment
    #[cfg(any(feature = "server", feature = "desktop"))]
    Auto {
        /// Database URL (for server mode)
        #[arg(short, long)]
        database_url: Option<String>,
        
        /// Bind address for server (if needed)
        #[arg(short = 'a', long, default_value = "127.0.0.1")]
        bind_address: String,
        
        /// Bind port for server (if needed)
        #[arg(short, long, default_value = "53211")]
        bind_port: u16,
        
        /// Force specific mode instead of auto-detection
        #[arg(long, value_enum)]
        force_mode: Option<ForcedMode>,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "hotm=info,axum=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    let cli = Cli::parse();
    let command = cli.command.unwrap_or_else(|| {
        // Default to auto mode when no command is specified
        Commands::Auto {
            database_url: None,
            bind_address: "127.0.0.1".to_string(),
            bind_port: 53211,
            force_mode: None,
        }
    });

    match command {
        #[cfg(feature = "server")]
        Commands::Server {
            database_url,
            bind_address,
            bind_port,
        } => {
            info!("Starting HotM in server mode");
            
            // Validate server mode requirements
            let env = detect_environment(&bind_address, bind_port).await;
            validate_mode_configuration(&ForcedMode::Server, &env, database_url.as_ref())
                .map_err(|e| anyhow::anyhow!("Server mode validation failed: {}", e))?;
            
            let config = AppConfig {
                database_url: database_url
                    .or_else(|| env::var("DATABASE_URL").ok())
                    .unwrap_or_else(|| "postgres://hotm:hotm@localhost:5432/hotm_dev".to_string()),
                bind_address,
                bind_port,
                ..Default::default()
            };
            
            server_mode::run_server(config).await
        }
        
        #[cfg(feature = "desktop")]
        Commands::Desktop { api_url } => {
            info!("Starting HotM in desktop mode");
            
            // Validate desktop mode support
            validate_mode_support(&ForcedMode::Desktop)
                .map_err(|e| anyhow::anyhow!("Desktop mode validation failed: {}", e))?;
            
            // Set API URL for desktop app
            env::set_var("HOTM_API_URL", api_url);
            
            desktop_mode::run_desktop().await
        }
        
        #[cfg(all(feature = "server", feature = "desktop"))]
        Commands::Hybrid {
            database_url,
            bind_address,
            bind_port,
        } => {
            info!("Starting HotM in hybrid mode (server + desktop)");
            
            // Validate hybrid mode requirements
            let env = detect_environment(&bind_address, bind_port).await;
            validate_mode_support(&ForcedMode::Hybrid)
                .map_err(|e| anyhow::anyhow!("Hybrid mode validation failed: {}", e))?;
            validate_mode_configuration(&ForcedMode::Hybrid, &env, database_url.as_ref())
                .map_err(|e| anyhow::anyhow!("Hybrid mode configuration validation failed: {}", e))?;
            
            let config = AppConfig {
                database_url: database_url
                    .or_else(|| env::var("DATABASE_URL").ok())
                    .unwrap_or_else(|| "postgres://hotm:hotm@localhost:5432/hotm_dev".to_string()),
                bind_address: bind_address.clone(),
                bind_port,
                ..Default::default()
            };
            
            // Set API URL for desktop to connect to local server
            env::set_var("HOTM_API_URL", format!("http://{}:{}", bind_address, bind_port));
            
            // Start server and desktop concurrently
            let server_handle = tokio::spawn(server_mode::run_server(config));
            let desktop_handle = tokio::spawn(desktop_mode::run_desktop());
            
            // Wait for either to complete with improved error handling
            tokio::select! {
                result = server_handle => {
                    match result {
                        Ok(Ok(())) => {
                            info!("Server completed successfully");
                            Ok(())
                        },
                        Ok(Err(e)) => {
                            error!("Server failed: {}", e);
                            Err(anyhow::anyhow!("Server component failed: {}", e))
                        },
                        Err(e) => {
                            error!("Server task panicked: {}", e);
                            Err(anyhow::anyhow!("Server task panicked: {}", e))
                        }
                    }
                }
                result = desktop_handle => {
                    match result {
                        Ok(Ok(())) => {
                            info!("Desktop completed successfully");
                            Ok(())
                        },
                        Ok(Err(e)) => {
                            error!("Desktop failed: {}", e);
                            Err(anyhow::anyhow!("Desktop component failed: {}", e))
                        },
                        Err(e) => {
                            error!("Desktop task panicked: {}", e);
                            Err(anyhow::anyhow!("Desktop task panicked: {}", e))
                        }
                    }
                }
            }
        }
        
        #[cfg(any(feature = "server", feature = "desktop"))]
        Commands::Auto {
            database_url,
            bind_address,
            bind_port,
            force_mode,
        } => {
            info!("Starting HotM in auto-detection mode");
            
            let env = detect_environment(&bind_address, bind_port).await;
            info!("Environment detected: {:?}", env);
            
            let selected_mode = match force_mode {
                Some(mode) => {
                    info!("Mode forced to: {:?}", mode);
                    // Validate forced mode is supported
                    validate_mode_support(&mode)?;
                    mode
                },
                None => {
                    let mode = auto_detect_mode(&env);
                    info!("Auto-detected mode: {:?}", mode);
                    mode
                },
            };
            
            info!("Selected mode: {:?}", selected_mode);
            
            // Validate the selected mode configuration
            validate_mode_configuration(&selected_mode, &env, database_url.as_ref())?;
            
            match selected_mode {
                #[cfg(feature = "server")]
                ForcedMode::Server => {
                    let config = AppConfig {
                        database_url: database_url
                            .or_else(|| env::var("DATABASE_URL").ok())
                            .unwrap_or_else(|| "postgres://hotm:hotm@localhost:5432/hotm_dev".to_string()),
                        bind_address,
                        bind_port,
                        ..Default::default()
                    };
                    server_mode::run_server(config).await
                },
                
                #[cfg(feature = "desktop")]
                ForcedMode::Desktop => {
                    let api_url = if env.existing_server_running {
                        format!("http://{}:{}", bind_address, bind_port)
                    } else {
                        "http://127.0.0.1:53211".to_string()
                    };
                    env::set_var("HOTM_API_URL", api_url);
                    desktop_mode::run_desktop().await
                },
                
                #[cfg(all(feature = "server", feature = "desktop"))]
                ForcedMode::Hybrid => {
                    let config = AppConfig {
                        database_url: database_url
                            .or_else(|| env::var("DATABASE_URL").ok())
                            .unwrap_or_else(|| "postgres://hotm:hotm@localhost:5432/hotm_dev".to_string()),
                        bind_address: bind_address.clone(),
                        bind_port,
                        ..Default::default()
                    };
                    
                    env::set_var("HOTM_API_URL", format!("http://{}:{}", bind_address, bind_port));
                    
                    let server_handle = tokio::spawn(server_mode::run_server(config));
                    let desktop_handle = tokio::spawn(desktop_mode::run_desktop());
                    
                    tokio::select! {
                        result = server_handle => {
                            match result {
                                Ok(Ok(())) => info!("Server completed successfully"),
                                Ok(Err(e)) => error!("Server failed: {}", e),
                                Err(e) => error!("Server task panicked: {}", e),
                            }
                        }
                        result = desktop_handle => {
                            match result {
                                Ok(Ok(())) => info!("Desktop completed successfully"),
                                Ok(Err(e)) => error!("Desktop failed: {}", e),
                                Err(e) => error!("Desktop task panicked: {}", e),
                            }
                        }
                    }
                    
                    Ok(())
                }
                
                // Handle unsupported modes at compile time
                #[cfg(not(feature = "server"))]
                ForcedMode::Server => {
                    Err(anyhow::anyhow!("Server mode is not supported in this build. Enable the 'server' feature."))
                }
                
                #[cfg(not(feature = "desktop"))]
                ForcedMode::Desktop => {
                    Err(anyhow::anyhow!("Desktop mode is not supported in this build. Enable the 'desktop' feature."))
                }
                
                #[cfg(not(all(feature = "server", feature = "desktop")))]
                ForcedMode::Hybrid => {
                    Err(anyhow::anyhow!("Hybrid mode is not supported in this build. Enable both 'server' and 'desktop' features."))
                }
            }
        }
    }
}

fn validate_mode_support(mode: &ForcedMode) -> Result<(), ValidationError> {
    match mode {
        #[cfg(not(feature = "server"))]
        ForcedMode::Server => Err(ValidationError::ServerModeNotSupported),
        
        #[cfg(not(feature = "desktop"))]
        ForcedMode::Desktop => Err(ValidationError::DesktopModeNotSupported),
        
        #[cfg(not(all(feature = "server", feature = "desktop")))]
        ForcedMode::Hybrid => Err(ValidationError::HybridModeNotSupported),
        
        // If the features are enabled, the mode is supported
        #[cfg(feature = "server")]
        ForcedMode::Server => Ok(()),
        
        #[cfg(feature = "desktop")]
        ForcedMode::Desktop => Ok(()),
        
        #[cfg(all(feature = "server", feature = "desktop"))]
        ForcedMode::Hybrid => Ok(()),
    }
}

fn validate_mode_configuration(
    mode: &ForcedMode,
    env: &DetectedEnvironment,
    database_url: Option<&String>
) -> Result<(), ValidationError> {
    match mode {
        ForcedMode::Server | ForcedMode::Hybrid => {
            // Server modes require database URL
            if database_url.is_none() && !env.has_database_url {
                return Err(ValidationError::ServerModeRequiresDatabaseUrl);
            }
            
            // Server modes require port to be available (unless existing server is running for desktop-only)
            if !env.server_port_available && !env.existing_server_running {
                return Err(ValidationError::ServerModeRequiresPortAvailable);
            }
        }
        ForcedMode::Desktop => {
            // Desktop mode is more flexible, can connect to existing servers
            // No strict requirements
        }
    }
    
    Ok(())
}

async fn detect_environment(bind_address: &str, bind_port: u16) -> DetectedEnvironment {
    let has_database_url = env::var("DATABASE_URL").is_ok();
    
    // Check if we're in a desktop environment
    let has_desktop_environment = check_desktop_environment();
    
    // Check if the server port is available
    let server_port_available = is_port_available(bind_address, bind_port).await;
    
    // Check if there's already a HotM server running
    let existing_server_running = check_existing_server(bind_address, bind_port).await;
    
    DetectedEnvironment {
        has_database_url,
        has_desktop_environment,
        server_port_available,
        existing_server_running,
    }
}

fn check_desktop_environment() -> bool {
    // Check for common desktop environment indicators
    env::var("DISPLAY").is_ok() || 
    env::var("WAYLAND_DISPLAY").is_ok() || 
    env::var("XDG_CURRENT_DESKTOP").is_ok() ||
    // Windows desktop check
    (cfg!(windows) && env::var("USERPROFILE").is_ok() && env::var("SYSTEMROOT").is_ok())
}

async fn is_port_available(address: &str, port: u16) -> bool {
    match tokio::net::TcpListener::bind(format!("{}:{}", address, port)).await {
        Ok(_) => true,
        Err(_) => false,
    }
}

async fn check_existing_server(address: &str, port: u16) -> bool {
    let url = format!("http://{}:{}/health", address, port);
    
    match reqwest::get(&url).await {
        Ok(response) => {
            if response.status().is_success() {
                // Try to parse as HotM health response
                if let Ok(health) = response.json::<serde_json::Value>().await {
                    if let Some(mode) = health.get("mode") {
                        info!("Found existing HotM server in mode: {}", mode);
                        return true;
                    }
                }
            }
        },
        Err(_) => {}
    }
    
    false
}

fn auto_detect_mode(env: &DetectedEnvironment) -> ForcedMode {
    // Auto-detection logic based on environment
    
    if env.existing_server_running {
        if env.has_desktop_environment {
            warn!("Existing server found, starting in desktop mode to connect to it");
            #[cfg(feature = "desktop")]
            return ForcedMode::Desktop;
            
            #[cfg(not(feature = "desktop"))]
            {
                warn!("Desktop mode not supported, falling back to server mode");
                #[cfg(feature = "server")]
                return ForcedMode::Server;
            }
        } else {
            warn!("Existing server found, but no desktop environment detected");
            #[cfg(feature = "server")]
            return ForcedMode::Server;
            
            #[cfg(not(feature = "server"))]
            {
                warn!("Server mode not supported");
                #[cfg(feature = "desktop")]
                return ForcedMode::Desktop;
            }
        }
    }
    
    // Check if we can run hybrid mode (both features enabled)
    #[cfg(all(feature = "server", feature = "desktop"))]
    if env.has_database_url && env.has_desktop_environment && env.server_port_available {
        info!("All requirements met for hybrid mode");
        return ForcedMode::Hybrid;
    }
    
    // Fall back to individual modes based on what's available
    #[cfg(feature = "server")]
    if env.has_database_url && env.server_port_available {
        info!("Database available and port free, starting in server mode");
        return ForcedMode::Server;
    }
    
    #[cfg(feature = "desktop")]
    if env.has_desktop_environment {
        info!("Desktop environment detected, starting in desktop mode");
        return ForcedMode::Desktop;
    }
    
    // Default fallback based on available features
    #[cfg(feature = "server")]
    {
        warn!("No optimal mode detected, defaulting to server mode");
        return ForcedMode::Server;
    }
    
    #[cfg(all(not(feature = "server"), feature = "desktop"))]
    {
        warn!("No optimal mode detected, defaulting to desktop mode");
        return ForcedMode::Desktop;
    }
    
    #[cfg(not(any(feature = "server", feature = "desktop")))]
    {
        panic!("No features enabled - cannot determine mode");
    }
}

// If no features are enabled, show a helpful message
#[cfg(not(any(feature = "server", feature = "desktop")))]
fn main() {
    eprintln!("Error: hotm-unified was compiled without any features.");
    eprintln!("Enable either 'server', 'desktop', or both features to use this binary.");
    std::process::exit(1);
}