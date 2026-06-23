import { decompressSync, strFromU8, unzipSync } from "fflate";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const LEGACY_WORD_MIME = "application/msword";
const PDF_MIME = "application/pdf";
const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json"];
const TEXT_MIME_TYPES = new Set(["application/json", "text/markdown", "text/csv"]);

const PDF_STREAM = asciiBytes("stream");
const PDF_END_STREAM = asciiBytes("endstream");
let pdfJsModulePromise = null;

export async function extractReadableText(file, fileName, mimeType) {
  const kind = getUploadFileKind(fileName, mimeType);

  if (kind === "text") {
    return file.text();
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (kind === "docx") {
    return extractDocxText(bytes);
  }

  if (kind === "pdf") {
    return extractPdfText(bytes);
  }

  if (kind === "legacy-word") {
    throw new Error("Legacy .doc files are not supported yet. Save the file as .docx or PDF, then upload it again.");
  }

  throw new Error("Iris accepts .txt, .md, .csv, .json, .docx, and text-based .pdf files.");
}

export function getUploadFileKind(fileName, mimeType) {
  const lowerName = String(fileName || "").toLowerCase();
  const cleanMime = String(mimeType || "").toLowerCase();

  if (lowerName.endsWith(".docx") || cleanMime === DOCX_MIME) return "docx";
  if (lowerName.endsWith(".pdf") || cleanMime === PDF_MIME) return "pdf";
  if (lowerName.endsWith(".doc") || cleanMime === LEGACY_WORD_MIME) return "legacy-word";
  if (
    TEXT_EXTENSIONS.some((extension) => lowerName.endsWith(extension)) ||
    cleanMime.startsWith("text/") ||
    TEXT_MIME_TYPES.has(cleanMime)
  ) {
    return "text";
  }

  return "unsupported";
}

function extractDocxText(bytes) {
  let entries;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error("Iris could not read this Word file. Check that it is a valid .docx file.");
  }

  const documentParts = Object.keys(entries)
    .filter((name) => {
      return (
        name === "word/document.xml" ||
        /^word\/(header|footer|footnotes|endnotes)\d*\.xml$/.test(name)
      );
    })
    .sort((left, right) => {
      if (left === "word/document.xml") return -1;
      if (right === "word/document.xml") return 1;
      return left.localeCompare(right);
    });

  const text = documentParts
    .map((name) => xmlToText(strFromU8(entries[name])))
    .filter(Boolean)
    .join("\n\n");

  if (!text.trim()) {
    throw new Error("Iris could not find readable text in this Word file.");
  }

  return text;
}

function xmlToText(xml) {
  return decodeXmlEntities(
    String(xml || "")
      .replace(/<w:tab\s*\/>/g, " ")
      .replace(/<w:br\s*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n\n")
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<\/w:tc>/g, " ")
      .replace(/<[^>]+>/g, "")
  );
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

async function extractPdfText(bytes) {
  const pdfJsText = await extractPdfTextWithPdfJs(bytes);
  if (pdfJsText.trim()) return pdfJsText;

  const simpleText = extractSimplePdfText(bytes);
  if (simpleText.trim()) return simpleText;

  throw new Error(
    "Iris could not find selectable text in this PDF. If it is scanned or image-only, run OCR or upload a .docx/.txt version."
  );
}

async function extractPdfTextWithPdfJs(bytes) {
  try {
    const { getDocument } = await loadPdfJs();
    const loadingTask = getDocument({
      data: bytes,
      disableFontFace: true,
      disableRange: true,
      disableStream: true,
      disableWorker: true,
      isEvalSupported: false,
      useWorkerFetch: false
    });
    const pdf = await loadingTask.promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent({
        disableNormalization: false,
        includeMarkedContent: false
      });
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/[ \t]{2,}/g, " ")
        .trim();

      if (pageText) pages.push(pageText);
      page.cleanup();
    }

    await pdf.destroy();
    return pages.join("\n\n");
  } catch (error) {
    console.warn("Iris PDF.js extraction failed", error?.message || error);
    return "";
  }
}

async function loadPdfJs() {
  ensurePromiseWithResolvers();
  ensurePdfJsGeometryPolyfills();
  pdfJsModulePromise ||= Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs")
  ]).then(([pdfJs, worker]) => {
    globalThis.pdfjsWorker ||= worker;
    return pdfJs;
  });
  return pdfJsModulePromise;
}

