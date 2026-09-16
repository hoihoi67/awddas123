require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ContainerBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const config = require("./config.json");

const dataPath = path.join(__dirname, "cennik-data.json");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot działa jako ${readyClient.user.tag}.`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  const command = message.content.trim().toLowerCase().split(/\s+/)[0];
  if (!["!cennik", "!admin-panel", "!hwdp67"].includes(command)) return;

  if (command === "!hwdp67") {
    if (!message.channel.isTextBased() || !message.channel.messages?.bulkDelete) {
      await message.reply("Tej komendy można użyć tylko na kanale tekstowym.");
      return;
    }
    if (!message.guild.members.me.permissionsIn(message.channel).has(PermissionFlagsBits.ManageMessages)) {
      await message.reply("Bot nie ma uprawnienia **Zarządzanie wiadomościami** na tym kanale.");
      return;
    }

    try {
      await message.channel.bulkDelete(5, true);
    } catch (error) {
      console.error("Błąd usuwania wiadomości:", error);
      await message.reply("Nie udało się usunąć ostatnich wiadomości.");
    }
    return;
  }

  if (
    command === "!admin-panel" &&
    !message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    await message.reply("Tylko administrator może używać tej komendy.");
    return;
  }

  try {
    if (command === "!admin-panel") {
      await sendAdminPanelToChannel(message.channel);
    } else {
      await sendPanel(message.channel);
      await message.reply("");
    }
  } catch (error) {
    console.error("Błąd obsługi komendy tekstowej:", error);
    await message.reply("");
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "cennik") {
      await handleCennikCommand(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("cennik_admin_")) {
      await handleAdminButton(interaction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("cennik_admin_modal:")) {
      await handleAdminModal(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "cennik_select_category") {
      await showCategory(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("cennik_admin_select:")) {
      await handleAdminSelect(interaction);
    }
  } catch (error) {
    console.error("Błąd obsługi interakcji:", error);
    const response = { content: "", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(response);
    else await interaction.reply(response);
  }
});

async function handleCennikCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "admin-panel") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Tylko administrator może otworzyć panel.", ephemeral: true });
      return;
    }
    await sendAdminPanel(interaction);
    return;
  }

  if (subcommand === "panel") {
    await sendPanel(interaction.channel);
    await interaction.reply({ content: "", ephemeral: true });
    return;
  }

}

async function sendAdminPanel(interaction) {
  await interaction.reply({
    components: [createAdminPanel()],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function sendAdminPanelToChannel(channel) {
  await channel.send({
    components: [createAdminPanel()],
    flags: MessageFlags.IsComponentsV2,
  });
}

function createAdminPanel() {
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("cennik_admin_add").setLabel("Dodaj kategorię").setEmoji("💰").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("cennik_admin_edit").setLabel("Edytuj kategorię").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("cennik_admin_delete").setLabel("Usuń kategorię").setEmoji("🗑️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("cennik_admin_preview").setLabel("Podgląd").setEmoji("👁️").setStyle(ButtonStyle.Secondary),
  );
  return new ContainerBuilder()
    .setAccentColor(config.panelColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        "``` � ・ Sujek World × PANEL ADMINA```",
        "",
        "💰 ・ **Zarządzaj kategoriami cennika** za pomocą przycisków poniżej.",
        "✏️ ・ Możesz dodawać nowe produkty, edytować istniejące, usuwać je i sprawdzać podgląd.",
        "",
        "🖱️ ・ Wybierz interesującą Cię opcję.",
      ].join("\n")),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(buttons)
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("�© 2026 Sujek World × Panel Administratora"),
    );
}

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

async function handleAdminButton(interaction) {
  const action = interaction.customId.replace("cennik_admin_", "");
  if (action === "add") {
    await interaction.showModal(categoryModal("add", null, "Dodaj kategorię"));
    return;
  }
  if (!Object.keys(readData().categories).length) {
    await interaction.reply({ content: "Brak kategorii w cenniku.", ephemeral: true });
    return;
  }
  const select = new StringSelectMenuBuilder()
    .setCustomId(`cennik_admin_select:${action}`)
    .setPlaceholder("Wybierz kategorię")
    .addOptions(Object.values(readData().categories).slice(0, 25).map((item) => ({
      label: item.label.slice(0, 100),
      description: (item.description || item.title || "Kategoria cennika").slice(0, 100),
      value: item.key,
    })));
  await interaction.reply({
    content: action === "delete" ? "Wybierz kategorię do usunięcia." : "Wybierz kategorię.",
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true,
  });
}

function categoryModal(action, item, title) {
  const modal = new ModalBuilder()
    .setCustomId(`cennik_admin_modal:${action}${item ? `:${item.key}` : ""}`)
    .setTitle(title);
  const fields = [
    ["nazwa", "Nazwa w menu", item?.label || "", true],
    ["tytul", "Tytuł cennika", item?.title || "", true],
    ["opis", "Opis kategorii", item?.description || "", false],
    ["emoji", "Emoji", item?.emoji || "💰", false],
    ["content", "Treść cennika", item?.content || "", true],
  ];
  modal.addComponents(fields.map(([id, label, value, required]) =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(id === "content" ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setValue(value.slice(0, 4000))
        .setRequired(required),
    ),
  ));
  return modal;
}

async function handleAdminSelect(interaction) {
  const [action] = interaction.customId.split(":").slice(1);
  const key = interaction.values[0];
  const item = readData().categories[key];
  if (!item) return interaction.update({ content: "Nie znaleziono kategorii.", components: [] });
  if (action === "edit") {
    await interaction.showModal(categoryModal("edit", item, "Edytuj kategorię"));
    return;
  }
  if (action === "preview") {
    await interaction.deferUpdate();
    await interaction.followUp({
      components: [categoryPanel(item)],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
    return;
  }
  const data = readData();
  delete data.categories[key];
  writeData(data);
  await refreshPanels(interaction.guildId);
  await interaction.update({ content: `Usunięto kategorię \`${key}\`.`, components: [] });
}

