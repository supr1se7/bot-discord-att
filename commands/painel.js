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
          .setColor("#4caf50")
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

// Mostra o painel fixo para sempre no canal (não ephemeral, qualquer um pode interagir)
async function enviarPainel(interaction) {
  const embedComprar = new EmbedBuilder()
    .setTitle("CC FULL - FULL DADOS")
    .setDescription(
      `ENTREGA AUTOMÁTICA

Referências todos os dias. Qualidade e confiança são o lema.  
Material testado no ato da compra.

────────────────────────────
CLASSIC - R$ 25  
Garantia até R$ 300

STANDARD - R$ 30  
Garantia até R$ 400

GOLD - R$ 35  
Garantia até R$ 500

PLATINUM - R$ 40  
Garantia até R$ 650

ELO - R$ 40
Garantia até R$ 650

INFINITE - R$ 60  
Garantia até R$ 1.000

BLACK - R$ 60  
Garantia até R$ 1.000

AMEX - R$ 80
Garantia até R$ 2.000
────────────────────────────

Prazo de troca: 10 minutos após a compra.  
Garantimos live, Garantimos saldo.  
Todo material é testado no momento da entrega.

LEGACY STORE — compromisso com a excelência.`
    )
    .setColor("#8a00ff")
    .setImage(
      "https://cdn.discordapp.com/attachments/1376730692011950124/1377478182621413396/banner.png",
    )
    .setFooter({
      text: "ESTOQUE ATUALIZADO — COMPRE AGORA E GARANTA RESULTADOS",
    });

  const rowComprar = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("abrir_compras")
      .setLabel("🛒 Comprar Cartão")
      .setStyle(ButtonStyle.Success)
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
        .setColor("#00bcd4")
        .setTimestamp()
    );

    await enviarPainel(interaction);

    await interaction.reply({
      content: "✅ Painel de compra enviado. Deixe fixo no canal para todos acessarem!",
      ephemeral: true,
    });
  },

  // Botão principal do painel
  async handleButton(interaction) {
    if (interaction.customId === "abrir_compras") {
      // Abre o menu de pesquisa para o usuário (ephemeral)
      const embedPesquisa = new EmbedBuilder()
        .setTitle("🔍 PAINEL DE PESQUISA CC FULL")
        .setDescription(
          `✅ Pesquisar por BIN  
✅ Pesquisar por Banco  
✅ Pesquisar por Bandeira  
✅ Pesquisar por Level  
✅ Unitárias (compra uma CC aleatória por categoria)`
        )
        .setColor("#8a00ff")
        .setThumbnail("https://i.imgur.com/E8G1n6b.png")
        .setFooter({
          text: "Use com responsabilidade. Garantia conforme descrito acima.",
        });

      const menuPesquisa = new StringSelectMenuBuilder()
        .setCustomId("menu_painel")
        .setPlaceholder("Selecione um método de pesquisa")
        .addOptions([
          { label: "Pesquisar por BIN", value: "pesquisar_bin" },
          { label: "Pesquisar por Banco", value: "pesquisar_banco" },
          { label: "Pesquisar por Bandeira", value: "pesquisar_bandeira" },
          { label: "Pesquisar por Level", value: "pesquisar_level" },
          { label: "Unitárias", value: "unitarias" },
        ]);

      const rowPesquisa = new ActionRowBuilder().addComponents(menuPesquisa);

      await interaction.reply({
        embeds: [embedPesquisa],
        components: [rowPesquisa],
        ephemeral: true,
      });
      return true;
    }

    // O resto do fluxo mantém igual (cancelar compra, etc)
    if (interaction.customId === "cancelar_compra") {
      const pendente = pagamentosPendentes.get(interaction.user.id);
      if (!pendente || pendente.pago === true) {
        await interaction.reply({ content: "Você não tem uma compra pendente para cancelar.", ephemeral: true });
        return true;
      }

      clearTimeout(pendente.timeoutId);
      pagamentosPendentes.delete(interaction.user.id);

      await logAdmin(
        interaction,
        new EmbedBuilder()
          .setTitle("🚫 COMPRA CANCELADA PELO USUÁRIO")
          .setDescription(`Usuário <@${interaction.user.id}> cancelou a compra antes do pagamento.`)
          .setColor("#f44336")
          .setTimestamp()
      );

      await interaction.reply({
        content: "Compra cancelada com sucesso! Agora você pode iniciar uma nova compra.",
        ephemeral: true,
      });
      return true;
    }
    return false;
  },

  // Seleção do menu de pesquisa
  async handleSelect(interaction) {
    if (interaction.customId === "menu_painel") {
      const escolha = interaction.values[0];

      if (escolha === "unitarias") {
        const rawEstoque = await carregarEstoque();
        const categorias = Object.keys(rawEstoque);

        const tabelaPrecos = `
**Tabela de Preços Unitários**
CLASSIC - R$ 25
STANDARD - R$ 30
GOLD - R$ 35
PLATINUM - R$ 40
ELO - R$ 40
INFINITE - R$ 60
BLACK - R$ 60
AMEX - R$ 80
`;

        const embedUnitarias = new EmbedBuilder()
          .setTitle("💳 Cartões Unitários - Escolha a Categoria")
          .setDescription(tabelaPrecos)
          .setColor("#8a00ff")
          .setFooter({ text: "Selecione uma categoria para comprar 1 cartão aleatório." });

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

        await interaction.reply({
          embeds: [embedUnitarias],
          components: [rowSelect],
          ephemeral: true,
        });

        return true;
      }

      const modal = new ModalBuilder()
        .setCustomId("modal_busca")
        .setTitle("🔍 Pesquisa Detalhada");

      const input = new TextInputBuilder()
        .setCustomId("input_busca")
        .setLabel("Digite o valor para pesquisar")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      pesquisasPendentes.set(interaction.user.id, { tipo: escolha });

      await interaction.showModal(modal);
      return true;
    }

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
        await interaction.reply({ content: "Você já possui uma compra pendente! Aguarde o pagamento ou o tempo expirar.", ephemeral: true });
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
        await interaction.reply({ content: "Não há cartões disponíveis nessa categoria.", ephemeral: true });
        return true;
      }

      const sorteado = cardsDaCategoria[Math.floor(Math.random() * cardsDaCategoria.length)];
      const cardObj = transformarEstoque({ [categoria]: [sorteado] })[0];
      const valorPagamento = cardObj.preco ? Math.round(cardObj.preco * 100) : 4000;

      try {
        const pagamento = await criarPagamento(valorPagamento);

        const pendente = {
          transactionId: pagamento.id,
          cartao: cardObj,
          pix: { qrcode: pagamento.pixCopyPaste, secureUrl: pagamento.pixUrl },
          pago: false
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

        const embedPagamento = new EmbedBuilder()
          .setTitle("💸 PAGAMENTO GERADO")
          .setDescription(
            `✅ **CHAVE PIX:**\n\`\`\`${pagamento.pixCopyPaste}\`\`\`\nValor: R$ ${(valorPagamento / 100).toFixed(2).replace(".", ",")}\n\nEscaneie o QR Code ou copie o PIX acima para efetuar o pagamento.`
          )
          .setImage(
            `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(pagamento.pixCopyPaste)}&size=200x200`
          )
          .setColor("#8a00ff")
          .setFooter({ text: "O pagamento expira em 2 minutos." });

        const cancelarButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("cancelar_compra")
            .setLabel("❌ Cancelar Compra")
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embedPagamento], components: [cancelarButton], ephemeral: true });

        pendente.timeoutId = criarTimeoutPagamento(interaction, 120000, async () => {
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
              ephemeral: true,
            });
          } catch {}
        });

        let tempoPassado = 0;
        const intervalo = 10000;
        const tempoMaximo = 120000;
        const checarPagamento = async () => {
          const isPaid = await verificarPagamento(pagamento.id);
          if (isPaid) {
            pendente.pago = true;
            clearTimeout(pendente.timeoutId);
            removerCartaoDoEstoque(cardObj.numero);
            await interaction.followUp({
              content: `💳 Pagamento confirmado! Aqui estão os detalhes do seu cartão:\n\n\`${cardObj.numero}\`\nBanco: ${cardObj.banco}\nBandeira: ${cardObj.bandeira}\nLevel: ${cardObj.level}`,
              ephemeral: true,
            });
            await logAdmin(interaction, new EmbedBuilder()
              .setTitle("✅ PAGAMENTO CONFIRMADO")
              .setDescription(
                `Usuário <@${interaction.user.id}> PAGOU e recebeu o cartão:\n` +
                `\`${cardObj.numero}\`\n` +
                `Valor: R$ ${(valorPagamento / 100).toFixed(2).replace(".", ",")}\n` +
                `Cargo de comprador atribuído.`
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
        await interaction.reply({
          content: "❌ Ocorreu um erro ao gerar o pagamento. Tente novamente mais tarde.",
          ephemeral: true,
        });
      }
      return true;
    }

    if (interaction.customId === "selecionar_cartao") {
      if (usuarioTemCompraPendente(interaction.user.id)) {
        await logAdmin(
          interaction,
          new EmbedBuilder()
            .setTitle("⚠️ COMPRA BLOQUEADA (PIX PENDENTE)")
            .setDescription(`Usuário <@${interaction.user.id}> tentou iniciar nova compra mas já tem pagamento Pix pendente.`)
            .setColor("#ff9800")
            .setTimestamp()
        );
        await interaction.reply({ content: "Você já possui uma compra pendente! Aguarde o pagamento ou o tempo expirar.", ephemeral: true });
        return true;
      }
      const idxSelecionado = parseInt(interaction.values[0], 10);
      const pendentePesquisa = pesquisasPendentes.get(interaction.user.id);

      if (
        !pendentePesquisa ||
        !pendentePesquisa.resultados ||
        !pendentePesquisa.resultados[idxSelecionado]
      ) {
        await logAdmin(
          interaction,
          new EmbedBuilder()
            .setTitle("❌ SELEÇÃO INVÁLIDA")
            .setDescription(`Usuário <@${interaction.user.id}> tentou selecionar um cartão inválido ou sessão expirada.`)
            .setColor("#f44336")
            .setTimestamp()
        );
        await interaction.reply({
          content: "Cartão inválido ou sessão expirada.",
          ephemeral: true,
        });
        return true;
      }

      const cartaoSelecionado = pendentePesquisa.resultados[idxSelecionado];
      const valorPagamento = cartaoSelecionado.preco
        ? Math.round(cartaoSelecionado.preco * 100)
        : 4000;

      try {
        const pagamento = await criarPagamento(valorPagamento);

        const pendente = {
          transactionId: pagamento.id,
          cartao: cartaoSelecionado,
          pix: { qrcode: pagamento.pixCopyPaste, secureUrl: pagamento.pixUrl },
          pago: false
        };
        pagamentosPendentes.set(interaction.user.id, pendente);

        await logAdmin(interaction, new EmbedBuilder()
          .setTitle("🤑 PAGAMENTO GERADO")
          .setDescription(
            `Usuário <@${interaction.user.id}> gerou um pagamento Pix.\n` +
            `**Valor:** R$ ${(valorPagamento / 100).toFixed(2).replace(".", ",")}\n` +
            `**Cartão/categoria:** ${cartaoSelecionado.numero}\n` +
            `ID Transação: ${pagamento.id}`
          )
          .setColor("#ffa500")
          .setTimestamp()
        );

        const embedPagamento = new EmbedBuilder()
          .setTitle("💸 PAGAMENTO GERADO")
          .setDescription(
            `✅ **CHAVE PIX:**\n\`\`\`${pagamento.pixCopyPaste}\`\`\`\nValor: R$ ${(valorPagamento / 100).toFixed(2).replace(".", ",")}\n\nEscaneie o QR Code ou copie o PIX acima para efetuar o pagamento.`
          )
          .setImage(
            `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(pagamento.pixCopyPaste)}&size=200x200`
          )
          .setColor("#8a00ff")
          .setFooter({ text: "O pagamento expira em 2 minutos." });

        const cancelarButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("cancelar_compra")
            .setLabel("❌ Cancelar Compra")
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embedPagamento], components: [cancelarButton], ephemeral: true });

        pendente.timeoutId = criarTimeoutPagamento(interaction, 120000, async () => {
          await logAdmin(interaction, new EmbedBuilder()
            .setTitle("⏰ PAGAMENTO EXPIRADO")
            .setDescription(
              `O usuário <@${interaction.user.id}> NÃO confirmou o pagamento dentro do prazo.\n` +
                `**Valor:** R$ ${(valorPagamento / 100).toFixed(2).replace(".", ",")}\n` +
                `**Cartão/categoria:** ${cartaoSelecionado.numero}`
            )
            .setColor("#8a00ff").setTimestamp());
          try {
            await interaction.followUp({
              content: "❌ O pagamento não foi confirmado dentro do tempo. Por favor, tente novamente.",
              ephemeral: true,
            });
          } catch {}
        });

        let tempoPassado = 0;
        const intervalo = 10000;
        const tempoMaximo = 120000;
        const checarPagamento = async () => {
          const isPaid = await verificarPagamento(pagamento.id);
          if (isPaid) {
            pendente.pago = true;
            clearTimeout(pendente.timeoutId);
            removerCartaoDoEstoque(cartaoSelecionado.numero);

            await interaction.followUp({
              content: `💳 Pagamento confirmado! Aqui estão os detalhes do seu cartão:\n\n\`${cartaoSelecionado.numero}\`\nBanco: ${cartaoSelecionado.banco}\nBandeira: ${cartaoSelecionado.bandeira}\nLevel: ${cartaoSelecionado.level}`,
              ephemeral: true,
            });
            await logAdmin(interaction, new EmbedBuilder()
              .setTitle("✅ PAGAMENTO CONFIRMADO")
              .setDescription(
                `Usuário <@${interaction.user.id}> PAGOU e recebeu o cartão:\n` +
                `\`${cartaoSelecionado.numero}\`\n` +
                `Valor: R$ ${(valorPagamento / 100).toFixed(2).replace(".", ",")}\n` +
                `Cargo de comprador atribuído.`
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
        await interaction.reply({
          content: "❌ Ocorreu um erro ao gerar o pagamento. Tente novamente mais tarde.",
          ephemeral: true,
        });
      }
      return true;
    }

    return false;
  },

  async handleModal(interaction) {
    if (!interaction.isModalSubmit()) return false;
    if (interaction.customId !== "modal_busca") return false;

    try {
      const valorBusca = interaction.fields
        .getTextInputValue("input_busca")
        .trim();
      const pendentePesquisa = pesquisasPendentes.get(interaction.user.id);

      if (!pendentePesquisa || !pendentePesquisa.tipo) {
        await interaction.reply({
          content: "Sessão expirada ou inválida.",
          ephemeral: true,
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
          await interaction.reply({
            content: "Tipo de pesquisa inválido.",
            ephemeral: true,
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
        await interaction.reply({
          content: "Nenhum cartão encontrado com esses parâmetros.",
          ephemeral: true,
        });
        return true;
      }

      const descricoes = resultados
        .map((cartao, i) => {
          return `\`${i}\` - **${cartao.numero ? mascararNumero(cartao.numero) : "N/D"}** - Banco: ${cartao.banco || "N/D"} - Bandeira: ${cartao.bandeira || "N/D"} - Level: ${cartao.level || "N/D"} - R$ ${cartao.preco || "N/D"}`;
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
            description: `Banco: ${cartao.banco || "N/D"} | Bandeira: ${cartao.bandeira || "N/D"} | R$ ${cartao.preco || "N/D"}`,
            value: index.toString(),
          })),
        );

      const rowSelect = new ActionRowBuilder().addComponents(selectCartoes);

      await interaction.reply({
        embeds: [embedResultados],
        components: [rowSelect],
        ephemeral: true,
      });

      return true;
    } catch (err) {
      console.error("Erro no modal de busca:", err);
      await interaction.reply({
        content: "Erro inesperado ao processar a busca.",
        ephemeral: true,
      });
      return true;
    }
  },
};