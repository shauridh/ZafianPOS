import { getSupabaseBrowserClient, outletId } from "./supabase";

export type StoredBusinessProfile = {
  name: string;
  tagline: string;
  primaryColor: string;
  sidebarColor: string;
  outlet: string;
};

export type InventoryDraft = {
  name: string;
  sku?: string;
  kind: "raw_material" | "production_output" | "sales_supply" | "direct_sale";
  supplierName?: string;
  purchasePrice?: number;
  purchaseUnit: string;
  usageUnit: string;
  unitsPerPurchase: number;
  stockQuantity: number;
  minimumStock: number;
  shelfLifeDays?: number;
  storageLocation?: string;
  stockAlertEnabled: boolean;
  allowNegativeStock: boolean;
};

const BUSINESS_KEY = "pos-sabana:business";
const INVENTORY_KEY = "pos-sabana:inventory";
const CATEGORY_KEY = "pos-sabana:categories";
const PRODUCT_KEY = "pos-sabana:products";
const SHIFT_KEY = "pos-sabana:shift";
const SALES_KEY = "pos-sabana:sales";

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  if (typeof window !== "undefined")
    window.localStorage.setItem(key, JSON.stringify(value));
}

export async function loadBusinessProfile(fallback: StoredBusinessProfile) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return readLocal(BUSINESS_KEY, fallback);
  const { data, error } = await supabase
    .from("business_settings")
    .select("business_name,tagline,primary_color,sidebar_color,outlets(name)")
    .eq("outlet_id", outletId)
    .maybeSingle();
  if (error || !data) return readLocal(BUSINESS_KEY, fallback);
  const outlet = Array.isArray(data.outlets)
    ? data.outlets[0]?.name
    : (data.outlets as { name?: string } | null)?.name;
  return {
    name: data.business_name,
    tagline: data.tagline ?? "",
    primaryColor: data.primary_color,
    sidebarColor: data.sidebar_color,
    outlet: outlet ?? fallback.outlet,
  };
}

export async function saveBusinessProfile(profile: StoredBusinessProfile) {
  writeLocal(BUSINESS_KEY, profile);
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { mode: "local" as const };
  const { error } = await supabase.from("business_settings").upsert({
    outlet_id: outletId,
    business_name: profile.name,
    tagline: profile.tagline,
    primary_color: profile.primaryColor,
    sidebar_color: profile.sidebarColor,
  });
  if (error) return { mode: "local" as const };
  await supabase
    .from("outlets")
    .update({ name: profile.outlet })
    .eq("id", outletId);
  return { mode: "supabase" as const };
}

export async function listInventory() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase)
    return readLocal<(InventoryDraft & { id: string })[]>(INVENTORY_KEY, []);
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("outlet_id", outletId)
    .eq("is_active", true)
    .order("name")
    .limit(250);
  if (error) throw error;
  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku ?? undefined,
    kind: item.kind,
    supplierName: item.supplier_name ?? undefined,
    purchasePrice: item.purchase_price ?? undefined,
    purchaseUnit: item.purchase_unit,
    usageUnit: item.usage_unit,
    unitsPerPurchase: Number(item.units_per_purchase),
    stockQuantity: Number(item.stock_quantity),
    minimumStock: Number(item.minimum_stock),
    shelfLifeDays: item.shelf_life_days ?? undefined,
    storageLocation: item.storage_location ?? undefined,
    stockAlertEnabled: item.stock_alert_enabled,
    allowNegativeStock: item.allow_negative_stock,
  }));
}

