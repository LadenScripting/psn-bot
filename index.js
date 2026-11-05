const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js')
const axios = require('axios')

const TOKEN = process.env.TOKEN
const ROBLOSECURITY = process.env.ROBLOSECURITY
const PREFIX = '!'

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
})

async function getUserId(input) {
    if (/^\d+$/.test(input)) return parseInt(input)
    const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
        usernames: [input],
        excludeBannedUsers: false
    })
    const data = res.data.data
    if (!data || data.length === 0) return null
    return data[0].id
}

async function checkPSN(userId) {
    const res = await axios.post(
        'https://apis.roblox.com/user-profile-api/v1/user/profiles/get-profiles',
        {
            userIds: [userId],
            fields: [
                'names.username',
                'names.displayName',
                'names.platformName',
                'platformProfileId',
            ],
            includePlatformProfile: true,
        },
        {
            headers: {
                'User-Agent': 'Roblox/PS4 ROBLOX PS4 App 1.745.0.1140RobloxApp/1.745.0.1140 (GlobalDist; RobloxDirectDownload)',
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cookie': `.ROBLOSECURITY=${ROBLOSECURITY}`,
            }
        }
    )

    const profiles = res.data.profileDetails
    if (!profiles || profiles.length === 0) return null
    const profile = profiles.find(p => p.userId === userId)
    if (!profile) return null

    const platformName = profile.names?.platformName
    const platformId = profile.platformProfileId

    return {
        username: profile.names?.username || 'Unknown',
        displayName: profile.names?.displayName || 'Unknown',
        platformName: platformName || null,
        platformId: platformId || null,
        linked: !!(platformName || platformId)
    }
}

client.on('ready', () => {
    console.log(`Bot online: ${client.user.tag}`)
})

client.on('messageCreate', async (message) => {
    if (message.author.bot) return
    if (!message.content.startsWith(PREFIX)) return

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/)
    const command = args.shift().toLowerCase()

    if (command === 'check') {
        const input = args[0]
        if (!input) return message.reply('usage: `!check <username or userId>`')

        const loading = await message.reply('🔍 checking...')

        try {
            const userId = await getUserId(input)
            if (!userId) return loading.edit('❌ roblox user not found.')

            const result = await checkPSN(userId)
            if (!result) return loading.edit('❌ failed to fetch profile.')

            const embed = new EmbedBuilder()
                .setTitle(`${result.displayName} (@${result.username})`)
                .setURL(`https://www.roblox.com/users/${userId}/profile`)
                .setColor(result.linked ? 0x00b0f4 : 0x747f8d)
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`)
                .addFields(
                    { name: 'PSN Linked', value: result.linked ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'PSN Username', value: result.platformName ? `[${result.platformName}](https://www.psntools.com/psn/checker/${result.platformName})` : 'N/A', inline: true },
                    { name: 'Platform ID', value: result.platformId ? String(result.platformId) : 'N/A', inline: true },
                    { name: 'Roblox ID', value: String(userId), inline: true }
                )
                .setFooter({ text: 'PSN Checker' })
                .setTimestamp()

            await loading.edit({ content: '', embeds: [embed] })

        } catch (err) {
            console.error(err)
            await loading.edit('❌ error. check railway logs.')
        }
    }
})

client.login(TOKEN)
