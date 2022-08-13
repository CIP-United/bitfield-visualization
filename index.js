'use strict'

;(function (id, dependencies, factory) {
  if (typeof define === 'function') {
    define(id, dependencies, factory)
  } else {
    (((globalThis.require ??= {}).options ??= {}).defers ??= []).push(
      [id, dependencies, factory])
  }
})(['bitfield'], function (Bitfield) {
  const bitfieldPreload = [
    [
      "IEEE754 single-precision",
      "enum Exponent {\n  EXPONENT_SUBNORMAL\n  EXPONENT_SPECIAL = 0xff\n}\n\nsign:1:lightblue\nexponent:8:lightgreen:Exponent\nfraction:23:lightpink"
    ],
    [
      "IEEE754 double-precision",
      "enum Exponent {\n  EXPONENT_SUBNORMAL\n  EXPONENT_SPECIAL = 0xff\n}\n\nsign:1:lightblue\nexponent:11:lightgreen:Exponent\nfraction:52:lightpink"
    ],
  ]

  if (localStorage.getItem('bitfield::structs') === null) {
    localStorage.setItem(
      'bitfield::structs', JSON.stringify(bitfieldPreload))
    localStorage.setItem('bitfield::float', '1')
  }

  function main () {
    document.removeEventListener('DOMContentLoaded', main)

    const bitfield = new Bitfield(document.body)

    const manual = document.querySelector('manual-viewer')
    manual.addEventListener('choose', event => {
      /** @type {string[]} */
      const fields = []
      /** @type {NodeListOf<Element>} */
      const fieldObjs = event.detail.children
      for (let i = 0; i < fieldObjs.length; i++) {
        const fieldObj = fieldObjs[i]
        if (fieldObj.localName !== 'field-definition') {
          continue
        }
        fields.push(
          (fieldObj.querySelector(':scope > name')?.textContent?.trim() ||
           '') + ':' +
          (fieldObj.querySelector(':scope > width')?.textContent?.trim() ||
           ''))
      }
      bitfield.format = fields.join('\n')
      bitfield.viewer.scrollIntoView()
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main)
  } else {
    main()
  }
})


{
  /**
   * @param {HTMLInputElement} input
   * @param {string} storageKeyName
   * @param {string} className
   */
  function setupDarkMode (input, storageKeyName, className) {
    input.addEventListener('change', function (event) {
      if (event.target.checked) {
        localStorage.setItem(storageKeyName, '1')
      } else {
        localStorage.removeItem(storageKeyName)
      }
      document.body.classList.toggle(className)
    })

    if (localStorage.getItem(storageKeyName)) {
      input.checked = true
      document.body.classList.add(className)
    }
  }

  function main () {
    document.removeEventListener('DOMContentLoaded', main)

    const input = document.querySelector('input[name="theme"][value="dark"]')
    if (input !== null) {
      setupDarkMode(input, 'bitfield::dark', 'dark-mode')
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main)
  } else {
    main()
  }
}
