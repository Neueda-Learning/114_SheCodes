# Running Portfolio Manager with Docker

This lets any teammate run the entire stack — MySQL, backend, frontend —
with one command, without installing MySQL, Maven, or Node locally.

## File placement

Copy these files into your project exactly like this:

```
114_SheCodes/
├── Dockerfile                  ← backend, goes at project root
├── .dockerignore                ← backend, goes at project root
├── docker-compose.yml           ← project root
├── .env.example                 ← project root
├── pom.xml                      (already exists)
└── frontend/
    ├── Dockerfile                ← new
    ├── nginx.conf                ← new
    ├── .dockerignore              ← new
    └── package.json              (already exists)
```

## One required code change before this works: `application.properties`

Right now it likely has a hardcoded local MySQL connection (`localhost`) and
a plaintext password. Inside Docker, the backend container needs to reach
MySQL by its **service name** (`mysql`), not `localhost` — each container
has its own network namespace, so `localhost` inside the backend container
refers to the backend container itself, not the database.

Change `src/main/resources/application.properties` from this:
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/portfolio_manager
spring.datasource.username=root
spring.datasource.password=n3u3da!
```

to this:
```properties
spring.datasource.url=jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3306}/${DB_NAME:portfolio_manager}
spring.datasource.username=${DB_USERNAME:root}
spring.datasource.password=${DB_PASSWORD}
```

The `${DB_HOST:localhost}` syntax means "use the `DB_HOST` environment
variable if it's set, otherwise fall back to `localhost`" — so this same
properties file works both inside Docker (where `docker-compose.yml` sets
`DB_HOST=mysql`) AND for anyone still running the app directly via IntelliJ
on their own machine (where no `DB_HOST` env var is set, so it falls back to
`localhost` exactly like before). One file, both scenarios, no breakage for
teammates not using Docker yet.

**This also fixes the plaintext-password problem** we flagged earlier —
`DB_PASSWORD` now comes from environment/`.env`, never committed to Git.

## First-time setup (each teammate does this once)

```bash
cd 114_SheCodes
cp .env.example .env
```
Then open `.env` and set a real password for `DB_PASSWORD`.

Confirm `.gitignore` includes `.env` (not `.env.example`) so nobody
accidentally commits their real password:
```
.env
target/
.idea/
*.iml
frontend/node_modules/
frontend/dist/
```

## Running the whole stack

```bash
docker compose up --build
```

First run will take a few minutes (downloading MySQL image, Maven
dependencies, npm packages). Subsequent runs are much faster due to
Docker's layer caching.

Once it's up:
- Backend API: `http://localhost:8080`
- Frontend: `http://localhost:5173`
- MySQL: `localhost:3306` (if you want to connect via DBeaver/MySQL
  Workbench to inspect data directly)

Flyway migrations run automatically on backend startup, exactly like they
do when you run `mvn spring-boot:run` locally — nothing extra to trigger.

## Stopping

```bash
docker compose down
```
Data persists (MySQL data lives in a named volume) — restarting with
`docker compose up` again won't lose your holdings or price history.

To wipe everything and start completely fresh (e.g. testing migrations
from scratch):
```bash
docker compose down -v
```
The `-v` also removes the volume — all data is gone after this, useful for
testing but be sure that's actually what you want first.

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| Backend container exits immediately, logs show connection refused | Backend started before MySQL was ready | Shouldn't happen — `depends_on: condition: service_healthy` in compose handles this. If it still does, check `docker compose logs mysql` for a startup error |
| `Access denied for user 'root'` | `.env` password doesn't match what MySQL container was created with | If you changed `DB_PASSWORD` after first run, MySQL's volume still has the old password baked in. Run `docker compose down -v` to reset, then `up --build` again |
| Frontend loads but API calls fail (CORS or network error) | `VITE_API_BASE_URL` baked into frontend build doesn't match where backend actually is | Confirm `.env`'s `VITE_API_BASE_URL` matches how you're accessing the backend, then rebuild: `docker compose up --build frontend` |
| Changes to Java code don't show up | Docker image was built once and cached | `docker compose up --build` rebuilds; plain `docker compose up` reuses the existing image |
| Port already in use (8080/3306/5173) | Something else running locally on that port (e.g. IntelliJ's own instance of the app) | Stop the local process first, or change the left-hand port number in `docker-compose.yml`'s `ports:` section (e.g. `"8081:8080"`) |

## For your instructor/customer demo

Once running, `docker compose up --build` from a clean checkout is a strong
thing to demo live — "clone the repo, one command, whole app running,"
proves the setup isn't dependent on anyone's personal machine configuration.
Worth rehearsing this once from a fresh `git clone` before the actual
meeting, so any first-run surprises happen to you now, not live.