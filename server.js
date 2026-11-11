
const express = require("express");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GRAPH_URL = "https://graph.facebook.com/v26.0";

const menu = [
  { name: "Menu 1", price: 0, image: "IMAGE_URL_1" },
  { name: "Menu 2", price: 0, image: "IMAGE_URL_2" },
  { name: "Menu 3", price: 0, image: "IMAGE_URL_3" },
  { name: "Menu 4", price: 0, image: "IMAGE_URL_4" },
  { name: "Menu 5", price: 0, image: "IMAGE_URL_5" },
  { name: "Menu 6", price: 0, image: "IMAGE_URL_6" },
  { name: "Menu 7", price: 0, image: "IMAGE_URL_7" },
  { name: "Menu 8", price: 0, image: "IMAGE_URL_8" },
  { name: "Menu 9", price: 0, image: "IMAGE_URL_9" }
];

const orders = {};

async function apiRequest(endpoint, data) {
  const response = await fetch(
    `${GRAPH_URL}/${endpoint}?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("Meta API error:", result);
  }

  return result;
}

async function sendMessage(id, message) {
  return apiRequest("me/messages", {
    recipient: { id },
    messaging_type: "RESPONSE",
    message
  });
}

async function sendText(id, text) {
  return sendMessage(id, { text });
}

async function sendButtons(id, text, buttons) {
  return sendMessage(id, {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text,
        buttons: buttons.map(button => ({
          type: "postback",
          title: button.title,
          payload: button.payload
        }))
      }
    }
  });
}

async function sendWelcome(id) {
  await sendButtons(
    id,
    "Welcome to Yummy Teh! 💗 What would you like to do?",
    [
      { title: "🍽️ Menu", payload: "MENU" },
      { title: "🛒 Start Order", payload: "ORDER" }
    ]
  );
}

async function sendMenu(id) {
  for (const item of menu) {
    const element = {
      title: item.name,
      subtitle: `Price: ₱${item.price}`
    };

    if (
      item.image.startsWith("https://") ||
      item.image.startsWith("http://")
    ) {
      element.image_url = item.image;
    }

    await sendMessage(id, {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [element]
        }
      }
    });
  }

  await sendButtons(id, "Would you like to place an order?", [
    { title: "Start Order", payload: "ORDER" }
  ]);
}

function getOrder(id) {
  if (!orders[id]) {
    orders[id] = {
      step: 0,
      name: "",
      grade: "",
      section: "",
      delivery: ""
    };
  }

  return orders[id];
}

async function startOrder(id) {
  orders[id] = {
    step: 1,
    name: "",
    grade: "",
    section: "",
    delivery: ""
  };

  await sendText(id, "🛒 Let's start your order!\n\nWhat is your full name?");
}

async function handleOrderInput(id, text) {
  const order = getOrder(id);

  if (order.step === 1) {
    order.name = text;
    order.step = 2;
    await sendText(id, "What is your grade?");
  } else if (order.step === 2) {
    order.grade = text;
    order.step = 3;
    await sendText(id, "What is your section?");
  } else if (order.step === 3) {
    order.section = text;
    order.step = 4;
    await sendText(id, "What time would you like your delivery?");
  } else if (order.step === 4) {
    order.delivery = text;
    order.step = 5;

    await sendButtons(
      id,
      `Please check your order information:\n\nName: ${order.name}\nGrade: ${order.grade}\nSection: ${order.section}\nTime of Delivery: ${order.delivery}`,
      [
        { title: "Submit Order", payload: "SUBMIT_ORDER" },
        { title: "Cancel", payload: "CANCEL_ORDER" }
      ]
    );
  }
}

async function handleCommand(id, payload) {
  if (payload === "GET_STARTED") {
    await sendWelcome(id);
  } else if (payload === "MENU") {
    await sendMenu(id);
  } else if (payload === "ORDER") {
    await startOrder(id);
  } else if (payload === "SUBMIT_ORDER") {
    const order = orders[id];

    if (!order || order.step !== 5) {
      await sendText(id, "Please start your order again.");
      return;
    }

    console.log("NEW YUMMY TEH ORDER:", {
      customer: id,
      name: order.name,
      grade: order.grade,
      section: order.section,
      delivery: order.delivery
    });

    delete orders[id];

    await sendText(
      id,
      "Your order details have been submitted! 💗 Thank you for choosing Yummy Teh!"
    );
  } else if (payload === "CANCEL_ORDER") {
    delete orders[id];
    await sendText(id, "Your order has been cancelled.");
  }
}

async function setupMessenger() {
  const settings = {
    get_started: {
      payload: "GET_STARTED"
    },
    greeting: [
      {
        locale: "default",
        text: "Welcome to Yummy Teh! 💗 Tap Get Started to begin."
      }
    ],
    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          {
            type: "postback",
            title: "🍽️ Menu",
            payload: "MENU"
          },
          {
            type: "postback",
            title: "🛒 Start Order",
            payload: "ORDER"
          }
        ]
      }
    ]
  };

  const result = await apiRequest("me/messenger_profile", settings);
  console.log("Messenger settings:", result);
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

  if (req.body.object !== "page") return;

  for (const entry of req.body.entry || []) {
    for (const event of entry.messaging || []) {
      const id = event.sender.id;

      if (event.postback) {
        handleCommand(id, event.postback.payload)
          .catch(error => console.error(error));
        continue;
      }

      if (event.message && event.message.text && !event.message.is_echo) {
        const order = orders[id];

        if (order && order.step >= 1 && order.step <= 4) {
          handleOrderInput(id, event.message.text.trim())
            .catch(error => console.error(error));
        } else {
          const text = event.message.text.toLowerCase().trim();

          if (text.includes("menu")) {
            sendMenu(id).catch(console.error);
          } else if (
            text.includes("order") ||
            text.includes("start")
          ) {
            startOrder(id).catch(console.error);
          } else {
            sendWelcome(id).catch(console.error);
          }
        }
      }
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`7z-Bot running on port ${PORT}`);
  setupMessenger().catch(console.error);
});
