// app/api/export/pdf/route.ts
import { NOTO_SANS_HINDI } from "@/lib/fonts"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { text, filename = "transcript" } = await req.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Empty transcript" },
        { status: 400 }
      )
    }

    // Clean filename only - remove invalid characters
    const cleanFilename = (filename || "transcript")
      .replace(/[<>:"/\\|?*]/g, '')
      .trim() || "transcript"

    // Use jsPDF with proper font support
    const { jsPDF } = await import('jspdf')

    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // --- HINDI FONT REGISTRATION ---
    // 1. Add the Base64 font to the internal Virtual File System
    doc.addFileToVFS("NotoSansHindi.ttf", NOTO_SANS_HINDI);
    
    // 2. Register the font name "HindiFont"
    doc.addFont("NotoSansHindi.ttf", "HindiFont", "normal");
    
    // 3. Set this as the global font for the document
    doc.setFont("HindiFont");
    // -------------------------------

    // Add title
    doc.setFontSize(18)
    // Note: We don't use "bold" here because Noto Sans Hindi is a separate file for bold. 
    // The regular font will render the Hindi characters correctly.
    
    // Handle title - split into multiple lines if too long
    const titleLines = doc.splitTextToSize(filename, 170)
    let yPosition = 20

    titleLines.forEach((line: string) => {
      doc.text(line, 105, yPosition, { align: "center" })
      yPosition += 8
    })

    // Add timestamp
    doc.setFontSize(10)
    const timestamp = `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    doc.text(timestamp, 105, yPosition + 5, { align: "center" })
    yPosition += 15

    // Add transcript content
    doc.setFontSize(11)

    // Split text into lines that fit page width
    const contentWidth = 170 // mm
    const lines = doc.splitTextToSize(text, contentWidth)

    const pageHeight = 297 // A4 height in mm
    const bottomMargin = 25
    let currentY = yPosition

    // Add content line by line
    for (let i = 0; i < lines.length; i++) {
      // Check if we need a new page
      if (currentY > pageHeight - bottomMargin) {
        doc.addPage()
        // IMPORTANT: Reset font settings on every new page
        doc.setFont("HindiFont");
        doc.setFontSize(11);
        currentY = 20
      }

      doc.text(lines[i], 20, currentY)
      currentY += 7
    }

    // Add page numbers
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFont("HindiFont"); // Ensure font is set for footer
      doc.setFontSize(9)
      doc.text(
        `Page ${i} of ${pageCount}`,
        105,
        pageHeight - 10,
        { align: "center" }
      )
    }

    // Get PDF as array buffer
    const pdfArrayBuffer = doc.output('arraybuffer')
    const pdfUint8Array = new Uint8Array(pdfArrayBuffer)

    return new Response(pdfUint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(cleanFilename)}.pdf"`,
        'Content-Length': pdfUint8Array.length.toString(),
      }
    })

  } catch (error) {
    console.error('PDF export failed:', error)

    // ULTIMATE FALLBACK: Plain text file
    try {
      const { text, filename = "transcript" } = await req.json()
      const cleanFilename = (filename || "transcript")
        .replace(/[<>:"/\\|?*]/g, '')
        .trim() || "transcript"

      // Create a text file with the transcript (Text files handle Hindi/UTF-8 natively)
      const textContent = `${filename}\n\nGenerated on ${new Date().toLocaleString()}\n\n${'='.repeat(50)}\n\n${text}`
      const textBuffer = Buffer.from(textContent, 'utf-8')

      return new Response(textBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(cleanFilename)}.txt"`,
          'Content-Length': textBuffer.length.toString(),
        }
      })
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Export failed. Please try again.' },
        { status: 500 }
      )
    }
  }
}