import type { PrdConfig } from './prd-kit/types';

export default {
  requirement: 'requirements/product',
  docs: [
    { id: 'prd', title: 'PRD', file: 'prd.md', annotations: true },
    { id: 'dev', title: 'Dev Spec', file: 'dev-spec.md' },
  ],
  appEntry: '/projects',
  srcDir: 'src',
} satisfies PrdConfig;
