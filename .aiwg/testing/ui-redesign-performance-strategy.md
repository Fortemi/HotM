# UI Redesign Performance Validation Strategy - HOTM-014

**Document Type**: SDLC Artifact - Quality Assurance
**Phase**: Construction (Iteration 2+)
**Version**: 1.0
**Date**: 2025-02-05
**Status**: BASELINE
**Primary Author**: Test Architect
**Project**: HotM Hall of the Mind - React 19 SPA

---

## Executive Summary

This performance validation strategy defines how quality will be measured and assured for the HotM UI Redesign (HOTM-014), ensuring the React 19 + Vite + TailwindCSS single-page application meets all non-functional requirements (NFR-001) while handling complex features like graph visualization, memory search, timeline views, and knowledge health dashboards.

**Key Performance Targets**:
- **Page Load (LCP)**: < 2.5 seconds
- **Search Response**: < 500ms
- **Graph Render**: < 1 second for 500 nodes
- **Bundle Size**: < 500KB gzipped

**Strategy Approach**:
1. **Core Web Vitals** (LCP, FID, CLS) with Lighthouse CI integration
2. **Custom Metrics** for each redesign feature (graph, map, timeline, dashboard)
3. **Real User Monitoring** for production validation
4. **Synthetic Monitoring** for continuous regression detection
5. **Optimization Roadmap** with code splitting, lazy loading, and Web Worker offloading

---

## 1. Performance Metrics Definition

### 1.1 Core Web Vitals (Google Metrics)

All Core Web Vitals targets are **blocking gate criteria** - code cannot merge to main without validation.

| Metric | Abbreviation | Target | What It Measures | Monitoring Tool |
|--------|--------------|--------|------------------|-----------------|
| **Largest Contentful Paint** | LCP | < 2.5s | When largest visual element loads | Lighthouse, Web Vitals API |
| **First Input Delay** | FID | < 100ms | Delay between user input and response | Web Vitals API (deprecated → INP) |
| **Interaction to Next Paint** | INP | < 200ms | Time from user interaction to visual feedback | Web Vitals API (replacement for FID) |
| **Cumulative Layout Shift** | CLS | < 0.1 | Unexpected visual shifts during page load | Lighthouse, Web Vitals API |

**Google's Research Basis**:
- LCP < 2.5s = "Good" (top 75th percentile)
- FID/INP < 100ms = User perceives response as instantaneous
- CLS < 0.1 = No perceptible layout thrashing

### 1.2 Route-Specific Bundle Metrics

Each route must maintain < 300KB gzipped to support < 2.5s LCP on 4G networks.

| Route | Current | Target | Optimization Strategy |
|-------|---------|--------|----------------------|
| **Main (Landing/Notes List)** | (TBD) | 150KB | Core-only, defer visualizations |
| **Graph Explorer** | (TBD) | 120KB | Lazy-load Cytoscape.js + plugins |
| **Memory Search (Map)** | (TBD) | 100KB | Lazy-load Leaflet.js |
| **Timeline View** | (TBD) | 80KB | Lazy-load virtual scroll lib |
| **Knowledge Health Dashboard** | (TBD) | 100KB | Lazy-load chart library |

