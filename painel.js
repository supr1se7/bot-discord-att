const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require("discord.js");
const {
  carregarEstoque,
  transformarEstoque,
  filtrarCartoes,
  mascararNumero,
  removerCartaoDoEstoque,
} = require("../functions/searchCard");
const { criarPagamento, verificarPagamento } = require("../services/novaera");
const config = require("../config.json");

const pesquisasPendentes = new Map();   // userId -> { resultados }
const pagamentosPendentes = new Map();  // userId -> { transactionId, ... }

async function darCargoComprador(interaction) {
  try {
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const role = config.cargoCompradorID;
    if (role && member && !member.roles.cache.has(role)) {
      await member.roles.add(role);
      await logAdmin(
        interaction,
        new EmbedBuilder()
          .setTitle("🎉 Cargo de comprador atribuído")
          .setDescription(`O usuário <@${interaction.user.id}> recebeu o cargo de comprador após compra.`)
          .setColor("#8a00ff")
          .setTimestamp()
      );
    }
  } catch (e) {
    console.error("Erro ao adicionar cargo:", e);
  }
}

async function logAdmin(interaction, embed) {
  try {
    const canalLogs = interaction.client.channels.cache.get(config.canalLogsPagamentoID || "1377777006728712334");
    if (canalLogs) await canalLogs.send({ embeds: [embed] });
  } catch (e) {
    console.error("Erro ao logar admin:", e);
  }
}

function criarTimeoutPagamento(interaction, tempoMaximo, onTimeout) {
  return setTimeout(() => {
    const pendente = pagamentosPendentes.get(interaction.user.id);
    if (pendente && !pendente.pago) {
      pagamentosPendentes.delete(interaction.user.id);
      onTimeout();
    }
  }, tempoMaximo);
}

function usuarioTemCompraPendente(userId) {
  const pendente = pagamentosPendentes.get(userId);
  return pendente && !pendente.pago && pendente.transactionId;
}

