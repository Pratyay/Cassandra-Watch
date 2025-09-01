# 🔍 Cassandra Watch - Enterprise-Grade Cluster Monitoring & Management

> **The Ultimate Web-Based Monitoring Solution for Apache Cassandra Clusters**

A comprehensive, production-ready monitoring and management platform designed specifically for enterprise Cassandra deployments. This tool transforms complex cluster operations into intuitive, real-time insights, enabling DevOps teams and database administrators to maintain peak performance and reliability.

## 🚀 Why This Tool Matters

### **Critical Infrastructure Monitoring**
- **Zero-Downtime Operations**: Monitor and manage Cassandra clusters without service interruption
- **Real-Time Visibility**: Instant insights into cluster health, performance, and operational status
- **Proactive Problem Detection**: Identify issues before they impact production services
- **Enterprise Reliability**: Built for production environments with robust error handling and recovery

### **Operational Excellence**
- **Unified Management Interface**: Single dashboard for all Cassandra operations
- **Automated Health Checks**: Continuous monitoring with intelligent alerting
- **Performance Optimization**: Data-driven insights for capacity planning and tuning
- **Compliance & Auditing**: Complete operation history and audit trails

## ✨ Core Features

### 🔍 **Real-Time Monitoring Dashboard**
- **Cluster Health Overview**: Instant visibility into cluster status, node availability, and data distribution
- **Performance Metrics**: Live latency tracking (P50, P95, P99), throughput monitoring, and error rate analysis
- **Resource Utilization**: Memory, storage, and CPU usage across all nodes
- **JMX Integration**: Deep Java-level metrics for garbage collection, thread pools, and cache performance
- **Auto-Refresh**: Configurable real-time updates (default: every 2 seconds)

### 🏗️ **Advanced Cluster Management**
- **Dynamic Connection Management**: Connect to any Cassandra cluster at runtime without restarts
- **Multi-Cluster Support**: Manage multiple environments (dev, staging, production) simultaneously
- **Connection Profiles**: Save and switch between cluster configurations seamlessly
- **Health Validation**: Pre-connection testing and validation before establishing connections

### ⚡ **Performance & Operations**
- **Repair Operations**: Full and incremental repair scheduling with progress monitoring
- **Compaction Management**: Manual compaction triggers with real-time progress tracking
- **Node Operations**: Cleanup, scrub, flush, and other maintenance operations
- **Query Execution**: CQL query interface with configurable consistency levels
- **Schema Management**: Keyspace and table creation, modification, and deletion

### 📊 **Data Intelligence**
- **Storage Analytics**: Data growth tracking, compaction history, and storage optimization insights
- **Performance Trends**: Historical data analysis for capacity planning and performance tuning
- **Error Tracking**: Comprehensive error rate monitoring and failure analysis
- **Cache Performance**: Key cache and row cache hit rate optimization

### 🔧 **Developer & DBA Tools**
- **Schema Explorer**: Interactive browsing of keyspaces, tables, and data structures
- **Data Sampling**: Quick data previews and sample queries
- **Operation History**: Complete audit trail of all cluster operations
- **Health Diagnostics**: Comprehensive cluster health checks and recommendations

## 🏗️ Architecture & Technology

### **Modern Tech Stack**
- **Frontend**: React 18 with TypeScript, Material-UI v5, and advanced charting libraries
- **Backend**: Node.js with Express.js, optimized for high-performance Cassandra operations
- **Real-Time Communication**: WebSocket-based live updates with automatic reconnection
- **Database Integration**: Native Cassandra driver with connection pooling and optimization
- **State Management**: React Context API with optimized re-rendering and performance

### **Scalability & Reliability**
- **Connection Pooling**: Efficient database connection management
- **Error Recovery**: Automatic retry mechanisms and graceful degradation
- **Performance Optimization**: Lazy loading, memoization, and efficient data fetching
- **Cross-Platform**: Works on Windows, macOS, and Linux environments

## 🚀 Quick Start

### **Prerequisites**
- Apache Cassandra 3.11+ or 4.x cluster
- Node.js 16+ and npm/yarn
- Network access to Cassandra nodes (default: 9042 for CQL, 7199 for JMX)

### **Installation & Setup**

```bash
# Clone the repository
git clone <repository-url>
cd cassandra

# Install all dependencies
npm run install:all

# Start the application
npm run dev
```

### **First Connection**
1. Open **http://localhost:3000** in your browser
2. Click "Connect" and enter your cluster details
3. The tool will automatically establish connections and load metrics
4. Start monitoring your cluster in real-time!

## 📋 Configuration

### **Environment Variables**
```bash
# Cassandra Connection
CASSANDRA_HOSTS=192.168.1.100,192.168.1.101,192.168.1.102
CASSANDRA_PORT=9042
CASSANDRA_DC=datacenter1
CASSANDRA_USERNAME=admin
CASSANDRA_PASSWORD=secure_password

# Application Settings
PORT=3001
REFRESH_INTERVAL=2000
CORS_ORIGIN=http://localhost:3000
```

