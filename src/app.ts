import express from "express";
import type { Express, Request, Response } from "express";
import cors from "cors";

// middlewares
import { loggerMiddleware } from "./middlewares/logger.middleware";
import { notFoundMiddleware } from "./middlewares/notFound.middleware";
import { errorMiddleware } from "./middlewares/error.middleware";

// routes
import authRoutes from "./routes/auth.routes";
import clientRoutes from "./routes/client.routes";
import planRoutes from "./routes/plan.routes";
import invoiceRoutes from "./routes/invoice.routes";
import statementRoutes from "./routes/statement.routes";
import miscRoutes from "./routes/misc.routes";
import userRoutes from "./routes/user.route";

const app: Express = express()
const v1Router  = express.Router();

app.use(loggerMiddleware);
app.use(cors());
app.use(express.json());

v1Router.use("/invoices",invoiceRoutes);
v1Router.use("/auth",authRoutes);
v1Router.use("/clients", clientRoutes);
v1Router.use("/plans", planRoutes);
v1Router.use("/statements", statementRoutes);
v1Router.use("/users", userRoutes);
v1Router.use("", miscRoutes);

app.use("/api/v1",v1Router);

app.get("/",(req: Request,res: Response)=>{
    res.send("Api is running !!!!");
})

app.use(notFoundMiddleware)
app.use(errorMiddleware);

export default app