import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { PORT, GOOGLE_SHEET_ID } from "./config/env.js";
import surveyRoutes from "./routes/surveyRoutes.js";
import mapRoutes from "./routes/mapRoutes.js";
import { startSurveyPolling } from "./realtime/surveyPolling.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", surveyRoutes);
app.use("/api/map", mapRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("Socket client connected:", socket.id);
});

if (GOOGLE_SHEET_ID) {
  startSurveyPolling(io, GOOGLE_SHEET_ID);
}

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