export async function createInventoryItem(draft: InventoryDraft) {
  const supabase = getSupabaseBrowserClient();
  const current = readLocal<(InventoryDraft & { id: string })[]>(
    INVENTORY_KEY,
    [],
  );
  const created = { ...draft, id: crypto.randomUUID() };
  writeLocal(INVENTORY_KEY, [created, ...current]);
  if (!supabase) return created;
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      outlet_id: outletId,
      name: draft.name,
      sku: draft.sku || null,
      kind: draft.kind,
      supplier_name: draft.supplierName || null,
      purchase_price: draft.purchasePrice ?? null,
      purchase_unit: draft.purchaseUnit,
      usage_unit: draft.usageUnit,
      units_per_purchase: draft.unitsPerPurchase,
      stock_quantity: draft.stockQuantity,
      minimum_stock: draft.minimumStock,
      shelf_life_days: draft.shelfLifeDays ?? null,
      storage_location: draft.storageLocation || null,
      stock_alert_enabled: draft.stockAlertEnabled,
      allow_negative_stock: draft.allowNegativeStock,
    })
    .select("id")
    .single();
  if (error) return created;
  return { ...draft, id: data.id };
}

export async function updateInventoryItem(id: string, draft: InventoryDraft) {
  const current = readLocal<(InventoryDraft & { id: string })[]>(
    INVENTORY_KEY,
    [],
  );
  writeLocal(
    INVENTORY_KEY,
    current.map((item) => (item.id === id ? { ...draft, id } : item)),
  );
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const { error } = await supabase
    .from("inventory_items")
    .update({
      name: draft.name,
      sku: draft.sku || null,
      kind: draft.kind,
      supplier_name: draft.supplierName || null,
      purchase_price: draft.purchasePrice ?? null,
      purchase_unit: draft.purchaseUnit,
      usage_unit: draft.usageUnit,
      units_per_purchase: draft.unitsPerPurchase,
      minimum_stock: draft.minimumStock,
      shelf_life_days: draft.shelfLifeDays ?? null,
      storage_location: draft.storageLocation || null,
      stock_alert_enabled: draft.stockAlertEnabled,
      allow_negative_stock: draft.allowNegativeStock,
    })
    .eq("id", id)
    .eq("outlet_id", outletId);
  if (error) throw error;
}

export async function deleteInventoryItem(id: string) {
  const current = readLocal<(InventoryDraft & { id: string })[]>(
    INVENTORY_KEY,
    [],
  );
  writeLocal(
    INVENTORY_KEY,
    current.filter((item) => item.id !== id),
  );
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const { error } = await supabase
    .from("inventory_items")
    .update({ is_active: false })
    .eq("id", id)
    .eq("outlet_id", outletId);
  if (error) throw error;
}

export async function listCategories(fallback: string[]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return readLocal(CATEGORY_KEY, fallback);
  const { data, error } = await supabase
    .from("menu_categories")
    .select("name")
    .eq("outlet_id", outletId)
    .eq("is_active", true)
    .order("sort_order")
    .limit(50);
  if (error) throw error;
  return data?.map((row) => row.name) ?? fallback;
}

export async function createCategory(name: string, current: string[]) {
  const next = [...current, name];
  writeLocal(CATEGORY_KEY, next);
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await supabase.from("menu_categories").insert({
    outlet_id: outletId,
    name,
    sort_order: current.length + 1,
  });
  if (error) return;
}

export async function renameCategory(oldName: string, newName: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("menu_categories")
    .update({ name: newName })
    .eq("outlet_id", outletId)
    .eq("name", oldName);
  if (error) throw error;
}

export async function deleteCategory(name: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("menu_categories")
    .update({ is_active: false })
    .eq("outlet_id", outletId)
    .eq("name", name);
  if (error) throw error;
}

export type ProductDraft = {
  name: string;
  description?: string;
  salePrice: number;
  categoryName?: string;
  allowsChickenCutChoice?: boolean;
  imagePath?: string;
};

export async function uploadMenuImage(file: File) {
  if (file.size > 2 * 1024 * 1024)
    throw new Error("Ukuran gambar maksimal 2 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Gunakan gambar JPG, PNG, atau WebP.");
  }
  const localUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return localUrl;
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${outletId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("item-images")
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
    });
  if (error) return localUrl;
  return supabase.storage.from("item-images").getPublicUrl(path).data.publicUrl;
}

