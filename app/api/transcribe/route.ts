import { NextResponse } from "next/server"

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File
        const language = formData.get("language") as string

        if (!file) {
            return NextResponse.json(
                { error: "No file uploaded" },
                { status: 400 }
            )
        }

        const buffer = Buffer.from(await file.arrayBuffer())

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: file.type,
                                        data: buffer.toString("base64"),
                                    },
                                },
                                {
                                    text: `Transcribe this audio in ${language}`,
                                },
                            ],
                        },
                    ],
                }),
            }
        )

        const data = await response.json()

        const transcript =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || ""

        const cleanedTranscript = transcript.replace(/\[\d+m\d+s\d+ms-\d+m\d+s\d+ms\]/g, '')

        return NextResponse.json({
            transcript: cleanedTranscript,
            duration: 120,
        })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { error: "Transcription failed" },
            { status: 500 }
        )
    }
}
