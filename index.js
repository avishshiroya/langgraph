const { z } = require("zod")
const { OpenRouterChat } = require("./openrouter.js")
const { StateGraph, Annotation } = require("@langchain/langgraph")


const llm1 = OpenRouterChat({
    modelName: "qwen/qwen3-235b-a22b:free",
    apiKey: "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"
})

const llm2 = OpenRouterChat({
    modelName: "qwen/qwen3-235b-a22b:free",
    apiKey: "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"
})

const notificationSchema = z.array(z.object({
    title: z.string().describe("Title of the notification"),
    message: z.string().describe("Creative message for the user including tone, context, and product details")
}));


const notificationEvaluator = llm1.withStructuredOutput(notificationSchema)

const feedBack = z.object({
    grade: z.enum(['ok', "bad"]).describe("Evaluate if the notification is good or needs changes"),
    feedback: z.string().describe("Feedback explaining what to improve if needed")
});


const responseEvaluator = llm2.withStructuredOutput(feedBack)

const StateAnnotation = Annotation.Root({
    notification: notificationSchema,
    input: String,
    grade: String,
    feedback: String,
});

let retryCount = 0;
const MAX_RETRIES = 3;

const generateNotification = async (state) => {
    retryCount++
    if (retryCount > MAX_RETRIES) {
        return {
            notification: [{
                title: "Fallback Notification",
                message: "Sorry! We couldn’t generate a suitable message after several attempts."
            }]
        };
    }
    if (state.feedback) {
        const msg = await notificationEvaluator.invoke([
            { role: "system", content: "You are the head of marketing department. your work is select the most relatable notifications in the list which is given by your juniors. also , check the user prompt and match the requirements and notification list . then, select the appropriate notifications and return it if needed you can modified it.your strategies about you first rate the notifications. and approved the notification which has rate between 8 to 10. If notifications not appropriat then you create the 3 to 4 notifications. with the some creative ideas." },
            { role: "user", content: `this is the user prompt ${state.input} on the user prompt check the given notification and rate based on this notifications ${state.notification} and return best notification. and this one is feedback for the notification is this is helpful ${state.feedback}` }
        ])
        return { notification: msg }
    } else {
        const msg = await notificationEvaluator.invoke([
            { role: "system", content: "You are the best marketing agent. who can create the mobile notifications with creative thought like attachment of the emotionally , romantically with fun & joy with the noitifaction to end user. And You have the mastery in the creativity thoughts. You can go as well with the festivals , current news and etc . within come in the one month. You can provide the multiple type of notification length between minimum 7 - maximum 9 and format in which is like given. most important things about you , your given all notification always unique." },
            { role: "user", content: `Create notifications using the user prompt ${state.input}` }
        ])
        return { notification: msg }
    }
}


const llmCallEvaluator = async (state) => {
    const messages = [
        {
            role: "system",
            content: "You are a quality control evaluator for marketing notifications. Grade them as 'ok' or 'bad' and provide feedback if needed."
        },
        {
            role: "user",
            content: `Evaluate the following notification based on the input: "${state.input}"\nNotifications: ${JSON.stringify(state.notification)}`
        }
    ];
    const result = await responseEvaluator.invoke(messages);
    return {
        grade: result.grade,
        feedback: result.feedback
    };
};


const conditionalEdge = async (state) => {
    if (state.grade == "ok") {
        return "OK"
    } else {
        return "BAD"
    }
}

const workFlow = new StateGraph(StateAnnotation)
    .addNode("llmCall", generateNotification)
    .addNode("llmCallEvaluator", llmCallEvaluator)
    .addEdge("__start__", "llmCall")
    .addEdge("llmCall", "llmCallEvaluator")
    .addConditionalEdges("llmCallEvaluator", conditionalEdge, {
        "OK": "__end__",
        "BAD": "llmCall"
    })
    .compile();

(async () => {
    const result = await workFlow.invoke({
        input: "create the 10% on diwali festival notification"
    });
    console.log("Final Approved Notifications:\n", result.notification);
})();

