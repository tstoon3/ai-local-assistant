export interface LocalTextFile {
  path: string;
  content: string;
  size: number;
}

export const MAX_SINGLE_FILE_BYTES = 64 * 1024;
export const MAX_FOLDER_FILES = 40;
export const MAX_FOLDER_TOTAL_BYTES = 80 * 1024;

const allowedExtensions = new Set([
  "txt", "md", "markdown", "csv", "json", "log", "xml", "html", "css",
  "js", "jsx", "ts", "tsx", "vue", "py", "rs", "toml", "yaml", "yml",
  "sql", "sh", "ps1", "bat", "java", "kt", "go", "c", "h", "cpp", "hpp",
  "cs", "php", "rb", "swift", "dart", "ini",
]);

const ignoredDirectories = new Set([
  ".git", "node_modules", "target", "dist", "build", ".venv", "venv",
  "__pycache__", ".next", ".nuxt", "coverage",
]);

function safeRelativePath(path: string): string | null {
  const segments = path.replace(/\\/g, "/").split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.startsWith(".") || /[\u0000-\u001f\u007f]/.test(segment))) return null;
  if (segments.some((segment) => ignoredDirectories.has(segment.toLowerCase()))) return null;
  return segments.join("/");
}

function isAllowedTextPath(path: string): boolean {
  const filename = path.split("/").pop() ?? "";
  const extension = filename.split(".").pop()?.toLowerCase();
  return !!extension && allowedExtensions.has(extension);
}

export async function readSelectedTextFile(file: File): Promise<LocalTextFile> {
  const path = safeRelativePath(file.name);
  if (!path || !isAllowedTextPath(path)) {
    throw new Error("Choose a supported text or source-code file. Hidden and binary files are excluded.");
  }
  if (file.size > MAX_SINGLE_FILE_BYTES) {
    throw new Error("A single file must be 64 KB or smaller.");
  }
  const content = await file.text();
  if (content.includes("\0")) throw new Error("This file does not appear to be plain text.");
  return { path, content, size: file.size };
}

export async function readSelectedFolder(files: readonly File[]): Promise<{ files: LocalTextFile[]; skipped: number }> {
  const candidates: Array<{ file: File; path: string }> = [];
  let skipped = 0;

  for (const file of files) {
    const rawPath = file.webkitRelativePath || file.name;
    const path = safeRelativePath(rawPath);
    if (!path || !isAllowedTextPath(path)) {
      skipped += 1;
      continue;
    }
    if (file.size > MAX_SINGLE_FILE_BYTES) {
      throw new Error(`${path} exceeds the 64 KB per-file limit. No folder files were attached.`);
    }
    candidates.push({ file, path });
  }

  if (candidates.length === 0) {
    throw new Error("No supported text or source-code files were found in that folder.");
  }
  if (candidates.length > MAX_FOLDER_FILES) {
    throw new Error(`The folder contains ${candidates.length} supported files; the limit is ${MAX_FOLDER_FILES}. No files were attached.`);
  }
  const totalBytes = candidates.reduce((sum, item) => sum + item.file.size, 0);
  if (totalBytes > MAX_FOLDER_TOTAL_BYTES) {
    throw new Error("Supported files in the folder exceed the 80 KB total limit. No files were attached.");
  }

  const loaded = await Promise.all(candidates.map(async ({ file, path }) => {
    const content = await file.text();
    if (content.includes("\0")) return null;
    return { path, content, size: file.size };
  }));
  const selected = loaded.filter((file): file is LocalTextFile => file !== null);
  skipped += loaded.length - selected.length;
  if (selected.length === 0) throw new Error("No supported plain-text files were found in that folder.");

  return { files: selected, skipped };
}
