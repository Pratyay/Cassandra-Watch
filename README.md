# Cassandra UI Tool

A comprehensive web-based monitoring and management tool for Apache Cassandra clusters, specifically designed for monitoring Temporal service datastores.

## Features

### 🔍 Monitoring Features
- **Real-time cluster topology visualization** - View your cluster's physical and logical structure
- **Performance metrics dashboard** - Monitor read/write latency, throughput, and error rates
- **Storage and compaction monitoring** - Track data growth and compaction operations
- **Node health tracking** - Monitor individual node status and availability
- **Live operation monitoring** - Track ongoing maintenance operations

### ⚙️ Operational Features
- **Dynamic cluster connection** - Connect to any Cassandra cluster at runtime without restarts
- **Connection management** - Save, edit, and switch between multiple cluster configurations
- **Repair operations** - Run full and incremental repairs on keyspaces
- **Compaction management** - Trigger and monitor compaction operations
- **Node operations** - Cleanup, scrub, and flush operations
- **Keyspace management** - Create and drop keyspaces with proper replication
- **CQL query execution** - Execute queries with configurable consistency levels
- **Schema exploration** - Browse keyspaces, tables, and data structures

## Architecture

- **Frontend**: React with TypeScript, Material-UI, and Recharts
- **Backend**: Node.js with Express.js
- **Database**: Cassandra Driver for Node.js
- **Real-time Updates**: WebSockets for live metric updates
- **Visualization**: Custom charts and cluster topology diagrams

## Prerequisites

1. **Apache Cassandra** cluster running and accessible
2. **Node.js** (v16 or higher)
3. **npm** or **yarn** package manager
4. **nodetool** available in your PATH (for administrative operations)

## Quick Start

### 1. Install Dependencies

```bash
# Install all dependencies for both frontend and backend
npm run install:all
```

### 2. Start the Application

```bash
# Development mode (both frontend and backend)
npm run dev

# Or start them separately:
npm run dev:backend  # Backend only
npm run dev:frontend # Frontend only
```

### 3. Access the UI

Open your browser and navigate to: **http://localhost:3000**

### 4. Configure Cassandra Connection

The application now supports **dynamic cluster connection management**:

1. **Auto-connection on startup** (optional): If environment variables are set in `backend/.env`, the backend will attempt to connect automatically
2. **Manual connection via UI**: Use the connection management interface to connect to any Cassandra cluster on demand
3. **Multiple cluster support**: Save and switch between different cluster configurations
4. **Runtime connection changes**: Connect and disconnect without restarting the application

To configure auto-connection, create `backend/.env` file:

```bash
# Optional: Auto-connect on startup
CASSANDRA_HOSTS=127.0.0.1,192.168.1.100
CASSANDRA_PORT=9042
CASSANDRA_DC=datacenter1
CASSANDRA_USERNAME=
CASSANDRA_PASSWORD=

# Application Configuration
PORT=3001
REFRESH_INTERVAL=5000
CORS_ORIGIN=http://localhost:3000
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CASSANDRA_HOSTS` | Comma-separated list of Cassandra nodes | `127.0.0.1` |
| `CASSANDRA_PORT` | Cassandra native protocol port | `9042` |
| `CASSANDRA_DC` | Local datacenter name | `datacenter1` |
| `CASSANDRA_USERNAME` | Username for authentication (optional) | |
| `CASSANDRA_PASSWORD` | Password for authentication (optional) | |
| `PORT` | Backend server port | `3001` |
| `REFRESH_INTERVAL` | Metrics refresh interval in ms | `5000` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |

### Cassandra Requirements

This tool works with:
- **Apache Cassandra** 3.11+ or 4.x
- **DataStax Enterprise** (DSE)
- Any Cassandra-compatible database

## Usage Guide

### Connection Management
- **Dynamic connections**: Connect to any Cassandra cluster without restarting the application
- **Saved configurations**: Store and manage multiple cluster connection profiles
- **Connection testing**: Validate cluster connectivity before connecting
- **Runtime switching**: Switch between different clusters seamlessly
- **Connection status**: Real-time connection health monitoring

