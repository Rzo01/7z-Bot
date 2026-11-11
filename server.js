
const express = require("express");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// EDIT YOUR 9 PRODUCTS HERE
const menu = [
  { name: "Product 1", price: 10 },
  { name: "Product 2", price: 20 },
  { name: "Product 3", price: 30 },
  { name: "Product 4", price: 40 },
  { name: "Product 5", price: 50 },
  { name: "Product 6", price: 60 },
  { name: "Product 7", price: 70 },
  { name: "Product 8", price: 80 },
  { name: "Product 9", price: 90 }
];

function getReply(message) {
  const text = message.toLowerCase().trim();

  if (
    ["hi", "hello", "hey", "good morning", "good afternoon"]
      .some(word => text === word || text.startsWith(word + " "))
  ) {
    return "Hello! Welcome to Yummy Teh! 😊 How can I help you?";
  }

  if (
    text.includes("menu") ||
    text.includes("products") ||
    text.includes("list")
  ) {
    return "Here's our menu:\n\n" +
      menu.map(item => `${item.name} - ₱${item.price}`).join("\n") +
      "\n\nWhat would you like to know?";
  }

  const product = menu.find(item =>
    text.includes(item.name.toLowerCase())
  );

  if (product) {
    return `${product.name} costs ₱${product.price}. Would you like to know anything else?`;
  }

  if (
    text.includes("price") ||
    text.includes("how much") ||
    text.includes("cost")
  ) {
    return "Which product's price would you like to know? You can type 'menu' to see our products.";
  }

  if (
    text.includes("thank") ||
    text.includes("thanks")
  ) {
    return "You're welcome! Thank you for choosing Yummy Teh! 💗";
  }

  return "Thanks for messaging Yummy Teh! 😊 Type 'menu' to see our products, or ask me about a specific item.";
}

async function sendMessage(recipientId, message) {
  if (!PAGE_ACCESS_TOKEN) {
    console.error("PAGE_ACCESS_TOKEN is missing.");
    return;
  }

  const response = await fetch(
    "https://graph.facebook.com/v26.0/me/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text: message },
        access_token: PAGE_ACCESS_TOKEN
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Messenger API error:", error);
  }
}

app.get("/", (req, res) => {
  res.send("7z-Bot is running!");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  res.sendStatus(200);

  const body = req.body;

  if (body.object !== "page") return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (
        event.message &&
        event.message.text &&
        !event.message.is_echo
      ) {
        const senderId = event.sender.id;
        const reply = getReply(event.message.text);

        sendMessage(senderId, reply).catch(error => {
          console.error("Reply failed:", error.message);
        });
      }
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`7z-Bot running on port ${PORT}`);
});
