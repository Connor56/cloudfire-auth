import { defineConfig } from "vitepress";
import typedocSidebar from "../api/typedoc-sidebar.json";
import guidesSidebar from "../guides/guides-sidebar.json";

export default defineConfig({
  title: "CloudFireAuth Docs",
  themeConfig: {
    sidebar: [
      { text: "Intro", link: "/" },
      { text: "Guides", link: "/guides", items: guidesSidebar },
      {
        text: "API",
        items: typedocSidebar,
      },
    ],
    search: {
      provider: "local",
    },
  },
});