### Dashboard
- Overview of cluster health, performance, and storage
- Quick metrics for Temporal service keyspaces
- Real-time updates every 5 seconds

### Cluster Topology
- Visual representation of your cluster's ring topology
- Node status and datacenter distribution
- Detailed node information including tokens and versions

### Performance Monitoring
- Real-time latency metrics (P50, P95, P99)
- Throughput monitoring (reads/writes per second)
- Cache hit rates and error tracking
- Historical trend charts

### Operations Management
- **Repair**: Run incremental or full repairs on keyspaces
- **Compaction**: Trigger manual compaction operations
- **Cleanup**: Remove unnecessary data after topology changes
- **Scrub**: Validate and repair corrupted data
- **Flush**: Force memtable flushes to disk

### Data Explorer
- Browse keyspaces and table schemas
- Execute CQL queries with different consistency levels
- View data samples and table structures
- Support for both user and system keyspaces

### Settings
- Connection status monitoring
- Application configuration
- Health check and diagnostics

## Temporal Service Integration

This tool is specifically designed to work with Cassandra clusters used by Temporal services. It provides insights into:

- **History shards** - Workflow execution history storage
- **Matching shards** - Task queue and workflow matching data
- **Transfer queues** - Cross-shard transfer operations
- **Task queues** - Activity and workflow task storage

## API Endpoints

### Connection Management
- `POST /api/connection/connect` - Connect to a Cassandra cluster
- `POST /api/connection/disconnect` - Disconnect from current cluster
- `GET /api/connection/status` - Get current connection status
- `POST /api/connection/test` - Test connection without connecting

### Metrics Endpoints
- `GET /api/metrics` - All metrics
- `GET /api/metrics/cluster` - Cluster information
- `GET /api/metrics/nodes` - Node status
- `GET /api/metrics/keyspaces` - Keyspace information
- `GET /api/metrics/performance` - Performance metrics

### Operations Endpoints
- `POST /api/operations/repair/:keyspace?` - Repair operations
- `POST /api/operations/compact/:keyspace?` - Compaction operations
- `POST /api/operations/query` - Execute CQL queries
- `GET /api/operations/active` - Active operations status

### WebSocket
- `ws://localhost:3001/ws` - Real-time metric updates

## Development

### Project Structure
```
cassandra/
├── package.json              # Root package with scripts
├── backend/                  # Node.js backend
│   ├── src/
│   │   ├── config/          # Database configuration
│   │   ├── services/        # Business logic services
│   │   ├── routes/          # API routes
│   │   └── index.js         # Main server file
│   └── package.json
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── contexts/        # React contexts
│   │   ├── services/        # API services
│   │   └── types/           # TypeScript types
│   └── package.json
└── README.md
```

### Adding New Features

1. **Backend**: Add new routes in `backend/src/routes/`
2. **Frontend**: Create components in `frontend/src/components/`
3. **API Integration**: Update `frontend/src/services/api.ts`
4. **Types**: Add TypeScript interfaces in `frontend/src/types/`

## Troubleshooting

### Connection Issues
1. Verify Cassandra is running: `nodetool status`
2. Check network connectivity to Cassandra nodes
3. Verify authentication credentials if using auth
4. Check datacenter name matches your cluster configuration

### Performance Issues
1. Reduce `REFRESH_INTERVAL` if updates are too frequent
2. Monitor WebSocket connection stability
3. Check Cassandra cluster performance

### Operation Failures
1. Ensure `nodetool` is available in PATH
2. Verify user permissions for cluster operations
3. Check cluster health before running operations

## Security Notes

- This tool connects directly to your Cassandra cluster
- Use authentication when available
- Run on secure networks only
- Monitor access logs for security auditing

## License

MIT License - see LICENSE file for details

## Support

For issues related to:
- **Cassandra connectivity**: Check Cassandra logs and cluster status
- **UI bugs**: Check browser console for errors
- **Performance**: Monitor both UI and Cassandra performance metrics
=======
# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
>>>>>>> 83b2085fafcab465fbd258a4b34c40a5dea26b56
