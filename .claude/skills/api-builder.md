---
name: API Builder
description: Build consistent REST APIs following TrueKin backend patterns
command: api-builder
---

# API Builder Skill

Use this skill to build new API endpoints following TrueKin's established patterns and best practices.

## Structure Overview

Every API follows this 3-part structure:

1. **Routes** (`src/routes/`) - HTTP handlers and request validation
2. **Services** (`src/services/`) - Business logic and database operations
3. **Types** (`src/types/`) - TypeScript interfaces and contracts

## Step-by-Step Guide

### 1. Define API Contracts
Create or review the API specifications (endpoints, request/response schemas, authentication requirements).

### 2. Create Type Definitions
If needed, create types in `src/types/[feature].ts`:

```typescript
export type EntityName = {
  id: string;
  field1: string;
  field2: number | null;
  createdAt: string;
};
```

### 3. Implement Service Methods
Create or extend service in `src/services/[feature]-service.ts`:

```typescript
import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession, type SessionContext } from "./session-service.js";

// Use generic select string for database queries
const entitySelect = "id, field1, field2, created_at";

// Input validation types
type SaveEntityInput = {
  userId: string;
  sessionToken: string;
  field1: string;
  field2?: number;
};

// Service function
export async function saveEntity(input: SaveEntityInput): Promise<EntityName> {
  // Validate session
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  // Validate inputs
  if (!input.field1 || input.field1.trim().length === 0) {
    throw new Error("Field1 is required");
  }

  // Ensure user record exists (if needed)
  // await ensureProfileRow(authUser.id, authUser.phone);

  // Perform database operation
  const { data, error } = await supabaseAdmin
    .from("table_name")
    .insert({
      user_id: authUser.id,
      field1: input.field1.trim(),
      field2: input.field2,
    })
    .select(entitySelect)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Operation failed");

  return data as EntityName;
}
```

### 4. Create Route Handlers
Create route file in `src/routes/[feature].ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { saveEntity } from "../services/[feature]-service.js";

// Utility functions
function readHeader(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function getAuthFromRequest(request: { headers: Record<string, unknown> }) {
  return {
    userId:
      readHeader(request.headers["x-user-id"]) ||
      readHeader(request.headers["X-User-Id"]),
    sessionToken:
      readHeader(request.headers["x-session-token"]) ||
      readHeader(request.headers["X-Session-Token"]),
  };
}

// Validation schemas
const saveEntitySchema = z.object({
  field1: z.string().min(1, "Field1 is required").max(100),
  field2: z.number().optional(),
});

// Route registration
export async function registerFeatureRoutes(app: FastifyInstance) {
  app.post("/v1/feature/save", async (request, reply) => {
    try {
      // Validate request body
      const body = saveEntitySchema.parse(request.body);
      
      // Extract auth headers
      const { userId, sessionToken } = getAuthFromRequest(request);

      // Check authentication
      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      // Call service
      const result = await saveEntity({
        userId,
        sessionToken,
        field1: body.field1,
        field2: body.field2,
      });

      // Return success response
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // Handle validation errors
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: error.issues[0]?.message || "Invalid request body",
        });
      }

      // Handle service errors
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : "Operation failed",
      });
    }
  });
}
```

### 5. Register Routes in App
Update `src/app.ts`:

```typescript
import { registerFeatureRoutes } from "./routes/[feature].js";

export async function buildApp() {
  // ... existing code ...
  await registerFeatureRoutes(app);
  // ... rest of routes ...
}
```

### 6. Create Database Migration (if needed)
Create `supabase/migrations/XXX_add_feature.sql`:

```sql
CREATE TABLE feature_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  field1 TEXT NOT NULL,
  field2 INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feature_entities_user ON feature_entities(user_id);
```

## Best Practices

### Validation
- Always validate inputs with Zod schemas
- Use descriptive error messages in Zod schemas
- Validate at the route level before calling service
- Return specific field validation errors

### Error Handling
- Use descriptive error messages
- Throw errors from service, catch in route
- Return appropriate HTTP status codes (401, 400, 500)
- Keep error messages user-friendly

### Database
- Use `supabaseAdmin` for service operations
- Define `select` string at top of service file
- Use `.single()` for single-row queries
- Always check for errors and null responses
- Use `eq()`, `insert()`, `update()`, `delete()` consistently

### Type Safety
- Define input types for service functions
- Use TypeScript types from Response types
- Cast database results to types at the end

### Authentication
- Always check `userId` and `sessionToken` before operation
- Use `assertValidSession()` to validate both
- Return 401 for missing/invalid auth
- Extract auth headers using `getAuthFromRequest()`

### API Response Format
Success:
```json
{
  "success": true,
  "data": { /* entity or array of entities */ }
}
```

Error:
```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

## Testing Endpoints

```bash
# Using curl
curl -X POST http://localhost:4000/v1/feature/save \
  -H "x-user-id: {user-uuid}" \
  -H "x-session-token: {token}" \
  -H "Content-Type: application/json" \
  -d '{"field1": "value"}'
```

## Checklist

- [ ] Types defined in `src/types/[feature].ts`
- [ ] Service functions implemented with error handling
- [ ] Route handlers created with validation
- [ ] Routes registered in `src/app.ts`
- [ ] Database migration created (if needed)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Tested with curl or API client
- [ ] Committed with descriptive message
