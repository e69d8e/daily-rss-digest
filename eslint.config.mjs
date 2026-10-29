import nextPlugin from "eslint-config-next";

const eslintConfig = [
  ...nextPlugin,
  {
    rules: {
      // Next 16 的 eslint-config-next 引入了 React Compiler 时代的严格规则。
      // 存量代码大量使用 effect 内 setState 的数据加载惯用法、渲染期 ref 镜像等
      // 模式，全部重构超出当前范围；先降级为 warning，保持可见、不阻断 CI。
      // TODO: 后续按 React 官方指引重构后移除这些覆盖。
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".netlify/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
