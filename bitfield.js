'use strict'

const COLOR_ERROR = 'lightpink'
const COLOR_WARNING = 'lightyellow'


// global

let config = {
  /** default base to parse the input as */
  radix: parseInt(localStorage.getItem('bitfield-radix')) || 16,
  /** whether to treat value as signed data */
  signed: localStorage.getItem('bitfield-signed') === 'true',
  /** whether to interpret value as an IEEE754 float */
  float: localStorage.getItem('bitfield-float') === 'true',
  /** @type {Format} */
  format: undefined,
  value: undefined,
}

function escapeHtml (unsafe) {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
         .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
         .replaceAll("'", '&#039;')
}

/**
 * Convert a string to an integer, treat remaining characters as an error.
 * @param {string} string - A string to convert into a number.
 * @param {number} [radix=10]
 *  A value between 2 and 36 that specifies the base of the number in `string`.
 *  If this argument is not supplied, strings with a prefix of '0x' are
 *  considered hexadecimal. All other strings are considered decimal.
 * @returns {number} Parsed integer, or NaN if error.
 */
 function filterInt(value) {
  return /^[-+]?(\d+|Infinity)$/.test(value) ? Number(value) : NaN
}


// saved

/**
 * Manage select element using `LocalStorage`.
 * @typeparam {T} the type parameter
 * @typeparam {V} the return type of `executor`
 */
class LocalSaved {
  /**
   * @param {Element} select - The `<select>` element.
   * @param {string} name - The key to `LocalStorage`.
   * @param {[string, T][]?} preload
   *  Preloaded data. If set, reading/writing to `LocalStorage` will be
   *  disabled.
   */
  constructor (select, name, preload) {
    /**
     * the `<select>` element
     * @type {Element}
     */
    this.select = select
    /**
     * the key to `LocalStorage`
     * @type {string}
     */
    this.name = name
    /**
     * `true` if preloaded data is being used
     * @type {boolean}
     */
    this.readonly = preload !== undefined
    if (this.readonly) {
      /**
       * data for the select element
       * @type {[string, T][]}
       */
      this.data = preload
    } else {
      this.load()
    }
    this.prepare()

    /**
     * function for a new k/v pair when add button is clicked
     * @type {function(Event):[string, T]}
     * @default null
     */
    this.factory = null
    /**
     * action when select button is clicked
     * @type {function(T, string, LocalSaved):V}
     * @default null
     */
    this.executor = null
  }

  /**
   * Bind the add, select, and delete buttons, and `factory` and `executor`.
   * @param {Element} btnAdd - The add button. Will be disabled if `readonly`.
   * @param {function(Event):[string, T]} factory
   *  The function for a new k/v pair.
   * @param {Element} btnSelect - The select button.
   * @param {function(T, string, LocalSaved):V} executor
   *  The action when select button is clicked.
   * @param {Element} btnDelete
   *  The delete button. Will be disabled if `readonly`.
   */
  bind (btnAdd, factory, btnSelect, executor, btnDel) {
    this.executor = executor
    btnSelect.addEventListener('click', event => this.execute())

    if (this.readonly) {
      btnAdd.title = 'Disabled for preload list'
      btnDel.title = btnAdd.title
      btnAdd.disabled = true
      btnDel.disabled = true
    } else {
      this.factory = factory
      btnAdd.addEventListener('click', event => {
        let kv = this.factory(this)
        if (kv) {
          this.set(...kv)
        }
      })
      btnDel.addEventListener('click', event => {
        this.pop(this.selected)
      })
    }
  }

  /**
   * Call `executor` with the specified key and its value.
   * @param {string} key - The key.
   * @returns {V} The return value of `executor`, or `undefined` if
   *  `executor` is not set or `key` is not found.
   */
  execute (key) {
    if (!this.executor) {
      return undefined
    }
    if (key) {
      this.selected = key
      if (this.selected !== key) {
        return undefined
      }
    }
    let value = this.get(this.selected)
    if (value === undefined) {
      console.warn('LocalSaved: key not found: ', this.selected)
    }
    return this.executor(value, this.selected, this)
  }