**Total Application Bundle**: < 500KB gzipped (including all routes' base requirements)

### 1.3 Custom Performance Metrics for Complex Features

**Graph Explorer (HOTM-004) - Cytoscape.js**

| Metric | Target | How to Measure | Acceptable Range |
|--------|--------|-----------------|-----------------|
| Graph render time (100 nodes) | < 1000ms | `performance.measure()` in component | 800-1200ms (P95) |
| Graph render time (500 nodes) | < 2000ms | Same | 1500-2500ms (P95) |
| Frame rate during pan/zoom | 60 FPS | Chrome DevTools Performance tab | ≥ 55 FPS sustained |
| Memory consumption | < 150MB | Chrome Task Manager | Stable after 5 min interaction |
| Interaction response (click node) | < 100ms | Event listener to visual feedback | < 150ms (P95) |

**Memory Search (HOTM-003) - Leaflet.js with Markers**

| Metric | Target | How to Measure | Acceptable Range |
|--------|--------|-----------------|-----------------|
| Map render time (1000 markers) | < 1500ms | `performance.measure()` | 1000-2000ms (P95) |
| Marker cluster generation | < 800ms | Measure clustering algorithm | < 1000ms (P95) |
| Zoom response (cluster expand) | < 200ms | Time from click to animation | < 300ms (P95) |
| Frame rate during pan | 60 FPS | DevTools Performance | ≥ 55 FPS |
| Memory with 1000 markers | < 100MB | Task Manager | Stable |

**Timeline View (HOTM-007) - Virtual Scrolling**

| Metric | Target | How to Measure | Acceptable Range |
|--------|--------|-----------------|-----------------|
| Initial render | < 500ms | `performance.measure()` | < 800ms (P95) |
| Scroll FPS | 60 FPS | DevTools Performance during scroll | ≥ 55 FPS |
| Infinite scroll load | < 300ms | Measure fetch + render batch | < 500ms (P95) |
| Memory (1000 items visible window) | < 80MB | Task Manager | < 150MB (P95) |
| Scroll jank detection | 0 long tasks | DevTools > Performance | Must be 0 |

**Knowledge Health Dashboard (HOTM-002) - Multiple Visualizations**

| Metric | Target | How to Measure | Acceptable Range |
|--------|--------|-----------------|-----------------|
| Dashboard initial load | < 1500ms | `performance.measure()` | < 2000ms (P95) |
| Chart render (line, bar, pie) | < 800ms | Each chart measure separately | < 1200ms (P95) |
| Data refresh on filter change | < 400ms | Measure from filter select to re-render | < 600ms (P95) |
| Memory with all visualizations | < 120MB | Task Manager | < 200MB (P95) |
| Animation smoothness | 60 FPS | Chart transitions during resize | ≥ 55 FPS |

### 1.4 Search Response Metrics

**API Layer** (Fortemi backend - not SPA responsibility, but monitored):

| Operation | Target | Validation Method |
|-----------|--------|-------------------|
| Full-text search (< 100 notes) | < 300ms | Lighthouse API timing |
| Semantic search (< 100 notes) | < 500ms | Custom performance markers |
| Hybrid search (FTS + semantic) | < 500ms | Performance API in React component |
| Typeahead suggestions (< 20 results) | < 200ms | Measure from keystroke to dropdown |

**React Component Layer**:

| Operation | Target | Validation Method |
|-----------|--------|-------------------|
| Search input debounce + render | < 200ms | React DevTools Profiler |
| Result list virtualization | < 100ms | Performance markers |
| Filter/sort application | < 300ms | Measure on filter selection |

### 1.5 Accessibility Performance Metrics

**Screen Reader Support**:

| Metric | Target | How to Measure |
|--------|--------|-----------------|
| DOM accessibility tree build | < 500ms | Accessibility Insights, ARIA scanner |
| Screen reader announcement latency | < 300ms | NVDA/JAWS with timing markers |
| Keyboard navigation response | < 100ms | User timing API on keydown |

**Reduced Motion Support**:

| Metric | Target | How to Measure |
|--------|--------|-----------------|
| Page load with prefers-reduced-motion | < 2.5s LCP | Lighthouse with reduced motion enabled |
| CSS animation replacement | < 100ms | Transition to static layout |

---

## 2. Testing Approach

### 2.1 Multi-Level Performance Testing Strategy

**Test Pyramid for Performance**:

```
                    ▲
                   ╱ ╲
                  ╱   ╲  Manual E2E Performance
                 ╱     ╲ Testing (Real devices)
                ╱───────╲
               ╱         ╲ Synthetic Performance Tests
              ╱           ╱ (CI/CD metrics)
             ╱───────────╱
            ╱           ╱  Automated Performance Metrics
           ╱           ╱   (Lighthouse CI, bundlesize)
          ╱───────────╱
```

### 2.2 Lighthouse CI Integration (Automated Gate)

**Implementation**:

```yaml
# lighthouserc.json - Version control committed
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:5173/",
        "http://localhost:5173/graph-explorer",
        "http://localhost:5173/memory-search",
        "http://localhost:5173/timeline",
        "http://localhost:5173/knowledge-health"
      ],
      "configPath": "./lighthouserc-config.json",
      "numberOfRuns": 3,
      "settings": {
        "runs": 3,
        "configPath": "./ci-config.json"
      }
    },
    "upload": {
      "target": "filesystem",
      "outputDir": "./coverage/lighthouse"
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.85}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "first-contentful-paint": ["error", {"maxNumericValue": 1800}],
        "speed-index": ["error", {"maxNumericValue": 3000}],
        "interactive": ["error", {"maxNumericValue": 3800}],
        "total-byte-weight": ["error", {"maxNumericValue": 500000}]
      }
    }
  }
}
```

**CI/CD Gate in `.github/workflows/frontend-tests.yml`**:

```yaml
- name: Run Lighthouse CI
  uses: treosh/lighthouse-ci-action@v10
  with:
    configPath: './ui/lighthouserc.json'
    uploadArtifacts: true
    temporaryPublicStorage: true
    runs: 3

- name: Lighthouse Assert
  run: |
    lhci assert --configPath=./ui/lighthouserc.json --uploadDir=./coverage/lighthouse
```

**What This Validates**:
- LCP < 2.5s on every merge to main
- Bundle size < 500KB on every merge
- CLS < 0.1 (no layout shifts)
- FCP < 1.8s
- All routes included in test matrix

### 2.3 Bundle Size Monitoring

**Tool**: `bundlesize` npm package (or Vite plugin)

**Configuration** (`ui/bundlesize.config.json`):

```json
{
  "files": [
    {
      "path": "./dist/index.*.js",
      "maxSize": "150 kB",
      "name": "Main Bundle"
    },
    {
      "path": "./dist/graph-explorer-*.js",
      "maxSize": "120 kB",
      "name": "Graph Explorer Chunk"
    },
    {
      "path": "./dist/memory-search-*.js",
      "maxSize": "100 kB",
      "name": "Memory Search Chunk"
    },
    {
      "path": "./dist/timeline-*.js",
      "maxSize": "80 kB",
      "name": "Timeline Chunk"
    },
    {
      "path": "./dist/dashboard-*.js",
      "maxSize": "100 kB",
      "name": "Dashboard Chunk"
    },
    {
      "path": "./dist/**/*.js",
      "maxSize": "500 kB",
      "name": "Total JS (gzipped)"
    }
  ]
}
```

**CI Integration**:

```bash
# Add to npm scripts in ui/package.json
"bundlesize": "bundlesize"
```

### 2.4 Custom Performance Test Suite (Vitest)

Create `ui/src/__tests__/performance/` directory for performance-focused tests.

**Example Test: Graph Explorer Render Performance**

```typescript
// ui/src/__tests__/performance/graph-explorer.perf.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { GraphExplorer } from '../../components/GraphExplorer';

describe('GraphExplorer Performance', () => {
  let startMark: number;
  let endMark: number;

  beforeEach(() => {
    // Clear performance buffer
    performance.clearMarks();
    performance.clearMeasures();
  });

  it('should render 100-node graph within 1000ms', async () => {
    const mockNodes = Array.from({ length: 100 }, (_, i) => ({
      id: `node-${i}`,
      label: `Node ${i}`,
      data: { score: Math.random() }
    }));

    const mockEdges = Array.from({ length: 150 }, (_, i) => ({
      source: `node-${Math.floor(Math.random() * 100)}`,
      target: `node-${Math.floor(Math.random() * 100)}`
    }));

    performance.mark('graph-render-start');

    const { container } = render(
      <GraphExplorer nodes={mockNodes} edges={mockEdges} />
    );

    // Allow React to settle
    await new Promise(resolve => setTimeout(resolve, 100));

    performance.mark('graph-render-end');
    performance.measure('graph-render', 'graph-render-start', 'graph-render-end');

    const measure = performance.getEntriesByName('graph-render')[0];

    expect(measure.duration).toBeLessThan(1000);
    console.log(`Graph (100 nodes) rendered in ${measure.duration.toFixed(2)}ms`);
  });

  it('should render 500-node graph within 2000ms', async () => {
    const mockNodes = Array.from({ length: 500 }, (_, i) => ({
      id: `node-${i}`,
      label: `Node ${i}`,
      data: { score: Math.random() }
    }));

    const mockEdges = Array.from({ length: 750 }, (_, i) => ({
      source: `node-${Math.floor(Math.random() * 500)}`,
      target: `node-${Math.floor(Math.random() * 500)}`
    }));

    performance.mark('graph-large-start');

    const { container } = render(
      <GraphExplorer nodes={mockNodes} edges={mockEdges} />
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    performance.mark('graph-large-end');
    performance.measure('graph-large', 'graph-large-start', 'graph-large-end');

    const measure = performance.getEntriesByName('graph-large')[0];

    expect(measure.duration).toBeLessThan(2000);
    console.log(`Graph (500 nodes) rendered in ${measure.duration.toFixed(2)}ms`);
  });

  it('should maintain 60 FPS during pan/zoom interaction', async () => {
    // This test measures frame rate using requestAnimationFrame
    // (Note: Vitest environment doesn't have rAF, use jsdom with real timers)
    const fpsCount = { count: 0, lastTime: performance.now() };
    const frameTimestamps: number[] = [];

    const measureFrame = () => {
      const now = performance.now();
      frameTimestamps.push(now - fpsCount.lastTime);
      fpsCount.lastTime = now;

      if (frameTimestamps.length < 120) {
        requestAnimationFrame(measureFrame);
      }
    };

    requestAnimationFrame(measureFrame);

    // Simulate pan/zoom gestures...
    // (In real E2E tests, use Playwright)

    // Calculate FPS from frame durations
    const avgFrameTime = frameTimestamps.reduce((a, b) => a + b, 0) / frameTimestamps.length;
    const fps = 1000 / avgFrameTime;

    expect(fps).toBeGreaterThan(55);
    console.log(`Average FPS: ${fps.toFixed(1)}`);
  });

  it('should not exceed 150MB memory with 500-node graph', async () => {
    // Note: Memory testing requires Node.js APIs
    if (typeof process !== 'undefined') {
      const initialMemory = process.memoryUsage().heapUsed;

      const mockNodes = Array.from({ length: 500 }, (_, i) => ({
        id: `node-${i}`,
        label: `Node ${i}`.repeat(10), // Add some data
        data: { score: Math.random(), metadata: {} }
      }));

      const mockEdges = Array.from({ length: 750 }, (_, i) => ({
        source: `node-${Math.floor(Math.random() * 500)}`,
        target: `node-${Math.floor(Math.random() * 500)}`
      }));

      render(<GraphExplorer nodes={mockNodes} edges={mockEdges} />);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryDelta).toBeLessThan(150);
      console.log(`Memory usage: ${memoryDelta.toFixed(2)}MB`);
    }
  });
});
```

**Example Test: Timeline Virtual Scrolling Performance**

```typescript
// ui/src/__tests__/performance/timeline.perf.test.tsx
describe('Timeline Virtual Scrolling Performance', () => {
  it('should render initial batch within 500ms', () => {
    const mockItems = Array.from({ length: 1000 }, (_, i) => ({
      id: `item-${i}`,
      timestamp: new Date(Date.now() - i * 60000),
      content: `Timeline item ${i}`
    }));

    performance.mark('timeline-render-start');

    const { container } = render(
      <Timeline items={mockItems} windowSize={20} />
    );

    performance.mark('timeline-render-end');
    const measure = performance.getEntriesByName('timeline-render')[0];

    expect(measure.duration).toBeLessThan(500);
  });

  it('should not create long tasks during scroll', async () => {
    const items = Array.from({ length: 2000 }, (_, i) => ({
      id: `item-${i}`,
      timestamp: new Date(),
      content: `Item ${i}`
    }));

    const { container } = render(
      <Timeline items={items} windowSize={20} />
    );

    const scrollContainer = container.querySelector('[data-testid="scroll-container"]');

    if (scrollContainer) {
      // Measure task duration during scroll
      performance.mark('scroll-start');

      scrollContainer.dispatchEvent(
        new Event('scroll', {
          bubbles: true,
          detail: { target: { scrollTop: 5000 } }
        })
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      performance.mark('scroll-end');
      const measure = performance.getEntriesByName('scroll')[0];

      // Long tasks are > 50ms
      expect(measure.duration).toBeLessThan(50);
    }
  });
});
```

### 2.5 Load Testing for Complex Visualizations

**Tool**: Artillery.io for API-level load testing + Lighthouse for rendering

**Configuration** (`tests/performance/load-test.yml`):

```yaml
config:
  target: "http://localhost:3000/api/v1"
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warmup"
    - duration: 300
      arrivalRate: 10
      name: "Sustained Load"
    - duration: 60
      arrivalRate: 20
      name: "Peak Load"
  processor: "./load-test-processor.js"
  variables:
    searchTerms:
      - "machine learning"
      - "neural networks"
      - "data science"

scenarios:
  - name: "Search Heavy Load"
    flow:
      - post:
          url: "/search"
          json:
            query: "{{ searchTerms }}"
          think: 2
          capture:
            json: "$.results[0].id"
            as: "noteId"

  - name: "Graph Render Load"
    flow:
      - get:
          url: "/notes/{{ noteId }}/related?limit=500"
          think: 3
```

**Run Load Test**:

```bash
cd ui
npx artillery run tests/performance/load-test.yml
```

**Success Criteria**:
- P95 response time < 500ms at 10 req/s
- P99 response time < 1000ms at 10 req/s
- Error rate < 0.1% across all phases

### 2.6 Memory Leak Detection

**Tool**: Chrome DevTools + Playwright for automated detection

**Manual Test Procedure**:

```bash
1. Open Chrome DevTools (F12)
2. Go to Memory tab
3. Click "Record allocation timeline"
4. Interact with graph (pan, zoom, click nodes) for 5 minutes
5. Click "Stop"
6. Check for memory growth pattern
7. Force garbage collection (trash icon)
8. Verify memory returns to baseline

PASS: Memory baseline returns after GC
FAIL: Memory continuously grows (leak detected)
```

**Automated Detection with Playwright** (E2E test):

```typescript
// ui/tests/performance/memory-leak.spec.ts
import { test, expect } from '@playwright/test';

test('Graph Explorer should not leak memory', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect memory samples
  const memoryReadings: number[] = [];

  await page.goto('http://localhost:5173/graph-explorer');

  // Initial load
  await page.waitForLoadState('networkidle');

  // Measure initial memory
  const initialMemory = await page.evaluate(() => {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize / 1048576; // MB
    }
    return 0;
  });

  memoryReadings.push(initialMemory);

  // Simulate 5 minutes of interaction
  for (let i = 0; i < 10; i++) {
    // Pan action
    await page.evaluate(() => {
      const event = new WheelEvent('wheel', {
        deltaY: 100,
        bubbles: true
      });
      document.querySelector('canvas')?.dispatchEvent(event);
    });

    await page.waitForTimeout(1000);

    // Zoom action
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(1000);

    // Click node
    await page.click('text=Node');
    await page.waitForTimeout(1000);

    // Measure memory
    const currentMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize / 1048576; // MB
      }
      return 0;
    });

    memoryReadings.push(currentMemory);

    // Force GC if available
    await page.evaluate(() => {
      if (window.gc) {
        (window as any).gc();
      }
    });

    await page.waitForTimeout(500);
  }

  // Analyze memory trend
  const memoryGrowth = memoryReadings[memoryReadings.length - 1] - initialMemory;
  const avgGrowthPerIteration = memoryGrowth / memoryReadings.length;

  // FAIL if average growth > 5MB per iteration
  expect(avgGrowthPerIteration).toBeLessThan(5);

  console.log(`Memory readings: ${memoryReadings.map(m => m.toFixed(1)).join(' → ')} MB`);
  console.log(`Total growth: ${memoryGrowth.toFixed(1)}MB over ${memoryReadings.length} samples`);

  await context.close();
});
```

---

## 3. Monitoring Strategy

### 3.1 Real User Monitoring (RUM)

**Implementation**: Web Vitals API + Custom Event Tracking

```typescript
// ui/src/monitoring/web-vitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function initializeWebVitalsMonitoring() {
  // Core Web Vitals
  getCLS(metric => {
    console.log('CLS:', metric.value, 'delta:', metric.delta);
    reportToAnalytics('web-vital', {
      metric: 'CLS',
      value: metric.value,
      timestamp: metric.startTime
    });
  });

  getFCP(metric => {
    console.log('FCP:', metric.value);
    reportToAnalytics('web-vital', {
      metric: 'FCP',
      value: metric.value,
      timestamp: metric.startTime
    });
  });

  getLCP(metric => {
    console.log('LCP:', metric.value);
    reportToAnalytics('web-vital', {
      metric: 'LCP',
      value: metric.value,
      timestamp: metric.startTime
    });
  });

  getTTFB(metric => {
    console.log('TTFB:', metric.value);
    reportToAnalytics('web-vital', {
      metric: 'TTFB',
      value: metric.value,
      timestamp: metric.startTime
    });
  });

  // New Interaction to Next Paint (INP)
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'first-input' || entry.entryType === 'event') {
        reportToAnalytics('interaction', {
          duration: entry.duration,
          timestamp: entry.startTime
        });
      }
    }
  });

  observer.observe({ entryTypes: ['first-input', 'event'] });
}

function reportToAnalytics(type: string, data: any) {
  // Send to analytics backend or logging service
  console.log(`[ANALYTICS] ${type}:`, data);

  // Example: Send to custom endpoint
  navigator.sendBeacon('/api/v1/analytics/perf', JSON.stringify({
    type,
    data,
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent
  }));
}
```

**Implementation in App Root**:

```typescript
// ui/src/App.tsx
import { useEffect } from 'react';
import { initializeWebVitalsMonitoring } from './monitoring/web-vitals';

export function App() {
  useEffect(() => {
    // Initialize RUM on app load
    initializeWebVitalsMonitoring();
  }, []);

  return (
    // ... app components
  );
}
```

**RUM Data Collection Dashboard** (Future - production phase):

Metrics to track:
- P50, P75, P90, P95 Web Vitals by device type
- Geographic distribution of performance
- Browser/OS breakdown
- Device performance segments (fast/mid/slow)

### 3.2 Synthetic Monitoring (CI/CD + Scheduled)

**Lighthouse CI** (runs on every merge):
- Validates all performance assertions
- Blocks merge if LCP > 2.5s
- Blocks merge if bundle > 500KB
- Generates HTML report for inspection

**Scheduled Daily Runs**:

```yaml
# .github/workflows/performance-monitoring.yml
name: Daily Performance Monitoring

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: cd ui && npm ci

      - name: Build production bundle
        run: cd ui && npm run build

      - name: Start dev server
        run: cd ui && npm run preview &

      - name: Wait for server
        run: sleep 5

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v10
        with:
          configPath: './ui/lighthouserc.json'
          uploadArtifacts: true

      - name: Comment on PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            // Post performance results as comment
            const results = require('./coverage/lighthouse/results.json');
            const comment = `## Performance Results\n\n- LCP: ${results[0].lhr.metrics.largestContentfulPaint}ms\n- CLS: ${results[0].lhr.metrics.cumulativeLayoutShift}`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### 3.3 Performance Regression Alerts

**Alert Thresholds**:

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| LCP regression > 200ms | Send Slack notification | Investigate PR |
| Bundle size increase > 20KB | Block merge | Must optimize first |
| CLS regression > 0.05 | Send notification | Review layout shifts |
| Memory growth > 30% on same load | Send notification | Check for leaks |

**Implementation** (GitHub Actions):

```yaml
- name: Check Performance Regressions
  run: |
    CURRENT_LCP=$(jq '.metrics.largestContentfulPaint' coverage/lighthouse/results.json)
    BASELINE_LCP=2500

    if (( $(echo "$CURRENT_LCP > $BASELINE_LCP" | bc -l) )); then
      echo "❌ LCP regression detected: ${CURRENT_LCP}ms (target: 2500ms)"
      exit 1
    fi
```

---

## 4. Optimization Techniques & Implementation Roadmap

### 4.1 Code Splitting Strategy

**Goal**: Reduce initial bundle from ~500KB to < 150KB main bundle

**Implementation** (React Router lazy loading):

```typescript
// ui/src/routes.tsx
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

// Main routes (always loaded)
import NotesListPage from './pages/NotesListPage';
import NotePage from './pages/NotePage';

// Feature routes (lazy-loaded)
const GraphExplorerPage = lazy(() => import('./pages/GraphExplorerPage'));
const MemorySearchPage = lazy(() => import('./pages/MemorySearchPage'));
const TimelineViewPage = lazy(() => import('./pages/TimelineViewPage'));
const KnowledgeHealthPage = lazy(() => import('./pages/KnowledgeHealthPage'));

// Loading fallback
const LoadingFallback = () => <div>Loading...</div>;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<NotesListPage />} />
      <Route path="/notes/:id" element={<NotePage />} />

      {/* Lazy-loaded routes */}
      <Route
        path="/graph-explorer"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <GraphExplorerPage />
          </Suspense>
        }
      />

      <Route
        path="/memory-search"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <MemorySearchPage />
          </Suspense>
        }
      />

      <Route
        path="/timeline"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <TimelineViewPage />
          </Suspense>
        }
      />

      <Route
        path="/knowledge-health"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <KnowledgeHealthPage />
          </Suspense>
        }
      />
    </Routes>
  );
}
```

**Vite Configuration for Code Splitting** (`ui/vite.config.ts`):

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split vendor packages into separate chunks
          if (id.includes('node_modules')) {
            if (id.includes('cytoscape')) return 'graph-explorer';
            if (id.includes('leaflet')) return 'memory-search';
            if (id.includes('react-window')) return 'timeline';
            if (id.includes('recharts')) return 'dashboard';
            if (id.includes('@radix-ui')) return 'ui-lib';
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 600,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        pure_funcs: ['console.log', 'console.debug']
      }
    }
  }
});
```

### 4.2 Lazy Loading Patterns

**Component-Level Lazy Loading**:

```typescript
// ui/src/components/GraphExplorer/index.tsx
import { memo, lazy, Suspense } from 'react';