async function handleAdminModal(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const key = action === "edit" ? parts[2] : normalizeKey(interaction.fields.getTextInputValue("nazwa"));
  const data = readData();
  if (action === "add" && data.categories[key]) {
    await interaction.reply({ content: `Kategoria \`${key}\` już istnieje.`, ephemeral: true });
    return;
  }
  if (action === "edit" && !data.categories[key]) {
    await interaction.reply({ content: "Nie znaleziono kategorii.", ephemeral: true });
    return;
  }
  const item = data.categories[key] || { key };
  item.label = interaction.fields.getTextInputValue("nazwa").trim();
  item.title = interaction.fields.getTextInputValue("tytul").trim();
  item.description = interaction.fields.getTextInputValue("opis").trim();
  item.emoji = interaction.fields.getTextInputValue("emoji").trim() || "💰";
  item.content = interaction.fields.getTextInputValue("content").trim();
  data.categories[key] = item;
  writeData(data);
  await refreshPanels(interaction.guildId);
  await interaction.reply({
    components: [categoryPanel(
      item,
      action === "add" ? `Dodano kategorię \`${key}\`.` : `Zaktualizowano kategorię \`${key}\`.`,
    )],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

async function sendPanel(channel) {
  const message = await channel.send({
    components: [buildPanel()],
    flags: MessageFlags.IsComponentsV2,
  });
  const data = readData();
  data.panels = data.panels.filter((panel) => panel.messageId !== message.id);
  data.panels.push({
    guildId: channel.guildId,
    channelId: channel.id,
    messageId: message.id,
  });
  writeData(data);
}

function buildPanel() {
  const categories = Object.values(readData().categories);
  const menu = new StringSelectMenuBuilder()
    .setCustomId("cennik_select_category")
    .setPlaceholder("Wybierz interesującą Cię kategorię");

  if (categories.length) {
    menu.addOptions(categories.slice(0, 25).map((item) => ({
      label: item.label.slice(0, 100),
      description: (item.description || "Kliknij, aby zobaczyć cennik.").slice(0, 100),
      emoji: toSelectEmoji(item.emoji),
      value: item.key,
    })));
  } else {
    menu.setDisabled(true).addOptions({ label: "Brak kategorii", value: "empty" });
  }

  return new ContainerBuilder()
      .setAccentColor(config.panelColor)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent([
          "``` 🐱 ・ Sujek World × PRODUKTY```",
          "",
          "💰 ・ Szukasz **tanich produktów**? U nas znajdziesz wszystko w najlepszych cenach!",
          "",
          "🖱️ ・ **Wybierz kategorię** produktu, która Cię interesuje.",
        ].join("\n")),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addActionRowComponents(new ActionRowBuilder().addComponents(menu))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("🐱© 2026 Sujek World × Oferta"),
      );
}

async function refreshPanels(guildId) {
  const data = readData();
  const panels = data.panels.filter((panel) => panel.guildId === guildId);
  const staleIds = new Set();

  for (const panel of panels) {
    try {
      const channel = await client.channels.fetch(panel.channelId);
      const message = await channel.messages.fetch(panel.messageId);
      await message.edit({
        components: [buildPanel()],
      });
    } catch (error) {
      staleIds.add(panel.messageId);
      console.error(`Nie udało się odświeżyć panelu ${panel.messageId}:`, error.message);
    }
  }

  if (staleIds.size) {
    data.panels = data.panels.filter((panel) => !staleIds.has(panel.messageId));
    writeData(data);
  }
}

async function addCategory(interaction) {
  const key = normalizeKey(interaction.options.getString("klucz"));
  const data = readData();
  if (!key) return interaction.reply({ content: "Niepoprawny klucz kategorii.", ephemeral: true });
  if (data.categories[key]) return interaction.reply({ content: `Kategoria \`${key}\` już istnieje.`, ephemeral: true });

  await interaction.reply({ content: "Wyślij teraz treść cennika na ten kanał. Masz 120 sekund.", ephemeral: true });
  const content = await collectContent(interaction);
  if (content === null) return;

  data.categories[key] = {
    key,
    label: interaction.options.getString("nazwa").trim(),
    title: interaction.options.getString("tytul").trim(),
    description: interaction.options.getString("opis")?.trim() || "",
    emoji: interaction.options.getString("emoji")?.trim() || "💰",
    content,
  };
  writeData(data);
  await refreshPanels(interaction.guildId);
  await interaction.followUp({
    components: [categoryPanel(data.categories[key], "Dodano kategorię.")],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

async function editCategory(interaction) {
  const key = normalizeKey(interaction.options.getString("klucz"));
  const data = readData();
  const item = data.categories[key];
  if (!item) return interaction.reply({ content: `Nie znaleziono kategorii \`${key}\`.`, ephemeral: true });

  for (const [option, field] of [["tytul", "title"], ["nazwa", "label"], ["opis", "description"], ["emoji", "emoji"]]) {
    const value = interaction.options.getString(option);
    if (value !== null) item[field] = value.trim();
  }

  await interaction.reply({ content: "Wyślij nową treść cennika albo wpisz `pomijam`, aby zachować starą. Masz 120 sekund.", ephemeral: true });
  const content = await collectContent(interaction, true);
  if (content === null) return;
  if (content.toLowerCase() !== "pomijam") item.content = content;
  writeData(data);
  await refreshPanels(interaction.guildId);
  await interaction.followUp({
    components: [categoryPanel(item, "Zaktualizowano kategorię.")],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

async function previewCategory(interaction) {
  const key = normalizeKey(interaction.options.getString("klucz"));
  const item = readData().categories[key];
  if (!item) return interaction.reply({ content: `Nie znaleziono kategorii \`${key}\`.`, ephemeral: true });
  await interaction.reply({
    components: [categoryPanel(item)],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

async function deleteCategory(interaction) {
  const key = normalizeKey(interaction.options.getString("klucz"));
  const data = readData();
  if (!data.categories[key]) return interaction.reply({ content: `Nie znaleziono kategorii \`${key}\`.`, ephemeral: true });
  delete data.categories[key];
  writeData(data);
  await interaction.reply({ content: `Usunięto kategorię \`${key}\`.`, ephemeral: true });
}

async function listCategories(interaction) {
  const categories = Object.values(readData().categories);
  const content = categories.length
    ? categories.map((item, index) => `${index + 1}. \`${item.key}\` - **${item.label}** ${item.emoji || ""}`).join("\n")
    : "Brak kategorii w cenniku.";
  await interaction.reply({ content: content.slice(0, 1900), ephemeral: true });
}

async function showCategory(interaction) {
  const item = readData().categories[interaction.values[0]];
  if (!item) return interaction.reply({ content: "Nie znaleziono wybranej kategorii.", ephemeral: true });
  await interaction.reply({
    components: [categoryPanel(item)],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

function categoryPanel(item, header = "") {
  return new ContainerBuilder()
    .setAccentColor(config.panelColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        header,
        header ? "" : null,
        `\`\`\` ${config.brandName} × ${item.title || item.label}\`\`\``,
        "",
        (item.content || "Brak treści cennika.").slice(0, 3500),
        "",
        "> 💰 ・ Chcesz dokonać zakupu? Skontaktuj się z administracją.",
      ].filter((line) => line !== null).join("\n")),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("�© 2026 Sujek World × Oferta"),
    );
}

function toSelectEmoji(value) {
  const text = String(value || "").trim();
  const customEmoji = text.match(/^<(?<animated>a)?:(?<name>[A-Za-z0-9_]+):(?<id>\d+)>$/);
  if (!customEmoji && /[A-Za-z0-9_<>:]/.test(text)) return "💰";
  if (!customEmoji) return text || "💰";
  return {
    name: customEmoji.groups.name,
    id: customEmoji.groups.id,
    animated: Boolean(customEmoji.groups.animated),
  };
}

function collectContent(interaction, allowSkip = false) {
  return new Promise((resolve) => {
    const collector = interaction.channel.createMessageCollector({
      filter: (message) => message.author.id === interaction.user.id,
      time: 120000,
      max: 1,
    });
    collector.on("collect", async (message) => {
      const content = message.content.trim();
      await message.delete().catch(() => {});
      if (!content && !allowSkip) {
        await interaction.followUp({ content: "Treść cennika nie może być pusta.", ephemeral: true });
        resolve(null);
        return;
      }
      resolve(content);
    });
    collector.on("end", (collected, reason) => {
      if (reason === "time" && collected.size === 0) {
        interaction.followUp({ content: "Czas minął. Operacja anulowana.", ephemeral: true }).catch(() => {});
        resolve(null);
      }
    });
  });
}

function normalizeKey(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, 80);
}

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    return {
      categories: data.categories && typeof data.categories === "object" ? data.categories : {},
      panels: Array.isArray(data.panels) ? data.panels : [],
    };
  } catch (error) {
    console.error("Nie udało się odczytać cennik-data.json:", error);
    return { categories: {}, panels: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
}

if (!process.env.DISCORD_TOKEN) {
  throw new Error("Uzupełnij DISCORD_TOKEN w pliku .env.");
}
client.login(process.env.DISCORD_TOKEN);
