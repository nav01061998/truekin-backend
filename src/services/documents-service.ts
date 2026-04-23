import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession } from "./session-service.js";
import logger from "../lib/logger.js";

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
  const requestId = `doc-service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[${requestId}] getAllDocuments called with input:`, {
    userId: input.userId,
    sessionToken: input.sessionToken ? "***REDACTED***" : "MISSING",
    type: input.type,
    limit: input.limit,
    offset: input.offset,
    status: input.status,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });

  try {
    // Validate session
    console.log(`[${requestId}] Validating session...`);
    const authUser = await assertValidSession({
      userId: input.userId,
      sessionToken: input.sessionToken,
    });
    console.log(`[${requestId}] Session validated successfully for user: ${authUser?.id}`);
    logger.info("DOCUMENTS_SESSION_VALID", { requestId, userId: input.userId });

    // Defaults
    const docType = input.type || "all";
    const limit = Math.min(input.limit || 20, 100); // Max 100 items per page
    const offset = input.offset || 0;

    console.log(`[${requestId}] Effective params - docType: ${docType}, limit: ${limit}, offset: ${offset}`);

    // Validate userId
    if (!input.userId) {
      console.error(`[${requestId}] userId is missing!`);
      throw new Error("userId is required");
    }

    // Initialize results
    let prescriptions: Prescription[] = [];
    let reports: Report[] = [];
    let totalCount = 0;

    // Fetch prescriptions if requested
    if (docType === "prescriptions" || docType === "all") {
      console.log(`[${requestId}] Fetching prescriptions for user: ${input.userId}`);
      console.log(`[${requestId}] Prescription filters - status: ${input.status}, fromDate: ${input.fromDate}, toDate: ${input.toDate}`);

      let query = supabaseAdmin
        .from("medical_prescriptions")
        .select("*", { count: "exact" })
        .eq("user_id", input.userId);

      console.log(`[${requestId}] Query initialized with user_id filter`);

      // Apply status filter
      if (input.status) {
        console.log(`[${requestId}] Adding status filter: ${input.status}`);
        query = query.eq("status", input.status);
      }

      // Apply date range filters
      if (input.fromDate) {
        console.log(`[${requestId}] Adding fromDate filter: ${input.fromDate}`);
        query = query.gte("prescribed_date", input.fromDate);
      }
      if (input.toDate) {
        console.log(`[${requestId}] Adding toDate filter: ${input.toDate}`);
        query = query.lte("prescribed_date", input.toDate);
      }

      // Apply pagination
      console.log(`[${requestId}] Adding order and range - offset: ${offset}, limit: ${limit}`);
      query = query.order("prescribed_date", { ascending: false }).range(offset, offset + limit - 1);

      console.log(`[${requestId}] Executing prescriptions query...`);
      const { data: rxData, error: rxError, count } = await query;

      if (rxError) {
        console.error(`[${requestId}] Prescription query error:`, {
          code: rxError.code,
          message: rxError.message,
          details: rxError.details,
        });
        logger.error("DOCUMENTS_PRESCRIPTIONS_ERROR", {
          requestId,
          error: rxError.message,
          code: rxError.code,
        });
        throw new Error(`Failed to fetch prescriptions: ${rxError.message}`);
      }

      console.log(`[${requestId}] Prescriptions query successful - got ${(rxData || []).length} rows, total count: ${count}`);

      prescriptions = (rxData || []).map((rx: any) => {
        console.log(`[${requestId}] Mapping prescription:`, {
          id: rx.id,
          medicationName: rx.medication_name,
          userId: rx.user_id,
        });
        return {
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
        };
      });

      if (count !== null) {
        totalCount = count;
        console.log(`[${requestId}] Total count set to: ${totalCount}`);
      }
    }

    // Fetch reports if requested
    if (docType === "reports" || docType === "all") {
      console.log(`[${requestId}] Fetching reports for user: ${input.userId}`);
      console.log(`[${requestId}] Report filters - status: ${input.status}, fromDate: ${input.fromDate}, toDate: ${input.toDate}`);

      let query = supabaseAdmin
        .from("medical_reports")
        .select("*", { count: "exact" })
        .eq("user_id", input.userId);

      console.log(`[${requestId}] Report query initialized with user_id filter`);

      // Apply status filter
      if (input.status) {
        console.log(`[${requestId}] Adding status filter to reports: ${input.status}`);
        query = query.eq("status", input.status);
      }

      // Apply date range filters
      if (input.fromDate) {
        console.log(`[${requestId}] Adding fromDate filter to reports: ${input.fromDate}`);
        query = query.gte("test_date", input.fromDate);
      }
      if (input.toDate) {
        console.log(`[${requestId}] Adding toDate filter to reports: ${input.toDate}`);
        query = query.lte("test_date", input.toDate);
      }

      // Apply pagination
      console.log(`[${requestId}] Adding order and range to reports - offset: ${offset}, limit: ${limit}`);
      query = query.order("test_date", { ascending: false }).range(offset, offset + limit - 1);

      console.log(`[${requestId}] Executing reports query...`);
      const { data: reportData, error: reportError, count } = await query;

      if (reportError) {
        console.error(`[${requestId}] Report query error:`, {
          code: reportError.code,
          message: reportError.message,
          details: reportError.details,
        });
        logger.error("DOCUMENTS_REPORTS_ERROR", {
          requestId,
          error: reportError.message,
          code: reportError.code,
        });
        throw new Error(`Failed to fetch reports: ${reportError.message}`);
      }

      console.log(`[${requestId}] Reports query successful - got ${(reportData || []).length} rows, total count: ${count}`);

      reports = (reportData || []).map((report: any) => {
        console.log(`[${requestId}] Mapping report:`, {
          id: report.id,
          reportTitle: report.report_title,
          userId: report.user_id,
        });
        return {
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
        };
      });

      if (count !== null) {
        totalCount = count;
        console.log(`[${requestId}] Total count for reports set to: ${totalCount}`);
      }
    }

    // Calculate pagination info
    const page = Math.floor(offset / limit) + 1;
    const hasMore = offset + limit < totalCount;

    console.log(`[${requestId}] Building response - page: ${page}, hasMore: ${hasMore}, prescriptions: ${prescriptions.length}, reports: ${reports.length}`);

    // Return response with empty states for each segment
    const response = {
      pageTitle: "Medical Documents",
      backLabel: "Documents",
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

    console.log(`[${requestId}] Response built successfully`);
    logger.info("DOCUMENTS_FETCH_SUCCESS", {
      requestId,
      userId: input.userId,
      prescriptionsCount: prescriptions.length,
      reportsCount: reports.length,
      total: totalCount,
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "No stack";

    console.error(`[${requestId}] FATAL ERROR in getAllDocuments:`, {
      name: error instanceof Error ? error.constructor.name : "Unknown",
      message: errorMessage,
      stack: errorStack,
      fullError: error,
    });

    logger.error("DOCUMENTS_FATAL_ERROR", {
      requestId,
      userId: input.userId,
      errorName: error instanceof Error ? error.constructor.name : "Unknown",
      errorMessage: errorMessage,
      errorStack: errorStack,
    });

    throw error;
  }
}
