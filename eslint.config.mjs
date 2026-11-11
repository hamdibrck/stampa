import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.expo/**',
      '**/dist/**',
      '**/coverage/**',
      'apps/mobile/ios/**',
      'apps/mobile/android/**',
      'apps/mobile/assets/data/**',
      'apps/mobile/expo-env.d.ts',
      'scripts/cities/.cache/**',
      'scripts/cities/out/**',
      'supabase/functions/**/index.ts',
      'stampa/**',
    ],
  },
  ...expoConfig,
  prettierConfig,
  {
    rules: {
      'import/no-unresolved': 'off',
      'import/no-named-as-default-member': 'off',
    },
  },
];
