export interface AppContent {
  home: Home;
  about: About;
}

interface About {
  title: string;
  description: string;
  image: null;
}

interface Home {
  title: string;
  description: string;
  image: string | null;
}
