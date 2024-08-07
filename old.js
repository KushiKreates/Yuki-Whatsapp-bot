const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

// Initialize client
const client = new Client({
    authStrategy: new LocalAuth(),
});

const allowedNumbers = ['+94741451992']; // Add more allowed numbers if needed

///client.on('loading_screen', (percent, message) => {
    ///console.log('Booting, Using Nadhi.js v-1', percent, message);
///});

const commands = {
    async meme(message) {
        await message.reply('🔄 **Loading**');
        try {
            const memeUrl = await getRandomMeme();
            const media = await downloadImage(memeUrl);
            const sticker = new MessageMedia('image/webp', media.toString('base64'), 'sticker');
            await message.reply(sticker);
        } catch (error) {
            console.error('Error creating meme sticker:', error);
            await message.reply('Sorry, I could not fetch the meme at the moment.');
        }
    },
    
    async groupinfo(message) {
        let chat = await message.getChat();
        if (chat.isGroup) {
            message.reply(`*Group Details* \n*Name:* ${chat.name}\n*Description:* ${chat.description}\n*Created At:* ${chat.createdAt.toString()}\n*Created By:* ${chat.owner.user}\n*Participant count:* ${chat.participants.length}`);
        } else {
            message.reply('This command can only be used in a group!');
        }
    },
    
    async neko(message) {
        await message.reply('🔄 *Loading*');
        const text = message.body.split('!neko ')[1];
        try {
            const nekoUrl = await getRandomNeko();
            const imageBuffer = await downloadImage(nekoUrl);
            const sticker = await createStickerWithText(imageBuffer, text);
            const media = new MessageMedia('image/webp', sticker.toString('base64'), 'sticker');
            await message.reply(media);
        } catch (error) {
            console.error('Error creating neko sticker:', error);
            await message.reply('Sorry, I could not fetch the neko image at the moment.');
        }

        async bedwars(message) {
            const args = message.body.split(' ');
            const playerName = args[1];
            const interval = args[2] || 'total';
    
            if (!playerName) {
                await message.reply('Please provide a player name.');
                return;
            }
    
            if (!['weekly', 'monthly', 'yearly', 'total'].includes(interval)) {
                await message.reply('Invalid interval. Please choose from weekly, monthly, yearly, or total.');
                return;
            }
    
            try {
                await message.reply(getRandomPhrase());
    
                const statsResponse = await axios.get(`https://stats.pika-network.net/api/profile/${playerName}/leaderboard?type=bedwars&interval=${interval}&mode=ALL_MODES`);
                const stats = statsResponse.data;
    
                if (!stats) {
                    await message.reply('No stats found for this player.');
                    return;
                }
    
                let skinImageUrl = defaultSkinUrl;
                try {
                    skinImageUrl = `https://starlightskins.lunareclipse.studio/render/marching/${playerName}/full`;
                } catch (error) {
                    console.warn('Player skin fetch failed, using default image.');
                }
    
                const skinImageResponse = await axios.get(skinImageUrl, { responseType: 'arraybuffer' });
                const skinImageBuffer = Buffer.from(skinImageResponse.data);
    
                const canvas = createCanvas(500, 500);
                const ctx = canvas.getContext('2d');
    
                const gradient = ctx.createLinearGradient(0, 0, 500, 500);
                gradient.addColorStop(0, '#ff9a9e');
                gradient.addColorStop(1, '#fad0c4');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
    
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 5;
                ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
                const skinImage = await loadImage(skinImageBuffer);
                ctx.save();
                ctx.beginPath();
                ctx.arc(150, 150, 100, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(skinImage, 50, 50, 200, 200);
                ctx.restore();
    
                ctx.fillStyle = '#333';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(`Player: ${playerName}`, 180, 40);
    
                const statsEntries = Object.entries(stats).map(([key, value]) => {
                    const entry = value.entries.find(e => e.id === playerName);
                    return entry ? `${key}: ${entry.value}` : `${key}: No data`;
                }).join('\n');
    
                ctx.fillText(`Stats:\n${statsEntries}`, 180, 80);
    
                const outputBuffer = canvas.toBuffer('image/png');
                const outputBase64 = outputBuffer.toString('base64');
                const media = new MessageMedia('image/png', outputBase64, 'stats');
    
                await message.reply(media);
            } catch (error) {
                console.error('Error fetching Bedwars stats:', error);
                await message.reply('Sorry, I could not fetch Bedwars stats at the moment.');
            }
        }
    },

    async waifu(message) {
        const femboyName = message.body.split(' ')[1];
        const imagePath = './img/yuki.webp';
        const imageData = fs.readFileSync(imagePath);
        const base64Image = imageData.toString('base64');

        const media = new MessageMedia('image/webp', base64Image, 'yuki');
        await message.reply(media);
        await message.reply(`☕ The content you have requested might be 🔞 or 18+, 🤖 Yuki is not responsible for what you do! \n *Run _!waifumax18 ${femboyName}_ to confirm this action* ✅`);
    },

    async waifumax(message) {
        const imagePath = './img/yuki.webp';
        const imageData = fs.readFileSync(imagePath);
        const base64Image = imageData.toString('base64');

        const media = new MessageMedia('image/webp', base64Image, 'yuki');
        await message.reply(media);
        const femboyName = message.body.split(' ')[1];
        await message.reply(`☕ The content you have requested might be 🔞 or 18+, 🤖 Yuki is not responsible for what you do! \n *Run _!waifumax18 ${femboyName}_ to confirm this action* ✅`);
    },

    
    async ping(message) {
        const startTime = Date.now();
        await message.reply('🔄 *Loading*');
        const latency = Date.now() - startTime;
        await message.reply(`🏓 Pong! Latency is ${latency}ms`);
    },
    
    async creator(message) {
        await message.reply(`*Welcome to Yuki, A cute and personal Fun one!™️* \nProject maintained and fixed by Kushi_k \n©️ Astral Axis 2024`);
    },
    
    async roll(message) {
        const result = Math.floor(Math.random() * 6) + 1;
        await message.reply(`🎲 You rolled a ${result}!`);
    },
    
    async joke(message) {
        await message.reply('🔄 *Loading*');
        try {
            const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
            const joke = `${response.data.setup}\n${response.data.punchline}`;
            await message.reply(joke);
        } catch (error) {
            console.error('Error fetching joke:', error);
            await message.reply('Sorry, I could not fetch a joke at the moment.');
        }
    },
    
    async bedwars(message) {
        await message.reply('🔄 *Loading*');
        const args = message.body.split(' ');
        const playerName = args[1];
        const interval = args[2] || 'total'; // Default to 'total' if no interval is provided

        if (!playerName) {
            await message.reply('Please provide a player name.');
            return;
        }

        if (!['weekly', 'monthly', 'yearly', 'total'].includes(interval)) {
            await message.reply('Invalid interval. Please choose from weekly, monthly, yearly, or total.');
            return;
        }

        try {
            const response = await axios.get(`https://stats.pika-network.net/api/profile/${playerName}/leaderboard?type=bedwars&interval=${interval}&mode=ALL_MODES`);
            const stats = response.data;

            if (stats) {
                const formattedStats = Object.entries(stats).map(([key, value]) => {
                    const entry = value.entries.find(e => e.id === playerName);
                    if (entry) {
                        return `${key}: ${entry.value}`;
                    }
                    return `${key}: No data available`;
                }).join('\n');

                await message.reply(`📊 **Bedwars Stats for ${playerName} (${interval})**:\n${formattedStats}`);
            } else {
                await message.reply('No stats found for this player.');
            }
        } catch (error) {
            console.error('Error fetching Bedwars stats:', error);
            await message.reply('Sorry, I could not fetch the Bedwars stats at the moment.');
        }
    },

    async femboy(message) {
        const args = message.body.split(' ');
        const femboyName = args[1];

        if (!femboyName) {
            await message.reply('Please provide a femboy name.');
            return;
        }

        await message.reply('🔄 *Loading*');
        try {
            const response = await axios.get(`https://femboyfinder.firestreaker2.gq/api/${femboyName}`);
            const imageUrl = response.data.URL;

            const imageBuffer = await downloadImage(imageUrl);
            const sticker = await createResizedSticker(imageBuffer);
            const media = new MessageMedia('image/webp', sticker.toString('base64'), 'sticker');
            await message.reply(media);
        } catch (error) {
            console.error('Error fetching femboy image:', error);
            await message.reply('Sorry, I could not fetch the femboy image at the moment.');
        }
    },

    async femboymax(message) {
        const args = message.body.split(' ');
        const femboyName = args[1];

        if (!femboyName) {
            await message.reply('Please provide a femboy name.');
            return;
        }

        const senderNumber = message.from;

        if (!allowedNumbers.includes(senderNumber)) {
            await message.reply('You do not have permission to use this command.');
            return;
        }

        await message.reply('🔄 **Loading**');
        try {
            const response = await axios.get(`https://femboyfinder.firestreaker2.gq/api/${femboyName}`);
            const imageUrl = response.data.URL;

            const imageBuffer = await downloadImage(imageUrl);
            const media = new MessageMedia('image/jpeg', imageBuffer.toString('base64'), 'image');
            await message.reply(media);
        } catch (error) {
            console.error('Error fetching femboy image:', error);
            await message.reply('Sorry, I could not fetch the femboy image at the moment.');
        }
    },
};

// Event handler for QR code generation
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Event handler for client ready
client.on('ready', () => {
    console.log('Client is ready!');
});

// Handle incoming messages


// Function to get a random meme
async function getRandomMeme() {
    try {
        const response = await axios.get('https://meme-api.com/gimme');
        return response.data.url;
    } catch (error) {
        console.error('Error fetching meme:', error);
        return 'https://example.com/default-meme.jpg'; // Fallback URL
    }
}

// Function to get a random neko girl image
async function getRandomNeko() {
    try {
        const response = await axios.get('https://nekos.life/api/v2/img/neko');
        return response.data.url;
    } catch (error) {
        console.error('Error fetching neko image:', error);
        return 'https://example.com/default-neko.jpg'; // Fallback URL
    }
}

// Function to download image
async function downloadImage(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data, 'binary');
    } catch (error) {
        console.error('Error downloading image:', error);
        throw error;
    }
}

// Function to create a sticker with text
async function createStickerWithText(imageBuffer, text) {
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);
    ctx.font = '30px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(text, image.width / 2, image.height - 30);

    return canvas.toBuffer('image/webp');
}

// Function to create a resized sticker
async function createResizedSticker(imageBuffer) {
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(512, 512); // Resize to 512x512
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0, 512, 512);
    return canvas.toBuffer('image/webp');
}

// Initialize the client
client.initialize();
