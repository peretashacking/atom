const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');

// developed by peretas technologies
// discord.gg/peretas

require('dotenv').config();
class AtomManager {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        // sets provide typically faster lookup
        this.allowedIds = new Set(['1006031596694011924', '689283450171162624']);

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.client.once('ready', this.onReady.bind(this));
        this.client.on('messageCreate', this.handleCommands.bind(this));
    }

    onReady() {
        console.log('Bot is online.');
        this.client.user.setActivity('>help', { type: 'PLAYING' });
    }

    handleCommands(message) {
        // I am not certain if this "out-performs" using event listeners, but this is definitely cleaner then defining each one manually.
        const commandHandlers = {
            '>test all': this.handleTestAll.bind(this),
            '>test allowed': this.handleTestAllowed.bind(this),
            '>listchannels': this.handleListChannels.bind(this),
            '>create': this.handleCreateChannels.bind(this),
            '>delete': this.handleDeleteChannels.bind(this),
            '>permtest': this.handlePermTest.bind(this),
            '>sendmessage': this.handleSendMessage.bind(this),
            '>deleteall': this.handleDeleteAll.bind(this),
            '>help': this.handleHelp.bind(this)
        };

        const command = Object.keys(commandHandlers).find(cmd =>
            message.content === cmd || message.content.startsWith(cmd)
        );

        if (command) {
            commandHandlers[command](message);
        }
    }

    handleTestAll(message) {
        message.channel.send('`[DEBUG]` - You are allowed to run this command.');
    }

    handleTestAllowed(message) {
        if (this.allowedIds.has(message.author.id)) {
            message.channel.send('`[DEBUG]` - You are allowed to run this command.');
        } else {
            message.channel.send('`[DEBUG]` - You are not allowed to run this command.');
        }
    }

    async handleListChannels(message) {
        const channelList = message.guild.channels.cache
            .filter(channel => [ChannelType.GuildCategory, ChannelType.GuildVoice, ChannelType.GuildText].includes(channel.type))
            .map(channel => {
                const typeMap = {
                    [ChannelType.GuildCategory]: 'Category',
                    [ChannelType.GuildVoice]: 'Voice Channel',
                    [ChannelType.GuildText]: 'Text Channel'
                };
                return `**${typeMap[channel.type] || 'Unknown'}** -- ${channel.name} -- ID: ${channel.id}`;
            });

        // More efficient chunking
        const MAX_MESSAGE_LENGTH = 1950;
        for (let i = 0; i < channelList.length; i += MAX_MESSAGE_LENGTH) {
            const chunk = channelList.slice(i, i + MAX_MESSAGE_LENGTH).join('\n');
            await message.channel.send(`Channels:\n${chunk}`);
        }
    }

    async handleCreateChannels(message) {
        const [, channelName, amountStr] = message.content.split(' ');
        const amount = parseInt(amountStr, 10);

        if (!channelName || isNaN(amount)) {
            return message.channel.send('Invalid command usage. Correct usage: >create [channelname] [amount]');
        }

        await Promise.all(
            Array.from({ length: amount }, () =>
                message.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText
                })
            )
        );

        message.channel.send(`Created ${amount} channels named ${channelName}`);
    }

    async handleDeleteChannels(message) {
        const [, identifier] = message.content.split(' ');

        if (!identifier) {
            return message.channel.send('Invalid command usage. Correct usage: >delete [channelid OR channelname]');
        }

        const channels = message.guild.channels.cache.filter(channel =>
            channel.id === identifier || channel.name === identifier
        );

        if (channels.size === 0) {
            return message.channel.send('No channels found with the given identifier.');
        }

        if (channels.size > 1 && isNaN(identifier)) {
            const confirmMessage = await message.channel.send('Multiple channels found. Delete all? (y/n)');

            try {
                const collected = await confirmMessage.channel.awaitMessages({
                    filter: response => response.author.id === message.author.id && ['y', 'n'].includes(response.content.toLowerCase()),
                    max: 1,
                    time: 30000
                });

                if (collected.first().content.toLowerCase() === 'y') {
                    await Promise.all(channels.map(channel => channel.delete()));
                    message.channel.send(`Deleted all channels named ${identifier}`);
                } else {
                    message.channel.send('Operation cancelled.');
                }
            } catch {
                message.channel.send('No response received. Operation cancelled.');
            }
        } else {
            await Promise.all(channels.map(channel => channel.delete()));
            message.channel.send(`Deleted channel(s) with identifier ${identifier}`);
        }
    }

    handlePermTest(message) {
        const member = message.guild.members.cache.get(message.author.id);
        const permissions = member.permissions.toArray();

        const permissionTest = Object.keys(PermissionsBitField.Flags)
            .map(perm => `**${perm.replace(/_/g, ' ')}:** \`${permissions.includes(perm) ? 'True' : 'False'}\``)
            .join('\n');

        message.channel.send(`## Permission Test\n${permissionTest}`);
    }

    async handleSendMessage(message) {
        const [, rawContent, amountStr, targetChannelId] = message.content.split(' ');
        const messageContent = rawContent.replace(/_/g, ' ');
        const amount = parseInt(amountStr, 10);

        if (!messageContent || isNaN(amount)) {
            return message.channel.send('Invalid command usage. Correct usage: >sendmessage [Message content] [Amount] [Channel ID or ALL]');
        }

        const channels = targetChannelId?.toLowerCase() === 'all'
            ? message.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText)
            : message.guild.channels.cache.filter(channel =>
                channel.id === (targetChannelId || message.channel.id) &&
                channel.type === ChannelType.GuildText
            );

        if (channels.size === 0) {
            return message.channel.send('No valid channels found.');
        }

        await Promise.all(
            channels.map(channel =>
                Promise.all(
                    Array.from({ length: amount }, () => channel.send(messageContent))
                )
            )
        );

        message.channel.send(`Sent message "${messageContent}" ${amount} times to ${targetChannelId || 'current channel'}`);
    }

    async handleDeleteAll(message) {
        const [, newChannelName] = message.content.split(' ');

        if (!newChannelName) {
            return message.channel.send('Invalid command usage. Correct usage: >deleteall [new channel name]');
        }

        await Promise.all(
            message.guild.channels.cache.map(channel => channel.delete())
        );

        await message.guild.channels.create({
            name: newChannelName,
            type: ChannelType.GuildText
        });

        message.channel.send(`Deleted all channels and created a new channel named ${newChannelName}`);
    }

    handleHelp(message) {
        const helpMessage = `
## Atom Manager Help
- \`>create [channelname] [amount]\` - Create multiple text channels
- \`>delete [channelid/channelname]\` - Delete specific channel(s)
- \`>deleteall [new channel name]\` - Remove all channels, create one new
- \`>sendmessage [content] [amount] [channel]\` - Mass message channels
- \`>listchannels\` - List all server channels
- \`>test allowed\` - Check user permissions
- \`>test all\` - Debug command
- \`>help\` - Show this help menu
- \`>permtest\` - Detailed permission check

Developed by Peretas Technologies
GitHub: github.com/peretashacking/atom
        `;
        message.channel.send(helpMessage);
    }

    start() {
        this.client.login(process.env.DISCORD_TOKEN);
    }
}

// Instantiate and start the bot
const atomManager = new AtomManager();
atomManager.start();

