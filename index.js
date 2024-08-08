const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { exec } = require('child_process');
const util = require('util');








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
const cooldowns = new Set();

let botStatus = 'offline';


const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--log-level=3",
            "--no-default-browser-check",
            "--disable-site-isolation-trials",
            "--no-experiments",
            "--ignore-gpu-blacklist",
            "--ignore-certificate-errors",
            "--ignore-certificate-errors-spki-list",
            "--enable-gpu",
            // "--disable-extensions",
            "--disable-default-apps",
            "--enable-features=NetworkService",
            "--disable-webgl",
            "--disable-threaded-animation",
            "--disable-threaded-scrolling",
            "--disable-in-process-stack-traces",
            "--disable-histogram-customizer",
            "--disable-gl-extensions",
            "--disable-composited-antialiasing",
            "--disable-canvas-aa",
            "--disable-3d-apis",
            "--disable-accelerated-2d-canvas",
            "--disable-accelerated-jpeg-decoding",
            "--disable-accelerated-mjpeg-decode",
            "--disable-app-list-dismiss-on-blur",
            "--disable-accelerated-video-decode"
          ]
    }
});

const authorizedNumbers = ['94741451992@c.us'];// Add more allowed numbers if needed
const settingsDir = path.join(__dirname, 'group_settings');

// Middleware
app.use(bodyParser.json());

