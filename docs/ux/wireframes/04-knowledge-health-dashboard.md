# Knowledge Health Dashboard - Wireframe Specification

**Version**: 1.0
**Last Updated**: 2026-02-04
**Component**: Knowledge Health Dashboard
**Grid System**: 8px base unit

---

## Overview

Visual dashboard showing knowledge base quality metrics with orphan notes, stale content, tag coverage, link density, and actionable recommendations.

---

## Desktop Layout (>1024px)

### Main Dashboard View

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Knowledge Health                                     Last updated: 2 minutes ago    [↻] Refresh │ 64px
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                          │
│ │   Health     │ │    Total     │ │   Active     │ │     Link     │                          │
│ │    Score     │ │    Notes     │ │  Concepts    │ │   Density    │                          │
│ │              │ │              │ │              │ │              │                          │
│ │    ┌───┐     │ │     1,247    │ │      342     │ │    ┌───┐     │                          │
│ │    │ 62│     │ │              │ │              │ │    │4.2│     │                          │
│ │    └───┘     │ │   Original   │ │   Coverage   │ │    └───┘     │                          │
│ │     Fair     │ │      892     │ │      68%     │ │   Avg Links  │                          │
│ │              │ │              │ │              │ │              │                          │
│ │   ↑ +5 pts   │ │  Revised 355 │ │   42 orphan  │ │  128 unlink  │                          │
│ │              │ │              │ │              │ │              │                          │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘                          │
│    240px            240px            240px            240px                                    │
│    200px height     200px height     200px height     200px height                            │
│                                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤ 24px gap
│                                                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│ │ Metrics                                                                                  │   │ 48px
│ │ ──────────────────────────────────────────────────────────────────────────────────────   │   │
│ │                                                                                          │   │
│ │ ┌──────────────────────────────┐ ┌──────────────────────────────┐                      │   │
│ │ │ ⚠️ Orphan Notes               │ │ 📅 Stale Content             │                      │   │
│ │ │ ────────────────────────      │ │ ────────────────────────     │                      │   │
│ │ │                              │ │                              │                      │   │
│ │ │     42 notes (3.4%)          │ │     18 notes (1.4%)          │                      │   │
│ │ │                              │ │                              │                      │   │
│ │ │ ┌──────────────────────────┐ │ │ ┌──────────────────────────┐ │                      │   │
│ │ │ │   [LINE CHART]           │ │ │ │   [HISTOGRAM]            │ │                      │   │
│ │ │ │   Trend: Last 30 days    │ │ │ │   Age Distribution       │ │                      │   │
│ │ │ │   Peak: 48 (Jan 10)      │ │ │ │   180-365d:  8           │ │                      │   │
│ │ │ │   Today: 42              │ │ │ │   365d+:    10           │ │                      │   │
│ │ │ └──────────────────────────┘ │ │ └──────────────────────────┘ │                      │   │
│ │ │       120px height           │ │       120px height           │                      │   │
│ │ │                              │ │                              │                      │   │
│ │ │ [View Orphans]               │ │ [Review Stale]               │                      │   │
│ │ │                              │ │                              │                      │   │
│ │ │ 💡 Link these notes to       │ │ 💡 Consider archiving notes  │                      │   │
│ │ │    improve discoverability   │ │    older than 365 days       │                      │   │
│ │ │                              │ │                              │                      │   │
│ │ └──────────────────────────────┘ └──────────────────────────────┘                      │   │
│ │    480px width                      480px width                                         │   │
│ │    280px height                     280px height                                        │   │
│ │                                                                                          │   │
│ │ ┌──────────────────────────────┐ ┌──────────────────────────────┐                      │   │
│ │ │ 🏷️ Tag Coverage               │ │ 🔗 Link Quality              │                      │   │
│ │ │ ────────────────────────      │ │ ────────────────────────     │                      │   │
│ │ │                              │ │                              │                      │   │
│ │ │     58% tagged               │ │     Average Score: 0.72      │                      │   │
│ │ │     528 untagged notes       │ │     Semantic: 892            │                      │   │
│ │ │                              │ │     Manual: 156              │                      │   │
│ │ │ ┌──────────────────────────┐ │ │ ┌──────────────────────────┐ │                      │   │
│ │ │ │   [GAUGE]                │ │ │ │   [BAR CHART]            │ │                      │   │
│ │ │ │      58%                 │ │ │ │   Score Distribution     │ │                      │   │
│ │ │ │   ◔◔◔◯◯                  │ │ │ │   0.9-1.0: ███ 234       │ │                      │   │
│ │ │ │                          │ │ │ │   0.7-0.9: ████ 412      │ │                      │   │
│ │ │ │                          │ │ │ │   0.5-0.7: ██ 186        │ │                      │   │
│ │ │ └──────────────────────────┘ │ │ └──────────────────────────┘ │                      │   │
│ │ │       120px height           │ │       120px height           │                      │   │
│ │ │                              │ │                              │                      │   │
│ │ │ [Add Tags]                   │ │ [Find Connections]           │                      │   │
│ │ │                              │ │                              │                      │   │
│ │ │ 💡 AI suggests tags for 215  │ │ 💡 42 note pairs could be    │                      │   │
│ │ │    untagged notes            │ │    semantically linked       │                      │   │
│ │ │                              │ │                              │                      │   │
│ │ └──────────────────────────────┘ └──────────────────────────────┘                      │   │
│ │                                                                                          │   │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤ 24px gap
│                                                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│ │ 🎯 Actionable Insights                                                                   │   │ 48px
│ │ ──────────────────────────────────────────────────────────────────────────────────────   │   │
│ │                                                                                          │   │
│ │ ┌───────────────────────────┐ ┌───────────────────────────┐ ┌──────────────────────┐  │   │
│ │ │ 🔴 HIGH PRIORITY          │ │ 🟡 MEDIUM PRIORITY        │ │ 🟢 LOW PRIORITY      │  │   │
│ │ │                           │ │                           │ │                      │  │   │
│ │ │ Link 42 orphan notes      │ │ Tag 215 untagged notes    │ │ Update taxonomy      │  │   │
│ │ │                           │ │                           │ │                      │  │   │
│ │ │ Impact: High              │ │ Impact: Medium            │ │ Impact: Low          │  │   │
│ │ │ Effort: Medium            │ │ Effort: Low (AI assist)   │ │ Effort: High         │  │   │
│ │ │                           │ │                           │ │                      │  │   │
│ │ │ [Take Action]             │ │ [Take Action]             │ │ [Take Action]        │  │   │
│ │ │                           │ │                           │ │                      │  │   │
│ │ └───────────────────────────┘ └───────────────────────────┘ └──────────────────────┘  │   │
│ │    320px width                  320px width                  320px width              │   │
│ │    180px height                 180px height                 180px height             │   │
│ │                                                                                          │   │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤ 24px gap
│                                                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│ │ 📊 Trends                                                     [7d] [30d] [90d] [1y]     │   │ 48px
│ │ ──────────────────────────────────────────────────────────────────────────────────────   │   │
│ │                                                                                          │   │
│ │ ┌──────────────────────────────────────────────────────────────────────────────────┐   │   │
│ │ │ Health Score Over Time                                                           │   │   │
│ │ │ ────────────────────────────────────────────────────────────────────────────     │   │   │
│ │ │                                                                                  │   │   │
│ │ │ 100 ┤                                                                            │   │   │
│ │ │  80 ┤                                     ╭──╮                                   │   │   │
│ │ │  60 ┤                    ╭────────────────╯  ╰─●                                │   │   │
│ │ │  40 ┤     ╭──────────────╯                                                      │   │   │
│ │ │  20 ┤─────╯                                                                     │   │   │
│ │ │   0 ┼─────────────────────────────────────────────────────────────────────────│   │   │
│ │ │     Jan 1        Jan 8        Jan 15       Jan 22       Jan 29      Today      │   │   │
│ │ │                                                                                  │   │   │
│ │ └──────────────────────────────────────────────────────────────────────────────────┘   │   │
│ │                              200px height                                            │   │
│ │                                                                                          │   │
│ │ ┌──────────────────────────────────────────────────────────────────────────────────┐   │   │
│ │ │ Activity Heatmap                                                                 │   │   │
│ │ │ ────────────────────────────────────────────────────────────────────────────     │   │   │
│ │ │                                                                                  │   │   │
│ │ │ Mon  ░ ▓ ░ ░ █ ░ ▓ ▓ ░ █ ░ ░ ▓ █ ░ ░ ▓ ░ ░ ▓ ░ █ ▓ ░ ░ ▓ ░ ░ ░ ▓         │   │   │
│ │ │ Tue  ▓ ░ ░ █ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ▓ ░ ▓ ░ ░ █ ░ ▓ ░ ░ ▓ ░ ░ ▓ ░ █         │   │   │
│ │ │ Wed  ░ ░ ▓ ░ ░ ░ █ ░ ░ ▓ █ ░ ░ ░ ▓ ░ █ ░ ░ ▓ ░ ░ █ ░ ▓ ░ ░ ▓ ░         │   │   │
│ │ │ Thu  ░ ▓ ░ ░ ▓ ░ ░ █ ░ ░ ▓ ░ █ ░ ░ ▓ ░ ░ ▓ ░ █ ░ ░ ▓ ░ ░ ▓ ░ █         │   │   │
│ │ │ Fri  █ ░ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ▓ ░ ░ ▓ ░ █ ░ ░ ▓ ░ ░ █ ░ ▓ ░ ░ ▓ ░         │   │   │
│ │ │ Sat  ░ ░ ░ ░ ░ ▓ ░ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ░ ▓ ░ ░         │   │   │
│ │ │ Sun  ░ ░ ▓ ░ ░ ░ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ░ ▓ ░ ░         │   │   │
│ │ │                                                                                  │   │   │
│ │ │      ░ No activity   ▓ Low   ▓ Medium   █ High                                  │   │   │
│ │ │                                                                                  │   │   │
│ │ └──────────────────────────────────────────────────────────────────────────────────┘   │   │
│ │                              160px height                                            │   │
│ │                                                                                          │   │
│ └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │ 24px gap
│ │ [Export PDF]            [Export CSV]            [Schedule Report]    [Share Dashboard]  │   │ 64px
│ └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Dimensions**:
- Overview cards: 240px width × 200px height
- Card gap: 16px
- Metric cards: 480px width × 280px height (2-column grid)
- Action cards: 320px width × 180px height (3-column grid)
- Chart sections: Full width
- Line chart: 200px height
- Heatmap: 160px height
- Footer actions: 64px height
- Horizontal padding: 24px
- Vertical section gap: 24px