  /**
   * Load data from `LocalStorage`.
   */
  load () {
    this.data = JSON.parse(localStorage.getItem(this.name))
    if (!this.data) {
      this.data = []
    }
  }

  /**
   * Save data to `LocalStorage`.
   */
  save () {
    if (!this.readonly) {
      localStorage.setItem(this.name, JSON.stringify(this.data))
    }
  }

  /**
   * Generate `<option>` to the key.
   * @param {string} key - The key.
   * @returns {string} The `<option>` element.
   */
  static toOption (key) {
    return '<option value="' + escapeHtml(key) + '">' + escapeHtml(key) +
           '</option>\n'
  }

  /**
   * Update the `<option>`s of `<select>` accroding to `data`.
   */
  prepare () {
    if (this.data) {
      this.select.innerHTML = this.data.reduce((accumulator, currentValue) =>
        accumulator + LocalSaved.toOption(currentValue[0]), '')
    }
  }

  /**
   * Return the selected key from `<select>`.
   * @type {string}
   */
  get selected () {
    return this.select.value
  }

  /**
   * Set the selected key of `<select>`. Does not check whether the key exists.
   * @param {string} key - The key to be selected.
   */
  set selected (value) {
    this.select.value = value
  }

  /**
   * Find the index of the key in `data`.
   * @param {string} key - The key to be found.
   * @returns {number} The index of the `key` in `data`, `-1` if not found.
   */
  findIndex (key) {
    return this.data.findIndex(x => x[0] === key)
  }

  /**
   * Save the key/value pair to `LocalStorage` and update the `<select>`
   * element.
   * @param {string} key - The key to be set.
   * @param {T} value - The value to be set.
   * @returns {boolean} `true` if the `key`/`value` is added/updated.
   */
  set (key, value) {
    let savedIndex = this.findIndex(key)
    if (savedIndex >= 0) {
      if (JSON.stringify(this.data[savedIndex]) ==
          JSON.stringify([key, value])) {
        return false
      }
      this.data[savedIndex] = [key, value]
    } else {
      this.data.push([key, value])
      this.select.innerHTML += LocalSaved.toOption(key)
    }
    this.save()
    return true
  }

  /**
   * Get the value of the key from `data`.
   * @param {string} key - The key to be found.
   * @returns {T?} The value of the `key`, `undefined` if not found.
   */
  get (key) {
    let savedIndex = this.findIndex(key)
    if (savedIndex < 0) {
      return undefined
    }
    return this.data[savedIndex][1]
  }

  /**
   * Remove the key/value pair from `LocalStorage` and update the `<select>`.
   * @param {string} key - The key to be removed.
   * @returns {T?} The value of the `key`, `undefined` if not found.
   */
  pop (key) {
    let savedIndex = this.findIndex(key)
    if (savedIndex < 0) {
      return undefined
    }
    let result = this.data[savedIndex][1]
    this.data.splice(savedIndex, 1)[0]
    this.prepare()
    this.save()
    return result
  }
}

const input_structName = document.getElementById('bitfield-struct-name')
const localSaved_struct = new LocalSaved(
  document.getElementById('bitfield-struct-select'), 'bitfield-structs-saved',
  preloadStructData
)
localSaved_struct.bind(
  document.getElementById('bitfield-struct-save'), () => {
    if (!parseFormat(input_format)) {
      return
    }
    if (!input_structName.value) {
      input_structName.style.backgroundColor = COLOR_ERROR
      return
    }
    input_structName.style.backgroundColor = ''
    return [input_structName.value, input_format.value]
  },
  document.getElementById('bitfield-struct-load'), value => {
    input_format.value = value
    drawFormat()
  },
  document.getElementById('bitfield-struct-delete'))
if (localSaved_struct.readonly) {
  input_structName.disabled = true
  input_structName.placeholder = 'Disabled for preload list'
}

