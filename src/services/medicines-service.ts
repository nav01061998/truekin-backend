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

export type MedicineSegment = {
  medicines: Medicine[];
  emptyState: {
    title: string;
    description: string;
    imageUrl: string | null;
  };
};

export type MedicineSection = {
  date: string;
  medicines: Medicine[];
};

export type MedicinesPastSegment = {
  sections: MedicineSection[];
  emptyState: {
    title: string;
    description: string;
    imageUrl: string | null;
  };
};

export type MedicinesListResponse = {
  pageTitle: string;
  backLabel: string;
  dailyWeekly: MedicineSegment;
  currentlyTaking: MedicineSegment;
  pastMedicines: MedicinesPastSegment;
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

  // Fetch updated medicines list
  const medicinesList = await getMedicinesList(input.userId);

  return {
    medicine,
    medicinesList,
  };
}

/**
 * Get complete medicines list with segmentation
 */
export async function getMedicinesList(userId: string): Promise<MedicinesListResponse> {
  // Fetch all medicines for user
  const { data: allMedicines, error } = await supabaseAdmin
    .from("medicines")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching medicines:", error);
    throw new Error(`Failed to fetch medicines: ${error.message}`);
  }

  const medicines = (allMedicines || []).map((m) => ({
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

  // Segment medicines
  const dailyWeeklyMedicines = medicines.filter(
    (m) => m.status === "active" && m.frequency && isDailyOrWeekly(m.frequency)
  );

  const currentlyTakingMedicines = medicines.filter(
    (m) => m.status === "active" && m.frequency && !isDailyOrWeekly(m.frequency)
  );

  const pastMedicinesList = medicines.filter(
    (m) => m.status === "inactive" || m.status === "discontinued"
  );

  // Group past medicines by date
  const pastMedicinesSections = groupMedicinesByDate(pastMedicinesList);

  return {
    pageTitle: "My Medicines",
    backLabel: "Account",
    dailyWeekly: {
      medicines: dailyWeeklyMedicines,
      emptyState: {
        title: "No Daily/Weekly Medicines",
        description: "You don't have any regularly scheduled medicines...",
        imageUrl: null,
      },
    },
    currentlyTaking: {
      medicines: currentlyTakingMedicines,
      emptyState: {
        title: "No Active Medicines",
        description: "You're not currently taking any medicines...",
        imageUrl: null,
      },
    },
    pastMedicines: {
      sections: pastMedicinesSections,
      emptyState: {
        title: "No Past Medicines",
        description: "Your medication history will be displayed here...",
        imageUrl: null,
      },
    },
  };
}

/**
 * Check if frequency indicates daily or weekly
 */
function isDailyOrWeekly(frequency: string): boolean {
  const lowerFreq = frequency.toLowerCase();
  return lowerFreq.includes("daily") || lowerFreq.includes("weekly");
}

/**
 * Group medicines by date (for past medicines)
 */
function groupMedicinesByDate(medicines: Medicine[]): MedicineSection[] {
  const groups: Map<string, Medicine[]> = new Map();

  medicines.forEach((medicine) => {
    const date = medicine.startedOn || "Unknown Date";
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(medicine);
  });

  // Convert to array and sort by date
  return Array.from(groups.entries())
    .map(([date, meds]) => ({
      date,
      medicines: meds,
    }))
    .sort((a, b) => {
      // Sort by date descending (newest first)
      // If dates are unparseable, keep them as is
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (isNaN(dateA) || isNaN(dateB)) return 0;
      return dateB - dateA;
    });
}
