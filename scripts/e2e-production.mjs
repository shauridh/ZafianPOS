import { createClient } from "@supabase/supabase-js";

const url = process.env.E2E_SUPABASE_URL;
const serviceKey = process.env.E2E_SERVICE_KEY;
let outletId = process.env.E2E_OUTLET_ID;
if (!url || !serviceKey) {
  throw new Error("Missing E2E environment.");
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const run = `E2E-${Date.now()}`;
const email = `${run.toLowerCase()}@example.invalid`;
const password = `Test-${crypto.randomUUID()}a1!`;
const ids = {
  inventory: [],
  products: [],
  sales: [],
  shifts: [],
  batches: [],
  recipes: [],
  categories: [],
  operator: null,
  user: null,
  outlet: null,
};
const checks = [];

function ok(name, condition, details = "") {
  if (!condition) throw new Error(`FAIL ${name}: ${details}`);
  checks.push({ name, status: "PASS", details });
}

async function insertInventory(name, kind, stock, unit = "pcs") {
  const { data, error } = await admin
    .from("inventory_items")
    .insert({
      outlet_id: outletId,
      name: `${run} ${name}`,
      kind,
      purchase_unit: unit,
      usage_unit: unit,
      units_per_purchase: 1,
      stock_quantity: stock,
      minimum_stock: 0,
    })
    .select("id,name,stock_quantity")
    .single();
  if (error) throw error;
  ids.inventory.push(data.id);
  return data;
}

async function stock(id) {
  const { data, error } = await admin
    .from("inventory_items")
    .select("stock_quantity")
    .eq("id", id)
    .single();
  if (error) throw error;
  return Number(data.stock_quantity);
}

try {
  const { data: outlet, error: outletError } = await admin
    .from("outlets")
    .insert({ name: `${run} Outlet`, timezone: "Asia/Jakarta" })
    .select("id")
    .single();
  if (outletError) throw outletError;
  outletId = outlet.id;
  ids.outlet = outlet.id;

  const { data: userData, error: userError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (userError) throw userError;
  ids.user = userData.user.id;

  const { data: operator, error: operatorError } = await admin
    .from("operators")
    .insert({
      outlet_id: outletId,
      auth_user_id: ids.user,
      name: `${run} Operator`,
      initials: "QA",
    })
    .select("id")
    .single();
  if (operatorError) throw operatorError;
  ids.operator = operator.id;

  const user = createClient(url, process.env.E2E_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await user.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  const chicken = await insertInventory(
    "Ayam mentah",
    "raw_material",
    10,
    "pak",
  );
  const flour = await insertInventory("Tepung", "raw_material", 10, "pak");
  const packaging = await insertInventory("Kemasan", "sales_supply", 20);
  const direct = await insertInventory("Saus botol", "direct_sale", 10);
  const meatball = await insertInventory("Baso mentah", "raw_material", 0);
  const { data: purchaseResult, error: purchaseError } = await user.rpc(
    "record_inventory_stock",
    {
      p_inventory_item_id: meatball.id,
      p_operation: "purchase",
      p_quantity: 100,
      p_note: "2 pak x 50 butir",
      p_purchase_price: 25000,
    },
  );
  if (purchaseError) throw purchaseError;
  ok(
    "Pembelian menambah stok bahan",
    Number(purchaseResult.balance_after) === 100 &&
      (await stock(meatball.id)) === 100,
  );
  const { data: correctionResult, error: correctionError } = await user.rpc(
    "record_inventory_stock",
    {
      p_inventory_item_id: meatball.id,
      p_operation: "correction",
      p_quantity: 92,
      p_note: "Hasil hitung fisik",
      p_purchase_price: null,
    },
  );
  if (correctionError) throw correctionError;
  ok(
    "Koreksi menetapkan saldo fisik",
    Number(correctionResult.quantity_delta) === -8 &&
      (await stock(meatball.id)) === 92,
  );
  const { data: inventoryLedger, error: inventoryLedgerError } = await admin
    .from("stock_movements")
    .select("kind,quantity_delta,balance_after")
    .eq("inventory_item_id", meatball.id)
    .order("id");
  if (inventoryLedgerError) throw inventoryLedgerError;
  ok(
    "Pembelian dan koreksi tercatat di ledger",
    inventoryLedger.length === 2 &&
      inventoryLedger[0].kind === "purchase" &&
      inventoryLedger[1].kind === "opname",
  );
  const cuts = {};
  for (const [name, qty] of [
    ["Sayap", 2],
    ["Paha atas", 2],
    ["Paha bawah", 2],
    ["Dada", 3],
  ]) {
    cuts[name] = {
      ...(await insertInventory(name, "production_output", 0)),
      outputQty: qty,
    };
  }

  const { data: recipe, error: recipeError } = await admin
    .from("production_recipes")
    .insert({
      outlet_id: outletId,
      name: `${run} Goreng ayam`,
      default_batch_size: 1,
      batch_unit: "batch",
    })
    .select("id")
    .single();
  if (recipeError) throw recipeError;
  ids.recipes.push(recipe.id);
  const recipeLines = [
    {
      recipe_id: recipe.id,
      inventory_item_id: chicken.id,
      direction: "input",
      quantity: 2,
    },
    {
      recipe_id: recipe.id,
      inventory_item_id: flour.id,
      direction: "input",
      quantity: 2 / 3,
    },
    ...Object.values(cuts).map((cut) => ({
      recipe_id: recipe.id,
      inventory_item_id: cut.id,
      direction: "output",
      quantity: cut.outputQty,
    })),
  ];
  const { error: linesError } = await admin
    .from("production_recipe_lines")
    .insert(recipeLines);
  if (linesError) throw linesError;

  const { data: shiftData, error: shiftError } = await user.rpc(
    "open_cash_shift",
    { p_opening_cash: 350000 },
  );
  if (shiftError) throw shiftError;
  const { data: activeShift } = await admin
    .from("cash_shifts")
    .select("id")
    .eq("operator_id", operator.id)
    .eq("status", "open")
    .single();
  ids.shifts.push(activeShift.id);
  ok("Buka kasir Rp350.000", Boolean(shiftData));

  const { data: batch, error: batchError } = await user.rpc(
    "complete_production_batch",
    {
      p_recipe_id: recipe.id,
      p_multiplier: 1,
      p_operator_id: operator.id,
    },
  );
  if (batchError) throw batchError;
  ids.batches.push(batch.id);
  ok("Produksi mengurangi ayam", (await stock(chicken.id)) === 8);
  ok(
    "Produksi memakai rasio tepung",
    Math.abs((await stock(flour.id)) - 9.333333) < 0.00001,
  );
  ok("Produksi menambah Dada", (await stock(cuts.Dada.id)) === 3);
  ok("Produksi menambah Sayap", (await stock(cuts.Sayap.id)) === 2);

  const { data: display, error: displayError } =
    await user.rpc("list_display_stock");
  if (displayError) throw displayError;
  ok(
    "Hasil produksi masuk etalase",
    display.some(
      (item) =>
        item.item_name === `${run} Dada` &&
        Number(item.quantity_remaining) === 3,
    ),
  );

  const { data: category, error: categoryError } = await admin
    .from("menu_categories")
    .insert({ outlet_id: outletId, name: `${run} Menu`, sort_order: 999 })
    .select("id")
    .single();
  if (categoryError) throw categoryError;
  ids.categories.push(category.id);
  const { data: product, error: productError } = await admin
    .from("products")
    .insert({
      outlet_id: outletId,
      category_id: category.id,
      name: `${run} Ayam pilihan`,
      sale_price: 19000,
      allows_chicken_cut_choice: true,
    })
    .select("id")
    .single();
  if (productError) throw productError;
  ids.products.push(product.id);
  const { error: componentsError } = await admin
    .from("product_components")
    .insert([
      ...Object.entries(cuts).map(([cutCode, cut]) => ({
        product_id: product.id,
        inventory_item_id: cut.id,
        quantity: 1,
        is_cut_choice: true,
        cut_code: cutCode,
      })),
      {
        product_id: product.id,
        inventory_item_id: packaging.id,
        quantity: 1,
        is_cut_choice: false,
      },
    ]);
  if (componentsError) throw componentsError;

  const { error: invalidCutError } = await user.rpc("complete_sale", {
    p_channel: "takeaway",
    p_online_provider: null,
    p_customer_name: null,
    p_payment_method: "cash",
    p_discount: 0,
    p_cash_received: 20000,
    p_items: [
      {
        product_id: product.id,
        name: `${run} Ayam pilihan`,
        chicken_cut: "Leher",
        quantity: 1,
        unit_price: 19000,
      },
    ],
  });
  ok(
    "Potongan yang tidak dikonfigurasi ditolak",
    invalidCutError?.message.includes("CUT_NOT_CONFIGURED"),
  );
  ok(
    "Transaksi gagal tidak mengubah stok",
    (await stock(cuts.Dada.id)) === 3 && (await stock(packaging.id)) === 20,
  );

  const { data: cutSale, error: cutSaleError } = await user.rpc(
    "complete_sale",
    {
      p_channel: "takeaway",
      p_online_provider: null,
      p_customer_name: `${run} Customer`,
      p_payment_method: "cash",
      p_discount: 0,
      p_cash_received: 20000,
      p_items: [
        {
          product_id: product.id,
          name: `${run} Ayam pilihan`,
          chicken_cut: "Dada",
          quantity: 1,
          unit_price: 19000,
        },
      ],
    },
  );
  if (cutSaleError) throw cutSaleError;
  ids.sales.push(cutSale.id);
  ok("Penjualan mengurangi Dada terpilih", (await stock(cuts.Dada.id)) === 2);
  ok("Penjualan tidak mengurangi Sayap", (await stock(cuts.Sayap.id)) === 2);
  ok("Penjualan mengurangi kemasan", (await stock(packaging.id)) === 19);
  ok("Kembalian tunai tepat", Number(cutSale.change) === 1000);

  const { data: directProduct, error: directProductError } = await admin
    .from("products")
    .insert({
      outlet_id: outletId,
      category_id: category.id,
      name: `${run} Saus langsung`,
      sale_price: 5000,
    })
    .select("id")
    .single();
  if (directProductError) throw directProductError;
  ids.products.push(directProduct.id);
  await admin.from("product_components").insert({
    product_id: directProduct.id,
    inventory_item_id: direct.id,
    quantity: 1,
    is_cut_choice: false,
  });
  const { data: directSale, error: directSaleError } = await user.rpc(
    "complete_sale",
    {
      p_channel: "takeaway",
      p_online_provider: null,
      p_customer_name: null,
      p_payment_method: "qris",
      p_discount: 0,
      p_cash_received: null,
      p_items: [
        {
          product_id: directProduct.id,
          name: `${run} Saus langsung`,
          chicken_cut: "",
          quantity: 1,
          unit_price: 5000,
        },
      ],
    },
  );
  if (directSaleError) throw directSaleError;
  ids.sales.push(directSale.id);
  ok("Menu langsung mengurangi bahan", (await stock(direct.id)) === 9);

  const { data: closeResult, error: closeError } = await user.rpc(
    "close_cash_shift",
    { p_closing_cash: 369000, p_owner_pin: null },
  );
  if (closeError) throw closeError;
  ok("Tutup kasir tanpa selisih", Number(closeResult.difference) === 0);

  console.log(JSON.stringify({ run, checks }, null, 2));
} finally {
  if (ids.inventory.length) {
    await admin
      .from("display_batches")
      .delete()
      .in("inventory_item_id", ids.inventory);
    await admin
      .from("stock_movements")
      .delete()
      .in("inventory_item_id", ids.inventory);
  }
  if (ids.sales.length) {
    await admin.from("activity_logs").delete().in("entity_id", ids.sales);
    await admin.from("sales").delete().in("id", ids.sales);
  }
  if (ids.batches.length) {
    await admin.from("activity_logs").delete().in("entity_id", ids.batches);
    await admin.from("production_batches").delete().in("id", ids.batches);
  }
  if (ids.shifts.length) {
    await admin.from("cash_movements").delete().in("shift_id", ids.shifts);
    await admin.from("cash_shifts").delete().in("id", ids.shifts);
  }
  if (ids.products.length) {
    await admin.from("products").delete().in("id", ids.products);
  }
  if (ids.recipes.length) {
    await admin.from("production_recipes").delete().in("id", ids.recipes);
  }
  if (ids.inventory.length) {
    await admin.from("inventory_items").delete().in("id", ids.inventory);
  }
  if (ids.categories.length) {
    await admin.from("menu_categories").delete().in("id", ids.categories);
  }
  if (ids.operator) {
    await admin.from("activity_logs").delete().eq("operator_id", ids.operator);
    await admin.from("operators").delete().eq("id", ids.operator);
  }
  if (ids.user) await admin.auth.admin.deleteUser(ids.user);
  if (ids.outlet) await admin.from("outlets").delete().eq("id", ids.outlet);
}
