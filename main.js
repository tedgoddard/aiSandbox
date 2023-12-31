import * as aiStates from "./aistates.js"
import * as rubrics from "./rubrics.js"

const chatLines = []
const transcript = document.getElementById('chat-body')
let currentSystemPrompt = { prompt: 'You are a helpful AI and answer all questions succinctly.' }
let currentRubric = 'Print "Rubric Released!" if the text below contains no errors, otherwise print "Rubric Rejects!".'

function setOpenAIToken(token) {
  localStorage.setItem('OpenAIToken', token)
}

function getOpenAIToken(token) {
  return localStorage.getItem('OpenAIToken')
}

function checkForOpenAIKey() {
  const token = localStorage.getItem('OpenAIToken')
  if (token) {
    const startIndex = 3 // show first 3
    const maskSize = token.length - 4 // leave last 4
    const maskedToken = token.replace(token.substring(startIndex, maskSize), "...")
    document.getElementById('open-ai-key').textContent = maskedToken
    document.getElementById('display-open-ai-key').style.display = "block"
    document.getElementById('set-openai-key').style.display = "none"
  } else {
    document.getElementById('set-openai-key').style.display = "block"
    document.getElementById('display-open-ai-key').style.display = "none"
  }
}

async function handleSetOpenAIKeyClick(event) {
  const key = document.getElementById('openai-key-input').value
  setOpenAIToken(key)
  checkForOpenAIKey()
}

async function handleOpenAIInputKey(event) {
  const key = event.key ?? 'Enter'
  if (key !== 'Enter') {
    return
  }
  const input = event.target
  const text = input.value.trim()

  setOpenAIKey(text)
  checkForOpenAIKey()
}

function setSystemPrompt(prompt) {
  currentSystemPrompt = prompt
}

function setAIState(name) {
  const prompt = aiStates.getPrompt(name)
  setSystemPrompt(prompt)
  document.getElementById('state-name-input').value = name
  document.getElementById('prompt-edit').value = prompt.prompt
}

function setRubric(name) {
  currentRubric = rubrics.getRubric(name)
  document.getElementById('rubric-edit').value = currentRubric
}

function pushTranscript(role, html) {
  transcript.insertAdjacentHTML('beforeend', `<div class="wrapper"><div class="chat-message ${role}">${html}</div></div>`)
  transcript.scrollTop = transcript.scrollHeight
}

async function askChatSystem(text) {
  const promptObject = { role: "system", content: currentSystemPrompt.prompt }
  const messages = [ promptObject, ...chatLines ]
  const options = { 
    extras: { }
  }
  if (currentSystemPrompt.functions) {
    options.extras.functions = currentSystemPrompt.functions
    options.extras.function_call = 'auto'
  }
  const result = await callChatSystem(messages, options)
  const answer = result?.choices?.[0]?.message?.content
  const functionCall = result?.choices?.[0]?.message?.function_call
  if (functionCall) {
    const args = JSON.parse(functionCall.arguments)
console.log("function arguments", args)
    //TODO: Distinguish between state change and other function calls
    setAIState(functionCall.name)
    return args.summary
  }
  return answer
}

async function callChatSystem(messages, options) {
  const extras = options.extras ?? { }
  const model = "gpt-3.5-turbo-0613"
  const url = "https://api.openai.com/v1/chat/completions"

  const temperature = 0.8
  const headers = {
    "Content-Type": "application/json",
    Authorization: 'Bearer ' + getOpenAIToken()
  }

  const data = {
    model,
    messages,
    ...extras,
    temperature,
  }
  const body = JSON.stringify(data)
  const response = await fetch(url, {method: 'POST', body, headers })
  const json = await response.json()
  return json
}

async function handleStateNameKey(event) {
  const key = event.key ?? 'Enter'
  if (key !== 'Enter') {
    return
  }
  setAIState(event.target.value)
}

async function handleRubricNameKey(event) {
  const key = event.key ?? 'Enter'
  if (key !== 'Enter') {
    return
  }
  setRubric(event.target.value)
}

async function handleRunRubric(event) {
  const promptObject = { role: "system", content: currentRubric }
  const messages = [ promptObject, ...chatLines ]
  const options = { 
    extras: { }
  }
  const result = await callChatSystem(messages, options)
  const answer = result?.choices?.[0]?.message?.content
  pushTranscript('assistant', answer)
}

async function handleChatKey(event) {
  const key = event.key ?? 'Enter'
  if (key !== 'Enter') {
    return
  }
  const input = event.target
  
  handleSendMessage(input)
}

async function handleSendMessageClick(event) {
  const input = document.getElementById('chat-input')
  
  handleSendMessage(input)
}

async function handleSendMessage(input) {
  const text = input.value.trim()
  
  if (!text) {
    return
  }
  if (text.trim().startsWith('/')) {
    handleSlashCommand(text)
    input.value = ""
    return
  }

  chatLines.push({ role: "user", content: text })
  input.value = ""
  pushTranscript('user', text)

  const answer = await askChatSystem(text)
  if (answer) {
    chatLines.push({ role: "assistant", content: answer })
    pushTranscript('assistant', answer)
  }
}

document.getElementById('chat-input').addEventListener('keyup', handleChatKey)
document.getElementById('send-message-button').addEventListener('click', handleSendMessageClick)
document.getElementById('state-name-input').addEventListener('keyup', handleStateNameKey)
document.getElementById('rubric-name-input').addEventListener('keyup', handleRubricNameKey)
document.getElementById('run-rubric-button').addEventListener('click', handleRunRubric)
document.getElementById('set-openai-key-button').addEventListener('click', handleSetOpenAIKeyClick)
document.getElementById('openai-key-input').addEventListener('keyup', handleOpenAIInputKey)

window.onload = function() {
  checkForOpenAIKey()
}

window.setOpenAIToken = setOpenAIToken
window.setAIState = setAIState

// For debug only
window.aiStates = aiStates
window.rubrics = rubrics

await aiStates.init()
await rubrics.init()
