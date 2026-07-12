# IBM Code Engine Deployment Guide

Step-by-step instructions to deploy AgroGenie AI on **IBM Cloud Code Engine**.

---

## Prerequisites

- IBM Cloud account with Code Engine access
- IBM Cloud CLI installed: https://cloud.ibm.com/docs/cli
- Docker installed and running
- IBM Container Registry namespace

Install required CLI plugins:
```bash
ibmcloud plugin install code-engine
ibmcloud plugin install container-registry
```

---

## Step 1 — Build and Push Docker Image

```bash
# 1. Login to IBM Cloud
ibmcloud login --sso

# 2. Login to IBM Container Registry
ibmcloud cr login
ibmcloud cr namespace-add agrogenie-ns   # Create namespace if needed

# 3. Build image
docker build -t us.icr.io/agrogenie-ns/agrogenie-ai:latest .

# 4. Push to registry
docker push us.icr.io/agrogenie-ns/agrogenie-ai:latest

# 5. Verify image
ibmcloud cr images --restrict agrogenie-ns
```

---

## Step 2 — Create Code Engine Project

```bash
# Create a new project
ibmcloud ce project create --name agrogenie-prod

# Select the project
ibmcloud ce project select --name agrogenie-prod
```

---

## Step 3 — Create Registry Access Secret

```bash
# Create API key for registry access
ibmcloud iam api-key-create agrogenie-registry-key -d "Code Engine registry pull" \
  --file agrogenie-registry-key.json

# Create the registry secret in Code Engine
ibmcloud ce secret create \
  --name agrogenie-registry-secret \
  --format registry \
  --server us.icr.io \
  --username iamapikey \
  --password "$(cat agrogenie-registry-key.json | jq -r '.apikey')"
```

---

## Step 4 — Create Application Secrets

```bash
# Create secret with all credentials
ibmcloud ce secret create --name agrogenie-secrets --format generic \
  --from-literal MONGODB_URI="mongodb+srv://..." \
  --from-literal WATSONX_API_KEY="..." \
  --from-literal WATSONX_PROJECT_ID="..." \
  --from-literal IBM_COS_API_KEY="..." \
  --from-literal IBM_COS_RESOURCE_INSTANCE_ID="..." \
  --from-literal IBM_COS_ENDPOINT="https://s3.us-south.cloud-object-storage.appdomain.cloud" \
  --from-literal IBM_COS_BUCKET_NAME="agrogenie-prod" \
  --from-literal IBM_STT_API_KEY="..." \
  --from-literal IBM_TTS_API_KEY="..." \
  --from-literal MARKET_API_KEY="..."
```

---

## Step 5 — Deploy Application

```bash
ibmcloud ce app create \
  --name agrogenie-ai \
  --image us.icr.io/agrogenie-ns/agrogenie-ai:latest \
  --registry-secret agrogenie-registry-secret \
  --port 5000 \
  --min-scale 1 \
  --max-scale 3 \
  --cpu 0.5 \
  --memory 1G \
  --env-from-secret agrogenie-secrets \
  --env NODE_ENV=production \
  --env USE_MOCK_PROVIDERS=false \
  --env LOG_LEVEL=info \
  --env RATE_LIMIT_MAX_PROD=200
```

---

## Step 6 — Configure Custom Domain (Optional)

```bash
# Get the auto-generated URL
ibmcloud ce app get --name agrogenie-ai --output url

# Configure custom domain mapping
ibmcloud ce domain-mapping create \
  --domain agrogenie.yourdomain.in \
  --target agrogenie-ai
```

---

## Step 7 — Verify Deployment

```bash
# Get application URL
APP_URL=$(ibmcloud ce app get --name agrogenie-ai --output url)

# Test health endpoint
curl "$APP_URL/api/v1/health"

# Test readiness
curl "$APP_URL/api/v1/health/ready"

# View logs
ibmcloud ce app logs --name agrogenie-ai --follow
```

---

## Updating the Application

```bash
# Build and push new image
docker build -t us.icr.io/agrogenie-ns/agrogenie-ai:v1.1.0 .
docker push us.icr.io/agrogenie-ns/agrogenie-ai:v1.1.0

# Update Code Engine app
ibmcloud ce app update \
  --name agrogenie-ai \
  --image us.icr.io/agrogenie-ns/agrogenie-ai:v1.1.0
```

---

## Scaling and Performance

| Resource | Development | Production |
|----------|-------------|-----------|
| CPU | 0.25 vCPU | 0.5–1 vCPU |
| Memory | 512 MB | 1–2 GB |
| Min Scale | 0 (scale-to-zero) | 1 (always on) |
| Max Scale | 2 | 5 |
| Timeout | 300s | 300s |

---

## Monitoring and Logs

```bash
# Real-time logs
ibmcloud ce app logs --name agrogenie-ai --follow

# View recent events
ibmcloud ce app events --name agrogenie-ai

# List revisions
ibmcloud ce app list-revisions --application agrogenie-ai
```

---

## Rollback

```bash
# List revisions
ibmcloud ce app list-revisions --application agrogenie-ai

# Route traffic to previous revision
ibmcloud ce app update \
  --name agrogenie-ai \
  --image us.icr.io/agrogenie-ns/agrogenie-ai:<previous-tag>
```

---

## Cost Estimate

IBM Code Engine pricing (as of 2026):
- vCPU-second: ~$0.00003400
- Memory GB-second: ~$0.00000374
- HTTP requests: ~$0.53 per million

For a demo/development instance (1 min scale, 0.5 CPU, 1 GB RAM):
- Idle (scale-to-zero): ~$0/month
- 1 instance always on: ~$5–15/month (depends on requests)

See: https://cloud.ibm.com/catalog/services/codeengine#pricing
