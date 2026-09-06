import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const createMenuItemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  taxPercentage: z.number().min(0).max(100).optional(),
});

export const updateMenuItemSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  taxPercentage: z.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
});

export const setAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const listMenuItemsQuerySchema = z.object({
  categoryId: z.string().optional(),
});

export const branchIdParamSchema = z.object({
  branchId: z.string().min(1),
});
