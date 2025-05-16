
const { z } = require("zod");
const { StateGraph, } = require("@langchain/langgraph");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { config } = require("dotenv")
config()

// Using Google's Gemini model
const llm1 = new ChatGoogleGenerativeAI({
    model: process.env.MODEL,
    apiKey: process.env.GEMINI_KEY
});

const llm2 = new ChatGoogleGenerativeAI({
    model: process.env.MODEL,
    apiKey: process.env.GEMINI_KEY
});

const response = {
    input: z.string().describe("User input for notification generation"),
    notification: z.array(
        z.object({
            title: z.string().describe("Title of the notification"),
            message: z.string().describe("Creative message for the user including tone, context, and product details")
        })
    ).describe("List of generated notifications"),
    grade: z.enum(["ok", "bad"]).describe("Evaluation grade of notifications - ok or bad"),
    feedback: z.string().describe("Detailed feedback explaining improvements needed for notifications")
}

const notificationSchema = z.array(z.object({
    title: z.string().describe("Title of the notification"),
    message: z.string().describe("Creative message for the user including tone, context, and product details")
}));

const feedbackSchema = z.object({
    grade: z.enum(['ok', "bad"]).describe("Evaluate if the notification is good or needs changes"),
    feedback: z.string().describe("Feedback explaining what to improve if needed")
});

const notificationEvaluator = llm1.withStructuredOutput(notificationSchema);
const responseEvaluator = llm2.withStructuredOutput(feedbackSchema);

const MAX_RETRIES = 3;
let retries


// Function to generate notification
const generateNotification = async (values) => {
    // Create current state from values
    const state = { ...values };
    retries += 1;

    if (retries > MAX_RETRIES) {
        return {
            ...state,
            notification: [{
                title: "Fallback Notification",
                message: "Sorry! We couldn't generate a suitable message after several attempts."
            }]
        };
    }
    console.log(state);

    if (state.feedback) {
        const msg = await notificationEvaluator.invoke([
            {
                role: "system",
                content: "You are the best marketing agent who can create mobile notifications with creative thoughts, emotionally engaging, romantic, fun & joyful notifications for end users. You have mastery in creative thinking. You can reference festivals, current news, etc. within the coming month. Provide 7-9 different notifications formatted as requested. Most importantly, ensure all notifications are unique."
            },
            {
                role: "user",
                content: `This is the user prompt: ${state.input}. Based on the user prompt, check the given notifications and rate them: ${JSON.stringify(state.notification)}. Return the best notification. Feedback for the previous notification: ${state.feedback}`
            }
        ]);
        console.log("Feed back ........ 1awerbjklfdhkhzfkljkzdfbkljhzdfklklzdfjklzildfg ", msg);

        return { ...state, notification: msg };
    } else {
        const msg = await notificationEvaluator.invoke([
            {
                role: "system",
                content: "You are the best marketing agent who can create mobile notifications with creative thoughts, emotionally engaging, romantic, fun & joyful notifications for end users. You have mastery in creative thinking. You can reference festivals, current news, etc. within the coming month. Provide 7-9 different notifications formatted as requested. Most importantly, ensure all notifications are unique."
            },
            {
                role: "user",
                content: `Create notifications using the user prompt: ${state.input}`
            }
        ]);
        console.log("Only Msg ........ 1awerbjklfdhkhzfkljkzdfbkljhzdfklklzdfjklzildfg ", msg);
        return { ...state, notification: msg };
    }
};
const selectNotifcation = async (values) => {
    const state = { ...values };

    const msg = await notificationEvaluator.invoke([
        {
            role: "system",
            content: "You are the head of marketing department. Your work is to select the most relatable notifications in the list which is given by your juniors. Also, check the user prompt and match the requirements and notification list. Then, select the appropriate notifications and return it. If needed, you can modify them. Your strategy is to first rate the notifications and approve those with rates between 8 to 10. If notifications are not appropriate,and minimum you have to select 3 t0 4 notification and it is not so then you have to create 3 to 4 notifications with creative ideas."
        },
        {
            role: "user",
            content: `This is the user prompt: ${state.input}. Based on the user prompt, check the given notifications and rate them: ${JSON.stringify(state.notification)}. Return the best notification.`
        }
    ]);
    console.log("Select the notification ........ 1awerbjklfdhkhzfkljkzdfbkljhzdfklklzdfjklzildfg ", msg);

    return { ...state, notification: msg };

};

const evaluateNotification = async (values) => {
    const state = { ...values };

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
    console.log(result);

    return {
        ...state,
        grade: result.grade,
        feedback: result.feedback
    };
};

// Conditional routing function
const shouldContinue = (values) => {
    if (values.grade === "ok") {
        return "select";
        // return "end";
    } else {
        return "regenerate";
    }
};

// Create and compile the workflow
const workflow = new StateGraph({ channels: response })
    .addNode("generate", generateNotification)
    .addNode("evaluate", evaluateNotification)
    .addNode("select", selectNotifcation)
    .addEdge("__start__", "generate")
    .addEdge("generate", "evaluate")
    .addConditionalEdges(
        "evaluate",
        shouldContinue,
        {
            // "end": "__end__",
            "select": "select",
            "regenerate": "generate"
        }
    ).addEdge("select","__end__")

const graph = workflow.compile();



const product = {
    "title": "Glossy Pink & Purple Gradient Case",
    "description": "The latest iteration of our flagship protective case features impact-absorbing materials and MagSafe® compatibility, all in a sleeker design that's thinner yet just as protective.",
    "price": 119.99,
    "salePrice": 79.99
};

// Execute the workflow
(async () => {
    try {
        // const graph1 = await graph.getGraphAsync();
        // console.log(JSON.stringify(graph1.toJSON()));
        const result = await graph.invoke({
            input: `Create a notification using this product details ${JSON.stringify(product)} `,
            notification: [],
            grade: "",
            feedback: ""
        });
        console.log("Final Approved Notifications:\n", result);
    } catch (error) {
        console.error("Error executing workflow:", error);
    }
})();