import { NextRequest, NextResponse } from "next/server"

// Minimal PDF generator (no jspdf) – A4, Helvetica, multi-page

const PDF_HEADER = "%PDF-1.4\n"
const MARGIN = 40
const PAGE_W = 595
const PAGE_H = 842
const LINE_HEIGHT = 14
const FONT_SIZE = 12
const CHARS_PER_LINE = 84 // ~515pt / 6pt per char

function escapePdfString(s: string): string {
  let out = ""
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c === 92) out += "\\\\"
    else if (c === 40) out += "\\("
    else if (c === 41) out += "\\)"
    else if (c === 13) out += "\\r"
    else if (c === 10) out += "\\n"
    else if (c === 9) out += "\\t"
    else if (c > 127) out += "\\" + (c).toString(8).padStart(3, "0")
    else if (c >= 32 && c < 127) out += s[i]
    else out += "\\" + (c).toString(8).padStart(3, "0")
  }
  return out
}

function wrapLines(text: string): string[] {
  const out: string[] = []
  const paras = text.split(/\r?\n/)
  for (const p of paras) {
    let rest = p
    while (rest.length > CHARS_PER_LINE) {
      const chunk = rest.slice(0, CHARS_PER_LINE)
      const lastSpace = chunk.lastIndexOf(" ")
      const cut = lastSpace > CHARS_PER_LINE / 2 ? lastSpace + 1 : CHARS_PER_LINE
      out.push(rest.slice(0, cut).trimEnd())
      rest = rest.slice(cut)
    }
    if (rest.length > 0) out.push(rest)
  }
  return out.length > 0 ? out : [""]
}

function buildPdf(content: string): Buffer {
  const lines = wrapLines(content)
  const maxY = PAGE_H - MARGIN
  let y = maxY
  const lineH = LINE_HEIGHT
  const pages: string[] = []
  let pageLines: string[] = []

  for (const line of lines) {
    if (y - lineH < MARGIN && pageLines.length > 0) {
      pages.push(pageLines.join("\n"))
      pageLines = []
      y = maxY
    }
    pageLines.push(line)
    y -= lineH
  }
  if (pageLines.length > 0) pages.push(pageLines.join("\n"))

  const objs: string[] = []
  let objId = 1

  objs.push(`${objId++} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`)
  const pageRefs: number[] = []

  for (let i = 0; i < pages.length; i++) {
    pageRefs.push(objId)
    const pageId = objId++
    objs.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${objId} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> >> >> >>\nendobj\n`
    )
    const streamLines = pages[i].split("\n")
    // 0 g = black fill (required for text to show in some viewers)
    let stream = "BT 0 g /F1 " + FONT_SIZE + " Tf " + MARGIN + " " + (maxY - (streamLines.length - 1) * lineH) + " Td\n"
    for (let j = 0; j < streamLines.length; j++) {
      if (j > 0) stream += "0 -" + lineH + " Td "
      stream += "(" + escapePdfString(streamLines[j]) + ") Tj\n"
    }
    stream += "ET"
    const streamBuf = Buffer.from(stream, "ascii")
    objs.push(`${objId++} 0 obj\n<< /Length ${streamBuf.length} >>\nstream\n`)
    objs.push(stream)
    objs.push("\nendstream\nendobj\n")
  }

  const pagesObj =
    `2 0 obj\n<< /Type /Pages /Kids [${pageRefs.map((r) => r + " 0 R").join(" ")}] /Count ${pages.length} >>\nendobj\n`
  objs.splice(1, 0, pagesObj)

  const body = objs.join("")
  const bodyBuf = Buffer.from(body, "ascii")

  const xref: string[] = ["xref", "0 " + objId, "0000000000 65535 f "]
  for (let n = 1; n < objId; n++) {
    const idx = body.indexOf(n + " 0 obj\n")
    if (idx >= 0)
      xref.push((PDF_HEADER.length + idx).toString().padStart(10, "0") + " 00000 n ")
  }

  const startxref = PDF_HEADER.length + bodyBuf.length
  const trailer =
    "trailer\n<< /Size " + objId + " /Root 1 0 R >>\nstartxref\n" + startxref + "\n%%EOF\n"
  const xrefStr = xref.join("\n") + "\n"
  const total = Buffer.concat([
    Buffer.from(PDF_HEADER, "ascii"),
    bodyBuf,
    Buffer.from(xrefStr + trailer, "ascii"),
  ])
  return total
}

export async function POST(req: NextRequest) {
  try {
    const { text = "", filename = "transcript" } = (await req.json()) as {
      text?: string
      filename?: string
    }
    const safeName = (filename || "transcript").replace(/[^a-zA-Z0-9._-]/g, "_")
    const content = String(text || "(No transcript)").trim() || "(No transcript)"

    const buf = buildPdf(content)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    })
  } catch (e) {
    console.error("PDF export failed:", e)
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    )
  }
}