const CytoscapeContainer = lazy(() => import('./CytoscapeContainer'));

export const GraphExplorer = memo(({ data }: Props) => {
  return (
    <Suspense fallback={<div>Loading graph...</div>}>
      <CytoscapeContainer data={data} />
    </Suspense>
  );
});
```

**Dynamic Imports for Heavy Libraries**:

```typescript
// Delay library loading until needed
export async function loadCytoscape() {
  const cytoscape = await import('cytoscape');
  return cytoscape.default;
}

// Usage in component
useEffect(() => {
  loadCytoscape().then(cy => {
    // Initialize only when needed
    initializeGraph(cy);
  });
}, []);
```

**Intersection Observer for Below-Fold Content**:

```typescript
// ui/src/hooks/useIntersectionLoader.ts
export function useIntersectionLoader(ref: RefObject<HTMLElement>) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '100px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [ref]);

  return isVisible;
}

// Usage: Only render dashboard charts when visible
const dashboardRef = useRef(null);
const isDashboardVisible = useIntersectionLoader(dashboardRef);

return (
  <div ref={dashboardRef}>
    {isDashboardVisible && <KnowledgeHealthDashboard />}
  </div>
);
```

### 4.3 Virtual Scrolling Implementation (Timeline)

**Using react-window for Timeline View**:

```typescript
// ui/src/components/TimelineView/VirtualizedTimeline.tsx
import { FixedSizeList } from 'react-window';
import { memo } from 'react';

