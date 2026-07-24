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
const COMPONENT_KEY = "pos-sabana:product-components";
const OPERATION_SETTINGS_KEY = "pos-sabana:operation-settings";

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

export type OperationalSettings = {
  autoPrintReceipt: boolean;
  printKitchenTicket: boolean;
  receiptWidth: 58 | 80;
  batchUsageMethod: "fifo" | "manual";
  negativeStockDefault: boolean;
  stockAlertDefault: boolean;
  phone: string;
  address: string;
  opensAt: string;
  closesAt: string;
};
export async function loadOperationalSettings(): Promise<OperationalSettings> {
  const fallback = readLocal<OperationalSettings>(OPERATION_SETTINGS_KEY, {
    autoPrintReceipt: true,
    printKitchenTicket: false,
    receiptWidth: 58,
    batchUsageMethod: "fifo",
    negativeStockDefault: false,
    stockAlertDefault: true,
    phone: "",
    address: "",
    opensAt: "08:00",
    closesAt: "21:00",
  });
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return fallback;
  const [{ data: settings }, { data: outlet }] = await Promise.all([
    supabase
      .from("business_settings")
      .select(
        "auto_print_receipt,print_kitchen_ticket,receipt_width,batch_usage_method,negative_stock_default,stock_alert_default",
      )
      .eq("outlet_id", outletId)
      .maybeSingle(),
    supabase
      .from("outlets")
      .select("phone,address,opens_at,closes_at")
      .eq("id", outletId)
      .maybeSingle(),
  ]);
  if (!settings) return fallback;
  return {
    autoPrintReceipt: settings.auto_print_receipt,
    printKitchenTicket: settings.print_kitchen_ticket,
    receiptWidth: settings.receipt_width as 58 | 80,
    batchUsageMethod: settings.batch_usage_method,
    negativeStockDefault: settings.negative_stock_default,
    stockAlertDefault: settings.stock_alert_default,
    phone: outlet?.phone ?? "",
    address: outlet?.address ?? "",
    opensAt: String(outlet?.opens_at ?? "08:00").slice(0, 5),
    closesAt: String(outlet?.closes_at ?? "21:00").slice(0, 5),
  };
}
export async function saveOperationalSettings(settings: OperationalSettings) {
  writeLocal(OPERATION_SETTINGS_KEY, settings);
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const [{ error: settingsError }, { error: outletError }] = await Promise.all([
    supabase
      .from("business_settings")
      .update({
        auto_print_receipt: settings.autoPrintReceipt,
        print_kitchen_ticket: settings.printKitchenTicket,
        receipt_width: settings.receiptWidth,
        batch_usage_method: settings.batchUsageMethod,
        negative_stock_default: settings.negativeStockDefault,
        stock_alert_default: settings.stockAlertDefault,
      })
      .eq("outlet_id", outletId),
    supabase
      .from("outlets")
      .update({
        phone: settings.phone || null,
        address: settings.address || null,
        opens_at: settings.opensAt,
        closes_at: settings.closesAt,
      })
      .eq("id", outletId),
  ]);
  if (settingsError || outletError) throw settingsError ?? outletError;
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
    .select(
      "id,name,description,sale_price,image_path,allows_chicken_cut_choice,sort_order,is_active,menu_categories(name,sort_order)",
    )
    .eq("outlet_id", outletId)
    .eq("is_active", true)
    .order("sort_order")
    .limit(100);
  if (error) throw error;
  if (!data?.length) return fallback;
  return data as unknown as T[];
}

