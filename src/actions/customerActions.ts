"use server";

import { getTenantSupabaseClient } from "@/actions/tenantActions";

export interface Customer {
  id: string;
  code: string;
  name: string;
  status: "active" | "inactive";
  contact?: string;
  phone?: string;
  email?: string;
  salesman_name?: string;
}

export interface CustomerSearchResult {
  customers: Customer[];
  total: number;
}

/**
 * Search customers by name or code
 */
export async function searchCustomers(searchText: string): Promise<CustomerSearchResult> {
  try {
    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      console.error("[Customer] No tenant database connection");
      return { customers: [], total: 0 };
    }

    // If search text is empty, return empty results
    if (!searchText || searchText.trim().length === 0) {
      return { customers: [], total: 0 };
    }

    const searchTerm = searchText.trim();

    // Search in customers table using correct column names
    const { data, error } = await supabase
      .from("customers")
      .select("id, code, name, inactive, contact, phone, email, salesman_name")
      .or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
      .order("name", { ascending: true })
      .limit(50);

    if (error) {
      console.error("[Customer] Search error:", error);
      return { customers: [], total: 0 };
    }

    const customers: Customer[] = (data || []).map((row) => ({
      id: String(row.id),
      code: row.code || "",
      name: row.name || "",
      status: row.inactive ? "inactive" : "active",
      contact: row.contact || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      salesman_name: row.salesman_name || undefined,
    }));

    return { customers, total: customers.length };
  } catch (error) {
    console.error("[Customer] Search error:", error);
    return { customers: [], total: 0 };
  }
}

/**
 * Get customer by ID
 */
export async function getCustomerById(customerId: string): Promise<Customer | null> {
  try {
    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      console.error("[Customer] No tenant database connection");
      return null;
    }

    const { data, error } = await supabase
      .from("customers")
      .select("id, code, name, inactive, contact, phone, email, salesman_name")
      .eq("id", customerId)
      .single();

    if (error || !data) {
      console.error("[Customer] Get by ID error:", error);
      return null;
    }

    return {
      id: String(data.id),
      code: data.code || "",
      name: data.name || "",
      status: data.inactive ? "inactive" : "active",
      contact: data.contact || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      salesman_name: data.salesman_name || undefined,
    };
  } catch (error) {
    console.error("[Customer] Get by ID error:", error);
    return null;
  }
}
