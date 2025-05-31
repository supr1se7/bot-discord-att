module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction, client);
      } 
      else if (interaction.isButton()) {
        // PAINEL - Cancelar compra (ou outros botões do painel)
        const painelCmd = client.commands.get('painel');
        if (painelCmd && typeof painelCmd.handleButton === 'function') {
          try {
            const handled = await painelCmd.handleButton(interaction, client);
            if (handled) return; // Se o painel tratou, para aqui
          } catch (e) {
            console.error('Erro no painel.handleButton:', e);
          }
        }
        // ESTOQUE
        const estoqueCmd = client.commands.get('estoque');
        if (estoqueCmd && typeof estoqueCmd.handleButton === 'function') {
          await estoqueCmd.handleButton(interaction, client);
        }
      } 
      else if (interaction.isModalSubmit()) {
        // PRIMEIRO: tenta resolver com o painel
        const painelCmd = client.commands.get('painel');
        if (painelCmd && typeof painelCmd.handleModal === 'function') {
          try {
            const handled = await painelCmd.handleModal(interaction, client);
            if (handled) return;  // SE JÁ TRATOU, PÁRA AQUI
          } catch (e) {
            console.error('Erro no painel.handleModal:', e);
          }
        }

        // SE NÃO FOI PELO PAINEL, vai pro estoque
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
            await estoqueCmd.handleSelectMenu(interaction, client);
          } catch (e) {
            console.error('Erro no estoque.handleSelectMenu:', e);
          }
        }
      }
    } catch (error) {
      console.error('Erro GERAL na porra do interactionCreate:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '💥 Pau geral no handler, caralho!', ephemeral: true });
        } else {
          await interaction.reply({ content: '💥 Pau geral no handler, caralho!', ephemeral: true });
        }
      } catch (replyError) {
        console.error('Não consegui responder o erro no interactionCreate, porra:', replyError);
      }
    }
  }
};