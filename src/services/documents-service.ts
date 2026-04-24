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
  pagination: PaginationInfo;
  emptyState: EmptyState;
};

export type DocumentsResponse = {
  pageTitle: string;
  backLabel: string;
  prescriptions: DocumentSegment;
  reports: DocumentSegment;
};

/**
 * Get all documents (prescriptions and reports) for a user with separate pagination for each section
 */
export async function getAllDocuments(
  input: {
    userId: string;
    sessionToken: string;
    prescriptionsPage?: number;
    prescriptionsLimit?: number;
    prescriptionsStatus?: string;
    prescriptionsFromDate?: string;
    prescriptionsToDate?: string;
    reportsPage?: number;
    reportsLimit?: number;
    reportsStatus?: string;
    reportsFromDate?: string;
    reportsToDate?: string;
  }
): Promise<DocumentsResponse> {
  const requestId = `doc-service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[${requestId}] getAllDocuments called with input:`, {
    userId: input.userId,
    sessionToken: input.sessionToken ? "***REDACTED***" : "MISSING",
    prescriptionsPage: input.prescriptionsPage,
    prescriptionsLimit: input.prescriptionsLimit,
    prescriptionsStatus: input.prescriptionsStatus,
    reportsPage: input.reportsPage,
    reportsLimit: input.reportsLimit,
    reportsStatus: input.reportsStatus,
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

    // Validate userId
    if (!input.userId) {
      console.error(`[${requestId}] userId is missing!`);
      throw new Error("userId is required");
    }

    // Parse and validate pagination parameters for prescriptions
    const prescriptionsPage = Math.max(1, input.prescriptionsPage || 1);
    const prescriptionsLimit = Math.min(Math.max(1, input.prescriptionsLimit || 10), 100);
    const prescriptionsOffset = (prescriptionsPage - 1) * prescriptionsLimit;

    // Parse and validate pagination parameters for reports
    const reportsPage = Math.max(1, input.reportsPage || 1);
    const reportsLimit = Math.min(Math.max(1, input.reportsLimit || 10), 100);
    const reportsOffset = (reportsPage - 1) * reportsLimit;

    console.log(`[${requestId}] Effective pagination:`, {
      prescriptions: { page: prescriptionsPage, limit: prescriptionsLimit, offset: prescriptionsOffset },
      reports: { page: reportsPage, limit: reportsLimit, offset: reportsOffset },
    });

    // Initialize results
    let prescriptions: Prescription[] = [];
    let prescriptionsTotal = 0;
    let reports: Report[] = [];
    let reportsTotal = 0;

    // Fetch prescriptions
    console.log(`[${requestId}] Fetching prescriptions for user: ${input.userId}`);
    console.log(`[${requestId}] Prescription filters - status: ${input.prescriptionsStatus}, fromDate: ${input.prescriptionsFromDate}, toDate: ${input.prescriptionsToDate}`);

    let prescriptionsQuery = supabaseAdmin
      .from("medical_prescriptions")
      .select("*", { count: "exact" })
      .eq("user_id", input.userId);

    console.log(`[${requestId}] Prescriptions query initialized with user_id filter`);

    // Apply status filter
    if (input.prescriptionsStatus) {
      console.log(`[${requestId}] Adding status filter to prescriptions: ${input.prescriptionsStatus}`);
      prescriptionsQuery = prescriptionsQuery.eq("status", input.prescriptionsStatus);
    }

    // Apply date range filters
    if (input.prescriptionsFromDate) {
      console.log(`[${requestId}] Adding fromDate filter to prescriptions: ${input.prescriptionsFromDate}`);
      prescriptionsQuery = prescriptionsQuery.gte("prescribed_date", input.prescriptionsFromDate);
    }
    if (input.prescriptionsToDate) {
      console.log(`[${requestId}] Adding toDate filter to prescriptions: ${input.prescriptionsToDate}`);
      prescriptionsQuery = prescriptionsQuery.lte("prescribed_date", input.prescriptionsToDate);
    }

    // Apply pagination
    console.log(`[${requestId}] Adding order and range to prescriptions - offset: ${prescriptionsOffset}, limit: ${prescriptionsLimit}`);
    prescriptionsQuery = prescriptionsQuery.order("prescribed_date", { ascending: false }).range(prescriptionsOffset, prescriptionsOffset + prescriptionsLimit - 1);

    console.log(`[${requestId}] Executing prescriptions query...`);
    const { data: rxData, error: rxError, count: rxCount } = await prescriptionsQuery;

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

    console.log(`[${requestId}] Prescriptions query successful - got ${(rxData || []).length} rows, total count: ${rxCount}`);

    prescriptions = (rxData || []).map((rx: any) => {
      console.log(`[${requestId}] Mapping prescription:`, {
        id: rx.id,
        medicationName: rx.medication_name,
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

    if (rxCount !== null) {
      prescriptionsTotal = rxCount;
      console.log(`[${requestId}] Prescriptions total count set to: ${prescriptionsTotal}`);
    }

    // Fetch reports
    console.log(`[${requestId}] Fetching reports for user: ${input.userId}`);
    console.log(`[${requestId}] Report filters - status: ${input.reportsStatus}, fromDate: ${input.reportsFromDate}, toDate: ${input.reportsToDate}`);

    let reportsQuery = supabaseAdmin
      .from("medical_reports")
      .select("*", { count: "exact" })
      .eq("user_id", input.userId);

    console.log(`[${requestId}] Reports query initialized with user_id filter`);

    // Apply status filter
    if (input.reportsStatus) {
      console.log(`[${requestId}] Adding status filter to reports: ${input.reportsStatus}`);
      reportsQuery = reportsQuery.eq("status", input.reportsStatus);
    }

    // Apply date range filters
    if (input.reportsFromDate) {
      console.log(`[${requestId}] Adding fromDate filter to reports: ${input.reportsFromDate}`);
      reportsQuery = reportsQuery.gte("test_date", input.reportsFromDate);
    }
    if (input.reportsToDate) {
      console.log(`[${requestId}] Adding toDate filter to reports: ${input.reportsToDate}`);
      reportsQuery = reportsQuery.lte("test_date", input.reportsToDate);
    }

    // Apply pagination
    console.log(`[${requestId}] Adding order and range to reports - offset: ${reportsOffset}, limit: ${reportsLimit}`);
    reportsQuery = reportsQuery.order("test_date", { ascending: false }).range(reportsOffset, reportsOffset + reportsLimit - 1);

    console.log(`[${requestId}] Executing reports query...`);
    const { data: reportData, error: reportError, count: reportCount } = await reportsQuery;

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

    console.log(`[${requestId}] Reports query successful - got ${(reportData || []).length} rows, total count: ${reportCount}`);

    reports = (reportData || []).map((report: any) => {
      console.log(`[${requestId}] Mapping report:`, {
        id: report.id,
        reportTitle: report.report_title,
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

    if (reportCount !== null) {
      reportsTotal = reportCount;
      console.log(`[${requestId}] Reports total count set to: ${reportsTotal}`);
    }

    // Calculate pagination info for prescriptions
    const prescriptionsHasMore = prescriptionsOffset + prescriptionsLimit < prescriptionsTotal;

    // Calculate pagination info for reports
    const reportsHasMore = reportsOffset + reportsLimit < reportsTotal;

    console.log(`[${requestId}] Building response:`, {
      prescriptions: { page: prescriptionsPage, hasMore: prescriptionsHasMore, count: prescriptions.length, total: prescriptionsTotal },
      reports: { page: reportsPage, hasMore: reportsHasMore, count: reports.length, total: reportsTotal },
    });

    // Return response with separate pagination for each section
    const response = {
      pageTitle: "Medical Documents",
      backLabel: "Documents",
      prescriptions: {
        documents: prescriptions,
        pagination: {
          page: prescriptionsPage,
          limit: prescriptionsLimit,
          total: prescriptionsTotal,
          offset: prescriptionsOffset,
          hasMore: prescriptionsHasMore,
        },
        emptyState: {
          title: "No Prescriptions",
          description: "You don't have any prescriptions yet. Add a prescription when needed.",
          imageUrl: null,
        },
      },
      reports: {
        documents: reports,
        pagination: {
          page: reportsPage,
          limit: reportsLimit,
          total: reportsTotal,
          offset: reportsOffset,
          hasMore: reportsHasMore,
        },
        emptyState: {
          title: "No Medical Reports",
          description: "Your medical reports will appear here. Upload or add reports to view them.",
          imageUrl: null,
        },
      },
    };

    console.log(`[${requestId}] Response built successfully`);
    logger.info("DOCUMENTS_FETCH_SUCCESS", {
      requestId,
      userId: input.userId,
      prescriptionsCount: prescriptions.length,
      prescriptionsTotal: prescriptionsTotal,
      reportsCount: reports.length,
      reportsTotal: reportsTotal,
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