---

### Overview Card Detail (Health Score)

```
┌──────────────────────────────┐
│ Health Score                 │ 32px header
│ ────────────────────────     │
│                              │
│        ┌───────┐             │
│        │       │             │
│        │  62   │             │ 80px
│        │       │             │ gauge
│        └───────┘             │
│          ◔◔◔◯◯               │ 20px indicator
│                              │
│         Fair                 │ 24px label
│                              │
│     ↑ +5 pts                 │ 32px trend
│     vs last month            │ 20px subtitle
│                              │
└──────────────────────────────┘
  240px × 200px
  Padding: 16px
  Border: 1px solid #e5e7eb
  Border-radius: 12px
```

**Health Score Colors**:
- 80-100: Green (#10b981) "Excellent"
- 60-79: Yellow (#f59e0b) "Good"
- 40-59: Orange (#fb923c) "Fair"
- 0-39: Red (#ef4444) "Poor"

---

### Metric Card Detail

```
┌────────────────────────────────────────────┐
│ ⚠️ Orphan Notes                             │ 48px
│ ──────────────────────────────────────      │ header
│                                            │
│ 42 notes (3.4%)                            │ 40px
│                                            │ metric
│ ┌────────────────────────────────────────┐ │
│ │                                        │ │
│ │        [LINE CHART]                    │ │
│ │         Trend: 30 days                 │ │ 120px
│ │    48                                  │ │ chart
│ │    ●                                   │ │
│ │   ╱ ╲     ╱╲                          │ │
│ │  ╱   ╲   ╱  ╲   ╱╲                    │ │
│ │ ╱     ╲ ╱    ╲ ╱  ●42                 │ │
│ │──────────────────────────────────────│ │
│ │ Jan 1        Jan 15        Jan 31     │ │
│ │                                        │ │
│ └────────────────────────────────────────┘ │
│                                            │ 16px gap
│ ┌────────────────────────────────────────┐ │
│ │ [View Orphans]                         │ │ 48px
│ └────────────────────────────────────────┘ │ button
│                                            │ 16px gap
│ 💡 Link these notes to improve             │ 56px
│    discoverability and knowledge graph     │ recom.
│                                            │
└────────────────────────────────────────────┘
  480px × 280px
  Padding: 16px
  Border-radius: 12px
```

---

### Action Card Detail

```
┌─────────────────────────────┐
│ 🔴 HIGH PRIORITY            │ 40px
│ ───────────────────────     │ header
│                             │
│ Link 42 orphan notes        │ 32px
│                             │ title
│ Orphaned notes are not      │ 48px
│ connected to the knowledge  │ desc.
│ graph and harder to find.   │
│                             │
│ Impact: High                │ 32px
│ Effort: Medium              │ 32px
│                             │
│ ┌─────────────────────────┐ │
│ │ [Take Action]           │ │ 48px
│ └─────────────────────────┘ │ button
│                             │
└─────────────────────────────┘
  320px × 180px
  Padding: 16px
  Border-radius: 12px
  Border-left: 4px solid (priority color)
```

**Priority Colors**:
- High: #ef4444 (red)
- Medium: #f59e0b (yellow)
- Low: #10b981 (green)

---

## Tablet Layout (640-1024px)

### Stacked Layout

```
┌───────────────────────────────────────────────┐
│ Knowledge Health               [↻] Refresh    │ 64px
├───────────────────────────────────────────────┤
│                                               │
│ ┌──────────┐ ┌──────────┐                    │
│ │ Health   │ │  Total   │                    │ 180px
│ │  Score   │ │  Notes   │                    │
│ │   62     │ │  1,247   │                    │
│ └──────────┘ └──────────┘                    │
│                                               │
│ ┌──────────┐ ┌──────────┐                    │
│ │ Active   │ │   Link   │                    │ 180px
│ │Concepts  │ │ Density  │                    │
│ │   342    │ │   4.2    │                    │
│ └──────────┘ └──────────┘                    │
│                                               │
│ ▼ Metrics                                     │ 48px
│ ─────────────────────────────────────         │
│                                               │
│ ┌───────────────────────────────────────┐   │
│ │ ⚠️ Orphan Notes                        │   │
│ │ 42 notes (3.4%)                       │   │ 240px
│ │ [Chart]                               │   │
│ │ [View Orphans]                        │   │
│ └───────────────────────────────────────┘   │
│                                               │
│ ┌───────────────────────────────────────┐   │
│ │ 📅 Stale Content                       │   │
│ │ 18 notes (1.4%)                       │   │ 240px
│ │ [Chart]                               │   │
│ │ [Review Stale]                        │   │
│ └───────────────────────────────────────┘   │
│                                               │
│ ... more metrics ...                          │
│                                               │
└───────────────────────────────────────────────┘
  2-column grid for overview cards
  Single column for metric cards
  Collapsible sections
```

**Dimensions**:
- Overview cards: 2 columns, equal width
- Metric cards: Full width, stacked
- Section headers: 48px (collapsible)
- Card heights: Same as desktop

---

## Mobile Layout (<640px)

### Mobile Dashboard

```
┌────────────────────────────────────────┐
│ ← Knowledge Health         [↻] Refresh │ 64px
├────────────────────────────────────────┤
│                                        │
│ ┌────────────────────────────────────┐│
│ │ Health Score                       ││
│ │                                    ││
│ │       ┌───┐                        ││
│ │       │62 │  Fair                  ││ 160px
│ │       └───┘  ↑ +5                  ││
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ Total Notes                        ││
│ │ 1,247      Original: 892           ││ 80px
│ │            Revised: 355            ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ Active Concepts                    ││
│ │ 342        Coverage: 68%           ││ 80px
│ │            Orphan: 42              ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ Link Density                       ││
│ │ 4.2        Unlinked: 128           ││ 80px
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │
├────────────────────────────────────────┤ 16px gap
│                                        │
│ ▼ Metrics                              │ 56px
│ ──────────────────────────────────     │
│                                        │
│ ┌────────────────────────────────────┐│
│ │ ⚠️ Orphan Notes                     ││
│ │ ────────────────────────────────   ││
│ │                                    ││
│ │ 42 notes (3.4%)                    ││
│ │                                    ││
│ │ [Mini Chart]                       ││ 200px
│ │                                    ││
│ │ [View Orphans]                     ││
│ │                                    ││
│ │ 💡 Link these notes...             ││
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │ 8px gap
│ ┌────────────────────────────────────┐│
│ │ 📅 Stale Content                    ││
│ │ ────────────────────────────────   ││
│ │                                    ││
│ │ 18 notes (1.4%)                    ││
│ │                                    ││
│ │ [Mini Chart]                       ││ 200px
│ │                                    ││
│ │ [Review Stale]                     ││
│ │                                    ││
│ │ 💡 Consider archiving...           ││
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │
│              ... more ...              │
│                                        │
├────────────────────────────────────────┤ 16px gap
│                                        │
│ ▼ Insights                             │ 56px
│ ──────────────────────────────────     │
│                                        │
│ ┌────────────────────────────────────┐│
│ │ 🔴 HIGH PRIORITY                   ││
│ │ ────────────────────────────────   ││
│ │                                    ││
│ │ Link 42 orphan notes               ││
│ │                                    ││
│ │ Impact: High                       ││ 180px
│ │ Effort: Medium                     ││
│ │                                    ││
│ │ [Take Action]                      ││
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │
│              ... more ...              │
│                                        │
└────────────────────────────────────────┘
```

**Dimensions**:
- Header: 64px height
- Health score card: 160px height (prominent)
- Summary cards: 80px height (compact)
- Metric cards: 200px height
- Action cards: 180px height
- Section headers: 56px (collapsible)
- Gap between cards: 8px
- Horizontal padding: 16px
- All cards full width

---

### Mobile Metric Detail (Expanded)

```
┌────────────────────────────────────────┐
│ ← Back to Dashboard                    │ 64px
├────────────────────────────────────────┤
│                                        │
│ ⚠️ Orphan Notes                         │ 48px
│ ──────────────────────────────────     │
│                                        │
│ 42 notes (3.4% of total)               │ 40px
│                                        │
│ ▼ Trend (Last 30 days)                 │ 48px
│ ─────────────────────────────────      │
│                                        │
│ ┌────────────────────────────────────┐│
│ │                                    ││
│ │        [LINE CHART]                ││
│ │         Full size                  ││ 200px
│ │                                    ││
│ │                                    ││
│ └────────────────────────────────────┘│
│                                        │
│ Peak: 48 (Jan 10)                      │ 32px
│ Current: 42                            │ 32px
│ Average: 45                            │ 32px
│                                        │
│ ▼ Orphan Notes List                    │ 48px
│ ─────────────────────────────────      │
│                                        │
│ ┌────────────────────────────────────┐│
│ │ Note Title Here                    ││
│ │ Created: 3 days ago                ││ 80px
│ │ [View] [Link]                      ││
│ └────────────────────────────────────┘│
│                                        │
│ ┌────────────────────────────────────┐│
│ │ Another Note Title                 ││
│ │ Created: 1 week ago                ││ 80px
│ │ [View] [Link]                      ││
│ └────────────────────────────────────┘│
│                                        │
│              ... more ...              │
│                                        │
│ ┌────────────────────────────────────┐│
│ │ [Link All Orphans (AI Assist)]     ││ 64px
│ └────────────────────────────────────┘│
│                                        │
└────────────────────────────────────────┘
```

---

## Component States

### Health Score Gauge

```
Excellent (80-100):
    ┌───────┐
    │       │
    │  95   │
    │       │
    └───────┘
      ●●●●●
    Excellent
    ↑ +8 pts

Good (60-79):
    ┌───────┐
    │       │
    │  72   │
    │       │
    └───────┘
      ●●●●◯
      Good
    ↑ +5 pts

Fair (40-59):
    ┌───────┐
    │       │
    │  58   │
    │       │
    └───────┘
      ●●●◯◯
      Fair
    ↓ -3 pts

Poor (0-39):
    ┌───────┐
    │       │
    │  28   │
    │       │
    └───────┘
      ●●◯◯◯
      Poor
    ↓ -12 pts

Gauge dimensions:
- Circle: 80px diameter
- Border: 8px width
- Font size: 32px (score)
- Indicators: 12px dots
- Gap: 4px between dots
```

### Metric Status Badges

```
Warning (Needs attention):
┌────────────────┐
│ ⚠️ 42 notes    │ 32px height
└────────────────┘
Background: rgba(245, 158, 11, 0.1)
Border: 1px solid #f59e0b

Error (Critical):
┌────────────────┐
│ ⛔ 18 notes    │ 32px height
└────────────────┘
Background: rgba(239, 68, 68, 0.1)
Border: 1px solid #ef4444

Success (Good):
┌────────────────┐
│ ✓ 892 notes    │ 32px height
└────────────────┘
Background: rgba(16, 185, 129, 0.1)
Border: 1px solid #10b981
```

### Trend Indicators

```
Positive trend:
↑ +5 pts
Color: #10b981 (green)
Icon: Arrow up

Negative trend:
↓ -3 pts
Color: #ef4444 (red)
Icon: Arrow down

Neutral:
→ 0 pts
Color: #6b7280 (gray)
Icon: Arrow right

Size: 14px font, 16px icon
```

---

## Charts & Visualizations

### Line Chart (Trend)

```
┌────────────────────────────────────────┐
│ Health Score Over Time                 │ 24px
├────────────────────────────────────────┤
│                                        │
│ 100 ┤                                  │
│     │                                  │
│  80 ┤                      ╭──╮        │
│     │                      │  │        │
│  60 ┤         ╭────────────╯  ╰─●      │
│     │         │                        │
│  40 ┤  ╭──────╯                        │
│     │  │                               │
│  20 ┤──╯                               │
│     │                                  │
│   0 ┼────────────────────────────────  │
│     Jan 1   Jan 8   Jan 15   Jan 31   │
│                                        │
└────────────────────────────────────────┘
  Height: 200px
  Padding: 16px
  Line width: 2px
  Point radius: 4px
  Grid lines: rgba(229, 231, 235, 0.5)
```

### Bar Chart (Distribution)

```
┌────────────────────────────────────────┐
│ Link Score Distribution                │ 24px
├────────────────────────────────────────┤
│                                        │
│ 0.9-1.0  ███████████ 234               │ 32px
│                                        │
│ 0.7-0.9  █████████████████ 412         │ 32px
│                                        │
│ 0.5-0.7  ██████ 186                    │ 32px
│                                        │
│ 0.3-0.5  ███ 78                        │ 32px
│                                        │
│ 0.0-0.3  █ 12                          │ 32px
│                                        │
└────────────────────────────────────────┘
  Height: Auto (32px per bar)
  Bar height: 24px
  Gap: 8px
  Label width: 80px
  Bar color: #3b82f6
```

### Gauge Chart (Coverage)

```
┌────────────────────────────────────────┐
│ Tag Coverage                           │ 24px
├────────────────────────────────────────┤
│                                        │
│         ┌───────────┐                  │
│         │           │                  │
│         │    58%    │                  │ 100px
│         │  ◔◔◔◯◯    │                  │
│         └───────────┘                  │
│                                        │
│    Poor    Fair    Good   Excellent    │ 20px
│     0%     40%     70%      90%        │
│                                        │
└────────────────────────────────────────┘
  Gauge size: 100px diameter
  Arc angle: 180° (semicircle)
  Thickness: 12px
  Color gradient:
    - Red (0-40%)
    - Yellow (40-70%)
    - Green (70-100%)
```

### Activity Heatmap

```
┌────────────────────────────────────────────────────────────┐
│ Activity Last 30 Days                                      │ 24px
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Mon  ░ ▓ ░ ░ █ ░ ▓ ▓ ░ █ ░ ░ ▓ █ ░ ░ ▓ ░ ░ ▓ ░ █ ▓ ░ ░ ▓ │ 20px
│ Tue  ▓ ░ ░ █ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ▓ ░ ▓ ░ ░ █ ░ ▓ ░ ░ ▓ ░ ░ │ 20px
│ Wed  ░ ░ ▓ ░ ░ ░ █ ░ ░ ▓ █ ░ ░ ░ ▓ ░ █ ░ ░ ▓ ░ ░ █ ░ ▓ ░ │ 20px
│ Thu  ░ ▓ ░ ░ ▓ ░ ░ █ ░ ░ ▓ ░ █ ░ ░ ▓ ░ ░ ▓ ░ █ ░ ░ ▓ ░ ░ │ 20px
│ Fri  █ ░ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ▓ ░ ░ ▓ ░ █ ░ ░ ▓ ░ ░ █ ░ ▓ ░ │ 20px
│ Sat  ░ ░ ░ ░ ░ ▓ ░ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ░ │ 20px
│ Sun  ░ ░ ▓ ░ ░ ░ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ░ ▓ ░ ░ ▓ ░ ░ █ ░ ░ ▓ │ 20px
│                                                            │
│ ░ None   ▓ Low   ▓ Med   █ High                           │ 24px
│                                                            │
└────────────────────────────────────────────────────────────┘
  Cell size: 16px × 16px
  Gap: 4px
  Colors:
    - None: #f3f4f6
    - Low: #c7d2fe
    - Medium: #818cf8
    - High: #4f46e5
  Hover: Tooltip with date and count
```

---

## Empty States

### No Data Yet

```
┌────────────────────────────────────────┐
│                                        │
│             📊                         │ 64px
│                                        │
│    Not Enough Data Yet                 │ 24px
│                                        │
│    Create more notes to see your       │ 16px
│    knowledge health metrics.           │
│                                        │
│    Current notes: 5                    │ 16px
│    Minimum required: 20                │
│                                        │
│    [Create Note]                       │ 48px
│                                        │
└────────────────────────────────────────┘
  Centered, max-width 400px
```

### Perfect Health

```
┌────────────────────────────────────────┐
│                                        │
│             ✨                         │ 64px
│                                        │
│    Perfect Knowledge Health!           │ 24px
│                                        │
│    Your knowledge base is in           │ 16px
│    excellent condition. All notes      │
│    are linked, tagged, and fresh.      │
│                                        │
│    Keep up the great work!             │ 16px
│                                        │
└────────────────────────────────────────┘
```

---

## Accessibility Specifications

### ARIA Attributes

**Health Score Gauge**:
```html
<div
  role="meter"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow="62"
  aria-valuetext="62 out of 100, Fair health score"
>
```

**Metric Card**:
```html
<article
  aria-labelledby="orphan-notes-heading"
  aria-describedby="orphan-notes-description"
>
  <h3 id="orphan-notes-heading">Orphan Notes</h3>
  <p id="orphan-notes-description">
    42 notes that are not linked to other notes
  </p>
</article>
```

**Chart**:
```html
<figure role="img" aria-labelledby="chart-title">
  <figcaption id="chart-title">
    Health score trend over last 30 days, currently 62
  </figcaption>
  <!-- Chart SVG -->
  <!-- Fallback table in <details> -->
</figure>
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Navigate between cards and actions |
| Enter | Activate focused action button |
| Space | Toggle section expansion |
| 1-4 | Jump to overview card (1=Health, etc) |
| M | Jump to Metrics section |
| I | Jump to Insights section |
| T | Jump to Trends section |
| R | Refresh dashboard |
| Escape | Close expanded views |

### Screen Reader Announcements

```
"Knowledge Health Dashboard. Health score: 62 out of 100, Fair.
 Up 5 points from last month."

"Orphan Notes metric. 42 notes, 3.4% of total.
 Warning: These notes need attention.
 View Orphans button available."

"High priority action: Link 42 orphan notes.
 Impact: High. Effort: Medium. Take Action button."

"Dashboard refreshed. Health score updated to 65."
```

---

## Responsive Breakpoints

| Breakpoint | Width | Overview Grid | Metrics Grid | Actions Grid |
|------------|-------|---------------|--------------|--------------|
| Mobile | <640px | 1 column | 1 column | 1 column |
| Tablet | 640-1024px | 2 columns | 1-2 columns | 1-2 columns |
| Desktop | >1024px | 4 columns | 2 columns | 3 columns |
| Large | >1440px | 4 columns | 2 columns | 3 columns |

---

## Animation Specifications

### Card Entrance

```css
animation: fade-slide-up 400ms ease-out;
animation-delay: calc(var(--index) * 50ms);

@keyframes fade-slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Health Score Count-Up

```css
/* Number animates from 0 to current value */
animation: count-up 1000ms ease-out;

/* Implement with JavaScript:
   - Start at 0
   - Increment to target over 1s
   - Use easeOutCubic easing
*/
```

### Chart Line Draw

```css
/* SVG path draws from left to right */
animation: draw-line 1500ms ease-out;

@keyframes draw-line {
  from {
    stroke-dashoffset: 1000;
  }
  to {
    stroke-dashoffset: 0;
  }
}
```

### Refresh Pulse

```css
/* Refresh button pulses on click */
animation: pulse 600ms ease-out;

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}
```

---

## Color Specifications

```css
/* Status Colors */
--color-excellent: #10b981;
--color-good: #22c55e;
--color-fair: #f59e0b;
--color-poor: #ef4444;

/* Priority Colors */
--color-priority-high: #ef4444;
--color-priority-medium: #f59e0b;
--color-priority-low: #10b981;

/* Chart Colors */
--color-chart-primary: #3b82f6;
--color-chart-secondary: #8b5cf6;
--color-chart-tertiary: #06b6d4;
--color-chart-grid: rgba(229, 231, 235, 0.5);

/* Card Colors */
--color-card-bg: #ffffff;
--color-card-border: #e5e7eb;
--color-card-shadow: rgba(0, 0, 0, 0.05);

/* Heatmap Colors */
--color-heatmap-none: #f3f4f6;
--color-heatmap-low: #c7d2fe;
--color-heatmap-medium: #818cf8;
--color-heatmap-high: #4f46e5;
```

---

## Typography

```css
/* Dashboard Title */
--font-title: 24px / 32px, font-weight: 700;

/* Card Headers */
--font-card-header: 16px / 24px, font-weight: 600;

/* Metrics */
--font-metric-large: 32px / 40px, font-weight: 700;
--font-metric-medium: 20px / 28px, font-weight: 600;
--font-metric-small: 14px / 20px, font-weight: 500;

/* Body Text */
--font-body: 14px / 20px, font-weight: 400;

/* Labels */
--font-label: 12px / 16px, font-weight: 500;

/* Recommendations */
--font-recommendation: 13px / 18px, font-weight: 400;
```

---

## Performance Considerations

1. **Lazy Chart Rendering**: Render charts on scroll (IntersectionObserver)
2. **Cached Metrics**: 5-minute cache, background refresh
3. **Progressive Loading**: Load overview cards first, then metrics
4. **Debounced Refresh**: 500ms debounce on manual refresh
5. **Virtual Scrolling**: For long lists (>50 items) in metric details
6. **Chart Optimization**: Canvas for complex charts, SVG for simple ones
7. **Data Aggregation**: Pre-aggregate metrics on backend

---

## Implementation Notes

1. **Chart Library**: Recharts or Chart.js (React-friendly)
2. **Gauge Component**: Custom SVG or react-circular-progressbar
3. **Heatmap**: Custom component or react-calendar-heatmap
4. **Data Refresh**: WebSocket for real-time updates (optional)
5. **Export**: jsPDF for PDF export, PapaParse for CSV
6. **Scheduling**: Backend cron for scheduled reports
7. **Sharing**: Generate shareable link with snapshot data

---

## Related Specifications

- [UX Design Document](../fortemi-integration-ux-design.md)
- [Knowledge Health API](/mnt/dev-inbox/fortemi/fortemi/docs/content/api.md#health-endpoints)
- [SKOS Browser Wireframe](./01-skos-concept-browser.md) (Orphan concepts)
