const { z } = require("zod")
const { OpenRouterChat } = require("./openrouter.js")
const { StateGraph, Annotation } = require("@langchain/langgraph")
const { RunnableLambda } = require("@langchain/core/runnables");


const llm = OpenRouterChat({
    modelName: "qwen/qwen3-235b-a22b:free",
    apiKey: "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"
})
const notificationSchema = z.array(z.object({
    title: z.string().describe(
        "title of the notification"
    ),
    message: z.string().describe(
        "message of the notification on the given data notification tone , product title and description"
    ),
}));
const StateAnnotation = Annotation.Root({
    notification: notificationSchema,
    input: String,
    grade: String,
    feedback: String,
});

//llm Call
const generateNotification = async (state) => {
    if (state.feedback) {
        const msg = await llm.invoke([
            { role: "system", content: "You are the head of marketing department. your work is select the most relatable notifications in the list which is given by your juniors. also , check the user prompt and match the requirements and notification list . then, select the appropriate notifications and return it if needed you can modified it.your strategies about you first rate the notifications. and approved the notification which has rate between 8 to 10. If notifications not appropriat then you create the 3 to 4 notifications. with the some creative ideas." },
            { role: "user", content: `this is the user prompt ${state.input} on the user prompt check the given notification and rate based on this notifications ${state.notification} and return best notification. and this one is feedback for the notification is this is helpful ${state.feedback}` }
        ])
        return { notification: msg.content }
    } else {
        const msg = await llm.invoke([
            { role: "system", content: "You are the best marketing agent. who can create the mobile notifications with creative thought like attachment of the emotionally , romantically with fun & joy with the noitifaction to end user. And You have the mastery in the creativity thoughts. You can go as well with the festivals , current news and etc . within come in the one month. You can provide the multiple type of notification length between minimum 7 - maximum 9 and format in which is like given. most important things about you , your given all notification always unique." },
            { role: "user", content: `Create notifications using the user prompt ${state.input}` }
        ])
        return { notification: msg.content }
    }
}


const feedBack = z.object({
    grade: z.enum(['ok', "bad"]).describe("Decide the notification title and message is ok or bad"),
    feedback: z.string().describe("Give the feed back for the which is want to fix.")
})

const responseEvaluator = llm.withStructuredOutput(feedBack)

const llmCallEvaluator = async (state) => {
    const feedback = await responseEvaluator.invoke(
        `Grade the notification ${state.notification} and use this user input for validation: ${state.input}`
    );
    return { grade: feedback.grade, feedback: feedback.feedback };
};



const conditionalEdge = async (state) => {
    if (state.grade == "ok") {
        return "OK"
    } else {
        return "BAD"
    }
}


const workFlow = new StateGraph(StateAnnotation)
    .addNode("llmCall", new RunnableLambda({ func: generateNotification }))
    .addNode("llmCallEvaluator", new RunnableLambda({ func: llmCallEvaluator }))
    .addEdge("__start__", "llmCall")
    .addEdge("llmCall", "llmCallEvaluator")
    .addConditionalEdges("llmCallEvaluator", conditionalEdge, {
        "OK": "__end__",
        "BAD": "llmCall"
    })
    .compile();

(async () => {
    const result = await workFlow.invoke({ input: "create the 10% on diwali festival notification" });
    console.log(result.notification);
})();