// Utility function to get random phrase
const getRandomPhrase = () => {
    const phrases = [
        '*Be a Sponsor to have stuff here! 🌸 Wanna advertise your Whatsapp group? ☕ pay 1 dollar to get a spot here!* \n \n  *Loading* 🌸\n\n **',
        '*Fastest way to Advertise your Whatsapp group 🌸, Become a partner today! 💰 Starting from $1 dollar.* \n \n 🌸 *Please wait...*',
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

    async eval(message) {
        // Check if the sender is authorized
        const authorizedUsers = ['94741451992@c.us']; // Replace with authorized user IDs
        if (!authorizedUsers.includes(message.from)) {
            return await message.reply('🌸 This command is out of your reach');
        }
    
        // Extract the code from the message
        const code = message.body.split('!eval ')[1];
        if (!code) {
            return await message.reply('Please provide code to evaluate.');
        }
    
        try {
            // Evaluate the code
            let result;
            try {
                result = await eval(code); // Use with caution
            } catch (error) {
                result = `Error evaluating code: ${error.message}`;
            }
    
            // Send the result
            await message.reply(`Result:\n\`\`\`js\n${result}\n\`\`\``);
        } catch (error) {
            console.error('Error executing eval command:', error);
            await message.reply('An error occurred while processing the code.');
        }
    },



    async neko(message) {
        const userId = message.from; // Get the user ID or phone number
    
        // Check if the user is on cooldown
        if (cooldowns.has(userId)) {
            return await message.reply('⏳ Please wait 10 seconds before using this command again.');
        }
    
        // Set the user on cooldown
        cooldowns.add(userId);
        
        // Remove the user from the cooldown after 10 seconds
        setTimeout(() => {
            cooldowns.delete(userId);
        }, 10000); // 10 seconds
    
        // Proceed with the command
        const temp = await message.reply(getRandomPhrase());
        const text = message.body.split('!neko ')[1];
        
        try {
            const nekoUrl = await getRandomNeko();
            const imageBuffer = await downloadImage(nekoUrl);
            const sticker = await createStickerWithText(imageBuffer, text);
            const media = new MessageMedia('image/webp', sticker.toString('base64'), 'sticker');
            
            await temp.edit(`Order up! 💁‍♀️, One neko coming right up!`);
            await message.reply(media);
            await temp.edit(`🌸 Powered by Astral Engine`);
        } catch (error) {
            console.error('Error creating neko sticker:', error);
            await message.reply('🌸 Sorry, I could not fetch the neko image at the moment.');
        }
    },

    async generateimage(message) {
        const prompt = message.body.split('!generateimage ')[1];
        if (!prompt) {
            await message.reply('🌸 Please provide a prompt for the image generation.');
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
        try {
            // Send initial reply
            await message.reply(getRandomPhrase());
    
            // Calculate latency
            const startTime = Date.now();
            console.log("Pinger active")
            const latency = Date.now() - startTime;
    
            // Update the message with the latency
            await message.reply(`🌸 Pong! Latency is ${latency}ms`);
        } catch (error) {
            console.error('Error while calculating latency:', error);
            await message.reply('An error occurred while calculating latency.');
        }
    },
    
    

    async anime(message) {
        const animeName = message.body.slice(7).trim();
        const tempMessage = await message.reply('🌸 Fetching anime information...');

        try {
            const response = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(animeName)}&limit=1`);
            const anime = response.data.data[0];

            if (!anime) {
                await tempMessage.edit('Anime not found. 🥲');
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
        await message.reply(`*Hello there! 🌸, Im Yuki.*`);
    },

    async advertise(message) {
        await message.reply(`*Hello there 👋, Contact - 94741451992* \n\n *Pricing* 🪙 1 month for 1 dollar!`);
    },


    

    async roll(message) {
        const result = Math.floor(Math.random() * 6) + 1;
        await message.reply(`🎲 You rolled a ${result}!`);
    },

    async help(message) {
        await message.reply('*🌸 Command List* \n !meme - Get a random meme\n !groupinfo - Get group info\n !neko [text] - Create a neko sticker with text\n !ping - Check latency\n !anime [name] - Fetch anime information\n !setafk [message] - Set your AFK status\n !creator - Show creator info\n !roll - Roll a dice\n !help - Show this help message\n !premium - Premium features info\n !joke - Get a random joke\n !nospam - Disable spamming\n !kiss [Person name here] - Send little kiss to someone special\n !hug [Person name here]\n !mcskin [Minecraft Username]\n ');
    },

    async bot(message) {
        await message.reply(`*Yuki Version 0.2* \n *Built using WWeb.js* 🌸 \n *Technical Details 🔧* \n *Node｡JS v22 🌲*, 🤗 *Huggingface AI* \n 🔗 https://astralaxis.one 🆑 (Sakura Edition)   `);
    },

    async joke(message) {
        const temp = await message.reply(getRandomPhrase());

        try {
            const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
            const joke = `${response.data.setup}\n${response.data.punchline}`;
            await temp.edit(joke);
        } catch (error) {
            console.error('Error fetching joke:', error);
            await temp.edit('Sorry, I could not fetch a joke at the moment.');
        }
    },

    async id(message) {
        // Retrieve the user's ID from the message
        const userId = message.from;
        
        // Construct the reply message
        const replyMessage = `🌸 ${userId} is your ID`;
    
        try {
            // Send the message directly to the user
            await client.sendMessage(userId, replyMessage);
            console.log(`Message sent to ${userId}: ${replyMessage}`);
        } catch (err) {
            console.error('Error sending message:', err);
        }
    },

    async kiss(message) {
        try {
            // Check if a person name is provided
            const args = message.body.split(' ').slice(1).join(' ');
            if (!args) {
                return await message.reply('You need to specify a name to send a kiss! 💋 _Baka_');
            }
    
            // Fetch a random kiss image URL
            const response = await axios.get('https://nekos.best/api/v2/kiss');
            const ImageUrl = response.data.results[0].url;
    
            // Download the kiss image
            
            const media = await MessageMedia.fromUrl(ImageUrl);
            //await client.sendMessage(msg.from, media);
            
    
            // Send the kiss message
            await message.reply(`💋 ${args} has been sent a kiss!`);
    
            // Send the kiss sticker
            await message.reply(media);
    
        } catch (error) {
            console.error('Error while sending kiss message:', error);
            await message.reply('An error occurred while sending the kiss message.');
        }
    },

    async bonk(message) {
        try {
            const args = message.body.split(' ').slice(1).join(' ');
            if (!args) {
                return await message.reply('Please provide a name to add to the image.');
            }
    
            const imageUrl = 'https://i.ytimg.com/vi/OGdwsJHZ-Fo/maxresdefault.jpg';
    
            // Download the image
            const imageResponse = await axios({
                url: imageUrl,
                responseType: 'arraybuffer'
            });
            const imageBuffer = Buffer.from(imageResponse.data, 'binary');
    
            // Load the image
            const image = await loadImage(imageBuffer);
    
            // Create a canvas and draw the image
            const canvas = createCanvas(512, 512);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, 512, 512);
    
            // Set text properties
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
    
            // Calculate the text width and background rectangle dimensions
            const textWidth = ctx.measureText(args).width;
            const textHeight = 50; // Height of the text background
            const x = 356; // Centered horizontally
            const y = 181; // Positioned vertically
    
            // Draw a fully grey background for the text
            ctx.fillStyle = 'grey';
            ctx.fillRect(x - textWidth / 2 - 10, y - textHeight / 2 - 10, textWidth + 20, textHeight + 20);
    
            // Draw the text on top of the background
            ctx.fillStyle = 'white';
            ctx.fillText(args, x, y);
    
            // Convert canvas to buffer
            const outputBuffer = canvas.toBuffer('image/png');
    
            // Create MessageMedia object
            const media = new MessageMedia('image/png', outputBuffer.toString('base64'), 'bonk-image');
    
            // Send the image with text overlay
            await message.reply(`*${args}* has been brutally Violated. This means he is not a sigma 🥶`);
            await message.reply(media);
    
        } catch (error) {
            console.error('Error while processing the bonk image:', error);
            await message.reply('An error occurred while creating the bonk image.');
        }
    },

    async stfu(message) {
        try {
            const args = message.body.split(' ').slice(1).join(' ');
            if (!args) {
                return await message.reply('Please provide a name to add to the image.');
            }
    
            const imageUrl = 'https://media.makeameme.org/created/please-stfu-thanks.jpg';
    
            // Download the image
            const imageResponse = await axios({
                url: imageUrl,
                responseType: 'arraybuffer'
            });
            const imageBuffer = Buffer.from(imageResponse.data, 'binary');
    
            // Load the image
            const image = await loadImage(imageBuffer);
    
            // Create a canvas and draw the image
            const canvas = createCanvas(512, 512);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, 512, 512);
    
            // Set text properties
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
    
            
            const textWidth = ctx.measureText(args).width;
            const textHeight = 50; 
            const x = 256; 
            const y = 361; 
    
            // Draw a fully grey background for the text
            ctx.fillStyle = 'grey';
            ctx.fillRect(x - textWidth / 2 - 10, y - textHeight / 2 - 10, textWidth + 20, textHeight + 20);
    
            // Draw the text on top of the background
            ctx.fillStyle = 'white';
            ctx.fillText(args, x, y);
    
            // Convert canvas to buffer
            const outputBuffer = canvas.toBuffer('image/png');
    
            // Create MessageMedia object
            const media = new MessageMedia('image/png', outputBuffer.toString('base64'), 'bonk-image');
    
            // Send the image with text overlay
            await message.reply(`${args} has been brutally Violated. This means he is not a sigma 🥶`);
            await message.reply(media);
    
        } catch (error) {
            console.error('Error while processing the bonk image:', error);
            await message.reply('An error occurred while creating the bonk image.');
        }
    },

    

    async mcskin(message) {
        try {
            // Extract the Minecraft username and render type from the message

            const temp = await message.reply(getRandomPhrase());
            const args = message.body.split(' ').slice(1);
            const username = args[0];
            const renderType = args[1] || 'full'; // Default to 'full' if no render type is provided
    
            // Validate the render type
            const validRenderTypes = ['full', 'bust', 'head'];
            if (!validRenderTypes.includes(renderType)) {
                return await message.reply('😕 Invalid render type. Please use one of the following: full, bust, head.');
            }
    
            // Construct the URL for the Minecraft skin
            const skinUrl = `https://starlightskins.lunareclipse.studio/render/ultimate/${username}/${renderType}`;
    
            // Download the image
            const response = await axios({
                url: skinUrl,
                responseType: 'arraybuffer'
            });
    
            // Convert the image to base64
            const imageBuffer = Buffer.from(response.data, 'binary');
            const base64Image = imageBuffer.toString('base64');
    
            // Create a MessageMedia object
            const media = new MessageMedia('image/png', base64Image, 'minecraft-skin');
    
            // Send the success message and the skin image
            await temp.edit(`🙌 Hooray! *We found your skin!*`);
            await message.reply(media);
    
        } catch (error) {
            console.error('Error while sending Minecraft skin message:', error);
            await message.reply('Oops ⛔, No skin found. \n\n *☕ This does not support TLauncher*');
        }
    },

    async mcserver(message) {
        try {
            // Extract IP from the message
            const args = message.body.split(' ').slice(1).join(' ');
            if (!args) {
                return await message.reply('😕 Please provide a Minecraft server IP address.');
            }
    
            // Define the API URL with the server IP
            const apiUrl = `https://mcapi.us/server/status?ip=${args}`;
    
            // Fetch server status from the API
            const response = await axios.get(apiUrl);
            const data = response.data;

            const temp = await message.reply(getRandomPhrase());
    
            // Check if the server is online
            if (data.online) {
                await temp.edit(`🌟 The Minecraft server at ${args} is online!\n 📊 Server Info:\n - IP: ${args}\n - Players Online: ${data.players.now}\n`);
                
            } else {
                await temp.edit(`*😞 The Minecraft server at ${args} is offline.*`);
            }
        } catch (error) {
            console.error('Error while checking Minecraft server status:', error);
            await message.reply('Oops ⛔, Unable to check the server status.');
        }
    },
    
    async hug(message) {
        try {
            // Check if a person name is provided
            const args = message.body.split(' ').slice(1).join(' ');
            if (!args) {
                return await message.reply('You need to specify a name to send a hug 🤗 _Baka_');
            }
    
            // Fetch a random kiss image URL
            const response = await axios.get('https://nekos.best/api/v2/hug');
            const ImageUrl = response.data.results[0].url;
    
            // Download the kiss image
            
            const media = await MessageMedia.fromUrl(ImageUrl);
            //await client.sendMessage(msg.from, media);
    
            // Create a sticker
            
    
            // Send the kiss message
            await message.reply(`🤗 ${args} has been sent a hug.`);
    
            // Send the kiss sticker
            await message.reply(media);
    
        } catch (error) {
            console.error('Error while sending kiss message:', error);
            await message.reply('An error occurred while sending the hug message.');
        }
    },


    async nospam(message) {
        const chat = await message.getChat();
        const groupId = chat.id._serialized;
        const settings = loadGroupSettings(groupId);
        settings.disableSpam = !settings.disableSpam; 
        saveGroupSettings(groupId, settings);

        const status = settings.disableSpam ? 'Disabled' : 'Enabled';
        await message.reply(`Spamming is now ${status} for this group.`);
    },
    async bedwars(message) {
        const args = message.body.split(' ');
        const playerName = args[1];
        const interval = args[2] || 'total';
    
        if (!playerName) {
            await message.reply('🤗 Please provide a player name.');
            return;
        }
    
        if (!['weekly', 'monthly', 'yearly', 'total'].includes(interval)) {
            await message.reply('🌸 Invalid interval. Please choose from `weekly`, `monthly`, `yearly`, or `total`.');
            return;
        }
    
        try {
            
            const temp = await message.reply(getRandomPhrase());
    
            const statsResponse = await axios.get(`https://stats.pika-network.net/api/profile/${playerName}/leaderboard?type=bedwars&interval=${interval}&mode=ALL_MODES`);
            const stats = statsResponse.data;
    
            if (!stats) {
                await temp.edit('*⛔ No stats found for this player.*');
                return;
            }
    
           
            let responseMessage = `🛏️ *Bedwars Stats for ${playerName}* 🤗\n\n`;
            responseMessage += `🕧 *Interval:* ${interval.charAt(0).toUpperCase() + interval.slice(1)}\n\n`;
    
            
            Object.entries(stats).forEach(([key, value]) => {
                const entry = value.entries.find(e => e.id === playerName);
                const emoji = getStatEmoji(key);
                const statValue = entry ? entry.value : 'No data';
                responseMessage += `${emoji} *${key}:* ${statValue}\n`;
            });
    
            responseMessage += `\n 🌸 *Updated Stats*`;
    
            await temp.edit(responseMessage);
        } catch (error) {
            console.error('Error fetching Bedwars stats:', error);
            await temp.edit('😟 Sorry, I could not fetch Bedwars stats at the moment. Please try again later. ');
        }
    },

    async news(message) {
        try {
            // Fetch the latest news from the API
            const response = await axios.get('https://newsdata.io/api/1/latest', {
                params: {
                    country: 'lk',
                    apikey: 'pub_50364c71ca2f941c51adced4e55d9b6781b9b'
                }
            });
    
            const articles = response.data.results;
            if (articles.length === 0) {
                return await message.reply('No news articles found.');
            }
    
            // Construct a message with the latest news
            let newsMessage = '📰 *Latest News:* \n\n';
            articles.slice(0, 3).forEach((article, index) => {
                newsMessage += `${index + 1}. *${article.title}*\n${article.description}\nRead more: ${article.link}\n\n`;
            });
    
            // Send the news message
            await message.reply(newsMessage);
    
        } catch (error) {
            console.error('Error while fetching news:', error);
            await message.reply('An error occurred while fetching the news.');
        }
    },

    async trendanime(message) {
        try {
            // Fetch the latest and trending anime from Jikan API
            const latestResponse = await axios.get('https://api.jikan.moe/v4/seasons/now');
            const trendingResponse = await axios.get('https://api.jikan.moe/v4/top/anime?limit=3');
    
            const latestAnime = latestResponse.data.data.slice(0, 5);
            const trendingAnime = trendingResponse.data.data;
    
            let messageContent = 'Here are the latest and trending anime:\n\n';

            const temp = await message.reply(getRandomPhrase());
    
            // Format latest anime details
            messageContent += '**Latest Anime:**\n';
            latestAnime.forEach(anime => {
                messageContent += `*${anime.title}*\n`;
                messageContent += `Status: ${anime.status}\n`;
                messageContent += `Episodes: ${anime.episodes}\n`;
                messageContent += `Score: ${anime.score}\n`;
                messageContent += `Synopsis: ${anime.synopsis.slice(0, 100)}...\n\n`; // Truncate synopsis
            });
    
            // Format trending anime details
            messageContent += '**Trending Anime:**\n';
            trendingAnime.forEach(anime => {
                messageContent += `*${anime.title}*\n`;
                messageContent += `Score: ${anime.score}\n`;
                messageContent += `Episodes: ${anime.episodes}\n`;
                messageContent += `Synopsis: ${anime.synopsis.slice(0, 100)}...\n\n`; // Truncate synopsis
            });
    
            // Send the anime details message
            await temp.edit(messageContent);
    
        } catch (error) {
            console.error('Error while fetching and sending anime details:', error);
            await message.reply('An error occurred while fetching anime details.');
        }
    },

    async animeprev(message, title) {
        try {
            // Search for the anime on MyAnimeList
            const searchResponse = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
            const anime = searchResponse.data.data[0];
    
            if (!anime) {
                return await message.reply('Anime not found.');
            }
    
            // Find the anime trailer on YouTube
            const youtubeSearchQuery = `${anime.title} trailer`;
            const youtubeResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                params: {
                    part: 'snippet',
                    q: youtubeSearchQuery,
                    type: 'video',
                    key: 'AIzaSyAJJk2O2HOd9zRxRfU40nJ4g0agTM9EtiQ',
                    maxResults: 1
                }
            });
    
            const video = youtubeResponse.data.items[0];
            if (!video) {
                return await message.reply('No trailer found for this anime.');
            }
    
            const videoUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
            const messageContent = `Here is the trailer for *${anime.title}*:\n${videoUrl}`;
    
            await message.reply(messageContent);
    
        } catch (error) {
            console.error('Error while fetching and sending anime trailer:', error);
            await message.reply('An error occurred while fetching the anime trailer.');
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
        const command = args[1]; 
    
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
            await message.reply('*You are not authorized to change the bot status.* ');
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



client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code received, scan it with your WhatsApp mobile app. To start the Whtsapp bot');
});

client.on('authenticated', () => {
    console.log('Client authenticated.');
});

client.on('auth_failure', () => {
    console.error('Authentication failed.');
});

client.on('ready', () => {
    console.log('Client is ready!');
});

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
        case 'wins': return '🎊';
        case 'kills': return '🗡️';
        case 'deaths': return '🪦';
        case 'beds': return '🛏️';
        case 'coins': return '🪙';
        default: return '🌸';
    }
}


client.initialize();

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
