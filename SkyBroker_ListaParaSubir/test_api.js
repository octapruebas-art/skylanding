const chatHistory = [{ role: 'user', content: 'hola' }];
fetch("https://skylandingpage.netlify.app/.netlify/functions/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history: chatHistory })
}).then(async r => {
    console.log("Status:", r.status);
    console.log("Body:", await r.text());
}).catch(e => console.error("Error:", e));
