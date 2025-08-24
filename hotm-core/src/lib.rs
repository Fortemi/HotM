//! HotM Core Library
//! 
//! Shared business logic, data models, and core functionality for HotM applications.
//! This library provides the foundation for both server and desktop implementations.

pub mod models;
pub mod config;
pub mod utils;

#[cfg(feature = "database")]
pub mod database;

#[cfg(feature = "ollama")]
pub mod ollama;

#[cfg(feature = "websocket")]
pub mod websocket;

#[cfg(feature = "database")]
pub mod job_queue;

pub use models::*;
pub use config::*;
pub use utils::*;

#[cfg(feature = "database")]
pub use database::*;

#[cfg(feature = "ollama")]
pub use ollama::*;

#[cfg(feature = "websocket")]
pub use websocket::*;

#[cfg(feature = "database")]
pub use job_queue::*;