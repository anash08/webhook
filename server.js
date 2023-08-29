const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIO = require('socket.io');
const { Cohere } = require("langchain/llms/cohere");
const { BufferMemory } = require("langchain/memory");
const { ConversationChain } = require("langchain/chains");
const { CacheClient, Configurations, CredentialProvider, } = require("@gomomento/sdk");
const { MomentoChatMessageHistory } = require("langchain/stores/message/momento");
require('dotenv').config();

// const apiKey = process.env.API_KEY;

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const server = http.createServer(app);
const io = socketIO(server);

let convertedValue = 'No converted value available';
let generations1 = '';
let generations2 = '';
let chemResult1Value;
let chain = null;
let sharedData = {};

app.use(express.json());
function convertToLatex(input) {
    // Check if input is a string
    if (typeof input !== 'string') {
        return ''; // Return an empty string or handle the non-string input accordingly
    }

    // Replace backslashes with double backslashes
    let latex = input.replace(/\\/g, '\\\\');

    // Add curly braces around superscripts
    latex = latex.replace(/\^(\w+)/g, '^{$1}');

    // Add necessary spacing around mathematical operators
    latex = latex.replace(/([+\-*\/=])/g, ' $1 ');

    return latex;
}

// const client = new CacheClient({
//     configuration: Configurations.Laptop.v1(),
//     credentialProvider: CredentialProvider.fromEnvironmentVariable({
//         environmentVariableName: "API_KEY"
//     }),
//     defaultTtlSeconds: 60 * 60 * 24,
// });

const memory = new BufferMemory();

app.post('/webhook', async (req, res) => {
    const payload = req.body;
    console.log("...............//this is the payload", payload);
    convertedValue = payload.convertedValue;
    console.log(".........../////////convertedValue//////////.....", convertedValue);
    const latexVal = convertToLatex(convertedValue);
    console.log("............//this is the latex value", latexVal);

    // const sessionId = new Date().toISOString();
    // const cacheName = "langchain";

    // const chatHistory = await MomentoChatMessageHistory.fromProps({
    //     client,
    //     cacheName,
    //     sessionId,
    //     sessionTtl: 300,
    // });

    const model = new Cohere({
        maxTokens: 1000,
        apiKey: "GQ7Zysexx8aB6HGZNpXjrlL27K28ARWPNcPVaa2y",
    });

    chain = new ConversationChain({ llm: model, memory: memory });

    const result1 = await chain.call({
        input: `solve ${latexVal} mathematically in not more than 5 steps and show me the correct answer`
    });

    generations1 = result1.response;

    io.emit('convertedValue', convertedValue);
    io.emit('newGeneration', generations1);

    // console.log({ result1 });

    res.status(200).send(generations1);
});

app.post('/res2', async (req, res) => {
    const { prompt } = req.body;
    const res2 = await chain.call({ input: `${prompt}, respond according to the prompt` });
    generations2 = res2.response;

    io.emit('newGeneration2', generations2);

    console.log({ res2 }, "...........//res2//.........response");
    // console.log(await memory.chatHistory.getMessages());

    res.status(200).json({ res2: generations2 }); // Send the response as JSON object
});




app.get('/convertedValue', async (req, res) => {
    console.log('API request received from client');

    const response = {
        result1: generations1,
        res2: generations2
    };
    console.log("..............||CONVERTED VALUE||...............",response);

    res.status(200).json(response);
});




app.post('/chemistryValue', async (req, res) => {

    const memory = new BufferMemory();
    const payload = req.body;
    console.log('This is the payload request received from the client:', payload);
    const chemVal = payload.prompt;
    console.log('This is the chemVal request received:', chemVal);

    const sessionId = new Date().toISOString();
    const cacheName = 'Chemistry';

    // const chatHistory = await MomentoChatMessageHistory.fromProps({
    //     client,
    //     cacheName,
    //     sessionId,
    //     sessionTtl: 300,
    // });

    const model = new Cohere({
        maxTokens: 1000,
        apiKey: 'GQ7Zysexx8aB6HGZNpXjrlL27K28ARWPNcPVaa2y',
    });

    chain = new ConversationChain({ llm: model, memory: memory });

    const chemResult1 = await chain.call({
        input: `Respond according to the  ${chemVal} in  steps and respond appropriately`,
    });

    const chemGenerations1 = chemResult1.response;

    sharedData.chemResult1 = chemResult1; // Store the chemResult1 value in the shared variable

    io.emit('convertedValue', chemResult1); // Emit chemResult1 to socket.io clients
    io.emit('newGeneration', chemGenerations1);

    const responseData = {
        chemResult1: chemResult1,
        chemGenerations1: chemGenerations1,
    };

    console.log({ chemResult1 });

    res.status(200).json(responseData);
});

app.get('/chemistryConvertedValue', async (req, res) => {
    // Now you can access the chemResult1 value from the shared variable here
    const chemResult1 = sharedData.chemResult1;

    // Check if the chemResult1 is present
    if (chemResult1 && chemResult1.response) {
        const responseText = chemResult1.response;

        // Set the Content-Type header to indicate text/plain response
        res.setHeader('Content-Type', 'text/plain');

        // Send the response text
        res.status(200).send(responseText);
    } else {
        // If chemResult1 is not available or doesn't have a response, send an empty response
        res.status(404).send('Chemistry result not found.');
    }
});


io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
