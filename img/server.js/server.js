const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { exec } = require('child_process');

(async () => {
    // Launch Puppeteer in headless mode
    const browser = await puppeteer.launch({
        headless: true, // Run in headless mode
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-software-rasterizer'
        ]
    });

    // Initialize WhatsApp client with Puppeteer
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            browser: browser // Use the Puppeteer browser instance
        }
    });

    // Start client
    client.initialize();

    client.on('qr', (qr) => {
        console.log('QR Code:', qr);
    });

    client.on('ready', () => {
        console.log('Client is ready!');
    });

    client.on('message', async (message) => {

        const senderNumber = message.from; // print every single phone number
        console.log(`Message from: ${senderNumber}`);
        try {
            const chat = await message.getChat();
                const groupId = chat.id._serialized;
                const settings = loadGroupSettings(groupId);
    
                if (settings.disableSpam) {
                    const now = Date.now();
                    
                    // Fetch recent messages
                    const messages = await chat.fetchMessages({ limit: 20 });
                    
                    // Ensure messages is an array
                    if (!Array.isArray(messages)) {
                        console.error('Messages is not an array');
                        return;
                    }
    
                    // Track the last message timestamp from the same user
                    const userMessages = messages.filter(msg => msg.from === message.from);
                    if (userMessages.length === 0) {
                        console.log('No recent messages from user');
                        return;
                    }
    
                    // Find the last message from the same user
                    const lastMessage = userMessages[userMessages.length - 1];
                    const lastMessageTime = lastMessage ? lastMessage.timestamp * 1000 : 0;
    
                    // Check if the time between messages is less than the threshold
                    if (lastMessage && (now - lastMessageTime < 30)) { // 30 milliseconds threshold
                        await message.delete();
                        await message.reply('You are sending messages too quickly. Please slow down.');
                        return;
                    }
    
                    
                }
            
    
            // Process commands
            if (message.body.startsWith('!')) {
                const commandName = message.body.split(' ')[0].substring(1).toLowerCase();
                const commandHandler = commands[commandName];
                if (commandHandler) {
                    await commandHandler(message, ...message.body.split(' ').slice(1));
                }
            } else {
                // Determine if the message is from a group or an individual
                if (message.from.includes('g.us')) {
                    // Group message: respond randomly with 0.5% chance
                    const shouldRespond = Math.random() < 0.005; // 0.5% chance
                    if (shouldRespond) {
                        console.log('Decided to respond to group message');
                        const response = await getGradioResponse(message.body);
                        console.log("Group message response:", response);
                        await message.reply(response);
                    } else {
                        console.log('Decided not to respond to group message');
                    }
                } else if (message.from.includes('c.us')) {
                    // Individual message: always respond
                    const response = await getGradioResponse(message.body);
                    console.log("Individual message response:", response);
                    await message.reply(response);
                } else {
                    console.log('Message from unknown source:', message.from);
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
    

    
    // Handle proper cleanup
    process.on('SIGINT', async () => {
        await client.destroy();
        await browser.close();
        process.exit();
    });
})();




async function getGradioResponse(message) {
    try {
        const modulePath = path.resolve(__dirname, './gradioClient.mjs');
        const fileUrl = `file://${modulePath}`;
        const { getGradioResponse } = await import(fileUrl);
        console.log("Getting message from Gradio");

        // Send the message to Gradio and get the response
        const gradioResponse = await getGradioResponse(message);

        // Extract the message from the Gradio response
        if (gradioResponse && gradioResponse.data && Array.isArray(gradioResponse.data) && gradioResponse.data.length > 0) {
            const messageData = gradioResponse.data[0];
            if (typeof messageData === 'string') {
                return messageData;
            }
        }

        console.error('Unexpected Gradio response format:', gradioResponse);
        return 'Sorry, I could not process your request.';
    } catch (error) {
        console.error("Error getting response from Gradio:", error);
        return "Sorry, there was an error processing your request.";
    }
}








// Initialize Express app
const app = express();
const port = 3000;

let botStatus = 'offline';

// Initialize WhatsApp client

const authorizedNumbers = ['94741451992@c.us'];// Add more allowed numbers if needed
const settingsDir = path.join(__dirname, 'group_settings');

// Middleware
app.use(bodyParser.json());

// Utility function to get random phrase
const getRandomPhrase = () => {
    const phrases = [
        '*Did you know Yuki was known as Necron before?* \n ðŸš€ *Loading* ðŸ”„ *âœ¨*',
        '*Yuki started out as a fun joke* \n â³ *Please wait...* ðŸ”„ *ðŸ˜…*',
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
};

// Utility functions for group settings
const ensureSettingsDirExists = () => {
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir);
    }
};

const getGroupSettingsFilePath = (groupId) => {
    return path.join(settingsDir, `${groupId}.json`);
};

const loadGroupSettings = (groupId) => {
    const filePath = getGroupSettingsFilePath(groupId);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return {}; // Return default settings if file does not exist
};

const saveGroupSettings = (groupId, settings) => {
    const filePath = getGroupSettingsFilePath(groupId);
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
};

// Command functions
const commands = {
    async meme(message) {
        await message.reply(getRandomPhrase());

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
        const chat = await message.getChat();
        if (chat.isGroup) {
            await message.reply(`*Group Details* \n*Name:* ${chat.name}\n*Description:* ${chat.description || 'No description'}\n*Created At:* ${chat.createdAt.toString()}\n*Created By:* ${chat.owner.user}\n*Participant count:* ${chat.participants.length}`);
        } else {
            await message.reply(`Oh, I can't see a WhatsApp group here, maybe somewhere else?`);
        }
    },

    async neko(message) {
        const temp = await message.reply(getRandomPhrase());
        const text = message.body.split('!neko ')[1];
        try {
            const nekoUrl = await getRandomNeko();
            const imageBuffer = await downloadImage(nekoUrl);
            const sticker = await createStickerWithText(imageBuffer, text);
            const media = new MessageMedia('image/webp', sticker.toString('base64'), 'sticker');
            await temp.edit(`Order up! ðŸ’â€â™€ï¸, One neko comming right up! `)
            await message.reply(media);
            await temp.edit(`â˜• Powered by Astral Engine`)
        } catch (error) {
            console.error('Error creating neko sticker:', error);
            await message.reply('Sorry, I could not fetch the neko image at the moment.');
        }
    },

    async generateimage(message) {
        const prompt = message.body.split('!generateimage ')[1];
        if (!prompt) {
            await message.reply('Please provide a prompt for the image generation.');
            return;
        }

        try {
            // Generate image with the given prompt
            const imageUrl = await getImageFromGradio(prompt);

            // Check if image URL is valid
            if (!imageUrl || imageUrl === 'Sorry, I could not generate the image.') {
                await message.reply('Sorry, I could not generate the image.');
                return;
            }

            // Download the image
            const imageBuffer = await downloadImage(imageUrl);
            const media = new MessageMedia('image/jpeg', imageBuffer.toString('base64'), 'Generated Image');

            // Send the image
            await message.reply(media);
        } catch (error) {
            console.error('Error generating or sending image:', error);
            await message.reply('Sorry, there was an error generating or sending the image.');
        }
    },

    async ping(message) {
        const startTime = Date.now();
        const tempMessage = await message.reply('Calculating latency...');
        const latency = Date.now() - startTime;
        await tempMessage.edit(`ðŸ“ Pong! Latency is ${latency}ms`);
    },

    async anime(message) {
        const animeName = message.body.slice(7).trim();
        const tempMessage = await message.reply('Fetching anime information...');

        try {
            const response = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(animeName)}&limit=1`);
            const anime = response.data.data[0];

            if (!anime) {
                await tempMessage.edit('Anime not found.');
                return;
            }

            const animeInfo = `
*Title:* ${anime.title}
*Type:* ${anime.type}
*Status:* ${anime.status}
*Episodes:* ${anime.episodes}
*Rating:* ${anime.rating}
*Synopsis:* ${anime.synopsis}
            `;

            const imageResponse = await axios.get(anime.images.jpg.large_image_url, { responseType: 'arraybuffer' });
            const imageData = Buffer.from(imageResponse.data, 'binary').toString('base64');
            const media = new MessageMedia('image/jpeg', imageData, anime.title);

            await tempMessage.edit(animeInfo);
            await message.reply(media);
        } catch (error) {
            console.error(error);
            await tempMessage.edit('An error occurred while fetching anime information.');
        }
    },

    async setafk(message, ...afkMessageParts) {
        const afkMessage = afkMessageParts.join(' ') || 'I am currently AFK.';

        const chat = await message.getChat();
        const groupId = chat.id._serialized;
        const settings = loadGroupSettings(groupId);
        settings.afkMessage = afkMessage;
        saveGroupSettings(groupId, settings);

        await message.reply(`AFK status set: ${afkMessage}`);
    },

    async creator(message) {
        await message.reply(`*Welcome to Yuki, A cute and personal Fun one!â„¢ï¸* \nProject maintained and fixed by Kushi_k \nÂ©ï¸ Astral Axis 2024`);
    },

    async help(message) {
        await message.reply(`*Welcome to Yuki, A cute and personal Fun one!â„¢ï¸* \n *Technical Details* `);
    },

    async roll(message) {
        const result = Math.floor(Math.random() * 6) + 1;
        await message.reply(`ðŸŽ² You rolled a ${result}!`);
    },

    async help(message) {
        await message.reply('*â˜• Command List* \n !meme - Get a random meme\n !groupinfo - Get group info\n !neko [text] - Create a neko sticker with text\n !ping - Check latency\n !anime [name] - Fetch anime information\n !setafk [message] - Set your AFK status\n !creator - Show creator info\n !roll - Roll a dice\n !help - Show this help message\n !premium - Premium features info\n !joke - Get a random joke\n !nospam - Disable spamming');
    },

    async premium(message) {
        await message.reply(`No need for money, Yuki is free for life \n _thank me later_`);
    },

    async joke(message) {
        await message.reply(getRandomPhrase());

        try {
            const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
            const joke = `${response.data.setup}\n${response.data.punchline}`;
            await message.reply(joke);
        } catch (error) {
            console.error('Error fetching joke:', error);
            await message.reply('Sorry, I could not fetch a joke at the moment.');
        }
    },

    async nospam(message) {
        const chat = await message.getChat();
        const groupId = chat.id._serialized;
        const settings = loadGroupSettings(groupId);
        settings.disableSpam = !settings.disableSpam; // Toggle spam setting
        saveGroupSettings(groupId, settings);

        const status = settings.disableSpam ? 'Disabled' : 'Enabled';
        await message.reply(`Spamming is now ${status} for this group.`);
    },
    async bedwars(message) {
        const args = message.body.split(' ');
        const playerName = args[1];
        const interval = args[2] || 'total';
    
        if (!playerName) {
            await message.reply('â— Please provide a player name.');
            return;
        }
    
        if (!['weekly', 'monthly', 'yearly', 'total'].includes(interval)) {
            await message.reply('âŒ Invalid interval. Please choose from `weekly`, `monthly`, `yearly`, or `total`.');
            return;
        }
    
        try {
            // Example of a fun message with emojis
            const temp = await message.reply('ðŸŽ‰ Fetching stats... Please wait! â³');
    
            const statsResponse = await axios.get(`https://stats.pika-network.net/api/profile/${playerName}/leaderboard?type=bedwars&interval=${interval}&mode=ALL_MODES`);
            const stats = statsResponse.data;
    
            if (!stats) {
                await temp.edit('*âš ï¸ No stats found for this player.*');
                return;
            }
    
            // Emojis and styling for the response
            let responseMessage = `ðŸŒŸ *Bedwars Stats for ${playerName}* ðŸŒŸ\n\n`;
            responseMessage += `ðŸ” *Interval:* ${interval.charAt(0).toUpperCase() + interval.slice(1)}\n\n`;
    
            // Build stats message
            Object.entries(stats).forEach(([key, value]) => {
                const entry = value.entries.find(e => e.id === playerName);
                const emoji = getStatEmoji(key);
                const statValue = entry ? entry.value : 'No data';
                responseMessage += `${emoji} *${key}:* ${statValue}\n`;
            });
    
            responseMessage += `\nðŸ“Š *Updated Stats* ðŸ“Š`;
    
            await temp.edit(responseMessage);
        } catch (error) {
            console.error('Error fetching Bedwars stats:', error);
            await temp.edit('ðŸš¨ Sorry, I could not fetch Bedwars stats at the moment. Please try again later.');
        }
    },
    
    // Helper function to get emoji based on stat type
    
    



    /*
    
.______     ______   ____    __    ____  _______ .______           ______   ______   .___  ___. .___  ___.      ___      .__   __.  _______       _______.
|   _  \   /  __  \  \   \  /  \  /   / |   ____||   _  \         /      | /  __  \  |   \/   | |   \/   |     /   \     |  \ |  | |       \     /       |
|  |_)  | |  |  |  |  \   \/    \/   /  |  |__   |  |_)  |       |  ,----'|  |  |  | |  \  /  | |  \  /  |    /  ^  \    |   \|  | |  .--.  |   |   (----`
|   ___/  |  |  |  |   \            /   |   __|  |      /        |  |     |  |  |  | |  |\/|  | |  |\/|  |   /  /_\  \   |  . `  | |  |  |  |    \   \    
|  |      |  `--'  |    \    /\    /    |  |____ |  |\  \----.   |  `----.|  `--'  | |  |  |  | |  |  |  |  /  _____  \  |  |\   | |  '--'  |.----)   |   
| _|       \______/      \__/  \__/     |_______|| _| `._____|    \______| \______/  |__|  |__| |__|  |__| /__/     \__\ |__| \__| |_______/ |_______/    
                                                                                                                                                          

    
    */

    

   async restart(message) {
        if (authorizedNumbers.includes(message.from)) {
            await message.reply('Restarting the bot...');
            exec('pm2 restart yuki', (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error restarting bot: ${error}`);
                    message.reply('Failed to restart the bot.');
                    return;
                }
                console.log(`Bot restarted: ${stdout}`);
            });
        } else {
            await message.reply('You are not authorized to use this command.');
        }
    },

    async status(message) {
        const args = message.body.split(' ');
        const command = args[1]; // Example: '!status online'
    
        if (args.length < 2) {
            return message.reply('Please provide a status (online, offline, or maintenance).');
        }
    
        if (!['online', 'offline', 'maintenance'].includes(command)) {
            return message.reply('Invalid status. Please use one of the following: online, offline, maintenance.');
        }
    
        if (authorizedNumbers.includes(message.from)) {
            botStatus = command;
            await message.reply(`Bot status updated to ${botStatus}`);
        } else {
            await message.reply('You are not authorized to change the bot status.');
        }
    },

    async stop(message) {
        if (authorizedNumbers.includes(message.from)) {
            await message.reply('Stopping the bot...');
            exec('pm2 stop yuki', (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error stopping bot: ${error}`);
                    message.reply('Failed to stop the bot.');
                    return;
                }
                console.log(`Bot stopped: ${stdout}`);
            });
        } else {
            await message.reply('You are not authorized to use this command.');
        }
    }


};

// Handle incoming messages





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

async function getRandomMeme() {
    try {
        const response = await axios.get('https://meme-api.com/gimme');
        return response.data.url;
    } catch (error) {
        console.error('Error fetching meme:', error);
        return 'https://example.com/default-meme.jpg'; // Fallback URL
    }
}

function getStatEmoji(statType) {
    switch (statType.toLowerCase()) {
        case 'wins': return 'ðŸ†';
        case 'kills': return 'ðŸ—¡ï¸';
        case 'deaths': return 'ðŸ’€';
        case 'beds': return 'ðŸ›ï¸';
        case 'coins': return 'ðŸ’°';
        default: return 'â©';
    }
}




/*

     ___      .______    __  
    /   \     |   _  \  |  | 
   /  ^  \    |  |_)  | |  | 
  /  /_\  \   |   ___/  |  |  
 /  _____  \  |  |      |  | 
/__/     \__\ | _|      |__| 
                             
*/

app.get('/status', (req, res) => {
    res.json({ status: botStatus });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
