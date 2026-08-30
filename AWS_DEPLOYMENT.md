# AWS & Docker Deployment Guide

## Architecture Overview

This application is configured for high-volume, enterprise multi-wallet NFT mint execution. It includes:

1. **Frontend & Ingest Gateway**: TanStack Start SSR + React 19 + Viem.
2. **Resilient Public/Private Multi-Chain RPC Engine**: Supports Ethereum, Base, Arbitrum, Blast, Polygon, Optimism, BNB Chain, and Sepolia with automatic latency ranking & retry fallbacks.
3. **Hardware & Ephemeral Key Protection**: In-memory ephemeral vault with PBKDF2/AES-256-GCM zeroization.
4. **Redis Task Broker & Worker Queue (Dockerized)**: Persistent BullMQ task orchestration for high-volume automated execution.

---

## Deploying on AWS EC2 (Single-Host Docker Compose)

### 1. Launch EC2 Instance

- **Instance Type**: `t3.medium` or `t3.large` (2-4 vCPU, 4-8 GB RAM recommended for high-volume concurrency).
- **AMI**: Ubuntu Server 24.04 LTS or Amazon Linux 2023.
- **Security Group**: Open port `80` (HTTP), `443` (HTTPS), `3000` (Direct test), and `22` (SSH).

### 2. Install Docker & Docker Compose on EC2

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker ubuntu
newgrp docker
```

### 3. Clone Repository & Configure Environment

```bash
git clone <your-repo-url> lumi-sniper
cd lumi-sniper

# Copy environment template
cp .env.example .env
# Edit your RPC URLs and OpenSea API Key if available:
nano .env
```

### 4. Build and Run via Docker Compose

```bash
sudo docker compose up -d --build
```

### 5. Check Service Logs & Health

```bash
sudo docker compose logs -f app
```

---

## Deploying on AWS ECS (Elastic Container Service) with Fargate

1. **Push Image to AWS ECR**:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <YOUR_AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
docker build -t lumi-sniper .
docker tag lumi-sniper:latest <YOUR_AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/lumi-sniper:latest
docker push <YOUR_AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/lumi-sniper:latest
```

2. **ECS Task Definition**:
   - Set container port to `3000`.
   - Connect to an Amazon ElastiCache (Redis) instance for shared multi-node scheduling.
   - Allocate 1-2 vCPU and 2-4 GB memory per task container.
