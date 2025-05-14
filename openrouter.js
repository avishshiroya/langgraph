const { ChatOpenAI } = require("@langchain/openai");

function OpenRouterChat({ apiKey, modelName }) {
    return new ChatOpenAI({
        modelName,
        openAIApiKey: apiKey,
        configuration: {
            baseURL: "https://openrouter.ai/api/v1",
        },
    });
};

module.exports = { OpenRouterChat }
