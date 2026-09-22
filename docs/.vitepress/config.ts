import { defineConfig } from 'vitepress';
import { documentationNavigation } from './navigation.ts';

const repository = 'https://github.com/Thefirstmannnn/tack';

export default defineConfig({
  lang: 'en-US',
  title: 'Tack documentation',
  description: 'Documentation for the free, realtime, keyboard-first task manager.',
  base: '/tack/',
  lastUpdated: true,
  srcExclude: ['superpowers/**'],
  rewrites: {
    'README.md': 'index.md',
  },
  ignoreDeadLinks: [/^http:\/\/localhost:/],
  themeConfig: {
    siteTitle: 'Tack',
    nav: [
      { text: 'Product', link: 'https://YOUR_DOMAIN' },
      { text: 'GitHub', link: repository },
    ],
    sidebar: [
      {
        text: 'Documentation',
        items: documentationNavigation(),
      },
    ],
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    search: {
      provider: 'local',
    },
    socialLinks: [{ icon: 'github', link: repository }],
    editLink: {
      pattern: `${repository}/edit/main/docs/:path`,
      text: 'Edit this page on GitHub',
    },
    docFooter: {
      prev: 'Previous',
      next: 'Next',
    },
    footer: {
      message: 'Released under the Apache 2.0 License.',
      copyright: 'Copyright © mbhatt',
    },
  },
});
