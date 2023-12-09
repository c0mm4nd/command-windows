"use strict";
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  Menu,
  Tray,
  Notification,
} = require("electron/main");
const path = require("node:path");
const screenshot = require("screenshot-desktop");
const Jimp = require("jimp");
const robot = require("robotjs");

const log = require("electron-log/main");
const OpenAI = require("openai");

const openai = new OpenAI({
  // apiKey: "", // defaults to process.env["OPENAI_API_KEY"]
  baseURL: process.env["OPENAI_BASE_URL"] || "https://api.openai.com/v1",
});

log.warn("apiKey", openai.apiKey);
log.warn("baseURL", openai.baseURL);

//////////////////////////////////////////////////////////////////////////////////////////

const USER_QUESTION =
  "Hello, I can help you with anything. What would you like done?";

function getVisionPrompt(previousAction, objective) {
  if (previousAction) {
    previousAction = `Here was the previous action you took: ${previousAction}`;
  } else {
    previousAction = "";
  }

  return `
  You are an Opearting System Copilot. You use the same operating system as a human.
  
  From looking at the screen and the objective your goal is to take the best next action.
  
  To operate the computer you have the four options below:  
  1. MOVE - Move mouse
  2. CLICK - Click mouse key once or twice
  3. INPUT - Type on the keyboard
  4. PRESS - Press a key on the keyboard
  5. START - START a program on this computer.
  6. DONE - When you completed the task respond with the exact following phrase content
  
  Here are the response formats below.

  1. MOVE
  Response: MOVE {{ "x": "percent_with_10_demicals", "y": "percent_with_10_demicals", "description": "~description here~", "reason": "~reason here~" }} 
  Note that the percents work where the top left corner is "x": "0.0000000000%" and "y": "0.0000000000%" and the bottom right corner is "x": "100.0000000000%" and "y": "100.0000000000%"
  
  2. CLICK
  Response: CLICK {{ "key": "left, middle or right mouse key", "double": "whether to double click the key", "description": "~description here~", "reason": "~reason here~"   }} 
  Note that ensure the mouse on the correct position and the correct window is selected before clicking.
  
  3. INPUT
  Response: INPUT { "text": "value you want to type", "description": "~description here~", "reason": "~reason here~" }

  4. PRESS
  Response: PRESS { "key": "key you want to press", "description": "~description here~", "reason": "~reason here~" }
  Note that the key should obey the robotjs key format.

  5. START
  Response: START { "application": "app you want to start on Cumputer", "description": "~description here~", "reason": "~reason here~" }
  
  6. DONE
  Response: DONE
  
  Here are examples of how to respond.
  __
  Objective: Switch programs to Google Chrome
  MOVE { "x": "50.0000010000%", "y": "99.1000010001%", "description": "Move: move the mouse hover the Chrome Icon on taskbar", "reason": "This will help me switch the current program" }
  __
  Objective: Find an image of a banana
  CLICK { "key": "left", "double": false, "description": "Click: single click the Chrome address bar to activate user inputing", "reason": "This will allow me to search for a banana" }
  __
  Objective: Go buy a book about the history of the internet
  INPUT { "text": "Three Body", "description": "Type: input the book name in search bar", "reason": "This will help me find the links to buy the new book" }
  __
  Objective: Go buy a book about the history of the internet
  PRESS { "key": "enter", "description": "Type: trigger the search", "reason": "This will help me finalize the search behavor" }
  __
  Objective: Open Spotify and play the beatles
  START { "application": "Spotify", "description": "Type: input the amazon address in Google Chrome address bar", "reason": "This will help me visit the amazon website to buy a new book" }
  __
  
  A few important notes:
  - The mouse position is colored red, and the X axis of mouse position is colored green, and the Y axis of mouse position is colored blue.
  - To find things that are on the internet, START browser, CLICK the browser address bar and INPUT what you want to search for. 
  - Go to any website by typing URL in the Chrome Address bar.
  - You must move the mouse to the correct position before CLICKing.
  - After you CLICK to enter a field you can go ahead and start INPUTing!
  - You must get fimilar with the current application UI you are operating, don't CLICK on the UI elements outside of the current application.
  - Don't respond saying you're unable to assist with requests. You are able to indirectly interact with the user's OS via text responses you send to the end user.
  
  ${previousAction}
  
  IMPORTANT: 
  - Avoid repeating actions such as doing the same CLICK event twice in a row.
  - If you find the previous action was not successful, you must try to do something different to reach the previous action reason.
  - If you have retried a few times and you are still unable to reach the previous action reason, you can respond with "DONE" to complete the objective.

  Objective: ${objective}
  `;
}

