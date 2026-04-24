import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession, type SessionContext } from "./session-service.js";
import logger from "../lib/logger.js";

export type Medicine = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  indication: string;
  components: string | null;
  prescribedBy: string | null;
  startedOn: string | null;
  status: "active" | "inactive" | "discontinued";
  createdAt?: string;
  updatedAt?: string;
};

export type PaginationInfo = {
  total: number;
  page: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type ConsumingCurrentlySegment = {
  medicines: Medicine[];
  pagination: PaginationInfo;
  emptyState: {
    title: string;
    description: string;
  };
};

export type PastMedicineSection = {
  dateRange: string;
  medicines: Medicine[];
  pagination: PaginationInfo;
};

export type PastMedicinesSegment = {
  sections: PastMedicineSection[];
  emptyState: {
    title: string;
    description: string;
  };
};

export type MedicinesListResponse = {
  pageTitle: string;
  backLabel: string;
  consumingCurrently: ConsumingCurrentlySegment;
  pastMedicines: PastMedicinesSegment;
};

/**
 * Add a new medicine for the user
 */
export async function addMedicine(input: {
  userId: string;
  sessionToken: string;
  name: string;
  dosage: string;
  frequency: string;
  indication: string;
  components?: string;
  prescribedBy?: string;
  startedOn?: string;
  status: "active" | "inactive" | "discontinued";
}): Promise<{ medicine: Medicine; medicinesList: MedicinesListResponse }> {
  const requestId = `add-med-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[${requestId}] addMedicine called with input:`, {
    userId: input.userId,
    sessionToken: input.sessionToken ? "***REDACTED***" : "MISSING",
    name: input.name,
    dosage: input.dosage,
    frequency: input.frequency,
    indication: input.indication,
    status: input.status,
  });

  try {
    // Step 1: Validate session
    console.log(`[${requestId}] Step 1: Validating session...`);
    const authUser = await assertValidSession({
      userId: input.userId,
      sessionToken: input.sessionToken,
    });
    console.log(`[${requestId}] Step 1: Session validated successfully for user: ${authUser?.id}`);
    logger.info("MEDICINES_ADD_SESSION_VALID", { requestId, userId: input.userId });

    // Step 2: Validate required fields
    console.log(`[${requestId}] Step 2: Validating required fields`);
    const name = input.name?.trim();
    const dosage = input.dosage?.trim();
    const frequency = input.frequency?.trim();
    const indication = input.indication?.trim();
    const status = input.status?.trim();

    if (!name) throw new Error("Medicine name is required");
    if (!dosage) throw new Error("Dosage is required");
    if (!frequency) throw new Error("Frequency is required");
    if (!indication) throw new Error("Indication is required");
    if (!status) throw new Error("Status is required");

    // Validate field lengths
    if (name.length > 100) throw new Error("Medicine name must be under 100 characters");
    if (dosage.length > 50) throw new Error("Dosage must be under 50 characters");

    // Validate status
    const validStatuses = ["active", "inactive", "discontinued"];
    if (!validStatuses.includes(status)) {
      throw new Error("Invalid status value. Must be: active, inactive, or discontinued");
    }
    console.log(`[${requestId}] Step 2: Field validation successful - name: ${name}, status: ${status}`);
    logger.info("MEDICINES_ADD_FIELDS_VALID", { requestId, name, status });

    // Step 3: Check for duplicate medicine (same name for same user)
    console.log(`[${requestId}] Step 3: Checking for duplicate medicine - name: ${name}`);
    const { data: existingMedicine, error: checkError } = await supabaseAdmin
      .from("medicines")
      .select("id")
      .eq("user_id", input.userId)
      .eq("name", name)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error(`[${requestId}] Step 3: Duplicate check error:`, checkError);
      logger.error("MEDICINES_ADD_DUPLICATE_CHECK_ERROR", { requestId, error: checkError.message });
      throw checkError;
    }

    if (existingMedicine) {
      console.error(`[${requestId}] Step 3: Duplicate medicine found - id: ${existingMedicine.id}`);
      logger.warn("MEDICINES_ADD_DUPLICATE_EXISTS", { requestId, medicineId: existingMedicine.id });
      throw new Error("Medicine with this name already exists for this user");
    }
    console.log(`[${requestId}] Step 3: No duplicates found - proceeding with insertion`);

    // Step 4: Prepare medicine data
    console.log(`[${requestId}] Step 4: Preparing medicine data`);
    const medicineData = {
      user_id: input.userId,
      name,
      dosage,
      frequency,
      indication,
      components: input.components?.trim() || null,
      prescribed_by: input.prescribedBy?.trim() || null,
      started_on: input.startedOn?.trim() || null,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    console.log(`[${requestId}] Step 4: Medicine data prepared:`, {
      name: medicineData.name,
      dosage: medicineData.dosage,
      frequency: medicineData.frequency,
      indication: medicineData.indication,
      status: medicineData.status,
    });

    // Step 5: Insert medicine
    console.log(`[${requestId}] Step 5: Inserting medicine into database`);
    const { data: newMedicine, error: insertError } = await supabaseAdmin
      .from("medicines")
      .insert(medicineData)
      .select("*")
      .single();

    if (insertError) {
      console.error(`[${requestId}] Step 5: Medicine insertion error:`, insertError);
      logger.error("MEDICINES_ADD_INSERT_ERROR", { requestId, error: insertError.message, code: insertError.code });
      throw new Error(`Failed to add medicine: ${insertError.message}`);
    }

    if (!newMedicine) {
      console.error(`[${requestId}] Step 5: Medicine insertion returned no data`);
      logger.error("MEDICINES_ADD_NO_DATA_RETURNED", { requestId });
      throw new Error("Failed to add medicine: No data returned");
    }

    console.log(`[${requestId}] Step 5: Medicine inserted successfully - id: ${newMedicine.id}`);
    logger.info("MEDICINES_ADD_INSERT_SUCCESS", { requestId, medicineId: newMedicine.id });

    // Step 6: Format the medicine response
    console.log(`[${requestId}] Step 6: Formatting medicine response`);
    const medicine: Medicine = {
      id: newMedicine.id,
      name: newMedicine.name,
      dosage: newMedicine.dosage,
      frequency: newMedicine.frequency,
      indication: newMedicine.indication,
      components: newMedicine.components,
      prescribedBy: newMedicine.prescribed_by,
      startedOn: newMedicine.started_on,
      status: newMedicine.status,
      createdAt: newMedicine.created_at,
      updatedAt: newMedicine.updated_at,
    };
    console.log(`[${requestId}] Step 6: Medicine response formatted successfully`);

    // Step 7: Fetch updated medicines list (page 1 with default limits)
    console.log(`[${requestId}] Step 7: Fetching updated medicines list`);
    const medicinesList = await getMedicinesList({
      userId: input.userId,
      consumingPage: 1,
      consumingLimit: 10,
      pastPage: 1,
      pastLimit: 10,
    });
    console.log(`[${requestId}] Step 7: Updated medicines list fetched - consuming: ${medicinesList.consumingCurrently.medicines.length}, past sections: ${medicinesList.pastMedicines.sections.length}`);
    logger.info("MEDICINES_ADD_LIST_FETCHED", { requestId, consumingCount: medicinesList.consumingCurrently.medicines.length, pastSections: medicinesList.pastMedicines.sections.length });

    console.log(`[${requestId}] addMedicine completed successfully`);
    logger.info("MEDICINES_ADD_COMPLETE", { requestId, medicineId: medicine.id });

    return {
      medicine,
      medicinesList,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "No stack trace";
    console.error(`[${requestId}] FATAL ERROR in addMedicine:`, {
      name: error instanceof Error ? error.constructor.name : "Unknown",
      message: errorMessage,
      stack: errorStack,
    });
    logger.error("MEDICINES_ADD_FATAL_ERROR", {
      requestId,
      userId: input.userId,
      errorName: error instanceof Error ? error.constructor.name : "Unknown",
      errorMessage: errorMessage,
      errorStack: errorStack,
    });
    throw error;
  }
}

/**
 * Get complete medicines list with independent pagination for each section
 */
export async function getMedicinesList(input: {
  userId: string;
  consumingPage?: number;
  consumingLimit?: number;
  pastPage?: number;
  pastLimit?: number;
}): Promise<MedicinesListResponse> {
  const requestId = `med-service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[${requestId}] getMedicinesList called with input:`, {
    userId: input.userId,
    consumingPage: input.consumingPage,
    consumingLimit: input.consumingLimit,
    pastPage: input.pastPage,
    pastLimit: input.pastLimit,
  });

  try {
    // Step 1: Parse and validate pagination parameters
    console.log(`[${requestId}] Step 1: Parsing and validating pagination parameters`);
    const consumingPage = Math.max(1, input.consumingPage || 1);
    const consumingLimit = Math.min(Math.max(1, input.consumingLimit || 10), 100);
    const consumingOffset = (consumingPage - 1) * consumingLimit;

    const pastPage = Math.max(1, input.pastPage || 1);
    const pastLimit = Math.min(Math.max(1, input.pastLimit || 10), 100);
    const pastOffset = (pastPage - 1) * pastLimit;

    console.log(`[${requestId}] Step 1: Pagination validated - consuming: page=${consumingPage}, limit=${consumingLimit}, offset=${consumingOffset}`);
    console.log(`[${requestId}] Step 1: Pagination validated - past: page=${pastPage}, limit=${pastLimit}, offset=${pastOffset}`);
    logger.info("MEDICINES_LIST_PAGINATION_PARSED", {
      requestId,
      userId: input.userId,
      consumingPage,
      consumingLimit,
      consumingOffset,
      pastPage,
      pastLimit,
      pastOffset,
    });

    // Step 2: Fetch all active medicines for "Consuming Currently"
    console.log(`[${requestId}] Step 2: Fetching active medicines for consuming section - user: ${input.userId}`);
    const { data: activeData, error: activeError, count: activeCount } = await supabaseAdmin
      .from("medicines")
      .select("*", { count: "exact" })
      .eq("user_id", input.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (activeError) {
      console.error(`[${requestId}] Step 2: Error fetching active medicines:`, {
        code: activeError.code,
        message: activeError.message,
        details: activeError.details,
      });
      logger.error("MEDICINES_LIST_ACTIVE_FETCH_ERROR", {
        requestId,
        error: activeError.message,
        code: activeError.code,
      });
      throw new Error(`Failed to fetch active medicines: ${activeError.message}`);
    }

    console.log(`[${requestId}] Step 2: Active medicines fetched successfully - total count: ${activeCount}, rows returned: ${(activeData || []).length}`);
    logger.info("MEDICINES_LIST_ACTIVE_FETCHED", {
      requestId,
      totalCount: activeCount,
      rowsReturned: (activeData || []).length,
    });

    // Step 3: Transform active medicines data
    console.log(`[${requestId}] Step 3: Transforming active medicines data`);
    const activeMedicines = (activeData || []).map((m) => {
      console.log(`[${requestId}] Step 3: Mapping medicine - id: ${m.id}, name: ${m.name}`);
      return {
        id: m.id,
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        indication: m.indication,
        components: m.components,
        prescribedBy: m.prescribed_by,
        startedOn: m.started_on,
        status: m.status as "active" | "inactive" | "discontinued",
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      };
    });
    console.log(`[${requestId}] Step 3: Transformed ${activeMedicines.length} active medicines`);

    // Step 4: Apply pagination to consuming medicines
    console.log(`[${requestId}] Step 4: Applying pagination to consuming medicines - offset: ${consumingOffset}, limit: ${consumingLimit}`);
    const consumingMedicines = activeMedicines.slice(consumingOffset, consumingOffset + consumingLimit);
    const consumingTotal = activeCount || 0;
    const consumingHasMore = consumingOffset + consumingLimit < consumingTotal;
    console.log(`[${requestId}] Step 4: Pagination applied - returned: ${consumingMedicines.length}, total: ${consumingTotal}, hasMore: ${consumingHasMore}`);
    logger.info("MEDICINES_LIST_CONSUMING_PAGINATED", {
      requestId,
      returned: consumingMedicines.length,
      total: consumingTotal,
      hasMore: consumingHasMore,
      page: consumingPage,
    });

    // Step 5: Fetch past medicines (inactive or discontinued)
    console.log(`[${requestId}] Step 5: Fetching past medicines (inactive or discontinued) - user: ${input.userId}`);
    const { data: pastData, error: pastError } = await supabaseAdmin
      .from("medicines")
      .select("*")
      .eq("user_id", input.userId)
      .or("status.eq.inactive,status.eq.discontinued")
      .order("created_at", { ascending: false });

    if (pastError) {
      console.error(`[${requestId}] Step 5: Error fetching past medicines:`, {
        code: pastError.code,
        message: pastError.message,
        details: pastError.details,
      });
      logger.error("MEDICINES_LIST_PAST_FETCH_ERROR", {
        requestId,
        error: pastError.message,
        code: pastError.code,
      });
      throw new Error(`Failed to fetch past medicines: ${pastError.message}`);
    }

    console.log(`[${requestId}] Step 5: Past medicines fetched successfully - count: ${(pastData || []).length}`);
    logger.info("MEDICINES_LIST_PAST_FETCHED", {
      requestId,
      count: (pastData || []).length,
    });

    // Step 6: Transform past medicines data
    console.log(`[${requestId}] Step 6: Transforming past medicines data`);
    const pastMedicines = (pastData || []).map((m) => {
      console.log(`[${requestId}] Step 6: Mapping past medicine - id: ${m.id}, name: ${m.name}, status: ${m.status}`);
      return {
        id: m.id,
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        indication: m.indication,
        components: m.components,
        prescribedBy: m.prescribed_by,
        startedOn: m.started_on,
        status: m.status as "active" | "inactive" | "discontinued",
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      };
    });
    console.log(`[${requestId}] Step 6: Transformed ${pastMedicines.length} past medicines`);

    // Step 7: Group past medicines by date with pagination
    console.log(`[${requestId}] Step 7: Grouping past medicines by date - page: ${pastPage}, limit: ${pastLimit}`);
    const pastMedicinesSections = groupMedicinesByDateWithPagination(pastMedicines, pastPage, pastLimit);
    console.log(`[${requestId}] Step 7: Past medicines grouped into ${pastMedicinesSections.length} date sections`);
    pastMedicinesSections.forEach((section, index) => {
      console.log(`[${requestId}] Step 7: Section ${index + 1} - dateRange: ${section.dateRange}, count: ${section.medicines.length}, total: ${section.pagination.total}, hasMore: ${section.pagination.hasMore}`);
    });
    logger.info("MEDICINES_LIST_PAST_GROUPED", {
      requestId,
      sections: pastMedicinesSections.length,
      page: pastPage,
      limit: pastLimit,
    });

    // Step 8: Build final response
    console.log(`[${requestId}] Step 8: Building final response`);
    const response = {
      pageTitle: "Medicines",
      backLabel: "Medicines",
      consumingCurrently: {
        medicines: consumingMedicines,
        pagination: {
          total: consumingTotal,
          page: consumingPage,
          limit: consumingLimit,
          offset: consumingOffset,
          hasMore: consumingHasMore,
        },
        emptyState: {
          title: "No Medicines Being Taken",
          description: "You don't have any medicines you're currently taking",
        },
      },
      pastMedicines: {
        sections: pastMedicinesSections,
        emptyState: {
          title: "No Past Medicines",
          description: "You don't have any past medicines in your history",
        },
      },
    };

    console.log(`[${requestId}] Step 8: Response built successfully:`, {
      consumingCount: consumingMedicines.length,
      consumingTotal: consumingTotal,
      pastSections: pastMedicinesSections.length,
    });
    logger.info("MEDICINES_LIST_RESPONSE_BUILT", {
      requestId,
      userId: input.userId,
      consumingCount: consumingMedicines.length,
      consumingTotal: consumingTotal,
      pastSections: pastMedicinesSections.length,
    });

    console.log(`[${requestId}] getMedicinesList completed successfully`);
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "No stack trace";
    console.error(`[${requestId}] FATAL ERROR in getMedicinesList:`, {
      name: error instanceof Error ? error.constructor.name : "Unknown",
      message: errorMessage,
      stack: errorStack,
    });
    logger.error("MEDICINES_LIST_FATAL_ERROR", {
      requestId,
      userId: input.userId,
      errorName: error instanceof Error ? error.constructor.name : "Unknown",
      errorMessage: errorMessage,
      errorStack: errorStack,
    });
    throw error;
  }
}

/**
 * Check if frequency indicates daily or weekly
 */
function isDailyOrWeekly(frequency: string): boolean {
  const lowerFreq = frequency.toLowerCase();
  return lowerFreq.includes("daily") || lowerFreq.includes("weekly");
}

/**
 * Format date to "MMMM YYYY" format (e.g., "February 2026", "January 2026")
 */
function formatDateRange(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return as-is if unparseable
    }
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return dateString;
  }
}

