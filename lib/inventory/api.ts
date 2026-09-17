"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeCode } from "@/lib/codici/normalizeCode";
import type { OrderDetail, OrderSummary, Product, ProductDraft, IdentifierKind } from "@/types/inventory";

const PRODUCT_SELECT = "*, product_identifiers(*), product_prices(*, price_list:price_lists(id, name, sort_order))";

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listProducts(): Promise<Product[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).order("internal_code");
  throwIfError(error);
  return (data ?? []) as Product[];
}

export async function findProductsByCode(rawCode: string): Promise<Product[]> {
  const normalized = normalizeCode(rawCode);
  if (!normalized) return [];
  const supabase = createSupabaseBrowserClient();
  const { data: identifiers, error: identifierError } = await supabase
    .from("product_identifiers")
    .select("product_id")
    .eq("normalized_value", normalized);
  throwIfError(identifierError);
  const productIds = [...new Set((identifiers ?? []).map((item) => item.product_id))];
  if (productIds.length === 0) return [];
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).in("id", productIds).eq("active", true);
  throwIfError(error);
  return (data ?? []) as Product[];
}

export async function createProduct(draft: ProductDraft): Promise<Product> {
  const supabase = createSupabaseBrowserClient();
  const internalCode = normalizeCode(draft.internal_code);
  if (!internalCode || !draft.name.trim()) throw new Error("Codice prodotto e nome sono obbligatori.");
  const { data: product, error } = await supabase.from("products").insert({
    internal_code: internalCode,
    name: draft.name.trim(),
    description: draft.description?.trim() ?? "",
    brand: draft.brand?.trim() ?? "",
    category: draft.category?.trim() ?? "",
    location: draft.location?.trim() ?? "",
    unit: draft.unit?.trim() || "pz",
    stock_quantity: draft.stockQuantity ?? 0,
    minimum_stock: draft.minimumStock ?? null,
    supplier: draft.supplier?.trim() ?? "",
    notes: draft.notes?.trim() ?? "",
  }).select().single();
  throwIfError(error);

  const codes: Array<{ kind: IdentifierKind; value?: string }> = [
    { kind: "internal_code", value: internalCode },
    { kind: "barcode", value: draft.barcode },
    { kind: "mav", value: draft.mav },
    ...(draft.crossReferences ?? []).map((value) => ({ kind: "cross_reference" as const, value })),
  ];
  const identifiers = codes
    .map(({ kind, value }) => ({ kind, value: String(value ?? "").trim() }))
    .filter(({ value }) => Boolean(value))
    .map(({ kind, value }) => ({ product_id: product.id, kind, value, normalized_value: normalizeCode(value) }));
  const { error: identifierError } = await supabase.from("product_identifiers").insert(identifiers);
  throwIfError(identifierError);

  if ((draft.stockQuantity ?? 0) !== 0) {
    const { error: movementError } = await supabase.from("inventory_movements").insert({
      product_id: product.id, delta: draft.stockQuantity, reason: "initial_import", note: "Creazione prodotto"
    });
    throwIfError(movementError);
  }
  return { ...product, product_identifiers: identifiers as Product["product_identifiers"], product_prices: [] } as Product;
}

export async function upsertImportedProduct(draft: ProductDraft, source = "Import Excel") {
  const supabase = createSupabaseBrowserClient();
  const internalCode = normalizeCode(draft.internal_code);
  if (!internalCode) throw new Error("Una riga non contiene il codice prodotto interno.");
  const { data: existing, error: existingError } = await supabase.from("products").select("id").eq("internal_code", internalCode).maybeSingle();
  throwIfError(existingError);
  const values = {
    internal_code: internalCode, name: draft.name?.trim() ?? "", description: draft.description?.trim() ?? "", brand: draft.brand?.trim() ?? "", category: draft.category?.trim() ?? "", location: draft.location?.trim() ?? "", unit: draft.unit?.trim() || "pz", minimum_stock: draft.minimumStock ?? null, supplier: draft.supplier?.trim() ?? "", notes: draft.notes?.trim() ?? "",
  };
  const { data: product, error } = existing
    ? await supabase.from("products").update(values).eq("id", existing.id).select().single()
    : await supabase.from("products").insert({ ...values, stock_quantity: draft.stockQuantity ?? 0 }).select().single();
  throwIfError(error);
  const codes: Array<{ kind: IdentifierKind; value?: string }> = [{ kind: "internal_code", value: internalCode }, { kind: "barcode", value: draft.barcode }, { kind: "mav", value: draft.mav }, ...(draft.crossReferences ?? []).map((value) => ({ kind: "cross_reference" as const, value }))];
  const identifiers = codes.map(({ kind, value }) => ({ kind, value: String(value ?? "").trim() })).filter(({ value }) => Boolean(value)).map(({ kind, value }) => ({ product_id: product.id, kind, value, normalized_value: normalizeCode(value) }));
  if (identifiers.length) { const { error: identifierError } = await supabase.from("product_identifiers").upsert(identifiers, { onConflict: "product_id,normalized_value", ignoreDuplicates: true }); throwIfError(identifierError); }
  for (const price of draft.prices ?? []) {
    if (!Number.isFinite(price.amount)) continue;
    const { data: list, error: listError } = await supabase.from("price_lists").upsert({ name: price.name.trim() || "Listino" }, { onConflict: "name" }).select().single();
    throwIfError(listError);
    const { error: priceError } = await supabase.from("product_prices").upsert({ product_id: product.id, price_list_id: list.id, amount: price.amount }, { onConflict: "product_id,price_list_id" });
    throwIfError(priceError);
  }
  if (!existing && (draft.stockQuantity ?? 0) !== 0) { const { error: movementError } = await supabase.from("inventory_movements").insert({ product_id: product.id, delta: draft.stockQuantity, reason: "initial_import", note: source }); throwIfError(movementError); }
  return { created: !existing, productId: product.id };
}

export async function createOrder(name: string, notes = ""): Promise<OrderSummary> {
  const supabase = createSupabaseBrowserClient();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("orders").insert({ name: name.trim(), notes: notes.trim(), created_by: user.user?.id }).select().single();
  throwIfError(error);
  return data as OrderSummary;
}

export async function listOrders(): Promise<OrderSummary[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("orders").select("*, order_items(quantity)").order("updated_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as OrderSummary[];
}

export async function getOrder(id: string): Promise<OrderDetail> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("orders").select(`*, order_items(*, product:products(${PRODUCT_SELECT}))`).eq("id", id).single();
  throwIfError(error);
  return data as OrderDetail;
}

export async function scanProductIntoOrder(orderId: string, productId: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("scan_order_item", { p_order_id: orderId, p_product_id: productId });
  throwIfError(error);
  return data?.[0];
}

export async function setOrderItemQuantity(itemId: string, quantity: number) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("set_order_item_quantity", { p_order_item_id: itemId, p_quantity: quantity });
  throwIfError(error);
  return data?.[0];
}

export async function closeOrder(id: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("close_order", { p_order_id: id });
  throwIfError(error);
}

export async function adjustStock(productId: string, delta: number, note = "") {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("adjust_product_stock", { p_product_id: productId, p_delta: delta, p_note: note });
  throwIfError(error);
  return data as number;
}
