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
