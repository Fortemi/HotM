#!/usr/bin/env python3
"""
Seed demo content for Hall of the Mind
This creates demonstration notes that showcase the system's features
"""

import json
import requests
import time
from typing import Dict, List

API_BASE = "http://localhost:53211/api/v1"

demo_notes = [
    {
        "title": "Welcome to Hall of the Mind",
        "content": """# Welcome to Hall of the Mind

This is a **demonstration note** showcasing the rich markdown support in our system.

## Features Demonstrated

### Text Formatting
- **Bold text** for emphasis
- *Italic text* for subtle emphasis  
- ~~Strikethrough~~ for corrections
- `inline code` for technical terms

### Code Blocks
```python
def hello_world():
    print('Hall of the Mind supports syntax highlighting!')
    return True
```

### Links and References
- [External links](https://example.com) are preserved
- Internal references connect related notes automatically
- Semantic linking finds conceptually related content

### Tables
| Feature | Status | Priority |
|---------|--------|----------|
| Markdown | ✅ Complete | High |
| Linking | ✅ Complete | High |
| Search | ✅ Complete | Medium |

> Knowledge is not just information stored,
> but connections discovered and insights revealed.
"""
    },
    {
        "title": "Knowledge Management Systems",
        "content": """# Knowledge Management Systems

A **knowledge management system** (KMS) is a technology platform that facilitates the creation, storage, sharing, and utilization of organizational knowledge.

## Core Components

### 1. Knowledge Capture
- **Explicit knowledge**: Documented information, procedures, and data
- **Tacit knowledge**: Personal expertise, insights, and experience
- Automated extraction from various sources
- Real-time capture of organizational learning

### 2. Knowledge Organization
Effective organization requires:
- Taxonomies and ontologies
- Semantic relationships between concepts
- Contextual metadata enrichment
- Dynamic categorization based on content

### 3. Knowledge Discovery
Modern systems employ:
- Full-text search capabilities
- Semantic search using embeddings
- Graph-based relationship exploration
- AI-powered recommendation engines

## Benefits of KMS

1. **Improved Decision Making**: Access to relevant information when needed
2. **Innovation Acceleration**: Building on existing knowledge
3. **Reduced Redundancy**: Avoid reinventing the wheel
4. **Knowledge Preservation**: Capture expertise before it leaves

> The value of a knowledge management system grows exponentially with the connections it reveals between disparate pieces of information.
"""
    },
    {
        "title": "Semantic Search and AI",
        "content": """# Semantic Search and AI in Knowledge Systems

**Semantic search** represents a paradigm shift from keyword matching to understanding meaning and context.

## How Semantic Search Works

### Vector Embeddings
Text is converted into high-dimensional vectors that capture semantic meaning:
```python
# Example: Converting text to embeddings
text = 'Understanding requires context'
embedding = model.encode(text)  # Returns [0.23, -0.45, 0.67, ...]
```

### Similarity Measurement
- **Cosine similarity**: Measures angle between vectors
- **Euclidean distance**: Measures direct distance
- **Dot product**: Combines magnitude and direction

## Advantages Over Traditional Search

1. **Synonym Understanding**: Finds 'car' when searching for 'automobile'
2. **Concept Matching**: Understands related ideas without exact keywords
3. **Context Awareness**: Considers surrounding information
4. **Language Flexibility**: Works across different phrasings

## AI Enhancement Pipeline

### Text Processing Stages
1. **Chunking**: Break content into processable segments
2. **Summarization**: Extract key insights
3. **Entity Recognition**: Identify people, places, concepts
4. **Relationship Extraction**: Find connections between entities

### Machine Learning Models
- **Transformer architectures**: BERT, GPT, T5
- **Embedding models**: Sentence-BERT, Universal Sentence Encoder
- **Local models**: Privacy-preserving on-device processing

> The goal of semantic search is not just to find information, but to discover connections that human intuition might miss.
"""
    },
    {
        "title": "Personal Knowledge Management",
        "content": """# Personal Knowledge Management (PKM)

**Personal Knowledge Management** is the practice of individuals managing their own knowledge to enhance learning, decision-making, and creativity.

## Core PKM Activities

### Capture
- Quick capture of ideas and insights
- Clipping from web sources
- Recording thoughts and observations
- Documenting learning experiences

### Organize
- Categorization and tagging
- Creating hierarchies and structures
- Building personal taxonomies
- Establishing naming conventions

### Connect
- Linking related concepts
- Building knowledge graphs
- Identifying patterns
- Creating synthesis notes

### Create
- Writing original content
- Combining existing knowledge
- Developing new insights
- Sharing with others

## PKM Tools Evolution

### Generation 1: File-Based
- Text files and folders
- Word processors
- Simple databases

### Generation 2: Web-Based
- Wikis and blogs
- Cloud storage
- Social bookmarking

### Generation 3: Graph-Based
- Bi-directional linking
- Knowledge graphs
- Semantic relationships
- **Hall of the Mind** represents this generation

## Benefits of PKM

1. **Enhanced Learning**: Active engagement with information
2. **Better Recall**: Structured storage aids memory
3. **Creative Insights**: Unexpected connections spark innovation
4. **Professional Growth**: Documented expertise and experience

> Your PKM system should be a thinking partner, not just a storage system.
"""
    }
]

