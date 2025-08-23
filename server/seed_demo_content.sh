#!/bin/bash

# Seed database with demonstration content
# Requires server to be running on port 53211

set -e

API_BASE="http://localhost:53211/api/v1"

echo "🌱 Seeding demonstration content..."
echo "⚠️  This will trigger multiple ML pipelines - please wait for completion"
echo ""

# Function to create a note and return its ID
create_note() {
    local content="$1"
    local response=$(curl -s -X POST "$API_BASE/notes" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"$content\"}")
    echo "$response" | grep -o '"note_id":"[^"]*' | cut -d'"' -f4
}

# Check server health first
echo "🏥 Checking server health..."
health=$(curl -s "$API_BASE/health")
if [ -z "$health" ]; then
    echo "❌ Server not running! Please start the server first."
    exit 1
fi
echo "✅ Server is healthy"
echo ""

# Create demonstration notes showcasing various features
echo "📝 Creating demonstration notes..."

# Note 1: Markdown showcase
NOTE1=$(create_note "# Welcome to Hall of the Mind

This is a **demonstration note** showcasing the rich markdown support in our system.

## Features Demonstrated

### Text Formatting
- **Bold text** for emphasis
- *Italic text* for subtle emphasis  
- ~~Strikethrough~~ for corrections
- \`inline code\` for technical terms

### Lists and Organization
1. Numbered lists for ordered items
2. Bullet points for unordered items
   - Nested items supported
   - Multiple levels of nesting

### Code Blocks
\`\`\`python
def hello_world():
    print('Hall of the Mind supports syntax highlighting!')
    return True
\`\`\`

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

### Blockquotes
> Knowledge is not just information stored,
> but connections discovered and insights revealed.

---

*This note demonstrates the markdown rendering capabilities of Hall of the Mind.*")
echo "✅ Created Note 1: Markdown showcase ($NOTE1)"

# Note 2: Knowledge Management concepts
NOTE2=$(create_note "# Knowledge Management Systems

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

## Implementation Considerations

\`\`\`yaml
key_factors:
  - user_adoption: Critical for success
  - content_quality: Garbage in, garbage out
  - search_effectiveness: Must surface relevant results
  - integration: Connect with existing workflows
\`\`\`

> The value of a knowledge management system grows exponentially with the connections it reveals between disparate pieces of information.

This concept is fundamental to personal knowledge management tools like Hall of the Mind.")
echo "✅ Created Note 2: Knowledge Management ($NOTE2)"

# Note 3: Note-taking methodologies
NOTE3=$(create_note "# Note-Taking Methodologies

Effective **note-taking** is essential for learning, thinking, and knowledge creation. Different methodologies serve different purposes.

## Popular Methodologies

### Zettelkasten Method
The Zettelkasten (\"slip box\") is a method of personal knowledge management:
- Each note contains a single idea
- Notes are interconnected through links
- Emergent structure from bottom-up organization
- Promotes creative thinking through unexpected connections

### Cornell Note-Taking System
Structured format for academic notes:
- **Cue Column**: Questions and keywords
- **Note-Taking Area**: Main content during lecture
- **Summary Section**: Brief recap of key points

### Mind Mapping
Visual representation of information:
- Central concept at the center
- Branches radiating outward with related ideas
- Colors and images to enhance memory
- Non-linear structure mirrors thought patterns

### Progressive Summarization
Iterative refinement approach:
1. Save interesting content
2. Bold important passages
3. Highlight the bold sections
4. Create summary notes
5. Add personal commentary

## Digital vs. Analog

| Aspect | Digital | Analog |
|--------|---------|--------|
| Searchability | Excellent | Limited |
| Linking | Automatic | Manual |
| Multimedia | Supported | Limited |
| Tactile Memory | Weak | Strong |
| Flexibility | High | Medium |

### Best Practices
- **Consistency**: Use the same system regularly
- **Review**: Periodic review reinforces memory
- **Personalization**: Adapt methods to your needs
- **Integration**: Connect new notes to existing knowledge

The key to effective note-taking is finding a system that complements your thinking style and consistently applying it.")
echo "✅ Created Note 3: Note-taking methodologies ($NOTE3)"

# Note 4: Semantic Search and AI
NOTE4=$(create_note "# Semantic Search and AI in Knowledge Systems

**Semantic search** represents a paradigm shift from keyword matching to understanding meaning and context.

## How Semantic Search Works

### Vector Embeddings
Text is converted into high-dimensional vectors that capture semantic meaning:
\`\`\`python
# Example: Converting text to embeddings
text = 'Understanding requires context'
embedding = model.encode(text)  # Returns [0.23, -0.45, 0.67, ...]
\`\`\`

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

## Implementation in Hall of the Mind

Our system uses:
- Local Ollama models for privacy
- Hybrid search combining semantic and keyword approaches
- Automatic link detection between related concepts
- Progressive enhancement of content understanding

### Performance Considerations
\`\`\`yaml
optimization_strategies:
  indexing: HNSW for fast approximate nearest neighbor
  caching: Store computed embeddings
  batching: Process multiple queries together
  quantization: Reduce embedding precision for speed
\`\`\`

> The goal of semantic search is not just to find information, but to discover connections that human intuition might miss.

This technology enables Hall of the Mind to surface unexpected insights from your knowledge base.")
echo "✅ Created Note 4: Semantic Search and AI ($NOTE4)"

# Note 5: Personal Knowledge Management
NOTE5=$(create_note "# Personal Knowledge Management (PKM)

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

## PKM Best Practices

### Daily Habits
- Morning pages for thought capture
- Evening review and reflection
- Regular note pruning and updating
- Weekly synthesis sessions

### Organization Principles
\`\`\`markdown
- Use consistent naming: YYYY-MM-DD-topic
- Tag liberally but consistently
- Create index/hub notes
- Regular backups
\`\`\`

### The Collector's Fallacy
Beware of:
- Saving without processing
- Organizing without understanding
- Collecting without creating

> Your PKM system should be a thinking partner, not just a storage system.

## Integration with Hall of the Mind

Our system supports PKM through:
- Immutable originals preserve your exact thoughts
- AI enhancement adds context without losing original
- Semantic linking reveals hidden connections
- Local-first approach ensures privacy

The goal is to augment human intelligence, not replace it.")
echo "✅ Created Note 5: Personal Knowledge Management ($NOTE5)"

# Note 6: Graph Databases and Knowledge Graphs
NOTE6=$(create_note "# Graph Databases and Knowledge Graphs

**Knowledge graphs** represent information as networks of entities and their relationships, enabling powerful analysis and discovery.

## Graph Fundamentals

### Basic Components
- **Nodes (Vertices)**: Entities or concepts
- **Edges (Relationships)**: Connections between nodes
- **Properties**: Attributes of nodes and edges

### Graph Types
1. **Directed Graphs**: Relationships have direction
2. **Undirected Graphs**: Bidirectional relationships
3. **Weighted Graphs**: Relationships have strength values
4. **Property Graphs**: Rich metadata on nodes and edges

## Knowledge Graph Applications

### Academic Research
- Literature citation networks
- Concept relationship mapping
- Research collaboration graphs
- Topic evolution tracking

### Personal Knowledge
- Note interconnections
- Concept hierarchies
- Learning pathways
- Idea development trails

## Graph Algorithms

### Centrality Measures
\`\`\`python
# Finding important nodes
pagerank = graph.pagerank()  # Influential nodes
betweenness = graph.betweenness()  # Bridge nodes
degree = graph.degree()  # Well-connected nodes
\`\`\`

### Community Detection
- Louvain algorithm for modularity
- Label propagation for clustering
- Spectral clustering for partitioning

### Path Finding
- Shortest path between concepts
- All paths for comprehensive understanding
- Random walks for serendipitous discovery

## Benefits of Graph Representation

| Aspect | Benefit |
|--------|---------|
| Discovery | Find non-obvious connections |
| Context | Understand relationships |
| Navigation | Follow knowledge trails |
| Analysis | Identify knowledge gaps |

## Implementation Considerations

### Storage Approaches
1. **Native Graph Databases**: Neo4j, ArangoDB
2. **Graph Layers**: PostgreSQL with recursive CTEs
3. **In-Memory Graphs**: NetworkX, igraph
4. **Hybrid Approaches**: Combine relational and graph

### Scalability Challenges
- Large graphs require specialized algorithms
- Distributed processing for massive datasets
- Incremental updates for real-time systems

## Knowledge Graphs in Hall of the Mind

Our approach:
- Automatic relationship extraction from content
- Semantic similarity creates weighted edges
- Bidirectional linking ensures completeness
- Visual graph exploration (future feature)

> A knowledge graph transforms isolated facts into interconnected understanding.

The power of knowledge graphs lies not in the individual nodes, but in the patterns that emerge from their connections.")
echo "✅ Created Note 6: Graph Databases and Knowledge Graphs ($NOTE6)"

# Note 7: Information Architecture
NOTE7=$(create_note "# Information Architecture

**Information Architecture** (IA) is the art and science of organizing and labeling content to support usability and findability.

## Core Principles

### Organization Schemes
- **Alphabetical**: Simple but limited
- **Chronological**: Time-based ordering
- **Geographical**: Location-based
- **Topical**: Subject categories
- **Task-based**: User goals
- **Audience-based**: User segments

### Organization Structures
1. **Hierarchical**: Tree-like taxonomy
2. **Database**: Structured records
3. **Hypertext**: Non-linear network
4. **Linear**: Sequential flow
5. **Matrix**: Multiple dimensions

## Components of IA

### Navigation Systems
- Global navigation
- Local navigation
- Breadcrumbs
- Filters and facets
- Search interfaces

### Labeling Systems
\`\`\`yaml
effective_labels:
  - clear: Unambiguous meaning
  - concise: Brief but complete
  - consistent: Same terms throughout
  - familiar: User's language
\`\`\`

### Search Systems
- Query interfaces
- Search algorithms
- Results presentation
- Query refinement
- Search analytics

## IA for Knowledge Management

### Taxonomy Development
1. Gather content inventory
2. Identify categories
3. Define relationships
4. Test with users
5. Iterate and refine

### Metadata Strategy
- **Descriptive**: What it is
- **Administrative**: How to manage it
- **Structural**: How it's organized
- **Preservation**: Long-term access

### Findability Factors
| Factor | Impact |
|--------|--------|
| Search | Direct access |
| Browse | Exploratory discovery |
| Links | Contextual connections |
| Tags | Multiple access points |

## Modern IA Challenges

### Information Overload
- Exponential content growth
- Attention scarcity
- Decision fatigue
- Filter failure

### Cross-Platform Consistency
- Desktop vs. mobile
- Native vs. web
- Voice interfaces
- AR/VR environments

## IA in Hall of the Mind

Our information architecture:
- **Flat storage**: All notes at same level
- **Dynamic organization**: Tags and collections
- **Semantic layer**: AI-discovered relationships
- **Multiple access**: Search, browse, links
- **Progressive disclosure**: Original vs. enhanced

### Design Decisions
> We chose a flat structure with dynamic organization to avoid premature categorization and allow organic knowledge structures to emerge.

Good information architecture is invisible when it works and painful when it doesn't.")
echo "✅ Created Note 7: Information Architecture ($NOTE7)"

# Note 8: Memory and Learning
NOTE8=$(create_note "# Memory and Learning Science

Understanding how **memory** works is crucial for designing effective knowledge management systems.

## Types of Memory

### Sensory Memory
- Duration: 0.5-3 seconds
- Capacity: Large but rapidly decaying
- Function: Initial perception buffer

### Short-Term Memory
- Duration: 15-30 seconds
- Capacity: 7±2 items (Miller's Law)
- Function: Active processing

### Long-Term Memory
- **Declarative**: Facts and events
  - Semantic: General knowledge
  - Episodic: Personal experiences
- **Procedural**: Skills and habits
- **Duration**: Potentially permanent
- **Capacity**: Essentially unlimited

## Learning Principles

### Encoding Strategies
1. **Elaboration**: Connect to existing knowledge
2. **Organization**: Structure information
3. **Visualization**: Create mental images
4. **Chunking**: Group related items

### Retrieval Practice
\`\`\`python
# Spacing effect implementation
review_intervals = [1, 3, 7, 21, 60]  # days
for interval in review_intervals:
    schedule_review(note, days=interval)
\`\`\`

### Cognitive Load Theory
- **Intrinsic**: Complexity of material
- **Extraneous**: Poor presentation
- **Germane**: Building schemas

## Memory Techniques

### Method of Loci
1. Visualize familiar location
2. Place items at specific spots
3. Mental walk to retrieve

### Linking Method
- Create story connecting items
- Use vivid, unusual imagery
- Employ emotional associations

### Spaced Repetition
| Review | Interval | Retention |
|--------|----------|-----------|
| 1st | 1 day | 90% |
| 2nd | 3 days | 85% |
| 3rd | 1 week | 80% |
| 4th | 1 month | 75% |

## Forgetting Curve

Without review, we forget:
- 50% within 1 hour
- 70% within 24 hours
- 90% within 1 week

### Combating Forgetting
- **Active recall**: Test yourself
- **Spaced repetition**: Review at intervals
- **Elaborative rehearsal**: Explain in own words
- **Interleaving**: Mix different topics

## Application to PKM

### Design Implications
- Quick capture before forgetting
- Regular review prompts
- Connection to existing knowledge
- Multiple retrieval paths

### Hall of the Mind Features
- **Immediate capture**: Global hotkey access
- **AI summarization**: Reduces cognitive load
- **Semantic links**: Elaborative connections
- **Search**: Multiple retrieval cues

> The best knowledge management system works with, not against, how our brains naturally process and store information.

Understanding memory science helps us build tools that augment rather than burden our cognitive capabilities.")
echo "✅ Created Note 8: Memory and Learning Science ($NOTE8)"

echo ""
echo "🎉 Demo content created successfully!"
echo ""
echo "📊 Summary:"
echo "- Created 8 demonstration notes"
echo "- Topics: Markdown, PKM, Knowledge Graphs, Search, Memory"
echo "- Features demonstrated: Rich formatting, code blocks, tables, links"
echo ""
echo "⏳ ML pipelines are now processing these notes:"
echo "- AI revision/summarization"
echo "- Embedding generation"
echo "- Link detection"
echo "- This may take several minutes to complete"
echo ""
echo "💡 Monitor progress in the UI or check job queue status"