export async function listProducts<T>(fallback: T[]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return readLocal<T[]>(PRODUCT_KEY, fallback);
  const { data, error } = await supabase
    .from("products")
    .select("id,name,description,sale_price,is_active,menu_categories(name)")
    .eq("outlet_id", outletId)
    .eq("is_active", true)
    .order("sort_order")
    .limit(100);
  if (error) throw error;
  if (!data?.length) return fallback;
  return data as unknown as T[];
}

export async function createProduct(draft: ProductDraft) {
  const stored = readLocal<Record<string, unknown>[]>(PRODUCT_KEY, []);
  writeLocal(PRODUCT_KEY, [{ ...draft, id: crypto.randomUUID() }, ...stored]);
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  let categoryId: string | null = null;
  if (draft.categoryName) {
    const { data } = await supabase
      .from("menu_categories")
      .select("id")
      .eq("outlet_id", outletId)
      .eq("name", draft.categoryName)
      .maybeSingle();
    categoryId = data?.id ?? null;
  }
  const { error } = await supabase.from("products").insert({
    outlet_id: outletId,
    category_id: categoryId,
    name: draft.name,
    description: draft.description || null,
    sale_price: draft.salePrice,
    allows_chicken_cut_choice: draft.allowsChickenCutChoice ?? false,
    image_path: draft.imagePath || null,
  });
  if (error) return;
}

export async function updateProduct(id: string, draft: ProductDraft) {
  const stored = readLocal<Record<string, unknown>[]>(PRODUCT_KEY, []);
  writeLocal(
    PRODUCT_KEY,
    stored.map((item) => (item.id === id ? { ...draft, id } : item)),
  );
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return;
  let categoryId: string | null = null;
  if (draft.categoryName) {
    const { data } = await supabase
      .from("menu_categories")
      .select("id")
      .eq("outlet_id", outletId)
      .eq("name", draft.categoryName)
      .maybeSingle();
    categoryId = data?.id ?? null;
  }
  const { error } = await supabase
    .from("products")
    .update({
      category_id: categoryId,
      name: draft.name,
      description: draft.description || null,
      sale_price: draft.salePrice,
      allows_chicken_cut_choice: draft.allowsChickenCutChoice ?? false,
      image_path: draft.imagePath || null,
    })
    .eq("id", id)
    .eq("outlet_id", outletId);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const stored = readLocal<Record<string, unknown>[]>(PRODUCT_KEY, []);
  writeLocal(
    PRODUCT_KEY,
    stored.filter((item) => item.id !== id),
  );
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const { error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", id)
    .eq("outlet_id", outletId);
  if (error) throw error;
}

export async function verifyOwnerPin(pin: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("verify_owner_pin", {
    candidate: pin,
  });
  if (error) throw error;
  return data === true;
}

export async function getOperatorSession() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signInOperator(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error("Email atau password tidak sesuai.");
  return data.session;
}

export async function sendOperatorPasswordLink(email: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo:
      typeof window === "undefined" ? undefined : window.location.origin,
  });
  if (error) throw new Error("Tautan password gagal dikirim.");
}

export async function updateOperatorPassword(password: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error("Password minimal 6 karakter.");
}

export async function signOutOperator() {
  const supabase = getSupabaseBrowserClient();
  if (supabase) await supabase.auth.signOut();
}

export async function setOwnerPin(pin: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  const { error } = await supabase.rpc("set_owner_pin", { new_pin: pin });
  if (error)
    throw new Error(
      error.message.includes("PIN_FORMAT")
        ? "PIN harus 4–6 angka."
        : "PIN gagal disimpan.",
    );
}

export type CompletedProductionBatch = {
  id?: string;
  batchNumber: string;
  totalOutput: number;
  mode: "supabase" | "local";
};