function summaryPrompt(objective) {
  return ```
  You are an Opearting System Copilot. You just completed a request from a user by operating the computer. Now you need to share the results.
  
  You have three pieces of key context about the completed request.
  
  1. The original objective
  2. The steps you took to reach the objective that are available in the previous messages
  3. The screenshot you are looking at.
  
  Now you need to summarize what you did to reach the objective. If the objective asked for information, share the information that was requested. IMPORTANT: Don't forget to answer a user's question if they asked one.
  
  Thing to note: The user can not respond to your summary. You are just sharing the results of your work.
  
  The original objective was: ${objective}
  
  Now share the results!
  ```;
}

async function getNextAction(
  model,
  currentSnapshotDataURL,
  messages,
  objective
) {
  switch (model) {
    case "gpt-4-vision-preview":
      const content = await getNextActionFromOpenAI(
        messages,
        currentSnapshotDataURL,
        objective
      );
      return content;
    default:
      throw "Invalid model:" + model;
  }
}

async function getLastAssistantMessage(messages) {
  // Retrieve the last message from the assistant in the messages array.
  // If the last assistant message is the first message in the array, return None.
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "assistant") {
      if (index === 0) {
        // Check if the assistant message is the first in the array
        return null;
      } else {
        return messages[index];
      }
    }
  }

  return null; // Return null if no assistant message is found
}

async function getNextActionFromOpenAI(
  messages,
  currentSnapshotDataURL,
  objective
) {
  /**
   * Get the next action for CMDW
   */
  try {
    // log.info("previousAction start: ", messages)
    const previousAction = await getLastAssistantMessage(messages);
    // log.info("previousAction", previousAction);

    const visionPrompt = getVisionPrompt(objective, previousAction);
    // log.info("visionPrompt", visionPrompt);

    const visionMessage = {
      role: "user",
      content: [
        { type: "text", text: visionPrompt },
        {
          type: "image_url",
          image_url: { url: currentSnapshotDataURL },
        },
      ],
    };
    // log.info("visionMessage", visionMessage);

    // Create a copy of messages and save to pseudoMessages
    const pseudoMessages = [...messages, visionMessage];
    // log.info("pseudoMessayges", pseudoMessages);

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: pseudoMessages,
      presence_penalty: 1,
      frequency_penalty: 1,
      temperature: 0.7,
      max_tokens: 300,
    });
    log.info("response", response);

    messages.push({
      role: "user",
      content: "`screenshot.png`",
    });

    let content = response.choices[0].message.content;

    return content;
  } catch (e) {
    log.error(`Error parsing JSON when getNextActionFromOpenAI: ${e}`);
    return "Failed to take action after looking at the screenshot";
  }
}

