const { Client, Collection, GatewayIntentBits, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  presence: {
    activities: [{ name: 'legacy', type: ActivityType.Playing }],
    status: 'online'
  }
});

client.commands = new Collection();

const statusList = [
  { name: 'Consultando BINs', type: ActivityType.Watching },
  { name: 'Adicionando estoque', type: ActivityType.Playing },
  { name: 'Verificando saldo de cartões', type: ActivityType.Watching },
  { name: 'Painel de CC FULL', type: ActivityType.Playing },
  { name: 'Garantindo qualidade', type: ActivityType.Playing },

];

client.once('ready', () => {
  console.log(`🔥 BOT ONLINE COMO ${client.user.tag} | Status: ${statusList[0].name}`);

  // Troca o status a cada 15 segundos
  let i = 0;
  setInterval(() => {
    const status = statusList[i % statusList.length];
    client.user.setActivity(status.name, { type: status.type });
    i++;
  }, 15 * 1000);
});

require('./handler/commandHandler')(client);
require('./handler/eventHandler')(client);

client.login(config.token);