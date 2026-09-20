import { branchRepository } from "../repositories/branch.repository.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { tenantLimitsService } from "./tenantLimits.service.js";
import { ApiError } from "../utils/ApiError.js";
import type { z } from "zod";
import type { updateBranchSchema } from "../validators/branch.validators.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };
type BranchUpdate = z.infer<typeof updateBranchSchema>;

export const branchService = {
  listForTenant(tenantId: string) {
    return branchRepository.listForTenant(tenantId);
  },

  async create(tenantId: string, input: { name: string; slug: string } & Record<string, unknown>, actor: Actor) {
    const [existingBySlug, count, maxBranches] = await Promise.all([
      branchRepository.findBySlug(tenantId, input.slug),
      branchRepository.countForTenant(tenantId),
      tenantLimitsService.resolveMaxBranches(tenantId),
    ]);
    if (existingBySlug) {
      throw ApiError.conflict("BRANCH_SLUG_TAKEN", `Slug "${input.slug}" is already in use.`);
    }
    // §47: plan default, unless Platform Admin has set a per-tenant override (§7A.2).
    if (count >= maxBranches) {
      throw ApiError.forbidden("BRANCH_LIMIT_REACHED", "This tenant has reached its branch limit.");
    }

    const branch = await branchRepository.create(tenantId, input);

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "BRANCH_CREATED",
      entityType: "Branch",
      entityId: branch._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return branch;
  },

  async update(tenantId: string, branchId: string, updates: BranchUpdate, actor: Actor) {
    const branch = await branchRepository.findById(tenantId, branchId);
    if (!branch) throw ApiError.notFound("BRANCH_NOT_FOUND", "Branch not found.");

    if (updates.name !== undefined) branch.name = updates.name;
    if (updates.timezone !== undefined) branch.timezone = updates.timezone;
    if (updates.address) Object.assign(branch.address ?? {}, updates.address);
    if (updates.contact) Object.assign(branch.contact ?? {}, updates.contact);

    if (updates.settings?.tax) {
      const current = branch.settings?.tax ?? { enabled: false, percentage: 0 };
      branch.settings = {
        ...branch.settings,
        tax: { ...current, ...updates.settings.tax },
      };
    }
    if (updates.settings?.serviceCharge) {
      const current = branch.settings?.serviceCharge ?? { enabled: false, percentage: 0 };
      branch.settings = {
        ...branch.settings,
        serviceCharge: { ...current, ...updates.settings.serviceCharge },
      };
    }
    if (updates.settings?.payment) {
      // {} not { allowPayLater: false, ... } — payment now has more than one independent
      // field (§23A.5's posCardEnabled), and a fallback that pins unrelated fields to a
      // concrete value would turn "override just posCardEnabled" into an unintended,
      // silent override of allowPayLater too (and vice versa) the first time either is set.
      const current = branch.settings?.payment ?? {};
      branch.settings = {
        ...branch.settings,
        payment: { ...current, ...updates.settings.payment },
      };
    }
    if (updates.settings?.ordering) {
      // Same independent-fields rule as payment above.
      const current = branch.settings?.ordering ?? {};
      branch.settings = {
        ...branch.settings,
        ordering: { ...current, ...updates.settings.ordering },
      };
    }
    await branch.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "BRANCH_UPDATED",
      entityType: "Branch",
      entityId: branch._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return branch;
  },

  async deactivate(tenantId: string, branchId: string, actor: Actor) {
    const branch = await branchRepository.findById(tenantId, branchId);
    if (!branch) throw ApiError.notFound("BRANCH_NOT_FOUND", "Branch not found.");
    if (branch.isDefault) {
      throw ApiError.badRequest("CANNOT_DEACTIVATE_DEFAULT_BRANCH", "The default branch cannot be deactivated.");
    }

    branch.status = "INACTIVE";
    await branch.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "BRANCH_DEACTIVATED",
      entityType: "Branch",
      entityId: branch._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return branch;
  },
};
