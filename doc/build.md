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
npm install -g @ionic/cli cordova cordova-res native-run 
```

4. Get sources (clone the repo) : `git clone ...`

### Install additional tools (optional)
```bash
sudo apt-get install chromium-browser docker.io
```

## Web build

### For development and test

1. Install project's dependencies:
```bash
cd ngx-components
npm install
```
OR, alternatively: 
```bash
cd ngx-components/scripts
./env-global.sh
```

2. Check environment configuration:

   - Edit the file `src/environment/environment.ts`
   
3. Start the app
    ```bash
    cd ngx-components
    npm start
    ```
   By default, the app should be accessible at [http://localhost:4200](http://localhost:4200)
   
   To change the default port, use this command instead:
    
    ```bash
    cd ngx-components
    ng serve --port [port]
    ```

The application should be accessible at [localhost:4200](http://localhost:4200)

### Web build for production

1. Check environment configuration:

   - Edit the file `src/environment/environment-prod.ts`

2. Create the release:
    ```bash
    npm run build --prod --release
    ```

## Android build 

### Build a debug APK, for development and test

1. Install the android build environment:
    ```bash
    cd ngx-components/scripts
    ./env-android.sh
    ```

2. Create a debug APK file:
    ```bash
    cd ngx-components/scripts
    ./build-android.sh
    ```

### Build a release APK, for production

1. Check environment configuration:

   - Edit the file `src/environment/environment-prod.ts`

2. Create a release APK file:
    ```bash
    cd ngx-components/scripts
    ./release-android.sh
    ```

## Useful links

- Signing Android APK: See doc at 
   https://www.c-sharpcorner.com/article/create-ionic-4-release-build-for-android/

## Troubleshooting

### Error on datasource, or angular material table

- Checkout the project https://github.com/e-is/angular4-material-table
```bash
git clone https://github.com/e-is/ngx-material-table.git
cd ngx-material-table
```
- Build the project: 
```bash
npm install
npm run build
cp package*.json ./dist
```
- Link to your local NPM repo:
```bash
cd dist
npm link 
```
- Use it from SAR App project:
```bash
cd <sar_app_root>
npm link ngx-material-table
```