export async function completeProductionBatch(
  recipeId: string,
  multiplier: number,
  fallbackTotal: number,
): Promise<CompletedProductionBatch> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(recipeId)) {
    return {
      batchNumber: `B-${Date.now().toString().slice(-6)}`,
      totalOutput: fallbackTotal,
      mode: "local",
    };
  }
  const { data, error } = await supabase.rpc("complete_production_batch", {
    p_recipe_id: recipeId,
    p_multiplier: multiplier,
    p_operator_id: null,
  });
  if (error)
    throw new Error(
      error.message.includes("INSUFFICIENT_STOCK:")
        ? `Stok ${error.message.split("INSUFFICIENT_STOCK:")[1]} tidak cukup.`
        : "Batch gagal disimpan. Periksa login operator dan koneksi.",
    );
  const result = data as {
    id: string;
    batch_number: string;
    total_output: number;
  };
  return {
    id: result.id,
    batchNumber: result.batch_number,
    totalOutput: Number(result.total_output),
    mode: "supabase",
  };
}

async function operatorApi(path = "", init?: RequestInit) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Login operator diperlukan.");
  const response = await fetch(`/api/operators${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Operasi operator gagal.");
  return result;
}

export async function listOperators() {
  return (await operatorApi()).operators as Array<{
    id: string;
    name: string;
    initials: string;
    is_active: boolean;
  }>;
}
export async function createOperator(input: {
  email: string;
  name: string;
  initials?: string;
}) {
  return (
    await operatorApi("", { method: "POST", body: JSON.stringify(input) })
  ).operator;
}
export async function updateOperator(input: {
  id: string;
  name: string;
  initials?: string;
  isActive: boolean;
}) {
  return (
    await operatorApi("", { method: "PATCH", body: JSON.stringify(input) })
  ).operator;
}
export async function deleteOperator(id: string) {
  await operatorApi(`?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type ShiftSnapshot = {
  id: string;
  status: "open" | "closed";
  openingCash: number;
  expectedCash: number;
  openedAt: string;
};

export async function getActiveShift(): Promise<ShiftSnapshot | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return readLocal<ShiftSnapshot | null>(SHIFT_KEY, null);
  const { data, error } = await supabase
    .from("cash_shifts")
    .select("id,status,opening_cash,expected_cash,opened_at")
    .eq("outlet_id", outletId)
    .eq("status", "open")
    .maybeSingle();
  if (error) return readLocal<ShiftSnapshot | null>(SHIFT_KEY, null);
  return data
    ? {
        id: data.id,
        status: data.status,
        openingCash: Number(data.opening_cash),
        expectedCash: Number(data.expected_cash),
        openedAt: data.opened_at,
      }
    : null;
}

export async function openCashShift(openingCash = 350000) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const shift = {
      id: crypto.randomUUID(),
      status: "open" as const,
      openingCash,
      expectedCash: openingCash,
      openedAt: new Date().toISOString(),
    };
    writeLocal(SHIFT_KEY, shift);
    return shift;
  }
  const { error } = await supabase.rpc("open_cash_shift", {
    p_opening_cash: openingCash,
  });
  if (error)
    throw new Error(
      error.message.includes("OPENING_CASH_MINIMUM")
        ? "Modal awal minimal Rp350.000."
        : error.message.includes("duplicate")
          ? "Masih ada shift aktif."
          : "Shift gagal dibuka. Pastikan operator sudah login.",
    );
  return getActiveShift();
}

