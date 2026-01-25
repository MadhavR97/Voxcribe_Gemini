import { NextResponse } from "next/server"

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File
        const languageRaw = formData.get("language") as string | null
        const language = (typeof languageRaw === "string" && languageRaw.trim())
            ? languageRaw.trim()
            : "English"

        if (!file) {
            return NextResponse.json(
                { error: "No file uploaded" },
                { status: 400 }
            )
        }

        const buffer = Buffer.from(await file.arrayBuffer())

        const prompt = `Transcribe this audio file. Output the transcript in ${language} only. If the speech is in a different language, translate it to ${language}. Provide only the raw transcript text—no timestamps, labels, or commentary.`

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
                                    text: prompt,
                                },
                            ],
                        },
                    ],
                }),
            }
        )

        const data = await response.json()

        // Check if API returned an error
        if (!response.ok) {
            console.error("Gemini API error:", data)
            
            // Handle rate limit errors specifically
            if (data.error?.code === 429 || response.status === 429) {
                const errorMessage = data.error?.message || ""
                // Extract retry time if available
                const retryMatch = errorMessage.match(/Please retry in ([\d.]+)s/)
                const retryTime = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null
                
                return NextResponse.json(
                    { 
                        error: retryTime 
                            ? `Rate limit exceeded. Please wait ${retryTime} seconds and try again.`
                            : "Rate limit exceeded. Please wait a moment and try again."
                    },
                    { status: 429 }
                )
            }
            
            // Handle other API errors
            const errorMessage = data.error?.message || "Transcription API error"
            // Clean up long error messages
            const cleanMessage = errorMessage.length > 200 
                ? errorMessage.substring(0, 200) + "..."
                : errorMessage
            
            return NextResponse.json(
                { error: cleanMessage },
                { status: response.status }
            )
        }

        // Check for errors in response body (Gemini sometimes returns errors with 200 status)
        if (data.error) {
            console.error("Gemini API error in response:", data.error)
            
            // Handle rate limit errors
            if (data.error.code === 429) {
                const errorMessage = data.error.message || ""
                const retryMatch = errorMessage.match(/Please retry in ([\d.]+)s/)
                const retryTime = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null
                
                return NextResponse.json(
                    { 
                        error: retryTime 
                            ? `Rate limit exceeded. Please wait ${retryTime} seconds and try again.`
                            : "Rate limit exceeded. Please wait a moment and try again."
                    },
                    { status: 429 }
                )
            }
            
            return NextResponse.json(
                { error: data.error.message || "Transcription API error" },
                { status: 500 }
            )
        }

        // Log response for debugging (remove in production if needed)
        console.log("Gemini API response structure:", JSON.stringify(data, null, 2))

        // Extract transcript from response
        let transcript = ""
        
        // Primary path: candidates[0].content.parts[0].text
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            transcript = data.candidates[0].content.parts[0].text
        }
        // Fallback: direct text field
        else if (data?.text) {
            transcript = data.text
        }

        if (!transcript || transcript.trim() === "") {
            console.error("Empty transcript from API. Full response:", JSON.stringify(data, null, 2))
            return NextResponse.json(
                { error: "Transcription returned empty result. Please check your audio file and try again." },
                { status: 500 }
            )
        }

        // Clean up timestamp markers if present
        let cleanedTranscript = transcript
            // Remove [XmXsXms-XmXsXms] style (e.g. [0m5s100ms-0m10s200ms])
            .replace(/\[\d+m\d+s\d+ms-\d+m\d+s\d+ms\]/g, '')
            // Remove M:SS / MM:SS at start (e.g. 0:00, 00:06)
            .replace(/^\d{1,2}:\d{2}/, '')
            // Remove M:SS / MM:SS after sentence-ending punctuation (e.g. ?00:06, .00:15, )01:05)
            .replace(/(?<=[.?!)])\s*\d{1,2}:\d{2}/g, ' ')
        cleanedTranscript = cleanedTranscript.replace(/\s+/g, ' ').trim()

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
