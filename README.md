# Cassandra Watch

A production-ready monitoring and operations console for Apache Cassandra clusters. This document serves as a technical product requirements document (PRD) and implementation guide for the current system.

## 1. Problem Statement

Operating Cassandra at scale requires continuous visibility into cluster health, performance, and topology. Traditional approaches depend on ad-hoc tools (e.g., nodetool, custom scripts, JMX browsers) that fragment operational context, create blind spots, and delay response to incidents. Teams need a single console that:

- Connects securely to remote clusters without local nodetool access
- Surfaces near real-time performance and resource metrics
- Presents accurate cluster topology and system information
- Recovers gracefully from transient JMX/network issues
- Scales to multiple nodes and concurrent users

## 2. Goals and Non-Goals

Goals
- Provide a unified dashboard combining system table data and JMX metrics
- Establish a single, persistent JMX connection per session and reuse it across tabs
- Deliver continuous data updates without page reloads
- Offer operational actions through stable APIs
- Keep UX responsive: one unified loader during connection bootstrap, then non-blocking refreshes

Non-Goals
- Replacing full-featured APM or log analytics
- Acting as an administrative shell for arbitrary Cassandra commands

## 3. System Overview

The system consists of a React frontend, a Node.js backend, and data sources in the Cassandra cluster (CQL system tables and JMX MBeans). The backend exposes REST APIs and a WebSocket channel. The frontend maintains a single WebSocket session and a shared JMX connection context powering multiple pages.

### 3.1 Component Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[React/MUI Application]
    WS[WebSocket Context]
  end

  subgraph Backend[Node.js Backend]
    API[REST API]
    WSS[WebSocket Service]
    JMS[JMX Service]
    MS[Metrics Service]
    DB[DB Connection Manager]
  end

  CASS[(Cassandra Cluster)]
  JMX[(JMX on Nodes)]

  UI <--> WS
  WS <--> WSS
  UI <--> API

  API --> MS
  MS --> DB
  DB <--> CASS

  API --> JMS
  JMS <--> JMX

  WSS --> MS
  WSS -.optional.-> JMS
```

Notes
- REST API provides on-demand access to system tables and JMX-backed endpoints.
- WebSocket pushes periodic basic metrics and operations updates; JMX broadcast is intentionally disabled server-side to improve resilience. Frontend triggers JMX refreshes via API using a shared connection context.
- A persistent JMX state in the frontend context avoids reconnecting on tab switches.

### 3.2 Connection and Loader Flow

```mermaid
sequenceDiagram
  participant F as Frontend (App)
  participant API as Backend REST
  participant W as WebSocket Service
  participant MS as Metrics Service
  participant JMS as JMX Service
  participant C as Cassandra (CQL)
  participant J as JMX (per node)

  Note over F: User submits connection form
  F->>API: POST /api/connections/connect
  API->>C: Establish CQL session
  C-->>API: Connected

  Note over F: Unified loader starts
  F->>API: GET /api/metrics (probe)
  API->>MS: getAllMetrics()
  MS->>C: Query system tables
  C-->>MS: Topology & system data
  MS-->>API: Aggregated metrics
  API-->>F: Basic metrics available

  Note over F: JMX bootstrap within main loader
  F->>API: GET /api/jmx/all-nodes
  API->>JMS: Initialize JMX connections (per discovered node)
  JMS->>J: Connect + sample MBeans
  J-->>JMS: Metrics
  JMS-->>API: Aggregated JMX metrics
  API-->>F: JMX ready

  Note over F,W: After loader completes
  F->>W: Open WebSocket
  W->>MS: Periodic fetch of basic metrics (interval)
  MS-->>W: Basic metrics
  W-->>F: metrics_update
  F->>API: GET /api/jmx/all-nodes (auto/manual refresh)
```

Rationale
- The loader blocks route rendering until CQL and initial JMX are ready, eliminating cascading loaders and page flicker.
- WebSocket drives lightweight, periodic updates for basic metrics; JMX refresh remains API-driven to isolate transient JMX instability from the socket channel.

## 4. Data Sources and Semantics

System Tables (CQL)
- Topology: `system.local`, `system.peers`
- Schema: `system_schema.keyspaces`, `system_schema.tables`
- Storage estimates: `system.size_estimates`
- Compaction history: `system.compaction_history`

JMX MBeans (per node)
- Memory: `java.lang:type=Memory`
- Garbage collection: `java.lang:type=GarbageCollector,*`
- Thread pools: `org.apache.cassandra.metrics:type=ThreadPools,*`
- Cache: `org.apache.cassandra.metrics:type=Cache,*`
- Compaction: `org.apache.cassandra.metrics:type=Compaction,*`

Aggregation
- Frontend aggregates node-level JMX to cluster-level totals/percentiles for the Dashboard.
- Performance page uses shared JMX context; numbers update without reestablishing connections.

## 5. Interfaces

### 5.1 REST Endpoints (selected)

- GET /api/metrics
  - Returns cluster, nodes, keyspaces, storage, system, basic performance metrics (no JMX).
- GET /api/metrics/nodes
  - Returns discovered nodes with addresses and datacenter/rack info.
- GET /api/metrics/keyspaces
  - Returns keyspace list and replication metadata.
- GET /api/metrics/keyspaces/:keyspace/tables
  - Returns table metadata for a keyspace.
- GET /api/jmx/all-nodes
  - Returns aggregated JMX metrics across nodes.
- POST /api/jmx/force-disconnect
  - Forces all JMX connections to close and clears caches.
- GET /api/jmx/health/:host
  - Health probe for a node’s JMX connectivity.
- POST /api/connections/connect
  - Establishes CQL connectivity using provided cluster configuration.

### 5.2 WebSocket Protocol

Message types
- initial: initial payload including basic metrics and operations
- metrics_update: periodic basic metric snapshot
- operations_update: active operation set
- connection_pending, error: control/diagnostic messages

Subscriptions
- Clients can subscribe to logical channels (e.g., "metrics", "operations"). JMX broadcasting is disabled by design; clients fetch JMX via REST.


