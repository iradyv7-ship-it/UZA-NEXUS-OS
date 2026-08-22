# Deploying UZA Nexus

One host, four containers, about forty minutes of work. Everything below is run **on the
server**, not on your laptop.

## What you need first

| | |
|---|---|
| A Linux server | 2 vCPU / 4 GB RAM / 40 GB disk is comfortable. Alibaba Cloud ECS is the obvious choice — the platform team already deploys there. |
| A DNS record | `nexus.uzasolutions.rw` → the server's IP. **Set this before you start.** Caddy asks Let's Encrypt for a certificate on first boot and the request fails if the name does not already resolve. |
| Ports 80 and 443 open | Nothing else. Postgres and both apps publish no ports at all. |
| Docker | `curl -fsSL https://get.docker.com \| sh` |

## Deploy

```bash
git clone https://github.com/iradyv7-ship-it/uza-nexus.git
cd uza-nexus
git checkout nexas-planning
cp .env.prod.example .env.prod
```

Fill in `.env.prod`. Two values need generating rather than inventing:

```bash
openssl rand -base64 36   # POSTGRES_PASSWORD
openssl rand -base64 48   # JWT_SECRET
```

Leave the intake variables blank. The Claude Code transcripts and the working-documents
repository are on the founder's laptop; the server cannot see them and should not try.

Then:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

First build takes five to ten minutes. Migrations run automatically when the API starts —
`prisma migrate deploy` applies committed migrations only and never prompts or resets.

## Load the register

Once, after the first boot. **The order matters** — a decision in the register points at
an initiative created by the Bulk seed, so that one runs first:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api sh -c \
  'pnpm exec tsx prisma/seed-org.ts && pnpm exec tsx prisma/seed-bulk-pipeline.ts && pnpm exec tsx prisma/seed-register.ts'
```

Then the accounts. Choose the temporary password yourself — the script refuses to run
without one and never invents a default:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec \
  -e SEED_PASSWORD='<choose one>' api pnpm exec tsx prisma/seed-users.ts
```

Ten accounts, `firstname@uzasolutions.rw`. **Everyone changes theirs on first sign-in.**
Re-running the seed never resets a password someone has already changed, which also means
that if you get the temporary one wrong you must delete the user rows and seed again.

## Check it came up

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
curl -sI https://nexus.uzasolutions.rw | head -1
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api
```

Then sign in and open `/register`. If the four numbers at the top are populated, the whole
chain works: TLS, web, API, database, seed data.

## Back it up

Do this on day one, not after the first scare. The register is the only copy of who owns
what, what was decided, and why — none of it is reconstructible from the code.

```bash
sudo tee /etc/cron.daily/uza-nexus-backup >/dev/null <<'CRON'
#!/bin/sh
cd /root/uza-nexus || exit 1
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_dump -U uza uza_nexus | gzip > "backups/uza_nexus_$(date +%F).sql.gz"
find backups -name 'uza_nexus_*.sql.gz' -mtime +30 -delete
CRON
sudo chmod +x /etc/cron.daily/uza-nexus-backup
```

That keeps thirty days **on the same disk as the database**, which protects against a bad
migration and not against losing the server. Copy the dumps somewhere else — object
storage, or simply `scp` them down weekly. A backup that dies with its host is a habit,
not a backup.

Restoring:

```bash
gunzip -c backups/uza_nexus_2026-08-22.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  psql -U uza -d uza_nexus
```

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

New migrations apply on API start. Take a backup first if the release contains one.

## What is deliberately not here

**A managed database and a load balancer.** Correct at a scale UZA is nowhere near. The
cost of operating three cloud services is paid every week; the benefit arrives never, at
ten people. When the register holds a year of history and someone depends on it hourly,
move the database out first — it is the piece whose loss cannot be undone.

**Anything that reads the founder's laptop.** Intake stays local until there is a reason
for a server to hold a mailbox token.
