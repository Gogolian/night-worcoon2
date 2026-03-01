# Plan: Plugin "Bucket" — CRUD Storage with Mock/Proxy Fallback

**Summary:** A new plugin `bucket` adds an in-memory CRUD storage layer with JSON file persistence. The admin configures collection paths (e.g., `/api/users`), each with its own ID pattern (presets: UUID, numeric, alphanumeric, or custom regexp). POST creates a resource, GET retrieves (by ID or full list), PATCH does a full override, DELETE removes. When a resource doesn't exist in the bucket → the request falls through to the mock plugin → if no match there either → proxy. The plugin runs in the pipeline **before** the mock plugin.

**Workflow:** After each step, wait for user confirmation that the step was completed correctly before proceeding to the next one.

---

## Steps

### Step 0. Save plan to file

Save this plan to `PLAN_BUCKET.md` in the project root to serve as a reference during implementation.

**Wait for confirmation before proceeding to step 1.**

---

### Step 1. Backend: Create plugin file `server/plugins/bucket.js`

New module exporting a default object with the plugin interface:

- **`name`**: `'bucket'`
- **`description`**: `'CRUD storage bucket — stores and serves resources created via POST'`
- **`enabled`**: `false`
- **`options`**: UI schema for frontend (collections managed via dedicated API; options e.g. `persistToFile: boolean`)
- **`handler`**: Main decision logic (see step 2)

**Wait for confirmation before proceeding to step 2.**

---

### Step 2. Backend: Handler logic in `bucket.js`

Handler receives `{ req, requestBody, config, decision }`. Configuration (`config`) contains a `collections` array, each entry with:
- `path` (string, e.g., `/api/users`)
- `idPattern` (string — preset name or regexp, e.g., `uuid`, `numeric`, `alphanumeric`, or custom like `[A-Z]{3}-\d{4}`)

Logic:
1. Parse `req.url` → extract pathname
2. Iterate over `config.collections` — look for a match:
   - **Exact path match** (e.g., `/api/users`) → collection-level request
   - **Path + one segment** (e.g., `/api/users/abc-123`) → resource-level request by ID
3. On match:
   - **POST on collection** → generate ID per `idPattern`, store body in storage, return `{ action: 'mock', mock: { statusCode: 201, body: { id, ...body } } }` + `stopProcessing: true`
   - **GET on collection** → return array of all resources under that path → `{ action: 'mock', mock: { statusCode: 200, body: [...] } }` + `stopProcessing: true`
   - **GET on resource (ID)** → if exists in storage: return object + `stopProcessing: true`; if not: return `null` (fall through to mock/proxy)
   - **PATCH on resource (ID)** → if exists: full override (replace entire object, keep ID), return 200 + `stopProcessing: true`; if not: return `null`
   - **DELETE on resource (ID)** → if exists: remove, return 204 + `stopProcessing: true`; if not: return `null`
4. If path doesn't match any collection → return `null` (don't block pipeline)

ID generator — helper within the same file:
- `uuid` → `crypto.randomUUID()`
- `numeric` → auto-increment per collection
- `alphanumeric` → random 8-character string `[a-zA-Z0-9]`
- Custom regexp → generate matching string (using `randexp` library or simpler algorithm)

Returned `metadata`: `{ bucketMatched: true, bucketAction: 'created|retrieved|updated|deleted|listed|miss' }`

**Wait for confirmation before proceeding to step 3.**

---

### Step 3. Backend: JSON file persistence

- Data stored in memory as `Map<collectionPath, Map<id, object>>`
- On every mutation (POST/PATCH/DELETE), data serialized to `bucket/data.json` (directory `bucket/` in project root, alongside `recordings/` and `rules/`)
- On server startup, data loaded from file (if it exists) — in `server.js` next to mock rules loading (~line 58-66), add analogous section loading bucket config and data via `pluginController.setPluginConfig('bucket', bucketConfig)`
- Collection configuration (paths + ID patterns) stored in `bucket/config.json`

**Wait for confirmation before proceeding to step 4.**

---

### Step 4. Backend: Dedicated API routes — `server/routes/bucket.js`

New Express router mounted in `server.js` as `app.use('/__api/bucket', setupBucketRoutes(pluginController))`:

