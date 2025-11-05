const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const IdentityManager = require('./identityManager');
const http = require('http');

// ========================================
// SERVEUR HTTP POUR ÉVITER L'ENDORMISSEMENT
// ========================================
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Discord is alive! 🤖✅');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🌐 Serveur HTTP démarré sur le port ${PORT}`);
  console.log(`📍 URL de santé : http://localhost:${PORT}/health`);
});

// ========================================
// CLIENT DISCORD
// ========================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildWebhooks
  ]
});

const identityManager = new IdentityManager();

// ========================================
// DÉFINITION DES COMMANDES
// ========================================
const commands = [
  new SlashCommandBuilder()
    .setName('identity')
    .setDescription('Gérer les identités du bot')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Créer une nouvelle identité')
        .addStringOption(option =>
          option.setName('nom')
            .setDescription('Nom de l\'identité')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('avatar_url')
            .setDescription('URL de l\'avatar')
            .setRequired(false))
        .addAttachmentOption(option =>
          option.setName('avatar_image')
            .setDescription('Image à uploader pour l\'avatar')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Supprimer une identité')
        .addStringOption(option =>
          option.setName('nom')
            .setDescription('Nom de l\'identité à supprimer')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('modify')
        .setDescription('Modifier une identité')
        .addStringOption(option =>
          option.setName('nom')
            .setDescription('Nom de l\'identité à modifier')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(option =>
          option.setName('nouveau_nom')
            .setDescription('Nouveau nom (optionnel)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('avatar_url')
            .setDescription('Nouvelle URL de l\'avatar (optionnel)')
            .setRequired(false))
        .addAttachmentOption(option =>
          option.setName('avatar_image')
            .setDescription('Nouvelle image pour l\'avatar (optionnel)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lister toutes les identités'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('default')
        .setDescription('Définir l\'identité par défaut du bot')
        .addStringOption(option =>
          option.setName('nom')
            .setDescription('Nom pour l\'identité par défaut')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('avatar_url')
            .setDescription('URL de l\'avatar par défaut')
            .setRequired(false))
        .addAttachmentOption(option =>
          option.setName('avatar_image')
            .setDescription('Image pour l\'avatar par défaut')
            .setRequired(false)))
    .toJSON(),
  
  new SlashCommandBuilder()
    .setName('envoyer')
    .setDescription('Envoyer un message avec une identité choisie')
    .addStringOption(option =>
      option.setName('identite')
        .setDescription('Nom de l\'identité à utiliser')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Le message à envoyer')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Canal où envoyer le message (par défaut: canal actuel)')
        .setRequired(false))
    .toJSON()
];

// ========================================
// ÉVÉNEMENTS DISCORD
// ========================================
client.once('ready', async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ✅ Bot connecté en tant que ${client.user.tag}`);
  console.log(`[${timestamp}] 📊 Connecté à ${client.guilds.cache.size} serveur(s)`);
  console.log(`[${timestamp}] 🎭 ${identityManager.getAllIdentities().length} identité(s) chargée(s)`);
  
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
  try {
    console.log(`[${timestamp}] 🔄 Enregistrement des commandes slash...`);
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log(`[${timestamp}] ✅ Commandes enregistrées avec succès !`);
  } catch (error) {
    console.error(`[${timestamp}] ❌ Erreur lors de l'enregistrement des commandes:`, error);
  }
});

// Gestion des interactions
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
    }
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ Erreur lors du traitement de l'interaction:`, error);
    
    const errorMessage = 'Une erreur s\'est produite lors du traitement de votre commande.';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `❌ ${errorMessage}`, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true }).catch(() => {});
    }
  }
});

// ========================================
// GESTION DE L'AUTOCOMPLÉTION
// ========================================
async function handleAutocomplete(interaction) {
  const focusedValue = interaction.options.getFocused();
  const identities = identityManager.getAllIdentities();
  
  const filtered = identities.filter(identity =>
    identity.name.toLowerCase().includes(focusedValue.toLowerCase())
  ).slice(0, 25);
  
  await interaction.respond(
    filtered.map(identity => ({ name: identity.name, value: identity.name }))
  );
}

// ========================================
// GESTION DES COMMANDES
// ========================================
async function handleCommand(interaction) {
  const { commandName } = interaction;
  
  if (commandName === 'identity') {
    await handleIdentityCommand(interaction);
  } else if (commandName === 'envoyer') {
    await handleEnvoyerCommand(interaction);
  }
}

// Obtenir l'URL de l'avatar
function getAvatarUrl(interaction, urlOption, imageOption) {
  const avatarUrl = interaction.options.getString(urlOption);
  const avatarImage = interaction.options.getAttachment(imageOption);
  
  if (avatarImage) {
    return avatarImage.url;
  }
  
  return avatarUrl || null;
}

