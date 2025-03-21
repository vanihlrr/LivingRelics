let img;
let imgX, imgY, imgWidth, imgHeight;
let LLM_response;
let LLM_is_processing = false;
let animation = 0;

let prompt = "Du bist das Gemälde. Erzähle deine Geschichte von einem Teil deines Bildes im lyrischen Ich. Erzähle uns eine Geschichte die zu deinem Bild passt. Schreibe nichts über deinen Künstler. Schreibe insgesamt 4 Sätze, maximal 550 Zeichen. Schreibe keine Einleitung sondern starte direkt mit der Geschichte. Antworte auf Deutsch.";

let imgName = "Monet_2.jpeg";

let textField;
let sendButton;
let messages = [];
let isInitialPromptDone = false;

function preload() {
  img = loadImage(imgName);
}

function setup() {
  let cnv = createCanvas(390, 844);
  cnv.position((windowWidth - width) / 2, (windowHeight - height) / 2);

  textField = createInput('');
  textField.attribute('placeholder', 'Frage das Gemälde...');
  textField.position((windowWidth - width) / 2 + 10, (windowHeight - height) / 2 + height);
  textField.size(width - 120);
  textField.style('padding', '10px');
  textField.style('border', 'none');
  textField.style('border-radius', '12px');
  textField.style('font-size', '16px');
  textField.style('background-color', '#f1f1f1');
  textField.style('color', '#333');


  sendButton = createButton('Fragen');
  sendButton.size(90, 40);
  sendButton.position((windowWidth - width) / 2 + width - 100, (windowHeight - height) / 2 + height);
  sendButton.style('border', 'none');
  sendButton.style('border-radius', '12px');
  sendButton.style('background-color', '#333');
  sendButton.style('color', '#fff');
  sendButton.style('font-size', '16px');
  sendButton.mousePressed(sendInputValueToLLM);
}

function windowResized() {
  canvas.position((windowWidth - width) / 2, (windowHeight - height) / 2);
  textField.position((windowWidth - width) / 2, (windowHeight - height) / 2 + height - 60);
  sendButton.position((windowWidth - width) / 2 + width - 100, (windowHeight - height) / 2 + height - 60);
}

function draw() {
  // background(220);
  stroke(0);
  strokeWeight(2);
  fill(255);
  rect((width - 350) / 2, (height - 804) / 2, 350, 804, 20);


  imgWidth = 300;
  imgHeight = 300;
  imgX = (width - imgWidth) / 2;
  imgY = 100;

  image(img, imgX, imgY, imgWidth, imgHeight, 0, 0, img.width, img.width, COVER);

  if (LLM_response) {
    fill(0);
    noStroke();
    textSize(16);
    textAlign(LEFT, TOP);

    let textBoxWidth = 270;
    let textX = width / 2 - textBoxWidth / 2;
    let textY = imgY + imgHeight + 40;

    let maxLength = 550;
    let displayText = LLM_response.length > maxLength ? LLM_response.substring(0, maxLength) + "..." : LLM_response;

    text(displayText, textX, textY, textBoxWidth, height - textY - 20);
  }

  if (LLM_is_processing) {
    noFill();
    stroke(0, 60);
    strokeWeight(50);
    push();
    translate(width / 2, height / 2);
    animation += 0.1;
    if (animation % (2 * PI) === 0) animation = 0;
    arc(0, 0, width / 2, width / 2, animation / 2, animation);
    pop();
  }
}

function mousePressed() {
  if (
    !isInitialPromptDone &&
    mouseX >= imgX && mouseX <= imgX + imgWidth &&
    mouseY >= imgY && mouseY <= imgY + imgHeight
  ) {
    LLM_Text_Image(prompt, img);
    isInitialPromptDone = true;
    console.log("Initialer Prompt ausgelöst.");
  }
}

function sendInputValueToLLM() {
  if (!isInitialPromptDone) return;

  let userMessage = textField.value().trim();
  if (userMessage === "") return;

  // Wenn es die erste Frage ist → Kontext rein!
  if (messages.length === 1) {
    messages.unshift({
      role: "system",
      content:
        "Du bist ein lebendiges Motiv in einem Gemälde. Antworte auf Fragen poetisch, geheimnisvoll und in der Ich-Form. Du beschreibst Eindrücke, keine Fakten. Sprich träumerisch und bildhaft auf Deutsch. Antworte in 2 Sätzen.",
    });
  }

  messages.push({ role: "user", content: userMessage });
  LLM_Chat(messages);
  textField.value('');
}


async function LLM_Text_Image(txt, img) {
  let inputImage = createImage(512, 512);
  inputImage.copy(img, 0, 0, img.width, img.height, 0, 0, 512, 512);
  inputImage.loadPixels();
  inputImage = inputImage.canvas.toDataURL();
  let base64 = inputImage.split(",")[1];

  LLM_is_processing = true;

  const { response } = await post("http://localhost:11434/api/generate", {
    model: "llama3.2-vision",
    prompt: txt,
    images: [base64],
    stream: false,
  });

  if (response) {
    LLM_response = response;
    messages.push({ role: "assistant", content: response }); // Für Chat-Kontext
  }

  LLM_is_processing = false;
}

async function LLM_Chat(messagesHistory) {
  LLM_is_processing = true;

  const result = await post("http://localhost:11434/api/chat", {
    model: "llama3.2-vision",
    messages: messagesHistory,
    stream: false
  });

  // Logging zur Fehlersuche
  console.log("Chat result:", result);

  // Standardmäßig erwartet man ein .message.content-Feld
  if (result && result.message && result.message.content) {
    LLM_response = result.message.content;
    messages.push({ role: "assistant", content: result.message.content });
  }
  // Manche Modelle geben direkt .content zurück
  else if (result && result.content) {
    LLM_response = result.content;
    messages.push({ role: "assistant", content: result.content });
  }
  // Fallback, falls beides fehlt
  else if (typeof result === "string") {
    LLM_response = result;
    messages.push({ role: "assistant", content: result });
  }
  else {
    LLM_response = "Ich habe gerade keine Antwort erhalten.";
  }

  LLM_is_processing = false;
}


async function post(url, payload) {
  print(JSON.stringify(payload));
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return data;
}