export async function recordCashMovement(
  direction: "in" | "out",
  amount: number,
  category: string,
  note: string,
  ownerPin?: string,
) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const shift = readLocal<ShiftSnapshot | null>(SHIFT_KEY, null);
    if (!shift) throw new Error("Buka shift terlebih dahulu.");
    const updated = {
      ...shift,
      expectedCash:
        shift.expectedCash + (direction === "in" ? amount : -amount),
    };
    writeLocal(SHIFT_KEY, updated);
    return updated;
  }
  const { error } = await supabase.rpc("record_cash_movement", {
    p_direction: direction,
    p_amount: amount,
    p_category: category,
    p_note: note || null,
    p_owner_pin: ownerPin || null,
  });
  if (error)
    throw new Error(
      error.message.includes("OWNER_PIN_REQUIRED")
        ? "PIN owner diperlukan atau tidak sesuai."
        : error.message.includes("SHIFT_REQUIRED")
          ? "Buka shift terlebih dahulu."
          : "Transaksi kas gagal disimpan.",
    );
  return getActiveShift();
}

export async function closeCashShift(closingCash: number, ownerPin?: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const shift = readLocal<ShiftSnapshot | null>(SHIFT_KEY, null);
    if (!shift) throw new Error("Tidak ada shift aktif.");
    const result = {
      expectedCash: shift.expectedCash,
      closingCash,
      difference: closingCash - shift.expectedCash,
    };
    writeLocal(SHIFT_KEY, null);
    return result;
  }
  const { data, error } = await supabase.rpc("close_cash_shift", {
    p_closing_cash: closingCash,
    p_owner_pin: ownerPin || null,
  });
  if (error)
    throw new Error(
      error.message.includes("OWNER_PIN_REQUIRED")
        ? "Selisih memerlukan PIN owner."
        : error.message.includes("SHIFT_REQUIRED")
          ? "Tidak ada shift aktif."
          : "Shift gagal ditutup.",
    );
  const row = data as {
    expected_cash: number;
    closing_cash: number;
    difference: number;
  };
  return {
    expectedCash: Number(row.expected_cash),
    closingCash: Number(row.closing_cash),
    difference: Number(row.difference),
  };
}

export type SaleDraft = {
  channel: "takeaway" | "dine_in" | "online_food";
  onlineProvider?: string;
  customerName?: string;
  paymentMethod: "cash" | "qris" | "gofood" | "grabfood" | "shopeefood";
  discount: number;
  cashReceived?: number;
  items: Array<{
    productId?: string;
    name: string;
    chickenCut?: string;
    quantity: number;
    unitPrice: number;
  }>;
};

export async function completeSale(draft: SaleDraft) {
  const total =
    draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) -
    draft.discount;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const sales = readLocal<Record<string, unknown>[]>(SALES_KEY, []);
    const result = {
      id: crypto.randomUUID(),
      receiptNumber: `A-${Date.now().toString().slice(-6)}`,
      total,
      change:
        draft.paymentMethod === "cash" ? (draft.cashReceived ?? 0) - total : 0,
    };
    writeLocal(SALES_KEY, [
      { ...draft, ...result, createdAt: new Date().toISOString() },
      ...sales,
    ]);
    return result;
  }
  const { data, error } = await supabase.rpc("complete_sale", {
    p_channel: draft.channel,
    p_online_provider: draft.onlineProvider || null,
    p_customer_name: draft.customerName || null,
    p_payment_method: draft.paymentMethod,
    p_discount: draft.discount,
    p_cash_received: draft.cashReceived ?? null,
    p_items: draft.items.map((item) => ({
      product_id: item.productId || "",
      name: item.name,
      chicken_cut: item.chickenCut || "",
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
  });
  if (error)
    throw new Error(
      error.message.includes("SHIFT_REQUIRED")
        ? "Buka shift kasir terlebih dahulu."
        : error.message.includes("INSUFFICIENT_STOCK:")
          ? `Stok ${error.message.split("INSUFFICIENT_STOCK:")[1]} tidak cukup.`
          : "Transaksi gagal disimpan.",
    );
  const row = data as {
    id: string;
    receipt_number: string;
    total: number;
    change: number;
  };
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    total: Number(row.total),
    change: Number(row.change),
  };
}
