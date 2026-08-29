import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import apiRouter from "./artifacts/api-server/src/routes";
import { setupSocketIO } from "./artifacts/api-server/src/socket";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socket.io",
  });

  setupSocketIO(io);

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API & Health routes
  app.get(["/health", "/healthz"], (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api", apiRouter);

  // Vite middleware in development vs static serving in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), "artifacts/voice-room/vite.config.ts"),
      root: path.resolve(process.cwd(), "artifacts/voice-room"),
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const voiceRoomDist = path.resolve(process.cwd(), "artifacts/voice-room/dist");
    const rootDist = path.resolve(process.cwd(), "dist");
    const distPath = fs.existsSync(path.join(voiceRoomDist, "index.html")) ? voiceRoomDist : rootDist;
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[GhostRoom] Server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    console.log("[GhostRoom] Gracefully shutting down...");
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