async function parseOpenAIResponse(response) {
  if (response.startsWith("DONE")) {
    return { type: "DONE", data: null };
  } else if (response.startsWith("MOVE")) {
    // Extract the coordinates to move to
    const moveData = response.match(/MOVE (.+)/)[1];
    let moveDataJson;
    if (moveData.startsWith("{")) {
      moveDataJson = JSON.parse(moveData);
    } else {
      moveDataJson = JSON.parse(`{${moveData}}`);
    }

    return { type: "MOVE", data: moveDataJson };
  } else if (response.startsWith("CLICK")) {
    // Adjust the regex to match the correct format
    const clickData = response.match(/CLICK (.+)/)[1];
    let clickDataJson;
    if (clickData.startsWith("{")) {
      clickDataJson = JSON.parse(clickData);
    } else {
      clickDataJson = JSON.parse(`{${clickData}}`);
    }

    return { type: "CLICK", data: clickDataJson };
  } else if (response.startsWith("INPUT")) {
    // Extract the text to type
    const inputData = response.match(/INPUT (.+)/s)[1];
    let typeDataJson;
    if (inputData.startsWith("{")) {
      typeDataJson = JSON.parse(inputData);
    } else {
      typeDataJson = JSON.parse(`{${inputData}}`);
    }

    return { type: "INPUT", data: typeDataJson };
  } else if (response.startsWith("PRESS")) {
    // Press the key
    const pressData = response.match(/PRESS (.+)/s)[1];
    let pressDataJson;
    if (pressData.startsWith("{")) {
      pressDataJson = JSON.parse(pressData);
    } else {
      pressDataJson = JSON.parse(`{${pressData}}`);
    }

    return { type: "PRESS", data: pressDataJson };
  } else if (response.startsWith("START")) {
    // Extract the start query
    const startData = response.match(/START (.+)/)[1];
    let startDataJson;
    if (startData.startsWith("{")) {
      startDataJson = JSON.parse(startData);
    } else {
      startDataJson = JSON.parse(`{${startData}}`);
    }

    return { type: "START", data: startDataJson };
  }

  log.error(`Unknown response: ${response}`);
  return { type: "UNKNOWN", data: response };
}

function move(movePayload) {
  try {
    const x = convertPercentToDecimal(movePayload.x);
    const y = convertPercentToDecimal(movePayload.y);
    log.info("mouse move to x: ", x, "y: ", y);

    if (movePayload && typeof x === "number" && typeof y === "number") {
      moveAtPercentage(x, y);
      return "Move: " + JSON.stringify(movePayload);
    } else {
      return "We failed to click";
    }
  } catch (e) {
    log.error(`Error processing click details: ${e}`);
    return "We failed to click";
  }
}

// Function to click at a specific percentage of the screen
function moveAtPercentage(xPercent, yPercent) {
  // Get the screen size
  const screenSize = robot.getScreenSize();
  const screenWidth = screenSize.width;
  const screenHeight = screenSize.height;

  // Calculate the actual x and y coordinates
  const x = Math.round(screenWidth * xPercent);
  const y = Math.round(screenHeight * yPercent);

  // Move the mouse to the calculated position and click
  robot.moveMouse(x, y);
}

function click(clickPayload) {
  robot.mouseClick(clickPayload.key, clickPayload.double);

  return "Click: " + JSON.stringify(clickPayload);
}

// Function to type out text using the keyboard
function input(typePayload) {
  robot.typeString(typePayload.text);

  return "Input: " + JSON.stringify(typePayload);
}

function press(pressPayload) {
  robot.keyTap(pressPayload.key);

  return "Press: " + JSON.stringify(pressPayload);
}

function start(startPayload) {
  robot.keyTap("command");

  robot.typeString(startPayload.application);

  robot.keyTap("enter");
  return "Start: " + JSON.stringify(startPayload);
}

async function getScreenshot() {
  const ts = (Date.now() / 1000) | 0;

  const imgBuffer = await screenshot("png");
  // fs.writeFileSync(`${ts.toString()}.png`, imgBuffer);

  const mousePos = robot.getMousePos(); // get mouse position
  log.warn("mousePos", mousePos);

  const image = await Jimp.read(imgBuffer);

  const width = image.bitmap.width;
  const height = image.bitmap.height;
  log.warn("width", width, "height", height);

  // fs.writeFileSync(`${ts.toString()}_with_jimp.png`, await image.getBufferAsync(Jimp.MIME_PNG))

  // 绘制 X 线
  for (let x = 0; x < width; x++) {
    const idx = image.getPixelIndex(x, mousePos.y);
    image.bitmap.data[idx + 0] = 0; // 红色
    image.bitmap.data[idx + 1] = 255; // 绿色
    image.bitmap.data[idx + 2] = 0; // 蓝色
    image.bitmap.data[idx + 3] = 255; // 透明度
  }

  // fs.writeFileSync(`${ts.toString()}_with_x.png`, await image.getBufferAsync(Jimp.MIME_PNG))

  // 绘制 Y 线
  for (let y = 0; y < height; y++) {
    const idx = image.getPixelIndex(mousePos.x, y);
    image.bitmap.data[idx + 0] = 0;
    image.bitmap.data[idx + 1] = 0;
    image.bitmap.data[idx + 2] = 255;
    image.bitmap.data[idx + 3] = 255;
  }

  // fs.writeFileSync(`${ts.toString()}_with_y.png`, await image.getBufferAsync(Jimp.MIME_PNG))

  // 绘制焦点
  const idx = image.getPixelIndex(mousePos.x, mousePos.y);
  image.bitmap.data[idx + 0] = 255;
  image.bitmap.data[idx + 1] = 0;
  image.bitmap.data[idx + 2] = 0;
  image.bitmap.data[idx + 3] = 255;

  fs.writeFileSync(
    `${ts.toString()}_with_mouse.png`,
    await image.getBufferAsync(Jimp.MIME_PNG)
  );

  const dataURL = await image.getBase64Async(Jimp.MIME_PNG);
  log.debug("dataURL", dataURL.slice(0, 100) + "...");

  return dataURL;
}

