export interface ContentSection {
    title?: string;
    description?: string;
  }
  
  export interface ContentData {
    home?: ContentSection;
    about?: ContentSection;
    contact?: ContentSection;
    [key: string]: ContentSection | undefined; // Позволяет добавлять другие секции
  }