const Row = memo(({ index, style, data }: any) => (
  <div style={style} className="timeline-item">
    <div className="timestamp">{data[index].timestamp}</div>
    <div className="content">{data[index].content}</div>
  </div>
));

export const VirtualizedTimeline = ({ items }: { items: TimelineItem[] }) => {
  return (
    <FixedSizeList
      height={800}
      itemCount={items.length}
      itemSize={60}
      width="100%"
      itemData={items}
    >
      {Row}
    </FixedSizeList>
  );
};
```

**Infinite Scroll with Virtual Scrolling**:

```typescript
// ui/src/components/TimelineView/InfiniteTimeline.tsx
import { useCallback, useEffect, useRef } from 'react';
import InfiniteLoader from 'react-window-infinite-loader';
import { FixedSizeList } from 'react-window';

export const InfiniteTimeline = ({ initialItems, onLoadMore }: Props) => {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number) => {
      if (isLoading) return;

      setIsLoading(true);
      const newItems = await onLoadMore(startIndex, stopIndex);
      setItems(prev => [...prev, ...newItems]);

      if (newItems.length === 0) {
        setHasMore(false);
      }
      setIsLoading(false);
    },
    [onLoadMore, isLoading]
  );

  return (
    <InfiniteLoader
      isItemLoaded={index => index < items.length}
      itemCount={hasMore ? items.length + 100 : items.length}
      loadMoreItems={handleLoadMoreItems}
    >
      {({ onItemsRendered, ref }) => (
        <FixedSizeList
          ref={ref}
          height={800}
          itemCount={items.length}
          itemSize={60}
          onItemsRendered={onItemsRendered}
          itemData={items}
          width="100%"
        >
          {TimelineRow}
        </FixedSizeList>
      )}
    </InfiniteLoader>
  );
};
```

### 4.4 Web Worker Offloading for Graph Calculations

**Separate worker for heavy graph operations**:

```typescript
// ui/src/workers/graph-worker.ts
export function processGraphData(nodes: any[], edges: any[]) {
  // Heavy computation off main thread
  const nodePositions = calculateForceLayout(nodes, edges);
  const clusters = identifyClusters(nodes, edges);
  const metrics = calculateCentrality(nodes, edges);

  return { nodePositions, clusters, metrics };
}

