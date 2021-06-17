# Building from source

SUMARiS Angular Components used Ionic Framework and Angular.

This article will explain how to install your environment, then build the library.

## Installation tools, and get sources

1. Install [NVM](https://github.com/nvm-sh/nvm)

2. Install Node (v12) ex: 12.19.1
```bash
nvm install 12.19.1
```

3. Install global dependency: 
```bash
npm install -g @ionic/cli @angular/cli
```

4. Get sources (clone the repo) : `git clone ...`

### Development and test

1. Install project's dependencies:
```bash
cd ngx-sumaris-components
npm install
```

2. Check environment configuration:

   - Edit the file `src/environment/environment.ts`
   
3. Start the app
    ```bash
    cd ngx-sumaris-components
    npm start
    ```
   By default, the app should be accessible at [http://localhost:4200](http://localhost:4200)
   
   To change the default port, use this command instead:
    
    ```bash
    cd ngx-sumaris-components
    ng serve --port [port]
    ```

The application should be accessible at [localhost:4200](http://localhost:4200)

### Publish new release

1. Create the release:
    ```bash
    npm run packagr
    ```

2. Publish the release:
    ```bash
    npm run publish
    ```