function ensurePromiseWithResolvers() {
  if (!Promise.withResolvers) {
    Promise.withResolvers = () => {
      let resolve;
      let reject;
      const promise = new Promise((innerResolve, innerReject) => {
        resolve = innerResolve;
        reject = innerReject;
      });
      return { promise, resolve, reject };
    };
  }
}

function ensurePdfJsGeometryPolyfills() {
  if (!globalThis.DOMMatrix) {
    globalThis.DOMMatrix = class DOMMatrix {
      constructor(init = [1, 0, 0, 1, 0, 0]) {
        const values = Array.isArray(init) || ArrayBuffer.isView(init) ? init : [1, 0, 0, 1, 0, 0];
        this.a = Number(values[0] ?? 1);
        this.b = Number(values[1] ?? 0);
        this.c = Number(values[2] ?? 0);
        this.d = Number(values[3] ?? 1);
        this.e = Number(values[4] ?? 0);
        this.f = Number(values[5] ?? 0);
      }

      multiplySelf() {
        return this;
      }

      preMultiplySelf() {
        return this;
      }

      translate() {
        return this;
      }

      scale() {
        return this;
      }

      invertSelf() {
        return this;
      }
    };
  }
}

function extractSimplePdfText(bytes) {
  const chunks = [];
  let searchFrom = 0;

  while (searchFrom < bytes.length) {
    const streamIndex = indexOfBytes(bytes, PDF_STREAM, searchFrom);
    if (streamIndex === -1) break;

    const dictionary = readPdfStreamDictionary(bytes, streamIndex);
    const dataStart = skipPdfStreamLineBreak(bytes, streamIndex + PDF_STREAM.length);
    const endIndex = indexOfBytes(bytes, PDF_END_STREAM, dataStart);
    if (endIndex === -1) break;

    const dataEnd = trimPdfStreamTrailingLineBreak(bytes, endIndex);
    const streamBytes = bytes.slice(dataStart, dataEnd);
    searchFrom = endIndex + PDF_END_STREAM.length;

    if (isPdfImageStream(dictionary)) continue;

    let contentBytes = null;
    if (hasPdfFlateFilter(dictionary)) {
      try {
        contentBytes = decompressSync(streamBytes);
      } catch {
        continue;
      }
    } else if (!hasPdfFilter(dictionary)) {
      contentBytes = streamBytes;
    }

    if (!contentBytes) continue;

    const content = bytesToBinaryString(contentBytes);
    const text = extractPdfContentText(content);
    if (text.trim()) chunks.push(text);
  }

  return chunks.join("\n\n");
}

function readPdfStreamDictionary(bytes, streamIndex) {
  const dictionaryStart = lastIndexOfBytes(bytes, asciiBytes("<<"), streamIndex, 5000);
  if (dictionaryStart === -1) return "";
  return bytesToBinaryString(bytes.slice(dictionaryStart, streamIndex));
}

function skipPdfStreamLineBreak(bytes, index) {
  if (bytes[index] === 13 && bytes[index + 1] === 10) return index + 2;
  if (bytes[index] === 10 || bytes[index] === 13) return index + 1;
  return index;
}

function trimPdfStreamTrailingLineBreak(bytes, endIndex) {
  if (bytes[endIndex - 2] === 13 && bytes[endIndex - 1] === 10) return endIndex - 2;
  if (bytes[endIndex - 1] === 10 || bytes[endIndex - 1] === 13) return endIndex - 1;
  return endIndex;
}

function isPdfImageStream(dictionary) {
  return /\/Subtype\s*\/Image\b/.test(dictionary);
}

function hasPdfFlateFilter(dictionary) {
  return /\/Filter\s*(?:\[[^\]]*)?\/FlateDecode\b/.test(dictionary);
}

function hasPdfFilter(dictionary) {
  return /\/Filter\b/.test(dictionary);
}

function extractPdfContentText(content) {
  const blocks = [];
  const blockPattern = /BT[\s\S]*?ET/g;
  let match;

  while ((match = blockPattern.exec(content))) {
    blocks.push(match[0]);
  }

  const sourceBlocks = blocks.length ? blocks : [content];
  return sourceBlocks.map(extractPdfTextTokens).filter(Boolean).join("\n");
}