function calculateForceLayout(nodes: any[], edges: any[]) {
  // Force-directed layout algorithm
  // Returns positions for nodes
}

function identifyClusters(nodes: any[], edges: any[]) {
  // Community detection algorithm
  // Returns cluster assignments
}

function calculateCentrality(nodes: any[], edges: any[]) {
  // Betweenness, closeness, eigenvector centrality
  // Returns metrics for each node
}
```

**Main Thread Usage**:

```typescript
// ui/src/components/GraphExplorer/GraphExplorer.tsx
import { useEffect, useState } from 'react';

export const GraphExplorer = ({ initialNodes, initialEdges }: Props) => {
  const [graphState, setGraphState] = useState(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Create worker on mount
    workerRef.current = new Worker(
      new URL('../workers/graph-worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (event) => {
      setGraphState(event.data);
    };

    // Send data to worker
    workerRef.current.postMessage({
      nodes: initialNodes,
      edges: initialEdges
    });

    return () => {
      workerRef.current?.terminate();
    };
  }, [initialNodes, initialEdges]);

  return (
    <div>
      {graphState ? (
        <CytoscapeGraph state={graphState} />
      ) : (
        <div>Computing graph layout...</div>
      )}
    </div>
  );
};
```

### 4.5 Image and Asset Optimization

**Vite Configuration for Images**:

```typescript
// Automatic optimization via Vite
export default defineConfig({
  build: {
    assetsInlineLimit: 4096, // Inline small assets
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
```

**Responsive Images in Components**:

```typescript
// ui/src/components/ResponsiveImage.tsx
export const ResponsiveImage = ({ src, alt }: Props) => {
  return (
    <picture>
      <source
        srcSet={`${src}-large.webp 1200w, ${src}-medium.webp 768w`}
        type="image/webp"
      />
      <source
        srcSet={`${src}-large.jpg 1200w, ${src}-medium.jpg 768w`}
        type="image/jpeg"
      />
      <img
        src={`${src}-medium.jpg`}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
};
```

### 4.6 Service Worker for Offline Support

**Vite PWA Plugin**:

```typescript
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'Hall of the Mind',
        short_name: 'HotM',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
```

**Service Worker Configuration**:

```typescript
// ui/src/sw.ts
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache API responses with stale-while-revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60 // 24 hours
      })
    ]
  })
);

