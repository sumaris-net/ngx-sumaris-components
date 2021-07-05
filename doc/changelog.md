# Change log

## 0.1.7

- [enh] Menu: Allow dynamic insertion, using a new config options (see 'CORE_CONFIG_OPTIONS.MENU_ITEMS')
  * Example: 
  ```js
    const options = [
      // Insert before'MENU.HOME'
      {title: "Item #1", path: "/settings", icon: "people", before: "MENU.HOME"},
  
      // Insert after 'MENU.HOME'
      {title: "Item #2", path: "/settings", icon: "people", after: "MENU.HOME"}
    ];
    config.properties[CORE_CONFIG_OPTIONS.MENU_ITEMS.key] = JSON.stringify(items); 
  ```
  Values of 'after' and 'before' will be compared with `title` of existing items.

## 0.3.3

- [enh] CSS `.filter-panel` should be used with `.filter-panel-floating` to enable floating position

## 0.3.4

- [fix] Users table: use floating filter panel

## 0.3.5

- [enh] Add new pipe `arrayFilter` to be able to filter an array, in HTML templates
