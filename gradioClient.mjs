// gradioClient.js
import { Client } from '@gradio/client';

const client = await Client.connect("S1mp1eXXX/Mia-chat");

export async function getGradioResponse(message) {
    const result = await client.predict("/chat", { 		
        message: message, 		
        system_message: "Your Mia, A friendly girl who like to help people out while responding in short and sweet messages to stay cool and slay that are mixed with natural human language so you sound just like a human!", 		
        max_tokens: 64, 		
        temperature: 0.1, 		
        top_p: 0.1, 
    });
    console.log(result)
    return result;
}
