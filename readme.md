# Template for new Svelte Modules

```
# degit if you dont have it
npm install -g degit


# new module directory
npx degit https://github.com/ladislavkafka/svelte-module-template modulename
or
# current directory
npx degit https://github.com/ladislavkafka/svelte-module-template . --force

cd modulename
npm install
npm run dev
```

## How to prepare module for export
1. set module name and module description:
   file:_package.json_
   ```
   "name": "YOUR-MODULE-NAME",
   "description": "MODULE DESCRIPTION",
   ```
   e.g.
      ```
   "name": "my-nice-module",
   "description": "Very nice module",
   ```
   Choose the name wisely, later you will import from this module using the name as:
```
    import {Component} from "my-nice-module"
```
   
2. export all public components, 
   file: _src/index.js_
   ```   
   import Component from '@src/Components/Component.svelte'
   export { Component }
   ```

3. Publish the module to github
   or import locally
```
npm install C:\localmodules\svelte-module-template
npm install /home/superhero/svelte-localmodules/svelte-module-template
```

## GIT
```
git commit -a -m updated
git push
```
https://forum.tutorials7.com/2608/how-to-set-up-git-and-github-with-phpstorm

## npm update ALL outdated modules
```
npm i -g npm-check-updates
ncu -u
npm install
```

## npm hints
```
# list outdated modules
npm outdated
```