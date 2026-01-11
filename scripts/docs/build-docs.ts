import { execSync } from "node:child_process";
import fs from "node:fs";

/**
 * Builds the documentation for the project. Does so via the following steps:
 *
 * 1. Run the typedoc command to generate the API documentation.
 * 2. Fix the incorrect typedoc-sidebar.json to remove the /doc prefix from the paths.
 * 3. Separate the massive CloudFireAuth class into smaller method level markdown files
 * 4. Save each file as it's own page under api/methods.
 * 5. Update the sidebar.json to include links to these new pages.
 * 6. Build the documentation using vitepress.
 *
 * This function works entirely by side effects.
 */
function buildDocs() {
  execSync("npx typedoc");

  const typedocSidebar = loadAndFixTypedocSidebar();
  const methodSidebarItems = extractAndSaveMethods();
  const updatedSidebar = appendMethodsToSidebar(typedocSidebar, methodSidebarItems);

  saveTypedocSidebar(updatedSidebar);

  addMethodsIndexPage();

  execSync("npx vitepress build docs");
}

/**
 * Loads the typedoc sidebar JSON file and removes the /docs prefix from all paths.
 * @returns The parsed sidebar JSON with fixed paths.
 */
function loadAndFixTypedocSidebar(): any[] {
  const typedocSidebar = fs.readFileSync("docs/api/typedoc-sidebar.json", "utf8");
  const fixedTypedocSidebar = typedocSidebar.replaceAll("/docs/", "/");
  return JSON.parse(fixedTypedocSidebar);
}

/**
 * Extracts methods from the CloudFireAuth class, saves them as individual files,
 * and returns sidebar items for each method.
 * @returns Array of sidebar items for the extracted methods.
 */
function extractAndSaveMethods(): any[] {
  const methodContent = splitCloudFireAuthClass();
  const extractedMethods = extractIndividualMethods(methodContent);
  ensureMethodsDirectoryExists();

  const methodSidebarItems: any[] = [];

  for (const method of extractedMethods) {
    const methodName = extractMethodName(method);

    if (methodName) {
      const fileName = methodNameToFileName(methodName);
      const tidiedMethodContent = tidyMethodContent(method);

      fs.writeFileSync(`docs/api/methods/${fileName}`, tidiedMethodContent);

      methodSidebarItems.push({
        text: methodName,
        link: `/api/methods/${fileName}`,
      });
    }
  }

  return methodSidebarItems;
}

/**
 * Splits the CloudFireAuth class markdown into constructor and methods sections.
 * Updates the class file to contain only the constructor and returns the methods content.
 * @returns The methods content extracted from the class file.
 */
function splitCloudFireAuthClass(): string {
  const cloudfireAuthContent = fs.readFileSync("docs/api/classes/CloudFireAuth.md", "utf8");
  const splitContent = cloudfireAuthContent.split("\n## ");

  const constructorContent = splitContent[0] + "\n## " + splitContent[1];
  fs.writeFileSync("docs/api/classes/CloudFireAuth.md", constructorContent);

  return splitContent.slice(2).join("\n## ");
}

/**
 * Extracts individual method content from the combined methods markdown.
 * Methods are separated by section headers (##) or category separators (***).
 * @param methodContent The combined methods markdown content.
 * @returns Array of individual method content strings.
 */
function extractIndividualMethods(methodContent: string): string[] {
  const methodContentSplit = methodContent.split("\n");
  let methodIdx = 0;
  let extractedMethods: string[] = [];

  for (const line of methodContentSplit.slice(1)) {
    if (line.startsWith("## ") || line == "***") {
      methodIdx++;
      continue;
    }

    let methodString = extractedMethods[methodIdx] || "";
    methodString += line + "\n";
    extractedMethods[methodIdx] = methodString;
  }

  return extractedMethods;
}

/**
 * Extracts method name from markdown content using the method header pattern.
 * @param methodContent The method markdown content.
 * @returns The method name if found, null otherwise.
 */
function extractMethodName(methodContent: string): string | null {
  const regex = /### (.*)/;
  const match = methodContent.match(regex);
  return match ? match[1] : null;
}

/**
 * Converts a method name to a valid markdown filename.
 * @param methodName The method name to convert.
 * @returns The filename with .md extension.
 */
function methodNameToFileName(methodName: string): string {
  return methodName.replaceAll(" ", "-").replaceAll("()", "") + ".md";
}

/**
 * Ensures the methods directory exists, creating it if necessary.
 */
function ensureMethodsDirectoryExists(): void {
  if (!fs.existsSync("docs/api/methods")) {
    fs.mkdirSync("docs/api/methods");
  }
}

/**
 * Tidy the method content by converting the headers to the correct level and
 * trimming whitespace from the beginning and end of the content.
 * @param methodContent The method content to tidy.
 * @returns The tidied method content.
 */
function tidyMethodContent(methodContent: string): string {
  methodContent = methodContent
    .replaceAll("### ", "# ")
    .replaceAll("#### ", "## ")
    .replaceAll("##### ", "### ")
    .replaceAll("###### ", "#### ");

  return methodContent.trim();
}

/**
 * Appends the methods section to the typedoc sidebar.
 * @param sidebar The existing sidebar JSON array.
 * @param methodSidebarItems The sidebar items for individual methods.
 * @returns The updated sidebar with methods section appended.
 */
function appendMethodsToSidebar(sidebar: any[], methodSidebarItems: any[]): any[] {
  sidebar.push({
    text: "Methods",
    link: "/api/methods/",
    collapsed: true,
    items: methodSidebarItems,
  });
  return sidebar;
}

/**
 * Orders the typedoc sidebar alphabetically and saves it to file in a
 * reformatted prettified state.
 * @param sidebar The sidebar JSON array to save.
 */
function saveTypedocSidebar(sidebar: any[]): void {
  sidebar.sort((a: any, b: any) => {
    return a.text.localeCompare(b.text);
  });

  fs.writeFileSync("docs/api/typedoc-sidebar.json", JSON.stringify(sidebar, null, 2));
}

/**
 * Adds a basic index page to the methods directory.
 */
function addMethodsIndexPage(): void {
  fs.writeFileSync(
    "docs/api/methods/index.md",
    "# Methods\n\nThis secton of the API contains all the methods available in the CloudFireAuth class."
  );
}

buildDocs();
