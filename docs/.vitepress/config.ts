import { defineConfig } from "vitepress";
import typedocSidebar from "../api/typedoc-sidebar.json";
import guidesSidebar from "../guides/guides-sidebar.json";

export default defineConfig({
  title: "CloudFireAuth Docs",
  base: "/cloudfire-auth/",
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
  head: [
    [
      "script",
      {
        defer: true,
        src: "https://static.cloudflareinsights.com/beacon.min.js",
        "data-cf-beacon": '{"token": "c150212cb83e4a88a4f49b520bdcbfd7"}',
      },
    ],
  ],
});
