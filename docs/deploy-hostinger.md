# Deploy on Hostinger

Base runs on any Hostinger **VPS** using the Docker Manager (Docker Compose) template.

1. Create a VPS with the **Docker** OS template (Ubuntu 24.04 with Docker).
2. Open **Docker Manager → Compose → Create project from URL** and paste:
   `https://raw.githubusercontent.com/maxffarrell/base/main/docker-compose.yml`
3. Set environment variables:
   - `POSTGRES_PASSWORD` – output of `openssl rand -hex 32`, saved persistently for the database volume
   - `BETTER_AUTH_SECRET` – a separate output of `openssl rand -hex 32`, saved persistently for sessions
   - `ORIGIN` – your public URL, e.g. `https://app.example.com`
4. Deploy. Base listens on port 3000; point your domain at the VPS and enable HTTPS from **Domains → SSL**.

Upgrades: in Docker Manager choose **Pull & redeploy**. Migrations run automatically on start.
Reuse the existing database password and authentication secret during upgrades; do not regenerate them on redeploy.
