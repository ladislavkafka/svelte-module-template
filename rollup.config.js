import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import sveltePreprocess from 'svelte-preprocess';
import typescript from '@rollup/plugin-typescript';
import css from 'rollup-plugin-css-only';
import alias from '@rollup/plugin-alias';
import path from 'path'

const production = !process.env.ROLLUP_WATCH;
const projectRootDir = path.resolve(__dirname);

function serve() {
  let server;

  function toExit() {
    if (server) server.kill(0);
  }

  return {
    writeBundle() {
      if (server) return;
      server = require('child_process').spawn('npm', [
        'run',
        'start', '--',
        '--dev',
        '--port=5000',
      ], {
        stdio: ['ignore', 'inherit', 'inherit'],
        shell: true
      });

      process.on('SIGTERM', toExit);
      process.on('exit', toExit);
    }
  };
}

export default {
  input: 'src/main.ts',
  output: {
    sourcemap: !production,
    format: 'iife', //  iife | es(for async import)
    name: 'app',
    file: 'public/build/bundle.js'
  },
  plugins: [
    svelte({
      preprocess: [
        // https://github.com/ls-age/svelte-preprocess-less
        sveltePreprocess({ sourceMap: !production })
      ],


      compilerOptions: {
        // enable run-time checks when not in production
        dev: !production
      }
    }),
    alias({
      entries: [
        {
          find: '@src',
          replacement: path.resolve(projectRootDir, 'src')
        }
      ]
    }),
    css({ output: 'bundle.css' }),
    resolve({
      browser: true,
      dedupe: ['svelte']
    }),
    commonjs(),
    typescript({
        sourceMap: !production,
        inlineSources: !production
    }),

    // In dev mode, call `npm run start` once
    // the bundle has been generated
    !production && serve(),
    // Watch the `public` directory and refresh the
    // browser on changes when not in production
    !production && livereload('public'),
    // If we're building for production (npm run build
    // instead of npm run dev), minify
    production && terser()
  ],
  watch: {
    clearScreen: false
  }
};
