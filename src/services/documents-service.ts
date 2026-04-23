import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession } from "./session-service.js";

export type Prescription = {
  id: string;
  type: "prescription";
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  prescribedBy: string;
  prescribedDate: string;
  validUntil: string | null;
  pharmacy: string | null;
  sideEffects: string[];
  refillsRemaining: number;
  status: "active" | "expired" | "filled" | "pending";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Report = {
  id: string;
  type: "report";
  reportType: string;
  reportTitle: string;
  reportCategory: string;
  testDate: string;
  reportDate: string;
  facility: string;
  performedBy: string;
  referredBy: string | null;
  normalValues: Record<string, string> | null;
  reportValues: Record<string, { value: string; status: "normal" | "abnormal" | "critical" }> | null;
  summary: string | null;
  recommendations: string[];
  attachmentUrl: string | null;
  status: "completed" | "pending" | "reviewed";
  createdAt: string;
  updatedAt: string;
};

export type EmptyState = {
  title: string;
  description: string;
  imageUrl: string | null;
};

export type PaginationInfo = {
  total: number;
  page: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type DocumentSegment = {
  documents: Prescription[] | Report[];
  emptyState: EmptyState;
};

export type DocumentsResponse = {
  pageTitle: string;
  backLabel: string;
  prescriptions: DocumentSegment;
  reports: DocumentSegment;
  pagination: PaginationInfo;
};

/**
 * Get all documents (prescriptions and reports) for a user with filtering and pagination
 */
export async function getAllDocuments(
  input: {
    userId: string;
    sessionToken: string;
    type?: "prescriptions" | "reports" | "all";
    limit?: number;
    offset?: number;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }
): Promise<DocumentsResponse> {
  // Validate session
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  // Defaults
  const docType = input.type || "all";
  const limit = Math.min(input.limit || 20, 100); // Max 100 items per page
  const offset = input.offset || 0;

  // Validate userId
  if (!input.userId) {
    throw new Error("userId is required");
  }

  // Initialize results
  let prescriptions: Prescription[] = [];
  let reports: Report[] = [];
  let totalCount = 0;

  try {
    // Fetch prescriptions if requested
    if (docType === "prescriptions" || docType === "all") {
      let query = supabaseAdmin
        .from("medical_prescriptions")
        .select("*", { count: "exact" })
        .eq("user_id", input.userId);

      // Apply status filter
      if (input.status) {
        query = query.eq("status", input.status);
      }

      // Apply date range filters
      if (input.fromDate) {
        query = query.gte("prescribed_date", input.fromDate);
      }
      if (input.toDate) {
        query = query.lte("prescribed_date", input.toDate);
      }

      // Apply pagination
      query = query.order("prescribed_date", { ascending: false }).range(offset, offset + limit - 1);

      const { data: rxData, error: rxError, count } = await query;

      if (rxError) {
        console.error("Error fetching prescriptions:", rxError);
        throw new Error(`Failed to fetch prescriptions: ${rxError.message}`);
      }

      prescriptions = (rxData || []).map((rx: any) => ({
        id: rx.id,
        type: "prescription" as const,
        medicationName: rx.medication_name,
        dosage: rx.dosage,
        frequency: rx.frequency,
        duration: rx.duration,
        prescribedBy: rx.prescribed_by,
        prescribedDate: rx.prescribed_date,
        validUntil: rx.valid_until,
        pharmacy: rx.pharmacy,
        sideEffects: rx.side_effects || [],
        refillsRemaining: rx.refills_remaining || 0,
        status: rx.status,
        notes: rx.notes,
        createdAt: rx.created_at,
        updatedAt: rx.updated_at,
      }));

      if (count !== null) {
        totalCount = count;
      }
    }

    // Fetch reports if requested
    if (docType === "reports" || docType === "all") {
      let query = supabaseAdmin
        .from("medical_reports")
        .select("*", { count: "exact" })
        .eq("user_id", input.userId);

      // Apply status filter
      if (input.status) {
        query = query.eq("status", input.status);
      }

      // Apply date range filters
      if (input.fromDate) {
        query = query.gte("test_date", input.fromDate);
      }
      if (input.toDate) {
        query = query.lte("test_date", input.toDate);
      }

      // Apply pagination
      query = query.order("test_date", { ascending: false }).range(offset, offset + limit - 1);

      const { data: reportData, error: reportError, count } = await query;

      if (reportError) {
        console.error("Error fetching reports:", reportError);
        throw new Error(`Failed to fetch reports: ${reportError.message}`);
      }

      reports = (reportData || []).map((report: any) => ({
        id: report.id,
        type: "report" as const,
        reportType: report.report_type,
        reportTitle: report.report_title,
        reportCategory: report.report_category,
        testDate: report.test_date,
        reportDate: report.report_date,
        facility: report.facility,
        performedBy: report.performed_by,
        referredBy: report.referred_by,
        normalValues: report.normal_values,
        reportValues: report.report_values,
        summary: report.summary,
        recommendations: report.recommendations || [],
        attachmentUrl: report.attachment_url,
        status: report.status,
        createdAt: report.created_at,
        updatedAt: report.updated_at,
      }));

      if (count !== null) {
        totalCount = count;
      }
    }

    // Calculate pagination info
    const page = Math.floor(offset / limit) + 1;
    const hasMore = offset + limit < totalCount;

    // Return response with empty states for each segment
    return {
      pageTitle: "My Documents",
      backLabel: "Account",
      prescriptions: {
        documents: prescriptions,
        emptyState: {
          title: "No Prescriptions",
          description: "You don't have any prescriptions yet. Add a prescription when needed.",
          imageUrl: null,
        },
      },
      reports: {
        documents: reports,
        emptyState: {
          title: "No Medical Reports",
          description: "Your medical reports will appear here. Upload or add reports to view them.",
          imageUrl: null,
        },
      },
      pagination: {
        total: totalCount,
        page,
        limit,
        offset,
        hasMore,
      },
    };
  } catch (error) {
    throw error;
  }
}
