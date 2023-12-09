/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */
import "./index.css";
import "marked";
import { marked } from "marked";

const el = document.getElementById("messages");
el.scrollTop = el.scrollHeight;

__electronLog.info(
  'This message is being logged by "renderer.js", included via Vite'
);

// import log from 'electron-log/renderer';
// const captureBtn = document.getElementById("captureBtn");
// captureBtn.addEventListener("click", () => {
//   __electronLog.info("captureBtn clicked");
//   window.electron.send("capture-screen");
// });

function addBotMessage(message) {
  //   <div class="chat-message">
  //   <div class="flex items-end">
  //     <div class="flex flex-col space-y-2 text-xs max-w-xs mx-2 order-2 items-start">
  //       <div><span class="px-4 py-2 rounded-lg inline-block rounded-bl-none bg-gray-300 text-gray-600">Can be
  //           verified on any platform using docker</span></div>
  //     </div>
  //     <div class="w-6 h-6 rounded-full order-1"><minidenticon-svg username="ChatGPT"></minidenticon-svg></div>
  //   </div>
  // </div>
  const chatMessage = document.createElement("div");
  chatMessage.classList.add("chat-message");

  const flex = document.createElement("div");
  flex.classList.add("flex");
  flex.classList.add("items-end");

  const flexCol = document.createElement("div");
  flexCol.classList.add("flex");
  flexCol.classList.add("flex-col");
  flexCol.classList.add("space-y-2");
  flexCol.classList.add("text-xs");
  flexCol.classList.add("max-w-xs");
  flexCol.classList.add("mx-2");
  flexCol.classList.add("order-2");
  flexCol.classList.add("items-start");

  const div = document.createElement("div");
  div.innerHTML = message;
  div.classList.add("px-4");
  div.classList.add("py-2");
  div.classList.add("rounded-lg");
  div.classList.add("inline-block");
  div.classList.add("rounded-bl-none");
  div.classList.add("bg-gray-300");
  div.classList.add("text-gray-600");

  flexCol.appendChild(div);

  const div2 = document.createElement("div");
  div2.classList.add("w-6");
  div2.classList.add("h-6");
  div2.classList.add("rounded-full");
  div2.classList.add("order-1");

  const minidenticonSvg = document.createElement("minidenticon-svg");
  minidenticonSvg.setAttribute("username", "ChatGPT");
  div2.appendChild(minidenticonSvg);

  flex.appendChild(div2);
  flex.appendChild(flexCol);

  chatMessage.appendChild(flex);

  document.getElementById("messages").appendChild(chatMessage);
}

function addMyMessage(message) {
  const chatMessage = document.createElement("div");
  chatMessage.classList.add("chat-message");

  const flex = document.createElement("div");
  flex.classList.add("flex");
  flex.classList.add("items-end");
  flex.classList.add("justify-end");

  const flexCol = document.createElement("div");
  flexCol.classList.add("flex");
  flexCol.classList.add("flex-col");
  flexCol.classList.add("space-y-2");
  flexCol.classList.add("text-xs");
  flexCol.classList.add("max-w-xs");
  flexCol.classList.add("mx-2");
  flexCol.classList.add("order-1");
  flexCol.classList.add("items-end");

  const div = document.createElement("div");
  div.innerHTML = marked.parse(message, { breaks: true, gfm: true });
  div.classList.add("px-4");
  div.classList.add("py-2");
  div.classList.add("rounded-lg");
  div.classList.add("inline-block");
  div.classList.add("rounded-br-none");
  div.classList.add("bg-blue-600");
  div.classList.add("text-white");

  flexCol.appendChild(div);

  const div2 = document.createElement("div");
  div2.classList.add("w-6");
  div2.classList.add("h-6");
  div2.classList.add("rounded-full");
  div2.classList.add("order-1");

  const minidenticonSvg = document.createElement("minidenticon-svg");
  minidenticonSvg.setAttribute("username", "Me");
  div2.appendChild(minidenticonSvg);

  flex.appendChild(flexCol);
  flex.appendChild(div2);

  chatMessage.appendChild(flex);

  document.getElementById("messages").appendChild(chatMessage);
}

const userInput = document.getElementById("userInput");
// __electronLog.info("userInput", userInput)
userInput.addEventListener(
  "keydown",
  function (event) {
    // __electronLog.info("userInput keydown", event.key);

    if (event.key === "Enter") {
      if (!event.shiftKey) {
        __electronLog.info("userInput keydown Enter: ", userInput.value);
        window.electron.send("user-message", userInput.value);
        addMyMessage(userInput.value);
        event.preventDefault();
        userInput.value = "";
      }
    }
  },
  false
);

const sendButton = document.getElementById("sendButton");
// __electronLog.info("sendButton", sendButton)
sendButton.addEventListener("click", function (event) {
  __electronLog.info("sendButton click");
  window.electron.send("user-message");
  addMyMessage(userInput.value);
  userInput.value = "";
});

window.electron.on("bot-message", (_event, arg) => {
  // console.log(name, dataUrl);
  // __electronLog.info("dataUrl", dataUrl)

  const message = arg;

  // const imgElem = document.createElement("img");
  // imgElem.classList.add("screenshot");
  // imgElem.src = dataUrl;
  // imgElem.style.display = "block";

  // document.getElementById("screenshots").appendChild(imgElem);
  addBotMessage(message);
});

import "minidenticons";