async function enviarPainel(interaction) {
  const embedComprar = new EmbedBuilder()
    .setTitle("‎Bem-vindo à Legacy CC's")
    .setDescription(
      `👏 | Pioneiros na venda direta de CC's exclusivos de alta qualidade, sem retestes.
💳 | Material de alta qualidade a preços acessíveis.
👨‍💻 | Cartões verificados no momento da compra.
👍 | Garantia de cartões live, com troca em até 10 minutos.

🎖 | Acompanhe diretamente nossas referências: <#1375627890556801109>
💬 | Caso necessite de alguma ajuda, abra ticket <#1375627890556801108>**`
    )
    .setColor("#8a00ff")
    .setImage(
      "https://media.discordapp.net/attachments/1376759989749813298/1378865998202933318/2025-06-01_18.38.00.jpg"
    )
    .setFooter({
      text: "ESTOQUE ATUALIZADO — COMPRE AGORA E GARANTA RESULTADOS",
    });

  const rowComprar = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("abrir_compras")
      .setLabel("🛒 Comprar Cartão")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("termos_troca")
      .setLabel("📜 Termos de Troca")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.channel.send({
    embeds: [embedComprar],
    components: [rowComprar],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Abre o painel de CC FULL")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await logAdmin(
      interaction,
      new EmbedBuilder()
        .setTitle("🔎 Painel aberto")
        .setDescription(`Usuário <@${interaction.user.id}> abriu o painel de compra no canal <#${interaction.channel.id}> (${interaction.channel.name})`)
        .setColor("#8a00ff")
        .setTimestamp()
    );

    await enviarPainel(interaction);

    await interaction.reply({
      content: "✅ Painel de compra enviado. Deixe fixo no canal para todos acessarem!",
      flags: 64, // ephemeral
    });
  },

  async handleButton(interaction) {
    if (interaction.customId === "abrir_compras") {
      const embedPesquisa = new EmbedBuilder()
        .setTitle("🔍 Comprar CC Unitária")
        .setDescription(
          `🏷 Tabela de Preços

AMEX - R$ 80
INFINITE - R$ 60
BLACK - R$ 60
BUSINESS - R$ 40
PLATINUM - R$ 40
GOLD - R$ 35
STANDARD - R$ 30
CLASSIC - R$ 25
`
        )
        .setColor("#8a00ff")
        .setThumbnail("https://media.discordapp.net/attachments/1376759989749813298/1378876103019597874/photo_2025-05-23_19.12.42.jpeg")
        .setFooter({
          text: "Selecione uma categoria para comprar CC.",
        });

      const menuPesquisa = new StringSelectMenuBuilder()
        .setCustomId("menu_painel")
        .setPlaceholder("Selecione um método de pesquisa")
        .addOptions([
          {
            label: "Pesquisar por BIN",
            value: "pesquisar_bin",
            emoji: "🔢"
          },
          {
            label: "Pesquisar por Banco",
            value: "pesquisar_banco",
            emoji: "🏦"
          },
          {
            label: "Pesquisar por Bandeira",
            value: "pesquisar_bandeira",
            emoji: "🇧🇷"
          },
          {
            label: "Pesquisar por Level",
            value: "pesquisar_level",
            emoji: "🥇"
          },
          {
            label: "Unitárias",
            value: "unitarias",
            emoji: "💳"
          }
        ]);

      const rowPesquisa = new ActionRowBuilder().addComponents(menuPesquisa);

      await interaction.reply({
        embeds: [embedPesquisa],
        components: [rowPesquisa],
        flags: 64, // ephemeral
      });
      return true;
    }

    if (interaction.customId === "termos_troca") {
      const embedTermos = new EmbedBuilder()
        .setTitle("📜 Termos de Troca & Garantia")
        .setDescription(
          `Você precisa enviar um vídeo mostrando:
• A data e hora no site da Magalu ou Tramontina;
• A tentativa de compra de um produto até R$150;
• Tudo isso dentro do prazo de 10 minutos após a liberação da info.

Importante:

Se o vídeo ou o contato não forem enviados dentro do prazo, não será feita a troca.

Compre apenas se estiver de acordo com essas condições. Caso contrário, por favor, não compre!

**💬 | Caso necessite de alguma ajuda, abra ticket <#1375627890556801108>**`
        )
        .setColor("#8a00ff");
      await interaction.reply({
        embeds: [embedTermos],
        flags: 64, // ephemeral
      });
      return true;
    }

    if (interaction.customId === "cancelar_compra") {
      const pendente = pagamentosPendentes.get(interaction.user.id);
      if (!pendente || pendente.pago === true) {
        await interaction.reply({ content: "Você não tem uma compra pendente para cancelar.", flags: 64 });
        return true;
      }

      clearTimeout(pendente.timeoutId);
      pagamentosPendentes.delete(interaction.user.id);

      // Apagar as mensagens do QR code e Pix
      try {
        if (pendente.qrMessageId && pendente.qrChannelId) {
          const channel = await interaction.client.channels.fetch(pendente.qrChannelId);
          if (channel) {
            const message = await channel.messages.fetch(pendente.qrMessageId).catch(() => null);
            if (message) await message.delete().catch(() => {});
          }
        }
        if (pendente.pixMessageId && pendente.pixChannelId && pendente.pixMessageId !== pendente.qrMessageId) {
          const channel = await interaction.client.channels.fetch(pendente.pixChannelId);
          if (channel) {
            const message = await channel.messages.fetch(pendente.pixMessageId).catch(() => null);
            if (message) await message.delete().catch(() => {});
          }
        }
      } catch (e) {
        console.error("Erro ao apagar mensagens de Pix:", e);
      }

      await logAdmin(
        interaction,
        new EmbedBuilder()
          .setTitle("🚫 COMPRA CANCELADA PELO USUÁRIO")
          .setDescription(`Usuário <@${interaction.user.id}> cancelou a compra antes do pagamento. Mensagens apagadas.`)
          .setColor("#f44336")
          .setTimestamp()
      );

      await interaction.reply({
        content: "Compra cancelada com sucesso! O QR Code e a chave Pix foram apagados. Agora você pode iniciar uma nova compra.",
        flags: 64,
      });
      return true;
    }
    return false;
  },

  async handleSelect(interaction) {
    // Só trata selects do painel!
    if (
      interaction.customId !== "menu_painel" &&
      interaction.customId !== "unitarias_categoria"
    ) {
      return false; // <- Importante: só trata os seus!
    }

    // Sempre deferReply para evitar erro "Unknown interaction"
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }

    if (interaction.customId === "menu_painel") {
      const escolha = interaction.values[0];

      if (escolha === "unitarias") {
        const rawEstoque = await carregarEstoque();
        const categorias = Object.keys(rawEstoque);

        const tabelaPrecos = `
🏷 Tabela de Preços

AMEX - R$ 80
INFINITE - R$ 60
BLACK - R$ 60
BUSINESS - R$ 40
PLATINUM - R$ 40
GOLD - R$ 35
STANDARD - R$ 30
CLASSIC - R$ 25

`;

        const embedUnitarias = new EmbedBuilder()
          .setTitle("💳 Comprar CC Unitária")
          .setDescription(tabelaPrecos)
          .setColor("#8a00ff")
          .setFooter({ text: "Selecione uma categoria para comprar CC." });

        const selectCategorias = new StringSelectMenuBuilder()
          .setCustomId("unitarias_categoria")
          .setPlaceholder("Selecione uma categoria")
          .addOptions(
            categorias.map(cat => ({
              label: cat.charAt(0).toUpperCase() + cat.slice(1),
              value: cat
            }))
          );

        const rowSelect = new ActionRowBuilder().addComponents(selectCategorias);

        await interaction.editReply({
          embeds: [embedUnitarias],
          components: [rowSelect],
        });

        return true;
      }

      // Modal de busca por BIN, Banco, Bandeira, Level
      const modal = new ModalBuilder()
        .setCustomId("modal_busca")
        .setTitle("🔍 Pesquisa Detalhada");

      let label = "Digite o valor para pesquisar";
      switch (escolha) {
        case "pesquisar_bin":
          label = "Digite o BIN (primeiros dígitos do cartão)";
          break;
        case "pesquisar_banco":
          label = "Digite o nome do banco";
          break;
        case "pesquisar_bandeira":
          label = "Digite a bandeira (Visa, Master, etc)";
          break;
        case "pesquisar_level":
          label = "Digite o level (Platinum, Black, etc)";
          break;
      }

      const input = new TextInputBuilder()
        .setCustomId("input_busca")
        .setLabel(label)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      pesquisasPendentes.set(interaction.user.id, { tipo: escolha });

      await interaction.showModal(modal);
      return true;
    }

    // Compra unitária por categoria
    if (interaction.customId === "unitarias_categoria") {
      if (usuarioTemCompraPendente(interaction.user.id)) {
        await logAdmin(
          interaction,
          new EmbedBuilder()
            .setTitle("⚠️ COMPRA BLOQUEADA (PIX PENDENTE)")
            .setDescription(`Usuário <@${interaction.user.id}> tentou iniciar nova compra mas já tem pagamento Pix pendente.`)
            .setColor("#ff9800")
            .setTimestamp()
        );
        await interaction.editReply({ content: "Você já possui uma compra pendente! Aguarde o pagamento ou o tempo expirar." });
        return true;
      }
      const categoria = interaction.values[0];
      const rawEstoque = await carregarEstoque();
      const cardsDaCategoria = rawEstoque[categoria] || [];
      if (!cardsDaCategoria.length) {
        await logAdmin(
          interaction,
          new EmbedBuilder()
            .setTitle("❌ ESTOQUE VAZIO")
            .setDescription(`Usuário <@${interaction.user.id}> tentou comprar da categoria "${categoria}", mas o estoque está vazio.`)
            .setColor("#f44336")
            .setTimestamp()
        );
        await interaction.editReply({ content: "Não há cartões disponíveis nessa categoria." });
        return true;
      }

      // Sorteia cartão e faz o parsing completo
      const sorteado = cardsDaCategoria[Math.floor(Math.random() * cardsDaCategoria.length)];
      const cardObj = transformarEstoque({ [categoria]: [sorteado] })[0];
      let valorPagamento = 4000;
      if (cardObj.preco && typeof cardObj.preco === "string" && cardObj.preco.match(/^\d+$/)) {
        valorPagamento = parseInt(cardObj.preco, 10) * 100;
      } else if (cardObj.preco && typeof cardObj.preco === "string" && cardObj.preco.startsWith("R$")) {
        valorPagamento = parseInt(cardObj.preco.replace(/[^\d]/g, ""), 10) * 100;
      }

      try {
        const pagamento = await criarPagamento(valorPagamento);

        const embedPagamento = new EmbedBuilder()
          .setTitle("💸 PAGAMENTO GERADO")
          .setDescription(
            `Valor: R$ ${(valorPagamento / 100).toFixed(2).replace(".", ",")}\n\nEscaneie o QR Code abaixo ou aguarde para copiar a chave Pix na próxima mensagem.`
          )
          .setImage(
            `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(pagamento.pixCopyPaste)}&size=200x200`
          )
          .setColor("#8a00ff")
          .setFooter({ text: "O pagamento expira em 5 minutos." });

        const cancelarButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("cancelar_compra")
            .setLabel("❌ Cancelar Compra")
            .setStyle(ButtonStyle.Danger)
        );

        // Mensagem do QR Code
        const qrMsg = await interaction.editReply({
          embeds: [embedPagamento],
          components: [cancelarButton],
        });

        // Mensagem Pix CopyPaste
        const pixMsg = await interaction.followUp({
          content: `${pagamento.pixCopyPaste}`,
          flags: 64,
        });

        const pendente = {
          transactionId: pagamento.id,
          cartao: cardObj,
          pix: { qrcode: pagamento.pixCopyPaste, secureUrl: pagamento.pixUrl },
          pago: false,
          timeoutId: null,
          qrMessageId: qrMsg.id,
          qrChannelId: qrMsg.channel.id,
          pixMessageId: pixMsg.id,
          pixChannelId: pixMsg.channel.id,
        };
        pagamentosPendentes.set(interaction.user.id, pendente);

        await logAdmin(interaction, new EmbedBuilder()
          .setTitle("🤑 PAGAMENTO GERADO")
          .setDescription(
            `Usuário <@${interaction.user.id}> gerou um pagamento Pix.\n` +
            `**Valor:** R$ ${(valorPagamento / 100).toFixed(2).replace(".", ",")}\n` +
            `**Cartão/categoria:** ${cardObj.numero || categoria}\n` +
            `ID Transação: ${pagamento.id}`
          )
          .setColor("#ffa500")
          .setTimestamp()
        );

        // Timeout: 5 minutos = 300.000 ms
        pendente.timeoutId = criarTimeoutPagamento(interaction, 300000, async () => {
          try {
            // Apagar mensagens ao expirar
            if (pendente.qrMessageId && pendente.qrChannelId) {
              const channel = await interaction.client.channels.fetch(pendente.qrChannelId);
              if (channel) {
                const message = await channel.messages.fetch(pendente.qrMessageId).catch(() => null);
                if (message) await message.delete().catch(() => {});
              }
            }
            if (pendente.pixMessageId && pendente.pixChannelId && pendente.pixMessageId !== pendente.qrMessageId) {
              const channel = await interaction.client.channels.fetch(pendente.pixChannelId);
              if (channel) {
                const message = await channel.messages.fetch(pendente.pixMessageId).catch(() => null);
                if (message) await message.delete().catch(() => {});
              }
            }
          } catch (e) {
            console.error("Erro ao apagar mensagens de Pix (timeout):", e);
          }
          await logAdmin(interaction, new EmbedBuilder()
            .setTitle("⏰ PAGAMENTO EXPIRADO")
            .setDescription(
              `O usuário <@${interaction.user.id}> NÃO confirmou o pagamento dentro do prazo.\n` +
                `**Valor:** R$ ${(valorPagamento / 100).toFixed(2).replace(".", ",")}\n` +
                `**Cartão/categoria:** ${cardObj.numero || categoria}`
            )
            .setColor("#8a00ff")
            .setTimestamp());
          try {
            await interaction.followUp({
              content: "❌ O pagamento não foi confirmado dentro do tempo. Por favor, tente novamente.",
              flags: 64,
            });
          } catch {}
        });

        let tempoPassado = 0;
        const intervalo = 10000;
        const tempoMaximo = 300000;
        const checarPagamento = async () => {
          const isPaid = await verificarPagamento(pagamento.id);
          if (isPaid) {
            pendente.pago = true;
            clearTimeout(pendente.timeoutId);
            removerCartaoDoEstoque(cardObj.numero);
            await interaction.followUp({
              content:
                `💳 **Pagamento confirmado! Aqui estão os detalhes completos do seu cartão:**\n\n` +
                `**Número:** \`${cardObj.numero}\`\n` +
                `**Validade:** \`${cardObj.mes}/${cardObj.ano}\`\n` +
                `**CVV:** \`${cardObj.cvv}\`\n` +
                `**Bandeira:** ${cardObj.bandeira}\n` +
                `**Banco:** ${cardObj.banco}\n` +
                `**Level:** ${cardObj.level}\n` +
                `**Nome:** ${cardObj.nome}\n` +
                `**CPF:** ${cardObj.cpf}\n` +
                (cardObj.preco ? `**Preço:** R$ ${cardObj.preco}\n` : '') +
                (cardObj.categoria ? `**Categoria:** ${cardObj.categoria}\n` : ''),
              flags: 64,
            });
            await logAdmin(interaction, new EmbedBuilder()
              .setTitle("✅ PAGAMENTO CONFIRMADO")
              .setDescription(
                `Usuário <@${interaction.user.id}> PAGOU e recebeu o cartão:\n` +
                `\`${cardObj.numero}\`/${cardObj.mes}/${cardObj.ano}|${cardObj.cvv}|${cardObj.bandeira}|${cardObj.banco}|${cardObj.level}|${cardObj.nome}|${cardObj.cpf}|${cardObj.preco}\n`
              )
              .setColor("#4caf50")
              .setTimestamp()
            );
            await darCargoComprador(interaction);
            pagamentosPendentes.delete(interaction.user.id);
          } else {
            tempoPassado += intervalo;
            if (tempoPassado < tempoMaximo && pagamentosPendentes.get(interaction.user.id)) {
              setTimeout(checarPagamento, intervalo);
            }
          }
        };
        setTimeout(checarPagamento, intervalo);

      } catch (err) {
        await logAdmin(
          interaction,
          new EmbedBuilder()
            .setTitle("❌ ERRO AO GERAR PAGAMENTO")
            .setDescription(`Usuário <@${interaction.user.id}> tentou comprar mas ocorreu erro: ${err.message || err}`)
            .setColor("#ff0000")
            .setTimestamp()
        );
        await interaction.editReply({
          content: "❌ Ocorreu um erro ao gerar o pagamento. Tente novamente mais tarde.",
        });
      }
      return true;
    }

    return false;
  },

  async handleModal(interaction) {
    if (!interaction.isModalSubmit()) return false;
    if (interaction.customId !== "modal_busca") return false;

    // Sempre deferReply para evitar erro "Unknown interaction"
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }

    try {
      const valorBusca = interaction.fields
        .getTextInputValue("input_busca")
        .trim();
      const pendentePesquisa = pesquisasPendentes.get(interaction.user.id);

      if (!pendentePesquisa || !pendentePesquisa.tipo) {
        await interaction.editReply({
          content: "Sessão expirada ou inválida.",
        });
        return true;
      }

      let campo;
      switch (pendentePesquisa.tipo) {
        case "pesquisar_bin":
          campo = "numero";
          break;
        case "pesquisar_banco":
          campo = "banco";
          break;
        case "pesquisar_bandeira":
          campo = "bandeira";
          break;
        case "pesquisar_level":
          campo = "level";
          break;
        default:
          await interaction.editReply({
            content: "Tipo de pesquisa inválido.",
          });
          return true;
      }

      const rawEstoque = await carregarEstoque();
      const estoque = transformarEstoque(rawEstoque);
      const resultados = filtrarCartoes(campo, valorBusca, estoque);

      pesquisasPendentes.set(interaction.user.id, { resultados });

      if (!resultados.length) {
        await logAdmin(
          interaction,
          new EmbedBuilder()
            .setTitle("🔍 Pesquisa sem resultados")
            .setDescription(`Usuário <@${interaction.user.id}> pesquisou por "${valorBusca}" em "${campo}" e não encontrou nenhum cartão.`)
            .setColor("#607d8b")
            .setTimestamp()
        );
        await interaction.editReply({
          content: "Nenhum cartão encontrado com esses parâmetros.",
        });
        return true;
      }

      const descricoes = resultados
        .map((cartao, i) => {
          return `\`${i}\` - **${mascararNumero(cartao.numero)}** - Banco: ${cartao.banco || "N/D"} - Bandeira: ${cartao.bandeira || "N/D"} - Level: ${cartao.level || "N/D"} - Preço: R$ ${(cartao.preco || "N/D")}`;
        })
        .slice(0, 20);

      const embedResultados = new EmbedBuilder()
        .setTitle("💳 RESULTADOS DA PESQUISA")
        .setDescription(descricoes.join("\n"))
        .setColor("#8a00ff")
        .setFooter({
          text: "Selecione o cartão que deseja comprar no menu abaixo.",
        });

      const selectCartoes = new StringSelectMenuBuilder()
        .setCustomId("selecionar_cartao")
        .setPlaceholder("Selecione um cartão")
        .addOptions(
          resultados.slice(0, 20).map((cartao, index) => ({
            label: mascararNumero(cartao.numero) || `Cartão ${index}`,
            description: `Banco: ${cartao.banco || "N/D"} | Bandeira: ${cartao.bandeira || "N/D"} | Preço: R$ ${(cartao.preco || "N/D")}`,
            value: index.toString(),
          })),
        );

      const rowSelect = new ActionRowBuilder().addComponents(selectCartoes);

      await interaction.editReply({
        embeds: [embedResultados],
        components: [rowSelect],
      });

      return true;
    } catch (err) {
      console.error("Erro no modal de busca:", err);
      await interaction.editReply({
        content: "Erro inesperado ao processar a busca.",
      });
      return true;
    }
  },
};