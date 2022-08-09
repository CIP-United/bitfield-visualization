'use strict'

{
  /********** utilities **********/

  /**
   * @param {Blob} blob
   * @returns {Promise<FileReader>}
   */
  function readFile (blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = function (event) {
        resolve(event.target)
      }
      reader.onerror = reject
      reader.readAsText(blob)
    })
  }


  /**
   * @param {HTMLInputElement} input
   * @returns {Promise<FileReader>?}
   */
  function readInputFile (input) {
    return !input.files || input.files.length === 0 ?
      null : readFile(input.files[0])
  }


  /**
   * Bind 'change' callback to radio buttons and set initial value.
   * @param {NodeListOf<HTMLInputElement>} radios Radio buttons.
   * @param {(this: HTMLInputElement, event: Event) => any} callback
   *  Callback for 'change' event.
   * @param {string} initialValue Initial value to select.
   */
  function initRadioInputs (radios, callback, initialValue = undefined) {
    for (let i = 0; i < radios.length; i++) {
      const radio = radios[i]
      radio.addEventListener('change', callback)
      if (radio.value === initialValue) {
        radio.checked = true
      }
    }
  }


  /********** value **********/

  /**
   * Convert a string to a bigint, based on its prefix.
   * @param {string} str The string to be parsed.
   * @param {number} radix
   *  The default base to parse the string as, if no prefix found.
   * @returns {bigint} Parsed value.
   * @throws {RangeError} If `radix` is not 2, 8, 10, or 16.
   * @throws {SyntaxError} If `str` is not a valid number.
   */
  function parseValue (str, radix = 10) {
    const negative = str[0] === '-'
    let numStr = negative ? str.slice(1) : str

    if (numStr[0] === '0') {
      // str has a prefix
      if (numStr.length > 1 && '0' <= numStr[1] && numStr[1] <= '9') {
        numStr = numStr.slice(1)
        numStr = '0o' + numStr
      }
    } else {
      switch (radix) {
        case 2:
          numStr = '0b' + numStr
          break
        case 8:
          numStr = '0o' + numStr
          break
        case 10:
          break
        case 16:
          numStr = '0x' + numStr
          break
        default:
          throw new RangeError('radix must be 2, 8, 10, 16')
      }
    }

    return negative ? -BigInt(numStr) : BigInt(numStr)
  }

  /**
   * Return the string representation of the value with appropriate prefix.
   * @param {bigint} value The value.
   * @param {number} radix The base to be used, affecting the prefix.
   * @returns {string} A string representing this value.
   * @throws {RangeError} If `radix` is not 2, 8, 10, or 16.
   */
  function valueToString (value, radix = 10) {
    let str = (value < 0n ? -value : value).toString(radix)
    switch (radix) {
      case 2:
        str = '0b' + str
        break
      case 8:
        str = '0' + str
        break
      case 10:
        break
      case 16:
        str = '0x' + str
        break
      default:
        throw new RangeError('radix must be 2, 8, 10 or 16')
    }
    return value < 0n ? '-' + str : str
  }


  /********** format **********/

  /**
   * Represent a lexer token.
   */
   class Token {
    static EOF = 0
    static IDENTIFIER = 1
    static STRING = 2
    static CHAR = 3
    static NUMERIC = 4
    static OPERATOR = 5

    /**
     * token type
     * @type {number}
     */
    type
    /**
     * token string
     * @type {string}
     */
    str
    /**
     * token index
     * @type {number}
     */
    index

    /**
     * @param {number} type Token type.
     * @param {string} str Token string.
     * @param {number} index Token index.
     */
    constructor (type, str = '', index = -1) {
      this.type = type
      this.str = str
      this.index = index
    }

    /**
     * Test if token is of a given type or string.
     * @param {number | string} want Wanted token type or string.
     * @returns {boolean} `true` if matched.
     */
    match (want) {
      return typeof want === 'string' ? want === this.str : want === this.type
    }
  }


  /**
   * A C-like lexer.
   */
  class CLexer {
    /**
     * string buffer
     * @type {string}
     */
    buffer
    /**
     * buffer pointer, `-1` is EOF
     * @type {number}
     */
    i = 0

    /**
     * @param {string} str Input string.
     */
    constructor (str) {
      this.buffer = str.replaceAll('\\\n', ' ').trimEnd()
    }

    /**
     * whether EOF is reached
     */
    get isEOF () {
      if (this.i >= this.buffer.length) {
        this.i = -1
        return true
      }
      return this.i < 0
    }

    /**
     * Return a section of `buffer`.
     * @param {number} start
     *  The index to the beginning of the specified portion.
     * @param {number} end
     *  The index to the end of the specified portion. The substring includes
     *  the characters up to, but not including, the character indicated by end.
     *  If this value is not specified, the substring continues to the end of
     *  `buffer`.
     * @returns {string} The specified portion of `buffer`.
     */
    slice (start = undefined, end = undefined) {
      return this.buffer.slice(start, end)
    }

    /**
     * Return next token.
     * @param {boolean} prefetch If true, do not increase the buffer pointer.
     * @returns {Token} Next token.
     */
    next (prefetch = false) {
      if (this.i < 0) {
        return new Token(Token.EOF)
      }

      // skip comments and whitespace
      let oldI
      do {
        oldI = this.i
        while (' \t\r\n'.includes(this.buffer[this.i])) {
          this.i++
        }
        if (this.buffer.startsWith('\\', this.i)) {
          this.i += 2
        }
        if (this.buffer.startsWith('//', this.i)) {
          this.i = this.buffer.indexOf('\n', this.i + 2)
          if (this.i < 0) {
            return new Token(Token.EOF)
          }
          this.i++
        }
        if (this.buffer.startsWith('/*', this.i)) {
          this.i = this.buffer.indexOf('*/', this.i + 2)
          if (this.i < 0) {
            return new Token(Token.EOF)
          }
          this.i += 2
        }
      } while (oldI !== this.i)

      if (this.i >= this.buffer.length) {
        this.i = -1
        return new Token(Token.EOF)
      }

      const token = new Token(null, null, this.i)
      const thisChar = this.buffer[this.i]
      if (thisChar === '"' || thisChar === "'") {
        let indexLiteralEnd = this.buffer.indexOf(thisChar, this.i + 1)
        if (indexLiteralEnd >= 0) {
          indexLiteralEnd++
        }
        token.type = thisChar === '"' ? Token.STRING : Token.CHAR
        token.str = this.buffer.slice(this.i, indexLiteralEnd)
        this.i = indexLiteralEnd
      } else if ('+-*/%=<>!~&|^;,.?:()[]{}#'.includes(thisChar)) {
        token.type = Token.OPERATOR
        token.str = thisChar
        this.i++
      } else {
        let indexTokenEnd = this.i + 1
        let testChar = this.buffer[indexTokenEnd]
        while (('0' <= testChar && testChar <= '9') ||
               ('a' <= testChar && testChar <= 'z') ||
               ('A' <= testChar && testChar <= 'Z') || testChar === '_') {
          indexTokenEnd++
          testChar = this.buffer[indexTokenEnd]
        }
        token.type =
          '0' <= thisChar && thisChar <= '9' ? Token.NUMERIC : Token.IDENTIFIER
        token.str = this.buffer.slice(this.i, indexTokenEnd)
        this.i = indexTokenEnd
      }

      if (prefetch) {
        this.i = oldI
      }
      return token
    }

    /**
     * Skip after the first `delim`.
     * @param {string} delim Delimiter.
     * @returns {number}
     *  Index right before the first delim, or buffer length if not found.
     */
    split (delim = '\n') {
      this.i = this.buffer.indexOf(delim, this.i)
      if (this.i < 0) {
        return this.buffer.length
      }
      const res = this.i
      this.i += delim.length
      return res
    }

    /**
    * Consume repeated tokens.
    * @param {number | string} want Tokens to be consumed.
    * @returns {boolean} `true` if EOF was reached.
    */
    exhaust (want) {
      const isString = typeof want === 'string'
      let token
      do {
        token = this.next()
        if (token.type === Token.EOF) {
          return true
        }
      } while (isString ? token.str === want : token.type === want)
      this.i = token.index
      return false
    }

    _want (grammar, ignoreError = false, isString = false) {
      const oldI = this.i
      const token = this.next()
      if (isString ? grammar !== token.str : grammar !== token.type) {
        if (!ignoreError) {
          this.i = oldI
        }
        return null
      }
      return token
    }

    /**
     * Test if next token is of given type.
     * @param {number} type Token type to match.
     * @param {boolean} ignoreError
     *  If true, do not increase the buffer pointer if token does not match.
     * @returns {Token?} Matched token or `null` if not found.
     */
    wantType (type, ignoreError = false) {
      return this._want(type, ignoreError, false)
    }

    /**
     * Test if next token is of given string.
     * @param {string} str String to match.
     * @param {boolean} ignoreError
     *  If true, do not increase the buffer pointer if token does not match.
     * @returns {Token?} Matched token or `null` if not found.
     */
    wantStr (str, ignoreError = false) {
      return this._want(str, ignoreError, true)
    }

    /**
     * Test if next token is of given type or string.
     * @param {string | number} grammar String or type to match.
     * @param {boolean} ignoreError
     *  If true, do not increase the buffer pointer if token does not match.
     * @returns {Token?} Matched token or `null` if not found.
     */
    want (grammar, ignoreError = false) {
      const oldI = this.i
      const token = this.next()
      if (!token.match(grammar)) {
        if (!ignoreError) {
          this.i = oldI
        }
        return null
      }
      return token
    }

    /**
     * Match buffer against given grammars.
     * @param {(number | string)[]} grammars Grammars to be matched.
     * @param {boolean} ignoreError
     *  If true, do not increase the buffer pointer if token does not match.
     * @returns {Token[]} All matched tokens. If the length is less than
     *  `grammars`', `grammars` were not accepted.
     */
    match (grammars, ignoreError = false) {
      const oldI = this.i
      /** @type {string[]} */
      const result = []
      for (let i = 0; i < grammars.length; i++) {
        const token = this.next()
        if (!token.match(grammars[i])) {
          if (!ignoreError) {
            this.i = oldI
          }
          break
        }
        result.push(token.str)
      }
      return result
    }
  }


  /**
   * @typedef {Map<string, bigint>} EnumMap
   * @property {string} [0] enum name
   * @property {bigint} [1] enum value
   */

  /**
   * Parse C-like enum definition.
   * @param {CLexer} lexer
   * @returns {[EnumMap?, string?]}
   */
   function parseEnum (lexer) {
    if (!lexer.wantStr('enum')) {
      return [null, null]
    }

    /** @type {EnumMap} */
    const result = new Map
    /** @type {string?} */
    let className = null
    /** @type {Token} */
    let token = lexer.next()
    if (token.type === Token.IDENTIFIER) {
      className = token.str
      token = lexer.next()
    }
    if (token.str !== '{') {
      return [null, null]
    }

    let counter = 0n
    while (!lexer.exhaust(',')) {
      token = lexer.next()
      if (token.str === '}') {
        break
      }

      if (token.type !== Token.IDENTIFIER && token.type !== Token.STRING) {
        return [null, null]
      }
      const key = token.str
      result.set(key, counter)
      counter += 1n

      token = lexer.next()
      if (token.type === Token.IDENTIFIER || token.type === Token.STRING ||
          token.str === ',') {
        lexer.i = token.index
        continue
      }
      if (token.str === '}') {
        break
      }
      if (token.str !== '=') {
        return [null, null]
      }

      token = lexer.next()
      if (token.type !== Token.NUMERIC) {
        return [null, null]
      }
      const value = parseValue(token.str)
      if (value === null) {
        return [null, null]
      }
      result.set(key, value)
      counter = value + 1n
    }

    return [result, className]
  }


  /**
   * Represent a bit field.
   */
  class Field {
    /**
     * field name
     * @type {string}
     */
    name
    /**
     * field index
     * @type {number}
     */
    index
    /**
     * field width. If 0, the field is a single bit indicator
     * @type {number}
     */
    width
    /**
     * field background HTML color
     * @type {string?}
     */
    color
    /**
     * names of enum types to be used
     * @type {string[]?}
     */
    enumTypes
    /**
     * field information
     * @type {string?}
     */
    comment
    /**
     * enum definitions
     * @type {Map<string, bigint>}
     */
    enums = new Map

    /**
     * @param {string} name Field name.
     * @param {number} width
     *  Field width. If 0, the field is a single bit indicator.
     * @param {number} index Field index, LSB is 0.
     * @param {string?} color Field background HTML color.
     * @param {string[]?} enumTypes Names of enum types to be used.
     * @param {string?} comment Field information.
     */
    constructor (
        name, width, index, color = null, enumTypes = null, comment = null) {
      this.name = name
      this.index = index
      this.width = width
      this.color = color
      this.enumTypes = enumTypes
      this.comment = comment
    }

    /**
     * Convert a string to a Field object.
     * @param {string} str String to be parsed.
     * @param {number?} regWidth Register width, used to calculate field index.
     * @returns {Field?} Parsed field or `null` if parsing failed.
     */
    static fromString (str, regWidth = 0) {
      const [name, strWidth, color, enumTypes, comment] =
        str.replaceAll('\\n', '\n').split(':').map(x => x.trim() || undefined)

      let width, index
      if (!strWidth) {
        // treat as 1-bit field
        width = 1
      } else if (strWidth[0] < '0' || '9' < strWidth[0]) {
        // bit indicator
        index = Number(strWidth.slice(1))
        if (isNaN(index)) {
          return null
        }
        width = 0
      } else {
        // field
        width = Number(strWidth)
        if (isNaN(width)) {
          return null
        }
        if (regWidth > 0) {
          index = regWidth - width
          if (index < 0) {
            return null
          }
        }
      }
      return new Field(
        name || '', width, index, color,
        enumTypes && enumTypes.split(',').map(x => x.trim()), comment)
    }

    /**
     * Return the string representation of the field.
     * @returns {string} The string representing this field.
     */
    toString () {
      let str = this.name
      str += ':'
      if (this.width > 1) {
        str += this.width
      }
      str += ':'
      if (this.color) {
        str += this.color
      }
      str += ':'
      if (this.enumTypes) {
        str += this.enumTypes.join()
      }
      while (str[str.length - 2] === ':') {
        str = str.slice(0, -1)
      }
      return str
    }

    /**
     * whether the field is a bit indicator
     */
    get isBit () {
      return this.width === 1
    }

    static compareFunc (self, other) {
      return other.index - self.index
    }

    /**
     * Collect enum definitions of `enumTypes` from `enums`.
     * @param {Map<string?, EnumMap>} enums Enum definitions.
     */
    collectEnums (enums) {
      if (!this.enumTypes || this.enumTypes.length === 0) {
        return
      }
      // collect named enum s
      const anomEnumTypes = []
      for (let i = 0; i < this.enumTypes.length; i++) {
        const enumType = this.enumTypes[i]
        const enumObj = enums.get(enumType)
        if (enumObj) {
          enumObj.forEach((value, key) => this.enums.set(key, value))
        } else {
          anomEnumTypes.push(enumType)
        }
      }
      // then collect #define s
      if (anomEnumTypes.length === 0) {
        return
      }
      enums.get(null)?.forEach((value, key) => {
        for (let i = 0; i < anomEnumTypes.length; i++) {
          if (key.toUpperCase().startsWith(anomEnumTypes[i])) {
            this.enums.set(key, value)
            break
          }
        }
      })
    }
  }


  /**
   * Collection of bit fields and enum definitions.
   */
  class Format {
    /** @type {Field[]} */
    fields
    /** @type {Map<number, Field>} */
    bits
    /** @type {Map<string?, EnumMap>} */
    enums
    /** @type {number} */
    width = 0

    /**
     * @param {Field[]} fields
     * @param {Map<number, Field>} bits
     * @param {Map<string?, EnumMap>} enums
     */
    constructor (fields = [], bits = new Map, enums = new Map) {
      this.fields = fields
      this.bits = bits
      this.enums = enums
    }

    /**
     * @param {string} str Format string.
     * @returns {Format}
     */
    static fromString (str) {
      const lexer = new CLexer(str)
      const format = new Format
      /** @type {EnumMap} */
      const anomEnum = new Map
      format.enums.set(null, anomEnum)

      while (true) {
        const token = lexer.next()
        if (token.type === Token.EOF) {
          break
        } else if (token.str === '#') {
          // single-line define
          const [_, key, value] = lexer.match([
            'define', Token.IDENTIFIER, Token.NUMERIC])
          if (!value) {
            throw new SyntaxError(
              'Cannot parse C macro as a numeric define at ' + lexer.i)
          }
          anomEnum.set(key, parseValue(value))
          // skip that line
          lexer.split()
        } else if (token.str === 'typedef') {
          // enum with typedef
          const [enumMap, enumClass] = parseEnum(lexer)
          if (!enumMap) {
            throw new SyntaxError('Cannot parse a typedef at ' + lexer.i)
          }

          token = lexer.wantType(Token.IDENTIFIER)
          if (!token && !enumClass) {
            enumMap.forEach((value, key) => anomEnum.set(key, value))
          } else {
            if (token) {
              format.enums.set(token.str, enumMap)
            }
            if (enumClass) {
              format.enums.set(enumClass, enumMap)
            }
          }

          lexer.exhaust(';')
        } else if (token.str === 'enum') {
          // enum without typedef
          lexer.i = token.index
          const [enumMap, enumClass] = parseEnum(lexer)
          if (!enumMap) {
            throw new SyntaxError('Cannot parse an enum at ' + lexer.i)
          }

          if (!enumClass) {
            enumMap.forEach((value, key) => anomEnum.set(key, value))
          } else {
            format.enums.set(enumClass, enumMap)
          }

          lexer.exhaust(';')
        } else {
          // field
          const field =
            Field.fromString(lexer.slice(token.index, lexer.split()))
          if (!field) {
            throw new SyntaxError(
              'Cannot parse a field description at ' + lexer.i)
          }
          if (field.width === 0) {
            format.bits.set(field.index, field)
          } else {
            format.fields.push(field)
          }
        }
      }

      format.postfix()
      return format
    }

    /**
     * whether the register width is zero
     */
    get isEmpty () {
      return this.fields.length === 0 && this.bits.size === 0
    }

    /**
     * Calculate the register width, and collect enum definitions.
     */
    postfix () {
      this.width = 0
      for (let i = 0; i < this.fields.length; i++) {
        this.width += this.fields[i].width
      }
      let newWidth = this.width
      this.bits.forEach((_, index) => {
        if (index + 1 > newWidth) {
          newWidth = index + 1
        }
      })
      if (newWidth > this.width) {
        this.fields.unshift(new Field('', newWidth - this.width, this.width))
        this.width = newWidth
      }

      let currentIndex = this.width
      for (let i = 0; i < this.fields.length; i++) {
        this.fields[i].collectEnums(this.enums)
        currentIndex -= this.fields[i].width
        this.fields[i].index = currentIndex
      }
    }
  }


  /********** k-v storage **********/

  /**
   * `LocalStorage` a `Map`.
   * @template V the value type
   * @extends {Map<string, V>}
   */
   class LocalMapStorage extends Map {
    /**
     * the key of the map in the `LocalStorage`
     * @type {string}
     */
    storageKey
    /**
     * if `false`, remove the key from `LocalStorage` if map is empty
     * @type {boolean}
     */
    keepEmpty = false
    /**
     * if `true`, do not auto save to `LocalStorage`
     * @type {boolean}
     */
    delayMode = false

    /**
     * @param {string} storageKey
     */
    constructor (storageKey) {
      super()
      this.storageKey = storageKey

      /** @type {[string, V][]?} */
      const values = JSON.parse(localStorage.getItem(storageKey))
      if (values) {
        for (let i = 0; i < values.length; i++) {
          super.set(values[i][0], values[i][1])
        }
      }
    }

    /**
     * Save the map to the local storage.
     */
    store () {
      if (this.size > 0 || this.keepEmpty) {
        localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this)))
      } else {
        localStorage.removeItem(this.storageKey)
      }
    }

    /**
     * Test whether the value to the key in this map will be altered.
     * @param {string} key
     * @param {V} value
     * @returns {boolean}
     */
    willSet (key, value) {
      return JSON.stringify(this.get(key)) !== JSON.stringify(value)
    }

    /**
     * @param {string} key
     * @param {V} value
     * @param {boolean} force
     * @returns {this}
     */
    set (key, value, force = false) {
      if (force || this.willSet(key, value)) {
        super.set(key, value)
        if (!this.delayMode) {
          this.store()
        }
      }
      return this
    }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    delete (key) {
      if (!super.delete(key)) {
        return false
      }
      if (!this.delayMode) {
        this.store()
      }
      return true
    }

    clear () {
      super.clear()
      if (!this.delayMode) {
        this.store()
      }
    }
  }


  /**
   * Manage K-V pairs in `LocalStorage` with `<select>` element.
   * @template V the value type
   * @param {HTMLSelectElement} select The `<select>` element.
   * @param {string} key The key to `LocalStorage`.
   * @param {HTMLElement} btnAdd
   *  The add button. Call `factory` for a new k-v pair.
   * @param {(this: btnAdd, event: Event) => [string, V]?} factory
   *  The function for a new k-v pair.
   * @param {HTMLElement} btnSelect
   *  The select button. Call `executor` for action.
   * @param {(this: btnSelect, value: V, key: string, event: Event) => void} executor
   *  The action when `select` button is clicked.
   * @param {HTMLElement} btnDelete The delete button.
   * @param {HTMLElement} btnClear The clear button.
   * @returns {LocalMapStorage<V>} The map of k-v pairs.
   */
  function kvStroageManage (
      select, key, btnAdd = undefined, factory = undefined,
      btnSelect = undefined, executor = undefined, btnDelete = undefined,
      btnClear = undefined) {
    // load data
    /** @type {LocalMapStorage<V>} */
    const data = new LocalMapStorage(key)
    for (const [key, value] of data) {
      const option = document.createElement('option')
      option.value = key
      option.textContent = key
      select.appendChild(option)
    }

    // bind btnSelect
    if (btnSelect && executor) {
      btnSelect.addEventListener('click', function (event) {
        const key = select.value
        if (!key) {
          return
        }
        const value = data.get(key)
        if (value === undefined) {
          console.warn('kvStroageManage: key not found:', key)
          return
        }
        executor(value, key, event)
      }, {passive: true})
    }

    // bind btnAdd and btnDelete
    data.keepEmpty = true
    if (btnAdd && factory) {
      btnAdd.addEventListener('click', function (event) {
        const item = factory(event)
        if (!item) {
          return
        }
        const [key, value] = item
        const oldValue = data.get(key)
        if (oldValue !== undefined && !data.willSet(key, value)) {
          return
        }
        data.set(key, value, true)
        if (oldValue === undefined) {
          const option = document.createElement('option')
          option.value = item[0]
          option.textContent = item[0]
          select.appendChild(option)
        }
      }, {passive: true})
    }
    btnDelete?.addEventListener('click', function (event) {
      if (!select.value || !data.delete(select.value)) {
        return
      }
      select.selectedOptions[0].remove()
    }, {passive: true})

    btnClear?.addEventListener('click', function (event) {
      if (!confirm('Sure to clear?')) {
        return
      }
      data.clear()
      select.textContent = ''
    }, {passive: true})

    return data
  }


  /********** elements **********/

  class BitfieldTable extends HTMLTableElement {
    static template = document.createElement('template')

    static {
      this.template.innerHTML = `<thead>
  <tr class="bitfield-bits-index"></tr>
</thead>
<tbody>
  <tr class="bitfield-bits-value"></tr>
  <tr class="bitfield-fields-hex"></tr>
</tbody>
<thead>
  <tr class="bitfield-fields-name"></tr>
</thead>
<tbody>
  <tr class="bitfield-fields-enum"></tr>
</tbody>`
    }

    /**
     * register width
     */
    #regWidth = 0
    /**
     * register value
     */
    #value = 0n

    constructor () {
      super()

      this.appendChild(this.constructor.template.content.cloneNode(true))

      this.#trBitsValue.addEventListener('click', event => {
        /** @type {HTMLTableCellElement} */
        const target = event.target
        if (target.tagName !== 'TD') {
          return
        }

        const value = +!Number(target.textContent)
        target.textContent = value

        this.change(BigInt(value), Number(target.dataset.index) || 0, 1, target)
      }, {passive: true})

      this.#trFieldsHex.addEventListener('input', event => {
        /** @type {HTMLDivElement} */
        const target = event.target
        if (target.tagName !== 'DIV' || !target.isContentEditable) {
          return
        }
        const strValue = target.textContent.trim()
        if (strValue === '') {
          target.style.backgroundColor =
            this.getAttribute('color-warning') ?? 'lightyellow'
          return
        }
        const cell = target.closest('td')
        if (cell === null) {
          return
        }

        let value
        try {
          value = parseValue(strValue, Number(this.getAttribute('radix')) || 16)
        } catch (e) {
          if (!(e instanceof SyntaxError)) {
            throw e
          }
          target.style.backgroundColor =
            this.getAttribute('color-error') ?? 'lightpink'
          return
        }
        target.style.backgroundColor = ''

        this.change(
          value, Number(cell.dataset.index) || 0,
          Number(cell.dataset.width) || 1, cell)
      }, {passive: true})

      this.#trFieldsEnum.addEventListener('change', event => {
        /** @type {HTMLSelectElement} */
        const target = event.target
        if (target.tagName !== 'SELECT') {
          return
        }
        const strValue = target.value
        if (strValue === '') {
          return
        }
        const cell = target.closest('td')
        if (cell === null) {
          return
        }

        let value
        try {
          value = BigInt(strValue)
        } catch {
          console.error(target, 'has option that do not has a valid value')
          return
        }

        this.change(
          value, Number(cell.dataset.index) || 0,
          Number(cell.dataset.width) || 1, cell)
      }, {passive: true})
    }

    /** @type {HTMLTableRowElement} */
    get #trBitsIndex () {
      return this.querySelector('.bitfield-bits-index')
    }

    /** @type {HTMLTableRowElement} */
    get #trBitsValue () {
      return this.querySelector('.bitfield-bits-value')
    }

    /** @type {HTMLTableRowElement} */
    get #trFieldsHex () {
      return this.querySelector('.bitfield-fields-hex')
    }

    /** @type {HTMLTableRowElement} */
    get #trFieldsName () {
      return this.querySelector('.bitfield-fields-name')
    }

    /** @type {HTMLTableRowElement} */
    get #trFieldsEnum () {
      return this.querySelector('.bitfield-fields-enum')
    }

    get value () {
      return this.#value
    }

    set value (value) {
      this.#setValue(value)
    }

    /**
     * @param {bigint} value
     * @param {HTMLElement} initiator
     */
    #setValue (value = this.#value, initiator = undefined) {
      this.#value = value
      if (this.#regWidth <= 0) {
        return value
      }

      const tdsBitValue = this.#trBitsValue.children
      for (let i = 0; i < tdsBitValue.length; i++) {
        const td = tdsBitValue[i]
        if (initiator === td) {
          continue
        }

        const index = td.dataset.index ? BigInt(td.dataset.index) : 0n
        td.textContent = value & (1n << index) ? '1' : '0'
      }

      const tdsFieldHex = this.#trFieldsHex.children
      for (let i = 0; i < tdsFieldHex.length; i++) {
        const td = tdsFieldHex[i]
        if (initiator === td) {
          continue
        }

        const div = td.firstElementChild
        if (!div) {
          continue
        }
        div.style.backgroundColor = ''

        const index = td.dataset.index ? BigInt(td.dataset.index) : 0n
        const width = td.dataset.width ? BigInt(td.dataset.width) : 1n
        div.textContent =
          (width > 1n ? '0x' : '') +
          ((value >> index) & ((1n << width) - 1n)).toString(16)
      }

      const tdsFieldEnum = this.#trFieldsEnum.children
      for (let i = 0; i < tdsFieldEnum.length; i++) {
        const td = tdsFieldEnum[i]
        if (initiator === td) {
          continue
        }

        const select = td.firstElementChild
        if (!select) {
          continue
        }

        const index = td.dataset.index ? BigInt(td.dataset.index) : 0n
        const width = td.dataset.width ? BigInt(td.dataset.width) : 1n
        select.value = ((value >> index) & ((1n << width) - 1n)).toString()
      }

      return value
    }

    /**
     * Change a field in the value.
     * @param {bigint} field Field value.
     * @param {number} index Field index.
     * @param {number} width Field width.
     * @param {HTMLElement} initiator Change initiator.
     */
    change (field, index, width = 1, initiator = undefined) {
      const bigIndex = BigInt(index)
      const mask = (1n << BigInt(width)) - 1n
      const value =
        this.#value & ~(mask << bigIndex) | ((field & mask) << bigIndex)

      this.#setValue(value, initiator)
      this.dispatchEvent(new CustomEvent('valuechange', {detail: value}))
    }

    clear () {
      this.#regWidth = 0
      this.#trBitsIndex.textContent = ''
      this.#trBitsValue.textContent = ''
      this.#trFieldsHex.textContent = ''
      this.#trFieldsName.textContent = ''
      this.#trFieldsEnum.textContent = ''
    }

    /**
     * Draw struct table.
     * @param {Format} format Format.
     */
    setFormat (format) {
      this.#regWidth = format.width

      // draw bits index and value
      const trBitsIndex = this.#trBitsIndex
      const trBitsValue = this.#trBitsValue
      trBitsIndex.textContent = ''
      trBitsValue.textContent = ''

      for (let i = format.width - 1; i >= 0; i--) {
        const s = i.toString()

        // bit index
        const index = document.createElement('th')
        index.textContent = s
        trBitsIndex.appendChild(index)

        // bit value
        const value = document.createElement('td')
        const field = format.bits.get(i)
        if (field) {
          value.className = 'bitfield-bits-named'
          value.title = field.name
          if (field.color) {
            value.style.backgroundColor = field.color
          }
        }
        value.dataset.index = s
        trBitsValue.appendChild(value)
      }

      // draw fields name and hex
      const trFieldsHex = this.#trFieldsHex
      const trFieldsName = this.#trFieldsName
      trFieldsHex.textContent = ''
      trFieldsName.textContent = ''

      let fieldsHaveEnums = false
      for (let i = 0; i < format.fields.length; i++) {
        const field = format.fields[i]

        // field hex
        const hex = document.createElement('td')
        hex.colSpan = field.width
        hex.dataset.index = field.index
        hex.dataset.width = field.width
        const hexValue = document.createElement('div')
        hexValue.contentEditable = 'true'
        hex.appendChild(hexValue)
        trFieldsHex.appendChild(hex)

        // field name
        const name = document.createElement('th')
        name.colSpan = field.width
        if (field.color) {
          name.style.backgroundColor = field.color
        }
        if (field.name[0] === '~') {
          name.className = 'bitfield-overline'
          name.textContent = field.name.slice(1)
        } else {
          name.textContent = field.name
        }
        if (field.comment) {
          name.title = field.comment
        }
        trFieldsName.appendChild(name)

        // prepare to draw enums
        fieldsHaveEnums ||= !!field.enumTypes
      }

      // draw fields enum
      const trFieldsEnum = this.#trFieldsEnum
      trFieldsEnum.textContent = ''

      if (fieldsHaveEnums) {
        for (let i = 0; i < format.fields.length; i++) {
          const field = format.fields[i]
          const enums = document.createElement('td')
          enums.colSpan = field.width
          enums.dataset.index = field.index
          enums.dataset.width = field.width
          if (field.enums.size > 0) {
            const select = document.createElement('select')
            const option = document.createElement('option')
            option.value = ''
            select.appendChild(option)
            field.enums.forEach((value, key) => {
              const option = document.createElement('option')
              option.value = value
              option.textContent = '(0x' + value.toString(16) + ') ' + key
              select.appendChild(option)
            })
            enums.appendChild(select)
          }
          trFieldsEnum.appendChild(enums)
        }
      }

      this.#setValue()
    }
  }

  customElements.define('bitfield-table', BitfieldTable, {extends: 'table'})


  class BitfieldViewer extends HTMLElement {
    static template = document.createElement('template')

    static {
      this.template.innerHTML = `<link rel="stylesheet" href="bitfield.css" />

      <div class="bitfield-table-container">
      <table is="bitfield-table" class="bitfield-table"></table></div>

<div class="bitfield-values">
  <div>
    <label for="bitfield-value">
      Input:
      <input type="text" class="bitfield-input-value" name="value" />
    </label>
  </div>
  <div>
    Value: <code class="bitfield-output-value"></code>
  </div>
  <div>
    <span>Default radix:</span>
    <label>
      <input type="radio" name="radix" value="2" /> 2
    </label>
    <label>
      <input type="radio" name="radix" value="8" /> 8
    </label>
    <label>
      <input type="radio" name="radix" value="10" /> 10
    </label>
    <label>
      <input type="radio" name="radix" value="16" checked="checked" /> 16
    </label>
  </div>
  <div>
    <label>
      <input type="checkbox" name="signed" /> Signed int
    </label>
    <span class="tooltip">?
      <span class="tooltiptext">Uncheck to always show unsigned int</span>
    </span>
    <label for="bitfield-float">
      <input type="checkbox" name="float" checked="checked" disabled="disabled" />
      <span class="bitfield-float-label">IEEE float</span>
    </label>
    <span class="tooltip">?
      <span class="tooltiptext">
        Treat value as IEEE float, register must be exactly 32 or 64 bit long
      </span>
    </span>
  </div>
</div>`
    }

    root = this.attachShadow({mode: 'open'})
    /**
     * register width
     */
    #regWidth = 0
    #radix = 16
    #asSigned = false
    #asFloat = false
    /**
     * register value
     */
    #value = 0n
    #parseSuccess = false

    constructor () {
      super()

      this.root.appendChild(this.constructor.template.content.cloneNode(true))

      this.#table.addEventListener('valuechange', event => {
        this.#setValue(event.detail, event.target)
      })

      const input = this.#input
      input.value = localStorage.getItem(
        (this.getAttribute('prefix') || 'bitfield') + '::value') || '0'
      input.addEventListener('input', event => {
        this.#readValue(event.target)
        localStorage.setItem(
          (this.getAttribute('prefix') || 'bitfield') + '::value',
          event.target.value)
      }, {passive: true})

      // radix & signedness
      this.#radix = Number(localStorage.getItem(
        (this.getAttribute('prefix') || 'bitfield') + '::radix')) || 16
      initRadioInputs(
        this.root.querySelectorAll('input[name="radix"]'), event => {
          this.#radix = parseInt(event.target.value)
          localStorage.setItem(
            (this.getAttribute('prefix') || 'bitfield') + '::radix',
            event.target.value)
          this.#drawOrReadValue(event.target)
        }, this.#radix.toString())

      const signed = this.#signed
      signed.checked = !!localStorage.getItem(
        (this.getAttribute('prefix') || 'bitfield') + '::signed')
      this.#asSigned = signed.checked
      signed.addEventListener('change', event => {
        this.#asSigned = event.target.checked
        localStorage.setItem(
          (this.getAttribute('prefix') || 'bitfield') + '::signed',
          event.target.checked ? '1' : '')
        this.#drawValue(event.target)
      }, {passive: true})

      const float = this.#float
      float.checked = !!localStorage.getItem(
        (this.getAttribute('prefix') || 'bitfield') + '::float')
      this.#asFloat = float.checked
      float.addEventListener('change', event => {
        this.#asFloat = event.target.checked
        localStorage.setItem(
          (this.getAttribute('prefix') || 'bitfield') + '::signed',
          event.target.checked ? '1' : '')
        this.#drawOrReadValue(event.target)
      }, {passive: true})

      this.#labelFloat.style.backgroundColor =
        this.getAttribute('color-warning') || 'lightyellow'

      this.#readValue(input)
    }

    static get observedAttributes () {
      return ['color-warning', 'color-error']
    }

    /** @type {BitfieldTable} */
    get #table () {
      return this.root.querySelector('.bitfield-table')
    }

    /** @type {HTMLInputElement} */
    get #input () {
      return this.root.querySelector('.bitfield-input-value')
    }

    /** @type {HTMLElement} */
    get #output () {
      return this.root.querySelector('.bitfield-output-value')
    }

    /** @type {HTMLInputElement} */
    get #signed () {
      return this.root.querySelector('input[name="signed"]')
    }

    /** @type {HTMLInputElement} */
    get #float () {
      return this.root.querySelector('input[name="float"]')
    }

    /** @type {HTMLElement} */
    get #labelFloat () {
      return this.root.querySelector('.bitfield-float-label')
    }

    get value () {
      return this.#value
    }

    set value (value) {
      this.#setValue(value)
    }

    /**
     * @param {bigint} value
     * @param {HTMLElement} initiator
     */
    #setValue (value = this.#value, initiator = undefined) {
      this.#value = value

      const unsigned = value & ((1n << BigInt(this.#regWidth)) - 1n)
      const val =
        this.#asSigned && this.#regWidth > 0 &&
          unsigned >= 1n << BigInt(this.#regWidth - 1) ?
        unsigned - (1n << BigInt(this.#regWidth)) : unsigned

      const table = this.#table
      if (initiator !== table) {
        table.value = val
      }unsigned

      const strValue = valueToString(val, this.#radix)

      const input = this.#input
      if (initiator !== input) {
        input.value = strValue
        localStorage.setItem(
          (this.getAttribute('prefix') || 'bitfield') + '::value', strValue)
      }

      let str = strValue
      if (this.#asFloat && (
          this.#regWidth === 32 || this.#regWidth === 64)) {
        const buf = new ArrayBuffer(this.#regWidth / 8)
        let float
        switch (this.#regWidth) {
          case 32:
            new Uint32Array(buf)[0] = Number(unsigned)
            float = new Float32Array(buf)[0]
            break
          case 64:
            new BigUint64Array(buf)[0] = unsigned
            float = new Float64Array(buf)[0]
            break
        }
        str += ', ' + float.toString()
      }
      this.#output.textContent = str + ' (0x' + val.toString(16) + ')'

      if (initiator) {
        this.dispatchEvent(new CustomEvent('valuechange', {detail: value}))
      }
      return value
    }

    /**
     * @param {HTMLElement} initiator
     */
    #readValue (initiator = undefined) {
      this.#parseSuccess = false

      const input = this.#input
      const strValue = input.value.trim()
      if (!strValue) {
        input.style.backgroundColor =
          this.getAttribute('color-warning') || 'lightyellow'
        return null
      }

      let value = null
      try {
        value = parseValue(strValue, this.#radix)
      } catch (e) {
        if (!(e instanceof SyntaxError)) {
          throw e
        }
      }

      if (value === null) {
        if (this.#asFloat && (
            this.#regWidth === 32 || this.#regWidth === 64)) {
          const float = parseFloat(strValue)
          if (!isNaN(float)) {
            const buf = new ArrayBuffer(this.#regWidth / 8)
            switch (this.#regWidth) {
              case 32:
                new Float32Array(buf)[0] = float
                value = BigInt(new Int32Array(buf)[0])
                break
              case 64:
                new Float64Array(buf)[0] = float
                value = new BigInt64Array(buf)[0]
                break
            }
          }
        }

        if (value === null) {
          input.style.backgroundColor =
            this.getAttribute('color-error') || 'lightpink'
          return null
        }
      }

      input.style.backgroundColor = ''
      this.#parseSuccess = true

      return this.#setValue(value, initiator)
    }

    /**
     * @param {HTMLElement} initiator
     */
    #drawValue (initiator = undefined) {
      return this.#parseSuccess ? this.#setValue() : null
    }

    /**
     * @param {HTMLElement} initiator
     */
    #drawOrReadValue (initiator = undefined) {
      return this.#parseSuccess ? this.#setValue() : this.#readValue(initiator)
    }

    attributeChangedCallback (name, oldValue, newValue) {
      switch (name) {
        case 'color-warning':
          if (this.#labelFloat.style.backgroundColor) {
            this.#labelFloat.style.backgroundColor = newValue
          }
          // fall through
        case 'color-error':
          this.#table.setAttribute(name, newValue)
          break
      }
    }

    clear () {
      this.#regWidth = 0
      this.#table.clear()
    }

    /**
     * Draw struct table.
     * @param {Format} format Format.
     */
    setFormat (format) {
      this.#regWidth = format.width

      if (this.#regWidth === 32 || this.#regWidth === 64) {
        this.#labelFloat.style.backgroundColor = ''
        this.#float.disabled = false
      } else {
        this.#labelFloat.style.backgroundColor =
          this.getAttribute('color-warning') || 'lightyellow'
        this.#float.disabled = true
      }

      this.#table.setFormat(format)
      this.#readValue(this.#input)
    }
  }

  customElements.define('bitfield-viewer', BitfieldViewer)


  var Bitfield = class Bitfield {
    /** @type {HTMLElement} */
    root
    options
    /** @type {LocalMapStorage<string>} */
    structs

    /**
     * @param {HTMLElement} root
     * @param {Object} options
     * @param {string} [options.storagePrefix] prefix to use for `LocalStorage`
     * @param {string} [options.colorError] color to use for errors
     * @param {string} [options.colorWarning] color to use for warnings
     */
    constructor (root, options = {}) {
      this.root = root
      this.options = options

      options.storagePrefix ||= this.root.dataset.storagePrefix || 'bitfield'
      options.colorError ||= this.root.dataset.colorError || 'lightpink'
      options.colorWarning ||= this.root.dataset.colorWarning || 'lightyellow'

      const input = this.#format
      input.addEventListener('input', event => {
        this.#setFormat()
      }, {passive: true})
      const oldFormat = localStorage.getItem(
        this.options.storagePrefix + '::format')
      if (oldFormat) {
        this.#format.value = oldFormat
      }
      this.#setFormat()

      // manage saved structs
      this.structs = kvStroageManage(
        this.root.querySelector('.bitfield-struct-select'),
        this.options.storagePrefix + '::structs',
        this.root.querySelector('.bitfield-struct-save'),
        event => {
          /** @type {HTMLInputElement} */
          const target = event.target
          if (target.value === '') {
            target.style.backgroundColor = this.options.colorWarning
            return null
          }
          return this.#getFormat() && [target.value, this.#format.value]
        },
        this.root.querySelector('.bitfield-struct-load'), value => {
          this.format = value
        },
        this.root.querySelector('.bitfield-struct-delete'),
        this.root.querySelector('.bitfield-struct-clear'))

      this.root.querySelector('.bitfield-book-load')?.addEventListener(
        'click', async event => {
          const input = this.root.querySelector('.bitfield-book-input')
          if (input === null) {
            return
          }
          const reader = await readInputFile(input)
          if (reader === null) {
            return
          }

          const book = JSON.parse(reader.result)
          if (!Array.isArray(book)) {
            alert('It does not look like a valid book.')
            return
          }

          this.structs.delayMode = true
          for (let i = 0; i < book.length; i++) {
            this.structs.set(book[i][0], book[i][1])
          }
          this.structs.delayMode = false
          this.structs.store()

          const select = this.root.querySelector('.bitfield-struct-select')
          select.textContent = ''
          for (const [key, value] of this.structs) {
            const option = document.createElement('option')
            option.value = key
            option.textContent = key
            select.appendChild(option)
          }
        }, {passive: true})
    }

    /** @type {BitfieldViewer} */
    get #viewer () {
      return this.root.querySelector('bitfield-viewer')
    }

    /** @type {HTMLInputElement | HTMLTextAreaElement} */
    get #format () {
      return this.root.querySelector('.bitfield-format')
    }

    get format () {
      return this.#format.value
    }

    set format (value) {
      this.#format.value = value
      this.#setFormat()
    }

    #getFormat () {
      const input = this.#format

      const formatStr = input.value
      if (formatStr === '') {
        input.style.backgroundColor = ''
        return null
      }

      let format
      try {
        format = Format.fromString(formatStr)
      } catch (e) {
        console.info('Parse error:', e)
        input.style.backgroundColor = this.options.colorError
        return null
      }

      if (format.isEmpty) {
        input.style.backgroundColor = this.options.colorWarning
        return null
      }

      input.style.backgroundColor = ''
      return format
    }

    #setFormat () {
      const format = this.#getFormat()
      if (format !== null) {
        localStorage.setItem(
          this.options.storagePrefix + '::format', this.#format.value)
        this.#viewer.setFormat(format)
      }
      return format
    }
  }
}
