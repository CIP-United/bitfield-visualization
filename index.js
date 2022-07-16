'use strict'

{
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

  if (localStorage.getItem('bitfield-structs-saved') === null) {
    localStorage.setItem(
      'bitfield-structs-saved', JSON.stringify(bitfieldPreload))
    localStorage.setItem('bitfield-float', '1')
  }

  /**
   * @param {Event} event
   * @returns {boolean}
   */
  function main (event = undefined) {
    if ([typeof bitfield].includes('undefined')) {
      return false
    }
    if (event) {
      Array.prototype.forEach.call(
        document.querySelectorAll('script'),
        script => script.removeEventListener('load', main))
    }

    Array.prototype.forEach.call(
      document.querySelectorAll('.bitfield'), x => bitfield(x))
      //x => bitfield(x, {preload: bitfieldPreload}))
    return true
  }

  if (!main()) {
    Array.prototype.forEach.call(
      document.querySelectorAll('script'),
      script => script.addEventListener('load', main))
  }
}
