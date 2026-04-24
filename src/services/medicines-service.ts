import { supabaseAdmin } from "../lib/supabase.js";
import { assertValidSession, type SessionContext } from "./session-service.js";

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
  // Validate session
  const authUser = await assertValidSession({
    userId: input.userId,
    sessionToken: input.sessionToken,
  });

  // Validate required fields
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

  // Check for duplicate medicine (same name for same user)
  const { data: existingMedicine, error: checkError } = await supabaseAdmin
    .from("medicines")
    .select("id")
    .eq("user_id", input.userId)
    .eq("name", name)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    throw checkError;
  }

  if (existingMedicine) {
    throw new Error("Medicine with this name already exists for this user");
  }

  // Prepare medicine data
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

  // Insert medicine
  const { data: newMedicine, error: insertError } = await supabaseAdmin
    .from("medicines")
    .insert(medicineData)
    .select("*")
    .single();

  if (insertError) {
    console.error("Error adding medicine:", insertError);
    throw new Error(`Failed to add medicine: ${insertError.message}`);
  }

  if (!newMedicine) {
    throw new Error("Failed to add medicine: No data returned");
  }

  // Format the medicine response
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

  // Fetch updated medicines list (page 1 with default limits)
  const medicinesList = await getMedicinesList({
    userId: input.userId,
    consumingPage: 1,
    consumingLimit: 10,
    pastPage: 1,
    pastLimit: 10,
  });

  return {
    medicine,
    medicinesList,
  };
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
    // Parse and validate pagination parameters
    const consumingPage = Math.max(1, input.consumingPage || 1);
    const consumingLimit = Math.min(Math.max(1, input.consumingLimit || 10), 100);
    const consumingOffset = (consumingPage - 1) * consumingLimit;

    const pastPage = Math.max(1, input.pastPage || 1);
    const pastLimit = Math.min(Math.max(1, input.pastLimit || 10), 100);
    const pastOffset = (pastPage - 1) * pastLimit;

    console.log(`[${requestId}] Pagination params - consuming: page=${consumingPage}, limit=${consumingLimit}, offset=${consumingOffset}`);
    console.log(`[${requestId}] Pagination params - past: page=${pastPage}, limit=${pastLimit}, offset=${pastOffset}`);

    // Fetch all active medicines for "Consuming Currently"
    console.log(`[${requestId}] Fetching active medicines for consuming section`);
    const { data: activeData, error: activeError, count: activeCount } = await supabaseAdmin
      .from("medicines")
      .select("*", { count: "exact" })
      .eq("user_id", input.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (activeError) {
      console.error(`[${requestId}] Error fetching active medicines:`, activeError);
      throw new Error(`Failed to fetch active medicines: ${activeError.message}`);
    }

    console.log(`[${requestId}] Active medicines fetched - count: ${activeCount}, rows: ${(activeData || []).length}`);

    const activeMedicines = (activeData || []).map((m) => ({
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
    }));

    // Apply pagination to consuming medicines
    const consumingMedicines = activeMedicines.slice(consumingOffset, consumingOffset + consumingLimit);
    const consumingTotal = activeCount || 0;
    const consumingHasMore = consumingOffset + consumingLimit < consumingTotal;

    console.log(`[${requestId}] Consuming medicines after pagination - count: ${consumingMedicines.length}, hasMore: ${consumingHasMore}`);

    // Fetch past medicines (inactive or discontinued)
    console.log(`[${requestId}] Fetching past medicines`);
    const { data: pastData, error: pastError } = await supabaseAdmin
      .from("medicines")
      .select("*")
      .eq("user_id", input.userId)
      .or("status.eq.inactive,status.eq.discontinued")
      .order("created_at", { ascending: false });

    if (pastError) {
      console.error(`[${requestId}] Error fetching past medicines:`, pastError);
      throw new Error(`Failed to fetch past medicines: ${pastError.message}`);
    }

    console.log(`[${requestId}] Past medicines fetched - count: ${(pastData || []).length}`);

    const pastMedicines = (pastData || []).map((m) => ({
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
    }));

    // Group past medicines by date with pagination
    console.log(`[${requestId}] Grouping past medicines by date`);
    const pastMedicinesSections = groupMedicinesByDateWithPagination(pastMedicines, pastPage, pastLimit);

    console.log(`[${requestId}] Response built successfully:`, {
      consumingCount: consumingMedicines.length,
      consumingTotal: consumingTotal,
      pastSections: pastMedicinesSections.length,
    });

    return {
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
          title: "No Daily/Weekly Medicines",
          description: "No daily or weekly medicines found.",
        },
      },
      pastMedicines: {
        sections: pastMedicinesSections,
        emptyState: {
          title: "No Past Medicines",
          description: "No past medicines in your history.",
        },
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] Fatal error in getMedicinesList:`, errorMessage);
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