const input_fieldDesc = document.getElementById('bitfield-field-desc')
const localSaved_select = new LocalSaved(
  document.getElementById('bitfield-field-select'), 'bitfield-fields-saved'
)
localSaved_select.bind(
  document.getElementById('bitfield-field-add'), () => {
    const format = parseFormat(input_fieldDesc)
    if (!format) {
      return
    }
    return [(format.fields[0] || format.bits.values().next().value).name,
            input_fieldDesc.value]
  },
  document.getElementById('bitfield-field-append'), value => {
    let format = input_format.value
    if (!format.endsWith('\n')) {
      format += '\n'
    }
    format += value
    input_format.value = format
    drawFormat()
  },
  document.getElementById('bitfield-field-delete'))


// value

/**
 * Convert a string to a bigint, based on its prefix.
 * @param {string} str - The string to be parsed.
 * @param {number} [radix=10]
 *  The default base to parse the string as, if no prefix found.
 * @returns {bigint?} Parsed value or `null` if error.
 */
function parseValue (str, radix = 10) {
  const negative = str[0] === '-'
  if (negative) {
    str = str.slice(1)
  }

  if (str[0] === '0') {
    // str has a prefix
    if (str.length > 1 && '0' <= str[1] && str[1] <= '9') {
      str = str.slice(1)
      str = '0o' + str
    }
  } else {
    switch (radix) {
      case 2:
        str = '0b' + str
        break
      case 8:
        str = '0o' + str
        break
      case 10:
        break
      case 16:
        str = '0x' + str
        break
      default:
        throw RangeError('radix argument must be 2, 8, 10, 16')
    }
  }

  let value
  try {
    value = BigInt(str)
  } catch (e) {
    return null
  }
  if (negative) {
    value = -value
  }
  return value
}

/**
 * Represent a register value.
 */
class Value {
  /**
   * @param {(bigint|number|string)} [value=0] - The value to be parsed.
   * @param {number} [radix=10]
   *  The default base to parse the string as, if no prefix found.
   */
  constructor (value = 0, radix = 10) {
    switch (typeof value) {
      case 'bigint':
      case 'number':
        this.value = BigInt(value)
        break
      case 'string':
        if (!this.parse(value, radix)) {
          throw SyntaxError('Cannot convert ' + value + ' to Value')
        }
        break
      default:
        throw TypeError('value must be a number, bigint or string')
    }
  }

  /**
   * Convert a string to bigint based on its prefix, and update the Value.
   * @param {string} str - The string to be parsed.
   * @param {number} [radix=10]
   *  The default base to parse the string as, if no prefix found.
   * @returns {boolean} `true` if parse succeeded.
   */
  parse (str, radix = 10) {
    const value = parseValue(str, radix)
    if (value === null) {
      return false
    }
    this.value = value
    return true
  }

  /**
   * Return the string representation of the value with appropriate prefix.
   * @param {number} [radix=10] - The base to be used, affecting the prefix.
   * @returns {string} A string representing this value.
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
   * @param {number} index - The index of the bit to be toggled.
   */
  toggle (index) {
    this.value ^= 1n << BigInt(index)
  }

  /**
   * Set value of a field.
   * @param {number} index - The index of the field, LSB is 0.
   * @param {number} width - The width of the field.
   * @param {bigint} value - Value of the field.
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
   * @param {number} index - The index of the field, LSB is 0.
   * @param {number} width - The width of the field.
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
   * @param {number} [width=1] - The width of the register.
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
   * 2^`width`
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
   * @param {number} [radix=10] - The base to be used, affecting the prefix.
   * @param {boolean} [signed=false] - If true, the register will be signed.
   * @returns {string} A string representing the value of this register.
   */
  toString (radix = 10, signed = false) {
    return (signed ? this.signed : this.unsigned).toString(radix)
  }

