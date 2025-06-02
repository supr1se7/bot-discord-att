const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const estoquePath = path.resolve(__dirname, "../estoque.json");

function lerEstoque() {
  if (!fs.existsSync(estoquePath))
    fs.writeFileSync(estoquePath, JSON.stringify({}, null, 2));
  return JSON.parse(fs.readFileSync(estoquePath, "utf-8"));
}

function salvarEstoque(estoque) {
  fs.writeFileSync(estoquePath, JSON.stringify(estoque, null, 2));
}

function criarBotoesPainel() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("adicionar")
      .setLabel("➕ Adicionar")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("remover")
      .setLabel("➖ Remover")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("remover_tudo")
      .setLabel("🔥 Remover Tudo")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("atualizar")
      .setLabel("🔄 Atualizar")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("fechar")
      .setLabel("❌ Fechar")
      .setStyle(ButtonStyle.Secondary)
  );
}

function sanitizeCartaoInput(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 10)
    .join("\n");
}

function criarEmbedEstoque(estoque) {
  const embed = new EmbedBuilder()
    .setTitle("🗃️ Painel de Estoque")
    .setColor("#8a00ff");

  if (Object.keys(estoque).length === 0) {
    embed.setDescription("⚠️ O estoque está vazio.");
  } else {
    embed.setDescription("Confira as categorias e quantidades:");
    for (const cat in estoque) {
      embed.addFields({
        name: `💳 ${cat}`,
        value: `${estoque[cat].length} cartão(ões)`,
        inline: true,
      });
    }
  }
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("estoque")
    .setDescription("Painel para gerenciar estoque de cartões"),

  async execute(interaction) {
    const estoque = lerEstoque();
    await interaction.reply({
      embeds: [criarEmbedEstoque(estoque)],
      components: [criarBotoesPainel()],
      flags: 64, // ephemeral
    });
  },

  async handleButton(interaction) {
    if (
      ![
        "adicionar",
        "remover",
        "remover_tudo",
        "atualizar",
        "fechar",
      ].includes(interaction.customId)
    )
      return;

    // NÃO USE REPLY/DEFER ANTES DE SHOWMODAL NUNCA!
    if (interaction.customId === "adicionar") {
      const modal = new ModalBuilder()
        .setCustomId("modal_add")
        .setTitle("Adicionar Cartão");

      const categoriaInput = new TextInputBuilder()
        .setCustomId("categoria")
        .setLabel("Categoria")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: classic, platinum")
        .setRequired(true);

      const cartaoInput = new TextInputBuilder()
        .setCustomId("cartao")
        .setLabel("Cartão(s) (um por linha)")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          "Ex: 5214330719503783|10|2030|744|MASTERCARD|BANCO BTG PACTUAL SA|PLATINUM|"
        )
        .setRequired(true);

      const precoInput = new TextInputBuilder()
        .setCustomId("preco")
        .setLabel("Preço do Cartão (R$)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 40")
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(categoriaInput),
        new ActionRowBuilder().addComponents(cartaoInput),
        new ActionRowBuilder().addComponents(precoInput)
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === "remover") {
      const estoque = lerEstoque();
      if (Object.keys(estoque).length === 0) {
        return interaction.reply({
          content: "Não tem nada para remover.",
          flags: 64,
        });
      }

      const categorias = Object.keys(estoque);
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_categoria_remover")
        .setPlaceholder("Escolha a categoria para remover cartões")
        .addOptions(
          categorias.map((cat) => ({
            label: cat,
            description: `Tem ${estoque[cat].length} cartão(ões) nessa categoria`,
            value: cat,
          }))
        );

      return interaction.reply({
        content: "Selecione a categoria que deseja remover cartões:",
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        flags: 64,
      });
    }

    if (interaction.customId === "remover_tudo") {
      salvarEstoque({});
      return interaction.reply({
        content: "Estoque completamente limpo.",
        embeds: [],
        components: [],
        flags: 64,
      });
    }

    if (interaction.customId === "atualizar") {
      const estoque = lerEstoque();
      return interaction.reply({
        embeds: [criarEmbedEstoque(estoque)],
        components: [criarBotoesPainel()],
        flags: 64,
      });
    }

    if (interaction.customId === "fechar") {
      return interaction.reply({
        content: "Painel fechado.",
        embeds: [],
        components: [],
        flags: 64,
      });
    }
  },

  // CORRIGIDO: NUNCA USE REPLY/DEFER ANTES DE SHOWMODAL
  async handleSelectMenu(interaction) {
    if (interaction.customId !== "select_categoria_remover") return;

    // NUNCA reply/deferReply antes de showModal!
    const categoria = interaction.values[0];
    const estoqueAtual = lerEstoque();
    const cartoesDaCategoria = (estoqueAtual[categoria] || []).join("\n");

    const modal = new ModalBuilder()
      .setCustomId("modal_remover")
      .setTitle("Remover Cartões da categoria " + categoria);

    const categoriaInput = new TextInputBuilder()
      .setCustomId("categoria_remover")
      .setLabel("Categoria")
      .setStyle(TextInputStyle.Short)
      .setValue(categoria)
      .setRequired(true);

    const cartoesInput = new TextInputBuilder()
      .setCustomId("cartoes_remover")
      .setLabel("(remova os que quer excluir)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Remova as linhas dos cartões que deseja excluir")
      .setValue(cartoesDaCategoria)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(categoriaInput),
      new ActionRowBuilder().addComponents(cartoesInput)
    );

    return interaction.showModal(modal);
  },

  async handleModal(interaction) {
    try {
      if (interaction.customId === "modal_add") {
        const categoria = interaction.fields.getTextInputValue("categoria").trim();
        let cartoesRaw = interaction.fields.getTextInputValue("cartao").trim();
        const preco = interaction.fields.getTextInputValue("preco").trim();

        if (!categoria || !cartoesRaw || !preco) {
          return await interaction.reply({
            content: "Preencha todos os campos corretamente.",
            flags: 64,
          });
        }

        cartoesRaw = sanitizeCartaoInput(cartoesRaw);

        let estoque = lerEstoque();
        if (!estoque[categoria]) estoque[categoria] = [];

        const linhas = cartoesRaw
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 10);

        let adicionados = 0;
        for (const linha of linhas) {
          const partes = linha.split('|');
          let linhaFinal = linha;
          if (partes.length === 9) {
            linhaFinal = linha + "|" + preco;
          } else if (partes.length === 10) {
            // já tem preço, não faz nada
          } else {
            continue;
          }
          estoque[categoria].push(linhaFinal);
          adicionados++;
        }

        salvarEstoque(estoque);

        const totalCartoes = estoque[categoria].length;

        return await interaction.reply({
          content: `✅ ${adicionados} cartão(ões) adicionados na categoria **${categoria}** (total agora: ${totalCartoes}) com preço R$ ${preco}.`,
          flags: 64,
        });
      } else if (interaction.customId === "modal_remover") {
        const categoria = interaction.fields
          .getTextInputValue("categoria_remover")
          .trim();
        let cartoesRaw = interaction.fields
          .getTextInputValue("cartoes_remover")
          .trim();

        cartoesRaw = sanitizeCartaoInput(cartoesRaw);

        let estoque = lerEstoque();

        const novoArray = cartoesRaw.length === 0
          ? []
          : cartoesRaw
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.length > 10);

        if (novoArray.length === 0) {
          delete estoque[categoria];
        } else {
          estoque[categoria] = novoArray;
        }

        salvarEstoque(estoque);

        const totalCartoes = estoque[categoria] ? estoque[categoria].length : 0;

        return await interaction.reply({
          content: `✅ Estoque da categoria **${categoria}** atualizado com sucesso. Total agora: ${totalCartoes}`,
          flags: 64,
        });
      }
    } catch (e) {
      console.error("Erro no modal:", e);
      await interaction.reply({
        content: "Erro ao processar o modal.",
        flags: 64,
      });
    }
  },
};