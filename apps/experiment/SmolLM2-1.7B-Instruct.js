import { pipeline } from "@huggingface/transformers";
import chalk from "chalk";
import inquirer from "inquirer";

console.log(chalk.blue.bold("🤖 SmolLM2 Model Selector"));
console.log(chalk.gray("Choose your preferred SmolLM2 model for text generation\n"));

const listOfModels = [
  {
    name: chalk.green("SmolLM2-135M-Instruct") + chalk.gray(" (Smallest, fastest)"),
    value: "HuggingFaceTB/SmolLM2-135M-Instruct",
    short: "135M"
  },
  {
    name: chalk.yellow("SmolLM2-360M-Instruct") + chalk.gray(" (Medium size, balanced)"),
    value: "HuggingFaceTB/SmolLM2-360M-Instruct",
    short: "360M"
  },
  {
    name: chalk.red("SmolLM2-1.7B-Instruct") + chalk.gray(" (Largest, best quality)"),
    value: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
    short: "1.7B"
  }
];

// Prompt user to select a model
const { selectedModel } = await inquirer.prompt([
  {
    type: "list",
    name: "selectedModel",
    message: chalk.cyan("Select a SmolLM2 model:"),
    choices: listOfModels,
    pageSize: 3,
  },
]);

console.log(chalk.magenta(`\n📦 Selected: ${selectedModel.split('/')[1]}`));
console.log(chalk.blue("⏬ Checking and downloading model weights if needed..."));

let generator;
try {
  generator = await pipeline(
    "text-generation",
    selectedModel,
    {
      cache_dir: "./.cache",
      progress_callback: (progress) => {
        console.log(progress);
      },
    }
  );
  console.log(chalk.green.bold("\n🎉 Model loaded successfully!"));
} catch (e) {
  console.error(chalk.red.bold("\n❌ Failed to load model:"), e);
  process.exit(1);
}

// Define the list of messages
const messages = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Tell me a joke." },
];

console.log(chalk.cyan("\n🤔 Generating response..."));

// Generate a response
const output = await generator(messages, { max_new_tokens: 128 });
console.log(chalk.green.bold("\n🤖 Response:"));
console.log(chalk.white(output[0].generated_text.at(-1).content));

console.log(chalk.gray("\n✨ Generation complete!"));
