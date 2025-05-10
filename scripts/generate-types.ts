// scripts/generate-types.ts
const fs = require("fs").promises;
const path = require("path");

const contentFilePath = path.join(
  process.cwd(),
  "public",
  "content",
  "content.json"
);
const typesFilePath = path.join(process.cwd(), "src", "types", "types.ts");
const mediaFolderPath = path.join(process.cwd(), "media"); // Путь к папке media
const generatedInterfaceName = "AppContent";
const startMarker = `// --- START OF GENERATED ${generatedInterfaceName} INTERFACE ---`;
const endMarker = `// --- END OF GENERATED ${generatedInterfaceName} INTERFACE ---`;

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
interface JsonObject {
  [key: string]: JsonValue;
}
interface JsonArray extends Array<JsonValue> {}

function isSimpleValue(value: JsonValue): boolean {
  const type = typeof value;
  return (
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    value === null
  );
}

function buildInterfaceString(jsonObject: JsonObject): string {
  let interfaceString = `/**\n * ВНИМАНИЕ: Этот интерфейс генерируется автоматически скриптом generate-types.ts\n * Он отражает ТОЧНУЮ структуру вашего файла public/content/content.json.\n * ВСЕ поля считаются обязательными строками.\n * Не редактируйте этот интерфейс вручную, он будет перезаписан.\n */\n`;
  interfaceString += `export interface ${generatedInterfaceName} {\n`;

  for (const pageKey in jsonObject) {
    if (!Object.prototype.hasOwnProperty.call(jsonObject, pageKey)) continue;
    const pageData = jsonObject[pageKey];
    if (
      typeof pageData !== "object" ||
      pageData === null ||
      Array.isArray(pageData)
    ) {
      console.warn(
        `[generate-types] Warning: Page '${pageKey}' is not an object. Skipping.`
      );
      continue;
    }
    const pageDataObject = pageData as JsonObject;
    interfaceString += `  ${JSON.stringify(pageKey)}: {\n`;
    for (const sectionKey in pageDataObject) {
      if (!Object.prototype.hasOwnProperty.call(pageDataObject, sectionKey))
        continue;
      const sectionData = pageDataObject[sectionKey];
      if (
        typeof sectionData !== "object" ||
        sectionData === null ||
        Array.isArray(sectionData)
      ) {
        console.warn(
          `[generate-types] Warning: Section '${pageKey}.${sectionKey}' is not an object. Skipping.`
        );
        continue;
      }
      const sectionDataObject = sectionData as JsonObject;
      interfaceString += `    ${JSON.stringify(sectionKey)}: {\n`;
      for (const fieldKey in sectionDataObject) {
        if (!Object.prototype.hasOwnProperty.call(sectionDataObject, fieldKey))
          continue;
        const fieldValue = sectionDataObject[fieldKey];
        if (!isSimpleValue(fieldValue)) {
          console.warn(
            `[generate-types] Warning: Field '${pageKey}.${sectionKey}.${fieldKey}' has complex value. Assuming 'string'.`
          );
        }
        interfaceString += `      ${JSON.stringify(fieldKey)}: string;\n`;
      }
      interfaceString += `    };\n`;
    }
    interfaceString += `  };\n`;
  }
  interfaceString += `}\n`;
  return interfaceString;
}

/**
 * Проверяет папку media на дублирующиеся базовые имена файлов.
 */