  /**
   * Return the binary representation of the register.
   * @returns {string} A binary string representing the register value, exactly
   *  `width` long.
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
   * @param {string} str - The string to be parsed.
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

const tr_bitsValue = document.getElementById('bitfield-bits-value')
const tr_fieldsHex = document.getElementById('bitfield-fields-hex')
const tr_fieldsEnum = document.getElementById('bitfield-fields-enum')

config.value = {
  register: new Register,
  inputNotSynced: false,

  inputForm: document.getElementById('bitfield-value'),
  _span_value: document.getElementById('bitfield-value-output'),

  toSpan: function () {
    let str = this.register.toString(config.radix, config.signed)
    if (config.float && this.register.isFloat()) {
      str += ', ' + this.register.toFloat()
    }
    this._span_value.innerText = str + ' (' + this.register.toString(16) + ')'
  },

  toInput: function () {
    if (this.inputNotSynced) {
      return
    }
    this.inputForm.value = this.register.toString(config.radix)
    localStorage.setItem('bitfield-value', this.inputForm.value)
  },

  read: function () {
    if ((config.float && this.register.isFloat() &&
         this.inputForm.value.includes('.') &&
         this.register.parseFloat(this.inputForm.value)) ||
        this.register.parse(this.inputForm.value, config.radix)) {
      this.inputForm.style.backgroundColor = ''
      this.inputNotSynced = false
      this.toSpan()
      return true
    }
    this.inputForm.style.backgroundColor = COLOR_ERROR
    this.inputNotSynced = true
    return false
  },

  changed: function (initiator) {
    this.toSpan()
    this.toInput()
    this.draw(initiator)
  },

  toggle: function (index, initiator) {
    this.register.toggle(index)
    this.changed(initiator)
  },

  setField: function (index, width, value, initiator) {
    this.register.setField(index, width, value)
    this.changed(initiator)
  },

  draw: function (initiator) {
    if (this.register.width === 0) {
      return false
    }
    // if no initiator, try to read input
    if (!initiator && !this.read()) {
      return false
    }

    const tds_fieldHex = tr_fieldsHex.children
    const tds_fieldEnum = tr_fieldsEnum.children
    for (let i = 0; i < tds_fieldHex.length; i++) {
      const td_fieldHex = tds_fieldHex[i]
      const div_fieldHex = td_fieldHex.children[0]
      if (div_fieldHex && div_fieldHex !== initiator) {
        div_fieldHex.style.backgroundColor = ''
        const fieldDataset = td_fieldHex.dataset
        div_fieldHex.innerText =
          (fieldDataset.width > 1 ? '0x' : '') + this.register.getField(
            fieldDataset.index, fieldDataset.width).toString(16)
      }

      const td_fieldEnum = tds_fieldEnum[i]
      if (td_fieldEnum) {
        const select_fieldEnum = td_fieldEnum.children[0]
        if (select_fieldEnum && select_fieldEnum !== initiator) {
          const fieldDataset = td_fieldEnum.dataset
          const fieldValue = this.register.getField(
            fieldDataset.index, fieldDataset.width)
          select_fieldEnum.value = fieldValue
          if (select_fieldEnum.value === fieldValue) {
            select_fieldEnum.value = ''
          }
        }
      }
    }

    const tds_bitsValue = tr_bitsValue.children
    const valueBits = this.register.dump()
    for (let i = 0; i < tds_bitsValue.length; i++) {
      tds_bitsValue[i].innerText = valueBits[i]
    }

    return true
  }
}

config.value.inputForm.addEventListener('input', function (event) {
  if (!event.target.value.trim()) {
    event.target.style.backgroundColor = COLOR_WARNING
    config.value.inputNotSynced = true
    return
  }
  localStorage.setItem('bitfield-value', event.target.value)
  config.value.draw()
})
// load value after format drawing

tr_bitsValue.addEventListener('click', function (event) {
  if (event.target.dataset.index) {
    config.value.toggle(event.target.dataset.index, event.target)
  }
})

// radix & signedness
function initRadixInput (radios, callback, initialValue) {
  for (let i = 0; i < radios.length; i++) {
    let radio = radios[i]
    radio.addEventListener('change', callback)
    if (radio.value === initialValue) {
      radio.checked = true
    }
  }
}

initRadixInput(
  document.querySelectorAll('input[type=radio][name="radix"]'),
  function (event) {
    config.radix = parseInt(event.target.value)
    localStorage.setItem('bitfield-radix', config.radix)
    if (config.value.inputNotSynced) {
      config.value.draw()  // try re-parse
    } else {
      config.value.toInput()
      config.value.toSpan()
    }
  }, config.radix)

const input_signed = document.getElementById('bitfield-signed')
input_signed.checked = config.signed
input_signed.addEventListener('change', function (event) {
  config.signed = event.target.checked
  localStorage.setItem('bitfield-signed', config.signed)
  config.value.toSpan()
})

const input_float = document.getElementById('bitfield-float')
input_float.checked = config.float
input_float.addEventListener('change', function (event) {
  config.float = event.target.checked
  localStorage.setItem('bitfield-float', config.float)
  config.value.toSpan()
})


// format

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
   * @param {number} type - Token type.
   * @param {string?} str - Token string.
   * @param {number?} index - Token index.
   */
  constructor (type, str, index) {
    this.type = type
    this.str = str
    this.index = index
  }

