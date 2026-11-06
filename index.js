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

async function getPSNProfile(psnUsername) {
    try {
        const res = await axios.get(
            `https://psnprofiles.com/${psnUsername}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        )
        const html = res.data

        const country = html.match(/class="flag-icon flag-icon-([a-z]{2})"/)?.[1]?.toUpperCase() || null
        const level = html.match(/class="level">(\d+)</)?.[1] || null
        const platinum = html.match(/class="trophy platinum"[^>]*>(\d+)/)?.[1] || null
        const gold = html.match(/class="trophy gold"[^>]*>(\d+)/)?.[1] || null
        const silver = html.match(/class="trophy silver"[^>]*>(\d+)/)?.[1] || null
        const bronze = html.match(/class="trophy bronze"[^>]*>(\d+)/)?.[1] || null
        const avatarUrl = html.match(/<img[^>]+id="avatar"[^>]+src="([^"]+)"/)?.[1] || null

        return {
            country,
            level,
            platinum,
            gold,
            silver,
            bronze,
            avatarUrl,
        }
    } catch (err) {
        console.error('PSN profile scrape failed:', err?.message)
        return null
    }
}

const COUNTRY_NAMES = {
    AF: '🇦🇫 Afghanistan', AL: '🇦🇱 Albania', DZ: '🇩🇿 Algeria',
    AR: '🇦🇷 Argentina', AU: '🇦🇺 Australia', AT: '🇦🇹 Austria',
    BE: '🇧🇪 Belgium', BR: '🇧🇷 Brazil', CA: '🇨🇦 Canada',
    CL: '🇨🇱 Chile', CN: '🇨🇳 China', CO: '🇨🇴 Colombia',
    HR: '🇭🇷 Croatia', CZ: '🇨🇿 Czech Republic', DK: '🇩🇰 Denmark',
    EG: '🇪🇬 Egypt', FI: '🇫🇮 Finland', FR: '🇫🇷 France',
    DE: '🇩🇪 Germany', GR: '🇬🇷 Greece', HK: '🇭🇰 Hong Kong',
    HU: '🇭🇺 Hungary', IN: '🇮🇳 India', ID: '🇮🇩 Indonesia',
    IE: '🇮🇪 Ireland', IL: '🇮🇱 Israel', IT: '🇮🇹 Italy',
    JP: '🇯🇵 Japan', JO: '🇯🇴 Jordan', KW: '🇰🇼 Kuwait',
    LB: '🇱🇧 Lebanon', MY: '🇲🇾 Malaysia', MX: '🇲🇽 Mexico',
    MA: '🇲🇦 Morocco', NL: '🇳🇱 Netherlands', NZ: '🇳🇿 New Zealand',
    NG: '🇳🇬 Nigeria', NO: '🇳🇴 Norway', OM: '🇴🇲 Oman',
    PK: '🇵🇰 Pakistan', PE: '🇵🇪 Peru', PH: '🇵🇭 Philippines',
    PL: '🇵🇱 Poland', PT: '🇵🇹 Portugal', QA: '🇶🇦 Qatar',
    RO: '🇷🇴 Romania', RU: '🇷🇺 Russia', SA: '🇸🇦 Saudi Arabia',
    RS: '🇷🇸 Serbia', SG: '🇸🇬 Singapore', ZA: '🇿🇦 South Africa',
    KR: '🇰🇷 South Korea', ES: '🇪🇸 Spain', SE: '🇸🇪 Sweden',
    CH: '🇨🇭 Switzerland', TW: '🇹🇼 Taiwan', TH: '🇹🇭 Thailand',
    TR: '🇹🇷 Turkey', UA: '🇺🇦 Ukraine', AE: '🇦🇪 UAE',
    GB: '🇬🇧 United Kingdom', US: '🇺🇸 United States', VN: '🇻🇳 Vietnam',
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
        if (!input) return message.reply('usage: `!check <roblox username or userId>`')

        const loading = await message.reply('🔍 checking roblox...')

        try {
            const userId = await getUserId(input)
            if (!userId) return loading.edit('❌ roblox user not found.')

            const result = await checkPSN(userId)
            if (!result) return loading.edit('❌ failed to fetch roblox profile.')

            const embed = new EmbedBuilder()
                .setTitle(`${result.displayName} (@${result.username})`)
                .setURL(`https://www.roblox.com/users/${userId}/profile`)
                .setColor(result.linked ? 0x00b0f4 : 0x747f8d)
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`)
                .addFields(
                    { name: 'PSN Linked', value: result.linked ? '✅ Yes' : '❌ No', inline: true },
                    { name: 'PSN Username', value: result.platformName ? `[${result.platformName}](https://psnprofiles.com/${result.platformName})` : 'N/A', inline: true },
                    { name: 'Platform ID', value: result.platformId ? String(result.platformId) : 'N/A', inline: true },
                    { name: 'Roblox ID', value: String(userId), inline: true }
                )
                .setFooter({ text: 'PSN Checker' })
                .setTimestamp()

            if (result.linked && result.platformName) {
                await loading.edit({ content: '🔍 fetching PSN profile...', embeds: [] })

                const psnProfile = await getPSNProfile(result.platformName)

                if (psnProfile) {
                    if (psnProfile.avatarUrl) {
                        embed.setThumbnail(psnProfile.avatarUrl)
                    }
                    if (psnProfile.country) {
                        const countryDisplay = COUNTRY_NAMES[psnProfile.country] || psnProfile.country
                        embed.addFields({ name: '🌍 Location', value: countryDisplay, inline: true })
                    }
                    if (psnProfile.level) {
                        embed.addFields({ name: '🎮 PSN Level', value: psnProfile.level, inline: true })
                    }
                    const hasAnyTrophy = psnProfile.platinum || psnProfile.gold || psnProfile.silver || psnProfile.bronze
                    if (hasAnyTrophy) {
                        embed.addFields({
                            name: '🏆 Trophies',
                            value: [
                                `🏅 Platinum: ${psnProfile.platinum || 0}`,
                                `🥇 Gold: ${psnProfile.gold || 0}`,
                                `🥈 Silver: ${psnProfile.silver || 0}`,
                                `🥉 Bronze: ${psnProfile.bronze || 0}`,
                            ].join('  |  '),
                            inline: false
                        })
                    }
                } else {
                    embed.addFields({ name: '🌍 Location', value: 'Private / Not found', inline: true })
                }
            }

            await loading.edit({ content: '', embeds: [embed] })

        } catch (err) {
            console.error(err)
            await loading.edit('❌ something went wrong. check railway logs.')
        }
    }

    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('PSN Checker — Commands')
            .setColor(0x00b0f4)
            .addFields(
                { name: '!check <username or id>', value: 'Check if a Roblox user has PSN linked and shows their PSN profile info + location', inline: false },
                { name: '!help', value: 'Shows this message', inline: false }
            )
            .setFooter({ text: 'PSN Checker' })
        message.reply({ embeds: [embed] })
    }
})

client.login(TOKEN)