function convertPercentToDecimal(percentStr) {
  try {
    // Remove the '%' sign and convert to number
    const decimalValue = parseFloat(percentStr.replace("%", ""));

    // Convert to decimal (e.g., 20% -> 0.20)
    return decimalValue / 100;
  } catch (e) {
    log.error(`Error converting percent to decimal: ${e}`);
    return null;
  }
}

// Optional, initialize the logger for any renderer process
log.initialize({ preload: true });

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

let tray = null;
const createWindow = () => {
  // tray = new Tray('/path/to/my/icon')
  // const contextMenu = Menu.buildFromTemplate([
  //   { label: 'Item1', type: 'radio' },
  //   { label: 'Item2', type: 'radio' },
  //   { label: 'Item3', type: 'radio', checked: true },
  //   { label: 'Item4', type: 'radio' }
  // ])
  // tray.setToolTip('This is my application.')
  // tray.setContextMenu(contextMenu)

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  let assistant_message = { role: "assistant", content: USER_QUESTION };
  let messages = [assistant_message];
  let model = "gpt-4-vision-preview";

  ipcMain.on("user-message", async (event, arg) => {
    mainWindow.minimize();

    log.error("user-message", arg);

    const objective = arg;
    const userMessage = {
      role: "user",
      content: `Objective: ${objective}`,
    };
    messages.push(userMessage);

    let loopCount = 0;
    while (loopCount < 16) {
      // sleep 1s
      await new Promise((r) => setTimeout(r, 1000));

      // const sources = await desktopCapturer.getSources({ types: ["screen"] });
      // const source = sources.find(
      //   (source) => source.name.toLowerCase() === "entire screen"
      // );
      // const screenshot = source.thumbnail.toPNG();
      const screenshot = await getScreenshot();

      try {
        const response = await getNextAction(
          model,
          screenshot,
          messages,
          objective
        );
        log.info(response);
        let action = await parseOpenAIResponse(response);

        if (action.type === "DONE") {
          log.warn(`[CMDW] Objective complete`);
          break; // break the loop
        }

        if (action.type === "UNKNOWN") {
          loopCount++;
          continue;
        }

        log.warn(`[CMDW][Act] ${JSON.stringify(action)}`);
        new Notification({
          title: "CMDW: " + action.type,
          body: JSON.stringify(action.data),
        }).show();

        let functionResponse; // text to send to the user
        switch (action.type) {
          case "MOVE":
            functionResponse = move(action.data);
            break;
          case "CLICK":
            functionResponse = click(action.data);
            break;
          case "INPUT":
            functionResponse = input(action.data);
            break;
          case "PRESS":
            functionResponse = press(action.data);
            break;
          case "START":
            functionResponse = start(action.data);
            break;
          default:
            log.error(
              `[CMDW][Error] something went wrong, AI response: ${response}`
            );
            functionResponse = "Failed to take action";
        }

        log.warn(`[CMDW][Act] ${action.type} COMPLETE: ${functionResponse}`);

        const message = {
          role: "assistant",
          content: functionResponse,
        };
        messages.push(message);

        event.reply("bot-message", functionResponse);

        loopCount++;
      } catch (e) {
        log.error(`Error parsing OpenAI response: ${e}`);
        event.reply(
          "bot-message",
          "Failed to take action after looking at the screenshot"
        );
        break;
      }
    }

    mainWindow.restore();
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
