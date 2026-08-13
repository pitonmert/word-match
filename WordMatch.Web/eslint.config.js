import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import babelParser from "@babel/eslint-parser";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          presets: ["@babel/preset-react", "@babel/preset-typescript"],
        },
      },
    },
    plugins: {
      "better-tailwindcss": betterTailwindcss,
    },
    settings: {
      "better-tailwindcss": {
        detectComponentClasses: true,
        entryPoint: "./src/main.css",
      },
    },
    rules: {
      "better-tailwindcss/enforce-canonical-classes": "error",
      "better-tailwindcss/no-unknown-classes": "error",
      "better-tailwindcss/no-concatenated-classes": "error",
      "better-tailwindcss/no-conflicting-classes": "error",
      "better-tailwindcss/no-duplicate-classes": "error",
    },
  },
];
