# Production Deployment Guide

## Prerequisites Checklist

- [ ] Kubernetes cluster provisioned (EKS/GKE/AKS)
- [ ] kubectl configured and authenticated
- [ ] Docker images built and pushed to registry
- [ ] DNS records configured
- [ ] SSL certificates obtained
- [ ] Square API credentials (production)
- [ ] Database provisioned
- [ ] Redis cluster provisioned
- [ ] Monitoring stack deployed

## Step-by-Step Deployment

### 1. Prepare Infrastructure

\`\`\`bash
# Create production namespace
kubectl create namespace production

# Create monitoring namespace
kubectl create namespace monitoring
\`\`\`

### 2. Configure Secrets

\`\`\`bash
# Create database secret
kubectl create secret generic pos-secrets \\
  --from-literal=database-url="postgresql://user:pass@host:5432/dbname" \\
  --from-literal=jwt-secret="your-super-secret-jwt-key" \\
  --from-literal=square-access-token="your-square-token" \\
  --from-literal=square-webhook-signature="your-webhook-key" \\
  --from-literal=twilio-account-sid="your-twilio-sid" \\
  --from-literal=twilio-auth-token="your-twilio-token" \\
  -n production

# Create Grafana secret
kubectl create secret generic grafana-secrets \\
  --from-literal=admin-user=admin \\
  --from-literal=admin-password="your-secure-password" \\
  -n monitoring
\`\`\`

### 3. Configure ConfigMaps

\`\`\`bash
kubectl create configmap pos-config \\
  --from-literal=square-location-id="your-location-id" \\
  --from-literal=redis-url="redis://redis-service:6379" \\
  --from-literal=api-url="https://api.restaurant-pos.com" \\
  --from-literal=frontend-url="https://restaurant-pos.com" \\
  -n production
\`\`\`

### 4. Deploy Database Migrations

\`\`\`bash
# Run migration job
kubectl apply -f k8s/jobs/migration-job.yaml -n production

# Wait for completion
kubectl wait --for=condition=complete job/db-migration -n production --timeout=300s
\`\`\`

### 5. Deploy Application

\`\`\`bash
# Deploy all resources
kubectl apply -k k8s/overlays/production/

# Verify deployments
kubectl get deployments -n production
kubectl get pods -n production
kubectl get services -n production
\`\`\`

### 6. Deploy Monitoring

\`\`\`bash
# Deploy Prometheus
kubectl apply -f k8s/monitoring/prometheus-config.yaml

# Deploy Grafana
kubectl apply -f k8s/monitoring/grafana-deployment.yaml

# Verify monitoring stack
kubectl get pods -n monitoring
\`\`\`

### 7. Configure Ingress

\`\`\`bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml

# Deploy ingress rules
kubectl apply -f k8s/base/ingress.yaml -n production
\`\`\`

### 8. Verify Deployment

\`\`\`bash
# Check rollout status
kubectl rollout status deployment/pos-backend -n production
kubectl rollout status deployment/pos-frontend -n production

# Test endpoints
curl https://api.restaurant-pos.com/health
curl https://restaurant-pos.com

# Check logs
kubectl logs -l app=pos-backend -n production --tail=100
\`\`\`

## Post-Deployment

### Health Checks

\`\`\`bash
# Backend health
curl https://api.restaurant-pos.com/health

# Expected response:
{
  "status": "OK",
  "timestamp": "2025-01-12T...",
  "uptime": 123.45,
  "environment": "production"
}
\`\`\`

### Monitoring Dashboard Access

\`\`\`bash
# Port forward Grafana
kubectl port-forward -n monitoring svc/grafana-service 3000:3000

# Access: http://localhost:3000
# Login with credentials from secrets
\`\`\`

## Rollback Procedure

\`\`\`bash
# Rollback to previous version
kubectl rollout undo deployment/pos-backend -n production
kubectl rollout undo deployment/pos-frontend -n production

# Rollback to specific revision
kubectl rollout undo deployment/pos-backend --to-revision=2 -n production
\`\`\`

## Troubleshooting

### Pod Not Starting

\`\`\`bash
# Describe pod
kubectl describe pod <pod-name> -n production

# Check logs
kubectl logs <pod-name> -n production

# Check events
kubectl get events -n production --sort-by='.lastTimestamp'
\`\`\`

### Database Connection Issues

\`\`\`bash
# Test database connection from pod
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \\
  psql "postgresql://user:pass@host:5432/dbname"
\`\`\`

### High Memory/CPU Usage

\`\`\`bash
# Check resource usage
kubectl top pods -n production

# Increase resources
kubectl patch deployment pos-backend -n production -p \\
  '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"2Gi","cpu":"2000m"}}}]}}}}'
\`\`\`

---

**For support, contact: devops@restaurant-pos.com**