function extractPdfTextTokens(block) {
  const parts = [];

  for (let index = 0; index < block.length; index += 1) {
    const char = block[index];

    if (char === "(") {
      const literal = readPdfLiteralString(block, index);
      pushPdfTextPart(parts, literal.text);
      index = literal.end;
    } else if (char === "<" && block[index + 1] !== "<") {
      const hex = readPdfHexString(block, index);
      pushPdfTextPart(parts, hex.text);
      index = hex.end;
    } else if (block.startsWith("T*", index) || char === "'") {
      parts.push("\n");
    }
  }

  return parts.join("");
}

function pushPdfTextPart(parts, text) {
  const clean = String(text || "");
  if (!clean) return;

  const previous = parts[parts.length - 1] || "";
  if (previous && /[A-Za-z0-9]$/.test(previous) && /^[A-Za-z0-9]/.test(clean)) {
    parts.push(" ");
  }

  parts.push(clean);
}

function readPdfLiteralString(input, start) {
  const output = [];
  let depth = 1;
  let index = start + 1;

  for (; index < input.length; index += 1) {
    const char = input[index];

    if (char === "\\") {
      const escaped = readPdfEscape(input, index);
      if (escaped.byte !== null) output.push(escaped.byte);
      index = escaped.end;
    } else if (char === "(") {
      depth += 1;
      output.push(40);
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) break;
      output.push(41);
    } else {
      output.push(input.charCodeAt(index) & 0xff);
    }
  }

  return {
    text: decodePdfStringBytes(new Uint8Array(output)),
    end: index
  };
}

function readPdfEscape(input, slashIndex) {
  const nextIndex = slashIndex + 1;
  const next = input[nextIndex];

  if (next === "\r" && input[nextIndex + 1] === "\n") {
    return { byte: null, end: nextIndex + 1 };
  }

  if (next === "\n" || next === "\r") {
    return { byte: null, end: nextIndex };
  }

  const escapes = {
    n: 10,
    r: 13,
    t: 9,
    b: 8,
    f: 12,
    "(": 40,
    ")": 41,
    "\\": 92
  };

  if (Object.prototype.hasOwnProperty.call(escapes, next)) {
    return { byte: escapes[next], end: nextIndex };
  }

  if (/[0-7]/.test(next)) {
    let octal = next;
    let end = nextIndex;
    while (octal.length < 3 && /[0-7]/.test(input[end + 1] || "")) {
      end += 1;
      octal += input[end];
    }
    return { byte: parseInt(octal, 8) & 0xff, end };
  }

  return { byte: next ? next.charCodeAt(0) & 0xff : null, end: nextIndex };
}

function readPdfHexString(input, start) {
  const end = input.indexOf(">", start + 1);
  if (end === -1) return { text: "", end: input.length - 1 };

  let hex = input.slice(start + 1, end).replace(/\s+/g, "");
  if (hex.length % 2 === 1) hex += "0";

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = parseInt(hex.slice(index, index + 2), 16);
  }

  return {
    text: decodePdfStringBytes(bytes),
    end
  };
}

function decodePdfStringBytes(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let text = "";
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      text += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
    }
    return text;
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    let text = "";
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      text += String.fromCharCode(bytes[index] | (bytes[index + 1] << 8));
    }
    return text;
  }

  return bytesToBinaryString(bytes);
}

function indexOfBytes(bytes, needle, start = 0) {
  const end = bytes.length - needle.length;
  for (let index = start; index <= end; index += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return index;
  }
  return -1;
}

function lastIndexOfBytes(bytes, needle, before, maxLookback) {
  const minimum = Math.max(0, before - maxLookback);
  for (let index = before - needle.length; index >= minimum; index -= 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return index;
  }
  return -1;
}

function asciiBytes(value) {
  return Uint8Array.from(String(value).split("").map((char) => char.charCodeAt(0)));
}

function bytesToBinaryString(bytes) {
  const chunkSize = 8192;
  let text = "";
  for (let start = 0; start < bytes.length; start += chunkSize) {
    text += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }
  return text;
}
