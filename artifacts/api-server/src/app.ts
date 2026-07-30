import path from "path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
// OpenAPI maps updates to PATCH, but backend routes universally use PUT
app.use((req, res, next) => {
  if (req.method === 'PATCH') {
    req.method = 'PUT';
  }
  next();
});

import { tenantContext } from "@workspace/db";
app.use((req, res, next) => {
  const authHeader = req.headers["authorization"];
  let businessId: number | null = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const jwt = require("jsonwebtoken");
      const JWT_SECRET = process.env["SESSION_SECRET"] || "dev-secret-fallback";
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
      businessId = payload.businessId || null;
    } catch (e) {}
  }
  tenantContext.run(businessId, next);
});

app.use("/api", router);

// Serve built React frontend in production
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.join(process.cwd(), "artifacts/accounting-app/dist/public");
  app.use(express.static(frontendDist));

  // SPA fallback — serve index.html for any non-API route
  app.use((_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
