import { supabaseAdmin } from "../lib/supabase.js";

export async function createSupportTicket(input: {
  userId?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  message: string;
  source?: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      user_id: input.userId ?? null,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      message: input.message,
      metadata: {
        source: input.source ?? "mobile_app",
      },
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}