  /**
   * Test if token is of a given type or string.
   * @param {(number|string)} want - Wanted token type or string.
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
   * @param {string} str - Input string.
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
   *  The index to the end of the specified portion. The substring includes the
   *  characters up to, but not including, the character indicated by end.
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
   * @param {string} [delim='\n'] - Delimiter.
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
   * @param {(number|string)} want - Tokens to be consumed.
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
   * @param {number} type - Token type to match.
   * @param {boolean} [ignoreError=false]
   *  If true, do not increase the buffer pointer if token does not match.
   * @returns {Token?} Matched token or `null` if not found.
   */
  wantType (type, ignoreError = false) {
    return this._want(type, ignoreError, false)
  }

  /**
   * Test if next token is of given string.
   * @param {string} str - String to match.
   * @param {boolean} [ignoreError=false]
   *  If true, do not increase the buffer pointer if token does not match.
   * @returns {Token?} Matched token or `null` if not found.
   */
  wantStr (str, ignoreError = false) {
    return this._want(str, ignoreError, true)
  }

  /**
   * Test if next token is of given type or string.
   * @param {string|number} grammar - String or type to match.
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
   * @param {(number|string)[]} grammars - Grammars to be matched.
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
 * @property {string} [0] - enum name
 * @property {bigint} [1] - enum value
 */

/**
 * Parse C-like enum definition.
 * @param {CLexer} lexer
 * @returns {EnumMap?}
 */
 function parseEnum (lexer) {
  if (!lexer.wantStr('enum')) {
    return null
  }

  /** @type {EnumMap} */
  const result = new Map
  /** @type {Token} */
  let token = lexer.next()
  if (token.type === Token.IDENTIFIER) {
    result.name = token.str
    token = lexer.next()
  }
  if (token.str !== '{') {
    return null
  }

  let counter = 0n
  while (!lexer.exhaust(',')) {
    token = lexer.next()
    if (token.str === '}') {
      break
    }

    if (token.type !== Token.IDENTIFIER && token.type !== Token.STRING) {
      return null
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
      return null
    }

    token = lexer.next()
    if (token.type !== Token.NUMERIC) {
      return null
    }
    const value = parseValue(token.str)
    if (value === null) {
      return null
    }
    result.set(key, value)
    counter = value + 1n
  }

  return result
}

/**
 * Represent a bit field.
 */
class Field {
  /**
   * @param {string} name - Field name.
   * @param {number} width
   *  Field width. If 0, the field is a single bit indicator.
   * @param {number} index - Field index, LSB is 0.
   * @param {string?} color - Field background HTML color.
   * @param {string[]?} enumTypes - Names of enum types to be used.
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
   * @param {string} str - String to be parsed.
   * @param {number?} regWidth - Register width, used to calculate field index.
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
      index = filterInt(strWidth.slice(1))
      if (isNaN(index)) {
        return null
      }
      width = 0
    } else {
      // field
      width = filterInt(strWidth)
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
   * @type {boolean}
   */
  get isBit () {
    return this.width === 1
  }

  static compareFunc (self, other) {
    return other.index - self.index
  }