async function checkMediaForDuplicateBasenames() {
  console.log(
    `\n[media-check] Checking media folder at ${mediaFolderPath} for duplicate base names...`
  );
  let files: string[];
  try {
    files = await fs.readdir(mediaFolderPath);
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    if (e.code === "ENOENT") {
      console.log(
        `${YELLOW}[media-check] Media folder not found. Skipping duplicate check.${RESET}`
      );
      return;
    }
    console.error(
      `${RED}[media-check] Error reading media directory: ${
        e.message || String(error)
      }${RESET}`
    );
    return;
  }

  const basenamesCount: Record<string, string[]> = {};

  for (const file of files) {
    if (file.startsWith(".")) continue;
    try {
      const stat = await fs.stat(path.join(mediaFolderPath, file));
      if (stat.isDirectory()) continue;
    } catch (statError) {
      console.warn(
        `${YELLOW}[media-check] Warning: Could not stat file '${file}'. Skipping.${RESET}`
      );
      continue;
    }

    const extension = path.extname(file);
    const basename = path.basename(file, extension);

    if (!basenamesCount[basename]) {
      basenamesCount[basename] = [];
    }
    basenamesCount[basename].push(file);
  }

  let duplicatesFound = false;
  let warningMessages: string[] = [];

  for (const basename in basenamesCount) {
    if (basenamesCount[basename].length > 1) {
      if (!duplicatesFound) {
        warningMessages.push(
          `${BOLD}${RED}WARNING: Found files with duplicate base names in media folder:${RESET}`
        );
        duplicatesFound = true;
      }
      warningMessages.push(
        `  ${YELLOW}Base name: "${basename}"${RESET} corresponds to files: ${basenamesCount[
          basename
        ].join(", ")}`
      );
    }
  }

  if (!duplicatesFound) {
    console.log(
      `${BOLD}${GREEN}[media-check] No duplicate base names found in media folder. All good!${RESET}`
    );
  } else {
    warningMessages.forEach((msg) => console.warn(msg));
    console.warn(
      `${BOLD}${RED}[media-check] Please resolve these duplicates to avoid unexpected behavior when referencing images by base name.${RESET}`
    );
  }
  console.log(`[media-check] Finished checking media folder.`);
}

async function generateAndWriteTypes() {
  console.log(
    `[generate-types] Starting type generation from ${path.basename(
      contentFilePath
    )}...`
  );
  try {
    let contentJsonString: string;
    try {
      contentJsonString = await fs.readFile(contentFilePath, "utf-8");
    } catch (readError: unknown) {
      const message =
        readError instanceof Error ? readError.message : String(readError);
      console.error(`[generate-types] Error reading content file: ${message}`);
      process.exit(1);
    }

    let contentObject: JsonObject;
    try {
      const parsedJson: unknown = JSON.parse(contentJsonString);
      if (
        typeof parsedJson !== "object" ||
        parsedJson === null ||
        Array.isArray(parsedJson)
      ) {
        throw new Error("Content file is not a valid JSON object at the root.");
      }
      contentObject = parsedJson as JsonObject;
    } catch (parseError: unknown) {
      const message =
        parseError instanceof Error ? parseError.message : String(parseError);
      console.error(`[generate-types] Error parsing JSON: ${message}`);
      process.exit(1);
    }

    const newInterfaceContent = buildInterfaceString(contentObject);
    let existingTypesContent = "";
    try {
      existingTypesContent = await fs.readFile(typesFilePath, "utf-8");
    } catch (readTypesError: unknown) {
      const e = readTypesError as { code?: string; message?: string };
      if (e.code !== "ENOENT") {
        console.error(
          `[generate-types] Error reading types file: ${
            e.message || String(readTypesError)
          }`
        );
        process.exit(1);
      }
      console.log(`[generate-types] Types file not found. Creating a new one.`);
    }

    const startIndex = existingTypesContent.indexOf(startMarker);
    const endIndex = existingTypesContent.indexOf(endMarker);
    let finalTypesContent: string;
    const wrappedNewContent = `${startMarker}\n${newInterfaceContent}${endMarker}`;

    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
      console.log(`[generate-types] Found existing interface. Replacing...`);
      const before = existingTypesContent.substring(0, startIndex);
      const after = existingTypesContent.substring(endIndex + endMarker.length);
      finalTypesContent = `${before}${wrappedNewContent}${after}`;
    } else {
      console.log(`[generate-types] No existing interface found. Appending...`);
      finalTypesContent =
        existingTypesContent.trim() + `\n\n${wrappedNewContent}\n`;
    }

    try {
      await fs.writeFile(typesFilePath, finalTypesContent, "utf-8");
      console.log(`[generate-types] Successfully updated ${typesFilePath}.`);
    } catch (writeError: unknown) {
      const message =
        writeError instanceof Error ? writeError.message : String(writeError);
      console.error(`[generate-types] Error writing types file: ${message}`);
      process.exit(1);
    }

    // Вызываем проверку папки media после генерации типов
    await checkMediaForDuplicateBasenames();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[generate-types] An unexpected error occurred: ${message}`);
    process.exit(1);
  }
}

generateAndWriteTypes();
