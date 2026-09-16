require("dotenv").config();

const { REST, Routes } = require("discord.js");

async function main() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error("Uzupełnij DISCORD_TOKEN, CLIENT_ID i GUILD_ID w pliku .env.");
  }

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [],
  });
  console.log("Usunięto stare komendy slash. Bot używa teraz !cennik i !admin-panel.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
