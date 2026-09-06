import type { Request, Response } from "express";
import { customerSessionService } from "../services/customerSession.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createCustomerSessionSchema } from "../validators/public.validators.js";

export const createSession = asyncHandler(async (req: Request, res: Response) => {
  const { qrToken } = createCustomerSessionSchema.parse(req.body);
  const session = await customerSessionService.createSession(qrToken);
  sendSuccess(res, session, 201);
});
