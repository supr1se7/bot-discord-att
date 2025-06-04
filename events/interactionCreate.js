module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction, client);
      }
      else if (interaction.isButton()) {
        // PAINEL - Prioridade
        const painelCmd = client.commands.get('painel');
        if (painelCmd && typeof painelCmd.handleButton === 'function') {
          try {
            const handled = await painelCmd.handleButton(interaction, client);
            if (handled) return;
          } catch (e) {
            console.error('Erro no painel.handleButton:', e);
          }
        }
        // ESTOQUE
        const estoqueCmd = client.commands.get('estoque');
        if (estoqueCmd && typeof estoqueCmd.handleButton === 'function') {
          const handled = await estoqueCmd.handleButton(interaction, client);
          if (handled) return;
        }
        // GERAR - novo bloco, para lidar com o botão de setar cargo
        const gerarCmd = client.commands.get('gerar');
        if (gerarCmd && typeof gerarCmd.handleButton === 'function') {
          const handled = await gerarCmd.handleButton(interaction, client);
          if (handled) return;
        }
      }
      // ... resto igual
      else if (interaction.isModalSubmit()) {
        const painelCmd = client.commands.get('painel');
        if (painelCmd && typeof painelCmd.handleModal === 'function') {
          try {
            const handled = await painelCmd.handleModal(interaction, client);
            if (handled) return;
          } catch (e) {
            console.error('Erro no painel.handleModal:', e);
          }
        }
        const estoqueCmd = client.commands.get('estoque');
        if (estoqueCmd && typeof estoqueCmd.handleModal === 'function') {
          try {
            await estoqueCmd.handleModal(interaction, client);
          } catch (e) {
            console.error('Erro no estoque.handleModal:', e);
          }
        }
      }
      else if (interaction.isStringSelectMenu()) {
        const painelCmd = client.commands.get('painel');
        if (painelCmd && typeof painelCmd.handleSelect === 'function') {
          try {
            const handled = await painelCmd.handleSelect(interaction, client);
            if (handled) return;
          } catch (e) {
            console.error('Erro no painel.handleSelect:', e);
          }
        }
        const estoqueCmd = client.commands.get('estoque');
        if (estoqueCmd && typeof estoqueCmd.handleSelectMenu === 'function') {
          try {
            const handled = await estoqueCmd.handleSelectMenu(interaction, client);
            if (handled) return;
          } catch (e) {
            console.error('Erro no estoque.handleSelectMenu:', e);
          }
        }
      }
    } catch (error) {
      console.error('Erro GERAL:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '💥 Erro geral no handler!', flags: 64 });
        } else {
          await interaction.reply({ content: '💥 Erro geral no handler!', flags: 64 });
        }
      } catch (replyError) {
        console.error('Não consegui responder o erro no interactionCreate:', replyError);
      }
    }
  }
};