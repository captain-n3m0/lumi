# AWS & Docker Deployment Guide

## Architecture

The current production container runs the TanStack Start app, server-side OpenSea proxy, live RPC gas endpoint, and ETH/USD price endpoint. It does not start a Redis/BullMQ worker by default; connect a durable queue/worker before relying on browser-independent execution.

## EC2 With Docker Compose

1. Launch an Ubuntu 24.04 LTS or Amazon Linux 2023 instance.
2. Open ports `80`, `443`, `3000`, and `22` as needed.
3. Install Docker and Compose.

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker ubuntu
newgrp docker
```

4. Clone and configure the app.

```bash
git clone <your-repo-url> lumi
cd lumi
cp .env.example .env
nano .env
```

5. Build and run.

```bash
sudo docker compose up -d --build
sudo docker compose logs -f app
```

The app listens on port `3000` inside the container.

## ECS/Fargate

Build and push the image to ECR, set container port `3000`, and provide `OPENSEA_API_KEY` plus any RPC override environment variables needed for your deployment. Use a load balancer with TLS termination for public traffic.
