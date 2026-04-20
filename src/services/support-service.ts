import { supabaseAdmin } from "../lib/supabase.js";

export interface CreateTicketInput {
  userId: string;
  sessionToken: string;
  issueType: string;
  subject: string;
  message: string;
}

export interface SupportTicket {
  id: string;
  ticket_id: string;
  user_id: string;
  issue_type: string;
  subject: string;
  message: string;
  status: "open" | "in-progress" | "resolved";
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

/**
 * Generate human-readable ticket ID
 */
function generateTicketId(): string {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `TKT-${dateStr}-${random}`;
}

/**
 * Validate session token
 */
async function validateSession(
  userId: string,
  sessionToken: string
): Promise<boolean> {
  const { data: session, error } = await supabaseAdmin
    .from("auth_sessions")
    .select("user_id")
    .eq("user_id", userId)
    .eq("token", sessionToken)
    .single();

  return !error && session !== null;
}

/**
 * Submit a support ticket
 */
export async function submitSupportTicket(
  input: CreateTicketInput
): Promise<{ success: boolean; message: string; ticket_id?: string }> {
  const { userId, sessionToken, issueType, subject, message } = input;

  // Validate session
  const isValidSession = await validateSession(userId, sessionToken);
  if (!isValidSession) {
    throw new Error("Invalid session token");
  }

  // Validate input
  if (!issueType || issueType.trim().length === 0) {
    throw new Error("Issue type is required");
  }

  if (!subject || subject.trim().length === 0) {
    throw new Error("Subject is required");
  }

  if (!message || message.trim().length === 0) {
    throw new Error("Message is required");
  }

  if (subject.length > 255) {
    throw new Error("Subject must be 255 characters or less");
  }

  if (message.length > 5000) {
    throw new Error("Message must be 5000 characters or less");
  }

  // Generate ticket ID
  const ticketId = generateTicketId();

  // Insert ticket
  const { data: ticket, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      ticket_id: ticketId,
      user_id: userId,
      issue_type: issueType,
      subject: subject,
      message: message,
      status: "open",
    })
    .select()
    .single();

  if (error || !ticket) {
    console.error("Error creating support ticket:", error);
    throw new Error("Failed to create support ticket");
  }

  return {
    success: true,
    message: "Ticket submitted successfully",
    ticket_id: ticketId,
  };
}

/**
 * Get user's tickets
 */
export async function getUserTickets(
  userId: string,
  sessionToken: string,
  limit: number = 50
): Promise<SupportTicket[]> {
  const isValidSession = await validateSession(userId, sessionToken);
  if (!isValidSession) {
    throw new Error("Invalid session token");
  }

  const { data: tickets, error } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching user tickets:", error);
    throw new Error("Failed to fetch tickets");
  }

  return tickets || [];
}

/**
 * Get ticket details
 */
export async function getTicketDetails(
  userId: string,
  sessionToken: string,
  ticketId: string
): Promise<SupportTicket> {
  const isValidSession = await validateSession(userId, sessionToken);
  if (!isValidSession) {
    throw new Error("Invalid session token");
  }

  const { data: ticket, error } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .eq("ticket_id", ticketId)
    .eq("user_id", userId)
    .single();

  if (error || !ticket) {
    throw new Error("Ticket not found");
  }

  return ticket;
}
