module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // Comando barra
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command && typeof command.execute === 'function') {
          await command.execute(interaction, client);
        }
      }
      // Botões
      else if (interaction.isButton()) {
        // PAINEL
        const painelCmd = client.commands.get('painel');
        if (painelCmd && typeof painelCmd.handleButton === 'function') {
          try {
            const handled = await painelCmd.handleButton(interaction, client);
            if (handled) return;
          } catch (e) {
            console.error('Erro no painel.handleButton:', e);
            await interaction.reply({ content: 'Erro ao processar botão do painel.', ephemeral: true }).catch(() => {});
            return;
          }
        }
        // ESTOQUE
        const estoqueCmd = client.commands.get('estoque');
        if (estoqueCmd && typeof estoqueCmd.handleButton === 'function') {
          try {
            const handled = await estoqueCmd.handleButton(interaction, client);
            if (handled) return;
          } catch (e) {
            console.error('Erro no estoque.handleButton:', e);
            await interaction.reply({ content: 'Erro ao processar botão do estoque.', ephemeral: true }).catch(() => {});
            return;
          }
        }
        // GERAR (setar cargo)
        const gerarCmd = client.commands.get('gerar');
        if (gerarCmd && typeof gerarCmd.handleButton === 'function') {
          try {
            const handled = await gerarCmd.handleButton(interaction, client);
            if (handled) return;
          } catch (e) {
            console.error('Erro no gerar.handleButton:', e);
            await interaction.reply({ content: 'Erro ao processar botão de pagamento.', ephemeral: true }).catch(() => {});
            return;
          }
        }
      }
      // Modal Submit
      else if (interaction.isModalSubmit()) {
        const painelCmd = client.commands.get('painel');
        if (painelCmd && typeof painelCmd.handleModal === 'function') {
          try {
            const handled = await painelCmd.handleModal(interaction, client);
            if (handled) return;
          } catch (e) {
            console.error('Erro no painel.handleModal:', e);
            await interaction.reply({ content: 'Erro ao processar modal do painel.', ephemeral: true }).catch(() => {});
            return;
          }
        }
        const estoqueCmd = client.commands.get('estoque');
        if (estoqueCmd && typeof estoqueCmd.handleModal === 'function') {
          try {
            const handled = await estoqueCmd.handleModal(interaction, client);
            if (handled) return;
          } catch (e) {
            console.error('Erro no estoque.handleModal:', e);
            await interaction.reply({ content: 'Erro ao processar modal do estoque.', ephemeral: true }).catch(() => {});
            return;
          }
        }
      }
      // Select Menu
      else if (interaction.isStringSelectMenu()) {
        const painelCmd = client.commands.get('painel');
        if (painelCmd && typeof painelCmd.handleSelect === 'function') {
          try {
            const handled = await painelCmd.handleSelect(interaction, client);
            if (handled) return;
          } catch (e) {
            console.error('Erro no painel.handleSelect:', e);
            await interaction.reply({ content: 'Erro ao processar select do painel.', ephemeral: true }).catch(() => {});
            return;
          }
        }
        const estoqueCmd = client.commands.get('estoque');
        if (estoqueCmd && typeof estoqueCmd.handleSelectMenu === 'function') {
          try {
            const handled = await estoqueCmd.handleSelectMenu(interaction, client);
            if (handled) return;
          } catch (e) {
            console.error('Erro no estoque.handleSelectMenu:', e);
            await interaction.reply({ content: 'Erro ao processar select do estoque.', ephemeral: true }).catch(() => {});
            return;
          }
        }
      }
    } catch (error) {
      console.error('Erro GERAL:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '💥 Erro geral no handler!', ephemeral: true });
        } else {
          await interaction.reply({ content: '💥 Erro geral no handler!', ephemeral: true });
        }
      } catch (replyError) {
        console.error('Não consegui responder o erro no interactionCreate:', replyError);
      }
    }
  }
};