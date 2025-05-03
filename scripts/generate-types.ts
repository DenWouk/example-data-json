// scripts/generate-types.ts
const fs = require("fs").promises; // Получаем промисы из fs
const path = require("path");

// --- Конфигурация ---
const contentFilePath = path.join(
  process.cwd(),
  "public",
  "content",
  "content.json"
);
const typesFilePath = path.join(process.cwd(), "src", "types", "types.ts");
const generatedInterfaceName = "AppContent"; // Имя генерируемого интерфейса
const startMarker = `// --- START OF GENERATED ${generatedInterfaceName} INTERFACE ---`;
const endMarker = `// --- END OF GENERATED ${generatedInterfaceName} INTERFACE ---`;
// ---

/**
 * Проверяет, является ли значение простым типом, который можно представить как строку.
 * Исключает объекты и массивы.
 */
function isSimpleValue(value: unknown): boolean {
  const type = typeof value;
  return (
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    value === null ||
    value === undefined
  );
}

/**
 * Генерирует строку с определением интерфейса TypeScript на основе объекта JSON.
 * @param jsonObject - Объект, прочитанный из content.json.
 * @returns Строка с кодом интерфейса TypeScript.
 */
function buildInterfaceString(jsonObject: Record<string, any>): string {
  let interfaceString = `/**\n * ВНИМАНИЕ: Этот интерфейс генерируется автоматически скриптом generate-types.ts\n * Он отражает ТОЧНУЮ структуру вашего файла public/content/content.json.\n * ВСЕ поля считаются обязательными строками.\n * Не редактируйте этот интерфейс вручную, он будет перезаписан.\n */\n`;
  interfaceString += `export interface ${generatedInterfaceName} {\n`;

  // Итерация по страницам (home, about, ...)
  for (const pageKey in jsonObject) {
    if (!Object.prototype.hasOwnProperty.call(jsonObject, pageKey)) continue;
    const pageData = jsonObject[pageKey];
    if (typeof pageData !== "object" || pageData === null) {
      console.warn(
        `[generate-types] Warning: Page '${pageKey}' in content.json is not an object. Skipping.`
      );
      continue;
    }

    // Добавляем ключ страницы
    interfaceString += `  ${JSON.stringify(pageKey)}: {\n`; // JSON.stringify для экранирования ключа, если нужно

    // Итерация по секциям (section1, section2, ...)
    for (const sectionKey in pageData) {
      if (!Object.prototype.hasOwnProperty.call(pageData, sectionKey)) continue;
      const sectionData = pageData[sectionKey];
      if (typeof sectionData !== "object" || sectionData === null) {
        console.warn(
          `[generate-types] Warning: Section '${pageKey}.${sectionKey}' in content.json is not an object. Skipping.`
        );
        continue;
      }

      // Добавляем ключ секции
      interfaceString += `    ${JSON.stringify(sectionKey)}: {\n`;

      // Итерация по полям (title, description1, image1, ...)
      for (const fieldKey in sectionData) {
        if (!Object.prototype.hasOwnProperty.call(sectionData, fieldKey))
          continue;
        const fieldValue = sectionData[fieldKey];

        // Проверка: Убедимся, что значение поля не объект/массив (как договоренность)
        if (!isSimpleValue(fieldValue)) {
          console.warn(
            `[generate-types] Warning: Field '${pageKey}.${sectionKey}.${fieldKey}' has a complex value (object/array). Assuming 'string' type, but check your content.json.`
          );
        }

        // Добавляем ключ поля с типом string (обязательное поле)
        interfaceString += `      ${JSON.stringify(fieldKey)}: string;\n`;
      }
      interfaceString += `    };\n`; // Закрываем объект секции
    }
    interfaceString += `  };\n`; // Закрываем объект страницы
  }
  interfaceString += `}\n`; // Закрываем главный интерфейс

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
    // 1. Читаем content.json
    let contentJsonString: string;
    try {
      contentJsonString = await fs.readFile(contentFilePath, "utf-8");
    } catch (readError: any) {
      console.error(
        `[generate-types] Error reading content file at ${contentFilePath}: ${readError.message}`
      );
      process.exit(1); // Выход с ошибкой
    }

    // 2. Парсим JSON
    let contentObject: Record<string, any>;
    try {
      contentObject = JSON.parse(contentJsonString);
      if (
        typeof contentObject !== "object" ||
        contentObject === null ||
        Array.isArray(contentObject)
      ) {
        throw new Error(
          "Content file does not contain a valid JSON object at the root."
        );
      }
    } catch (parseError: any) {
      console.error(
        `[generate-types] Error parsing JSON from ${contentFilePath}: ${parseError.message}`
      );
      process.exit(1); // Выход с ошибкой
    }

    // 3. Строим строку нового интерфейса
    const newInterfaceContent = buildInterfaceString(contentObject);

    // 4. Читаем существующий файл types.ts
    let existingTypesContent = "";
    try {
      existingTypesContent = await fs.readFile(typesFilePath, "utf-8");
    } catch (readTypesError: any) {
      if (readTypesError.code !== "ENOENT") {
        // Игнорируем, если файла просто нет
        console.error(
          `[generate-types] Error reading types file at ${typesFilePath}: ${readTypesError.message}`
        );
        process.exit(1);
      }
      console.log(
        `[generate-types] Types file ${typesFilePath} not found. Creating a new one.`
      );
    }

    // 5. Ищем маркеры и обновляем или добавляем контент
    const startIndex = existingTypesContent.indexOf(startMarker);
    const endIndex = existingTypesContent.indexOf(endMarker);

    let finalTypesContent: string;

    const wrappedNewContent = `${startMarker}\n${newInterfaceContent}${endMarker}`;

    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
      // Маркеры найдены, заменяем содержимое между ними
      console.log(
        `[generate-types] Found existing generated interface. Replacing...`
      );
      const before = existingTypesContent.substring(0, startIndex);
      const after = existingTypesContent.substring(endIndex + endMarker.length);
      finalTypesContent = `${before}${wrappedNewContent}${after}`;
    } else {
      // Маркеры не найдены или некорректны, добавляем в конец
      console.log(
        `[generate-types] No existing generated interface found or markers invalid. Appending...`
      );
      // Добавляем пару пустых строк перед новым блоком для разделения
      finalTypesContent =
        existingTypesContent.trim() + `\n\n${wrappedNewContent}\n`;
    }

    // 6. Записываем обновленный файл types.ts
    try {
      await fs.writeFile(typesFilePath, finalTypesContent, "utf-8");
      console.log(
        `[generate-types] Successfully updated ${typesFilePath} with interface ${generatedInterfaceName}.`
      );
    } catch (writeError: any) {
      console.error(
        `[generate-types] Error writing updated types file to ${typesFilePath}: ${writeError.message}`
      );
      process.exit(1);
    }
  } catch (error: any) {
    // Общая обработка непредвиденных ошибок
    console.error(
      `[generate-types] An unexpected error occurred: ${error.message}`
    );
    process.exit(1);
  }
}

// Запускаем генерацию
generateAndWriteTypes();
