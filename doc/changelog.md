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

## 0.4.1

- [enh] Add new component 'app-actions-columns'

## 0.4.2

- [enh] LoadResult class: Add a `fetchMore()` function
- [enh] Autocomplete field: Add infinite scroll, using `LoadResult.fetchMore()`

## 0.4.3

- [enh] AppTable: add `options` (with property `interactive`) in `deleteRow()` and `deleteRows()`
  Used to avoid user confirmation, when deletion has been confirmed elsewhere

## 0.4.4

- [enh] Rename `<form-buttons-bar>` into `<app-form-buttons-bar>`
- [enh] Export more CSS variables: `--app-paginator-height`, `app-form-buttons-bar-height`

## 0.5.0

- [enh] Table: allow keyboard navigation, using `<app-actions-column>` and function `table.confirmAndBackward()` and `table.confirmAndForward()`

## 0.7.10

- [enh] Table: no more border-left, on dirty rows (because of sticky columns nightmare !)
