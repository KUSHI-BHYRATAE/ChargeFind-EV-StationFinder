import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stationsRouter from "./stations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stationsRouter);

export default router;
