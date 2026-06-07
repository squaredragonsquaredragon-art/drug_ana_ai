import OpenAI from "openai";

const client = new OpenAI({
    apiKey: "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",
});

async function test() {
    try {
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "user", content: "Hello" }
            ],
        });
        console.log("SUCCESS:", response.choices[0].message.content);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
}

test();
