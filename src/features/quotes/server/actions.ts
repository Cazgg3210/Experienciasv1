"use server";

import { revalidatePath } from "next/cache";
import { protectedAction } from "@/server/action";
import {
  catalogLineRequestSchema,
  createQuoteSchema,
  customerSearchSchema,
  quoteDetailsSchema,
  quoteIdSchema,
  quotePricingSchema,
  quoteSelectionSchema,
} from "../schemas";
import { searchCustomers } from "./quote-queries";
import {
  buildCatalogLine,
  createNewVersion,
  createQuote,
  duplicateQuote,
  markQuoteExpired,
  previewQuote,
  previewQuotePricing,
  saveQuotePricing,
  sendQuote,
  updateQuoteDetails,
} from "./quote-service";

function revalidateQuote(id?: string) {
  revalidatePath("/admin/quotes");
  if (id) revalidatePath(`/admin/quotes/${id}`);
}

/** Recalcula en vivo el formulario de nueva cotización (motor en servidor, con costos). */
export const previewQuoteAction = protectedAction(
  { name: "quotes.preview", schema: quoteSelectionSchema, permission: "quotes:write" },
  async (input) =>
    previewQuote({
      experienceId: input.experienceId,
      guestCount: input.guestCount,
      menuId: input.menuId || null,
      serviceAreaId: input.serviceAreaId || null,
      addOns: input.addOns,
      depositBps: input.depositBps,
    }),
);

export const searchCustomersAction = protectedAction(
  { name: "quotes.search_customers", schema: customerSearchSchema, permission: "quotes:write" },
  async ({ q }) => searchCustomers(q),
);

export const createQuoteAction = protectedAction(
  { name: "quotes.create", schema: createQuoteSchema, permission: "quotes:write" },
  async (input, { user }) => {
    const res = await createQuote(user, input);
    revalidateQuote();
    if (input.leadId) {
      revalidatePath("/admin/leads");
      revalidatePath(`/admin/leads/${input.leadId}`);
    }
    return res;
  },
);

export const updateQuoteDetailsAction = protectedAction(
  { name: "quotes.update_details", schema: quoteDetailsSchema, permission: "quotes:write" },
  async (input, { user }) => {
    await updateQuoteDetails(user, input);
    revalidateQuote(input.quoteId);
    return { ok: true as const };
  },
);

export const previewQuotePricingAction = protectedAction(
  { name: "quotes.preview_pricing", schema: quotePricingSchema, permission: "quotes:write" },
  async (input, { user }) => previewQuotePricing(user, input),
);

export const saveQuotePricingAction = protectedAction(
  { name: "quotes.save_pricing", schema: quotePricingSchema, permission: "quotes:write" },
  async (input, { user }) => {
    const res = await saveQuotePricing(user, input);
    revalidateQuote(input.quoteId);
    return res;
  },
);

export const buildCatalogLineAction = protectedAction(
  { name: "quotes.catalog_line", schema: catalogLineRequestSchema, permission: "quotes:write" },
  async (input) => buildCatalogLine(input),
);

export const sendQuoteAction = protectedAction(
  { name: "quotes.send", schema: quoteIdSchema, permission: "quotes:send" },
  async ({ quoteId }, { user }) => {
    const res = await sendQuote(user, quoteId);
    revalidateQuote(quoteId);
    revalidatePath("/admin/leads");
    return res;
  },
);

export const markQuoteExpiredAction = protectedAction(
  { name: "quotes.mark_expired", schema: quoteIdSchema, permission: "quotes:write" },
  async ({ quoteId }, { user }) => {
    await markQuoteExpired(user, quoteId);
    revalidateQuote(quoteId);
    return { ok: true as const };
  },
);

export const duplicateQuoteAction = protectedAction(
  { name: "quotes.duplicate", schema: quoteIdSchema, permission: "quotes:write" },
  async ({ quoteId }, { user }) => {
    const res = await duplicateQuote(user, quoteId);
    revalidateQuote();
    return res;
  },
);

export const createNewVersionAction = protectedAction(
  { name: "quotes.new_version", schema: quoteIdSchema, permission: "quotes:write" },
  async ({ quoteId }, { user }) => {
    const res = await createNewVersion(user, quoteId);
    revalidateQuote(quoteId);
    return res;
  },
);

