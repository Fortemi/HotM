# Diagram Test Document

This document tests both PlantUML and Mermaid diagram rendering.

## PlantUML Example - Sequence Diagram

```plantuml
@startuml
!theme plain
title Authentication Flow

actor User
participant "Web App" as Web
participant "API Server" as API
database "Database" as DB

User -> Web: Login Request
Web -> API: POST /auth/login
API -> DB: Verify Credentials
DB --> API: User Data
API --> Web: JWT Token
Web --> User: Success
@enduml
```

## Mermaid Example - Flowchart

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> E[Fix issues]
    E --> B
    C --> F[End]
```

## Mermaid Example - Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database
    
    User->>Frontend: Submit Note
    Frontend->>Backend: POST /api/notes
    Backend->>Database: Save Note
    Database-->>Backend: Note ID
    Backend-->>Frontend: Success Response
    Frontend-->>User: Show Confirmation
```

## Mermaid Example - Gantt Chart

```mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Planning
    Requirements    :done,    des1, 2024-01-01, 2024-01-07
    Design          :active,  des2, 2024-01-08, 10d
    section Development
    Backend         :         dev1, after des2, 20d
    Frontend        :         dev2, after des2, 25d
    section Testing
    Unit Tests      :         test1, after dev1, 5d
    Integration     :         test2, after dev2, 7d
```

## Mermaid Example - Class Diagram

```mermaid
classDiagram
    class Note {
        +String id
        +String content
        +DateTime created
        +DateTime updated
        +create()
        +update()
        +delete()
    }
    
    class User {
        +String id
        +String name
        +String email
        +login()
        +logout()
    }
    
    class Tag {
        +String id
        +String name
        +String color
    }
    
    User "1" --> "*" Note : creates
    Note "*" --> "*" Tag : has
```

## PlantUML Example - Component Diagram

```plantuml
@startuml
!theme plain
title System Architecture

package "Frontend" {
    [React App]
    [Tauri Runtime]
}

package "Backend" {
    [API Server]
    [Ollama Service]
    [PlantUML Server]
}

database "PostgreSQL" {
    [Notes]
    [Embeddings]
}

[React App] --> [Tauri Runtime]
[Tauri Runtime] --> [API Server] : HTTP/REST
[API Server] --> [PostgreSQL]
[API Server] --> [Ollama Service] : AI Processing
[React App] --> [PlantUML Server] : Diagram Rendering
@enduml
```

## Regular Code Block (should not be rendered as diagram)

```javascript
// This is just regular code
function hello() {
    console.log("Hello, World!");
}
```

## Mixed Content

Here's some regular markdown with **bold** and *italic* text, followed by a diagram:

```mermaid
pie title Language Distribution
    "TypeScript" : 45
    "Rust" : 35
    "SQL" : 15
    "Other" : 5
```

And here's a math equation: $E = mc^2$

And a block equation:

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$

End of test document.