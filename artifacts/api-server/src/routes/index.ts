import { Router, type IRouter } from "express";
import healthRouter from "./health";
import phoneRouter from "./phone";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(phoneRouter);
router.use(adminRouter);

export default router;
