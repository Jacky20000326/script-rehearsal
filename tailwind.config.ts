import type { Config } from "tailwindcss";

// Tailwind CSS 4 的 runtime 並不會讀這個檔案（v4 改由 PostCSS plugin + @theme CSS 設定處理）。
// 保留此檔僅為了讓 IDE / 編輯器外掛能正確辨識專案內容路徑做 class 智慧提示。
// 若未來移除此檔，runtime 行為不受影響；但 IDE 自動完成可能會失效。
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
};

export default config;