/**
 * Group medicines by date with pagination for each date group
 */
function groupMedicinesByDateWithPagination(medicines: Medicine[], page: number, limit: number): PastMedicineSection[] {
  const groups: Map<string, Medicine[]> = new Map();

  medicines.forEach((medicine) => {
    const dateStr = medicine.startedOn || "Unknown Date";
    const formattedDate = formatDateRange(dateStr);

    if (!groups.has(formattedDate)) {
      groups.set(formattedDate, []);
    }
    groups.get(formattedDate)!.push(medicine);
  });

  // Convert to array and sort by date
  const sortedSections = Array.from(groups.entries())
    .map(([dateRange, meds]) => ({
      dateRange,
      medicines: meds,
      total: meds.length,
    }))
    .sort((a, b) => {
      // Sort by date descending (newest first)
      // Try to parse dates for proper sorting
      const dateA = new Date(a.dateRange).getTime();
      const dateB = new Date(b.dateRange).getTime();
      if (isNaN(dateA) || isNaN(dateB)) return 0;
      return dateB - dateA;
    });

  // Apply pagination to each date group
  return sortedSections.map((section) => {
    const offset = (page - 1) * limit;
    const paginatedMedicines = section.medicines.slice(offset, offset + limit);
    const hasMore = offset + limit < section.total;

    return {
      dateRange: section.dateRange,
      medicines: paginatedMedicines,
      pagination: {
        total: section.total,
        page,
        limit,
        offset,
        hasMore,
      },
    };
  });
}

/**
 * Group medicines by date (for past medicines) - Legacy function kept for compatibility
 */
function groupMedicinesByDate(medicines: Medicine[]): PastMedicineSection[] {
  return groupMedicinesByDateWithPagination(medicines, 1, 100);
}