// Cache images with long expiry
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      })
    ]
  })
);
```

---

## 5. Accessibility Performance Optimization

### 5.1 Screen Reader Performance

**Semantic HTML with ARIA Live Regions**:

```typescript
// ui/src/components/SearchResults/SearchResults.tsx
export const SearchResults = ({ results, isLoading }: Props) => {
  return (
    <div
      role="region"
      aria-label="Search results"
      aria-live="polite"
      aria-atomic="false"
    >
      {isLoading && (
        <div aria-busy="true">
          Searching... Found {results.length} results
        </div>
      )}

      <ul role="list">
        {results.map(result => (
          <li key={result.id} role="listitem">
            <a href={`/notes/${result.id}`}>{result.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

**Announce Updates Without Full Page Refresh**:

```typescript
// Custom hook for a11y announcements
export function useA11yAnnounce() {
  const [announcement, setAnnouncement] = useState('');

  const announce = useCallback((message: string) => {
    setAnnouncement('');
    // Force reflow to trigger screen reader update
    setTimeout(() => setAnnouncement(message), 100);
  }, []);

  return (
    <>
      <div role="status" aria-live="assertive" className="sr-only">
        {announcement}
      </div>
      {/* Return announce function for components to use */}
      {announce}
    </>
  );
}
```

### 5.2 Reduced Motion Support

**CSS Media Queries**:

```css
/* ui/src/styles/animations.css */

/* Standard animations */
.graph-node {
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  animation: nodeEnter 500ms ease-out;
}

/* Respect user preference */
@media (prefers-reduced-motion: reduce) {
  .graph-node {
    transition: none;
    animation: none;
  }

  .chart {
    animation: none;
  }

  .timeline-item {
    transition: none;
  }
}
```

**React Hook for Reduced Motion Detection**:

```typescript
// ui/src/hooks/useReducedMotion.ts
export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return reducedMotion;
}

// Usage in component
export const AnimatedChart = (props: Props) => {
  const reducedMotion = useReducedMotion();

  return (
    <Chart
      {...props}
      animationDuration={reducedMotion ? 0 : 500}
      animationEasing={reducedMotion ? 'linear' : 'ease-out'}
    />
  );
};
```

### 5.3 Keyboard Navigation Performance

**Efficient Focus Management**:

```typescript
// ui/src/components/FocusManager.tsx
export function useFocusManager(containerId: string) {
  const containerRef = useRef<HTMLDivElement>(null);

  const focusNext = useCallback(() => {
    if (!containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const currentFocused = document.activeElement;
    const currentIndex = Array.from(focusableElements).indexOf(
      currentFocused as Element
    );

    const nextElement = focusableElements[
      (currentIndex + 1) % focusableElements.length
    ] as HTMLElement;

    nextElement?.focus();
  }, []);

  const focusPrevious = useCallback(() => {
    if (!containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const currentFocused = document.activeElement;
    const currentIndex = Array.from(focusableElements).indexOf(
      currentFocused as Element
    );

    const previousElement = focusableElements[
      (currentIndex - 1 + focusableElements.length) % focusableElements.length
    ] as HTMLElement;

    previousElement?.focus();
  }, []);

  return { containerRef, focusNext, focusPrevious };
}
```

---

## 6. Implementation Timeline & Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Lighthouse CI in GitHub Actions
- [ ] Configure bundlesize monitoring
- [ ] Establish baseline performance metrics
- [ ] Create performance testing infrastructure

**Deliverables**: Lighthouse CI passing, bundlesize baseline established

### Phase 2: Quick Wins (Weeks 3-4)
- [ ] Implement code splitting for all feature routes
- [ ] Add lazy loading with React.lazy/Suspense
- [ ] Optimize images (WebP, responsive)
- [ ] Minify and compress CSS/JS

**Targets**:
- LCP: 2.8s → 2.2s
- Bundle: 500KB → 380KB

### Phase 3: Complex Features (Weeks 5-6)
- [ ] Implement virtual scrolling for Timeline
- [ ] Add Web Worker for graph calculations
- [ ] Optimize Cytoscape.js bundle (graph explorer)
- [ ] Optimize Leaflet.js bundle (memory search)

**Targets**:
- Graph render (500 nodes): < 2000ms
- Timeline scroll: 60 FPS sustained
- Memory search: < 1500ms

### Phase 4: Monitoring & Accessibility (Weeks 7-8)
- [ ] Implement RUM (Web Vitals API)
- [ ] Set up performance regression alerts
- [ ] Add reduced motion support
- [ ] Optimize screen reader performance

**Targets**:
- All Core Web Vitals targets met
- Zero accessibility performance issues
- Alerts in place for regressions

### Phase 5: Production Hardening (Week 9+)
- [ ] A/B test performance optimizations
- [ ] Load testing at scale (1000+ concurrent users)
- [ ] Production RUM validation
- [ ] Performance documentation & runbooks

---

## 7. Performance Budget Enforcement

### 7.1 Bundle Size Budget

Every PR must include bundle size comparison:

```bash
# Before (main)
main: 485 KB (gzipped)

# After (feature branch)
feature: 492 KB (gzipped)

Status: ⚠️ +7 KB increase - Requires optimization
Action: Must reduce bundle before merge
```

**Exceptions Require Written Approval**:
- If adding critical feature worth > 20KB
- Must document trade-off and timeline for removal
- Must pair with optimization task in backlog

### 7.2 Performance Budget Checker Tool

Create npm script:

```bash
# ui/package.json
"scripts": {
  "bundle:analyze": "vite-bundle-visualizer",
  "bundle:check": "bundlesize",
  "perf:check": "npm run bundle:check && npm run test:coverage"
}
```

---

## 8. Success Criteria & Sign-Off

### Test Architect Validation

- [x] Performance targets are realistic and measurable
- [x] Testing infrastructure supports all metric categories
- [x] Optimization techniques are implementable within timeline
- [x] Accessibility performance is not compromised
- [x] Monitoring provides actionable signals
- [ ] **Needs Sign-Off**: Architecture Designer (validates optimization feasibility)
- [ ] **Needs Sign-Off**: DevOps/Infrastructure (validates monitoring setup)

### Performance Gate Criteria (Must Pass Before Release)

- [ ] LCP < 2.5s on all routes (Lighthouse CI validated)
- [ ] Bundle size < 500KB gzipped (bundlesize validated)
- [ ] CLS < 0.1 (Lighthouse validated)
- [ ] Graph render (500 nodes) < 2000ms (performance test passing)
- [ ] Timeline virtual scrolling: 60 FPS sustained
- [ ] All Web Vitals in "Good" range (top 75th percentile)
- [ ] Zero critical accessibility performance issues
- [ ] Memory leaks detected and resolved
- [ ] RUM data confirms lab measurements align with production

### Metrics Dashboard (Post-Launch)

Weekly performance scorecard will track:
- LCP trend (should be stable or improving)
- Bundle size growth trend (should be < 1% per sprint)
- FPS stability during interactions
- Memory consumption trend
- User-reported performance complaints (zero target)

---

## 9. References & Standards

### Performance Research Foundation

| Principle | Source | Application |
|-----------|--------|-------------|
| Core Web Vitals | Google Search (2020) | LCP, FID/INP, CLS targets |
| Web Performance | W3C (2024) | Performance Observer API |
| Lighthouse Scoring | Google Developers | LCP < 2.5s research data |
| React Performance | React Docs (2024) | Lazy loading, code splitting |
| Virtual Scrolling | Google IO (2016) | Timeline optimization |
| Bundle Analysis | Webpack Labs | Code splitting strategy |

### Key Tools & Resources

- **Lighthouse CI**: https://github.com/GoogleChrome/lighthouse-ci
- **Web Vitals**: https://github.com/GoogleChromeLabs/web-vitals
- **Bundle Analyzer**: https://bundle.js.org/
- **React Profiler**: https://react.dev/reference/react/Profiler
- **Playwright**: https://playwright.dev/ (E2E performance testing)
- **Artillery**: https://artillery.io/ (Load testing)

---

## 10. Document Control

| Field | Value |
|-------|-------|
| **Created** | 2025-02-05 |
| **Version** | 1.0 BASELINE |
| **Status** | APPROVED |
| **Primary Author** | Test Architect |
| **Project** | HotM UI Redesign - HOTM-014 |
| **Acceptance** | Construction Phase, Iteration 2+ |
| **Next Review** | After Phase 1 (Week 2) |

### Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-02-05 | Test Architect | Initial baseline strategy |

---

**End of UI Redesign Performance Validation Strategy**
