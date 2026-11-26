import { agentPlanJsonSchema, programJsonSchema } from "./tools";
import { recordImportTool } from "./records";
import { recordReadProperties } from "./record-read";
import { mealWriteTool } from "./meal-write";
import { templateChangeRequestSchema } from "./template-change";
import { exerciseDemoTool } from "./exercise-demos";

const readRecordParameters = Object.entries(recordReadProperties).map(([name, schema]) => ({
  in: "query", name, required: name === "profileRef" || name === "scope", schema,
}));

export function agentApiSchema(origin: string) {
  const auth = [{ AgentToken: [] }];
  const response = { "200": { description: "Account-scoped result; see response body." }, "401": { description: "Missing, expired or revoked token" }, "403": { description: "Scope or account mismatch" }, "409": { description: "Revision, date or idempotency conflict; no protected records overwritten" }, "429": { description: "Retry after one minute" } };
  return {
    openapi: "3.1.0", info: { title: "Spotter personal Agent API", version: "1.3.0", description: "User-supplied agents generate content. Spotter validates authorized plan drafts and changes private records within the connection's scopes. Private Sites may require platform authorization before dispatching these routes." },
    servers: [{ url: origin }], security: auth,
    components: { securitySchemes: { AgentToken: { type: "http", scheme: "bearer", description: "Create in Spotter settings after signing in. Never send this token to a model provider unless you have intentionally configured that agent's tool runtime to hold it." } }, schemas: { Plan: agentPlanJsonSchema, Program: programJsonSchema } },
    paths: {
      "/api/agent/profile": { get: { operationId: "getAgentProfile", description: "Read this token's account reference and granted scopes before any context or write operation.", responses: response } },
      "/api/agent/context": { get: { operationId: "readPlanningContext", description: "Requires read:context; excludes health, nutrition and all other users. Personal and catalogue pages each report nextOffset.", parameters: [{ in: "query", name: "profileRef", required: true, schema: { type: "string" } }, { in: "query", name: "query", schema: { type: "string", maxLength: 100 } }, { in: "query", name: "offset", schema: { type: "integer", minimum: 0 } }, { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100 } }], responses: response } },
      "/api/agent/drafts": {
        get: { operationId: "listPlanDrafts", description: "Requires plans:draft or plans:write. Optional id returns a reviewed preview.", parameters: [{ in: "query", name: "id", schema: { type: "string", format: "uuid" } }], responses: response },
        post: { operationId: "stagePlans", description: "Requires plans:draft. Reuse requestId for identical retries; change it for a different draft. Never saves to the calendar by itself.", requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["profileRef", "requestId", "plans"], properties: { profileRef: { type: "string" }, requestId: { type: "string", format: "uuid" }, title: { type: "string", maxLength: 100 }, plans: { type: "array", minItems: 1, maxItems: 20, items: { $ref: "#/components/schemas/Plan" } } } } } } }, responses: response },
      },
      "/api/agent/commit": { post: { operationId: "commitPlanDraft", description: "Requires plans:write plus the user's authorization of this exact draft revision. Retries return the recorded result.", requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["profileRef", "draftId", "revision", "confirmed"], properties: { profileRef: { type: "string" }, draftId: { type: "string", format: "uuid" }, revision: { type: "string", pattern: "^[a-f0-9]{64}$" }, confirmed: { const: true } } } } } }, responses: response } },
      "/api/agent/records": { get: { operationId: "readPersonalRecords",
        description: "Requires the matching training:read, nutrition:read or templates:read scope. Read one category at a time and continue until nextOffset is null. Includes only records owned by this account.",
        parameters: readRecordParameters, responses: response }, post: { operationId: "appendPersonalRecords", description: "Requires the matching training:write, nutrition:write, body:write or templates:write scope. Confirm each batch and reuse UUIDs when retrying.", requestBody: { required: true, content: { "application/json": { schema: recordImportTool.inputSchema } } }, responses: response } },
      "/api/agent/meals": { post: { operationId: "addPersonalMeals",
        description: "Requires nutrition:write. Append confirmed meals, keeping the UUID of each meal stable across retries.",
        requestBody: { required: true, content: { "application/json": { schema: mealWriteTool.inputSchema } } }, responses: response } },
      "/api/agent/templates": { post: { operationId: "previewOrCommitTemplateChange",
        description: "Requires templates:manage. Preview a rename, replacement exercise list or deletion for a known personal template revision. Commit the exact previewToken only after the user confirms it. Read template IDs and revisions with GET /api/agent/records?scope=templates.",
        requestBody: { required: true, content: { "application/json": { schema: templateChangeRequestSchema } } },
        responses: { ...response, "404": { description: "Template or preview unavailable for this connection" } } } },
      "/api/agent/exercise-demos": { post: { operationId: "changePersonalExerciseDemo",
        description: "Requires exercise-demos:write and confirmation of the attachment or removal for this exact exercise. The private GIF is displayed in the signed-in owner's exercise details.",
        requestBody: { required: true, content: { "application/json": { schema: exerciseDemoTool.inputSchema } } }, responses: response } },
      "/api/agent/mcp": { post: { operationId: "callMcpTool", description: "JSON Streamable HTTP subset: server/discover, initialize, tools/list, tools/call; explicit Bearer scopes apply. Standard clients need HTTP/MCP support and access through the hosting platform.", responses: response } },
      "/api/agent/programs": { post: { operationId: "stagePreviewOrCommitProgram", description: "Stage/preview a complete multiweek program, then commit only with the user's authorization of that preview. Content is bounded to52 weeks/364 sessions; partial/duplicate/mismatched dates are rejected.", requestBody: { required: true, content: { "application/json": { schema: { oneOf: [
        { type: "object", additionalProperties: false, required: ["action", "profileRef", "program", "revision"], properties: { action: { const: "stage" }, profileRef: { type: "string" }, program: { $ref: "#/components/schemas/Program" }, revision: { type: ["string", "null"] } } },
        { type: "object", additionalProperties: false, required: ["action", "profileRef", "programId", "revision"], properties: { action: { const: "preview" }, profileRef: { type: "string" }, programId: { type: "string", format: "uuid" }, revision: { type: "string" } } },
        { type: "object", additionalProperties: false, required: ["action", "profileRef", "programId", "revision", "previewToken", "confirmed"], properties: { action: { const: "commit" }, profileRef: { type: "string" }, programId: { type: "string", format: "uuid" }, revision: { type: "string" }, previewToken: { type: "string" }, confirmed: { const: true } } },
      ] } } } }, responses: response } },
    },
  };
}
