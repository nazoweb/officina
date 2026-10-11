"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeCode } from "@/lib/codici/normalizeCode";
import type { OrderDetail, OrderSummary, Product, ProductDraft } from "@/types/inventory";

import { UserFacingError } from "@/lib/user-errors";
import { tracked } from "@/lib/inventory/activity";

const PRODUCT_SELECT = "*, product_identifiers(*), product_prices(*, price_list:price_lists(id, name, sort_order))";

function throwIfError(error: { message: string } | null) {
  if (error) throw error;
}

async function listProductsImpl(): Promise<Product[]> {
  const supabase = createSupabaseBrowserClient();
  const products: Product[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("active", true).order("internal_code").range(offset, offset + 499);
    throwIfError(error);
    products.push(...(data ?? []) as Product[]);
    if ((data?.length ?? 0) < 500) return products;
  }
}

async function findProductsByCodeImpl(rawCode: string): Promise<Product[]> {
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

async function getProductImpl(id: string): Promise<Product> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("id", id).single();
  throwIfError(error);
  return data as Product;
}

async function saveProductImpl(draft: ProductDraft, product?: Product): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("save_catalogue_product", {
    p_product_id: product?.id ?? null, p_draft: draft, p_expected_updated_at: product?.updated_at ?? null,
  });
  if (error?.code === "23505") { const message = new UserFacingError("Codice prodotto già presente oppure nomi di listino duplicati. Scegli un codice o un nome diverso e riprova."); Object.assign(message, { code: error.code, cause: error }); throw message; }
  throwIfError(error);
  return data as string;
}

async function createProductImpl(draft: ProductDraft): Promise<Product> {
  return getProduct(await saveProduct(draft));
}

async function deleteProductImpl(id: string) {
  const { data, error } = await createSupabaseBrowserClient().from("products").delete().eq("id", id).select("id").single();
  throwIfError(error);
  if (!data) throw new UserFacingError("Il prodotto non esiste più.");
}

async function listCategoriesImpl(): Promise<string[]> {
  const { data, error } = await createSupabaseBrowserClient().from("product_categories").select("name").order("name");
  throwIfError(error);
  return (data ?? []).map((category) => category.name);
}

async function createCategoryImpl(name: string) {
  if (!name.trim()) throw new UserFacingError("Inserisci il nome della categoria.");
  const { error } = await createSupabaseBrowserClient().from("product_categories").insert({ name: name.trim() });
  if (error?.code === "23505") throw new UserFacingError("Questa categoria esiste già.");
  throwIfError(error);
}

async function renameCategoryImpl(name: string, newName: string) {
  const { error } = await createSupabaseBrowserClient().rpc("rename_product_category", { p_name: name, p_new_name: newName.trim() });
  if (error?.code === "23505") throw new UserFacingError("Questo nome è già usato da un’altra categoria.");
  throwIfError(error);
}

async function deleteCategoryImpl(name: string, deleteProducts: boolean, expectedCount: number) {
  const { error } = await createSupabaseBrowserClient().rpc("delete_product_category", { p_name: name, p_delete_products: deleteProducts, p_expected_count: expectedCount });
  throwIfError(error);
}

async function assignProductsCategoryImpl(ids: string[], category: string) {
  if (!ids.length) throw new UserFacingError("Seleziona almeno un prodotto.");
  const { error } = await createSupabaseBrowserClient().from("products").update({ category: category.trim() }).in("id", ids);
  throwIfError(error);
}

async function updateOrderImpl(order: OrderSummary, name: string, notes: string, status = order.status) {
  const { error } = await createSupabaseBrowserClient().rpc("manage_order", { p_order_id: order.id, p_name: name, p_notes: notes, p_status: status });
  throwIfError(error);
}

async function deleteOrderImpl(id: string, restoreStock: boolean) {
  const { error } = await createSupabaseBrowserClient().rpc("delete_catalogue_order", { p_order_id: id, p_restore_stock: restoreStock });
  throwIfError(error);
}

async function upsertImportedProductImpl(draft: ProductDraft, source = "Import Excel") {
  const { data, error } = await createSupabaseBrowserClient().rpc("import_catalogue_product", { p_draft: draft, p_source: source });
  throwIfError(error);
  return data as { created: boolean; productId: string };
}

async function createOrderImpl(name: string, notes = ""): Promise<OrderSummary> {
  const supabase = createSupabaseBrowserClient();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("orders").insert({ name: name.trim(), notes: notes.trim(), created_by: user.user?.id }).select().single();
  throwIfError(error);
  return data as OrderSummary;
}

async function listOrdersImpl(): Promise<OrderSummary[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("orders").select("*, order_items(quantity)").order("updated_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as OrderSummary[];
}

async function getOrderImpl(id: string): Promise<OrderDetail> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("orders").select(`*, order_items(*, product:products(${PRODUCT_SELECT}))`).eq("id", id).single();
  throwIfError(error);
  return data as OrderDetail;
}

async function scanProductIntoOrderImpl(orderId: string, productId: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("scan_order_item", { p_order_id: orderId, p_product_id: productId });
  throwIfError(error);
  return data?.[0];
}

async function setOrderItemQuantityImpl(itemId: string, quantity: number) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("set_order_item_quantity", { p_order_item_id: itemId, p_quantity: quantity });
  throwIfError(error);
  return data?.[0];
}

async function closeOrderImpl(id: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.rpc("close_order", { p_order_id: id });
  throwIfError(error);
}

async function adjustStockImpl(productId: string, delta: number, note = "") {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("adjust_product_stock", { p_product_id: productId, p_delta: delta, p_note: note });
  throwIfError(error);
  return data as number;
}

export const listProducts = tracked("listProducts", listProductsImpl);
export const findProductsByCode = tracked("findProductsByCode", findProductsByCodeImpl);
export const getProduct = tracked("getProduct", getProductImpl);
export const saveProduct = tracked("saveProduct", saveProductImpl);
export const createProduct = tracked("createProduct", createProductImpl);
export const deleteProduct = tracked("deleteProduct", deleteProductImpl);
export const listCategories = tracked("listCategories", listCategoriesImpl);
export const createCategory = tracked("createCategory", createCategoryImpl);
export const renameCategory = tracked("renameCategory", renameCategoryImpl);
export const deleteCategory = tracked("deleteCategory", deleteCategoryImpl);
export const assignProductsCategory = tracked("assignProductsCategory", assignProductsCategoryImpl);
export const updateOrder = tracked("updateOrder", updateOrderImpl);
export const deleteOrder = tracked("deleteOrder", deleteOrderImpl);
export const upsertImportedProduct = tracked("upsertImportedProduct", upsertImportedProductImpl);
export const createOrder = tracked("createOrder", createOrderImpl);
export const listOrders = tracked("listOrders", listOrdersImpl);
export const getOrder = tracked("getOrder", getOrderImpl);
export const scanProductIntoOrder = tracked("scanProductIntoOrder", scanProductIntoOrderImpl);
export const setOrderItemQuantity = tracked("setOrderItemQuantity", setOrderItemQuantityImpl);
export const closeOrder = tracked("closeOrder", closeOrderImpl);
export const adjustStock = tracked("adjustStock", adjustStockImpl);
