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

## 0.4.0

- [enh] CSS: change style of error row (use warning color)
- [enh] CSS: new class '.visible-dirty' (e.g. `<ion-icon name="star" class="visible-dirty"></ion-icon>` in the `actions` column)
- [enh] ValidatorService: add function getI18nErrors(control)
- [enh] AppTable: add outputs 'onDirty', 'onError'
- [enh] AppTable: 
