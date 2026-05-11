# Setup Guide

Complete local development setup for Weft.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [Docker](https://docs.docker.com/get-docker/) | Any | Runs the PostgreSQL container |
| [Node.js](https://nodejs.org/) | 18+ | For the dashboard |
| [Rust](https://rustup.rs/) | stable | Auto-installed by `dev.sh` if missing |
| macOS: Bash 4+ | 4+ | `brew install bash` — macOS ships Bash 3.2 |

**pnpm** and **Restate** are auto-installed by `dev.sh` if missing.

---

## Step 1 — Clone and configure

```bash
git clone https://github.com/samcolibri/weft.git
cd weft
cp .env.example .env
```

Open `.env` and fill in the keys you need:

```bash
# LLM nodes — required if you use any AI node
OPENROUTER_API_KEY=sk-or-...

# Web Search nodes
TAVILY_API_KEY=tvly-...

# People / Org enrichment nodes
APOLLO_API_KEY=...

# Python code execution (E2B cloud sandbox)
E2B_API_KEY=e2b_...

# Speech-to-text
ELEVENLABS_API_KEY=...

# Communication nodes (add only the ones you use)
DISCORD_BOT_TOKEN=...
SLACK_BOT_TOKEN=...
```

All keys are optional. Nodes show a clear error at runtime if their key is missing — they won't break other nodes.

---

## Step 2 — Start the backend

```bash
./dev.sh server
```

This runs automatically:
1. Checks Rust/Cargo (installs via rustup if missing)
2. Checks Restate (installs via npm if missing)
3. Starts a PostgreSQL Docker container on port `5433`
4. Runs database migrations
5. Builds the Rust project (`cargo build --release`)
6. Starts Restate server (`localhost:8080`)
7. Starts the Orchestrator (`localhost:9080`) and registers it with Restate
8. Starts the Weft API (`localhost:3000`)
9. Starts the Node Runner (`localhost:9082`)

```
Services when healthy:
  Restate Server:    http://localhost:8080
  Restate Admin:     http://localhost:9070
  Orchestrator:      http://localhost:9080
  Weft API:          http://localhost:3000
  Node Runner:       http://localhost:9082
  PostgreSQL:        localhost:5433
```

First run takes 2-5 minutes (Rust compile). Subsequent runs are ~10 seconds.

---

## Step 3 — Start the dashboard

In a second terminal:

```bash
./dev.sh dashboard
```

Opens at **http://localhost:5173**

The dashboard auto-installs its Node.js dependencies (`pnpm install`) on first run.

---

## Architecture overview

```mermaid
graph TB
    subgraph You
        Browser["Browser\n:5173"]
    end

    subgraph Dashboard["dashboard/ (SvelteKit)"]
        UI[Visual Editor + Code View]
        SRV[SvelteKit Server]
    end

    subgraph API["crates/weft-api (:3000)"]
        REST[REST API\n/api/v1/...]
    end

    subgraph Orchestrator["crates/weft-orchestrator (:9080)"]
        EXEC[Program Executor]
    end

    subgraph NodeRunner["crates/weft-nodes (:9082)"]
        NR[Node Dispatcher]
        CAT[Catalog: 97 nodes]
    end

    subgraph Restate[":8080 / :9070"]
        RS[Durable Execution\nEngine]
    end

    subgraph PG["PostgreSQL (:5433)"]
        DB[(weft_local)]
    end

    Browser --> UI
    UI --> SRV
    SRV --> REST
    SRV --> DB
    REST --> EXEC
    REST --> DB
    EXEC --> RS
    RS --> EXEC
    EXEC --> NR
    NR --> CAT
```

---

## Environment variables reference

### Core

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5433/weft_local` | PostgreSQL connection (set by `dev.sh` automatically) |
| `DEPLOYMENT_MODE` | `local` | `local` disables JWT auth and credit checks |
| `RESTATE_PORT` | `8080` | Restate ingress port |
| `ORCHESTRATOR_PORT` | `9080` | Orchestrator port |
| `NODE_RUNNER_PORT` | `9082` | Node runner port |
| `WEFT_API_PORT` | `3000` | Weft API port |

### API keys

| Variable | Node(s) that use it |
|---|---|
| `OPENROUTER_API_KEY` | `LlmInference`, `LlmConfig` |
| `TAVILY_API_KEY` | `TavilySearch`, `TavilyConfig` |
| `APOLLO_API_KEY` | `ApolloSearch`, `ApolloEnrich`, `ApolloOrgSearch`, `ApolloConfig` |
| `E2B_API_KEY` | `ExecPython` |
| `ELEVENLABS_API_KEY` | `ElevenLabsTranscribe`, `ElevenLabsConfig` |
| `DISCORD_BOT_TOKEN` | All Discord nodes |
| `SLACK_BOT_TOKEN` | All Slack nodes |

---

## Troubleshooting

### Dashboard shows "Internal Error" on first load

Usually a Node.js version conflict or pnpm issue. Check:

```bash
node --version   # must be 18+
```

If pnpm isn't in PATH, add it manually:

```bash
export PATH="$HOME/Library/pnpm/bin:$PATH"   # macOS
./dev.sh dashboard
```

### `DATABASE_URL` points to a remote/cloud database

Your shell might have a `DATABASE_URL` exported from another project. `dev.sh dashboard` automatically overrides it to `localhost:5433` when `DEPLOYMENT_MODE=local`. If you're starting vite manually:

```bash
DATABASE_URL="postgres://postgres:postgres@localhost:5433/weft_local" node_modules/.bin/vite dev
```

### Port already in use

```bash
./cleanup.sh --services   # stops all weft services
./dev.sh server           # restart
```

Or manually:

```bash
lsof -ti :3000 :8080 :9080 :9082 | xargs kill -9
```

### Weft API panics: DATABASE_URL not set

Docker isn't running. Start Docker Desktop, then:

```bash
./init-db.sh   # starts the postgres container
./dev.sh server
```

### `kind` / Kubernetes errors at startup

Infrastructure nodes (Postgres Database, WhatsApp bridge) require Kubernetes. Most projects don't use them. If you see `kind not installed` errors and don't need infra nodes, leave `INFRASTRUCTURE_TARGET` unset (default) in `.env` — the error will be skipped.

If you do need infra nodes:

```bash
brew install kind
INFRASTRUCTURE_TARGET=local ./dev.sh server
```

### Catalog-link.sh: `associative array` error on macOS

macOS ships Bash 3.2 which doesn't support associative arrays. Install Bash 4+:

```bash
brew install bash
```

`dev.sh` auto-detects Homebrew Bash and uses it.

---

## Useful commands

```bash
# Start / stop
./dev.sh server          # backend only
./dev.sh dashboard       # frontend only
./dev.sh all             # both (server background, dashboard foreground)

# Reset
./cleanup.sh             # stop services, wipe Restate data + DB
./cleanup.sh --no-db     # stop services, keep DB data
./cleanup.sh --db-destroy  # remove postgres container entirely

# Build checks
cargo build              # works without postgres (sqlx prepared queries committed)
cargo test               # works without postgres

# Inspect running services
curl http://localhost:3000/health
curl http://localhost:9080/health
curl http://localhost:9082/health
```

---

## VS Code

A `Dev Local All` task is pre-configured in `.vscode/tasks.json`. It starts both the server and dashboard in split terminals.

---

## Adding a node

Every node is two files in `catalog/`:

```
catalog/<category>/:<prefix>/<name>/
├── backend.rs   # Rust: implement the Node trait
└── frontend.ts  # TypeScript: ports, config fields, icon
```

Example — a new Clearbit enrichment node:

```bash
mkdir -p catalog/enrichment/:clearbit/enrich
# Write backend.rs (implement Node trait)
# Write frontend.ts (describe ports + UI)
./dev.sh server   # auto-discovers the node at startup
```

Full walkthrough: [CONTRIBUTING.md](./CONTRIBUTING.md)
