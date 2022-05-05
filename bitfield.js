'use strict'

/**
 * @typedef BitfieldOptions
 * @type {Object}
 * @property {[string, string][] | string} [preload=null]
 *  preloaded struct data; if set, `LocalStorage` will be disabled
 * @property {string} [storagePrefix='bitfield']
 *  prefix to use for `LocalStorage`
 * @property {string} [colorError='lightpink'] color to use for errors
 * @property {string} [colorWarning='lightyellow'] color to use for warnings
 * @property {number} [radix=16] default base to parse the input as
 * @property {boolean} [asSigned=false] whether to treat value as signed data
 * @property {boolean} [asFloat=false]
 *  whether to interpret value as an IEEE754 float
 */

/**
 * @param {HTMLElement} container
 * @param {BitfieldOptions} options
 */
function bitfield (container, options = {}) {
  options.preload ||= container.dataset.preload || null
  if (typeof options.preload === 'string') {
    options.preload = self[options.preload] || null
  }
  options.storagePrefix ||= container.dataset.storagePrefix || 'bitfield'
  options.colorError ||= container.dataset.colorError || 'lightpink'
  options.colorWarning ||= container.dataset.colorWarning || 'lightyellow'

  {
    const radix = localStorage.getItem(options.storagePrefix + '-radix')
    if (radix !== null) {
      options.radix = parseInt(radix)
    }
    options.radix ||= 16
  }
  {
    const asSigned = localStorage.getItem(options.storagePrefix + '-signed')
    if (asSigned !== null) {
      options.asSigned = !!asSigned
    } else if (!options.asSigned) {
      options.asSigned = false
    }
  }
  {
    const asFloat = localStorage.getItem(options.storagePrefix + '-float')
    if (asFloat !== null) {
      options.asFloat = !!asFloat
    } else if (!options.asFloat) {
      options.asFloat = false
    }
  }

  /** @type {DocumentFragment} */
  const node = document.getElementById('bitfield').content.cloneNode(true)


  /********** utilities **********/

  /**
   * Bind 'change' callback to radio buttons and set initial value.
   * @param {NodeListOf<HTMLInputElement>} radios Radio buttons.
   * @param {(this: HTMLInputElement, event: Event) => void} callback
   *  Callback for 'change' event.
   * @param {string} initialValue Initial value to select.
   */
  function initRadioInputs (radios, callback, initialValue = null) {
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
   * @param {number} [radix=10]
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
          throw RangeError('radix argument must be 2, 8, 10, 16')
      }
    }

    return negative ? -BigInt(numStr) : BigInt(numStr)
  }

  /**
   * Represent a register value.
   */
  class Value {
    /**
     * @param {(bigint|number|string)} [value=0] The value to be parsed.
     * @param {number} [radix=10]
     *  The default base to parse the string as, if no prefix found.
     */
    constructor (value = 0, radix = 10) {
      switch (typeof value) {
        case 'bigint':
          this.value = value
          break
        case 'number':
          this.value = BigInt(value)
          break
        default:
          this.value = parseValue(value, radix)
      }
    }

    /**
     * Convert a string to bigint based on its prefix, and update the Value.
     * @param {string} str The string to be parsed.
     * @param {number} [radix=10]
     *  The default base to parse the string as, if no prefix found.
     * @returns {boolean} `true` if parse succeeded.
     * @throws {RangeError} If `radix` is not 2, 8, 10, or 16.
     */
    parse (str, radix = 10) {
      try {
        this.value = parseValue(str, radix)
        return true
      } catch (e) {
        if (!(e instanceof SyntaxError)) {
          throw e
        }
        return false
      }
    }

    /**
     * Return the string representation of the value with appropriate prefix.
     * @param {number} [radix=10] The base to be used, affecting the prefix.
     * @returns {string} A string representing this value.
     * @throws {RangeError} If `radix` is not 2, 8, 10, or 16.
     */
    toString (radix = 10) {
      const negative = this.value < 0n
      let str = (negative ? -this.value : this.value).toString(radix)

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
          throw RangeError('toString() radix argument must be 2, 8, 10 or 16')
      }
      if (negative) {
        str = '-' + str
      }

      return str
    }

    /**
     * Toggle a bit by index.
     * @param {number} index The index of the bit to be toggled.
     */
    toggle (index) {
      this.value ^= 1n << BigInt(index)
    }

    /**
     * Set value of a field.
     * @param {number} index The index of the field, LSB is 0.
     * @param {number} width The width of the field.
     * @param {bigint} value Value of the field.
     */
    setField (index, width, value) {
      const bigIndex = BigInt(index)
      const bigWidth = BigInt(width)
      // zero field
      this.value &= ~(((1n << bigWidth) - 1n) << bigIndex)
      // fill field
      this.value |= (value & ((1n << bigWidth) - 1n)) << bigIndex
    }

    /**
     * Get value of a field.
     * @param {number} index The index of the field, LSB is 0.
     * @param {number} width The width of the field.
     * @returns {bigint} Value of the field.
     */
    getField (index, width) {
      const bigIndex = BigInt(index)
      const bigWidth = BigInt(width)
      return (this.value >> bigIndex) & ((1n << bigWidth) - 1n)
    }
  }

  /**
   * Represent a register value and its width.
   * @extends Value
   */
  class Register extends Value {
    /**
     * @param {number} [width=1] The width of the register.
     */
    constructor (width = 1) {
      super()
      /**
       * width of the register
       * @type {number}
       */
      this.width = width
    }

    /**
     * The minimum width to fully represent the register value.
     */
    get minWidth () {
      return this.unsigned.toString(2).length
    }

    /**
     * Return 2^`width`.
     */
    get expWidth () {
      return 1n << BigInt(this.width)
    }

    /**
     * The register value as an unsigned number.
     */
    get unsigned () {
      return new Value(this.value & (this.expWidth - 1n))
    }

    /**
     * The register value as a signed number.
     */
    get signed () {
      const expWidth = 1n << BigInt(this.width)
      const halfExpWidth = 1n << BigInt(this.width - 1)
      const value = this.value & (expWidth - 1n)
      return new Value(value >= halfExpWidth ? value - expWidth : value)
    }

    /**
     * Return the string representation of the register value with appropriate
     * prefix.
     * @param {number} [radix=10] The base to be used, affecting the prefix.
     * @param {boolean} [signed=false] If true, the register will be signed.
     * @returns {string} A string representing the value of this register.
     */
    toString (radix = 10, signed = false) {
      return (signed ? this.signed : this.unsigned).toString(radix)
    }

    /**
     * Return the binary representation of the register.
     * @returns {string} A binary string representing the register value,
     *  exactly `width` long.
     */
    dump () {
      return this.unsigned.value.toString(2).padStart(this.width, '0')
    }

    /**
     * Test if register can be treated as an IEEE754 float.
     * @returns {boolean} `true` if register can be treated as an IEEE754 float.
     */
    isFloat () {
      return this.width === 32 || this.width === 64
      //return this.width === 16 || this.width === 32 || this.width === 64 || this.width === 96
    }

    _checkFloat () {
      if (!this.isFloat()) {
        throw RangeError('width must be 16, 32, 64 or 96')
      }
    }

    /**
     * Interrupt a string as a float and update the Register with its IEEE754
     * format. The register width must be able to represent a float.
     * @param {string} str The string to be parsed.
     * @returns {boolean} `true` if parse succeeded.
     * @throws {RangeError} If the register width can not represent an IEEE754
     *  float.
     */
    parseFloat (str) {
      this._checkFloat()
      const value = parseFloat(str)
      if (isNaN(value)) {
        return false
      }

      const nbyte = this.width / 8
      const buf = new ArrayBuffer(nbyte)
      switch (nbyte) {
        //case 2:
          //new Uint16Array(buf)[0] = value
          //break
        case 4:
          new Float32Array(buf)[0] = value
          this.value = BigInt(new Uint32Array(buf)[0])
          break
        case 8:
          new Float64Array(buf)[0] = value
          this.value = BigInt(new BigUint64Array(buf)[0])
          break
        //case 12:
          //new Uint32Array(buf)[0] = value
          //break
      }
      return true
    }

    /**
     * Return the register value as an IEEE754 float.
     * @returns {number} The value of this register interrupted as an IEEE754
     *  float.
     * @throws {RangeError} If the register width can not represent an IEEE754
     *  float.
     */
    toFloat () {
      this._checkFloat()

      const nbyte = this.width / 8
      const buf = new ArrayBuffer(nbyte)
      const value = Number(this.unsigned)
      switch (nbyte) {
        //case 2:
          //new Uint16Array(buf)[0] = value
          //break
        case 4:
          new Uint32Array(buf)[0] = value
          return new Float32Array(buf)[0]
        case 8:
          new BigUint64Array(buf)[0] = value
          return new Float64Array(buf)[0]
        //case 12:
          //new Uint32Array(buf)[0] = value
          //break
      }
    }
  }

  const registerValue = {
    value: new Register,
    options,
    inputNotSynced: false,

    /**
     * @param {HTMLElement} output
     */
    toOutput (output) {
      let str = this.value.toString(this.options.radix, this.options.asSigned)
      if (this.options.asFloat && this.value.isFloat()) {
        str += ', ' + this.value.toFloat()
      }
      output.textContent = str + ' (' + this.value.toString(16) + ')'
    },

    /**
     * @param {HTMLElement} input
     * @param {boolean} force
     */
    toInput (input, force = false) {
      if (this.inputNotSynced && !force) {
        return
      }
      input.value = this.value.toString(this.options.radix)
      localStorage.setItem(this.options.storagePrefix + '-value', input.value)
    },

    /**
     * @param {HTMLElement} input
     * @param {HTMLElement} output
     */
    read (input, output) {
      const valueStr = input.value
      if (this.value.parse(valueStr, this.options.radix) || (
          this.options.asFloat && this.value.isFloat() &&
          this.value.parseFloat(valueStr))) {
        input.style.backgroundColor = ''
        this.inputNotSynced = false
        this.toOutput(output)
        return true
      }
      input.style.backgroundColor = this.options.colorError
      this.inputNotSynced = true
      return false
    },

    /**
     * @param {HTMLElement} initiator
     * @param {HTMLElement} table
     * @param {HTMLElement} output
     * @param {HTMLElement} input
     */
    changed (initiator, table, output, input) {
      this.toOutput(output)
      this.toInput(input)
      this.draw(initiator, table)
    },

    /**
     * @param {HTMLElement} initiator
     * @param {HTMLElement} table
     * @param {HTMLElement} output
     * @param {HTMLElement} input
     */
    toggle (initiator, table, output, input) {
      const index = Number(initiator.dataset.index)
      if (!index) {
        return
      }
      this.value.toggle(index)
      this.changed(initiator, table, output, input)
    },

    /**
     * @param {bigint} value
     * @param {HTMLElement} initiator
     * @param {HTMLElement} table
     * @param {HTMLElement} output
     * @param {HTMLElement} input
     */
    setField (value, initiator, table, output, input) {
      const dataset = initiator.parentElement.dataset
      const index = Number(dataset.index)
      if (!index) {
        return
      }
      const width = Number(dataset.width)
      if (!width) {
        return
      }
      this.value.setField(index, width, value)
      this.changed(initiator, table, output, input)
    },

    /**
     * @param {HTMLElement} initiator
     * @param {HTMLElement} table
     * @param {HTMLElement} output
     */
    draw (initiator, table, output = null) {
      if (this.value.width === 0) {
        return false
      }
      if (output && !this.read(initiator, output)) {
        return false
      }

      const tdsBitValue = table.querySelector('.bitfield-bits-value').children
      const valueBits = this.value.dump()
      for (let i = 0; i < tdsBitValue.length; i++) {
        tdsBitValue[i].textContent = valueBits[i]
      }

      const tdsFieldHex = table.querySelector('.bitfield-fields-hex').children
      for (let i = 0; i < tdsFieldHex.length; i++) {
        const td = tdsFieldHex[i]
        const div = td.firstElementChild
        if (!div || div === initiator) {
          continue
        }
        div.style.backgroundColor = ''
        const dataset = td.dataset
        div.textContent =
          (dataset.width > 1 ? '0x' : '') + this.value.getField(
            dataset.index, dataset.width).toString(16)
      }

      const tdsFieldEnum = table.querySelector('.bitfield-fields-enum').children
      for (let i = 0; i < tdsFieldEnum.length; i++) {
        const td = tdsFieldEnum[i]
        const select = td.firstElementChild
        if (!select || select === initiator) {
          continue
        }
        const dataset = td.dataset
        select.value =
          this.value.getField(dataset.index, dataset.width).toString()
      }

      return true
    }
  }

  /** @type {HTMLInputElement} */
  const inputValue = node.querySelector('.bitfield-value')
  /** @type {HTMLElement} */
  const outputValue = node.querySelector('.bitfield-value-output')
  /** @type {HTMLTableElement} */
  const table = node.querySelector('.bitfield-table')

  inputValue.addEventListener('input', function (event) {
    /** @type {HTMLInputElement} */
    const target = event.target
    if (!target.value.trim()) {
      target.style.backgroundColor = options.colorWarning
      registerValue.inputNotSynced = true
      return
    }
    localStorage.setItem(options.storagePrefix + '-value', target.value)
    registerValue.draw(target, table, outputValue)
  })
  // load value after format drawing

  /** @type {HTMLTableRowElement} */
  const trBitsValue = node.querySelector('.bitfield-bits-value')
  trBitsValue.addEventListener('click', function (event) {
    registerValue.toggle(event.target, table, outputValue, inputValue)
  })

  // radix & signedness
  initRadioInputs(
    node.querySelectorAll('input[name="radix"]'), function (event) {
      options.radix = parseInt(event.target.value)
      localStorage.setItem(options.storagePrefix + '-radix', options.radix)
      if (registerValue.inputNotSynced) {
        registerValue.draw(inputValue, table, outputValue)  // try re-parse
      } else {
        registerValue.toOutput(outputValue)
        registerValue.toInput(inputValue)
      }
    }, options.radix.toString())

  /** @type {HTMLInputElement} */
  const checkboxSigned = node.querySelector('input[name="signed"]')
  checkboxSigned.checked = options.asSigned
  checkboxSigned.addEventListener('change', function (event) {
    options.asSigned = event.target.checked
    localStorage.setItem(
      options.storagePrefix + '-signed', options.asSigned || '')
    registerValue.toOutput(outputValue)
  })

  /** @type {HTMLInputElement} */
  const checkboxFloat = node.querySelector('input[name="float"]')
  checkboxFloat.checked = options.asFloat
  checkboxFloat.addEventListener('change', function (event) {
    options.asFloat = event.target.checked
    localStorage.setItem(
      options.storagePrefix + '-float', options.asFloat || '')
    registerValue.toOutput(outputValue)
  })


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
     * @param {number} type Token type.
     * @param {string?} str Token string.
     * @param {number?} index Token index.
     */
    constructor (type, str, index) {
      this.type = type
      this.str = str
      this.index = index
    }

    /**
     * Test if token is of a given type or string.
     * @param {(number|string)} want Wanted token type or string.
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
     * @param {string} str Input string.
     */
    constructor (str) {
      /**
       * string buffer
       * @type {string}
       */
      this.buffer = str.replaceAll('\\\n', ' ').trimEnd()
      /**
       * buffer pointer, `-1` is EOF
       * @type {number}
       */
      this.i = 0
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
     * @param {number?} start
     *  The index to the beginning of the specified portion.
     * @param {number?} end
     *  The index to the end of the specified portion. The substring includes
     *  the characters up to, but not including, the character indicated by end.
     *  If this value is not specified, the substring continues to the end of
     *  `buffer`.
     * @returns {string} The specified portion of `buffer`.
     */
    slice (start, end) {
      return this.buffer.slice(start, end)
    }

    /**
     * Return next token.
     * @param {boolean} [prefetch=false]
     *  If true, do not increase the buffer pointer.
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
     * @param {string} [delim='\n'] Delimiter.
     * @returns {number} Index right before the first delim, or buffer length if
     *  not found.
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
    * @param {(number|string)} want Tokens to be consumed.
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
     * @param {boolean} [ignoreError=false]
     *  If true, do not increase the buffer pointer if token does not match.
     * @returns {Token?} Matched token or `null` if not found.
     */
    wantType (type, ignoreError = false) {
      return this._want(type, ignoreError, false)
    }

    /**
     * Test if next token is of given string.
     * @param {string} str String to match.
     * @param {boolean} [ignoreError=false]
     *  If true, do not increase the buffer pointer if token does not match.
     * @returns {Token?} Matched token or `null` if not found.
     */
    wantStr (str, ignoreError = false) {
      return this._want(str, ignoreError, true)
    }

    /**
     * Test if next token is of given type or string.
     * @param {string|number} grammar String or type to match.
     * @param {boolean} [ignoreError=false]
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
     * @param {(number|string)[]} grammars Grammars to be matched.
     * @param {boolean} [ignoreError=false]
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
   * @typedef EnumMap
   * @type {Map<string, bigint>}
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
     * @param {string} name Field name.
     * @param {number} width
     *  Field width. If 0, the field is a single bit indicator.
     * @param {number} index Field index, LSB is 0.
     * @param {string?} color Field background HTML color.
     * @param {string[]?} enumTypes Names of enum types to be used.
     */
    constructor (name, width, index, color, enumTypes) {
      /**
       * field name
       * @type {string}
       */
      this.name = name
      /**
       * field index
       * @type {number}
       */
      this.index = index
      /**
       * field width. If 0, the field is a single bit indicator
       * @type {number}
       */
      this.width = width
      /**
       * field background HTML color
       * @type {string?}
       */
      this.color = color
      /**
       * names of enum types to be used
       * @type {string[]?}
       */
      this.enumTypes = enumTypes
      /**
       * enum definitions
       * @type {Map<string, bigint>}
       */
      this.enums = new Map
    }

    /**
     * Convert a string to a Field object.
     * @param {string} str String to be parsed.
     * @param {number?} regWidth Register width, used to calculate field index.
     * @returns {Field?} Parsed field or `null` if parsing failed.
     */
    static fromString (str, regWidth) {
      let width, index
      let [name, strWidth, color, enumTypes] = str.split(':').map(x => x.trim())

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
        if (regWidth !== undefined) {
          index = regWidth - width
        }
      }
      return new Field(name, width, index, color,
                       enumTypes && enumTypes.split(',').map(x => x.trim()))
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
    /**
     * @param {Field[]?} fields
     * @param {Map<number, Field>?} bits
     * @param {Map<string?, EnumMap>?} enums
     */
    constructor (fields, bits, enums) {
      /** @type {Field[]} */
      this.fields = fields || []
      /** @type {Map<number, Field>} */
      this.bits = bits || new Map
      /** @type {Map<string?, EnumMap>} */
      this.enums = enums || new Map
      /** @type {number} */
      this.width = 0
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
            throw SyntaxError(
              'Cannot parse C macro as a numeric define at ' + lexer.i)
          }
          anomEnum.set(key, parseValue(value))
          // skip that line
          lexer.split()
        } else if (token.str === 'typedef') {
          // enum with typedef
          const [enumMap, enumClass] = parseEnum(lexer)
          if (!enumMap) {
            throw SyntaxError('Cannot parse a typedef at ' + lexer.i)
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
            throw SyntaxError('Cannot parse an enum at ' + lexer.i)
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
            throw SyntaxError('Cannot parse a field description at ' + lexer.i)
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

  /**
   * @param {HTMLInputElement | HTMLTextAreaElement} input
   * @returns {Format?}
   */
  function parseFormat (input) {
    const formatStr = input.value
    if (!formatStr) {
      input.style.backgroundColor = ''
      return null
    }

    let format
    try {
      format = Format.fromString(formatStr)
    } catch (e) {
      console.info('Parse error:', e)
      input.style.backgroundColor = options.colorError
      return null
    }

    if (format.isEmpty) {
      input.style.backgroundColor = options.colorWarning
      return null
    }
    input.style.backgroundColor = ''
    return format
  }

  /** @type {HTMLTableRowElement} */
  const trBitsIndex = node.querySelector('.bitfield-bits-index')
  /** @type {HTMLTableRowElement} */
  const trFieldsHex = node.querySelector('.bitfield-fields-hex')
  /** @type {HTMLTableRowElement} */
  const trFieldsName = node.querySelector('.bitfield-fields-name')
  /** @type {HTMLTableRowElement} */
  const trFieldsEnum = node.querySelector('.bitfield-fields-enum')
  /** @type {HTMLElement} */
  const labelFloat = node.querySelector('.bitfield-float-label')

  /**
   * Draw struct table and update register value.
   * @param {HTMLInputElement | HTMLTextAreaElement} inputFormat
   * @returns {boolean} `true` if draw success.
   */
  function drawFormat (inputFormat) {
    const format = parseFormat(inputFormat)
    if (!format) {
      return false
    }

    // save format
    registerValue.value.width = format.width
    localStorage.setItem(options.storagePrefix + '-format', inputFormat.value)

    // enable float support
    if (registerValue.value.isFloat()) {
      labelFloat.style.backgroundColor = ''
      checkboxFloat.disabled = false
    } else {
      labelFloat.style.backgroundColor = options.colorWarning
      checkboxFloat.disabled = true
    }

    // draw bits index and value
    trBitsIndex.textContent = ''
    trBitsValue.textContent = ''
    for (let i = format.width - 1; i >= 0; i--) {
      // bit index
      trBitsIndex.insertAdjacentHTML('beforeend', '<th>' + i + '</th>')

      // bit value
      let strThBitValue = '<td '
      const field = format.bits.get(i)
      if (field) {
        strThBitValue +=
          'class="bitfield-bits-named" title="' + field.name + '" '
        if (field.color) {
          strThBitValue += 'style="background:' + field.color + ';" '
        }
      }
      strThBitValue += 'data-index="' + i + '"></td>'
      trBitsValue.insertAdjacentHTML('beforeend', strThBitValue)
    }

    // draw fields name and hex
    let fieldsHaveEnums = false
    trFieldsHex.textContent = ''
    trFieldsName.textContent = ''
    for (let i = 0; i < format.fields.length; i++) {
      const field = format.fields[i]

      // field hex
      trFieldsHex.insertAdjacentHTML(
        'beforeend',
        '<td colspan="' + field.width + '" data-index="' + field.index +
        '" data-width="' + field.width + '"><div contenteditable></div></td>')

      // field name
      let strThFieldName = '<th colspan="' + field.width + '"'
      if (field.color) {
        strThFieldName += ' style="background-color:' + field.color + ';"'
      }
      strThFieldName += '></th>'
      trFieldsName.insertAdjacentHTML('beforeend', strThFieldName)
      trFieldsName.lastElementChild.textContent = field.name

      // prepare to draw enums
      if (field.enumTypes) {
        fieldsHaveEnums = true
      }
    }
    /** @type {NodeListOf<HTMLDivElement>} */
    const divs = trFieldsHex.querySelectorAll('div[contenteditable]')
    for (let i = 0; i < divs.length; i++) {
      divs[i].addEventListener('input', function (event) {
        /** @type {HTMLDivElement} */
        const target = event.target

        let value
        try {
          value = parseValue(target.textContent, options.radix)
        } catch (e) {
          if (!(e instanceof SyntaxError)) {
            throw e
          }
          target.style.backgroundColor = options.colorError
          return false
        }
        target.style.backgroundColor = ''

        registerValue.setField(value, target, table, outputValue, inputValue)
      })
    }

    // draw fields enum
    trFieldsEnum.textContent = ''
    if (fieldsHaveEnums) {
      for (let i = 0; i < format.fields.length; i++) {
        const field = format.fields[i]
        trFieldsEnum.insertAdjacentHTML(
          'beforeend',
          '<td colspan="' + field.width + '" data-index="' + field.index +
          '" data-width="' + field.width + '"></td>')
        if (field.enums.size === 0) {
          continue
        }
        const td = trFieldsEnum.lastElementChild
        td.innerHTML = '<select><option value=""></option></select>'
        const select = td.firstElementChild
        field.enums.forEach((value, key) => {
          const option = document.createElement('option')
          option.value = value
          option.textContent = '(0x' + value.toString(16) + ') ' + key
          select.appendChild(option)
        })
      }
      const selects = trFieldsEnum.querySelectorAll('select')
      for (let i = 0; i < selects.length; i++) {
        selects[i].addEventListener('change', function (event) {
          /** @type {HTMLSelectElement} */
          const target = event.target
          const valueStr = target.value
          if (!valueStr) {
            return
          }

          let value
          try {
            value = BigInt(valueStr)
          } catch {
            console.error(target, 'has option that do not has a valid value')
            return false
          }

          registerValue.setField(value, target, table, outputValue, inputValue)
        })
      }
    }

    registerValue.draw(inputValue, table, outputValue)
    return true
  }

  const oldValue = localStorage.getItem(options.storagePrefix + '-value')
  if (oldValue) {
    inputValue.value = oldValue
  } else {
    registerValue.toInput(inputValue, true)
  }

  /** @type {HTMLInputElement | HTMLTextAreaElement} */
  const inputFormat = node.querySelector('.bitfield-format')
  inputFormat.addEventListener('input', function (event) {
    drawFormat(event.target)
  })
  const oldFormat = localStorage.getItem(options.storagePrefix + '-format')
  if (oldFormat) {
    inputFormat.value = oldFormat
  }
  drawFormat(inputFormat)


  /********** k-v storage **********/

  /**
   * `LocalStorage` a `Map`.
   * @template V the value type
   * @extends {Map<string, V>}
   */
  class LocalMapStorage extends Map {
    /**
     * @param {string} name
     */
    constructor (name) {
      super(JSON.parse(localStorage.getItem(name)))
      this.name = name
    }

    store () {
      if (this.size) {
        localStorage.setItem(this.name, JSON.stringify(Array.from(this)))
      } else {
        localStorage.removeItem(this.name)
      }
    }

    /**
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
        this.store()
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
      this.store()
      return true
    }
  }

  /**
   * Manage K-V pairs in `LocalStorage` with `<select>` element.
   * @typeparam {V} the value type
   * @param {HTMLSelectElement} select The `<select>` element.
   * @param {string | Iterable<[string, V]>} keyOrData
   *  The key to `LocalStorage` or preloaded data. When preload data provided,
   *  reading/writing to `LocalStorage` will be disabled.
   * @param {HTMLElement} btnAdd
   *  The add button. Call `factory` for a new k-v pair.
   * @param {(this: btnAdd, event: Event) => [string, V]?} factory
   *  The function for a new k-v pair.
   * @param {HTMLElement} btnSelect
   *  The select button. Call `executor` for action.
   * @param {(this: btnSelect, value: V, key: string, event: Event) => void} executor
   *  The action when `select` button is clicked.
   * @param {HTMLElement} btnDelete The delete button.
   * @returns {Map<string, V>} The map of k-v pairs.
   */
  function kvStroageManage (
      select, keyOrData, btnAdd = null, factory = null,
      btnSelect = null, executor = null, btnDelete = null) {
    // load data
    /** @type {LocalMapStorage<V>} */
    const data = typeof keyOrData === 'string' ?
      new LocalMapStorage(keyOrData) : new Map(keyOrData)
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
      })
    }

    // bind btnAdd and btnDelete
    if (typeof keyOrData !== 'string') {
      const title = 'Disabled for preload list'
      if (btnAdd) {
        btnAdd.title = title
        btnAdd.disabled = true
      }
      if (btnDelete) {
        btnDelete.title = title
        btnDelete.disabled = true
      }
    } else {
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
        })
      }
      if (btnDelete) {
        btnDelete.addEventListener('click', function (event) {
          if (!select.value || !data.delete(select.value)) {
            return
          }
          select.selectedOptions[0].remove()
        })
      }
    }

    return data
  }

  // manage saved structs
  /** @type {HTMLInputElement} */
  const inputStructName = node.querySelector('.bitfield-struct-name')
  kvStroageManage(
    node.querySelector('.bitfield-struct-select'),
    options.preload || options.storagePrefix + '-structs-saved',
    node.querySelector('.bitfield-struct-save'), () => {
      if (!inputStructName.value) {
        inputStructName.style.backgroundColor = options.colorWarning
        return
      }
      if (!parseFormat(inputFormat)) {
        return
      }
      return [inputStructName.value, inputFormat.value]
    },
    node.querySelector('.bitfield-struct-load'), value => {
      inputFormat.value = value
      drawFormat(inputFormat)
    },
    node.querySelector('.bitfield-struct-delete'))
  if (options.preload) {
    inputStructName.disabled = true
    inputStructName.placeholder = 'Disabled for preload list'
  }

  // manage saved fields
  /** @type {HTMLInputElement} */
  const inputFieldDesc = node.querySelector('.bitfield-field-desc')
  kvStroageManage(
    node.querySelector('.bitfield-field-select'),
    options.storagePrefix + '-fields-saved',
    node.querySelector('.bitfield-field-add'), () => {
      if (!inputFieldDesc.value) {
        inputFieldDesc.style.backgroundColor = options.colorWarning
        return
      }
      const value = inputFieldDesc.value
      const field =
        !value.startsWith('#') && !value.startsWith('enum') &&
        !value.startsWith('typedef') && Field.fromString(value)
      if (!field) {
        inputFieldDesc.style.backgroundColor = options.colorError
        return
      }
      return [field.name, value]
    },
    node.querySelector('.bitfield-field-append'), value => {
      let format = inputFormat.value
      if (!format.endsWith('\n')) {
        format += '\n'
      }
      format += value
      inputFormat.value = format
      drawFormat(inputFormat)
    },
    node.querySelector('.bitfield-field-delete'))


  container.textContent = ''
  container.appendChild(node)
}