### **Supported Cassandra Versions**
- **Apache Cassandra**: 3.11.x, 4.0.x, 4.1.x, 5.0.x
- **DataStax Enterprise**: 6.8+, 7.0+, 8.0+
- **ScyllaDB**: 4.x, 5.x (Cassandra-compatible mode)

## 🎯 Use Cases

### **Production Operations**
- **24/7 Monitoring**: Continuous cluster health monitoring with alerting
- **Performance Tuning**: Data-driven optimization of read/write performance
- **Capacity Planning**: Storage and resource utilization analysis
- **Disaster Recovery**: Backup verification and recovery testing

### **Development & Testing**
- **Schema Development**: Interactive table design and modification
- **Query Testing**: CQL query development and optimization
- **Performance Testing**: Load testing and performance validation
- **Environment Management**: Multi-cluster development and testing

### **DevOps & SRE**
- **Automated Monitoring**: Integration with monitoring and alerting systems
- **Deployment Validation**: Post-deployment health checks and verification
- **Incident Response**: Quick diagnostics and problem resolution
- **Compliance Reporting**: Audit trails and compliance documentation

## 🔌 API Reference

### **Core Endpoints**
```http
# Connection Management
POST /api/connections/connect     # Establish cluster connection
GET  /api/connections/info        # Connection status
POST /api/connections/disconnect  # Disconnect from cluster

# Metrics & Monitoring
GET  /api/metrics                 # All cluster metrics
GET  /api/metrics/cluster         # Cluster information
GET  /api/metrics/nodes           # Node status and health
GET  /api/metrics/keyspaces       # Keyspace information

# JMX Integration
GET  /api/jmx/all-nodes           # All nodes JMX metrics
GET  /api/jmx/cluster-metrics     # Aggregated cluster metrics
POST /api/jmx/test                # Test JMX connectivity

# Operations
POST /api/operations/repair       # Repair operations
POST /api/operations/compact      # Compaction operations
POST /api/operations/query        # CQL query execution
```

### **WebSocket Real-Time Updates**
```javascript
// Connect to real-time updates
const ws = new WebSocket('ws://localhost:3001/ws');

// Subscribe to metrics updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['metrics', 'operations', 'alerts']
}));
```

## 🛠️ Development

### **Project Structure**
```
cassandra/
├── backend/                 # Node.js backend services
│   ├── src/
│   │   ├── config/         # Database and application configuration
│   │   ├── services/       # Business logic and Cassandra operations
│   │   ├── routes/         # REST API endpoints
│   │   └── middleware/     # Authentication and validation
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Main application pages
│   │   ├── contexts/       # React state management
│   │   ├── services/       # API integration services
│   │   └── types/          # TypeScript type definitions
└── shared/                 # Common utilities and types
```

### **Adding New Features**
1. **Backend**: Implement new services in `backend/src/services/`
2. **API**: Add endpoints in `backend/src/routes/`
3. **Frontend**: Create components in `frontend/src/components/`
4. **Integration**: Update API services in `frontend/src/services/`

## 🔒 Security & Best Practices

### **Security Features**
- **Authentication Support**: Username/password authentication for Cassandra
- **Network Security**: TLS/SSL encryption support
- **Access Control**: Role-based access control integration
- **Audit Logging**: Complete operation history and access logs

### **Production Recommendations**
- **Network Isolation**: Run on secure, isolated networks
- **Authentication**: Always use Cassandra authentication
- **Monitoring**: Monitor access logs and connection patterns
- **Updates**: Keep the tool updated with latest security patches

## 🚨 Troubleshooting

### **Common Issues**
1. **Connection Failures**: Verify network connectivity and authentication
2. **Performance Issues**: Check cluster health and resource utilization
3. **JMX Errors**: Ensure JMX ports are accessible and properly configured
4. **WebSocket Issues**: Verify firewall rules and proxy configurations

### **Diagnostic Commands**
```bash
# Check Cassandra status
nodetool status

# Verify JMX connectivity
telnet <host> 7199

# Check application logs
tail -f backend/logs/app.log
```

## 📈 Performance & Scalability

### **Optimization Features**
- **Efficient Data Fetching**: Optimized queries and data aggregation
- **Smart Caching**: Intelligent caching of frequently accessed data
- **Lazy Loading**: On-demand loading of heavy components
- **Memory Management**: Efficient memory usage and garbage collection

### **Scalability Considerations**
- **Large Clusters**: Tested with clusters up to 100+ nodes
- **High-Frequency Updates**: Configurable refresh intervals for different environments
- **Resource Usage**: Minimal resource footprint for production deployment

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for:
- Code style and standards
- Testing requirements
- Pull request process
- Issue reporting

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🆘 Support

### **Getting Help**
- **Documentation**: Comprehensive guides and API references
- **Issues**: GitHub issues for bug reports and feature requests
- **Community**: Join our community discussions and Q&A

### **Enterprise Support**
For enterprise deployments and support:
- **Customization**: Tailored features for your specific needs
- **Integration**: Help with monitoring system integration
- **Training**: Team training and best practices workshops

---

**Built with ❤️ for the Cassandra community**

*Transform your Cassandra operations from reactive to proactive with enterprise-grade monitoring and management.*
