// scripts/generate-types.ts
const fs = require("fs").promises; // Используем require для Node.js скрипта
const path = require("path");

// --- Конфигурация ---
const contentFilePath = path.join(
  process.cwd(),
  "public",
  "content",
  "content.json"
);
const typesFilePath = path.join(process.cwd(), "src", "types", "types.ts");
const generatedInterfaceName = "AppContent";
const startMarker = `// --- START OF GENERATED ${generatedInterfaceName} INTERFACE ---`;
const endMarker = `// --- END OF GENERATED ${generatedInterfaceName} INTERFACE ---`;
// ---

// Вспомогательные типы для представления JSON-подобных структур
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
interface JsonObject {
  [key: string]: JsonValue;
}
interface JsonArray extends Array<JsonValue> {}

/**
 * Проверяет, является ли значение простым типом, который можно представить как строку.
 * Исключает объекты и массивы.
 */
function isSimpleValue(value: JsonValue): boolean {
  // Изменили тип value
  const type = typeof value;
  return (
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    value === null // undefined не является валидным JSON значением, но может прийти от кривого парсера
  );
}

/**
 * Генерирует строку с определением интерфейса TypeScript на основе объекта JSON.
 * @param jsonObject - Объект, прочитанный из content.json (ожидается структура AppContent).
 * @returns Строка с кодом интерфейса TypeScript.
 */
function buildInterfaceString(jsonObject: JsonObject): string {
  // Изменили тип jsonObject
  let interfaceString = `/**\n * ВНИМАНИЕ: Этот интерфейс генерируется автоматически скриптом generate-types.ts\n * Он отражает ТОЧНУЮ структуру вашего файла public/content/content.json.\n * ВСЕ поля считаются обязательными строками.\n * Не редактируйте этот интерфейс вручную, он будет перезаписан.\n */\n`;
  interfaceString += `export interface ${generatedInterfaceName} {\n`;

  for (const pageKey in jsonObject) {
    if (!Object.prototype.hasOwnProperty.call(jsonObject, pageKey)) continue;
    const pageData = jsonObject[pageKey];

    // Проверяем, что pageData является объектом
    if (
      typeof pageData !== "object" ||
      pageData === null ||
      Array.isArray(pageData)
    ) {
      console.warn(
        `[generate-types] Warning: Page '${pageKey}' in content.json is not an object. Skipping.`
      );
      continue;
    }
    // Теперь pageData можно безопасно считать JsonObject
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
          `[generate-types] Warning: Section '${pageKey}.${sectionKey}' in content.json is not an object. Skipping.`
        );
        continue;
      }
      const sectionDataObject = sectionData as JsonObject;

      interfaceString += `    ${JSON.stringify(sectionKey)}: {\n`;

      for (const fieldKey in sectionDataObject) {
        if (!Object.prototype.hasOwnProperty.call(sectionDataObject, fieldKey))
          continue;
        const fieldValue = sectionDataObject[fieldKey]; // fieldValue теперь типа JsonValue

        if (!isSimpleValue(fieldValue)) {
          console.warn(
            `[generate-types] Warning: Field '${pageKey}.${sectionKey}.${fieldKey}' has a complex value (object/array). Assuming 'string' type, but check your content.json.`
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
 * Главная функция для генерации и обновления файла типов.
 */
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
      // Типизируем ошибку как unknown
      const message =
        readError instanceof Error ? readError.message : String(readError);
      console.error(
        `[generate-types] Error reading content file at ${contentFilePath}: ${message}`
      );
      process.exit(1);
    }

    let contentObject: JsonObject; // Ожидаем JsonObject после парсинга
    try {
      const parsedJson: unknown = JSON.parse(contentJsonString); // Сначала парсим в unknown
      if (
        typeof parsedJson !== "object" ||
        parsedJson === null ||
        Array.isArray(parsedJson)
      ) {
        throw new Error(
          "Content file does not contain a valid JSON object at the root."
        );
      }
      contentObject = parsedJson as JsonObject; // Приводим к JsonObject после проверки
    } catch (parseError: unknown) {
      // Типизируем ошибку как unknown
      const message =
        parseError instanceof Error ? parseError.message : String(parseError);
      console.error(
        `[generate-types] Error parsing JSON from ${contentFilePath}: ${message}`
      );
      process.exit(1);
    }

    const newInterfaceContent = buildInterfaceString(contentObject);

    let existingTypesContent = "";
    try {
      existingTypesContent = await fs.readFile(typesFilePath, "utf-8");
    } catch (readTypesError: unknown) {
      // Типизируем ошибку как unknown
      // Проверяем код ошибки, если это объект ошибки Node.js
      if (
        readTypesError &&
        typeof readTypesError === "object" &&
        "code" in readTypesError &&
        (readTypesError as { code: string }).code !== "ENOENT"
      ) {
        const message =
          readTypesError instanceof Error
            ? readTypesError.message
            : String(readTypesError);
        console.error(
          `[generate-types] Error reading types file at ${typesFilePath}: ${message}`
        );
        process.exit(1);
      }
      // Если ENOENT или ошибка не объектного типа (маловероятно для fs.readFile)
      if (
        !(
          readTypesError &&
          typeof readTypesError === "object" &&
          "code" in readTypesError &&
          (readTypesError as { code: string }).code === "ENOENT"
        )
      ) {
        console.log(
          `[generate-types] Types file ${typesFilePath} not found or unreadable. Creating a new one.`
        );
      } else {
        console.log(
          `[generate-types] Types file ${typesFilePath} not found. Creating a new one.`
        );
      }
    }

    const startIndex = existingTypesContent.indexOf(startMarker);
    const endIndex = existingTypesContent.indexOf(endMarker);
    let finalTypesContent: string;
    const wrappedNewContent = `${startMarker}\n${newInterfaceContent}${endMarker}`;

    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
      console.log(
        `[generate-types] Found existing generated interface. Replacing...`
      );
      const before = existingTypesContent.substring(0, startIndex);
      const after = existingTypesContent.substring(endIndex + endMarker.length);
      finalTypesContent = `${before}${wrappedNewContent}${after}`;
    } else {
      console.log(
        `[generate-types] No existing generated interface found or markers invalid. Appending...`
      );
      finalTypesContent =
        existingTypesContent.trim() + `\n\n${wrappedNewContent}\n`;
    }

    try {
      await fs.writeFile(typesFilePath, finalTypesContent, "utf-8");
      console.log(
        `[generate-types] Successfully updated ${typesFilePath} with interface ${generatedInterfaceName}.`
      );
    } catch (writeError: unknown) {
      // Типизируем ошибку как unknown
      const message =
        writeError instanceof Error ? writeError.message : String(writeError);
      console.error(
        `[generate-types] Error writing updated types file to ${typesFilePath}: ${message}`
      );
      process.exit(1);
    }
  } catch (error: unknown) {
    // Типизируем ошибку как unknown
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[generate-types] An unexpected error occurred: ${message}`);
    process.exit(1);
  }
}

generateAndWriteTypes();
