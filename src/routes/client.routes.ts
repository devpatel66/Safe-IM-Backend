import { Router } from "express";
import { clientController } from "../controllers/client.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { can } from "../middlewares/authorize";
import { createClientSchema, updateClientSchema } from "../validators/client.validator";

const router = Router();

// Read — admin, staff, viewer can all see clients
router.get("/",    ...can("clients:read"), asyncHandler(clientController.list));
router.get("/:id", ...can("clients:read"), asyncHandler(clientController.getById));

// Write — admin only (manage = create + update + delete)
router.post(  "/",    ...can("clients:manage"), validate(createClientSchema), asyncHandler(clientController.create));
router.put(   "/:id", ...can("clients:manage"), validate(updateClientSchema), asyncHandler(clientController.update));
router.delete("/:id", ...can("clients:manage"), asyncHandler(clientController.delete));

export default router;