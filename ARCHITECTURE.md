# System Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Infrastructure](#infrastructure)
5. [Security Architecture](#security-architecture)
6. [Scalability & Performance](#scalability--performance)
7. [Disaster Recovery](#disaster-recovery)

## System Overview

The Restaurant POS system is built using a microservices-inspired architecture with the following key principles:

- **Separation of Concerns:** Clear boundaries between frontend, backend, and data layers
- **Scalability:** Horizontal scaling via Kubernetes
- **Resilience:** Circuit breakers, retries, and graceful degradation
- **Observability:** Comprehensive logging, metrics, and tracing

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Client Applications                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Web Frontend │  │ Mobile (iOS) │  │Mobile(Android)│          │
│  │  (Next.js)   │  │              │  │               │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘          │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  Load Balancer   │
                    │  (Ingress/ALB)   │
                    └────────┬─────────┘
                             │
          ┌──────────────────┴───────────────────┐
          │                                      │
   ┌──────▼─────────┐                  ┌────────▼──────────┐
   │  API Gateway   │                  │  WebSocket Server │
   │  (Express)     │                  │   (Socket.io)     │
   └──────┬─────────┘                  └────────┬──────────┘
          │                                     │
          │         ┌───────────────────────────┘
          │         │
   ┌──────▼─────────▼────────┐
   │   Business Logic Layer  │
   │  ┌─────────────────┐    │
   │  │ Order Service   │    │
   │  │ Payment Service │    │
   │  │ Menu Service    │    │
   │  │ Inventory Srv   │    │
   │  │ Analytics Srv   │    │
   │  └─────────────────┘    │
   └──────┬──────────────────┘
          │
   ┌──────┴──────────────────────────────────────┐
   │                                              │
   ▼                                              ▼
┌──────────────┐      ┌──────────────┐    ┌──────────────┐
│  PostgreSQL  │      │    Redis     │    │ External APIs│
│  (Primary +  │      │   (Cache +   │    │   - Square   │
│   Replicas)  │      │   Sessions)  │    │   - Twilio   │
│              │      │              │    │   - AWS S3   │
└──────────────┘      └──────────────┘    └──────────────┘
```

## Component Architecture

### 1. Frontend Layer

#### Next.js Web Application
- **Technology:** Next.js 15 (App Router)
- **Rendering:** Server-Side Rendering (SSR) + Client-Side
- **State Management:** React Query for server state
- **Styling:** TailwindCSS 4
- **Key Features:**
  - POS Terminal interface
  - Kitchen Display System
  - Admin dashboard
  - Analytics dashboard
  - Customer ordering portal

#### Mobile Applications (React Native)
- **Platform:** iOS & Android
- **Architecture:** Shared business logic, platform-specific UI
- **Offline Support:** AsyncStorage + Queue sync
- **Key Features:**
  - Mobile POS
  - Inventory management
  - QR code scanning
  - Real-time order updates

### 2. Backend Layer

#### API Server (Node.js/Express)
```
backend/
├── src/
│   ├── index.ts              # Server entry point
│   ├── config/               # Configuration management
│   ├── routes/               # API route definitions
│   │   ├── auth.ts
│   │   ├── orders.ts
│   │   ├── menu.ts
│   │   ├── payments.ts
│   │   ├── inventory.ts
│   │   └── analytics.ts
│   ├── services/             # Business logic
│   │   ├── squareService.ts  # Square API integration
│   │   ├── cacheService.ts   # Redis caching
│   │   ├── auditService.ts   # Audit logging
│   │   ├── aiService.ts      # AI predictions
│   │   └── cronService.ts    # Scheduled jobs
│   ├── middleware/           # Express middleware
│   │   ├── auth.ts           # JWT authentication
│   │   ├── validator.ts      # Request validation
│   │   ├── audit.ts          # Audit logging
│   │   ├── errorHandler.ts   # Error handling
│   │   └── logger.ts         # Request logging
│   ├── validators/           # Zod schemas
│   ├── types/                # TypeScript types
│   └── utils/                # Helper functions
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
└── tests/                    # Test suites
```

### 3. Data Layer

#### PostgreSQL Database
- **Version:** 15+
- **ORM:** Prisma
- **Deployment:** Primary + Read Replicas
- **Backup:** Daily automated backups to S3

**Schema Design:**
- **users:** Staff authentication and authorization
- **menu_items:** Product catalog with Square sync
- **orders:** Order tracking with status workflow
- **order_items:** Line items with modifiers
- **payments:** Payment records with Square IDs
- **inventory_items:** Stock management
- **reservations:** Table booking system
- **loyalty_customers:** Customer loyalty program

#### Redis Cache
- **Version:** 7+
- **Use Cases:**
  - Session storage
  - Menu item caching (15min TTL)
  - Rate limiting counters
  - Real-time data aggregation

### 4. External Integrations

#### Square API
- **Payments:** Process credit card transactions
- **Orders:** Sync orders to Square POS
- **Catalog:** Two-way menu synchronization
- **Inventory:** Real-time stock updates
- **Customers:** Loyalty program integration

#### Twilio API
- **SMS Notifications:**
  - Low inventory alerts
  - Order confirmations
  - Payment receipts
  - Staff notifications

#### AWS Services
- **S3:** Image storage for menu items
- **CloudFront:** CDN for static assets
- **EKS:** Kubernetes cluster hosting

## Data Flow

### Order Creation Flow

```
1. Client submits order
   ↓
2. API validates request (Zod schema)
   ↓
3. Check authentication & authorization
   ↓
4. Create order in PostgreSQL
   ↓
5. Process payment via Square API
   ↓
6. Update order status
   ↓
7. Broadcast to KDS via WebSocket
   ↓
8. Send SMS notification (if configured)
   ↓
9. Invalidate cache
   ↓
10. Log audit trail
    ↓
11. Return response to client
```

### Menu Synchronization Flow

```
Cron Job (every 15 minutes)
   ↓
1. Fetch catalog from Square API
   ↓
2. Compare with local database
   ↓
3. Update/Insert changed items
   ↓
4. Mark unavailable items
   ↓
5. Invalidate Redis cache
   ↓
6. Log sync results
```

## Infrastructure

### Kubernetes Architecture

```yaml
Cluster Configuration:
- Node Groups:
  - System: 3 nodes (t3.medium) - Control plane workloads
  - Application: 3-10 nodes (t3.large) - Auto-scaling
  - Database: 3 nodes (r5.xlarge) - Stateful workloads

Namespaces:
- default: Application workloads
- monitoring: Prometheus, Grafana
- logging: ELK stack (future)
- cert-manager: SSL/TLS certificates
```

### Resource Allocation

**Backend Pods:**
```yaml
resources:
  requests:
    memory: 512Mi
    cpu: 500m
  limits:
    memory: 1Gi
    cpu: 1000m
```

**Frontend Pods:**
```yaml
resources:
  requests:
    memory: 256Mi
    cpu: 250m
  limits:
    memory: 512Mi
    cpu: 500m
```

### Auto-Scaling Policies

**Horizontal Pod Autoscaler (HPA):**
- Min Replicas: 3
- Max Replicas: 10
- Metrics:
  - CPU: 70% target
  - Memory: 80% target
  - Custom: Requests per second

**Cluster Autoscaler:**
- Scales node groups based on pod resource requests
- Scale-up trigger: Pods pending > 30s
- Scale-down trigger: Node utilization < 50% for 10min

## Security Architecture

### Authentication & Authorization

**JWT-Based Authentication:**
```typescript
Token Structure:
{
  "userId": "user_id",
  "email": "user@example.com",
  "role": "STAFF|MANAGER|ADMIN|KITCHEN",
  "iat": 1234567890,
  "exp": 1234654290
}

Expiry: 24 hours
Refresh: Via /api/auth/refresh endpoint
```

**Role-Based Access Control (RBAC):**
- **ADMIN:** Full system access
- **MANAGER:** Analytics, reports, staff management
- **STAFF:** Order creation, basic operations
- **KITCHEN:** KDS view only, order status updates

### Network Security

**Layers of Protection:**
1. **WAF (Web Application Firewall):** CloudFlare/AWS WAF
2. **Load Balancer:** TLS termination, DDoS protection
3. **Ingress Controller:** Rate limiting, IP whitelisting
4. **Network Policies:** Pod-to-pod communication rules
5. **Security Groups:** AWS-level firewall rules

### Data Protection

**Encryption:**
- **At Rest:** AES-256 for database and backups
- **In Transit:** TLS 1.3 for all connections
- **Secrets:** Kubernetes secrets with RBAC

**PCI DSS Compliance:**
- No card data stored locally
- All payments via Square (PCI Level 1 certified)
- Audit logs for all payment operations

## Scalability & Performance

### Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time (p95) | < 200ms | 150ms |
| Order Processing | < 3s | 2.1s |
| Menu Load Time | < 100ms | 45ms (cached) |
| Concurrent Users | 500+ | Tested to 750 |
| Database Queries | < 50ms | 32ms avg |

### Caching Strategy

**Cache Layers:**
1. **CDN:** Static assets (CloudFront)
2. **Redis:** API responses, session data
3. **Application:** In-memory caching for config
4. **Database:** Query result caching

**Cache Invalidation:**
- Time-based: TTL expiry
- Event-based: On data mutations
- Manual: Admin cache clear endpoint

### Database Optimization

**Indexing Strategy:**
```sql
-- High-frequency queries
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_payments_order_id ON payments(order_id);

-- Composite indexes
CREATE INDEX idx_orders_status_created ON orders(status, created_at);
```

**Query Optimization:**
- Prisma eager loading for relations
- Connection pooling (max 20 connections)
- Read replicas for analytics queries

## Disaster Recovery

### Backup Strategy

**Database Backups:**
- **Frequency:** Hourly incremental, daily full
- **Retention:** 7 days (hourly), 30 days (daily)
- **Storage:** S3 with versioning
- **Encryption:** AES-256

**Application Backups:**
- **Container Images:** Stored in ECR with tags
- **Configuration:** Version controlled in Git
- **Secrets:** Backed up in AWS Secrets Manager

### Recovery Procedures

**RTO (Recovery Time Objective):** 1 hour
**RPO (Recovery Point Objective):** 15 minutes

**Incident Response:**
1. Alert triggered (PagerDuty/Slack)
2. On-call engineer responds
3. Assess impact and root cause
4. Execute recovery procedure
5. Post-mortem documentation

**Database Recovery:**
```bash
# Restore from backup
pg_restore -d restaurant_pos backup_file.dump

# Verify data integrity
npm run db:validate

# Restart application pods
kubectl rollout restart deployment/pos-backend
```

## Monitoring & Observability

### Metrics Collection

**Prometheus Metrics:**
- System: CPU, memory, disk, network
- Application: Request rate, latency, errors
- Business: Orders/min, revenue, inventory levels

**Custom Metrics:**
```typescript
// Example: Track order processing time
orderProcessingDuration.observe(duration);

// Track payment success rate
paymentSuccessRate.inc({ method: 'CARD', status: 'success' });
```

### Alerting Rules

**Critical Alerts:**
- Service down (> 3 consecutive failures)
- Error rate > 5%
- Payment failures > 2%
- Database connections exhausted
- Disk usage > 80%

**Warning Alerts:**
- High latency (p95 > 500ms)
- Memory usage > 75%
- Cache miss rate > 50%

---

**Document Version:** 2.0.0
**Last Updated:** January 2025
**Maintained By:** Engineering Team
