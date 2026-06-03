import * as fs from "fs";
import * as path from "path";
import { RunResponseSchema } from "../src/validator";

function checkResponse() {
  try {
    const filePath = path.resolve(process.cwd(), "examples/response.json");
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found at ${filePath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const json = JSON.parse(content);

    const validation = RunResponseSchema.safeParse(json);
    if (!validation.success) {
      console.error("Validation Failed! Here are the errors:");
      console.error(JSON.stringify(validation.error.format(), null, 2));
      process.exit(1);
    }

    console.log("Validation Succeeded! examples/response.json matches RunResponseSchema.");
    process.exit(0);
  } catch (error: any) {
    console.error("An error occurred during check execution:", error.message || error);
    process.exit(1);
  }
}

checkResponse();
