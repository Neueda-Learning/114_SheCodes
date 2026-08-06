# Linux Docker + Jenkins — Setup & Command Reference

## One-time host setup (before Jenkins can run any of this)

**1. Install Docker Engine + Compose plugin on the Linux Jenkins agent**
(commands for Ubuntu/Debian — adjust if your org uses a different distro)
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

**2. Give the Jenkins user permission to run Docker**
This is the single most common Jenkins+Docker failure: Jenkins runs as its
own system user, and by default only `root` and members of the `docker`
group can talk to the Docker daemon.
```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```
Confirm it worked by running a manual test as the jenkins user:
```bash
sudo -u jenkins docker ps
```
If that returns a table (even an empty one) instead of a permission error,
you're set.

**3. Set up the Jenkins credential** for the DB password (one-time, via UI):
`Manage Jenkins → Credentials → System → Global credentials → Add Credentials`
- Kind: `Secret text`
- Secret: (a real password your team agrees on for the org's internal DB)
- ID: `db-password` ← must match exactly what's referenced in the `Jenkinsfile`

## Setting up the Jenkins job

1. New Item → Pipeline (or Multibranch Pipeline if you want every branch/PR
   auto-built, which fits the feature-branch workflow you're already using)
2. Pipeline definition: "Pipeline script from SCM"
3. SCM: Git, point at your team's repo, credentials for repo access if private
4. Script Path: `Jenkinsfile` (the file just created, at repo root)
5. Save, then "Build Now" to test it manually the first time

## Everyday Docker commands on Linux (no Docker Desktop involved)

```bash
# Bring the whole stack up, rebuilding images if source changed
docker compose up --build

# Same, but detached (returns your terminal immediately, containers keep running)
docker compose up -d --build

# See what's running
docker compose ps

# Follow logs for everything
docker compose logs -f

# Follow logs for just the backend
docker compose logs -f backend

# Stop everything (data in the named volume survives)
docker compose down

# Stop AND wipe the database volume (clean slate — use deliberately, not by habit)
docker compose down -v

# Get a shell inside the running backend container, e.g. to poke around
docker exec -it portfolio-backend sh

# Get a shell inside MySQL directly, e.g. to run ad-hoc SQL checks
docker exec -it portfolio-mysql mysql -uroot -p

# See images currently built/pulled on this machine
docker images

# Free up disk space from old, unused images/containers (safe to run periodically)
docker system prune
```

## Troubleshooting specific to Jenkins + Linux

| Symptom | Cause | Fix |
|---|---|---|
| `permission denied while trying to connect to the Docker daemon socket` | Jenkins user isn't in the `docker` group, or the group change hasn't taken effect yet | Re-run `sudo usermod -aG docker jenkins`, then `sudo systemctl restart jenkins` (restarting is required — group membership doesn't apply to already-running processes) |
| Pipeline hangs on the `Smoke Test` stage | Backend took longer than 15s to start (e.g. slow Flyway migration on a cold volume) | Increase the `sleep 15` in the Jenkinsfile, or better, replace it with a proper wait-loop that retries the curl a few times before failing |
| `docker compose build` works locally but fails on the Jenkins agent | Different Docker/Compose version on the agent, or the agent's disk is out of space from accumulated old images | Run `docker system prune` on the agent; confirm `docker compose version` matches what you tested with locally |
| `db-password` credential not found | Credential ID in Jenkins UI doesn't exactly match `credentials('db-password')` in the Jenkinsfile | IDs are case-sensitive and must match exactly — check under Manage Jenkins → Credentials |
| Containers from previous run still occupying the ports | A prior `docker compose up` wasn't cleanly stopped | `docker compose down` before your next `up`, or check `docker ps` for stray containers and `docker stop <id>` them manually |