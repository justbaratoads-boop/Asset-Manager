import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import partiesRouter from "./parties";
import ledgersRouter from "./ledgers";
import stockRouter from "./stock";
import saleInvoicesRouter from "./sale-invoices";
import ordersRouter from "./orders";
import purchaseRouter from "./purchase";
import accountingRouter from "./accounting";
import reportsRouter from "./reports";
import gstRouter from "./gst";
import deliveryRouter from "./delivery";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(partiesRouter);
router.use(ledgersRouter);
router.use(stockRouter);
router.use(saleInvoicesRouter);
router.use(ordersRouter);
router.use(purchaseRouter);
router.use(accountingRouter);
router.use(reportsRouter);
router.use(gstRouter);
router.use(deliveryRouter);
router.use(usersRouter);

export default router;
