import type { FastifyInstance, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { submitSupportTicket, getUserTickets, getTicketDetails } from "../services/support-service.js";

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

const submitTicketSchema = z.object({
  issue_type: z.string().min(1, "Issue type is required"),
  subject: z.string().min(1, "Subject is required").max(255),
  message: z.string().min(1, "Message is required").max(5000),
});

export async function registerSupportRoutes(app: FastifyInstance) {
  // Submit Support Ticket
  app.post("/v1/support/submit-ticket", async (request: FastifyRequest, reply) => {
    try {
      const body = submitTicketSchema.parse(request.body);
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      const result = await submitSupportTicket({
        userId,
        sessionToken,
        issueType: body.issue_type,
        subject: body.subject,
        message: body.message,
      });

      return {
        success: true,
        message: result.message,
        ticket_id: result.ticket_id,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          error: "Invalid request body",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      console.error("Error submitting support ticket:", error);
      const message = error instanceof Error ? error.message : "Failed to submit ticket";
      return reply.code(400).send({
        success: false,
        error: message,
      });
    }
  });

  // Get User's Tickets
  app.get("/v1/support/tickets", async (request: FastifyRequest, reply) => {
    try {
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      const tickets = await getUserTickets(userId, sessionToken);

      return {
        success: true,
        tickets,
      };
    } catch (error) {
      console.error("Error fetching tickets:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch tickets";
      return reply.code(400).send({
        success: false,
        error: message,
      });
    }
  });

  // Get Ticket Details
  app.get("/v1/support/tickets/:ticket_id", async (request: FastifyRequest, reply) => {
    try {
      const { ticket_id } = request.params as { ticket_id: string };
      const { userId, sessionToken } = getAuthFromRequest(request);

      if (!userId || !sessionToken) {
        return reply.code(401).send({
          success: false,
          error: "Unauthorized",
        });
      }

      const ticket = await getTicketDetails(userId, sessionToken, ticket_id);

      return {
        success: true,
        ticket,
      };
    } catch (error) {
      console.error("Error fetching ticket:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch ticket";

      if (message === "Ticket not found") {
        return reply.code(404).send({
          success: false,
          error: message,
        });
      }

      return reply.code(400).send({
        success: false,
        error: message,
      });
    }
  });
}

