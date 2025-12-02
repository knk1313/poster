import "dotenv/config";

function main() {
  console.log("yahoo-news-x-bot started");

  const xKey = process.env.X_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  console.log("X_API_KEY exists:", !!xKey);
  console.log("OPENAI_API_KEY exists:", !!openaiKey);
}

main();
