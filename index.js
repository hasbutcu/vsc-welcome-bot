const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const path = require('path');
const config = require('./config.json'); // config.js dosyasını içe aktarıyoruz
const fs = require('fs');

// Olayları yükle
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

let voiceConnection;
const player = createAudioPlayer();

// Olay dosyalarını yükleme
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(`./events/${file}`);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Bot hazır olduğunda çalışır
client.once('ready', async () => {
  console.log('Bot is ready!');

  try {
    const guild = await client.guilds.fetch(config.GUILD_ID);
    const channel = guild.channels.cache.get(config.VOICE_CHANNEL_ID);
    
    if (!channel) {
      console.error("Ses kanalı bulunamadı.");
      return;
    }

    joinVoice(channel);
  } catch (error) {
    console.error("Sunucuya erişilirken hata oluştu:", error);
  }
});

// Bot belirli bir kanala katılır ve 7/24 sessizde kalır
function joinVoice(voiceChannel) {
  voiceConnection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  const silence = createAudioResource(path.join(__dirname, 'silence.mp3'));
  player.play(silence);
  voiceConnection.subscribe(player);
}

// Bir kullanıcı ses kanalına katıldığında çalışır
client.on('voiceStateUpdate', (oldState, newState) => {
  // Eğer kullanıcı eski durumda ses kanalında değil ama yeni durumda ses kanalına katıldıysa
  if (!oldState.channelId && newState.channelId) {
    console.log(`${newState.member.user.tag} ses kanalına katıldı.`);

    const member = newState.member;
    const hasYetkiliRole = member.roles.cache.some(role => role.id === config.YETKILI_ROLE_ID);
    const welcomeAudio = createAudioResource(path.join(__dirname, 'welcome.mp3'));
    const yetkiliAudio = createAudioResource(path.join(__dirname, 'yetkili.mp3'));

    // 2 saniye bekle
    setTimeout(() => {
      player.stop(); // Ses dosyasını durdur

      if (hasYetkiliRole) {
        player.play(yetkiliAudio); // Yetkili rolü varsa yetkili.mp3 çal
      } else {
        player.play(welcomeAudio); // Yoksa welcome.mp3 çal
      }

      // Ses bittiğinde tekrar sessiz moduna döner
      player.once(AudioPlayerStatus.Idle, () => {
        const silence = createAudioResource(path.join(__dirname, 'silence.mp3'));
        player.play(silence);
      });
    }, 2000); // 2000 ms = 2 saniye
  }
});

// Bot giriş yapar
client.login(config.TOKEN);
