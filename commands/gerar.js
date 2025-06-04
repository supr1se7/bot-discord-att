const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { criarPagamento, verificarPagamento } = require("../services/blackpayments");
const config = require("../config.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gerar")
    .setDescription("Gera uma cobrança Pix para o valor desejado. (Apenas admins)")
    .addIntegerOption(opt =>
      opt.setName("valor")
        .setDescription("Valor da cobrança em reais (ex: 50)")
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName("cliente")
        .setDescription("Usuário do Discord que irá pagar")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const valor = interaction.options.getInteger("valor");
    const cliente = interaction.options.getUser("cliente");

    if (!valor || valor < 1) {
      await interaction.reply({ content: "Informe um valor válido!", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    try {
      // Gera pagamento
      const pagamento = await criarPagamento(valor, {
        nome: cliente ? cliente.username : "Usuário Discord",
        email: cliente ? `${cliente.id}@discord.user` : "discorduser@legacy.bot"
      });

      // Embed inicial
      const embed = new EmbedBuilder()
        .setTitle("💸 PAGAMENTO GERADO")
        .setDescription(
          `Valor: R$ ${valor},00\n\nEscaneie o QR Code abaixo para pagar.\n\n`
        )
        .setImage(
          pagamento.pixUrl || `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(pagamento.pixCopyPaste)}&size=200x200`
        )
        .setFooter({ text: "O pagamento expira em 30 minutos." })
        .setColor("#8a00ff");

      // 1ª mensagem: QR Code
      const qrMsg = await interaction.editReply({
        embeds: [embed],
        content: null
      });

      // 2ª mensagem: chave copia e cola (apenas a chave, sem texto extra)
      const pixMsg = await interaction.followUp({
        content: pagamento.pixCopyPaste,
        ephemeral: false
      });

      // ---------------------------
      // VERIFICAÇÃO DE PAGAMENTO
      // ---------------------------
      let pagoConfirmado = false;
      let tempoPassado = 0;
      const intervalo = 10000; // 10s
      const tempoMaximo = 30 * 60 * 1000; // 30min

      const intervalId = setInterval(async () => {
        try {
          if (pagoConfirmado) return;
          const isPaid = await verificarPagamento(pagamento.id);
          console.log(`[Pix DEBUG] Checando pagamento ${pagamento.id} | Status: ${isPaid} | Tempo passado: ${tempoPassado / 1000}s`);

          if (isPaid) {
            pagoConfirmado = true;
            clearInterval(intervalId);
            console.log("[Pix DEBUG] Pagamento APROVADO:", pagamento.id);

            await interaction.followUp({
              content: `✅ **O pagamento foi confirmado! Clique no botão abaixo para setar o cargo de comprador para o cliente.**`,
              ephemeral: false
            });

            // Embed privada para setar o cargo
            const embedCargo = new EmbedBuilder()
              .setTitle("Setar Cargo de Comprador?")
              .setDescription(
                `Pagamento confirmado!\n\nClique no botão abaixo para iniciar o processo de setar o cargo de <@&${config.cargoCompradorID}>.\nNa próxima mensagem, marque o cliente no chat.`
              )
              .setColor("#8a00ff");

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`gerar_iniciar_setarcargo_${interaction.id}`)
                .setLabel("Setar Cargo de Comprador")
                .setStyle(ButtonStyle.Success)
            );

            await interaction.followUp({
              embeds: [embedCargo],
              components: [row],
              ephemeral: true // só admin vê
            });
          } else {
            tempoPassado += intervalo;
            if (tempoPassado >= tempoMaximo) {
              clearInterval(intervalId);
              console.log("[Pix DEBUG] Pagamento NÃO APROVADO no tempo. ID:", pagamento.id);

              // Apaga as mensagens do QR code e Pix copia/cola
              try {
                const channel = interaction.channel;
                if (qrMsg) await channel.messages.delete(qrMsg.id).catch(() => { });
                if (pixMsg) await channel.messages.delete(pixMsg.id).catch(() => { });
              } catch (e) {
                console.error("[Pix DEBUG] Erro ao apagar mensagens Pix expirado:", e);
              }
              await interaction.followUp({
                content: "❌ O pagamento expirou. Por favor, peça para o admin gerar outro Pix.",
                ephemeral: false
              });
            }
          }
        } catch (e) {
          console.error("[Pix DEBUG] Erro ao checar pagamento:", e);
        }
      }, intervalo);

    } catch (err) {
      console.error("Erro ao gerar cobrança:", err);
      try {
        await interaction.editReply({ content: "Erro ao gerar cobrança Pix." });
      } catch {
        await interaction.followUp({ content: "Erro ao gerar cobrança Pix." });
      }
    }
  },

  // Handler para os botões
  async handleButton(interaction) {
    if (interaction.customId && interaction.customId.startsWith("gerar_iniciar_setarcargo_")) {
      await interaction.reply({
        content:
          "Por favor, **responda essa mensagem marcando o cliente** (use a menção: @usuario ou envie o ID do usuário) para que eu possa setar o cargo.",
        ephemeral: true,
        fetchReply: true
      });

      // Cria um coletor para pegar a próxima mensagem DO ADMIN (apenas dele, por tempo maior)
      const channel = interaction.channel;
      const adminId = interaction.user.id;

      const filter = m =>
        m.author.id === adminId &&
        (m.mentions.users.size > 0 || /^\d+$/.test(m.content.trim()));

      // Aumenta o tempo para 10 minutos (600_000 ms)
      const collector = channel.createMessageCollector({ filter, max: 1, time: 600000 });

      collector.on("collect", async m => {
        let clienteId = null;
        if (m.mentions.users.size > 0) {
          clienteId = m.mentions.users.first().id;
        } else if (/^\d+$/.test(m.content.trim())) {
          clienteId = m.content.trim();
        }
        if (!clienteId) {
          await m.reply({ content: "❌ Não consegui identificar o usuário. Tente novamente.", ephemeral: true });
          return;
        }

        try {
          const guild = interaction.guild;
          const member = await guild.members.fetch(clienteId);
          if (member.roles.cache.has(config.cargoCompradorID)) {
            await m.reply({ content: `ℹ️ O cliente <@${clienteId}> já possui o cargo de comprador.`, ephemeral: true });
            return;
          }
          await member.roles.add(config.cargoCompradorID);
          await m.reply({ content: `✅ Cargo de comprador setado com sucesso para <@${clienteId}>!`, ephemeral: true });
        } catch (e) {
          console.error("Erro ao setar cargo:", e);
          await m.reply({ content: "❌ Não foi possível setar o cargo. Verifique se o bot tem permissão e se o usuário está no servidor.", ephemeral: true });
        }
      });

      collector.on("end", (collected, reason) => {
        if (reason === "time" && collected.size === 0) {
          interaction.followUp({ content: "⏰ Tempo esgotado para marcar o cliente. Tente novamente clicando no botão.", ephemeral: true });
        }
      });

      return true;
    }

    return false;
  }
};