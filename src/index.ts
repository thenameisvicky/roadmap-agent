import express from "express";
import * as path from "path";
import { roadmapRouter } from "./route";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use("/", roadmapRouter);

app.use(express.static(path.resolve(process.cwd())));

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

app.listen(port, () => {
  console.log(`Roadmap Copilot Agent running on port ${port}`);
});

export default app;