def check_health():
    """Check if the server is healthy"""
    try:
        response = requests.get(f"{API_BASE}/health")
        return response.json().get("ok", False)
    except:
        return False

def create_note(content: str) -> str:
    """Create a note and return its ID"""
    response = requests.post(
        f"{API_BASE}/notes",
        json={"content": content}
    )
    if response.status_code == 200:
        return response.json().get("note_id")
    else:
        print(f"Failed to create note: {response.status_code}")
        return None

def get_queue_status() -> List[Dict]:
    """Get current job queue status"""
    response = requests.get(f"{API_BASE}/jobs/queue")
    if response.status_code == 200:
        return response.json()
    return []

def monitor_queue(duration: int = 60):
    """Monitor the job queue for a specified duration"""
    start_time = time.time()
    last_count = -1
    
    while time.time() - start_time < duration:
        jobs = get_queue_status()
        job_count = len(jobs)
        
        if job_count != last_count:
            print(f"\n📊 Queue Status: {job_count} jobs")
            if jobs:
                running = [j for j in jobs if j['status'] == 'Running']
                pending = [j for j in jobs if j['status'] == 'Pending']
                
                if running:
                    print(f"  🔄 Running: {len(running)}")
                    for job in running[:3]:  # Show first 3 running jobs
                        print(f"    - {job['job_type']}: {job.get('progress_percent', 0)}% complete")
                
                if pending:
                    print(f"  ⏳ Pending: {len(pending)}")
                    total_wait = sum(j.get('estimated_duration_ms', 0) for j in pending) / 1000
                    print(f"    - Estimated total wait: {total_wait:.1f} seconds")
            
            last_count = job_count
        
        if job_count == 0 and last_count > 0:
            print("✅ All jobs completed!")
            break
        
        time.sleep(2)

def main():
    print("🌱 Seeding Hall of the Mind with demonstration content")
    print("=" * 60)
    
    # Check server health
    print("🏥 Checking server health...")
    if not check_health():
        print("❌ Server is not responding. Please start the server first.")
        return
    print("✅ Server is healthy\n")
    
    # Create demonstration notes
    print("📝 Creating demonstration notes...")
    created_notes = []
    
    for i, note_data in enumerate(demo_notes, 1):
        print(f"  {i}. {note_data['title']}...", end=" ")
        note_id = create_note(note_data["content"])
        if note_id:
            created_notes.append(note_id)
            print(f"✅ ({note_id[:8]}...)")
        else:
            print("❌ Failed")
    
    print(f"\n🎉 Created {len(created_notes)} notes successfully!")
    
    # Monitor job queue
    print("\n⏳ Monitoring job queue processing...")
    print("This demonstrates the single-GPU constraint and job prioritization")
    monitor_queue(duration=120)  # Monitor for up to 2 minutes
    
    print("\n" + "=" * 60)
    print("🚀 Demo content seeded successfully!")
    print("\nThe system is now processing:")
    print("  - AI revisions and summarization")
    print("  - Embedding generation for semantic search")
    print("  - Automatic link detection between related notes")
    print("\nYou can:")
    print("  1. Check the UI to see the enhanced notes")
    print("  2. Use semantic search to find related content")
    print("  3. Explore the automatically created links between notes")

if __name__ == "__main__":
    main()