export async function reorderCategories(names: string[]) {
  const supabase = getSupabaseBrowserClient();
  writeLocal("sabana-category-order", names);
  if (!supabase) return;
  const results = await Promise.all(
    names.map((name, index) =>
      supabase
        .from("menu_categories")
        .update({ sort_order: index })
        .eq("outlet_id", outletId)
        .eq("name", name),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function createProduct(draft: ProductDraft) {
  const localId = crypto.randomUUID();
  const stored = readLocal<Record<string, unknown>[]>(PRODUCT_KEY, []);
  writeLocal(PRODUCT_KEY, [{ ...draft, id: localId }, ...stored]);
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return localId;
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
  const { data, error } = await supabase
    .from("products")
    .insert({
      outlet_id: outletId,
      category_id: categoryId,
      name: draft.name,
      description: draft.description || null,
      sale_price: draft.salePrice,
      allows_chicken_cut_choice: draft.allowsChickenCutChoice ?? false,
      image_path: draft.imagePath || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
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

export type ProductComponentDraft = {
  inventoryItemId: string;
  inventoryName: string;
  quantity: number;
  isCutChoice: boolean;
  cutCode?: "Dada" | "Sayap" | "Paha atas" | "Paha bawah";
};

export async function listProductComponents(productId: string) {
  const local = readLocal<Record<string, ProductComponentDraft[]>>(
    COMPONENT_KEY,
    {},
  );
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(productId))
    return local[productId] ?? [];
  const { data, error } = await supabase
    .from("product_components")
    .select(
      "inventory_item_id,quantity,is_cut_choice,cut_code,inventory_items(name)",
    )
    .eq("product_id", productId);
  if (error) return local[productId] ?? [];
  return (data ?? []).map((row) => ({
    inventoryItemId: row.inventory_item_id,
    inventoryName: Array.isArray(row.inventory_items)
      ? row.inventory_items[0]?.name
      : ((row.inventory_items as { name?: string } | null)?.name ?? "Bahan"),
    quantity: Number(row.quantity),
    isCutChoice: row.is_cut_choice,
    cutCode: row.cut_code ?? undefined,
  }));
}

export async function saveProductComponents(
  productId: string,
  components: ProductComponentDraft[],
) {
  const normalized = Array.from(
    new Map(
      components
        .filter((component) => component.quantity > 0)
        .map((component) => [component.inventoryItemId, component]),
    ).values(),
  );
  const local = readLocal<Record<string, ProductComponentDraft[]>>(
    COMPONENT_KEY,
    {},
  );
  writeLocal(COMPONENT_KEY, { ...local, [productId]: normalized });
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(productId)) return;
  const { error: productError } = await supabase
    .from("products")
    .update({
      allows_chicken_cut_choice: normalized.some(
        (component) => component.isCutChoice,
      ),
    })
    .eq("id", productId)
    .eq("outlet_id", outletId);
  if (productError) throw productError;
  const { error: deleteError } = await supabase
    .from("product_components")
    .delete()
    .eq("product_id", productId);
  if (deleteError) throw deleteError;
  if (normalized.length) {
    const { error } = await supabase.from("product_components").insert(
      normalized.map((component) => ({
        product_id: productId,
        inventory_item_id: component.inventoryItemId,
        quantity: component.quantity,
        is_cut_choice: component.isCutChoice,
        cut_code: component.isCutChoice ? component.cutCode || null : null,
      })),
    );
    if (error) throw error;
  }
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

export type ProductionMenuRecord = {
  id: string;
  name: string;
  inputName: string;
  inputUnit: string;
};

async function ensureInventoryItem(
  name: string,
  unit: string,
  kind: "raw_material" | "production_output",
) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return crypto.randomUUID();
  const existing = await supabase
    .from("inventory_items")
    .select("id")
    .eq("outlet_id", outletId)
    .eq("name", name)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id as string;
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      outlet_id: outletId,
      name,
      kind,
      purchase_unit: unit,
      usage_unit: unit,
      units_per_purchase: 1,
      stock_quantity: 0,
      minimum_stock: 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function listProductionMenus(): Promise<{
  menus: ProductionMenuRecord[];
  outputs: Array<{
    id: string;
    menuId: string;
    name: string;
    qty: number;
    unit: string;
    stock: number;
  }>;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { menus: [], outputs: [] };
  const { data, error } = await supabase
    .from("production_recipes")
    .select(
      "id,name,batch_unit,production_recipe_lines(id,direction,quantity,inventory_items(name,usage_unit,stock_quantity))",
    )
    .eq("outlet_id", outletId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  const menus: ProductionMenuRecord[] = [];
  const outputs: Array<{
    id: string;
    menuId: string;
    name: string;
    qty: number;
    unit: string;
    stock: number;
  }> = [];
  for (const raw of data ?? []) {
    const row = raw as unknown as {
      id: string;
      name: string;
      batch_unit: string;
      production_recipe_lines: Array<{
        id: string;
        direction: "input" | "output";
        quantity: number;
        inventory_items: {
          name: string;
          usage_unit: string;
          stock_quantity: number;
        };
      }>;
    };
    const input = row.production_recipe_lines.find(
      (line) => line.direction === "input",
    );
    menus.push({
      id: row.id,
      name: row.name,
      inputName: input?.inventory_items.name ?? "Bahan baku",
      inputUnit: row.batch_unit,
    });
    row.production_recipe_lines
      .filter((line) => line.direction === "output")
      .forEach((line) =>
        outputs.push({
          id: line.id,
          menuId: row.id,
          name: line.inventory_items.name,
          qty: Number(line.quantity),
          unit: line.inventory_items.usage_unit,
          stock: Number(line.inventory_items.stock_quantity),
        }),
      );
  }
  return { menus, outputs };
}

export async function saveProductionMenu(
  value: Omit<ProductionMenuRecord, "id">,
  id?: string,
) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return id ?? crypto.randomUUID();
  const itemId = await ensureInventoryItem(
    value.inputName,
    value.inputUnit,
    "raw_material",
  );
  let recipeId = id;
  if (recipeId && /^[0-9a-f-]{36}$/i.test(recipeId)) {
    const { error } = await supabase
      .from("production_recipes")
      .update({ name: value.name, batch_unit: value.inputUnit })
      .eq("id", recipeId)
      .eq("outlet_id", outletId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("production_recipes")
      .insert({
        outlet_id: outletId,
        name: value.name,
        batch_unit: value.inputUnit,
        default_batch_size: 1,
      })
      .select("id")
      .single();
    if (error) throw error;
    recipeId = data.id as string;
  }
  await supabase
    .from("production_recipe_lines")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("direction", "input");
  const { error } = await supabase.from("production_recipe_lines").insert({
    recipe_id: recipeId,
    inventory_item_id: itemId,
    direction: "input",
    quantity: 1,
  });
  if (error) throw error;
  return recipeId!;
}

export async function deleteProductionMenu(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const { error } = await supabase
    .from("production_recipes")
    .update({ is_active: false })
    .eq("id", id)
    .eq("outlet_id", outletId);
  if (error) throw error;
}

export async function saveProductionOutput(
  recipeId: string,
  value: { name: string; qty: number; unit: string },
  lineId?: string,
) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(recipeId))
    return lineId ?? crypto.randomUUID();
  const itemId = await ensureInventoryItem(
    value.name,
    value.unit,
    "production_output",
  );
  if (lineId && /^[0-9a-f-]{36}$/i.test(lineId)) {
    const { error } = await supabase
      .from("production_recipe_lines")
      .update({ inventory_item_id: itemId, quantity: value.qty })
      .eq("id", lineId)
      .eq("recipe_id", recipeId);
    if (error) throw error;
    return lineId;
  }
  const { data, error } = await supabase
    .from("production_recipe_lines")
    .insert({
      recipe_id: recipeId,
      inventory_item_id: itemId,
      direction: "output",
      quantity: value.qty,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteProductionOutput(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const { error } = await supabase
    .from("production_recipe_lines")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

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
          : error.message.includes("CUT_REQUIRED")
            ? "Pilih potongan ayam terlebih dahulu."
            : error.message.includes("CUT_NOT_CONFIGURED:")
              ? `Potongan ${error.message.split("CUT_NOT_CONFIGURED:")[1]} belum dikonfigurasi pada resep menu.`
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

export async function getActiveOilCycle() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("oil_cycles")
    .select("id,started_at,initial_pouches,initial_liters,packs_processed")
    .eq("outlet_id", outletId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    startedAt: data.started_at,
    initialPouches: Number(data.initial_pouches),
    initialLiters: Number(data.initial_liters),
    packsProcessed: Number(data.packs_processed),
  };
}

export async function startOilCycle(
  pouches: number,
  liters: number,
  reason = "initial",
) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase)
    return {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      initialPouches: pouches,
      initialLiters: liters,
      packsProcessed: 0,
    };
  const { error } = await supabase.rpc("start_oil_cycle", {
    p_pouches: pouches,
    p_liters: liters,
    p_reason: reason,
  });
  if (error) throw new Error("Siklus minyak gagal dimulai.");
  return getActiveOilCycle();
}

export async function recordOilEvent(
  type: "inspection" | "top_up",
  input: {
    pouches?: number;
    liters?: number;
    condition?: string;
    note?: string;
  },
) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await supabase.rpc("record_oil_event", {
    p_event_type: type,
    p_pouches: input.pouches ?? null,
    p_liters: input.liters ?? null,
    p_condition: input.condition ?? null,
    p_note: input.note ?? null,
  });
  if (error)
    throw new Error(
      error.message.includes("OIL_CYCLE_REQUIRED")
        ? "Mulai siklus minyak terlebih dahulu."
        : "Catatan minyak gagal disimpan.",
    );
}

export async function listDisplayStock() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("list_display_stock");
  if (error) return [];
  type DisplayStockRow = {
    id: string;
    itemName: string;
    quantity: number;
    producedAt: string;
    ageMinutes: number;
    limitMinutes: number;
    status: string;
  };
  const batches: DisplayStockRow[] = (data ?? []).map(
    (row: {
      id: string;
      item_name: string;
      quantity_remaining: number;
      produced_at: string;
      age_minutes: number;
      display_limit_minutes: number;
      status: string;
    }) => ({
      id: row.id,
      itemName: row.item_name,
      quantity: Number(row.quantity_remaining),
      producedAt: row.produced_at,
      ageMinutes: Number(row.age_minutes),
      limitMinutes: Number(row.display_limit_minutes),
      status: row.status,
    }),
  );
  return Array.from(
    batches
      .reduce<Map<string, DisplayStockRow>>((grouped, batch) => {
        const current = grouped.get(batch.itemName);
        if (!current) {
          grouped.set(batch.itemName, batch);
        } else {
          current.quantity += batch.quantity;
          current.ageMinutes = Math.max(current.ageMinutes, batch.ageMinutes);
          if (batch.producedAt < current.producedAt) {
            current.producedAt = batch.producedAt;
            current.id = batch.id;
          }
        }
        return grouped;
      }, new Map())
      .values(),
  );
}

export type ReportDataset = {
  kpis: string[][];
  columns: string[];
  rows: string[][];
};
function reportStart(period: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(period))
    return new Date(`${period.slice(0, 10)}T00:00:00`).toISOString();
  const date = new Date();
  if (period === "All time") return undefined;
  if (period === "Kemarin") date.setDate(date.getDate() - 1);
  else if (period === "Minggu ini")
    date.setDate(date.getDate() - date.getDay() + 1);
  else if (period === "Bulan ini") date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}
export async function loadReportDataset(
  tab: string,
  period: string,
): Promise<ReportDataset | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const start = reportStart(period);
  if (tab === "Penjualan" || tab === "Produk") {
    let query = supabase
      .from("sales")
      .select(
        "receipt_number,created_at,payment_method,total,status,sale_items(product_name,quantity,line_total)",
      )
      .eq("outlet_id", outletId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (start) query = query.gte("created_at", start);
    const { data, error } = await query;
    if (error || !data) return null;
    if (tab === "Penjualan") {
      const total = data.reduce((sum, row) => sum + Number(row.total), 0);
      return {
        kpis: [
          ["Penjualan bersih", String(total), "Data Supabase"],
          ["Jumlah transaksi", String(data.length), "Transaksi"],
          [
            "Rata-rata",
            String(data.length ? Math.round(total / data.length) : 0),
            "Per transaksi",
          ],
          [
            "Selesai",
            String(data.filter((row) => row.status === "completed").length),
            "Transaksi",
          ],
        ],
        columns: ["Waktu", "Struk", "Pembayaran", "Total", "Status"],
        rows: data.map((row) => [
          new Date(row.created_at).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          row.receipt_number,
          row.payment_method,
          String(row.total),
          row.status,
        ]),
      };
    }
    const totals = new Map<string, { qty: number; total: number }>();
    for (const sale of data)
      for (const item of sale.sale_items ?? []) {
        const value = totals.get(item.product_name) ?? { qty: 0, total: 0 };
        value.qty += Number(item.quantity);
        value.total += Number(item.line_total);
        totals.set(item.product_name, value);
      }
    const rows = [...totals.entries()].sort((a, b) => b[1].qty - a[1].qty);
    return {
      kpis: [
        [
          "Menu terjual",
          String(rows.reduce((sum, row) => sum + row[1].qty, 0)),
          "Item",
        ],
        ["Menu terlaris", rows[0]?.[0] ?? "-", `${rows[0]?.[1].qty ?? 0} item`],
        ["Menu aktif", String(rows.length), "Dengan penjualan"],
        [
          "Omzet",
          String(rows.reduce((sum, row) => sum + row[1].total, 0)),
          "Total",
        ],
      ],
      columns: ["Menu", "Terjual", "Omzet"],
      rows: rows.map(([name, value]) => [
        name,
        String(value.qty),
        String(value.total),
      ]),
    };
  }
  if (tab === "Produksi") {
    let query = supabase
      .from("production_batches")
      .select(
        "batch_number,completed_at,multiplier,status,production_recipes(name)",
      )
      .eq("outlet_id", outletId)
      .order("completed_at", { ascending: false })
      .limit(250);
    if (start) query = query.gte("completed_at", start);
    const { data, error } = await query;
    if (error || !data) return null;
    return {
      kpis: [
        ["Batch", String(data.length), "Tersimpan"],
        [
          "Total input",
          String(data.reduce((sum, row) => sum + Number(row.multiplier), 0)),
          "Satuan",
        ],
        [
          "Selesai",
          String(data.filter((row) => row.status === "completed").length),
          "Batch",
        ],
        [
          "Batal",
          String(data.filter((row) => row.status === "cancelled").length),
          "Batch",
        ],
      ],
      columns: ["Batch", "Waktu", "Jumlah", "Status"],
      rows: data.map((row) => [
        row.batch_number,
        new Date(row.completed_at).toLocaleString("id-ID"),
        String(row.multiplier),
        row.status,
      ]),
    };
  }
  if (tab === "Persediaan") {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("name,kind,stock_quantity,minimum_stock,usage_unit")
      .eq("outlet_id", outletId)
      .eq("is_active", true)
      .order("name");
    if (error || !data) return null;
    return {
      kpis: [
        ["Total item", String(data.length), "Aktif"],
        [
          "Menipis",
          String(
            data.filter(
              (row) => Number(row.stock_quantity) <= Number(row.minimum_stock),
            ).length,
          ),
          "Item",
        ],
        [
          "Aman",
          String(
            data.filter(
              (row) => Number(row.stock_quantity) > Number(row.minimum_stock),
            ).length,
          ),
          "Item",
        ],
        [
          "Negatif",
          String(data.filter((row) => Number(row.stock_quantity) < 0).length),
          "Item",
        ],
      ],
      columns: ["Item", "Kelompok", "Stok", "Minimum", "Status"],
      rows: data.map((row) => [
        row.name,
        row.kind,
        `${row.stock_quantity} ${row.usage_unit}`,
        String(row.minimum_stock),
        Number(row.stock_quantity) <= Number(row.minimum_stock)
          ? "Menipis"
          : "Aman",
      ]),
    };
  }
  const { data, error } = await supabase
    .from("cash_shifts")
    .select(
      "opened_at,closed_at,opening_cash,expected_cash,closing_cash,difference,status",
    )
    .eq("outlet_id", outletId)
    .order("opened_at", { ascending: false })
    .limit(100);
  if (error || !data) return null;
  return {
    kpis: [
      ["Jumlah shift", String(data.length), "Periode"],
      [
        "Shift aktif",
        String(data.filter((row) => row.status === "open").length),
        "Saat ini",
      ],
      [
        "Modal awal",
        String(data.reduce((sum, row) => sum + Number(row.opening_cash), 0)),
        "Total",
      ],
      [
        "Selisih",
        String(data.reduce((sum, row) => sum + Number(row.difference ?? 0), 0)),
        "Drawer",
      ],
    ],
    columns: ["Dibuka", "Ditutup", "Modal", "Kas akhir", "Selisih"],
    rows: data.map((row) => [
      new Date(row.opened_at).toLocaleString("id-ID"),
      row.closed_at ? new Date(row.closed_at).toLocaleString("id-ID") : "Aktif",
      String(row.opening_cash),
      String(row.closing_cash ?? row.expected_cash),
      String(row.difference ?? 0),
    ]),
  };
}

export async function loadActivityLogs() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id,action,entity_type,after_data,created_at,operators(name)")
    .eq("outlet_id", outletId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: String(row.id),
    time: new Date(row.created_at).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    operator: Array.isArray(row.operators)
      ? (row.operators[0]?.name ?? "Sistem")
      : ((row.operators as { name?: string } | null)?.name ?? "Sistem"),
    action: row.action,
    detail: JSON.stringify(row.after_data ?? {}),
    category: String(row.entity_type ?? "Aktivitas"),
  }));
}

export async function listRecentSales() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id,receipt_number,created_at,customer_name,payment_method,total,status,sale_items(product_name,quantity)",
    )
    .eq("outlet_id", outletId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return data ?? [];
}
export async function cancelSale(id: string, pin: string, reason: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase diperlukan untuk pembatalan.");
  const { error } = await supabase.rpc("cancel_sale", {
    p_sale_id: id,
    p_owner_pin: pin,
    p_reason: reason,
  });
  if (error)
    throw new Error(
      error.message.includes("OWNER_PIN_REQUIRED")
        ? "PIN owner tidak sesuai."
        : "Transaksi gagal dibatalkan.",
    );
}
