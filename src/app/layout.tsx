import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { AppContent } from "@/types/types";
import { getContent } from "@/lib/fs-utils";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-roboto",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-roboto-mono",
});

export const metadata = {
  title: "Wolf Development",
  description:
    "Распрацоўка сучасных хуткiх вэб-праграмаў i сайтаў на Next.js (React)",
};

// Вспомогательная функция для преобразования camelCase в kebab-case
function toKebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

async function getStyleVariables(): Promise<string> {
  try {
    const content: AppContent = await getContent();
    const styles = content.styles; // Предполагаем, что styles имеет структуру { section1: { color1: "...", backgroundColor1: "..." }, ... }

    let cssVariables = ":root {\n";

    if (styles) {
      // Итерируемся по группам стилей (например, "section1", "section2")
      (Object.keys(styles) as Array<keyof typeof styles>).forEach(
        (groupName) => {
          const styleGroup = styles[groupName];

          if (styleGroup && typeof styleGroup === "object") {
            // Убедимся, что styleGroup - это объект
            // Итерируемся по свойствам внутри группы (например, "color1", "backgroundColor1")
            (Object.keys(styleGroup) as Array<keyof typeof styleGroup>).forEach(
              (propName) => {
                const propValue = styleGroup[propName];

                if (propValue && typeof propValue === "string") {
                  // Новое правило формирования имени переменной:
                  // propName (например, "color1") напрямую используется как часть имени
                  // или propName (например, "backgroundColor1") преобразуется в "background-color1"
                  const variableNamePart = toKebabCase(propName); // Преобразуем в kebab-case
                  const cssVarName = `--${variableNamePart}`; // Формируем имя --имя-ключа

                  cssVariables += `  ${cssVarName}: ${propValue};\n`;
                }
              }
            );
          }
        }
      );
    }

    cssVariables += "}\n";
    console.log("Generated CSS Variables:\n", cssVariables); 
    
    return cssVariables;
  } catch (error) {
    console.error("Failed to load styles for CSS variables:", error);
    return ":root {}";
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const styleVars = await getStyleVariables();

  return (
    <html lang="ru">
      <head>
        <style dangerouslySetInnerHTML={{ __html: styleVars }} />
      </head>
      <body className={`${roboto.variable} ${robotoMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