- **`GET /__api/bucket/collections`** → list configured collections
- **`POST /__api/bucket/collections`** → add new collection `{ path, idPattern }`
- **`PATCH /__api/bucket/collections/:index`** → update collection
- **`DELETE /__api/bucket/collections/:index`** → remove collection
- **`GET /__api/bucket/data`** → view all data in the bucket
- **`GET /__api/bucket/data/:collectionPath`** → view data for a specific collection
- **`DELETE /__api/bucket/data`** → clear entire bucket
- **`DELETE /__api/bucket/data/:collectionPath`** → clear specific collection
- **`PUT /__api/bucket/data/:collectionPath/:id`** → manually edit a resource from UI
- **`DELETE /__api/bucket/data/:collectionPath/:id`** → manually delete a resource from UI

Every collection mutation saves changes to `bucket/config.json` and updates plugin config via `pluginController.setPluginConfig('bucket', ...)`.

**Wait for confirmation before proceeding to step 5.**

---

### Step 5. Backend: Update plugin order + mount routes

Two changes:

1. In `stateManager.js` — add `'bucket'` to default `pluginOrder` **before** `'mock'`:
   `['logger', 'cors', 'bucket', 'mock', 'recorder']`
   Add migration in `loadState()` — if `pluginOrder` doesn't contain `'bucket'`, insert it before `'mock'`.

2. In `server.js` — import and mount the bucket router:
   `app.use('/__api/bucket', setupBucketRoutes(pluginController))`
   Also add a bucket loading section at startup (analogous to mock rules).

**Wait for confirmation before proceeding to step 6.**

---

### Step 6. Frontend: Plugin view — `frontend/src/views/plugins/BucketPlugin.svelte`

Structure:
- **`PluginHeader`** — toggle enable/disable
- **"Collections" section** — list of configured paths. Each collection is a card with:
  - Input for path (e.g., `/api/users`)
  - ID pattern selector: toggle buttons (UUID / Numeric / Alphanumeric / Custom regexp) + regexp input when "Custom" is selected
  - Delete collection button
  - Resource count indicator for the collection
- **"Add Collection" button** at the bottom of the list
- **"Bucket Contents" section** — data viewer:
  - Dropdown/tabs per collection
  - Resource list (ID + body preview) with buttons: edit (opens JSON editor), delete
  - "Clear collection" and "Clear entire bucket" buttons
- **"About" section** — plugin description

Server communication: direct `fetch()` calls to `/__api/bucket/*`. Auto-save on every collection change (same pattern as MockPlugin). Bucket data refreshed after actions.

**Wait for confirmation before proceeding to step 7.**

---

### Step 7. Frontend: Supporting components (if extraction needed)

If logic in `BucketPlugin.svelte` grows too large, extract:
- `frontend/src/components/organisms/BucketCollectionList.svelte` — collection list
- `frontend/src/components/molecules/BucketCollectionCard.svelte` — collection card
- `frontend/src/components/organisms/BucketDataViewer.svelte` — data viewer

Use existing atoms: `Button`, `Input`, `Label`, `Badge`, `DeleteButton` and molecules: `Card`, `PluginSection`.

**Wait for confirmation before proceeding to step 8.**

---

### Step 8. Frontend: Register in App.svelte + icon

1. In `App.svelte` — import `BucketPlugin` and add to `pluginComponents` map: `bucket: BucketPlugin`
2. In `router.js` in `pluginIcons` map: `bucket: '🪣'`

**Wait for confirmation before proceeding to verification.**

---

### Step 9. Verification

1. **Start server** (`cd server && npm run dev`) — plugin `bucket` visible in `GET /__api/plugins`
2. **Frontend** — plugin appears in sidebar with 🪣 icon, enable/disable works
3. **CRUD test** — enable plugin, configure collection `/api/users` with UUID:
   - `POST /api/users` with body `{"name":"John"}` → 201 with ID
   - `GET /api/users` → list
   - `GET /api/users/{id}` → object
   - `PATCH /api/users/{id}` with body `{"name":"Adam"}` → 200
   - `DELETE /api/users/{id}` → 204
4. **Fallback chain** — `GET /api/users/nonexistent-id` → bucket miss → mock → proxy
5. **Persistence** — restart server, data survived

---

## Decisions

- **Plugin order:** `bucket` before `mock` — bucket takes priority, falls through when ID doesn't exist
- **Methods:** POST, GET, PATCH, DELETE (no PUT — PATCH acts as full override)
- **ID generator:** Presets (UUID, numeric, alphanumeric) + custom regexp per collection
- **Persistence:** Always active (`bucket/data.json`)
- **Auto-save:** Every UI mutation immediately saves
- **Checkpoint after each step:** Wait for user confirmation before continuing
