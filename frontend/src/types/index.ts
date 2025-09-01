export interface ClusterInfo {
  name: string;
  totalNodes: number;
  upNodes: number;
  datacenters: string[];
  cassandraVersion: string;
  partitioner: string;
  lastUpdate: string;
}

export interface NodeInfo {
  address: string;
  datacenter: string;
  rack: string;
  isUp: boolean;
  version: string;
  tokens: number;
  hostId: string;
  schemaVersion: string;
}

export interface KeyspaceInfo {
  name: string;
  replication: Record<string, any>;
  isSystemKeyspace: boolean;
  tableCount: number;
}

export interface TableInfo {
  name: string;
  keyspace: string;
  bloomFilterFpChance: number;
  caching: Record<string, any>;
  comment: string;
  compaction: Record<string, any>;
  compression: Record<string, any>;
  gcGraceSeconds: number;
}

export interface PerformanceMetrics {
  readLatency: {
    p50: number;
    p95: number;
    p99: number;
    mean: number;
  };
  writeLatency: {
    p50: number;
    p95: number;
    p99: number;
    mean: number;
  };
  throughput: {
    reads: number;
    writes: number;
    readsOneMinuteRate?: number;
    writesOneMinuteRate?: number;
  };
  errors: {
    readTimeouts: number;
    writeTimeouts: number;
    unavailableExceptions: number;
  };
  cacheHitRates: {
    keyCache: number;
    rowCache: number;
  };
  lastUpdate: string;
  source?: string;
  error?: string;
  message?: string;
  compactionActivity?: {
    last24h: number;
    bytesProcessed: number;
  };
  connected?: boolean;
  jmxMetrics?: {
    memory?: {
      totalHeapUsed: number;
      totalHeapMax: number;
      totalNonHeapUsed: number;
    };
    threadPools?: {
      totalActiveThreads: number;
      totalPendingThreads: number;
      totalCompletedThreads: number;
    };
    gc?: {
      youngGen?: {
        collections: number;
        time: number;
      };
      oldGen?: {
        collections: number;
        time: number;
      };
      totalTime: number;
    };
    cache?: {
      keyCache?: {
        hitRate: number;
        requests: number;
        hits: number;
      };
      rowCache?: {
        hitRate: number;
        requests: number;
        hits: number;
      };
    };
  };
}

export interface StorageMetrics {
  totalSize: number;
  keyspacesSizes: Array<{
    keyspace: string;
    size: number;
  }>;
  lastUpdate: string;
}

export interface SystemMetrics {
  compactionHistory: any[];
  pendingTasks: {
    compaction: number;
    repair: number;
    antiEntropy: number;
  };
  peers: any[];
  local: any;
  lastUpdate: string;
}

export interface Operation {
  id: string;
  type: string; // More flexible to allow 'compaction' and other types
  keyspace: string;
  table?: string; // Add table field
  startTime: string;
  endTime?: string;
  status: string; // More flexible status
  result?: any;
  error?: string;
  isSystemOperation?: boolean; // Add system operation flag
}

export interface AllMetrics {
  cluster: ClusterInfo;
  nodes: NodeInfo[];
  keyspaces: KeyspaceInfo[];
  system: SystemMetrics;
  performance: PerformanceMetrics;
  storage: StorageMetrics;
  lastUpdate: string;
}

export interface WebSocketMessage {
  type: 'initial' | 'metrics_update' | 'operations_update' | 'operation_update' | 'alert' | 'error' | 'pong' | 'subscribed' | 'unsubscribed' | 'connection_pending';
  data?: any;
  message?: string;
  channels?: string[];
}

export interface QueryResult {
  success: boolean;
  rows?: any[];
  rowCount?: number;
  columns?: Array<{
    name: string;
    type: string;
  }>;
  error?: string;
}

export interface NodetoolResult {
  success: boolean;
  output?: string;
  error?: string;
}