// ========================================
// COMMANDE /identity
// ========================================
async function handleIdentityCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'create') {
    const nom = interaction.options.getString('nom');
    const avatar = getAvatarUrl(interaction, 'avatar_url', 'avatar_image');
    
    const result = identityManager.createIdentity(nom, avatar);
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Identité créée')
        .setDescription(`L'identité **${nom}** a été créée avec succès !`);
      
      if (result.identity.avatar) {
        embed.setThumbnail(result.identity.avatar);
      }
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
    }
  }
  else if (subcommand === 'delete') {
    const nom = interaction.options.getString('nom');
    const result = identityManager.deleteIdentity(nom);
    
    if (result.success) {
      await interaction.reply({ content: `✅ L'identité **${nom}** a été supprimée.`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
    }
  }
  else if (subcommand === 'modify') {
    const nom = interaction.options.getString('nom');
    const nouveauNom = interaction.options.getString('nouveau_nom');
    const avatar = getAvatarUrl(interaction, 'avatar_url', 'avatar_image');
    
    const result = identityManager.modifyIdentity(nom, nouveauNom, avatar);
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Identité modifiée')
        .setDescription(`L'identité a été mise à jour avec succès !`);
      
      if (result.identity.avatar) {
        embed.setThumbnail(result.identity.avatar);
      }
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
    }
  }
  else if (subcommand === 'list') {
    const identities = identityManager.getAllIdentities();
    
    if (identities.length === 0) {
      await interaction.reply({ content: '📋 Aucune identité créée pour le moment.', ephemeral: true });
      return;
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📋 Liste des identités')
      .setDescription(identities.map(id => `• **${id.name}**${id.isDefault ? ' (Par défaut)' : ''}`).join('\n'));
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
  else if (subcommand === 'default') {
    const nom = interaction.options.getString('nom');
    const avatar = getAvatarUrl(interaction, 'avatar_url', 'avatar_image');
    
    const defaultIdentity = identityManager.setDefaultIdentity(nom, avatar);
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Identité par défaut définie')
      .setDescription(`L'identité par défaut du bot est maintenant **${nom}**`);
    
    if (defaultIdentity.avatar) {
      embed.setThumbnail(defaultIdentity.avatar);
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

// ========================================
// COMMANDE /envoyer
// ========================================
async function handleEnvoyerCommand(interaction) {
  const identityName = interaction.options.getString('identite');
  const message = interaction.options.getString('message');
  const channel = interaction.options.getChannel('canal') || interaction.channel;
  
  const identity = identityManager.getIdentity(identityName);
  
  if (!identity) {
    await interaction.reply({ content: `❌ L'identité **${identityName}** n'existe pas.`, ephemeral: true });
    return;
  }
  
  if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageWebhooks)) {
    await interaction.reply({ content: '❌ Je n\'ai pas la permission de gérer les webhooks dans ce canal.', ephemeral: true });
    return;
  }
  
  try {
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.owner.id === client.user.id);
    
    if (!webhook) {
      webhook = await channel.createWebhook({
        name: 'Fake Identity Bot',
        reason: 'Webhook pour envoyer des messages avec des identités personnalisées'
      });
    }
    
    await webhook.send({
      content: message,
      username: identity.name,
      avatarURL: identity.avatar
    });
    
    await interaction.reply({ content: '✅ Message envoyé avec succès !', ephemeral: true });
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Erreur lors de l'envoi du message:`, error);
    await interaction.reply({ content: '❌ Une erreur s\'est produite lors de l\'envoi du message.', ephemeral: true });
  }
}

// ========================================
// GESTION DES ERREURS GLOBALES
// ========================================
process.on('unhandledRejection', error => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❌ Unhandled promise rejection:`, error);
});

process.on('uncaughtException', error => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❌ Uncaught exception:`, error);
});

// Gestion de la déconnexion
client.on('disconnect', () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ⚠️ Bot déconnecté`);
});

// Gestion de la reconnexion
client.on('resume', () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔄 Bot reconnecté`);
});

// Gestion des erreurs du client
client.on('error', error => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❌ Erreur du client Discord:`, error);
});

// ========================================
// VÉRIFICATION DU TOKEN ET CONNEXION
// ========================================
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ ERREUR: Le token Discord n\'est pas défini !');
  console.log('🔍 Veuillez définir la variable d\'environnement DISCORD_TOKEN');
  process.exit(1);
}

// Connexion au bot
client.login(process.env.DISCORD_TOKEN)
  .then(() => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 🚀 Tentative de connexion au bot Discord...`);
  })
  .catch(error => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ Erreur de connexion:`, error);
    console.error('🔍 Vérifiez que votre token Discord est correct');
    process.exit(1);
  });

// ========================================
// GESTION PROPRE DE L'ARRÊT
// ========================================
process.on('SIGINT', () => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🛑 Arrêt du bot...`);
  server.close();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🛑 Arrêt du bot (SIGTERM)...`);
  server.close();
  client.destroy();
  process.exit(0);
});

console.log('🎭 Fake Identity Bot - Démarrage...');
console.log('📦 Version: 1.0.0');
console.log('🌍 Environnement:', process.env.NODE_ENV || 'production');
