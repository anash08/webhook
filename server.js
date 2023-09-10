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
const { ChatOpenAI } = require("langchain/chat_models/openai");


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

const client = new CacheClient({
    configuration: Configurations.Laptop.v1(),
    credentialProvider: CredentialProvider.fromEnvironmentVariable({
        environmentVariableName: "MOMENTO_AUTH_TOKEN"
    }),
    defaultTtlSeconds: 60 * 60 * 24,
});

const memory = new BufferMemory();

app.post('/webhook', async (req, res) => {
    const payload = req.body;
    console.log("...............//this is the payload", payload);
    convertedValue = payload.convertedValue;
    console.log(".........../////////convertedValue//////////.....", convertedValue);
    const latexVal = convertToLatex(convertedValue);
    console.log("............//this is the latex value", latexVal);

    const sessionId = new Date().toISOString();
    const cacheName = "langchain";

    const chatHistory = await MomentoChatMessageHistory.fromProps({
        client,
        cacheName,
        sessionId,
        sessionTtl: 300,
    });

    // const model = new Cohere({
    //     maxTokens: 1000,
    //     apiKey: "GQ7Zysexx8aB6HGZNpXjrlL27K28ARWPNcPVaa2y",
    // });

    const model = new ChatOpenAI({
        openAIApiKey : "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",
        modelName: "gpt-3.5-turbo",
        temperature: 0,
      });

    chain = new ConversationChain({ llm: model, memory: memory });

    const result1 = await chain.call({
        // input: `solve ${latexVal} mathematically in not more than 5 steps, dont use any word or sentences, only use math numbers and symbols and show me the correct answer`
        // input: `Respond according to the  ${latexVal} in  5 steps and respond appropriately, explain in brief and where its been used.`,
        input :`Analyze the following ${latexVal} and provide a comprehensive assessment. Determine the following:

       1: Determine if the equation is mathematically correct. If it is incorrect, identify the specific issues.
        2:Identify the category or field of mathematics to which this equation belongs. Specify if it is related to differentiation, integration, or another area of mathematics.
        3. Analyze if the equation is solvable. If it is solvable, provide a detailed, step-by-step mathematical solution without using words, indexing the steps as (a), (b), (c), etc. Then, explain the solution in plain language. 
        4:Determine if this equation is derived from a specific mathematical theorem, concept, or real-world problem. Explain its origin and the context in which it is applied.
        5:If the equation involves differentiation, explore aspects such as derivatives, implicit differentiation, higher-order derivatives, derivatives of trigonometric and exponential functions, the chain rule, product rule, quotient rule, and implicit differentiation with trigonometry.
        6:If the equation involves integration, investigate topics like definite integrals, indefinite integrals (antiderivatives), integration by substitution, integration by parts, trigonometric integrals, integration with partial fractions, applications of integration, improper integrals, and integration with trigonometric substitution.
            
Please provide a structured analysis that addresses each of these aspects thoroughly. Ensure that, when solving mathematically, you use the appropriate mathematical notation and symbols.
`
    
    });


    generations1 = result1.response;

    io.emit('convertedValue', convertedValue);
    io.emit('newGeneration', generations1);

    console.log({ result1 });

    res.status(200).send(generations1);
});

app.post('/res2', async (req, res) => {
    const  prompt  = req.body;
    console.log("****************", prompt);
    const value = prompt.inputValue
    const res2 = await chain.call({ input: ` respond according to the ${value}` });
    generations2 = res2.response;

    io.emit('newGeneration2', generations2);

    console.log({ res2 }, "...........//res2//.........response");
    // console.log(await memory.chatHistory.getMessages());

    res.status(200).json({ res2: generations2 }); // Send the response as JSON object
});




app.get('/convertedValue', async (req, res) => {
    console.log('API request received from client');

    const response = {
        convertedValue: convertedValue,
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
        input: `Respond according to the  ${chemVal} in  steps and rersspond appropriately`,
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