  /**
   * Collect enum definitions of `enumTypes` from `enums`.
   * @param {Map<string?, EnumMap>} enums - Enum definitions.
   */
  collectEnums (enums) {
    if (!this.enumTypes || this.enumTypes.length === 0) {
      return
    }
    // first, collect #define s
    const anomEnum = enums.get(null)
    if (anomEnum) {
      anomEnum.forEach((value, key) => {
        for (let i = 0; i < this.enumTypes.length; i++) {
          if (key.toUpperCase().startsWith(this.enumTypes[i])) {
            this.enums.set(key, value)
            break
          }
        }
      })
    }
    // then, (possibly) override with enum s
    for (let i = 0; i < this.enumTypes.length; i++) {
      const enumObj = enums.get(this.enumTypes[i])
      if (enumObj) {
        enumObj.forEach((value, key) => this.enums.set(key, value))
      }
    }
  }
}

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

  isEmpty () {
    return this.fields.length === 0 && this.bits.size === 0
  }

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
 * @param {Element} element
 */
function parseFormat (element) {
  const lexer = new CLexer(element.value)
  if (!lexer.buffer) {
    element.style.backgroundColor = ''
    return null
  }

  const format = new Format
  /** @type {EnumMap} */
  const anomEnum = new Map
  format.enums.set(null, anomEnum)

  let parseError = false

  // main loop parse enums
  while (true) {
    const token = lexer.next()
    if (token.type === Token.EOF) {
      break
    } else if (token.str === '#') {
      // single-line define
      let [_, key, value] = lexer.match([
        'define', Token.IDENTIFIER, Token.NUMERIC])
      if (!value) {
        parseError = true
        break
      }
      value = parseValue(value)
      if (value === null) {
        parseError = true
        break
      }
      anomEnum.set(key, value)
      // skip that line
      lexer.split()
    } else if (token.str === 'typedef') {
      // enum with typedef
      const enumMap = parseEnum(lexer)
      if (!enumMap) {
        parseError = true
        break
      }

      token = lexer.wantType(Token.IDENTIFIER)
      if (token) {
        format.enums.set(token.str, enumMap)
      } else if (enumMap.name) {
        format.enums.set(enumMap.name, enumMap)
      } else {
        enumMap.forEach((value, key) => anomEnum.set(key, value))
      }

      lexer.exhaust(';')
    } else if (token.str === 'enum') {
      // enum without typedef
      lexer.i = token.index
      const enumMap = parseEnum(lexer)
      if (!enumMap) {
        parseError = true
        break
      }
      if (enumMap.name) {
        format.enums.set(enumMap.name, enumMap)
      } else {
        enumMap.forEach((value, key) => anomEnum.set(key, value))
      }

      lexer.exhaust(';')
    } else {
      // field
      const field = Field.fromString(lexer.slice(token.index, lexer.split()))
      if (!field) {
        parseError = true
        break
      }
      if (field.width === 0) {
        format.bits.set(field.index, field)
      } else {
        format.fields.push(field)
      }
    }
  }

  if (parseError) {
    element.style.backgroundColor = COLOR_ERROR
    return null
  }
  if (format.isEmpty()) {
    element.style.backgroundColor = COLOR_WARNING
    return null
  }
  element.style.backgroundColor = ''
  format.postfix()
  return format
}

const input_format = document.getElementById('bitfield-format')
const tr_bits = document.getElementById('bitfield-bits')
const tr_fields = document.getElementById('bitfield-fields')
const label_float = document.querySelector('label[for="bitfield-float"]')

function drawFormat () {
  const format = parseFormat(input_format)
  if (!format) {
    return
  }
  config.format = format
  config.value.register.width = format.width
  localStorage.setItem('bitfield-format', input_format.value)

  label_float.style.backgroundColor =
    config.value.register.isFloat() ? '' : COLOR_WARNING

  let tr_bitsValue_html = ''
  let tr_bits_html = ''
  for (let i = 0; i < config.format.width; i++) {
    // bits header
    let index = config.format.width - i - 1
    tr_bits_html += '<th>' + index + '</th>\n'

    // data, bits
    tr_bitsValue_html += '<td '
    let field = config.format.bits.get(index)
    if (field) {
      tr_bitsValue_html +=
        'class="bitfield-bits-named" style="background:' +
        field.color + ';" title="' + field.name + '"'
    }
    tr_bitsValue_html += 'data-index="' + index + '"></td>\n'
  }
  tr_bits.innerHTML = tr_bits_html
  tr_bitsValue.innerHTML = tr_bitsValue_html

  let tr_fieldsHex_html = ''
  let tr_fields_html = ''
  let fieldsHaveEnums = false
  for (let i = 0; i < config.format.fields.length; i++) {
    let field = config.format.fields[i]

    // data, fields
    tr_fieldsHex_html +=
      '<td colspan="' + field.width + '" data-index="' + field.index +
      '" data-width="' + field.width + '"><div contenteditable></div></td>\n'

    // fields
    tr_fields_html += '<th colspan="' + field.width + '"'
    if (field.color) {
      tr_fields_html += 'style="background-color:' + field.color + ';"'
    }
    tr_fields_html += '>' + escapeHtml(field.name) + '</th>\n'

    // prepare enums
    if (field.enumTypes) {
      fieldsHaveEnums = true
    }
  }
  tr_fieldsHex.innerHTML = tr_fieldsHex_html
  tr_fields.innerHTML = tr_fields_html
  Array.prototype.forEach.call(
    tr_fieldsHex.querySelectorAll('div[contenteditable]'),
    element => element.addEventListener('input', event => {
      let fieldValue = parseValue(event.target.innerText, config.radix)
      if (fieldValue === null) {
        event.target.style.backgroundColor = COLOR_ERROR
        return
      }
      event.target.style.backgroundColor = ''

      const fieldDataset = event.target.parentElement.dataset
      if (fieldDataset.width > 0) {
        config.value.setField(fieldDataset.index, fieldDataset.width,
                              fieldValue, event.target)
      }
    }))

  // data, enums
  let tr_fieldsEnum_html = ''
  if (fieldsHaveEnums) {
    for (let i = 0; i < config.format.fields.length; i++) {
      let field = config.format.fields[i]
      tr_fieldsEnum_html +=
        '<td colspan="' + field.width + '" data-index="' + field.index +
        '" data-width="' + field.width + '">'
      if (field.enums.size !== 0) {
        tr_fieldsEnum_html +=
          '<select alt="' + field.enumTypes.map(escapeHtml).join(', ') +
          '"><option value=""></option>'
        field.enums.forEach((value, key) => {
          tr_fieldsEnum_html +=
            '<option value="' + value + '">(0x' + value.toString(16) + ') ' +
            escapeHtml(key) + '</option>'
        })
        tr_fieldsEnum_html += '</select>'
      }
      tr_fieldsEnum_html += '</td>\n'
    }
  }
  tr_fieldsEnum.innerHTML = tr_fieldsEnum_html
  if (fieldsHaveEnums) {
    Array.prototype.forEach.call(
      tr_fieldsEnum.querySelectorAll('select'),
      element => element.addEventListener('change', event => {
        if (!event.target.value) {
          return
        }

        let value
        try {
          value = BigInt(event.target.value)
        } catch (e) {
          console.error(event.target,
                        'has option that do not has a valid value')
          return
        }

        let fieldDataset = event.target.parentElement.dataset
        if (fieldDataset.width > 0) {
          config.value.setField(fieldDataset.index, fieldDataset.width,
                                value, event.target)
        }
      }))
  }

  config.value.draw()
}

input_format.addEventListener('input', function (event) {
  drawFormat()
})
const oldFormat = localStorage.getItem('bitfield-format')
if (oldFormat) {
  input_format.value = oldFormat
}
drawFormat()

config.value.inputForm.value = 0
config.value.draw()
const oldValue = localStorage.getItem('bitfield-value')
if (oldValue) {
  config.value.inputForm.value = oldValue
  config.value.draw()
}
