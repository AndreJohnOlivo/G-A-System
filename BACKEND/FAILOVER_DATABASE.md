# MongoDB Failover Database

This backend uses a three-member MongoDB replica set named `ucc-rs`. MongoDB automatically elects a healthy secondary as primary when the current primary fails. When the failed member returns, it resynchronizes and rejoins as a secondary.

## Start

From the `G-A-System` directory, run:

```powershell
docker compose up --build -d
```

The application is available at `http://localhost:3000`.

## Test Failover

Stop the preferred primary:

```powershell
docker compose stop mongo-primary
```

After MongoDB completes an election, the backend driver discovers the elected primary and continues retryable reads and writes. Restore the member with:

```powershell
docker compose start mongo-primary
```

Inspect the elected member with:

```powershell
docker compose exec mongo-secondary-1 mongosh --quiet --eval "rs.status().members.map(member => ({ name: member.name, state: member.stateStr }))"
```

The `MONGO_URI` must list all replica-set members and include `replicaSet=ucc-rs`. Do not configure the backend with a single-member URI when high availability is required.