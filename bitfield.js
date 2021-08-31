'use strict'

const COLOR_ERROR = 'lightpink'
const COLOR_WARNING = 'lightyellow'


// global

let config = {
  radix: parseInt(localStorage.getItem('bitfield-radix')),
  enums: new Map,
  fields: [],
  bits: new Map,
  signed: localStorage.getItem('bitfield-signedness') === 'true',
  value: undefined,
}
if (!config.radix) {
  config.radix = 16
}

class TwoWayMap extends Map {
  constructor (iterable) {
    super(iterable)
    this.reverseMap = new Map
    this.forEach((value, key) => {
      if (this.reverseMap.has(value)) {
        this.delete(key)
      } else {
        this.reverseMap.set(value, key)
      }
    })
  }

  reverseGet (key) {
    return this.reverseMap.get(key)
  }

  set (key, value) {
    if (this.reverseMap.has(value)) {
      this.delete(this.reverseMap.get(value))
    }
    this.reverseMap.delete(super.get(key))
    this.reverseMap.set(value, key)
    return super.set(key, value)
  }

  delete (key) {
    this.reverseMap.delete(this.get(key))
    return super.delete(key)
  }

  clear () {
    this.reverseMap.clear()
    return super.clear()
  }
}

function parseValue (str, radix = 10) {
  if (str.indexOf('.') >= 0) {
    return NaN
  }

  let sign = 1
  if (str[0] === '-') {
    sign = -1
    str = str.slice(1)
  }
  if (str[0] === '0') {
    switch (str[1]) {
      case 'x':
        radix = 16
        break
      case 'b':
        radix = 2
        str = str.slice(2)
        break
      default:
        radix = 8
    }
  }
  return sign * parseInt(str, radix)
}

function toRadix (value, radix = 10) {
  let sign = Math.sign(value)
  value = parseInt(Math.abs(value)).toString(radix)
  switch (radix) {
    case 2:
      value = '0b' + value
      break
    case 8:
      value = '0' + value
      break
    case 16:
      value = '0x' + value
      break
  }
  if (sign < 0) {
    value = '-' + value
  }
  return value
}

function twosComplement (value, width) {
  let valueBits = (
    value >= 0 ? value : ((1 << ((-value).toString(2).length + 1)) + value)
  ).toString(2)

  if (width) {
    if (valueBits.length > width) {
      valueBits = valueBits.slice(valueBits.length - width)
    } else if (valueBits.length < width) {
      valueBits =
        Array(width - valueBits.length).fill(value < 0 ? 1 : 0).join('') +
        valueBits
    }
  }

  return valueBits
}

function splitOnce (str, delim = '\n') {
  let index = str.indexOf(delim)
  if (index < 0) {
    index = str.length
  }
  return [str.slice(0, index), str.slice(index + 1)]
}

const TOKEN_EOF = 0;
const TOKEN_IDENTIFIER = 1;
const TOKEN_STRING = 2;
const TOKEN_CHAR = 3;
const TOKEN_NUMERIC = 4;
const TOKEN_OPERATOR = 5;

function nextToken (str) {
  let oldStr
  do {
    oldStr = str
    str = str.trimLeft()
    if (str.startsWith('\\')) {
      str = str.slice(2)
    }
    if (str.startsWith('//')) {
      str = splitOnce(str.slice(2))[1]
    }
    if (str.startsWith('/*')) {
      str = splitOnce(str.slice(2), '*/')[1]
    }
  } while (oldStr !== str)

  if (!str) {
    return ['', str, TOKEN_EOF]
  }

  if (str[0] === '"' || str[0] === "'") {
    let indexLiteralEnd = str.indexOf(str[0], 1)
    return [
      str.slice(0, indexLiteralEnd + 1), str.slice(indexLiteralEnd + 1),
      str[0] === '"' ? TOKEN_STRING : TOKEN_CHAR
    ]
  }

  const OPERATORS = '+-*/%=<>!~&|^;,.?:()[]{}#'
  for (let i = 0; i < OPERATORS.length; i++) {
    if (str[0] === OPERATORS[i]) {
      return [str[0], str.slice(1), TOKEN_OPERATOR]
    }
  }

  let tokenType =
    '0'.charCodeAt(0) <= str[0].charCodeAt(0) &&
      str[0].charCodeAt(0) <= '9'.charCodeAt(0) ?
    TOKEN_NUMERIC : TOKEN_IDENTIFIER;
  let indexNumberEnd = str.search(/[^a-zA-Z0-9_]/)
  return indexNumberEnd < 0 ?
    [str, '', tokenType] :
    [str.slice(0, indexNumberEnd), str.slice(indexNumberEnd), tokenType]
}

function wantGrammar (str, grammar) {
  let result = []
  let errmsg
  for (let i = 0; i < grammar.length; i++) {
    let token, tokenType
    [token, str, tokenType] = nextToken(str)
    let wantToken = grammar[i]
    if (typeof wantToken[0] === 'string' ?
        wantToken[0] !== token : wantToken[0] !== tokenType) {
      errmsg = ['want', wantToken[0], ', got', token, 'with type', tokenType]
      break
    }
    if (wantToken[1]) {
      result.push(token)
    }
  }
  return [result, str, errmsg]
}

function exhaustRepeatTokens (str, wantToken) {
  let token, tokenType
  while (true) {
    let newStr
    [token, newStr, tokenType] = nextToken(str)
    if (token !== wantToken) {
      break
    }
    str = newStr
  }
  return str
}

function parseEnum (str) {
  const result = new Map
  let enumType
  let counter = 0
  let token, tokenType
  let newStr

  str = str.trimLeft();

  [token, str, tokenType] = nextToken(str)
  if (token !== 'enum') {
    return []
  }

  [token, str, tokenType] = nextToken(str)
  if (tokenType === TOKEN_IDENTIFIER) {
    enumType = token;
    [token, str, tokenType] = nextToken(str)
  }
  if (token !== '{') {
    return []
  }

  while (true) {
    str = exhaustRepeatTokens(str, ',');

    [token, newStr, tokenType] = nextToken(str)
    if (token === '}') {
      str = newStr
      break
    }

    let key, value

    [key, str, tokenType] = nextToken(str)
    if (tokenType !== TOKEN_IDENTIFIER && tokenType !== TOKEN_STRING) {
      return []
    }
    result.set(key, counter)
    counter++

    [token, newStr, tokenType] = nextToken(str)
    if (tokenType === TOKEN_IDENTIFIER || tokenType === TOKEN_STRING) {
      continue
    }
    str = newStr
    if (token === '}') {
      break
    }
    if (token === ',') {
      continue
    }
    if (token !== '=') {
      return []
    }

    [value, str, tokenType] = nextToken(str)
    value = parseValue(value)
    if (tokenType !== TOKEN_NUMERIC || isNaN(value)) {
      return []
    }
    result.set(key, value)
    counter = value + 1
  }

  return [result, enumType, str]
}

function extractField (value, index, width) {
  return (value >> index) & ((1 << width) - 1)
}

function escapeHtml (unsafe) {
  return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
         .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
         .replaceAll("'", '&#039;')
}

function initRadixInput (radios, callback, initialValue) {
  for (let i = 0; i < radios.length; i++) {
    let radio = radios[i]
    radio.addEventListener('change', callback)
    if (radio.value === initialValue) {
      radio.checked = true
    }
  }
}


// saved

class LocalSaved {
  constructor (select, name, preload) {
    this.select = select
    this.name = name
    this.readonly = preload !== undefined
    if (this.readonly) {
      this.data = preload
    } else {
      this.load()
    }
    this.prepare()

    this.factory = null
    this.executor = null
  }

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

  execute (key) {
    if (!this.executor) {
      return
    }
    if (key) {
      this.selected = key
      if (this.selected !== key) {
        return
      }
    }
    let value = this.get(this.selected)
    if (value === undefined) {
      console.warn('LocalSaved: key not found: ', this.selected)
    }
    this.executor(value, this.selected, this)
  }

  load () {
    this.data = JSON.parse(localStorage.getItem(this.name))
    if (!this.data) {
      this.data = []
    }
  }

  save () {
    if (!this.readonly) {
      localStorage.setItem(this.name, JSON.stringify(this.data))
    }
  }

  static toOption (key) {
    return '<option value="' + escapeHtml(key) + '">' + escapeHtml(key) +
           '</option>\n'
  }

  prepare () {
    if (this.data) {
      this.select.innerHTML = this.data.reduce((accumulator, currentValue) =>
        accumulator + LocalSaved.toOption(currentValue[0]), '')
    }
  }

  get selected () {
    return this.select.value
  }

  set selected (value) {
    this.select.value = value
  }

  findIndex (key) {
    return this.data.findIndex(x => x[0] === key)
  }

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

  get (key) {
    let savedIndex = this.findIndex(key)
    if (savedIndex < 0) {
      return
    }
    return this.data[savedIndex][1]
  }

  pop (key) {
    let savedIndex = this.findIndex(key)
    if (savedIndex < 0) {
      return
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
    let [width, fields, bits] = parseFormat(input_fieldDesc)
    if (!fields) {
      fields = bits
    }
    if (!width || !fields[0][0]) {
      return
    }
    return [fields[0][0], input_fieldDesc.value]
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

const tr_bitsValue = document.getElementById('bitfield-bits-value')
const tr_fieldsHex = document.getElementById('bitfield-fields-hex')
const tr_fieldsEnum = document.getElementById('bitfield-fields-enum')

config.value = {
  value: 0,
  width: 0,
  inputNotSynced: false,

  inputForm: document.getElementById('bitfield-value'),
  _span_value: document.getElementById('bitfield-value-output'),

  toSpan: function () {
    this._span_value.innerText =
      (config.signed && this.value > 0 && (1 << (this.width - 1)) & this.value ?
       this.value - (1 << this.width) : this.value) + ' (' + toRadix(
        this.value >= 0 ? this.value : this.value + (1 << this.width), 16) + ')'
  },

  read: function () {
    let value = parseValue(this.inputForm.value, config.radix)
    if (isNaN(value)) {
      this.inputForm.style.backgroundColor = COLOR_ERROR
      this.inputNotSynced = true
    } else {
      this.inputForm.style.backgroundColor = ''
      this.inputNotSynced = false
      this.value = value
      this.toSpan()
    }
    return value
  },

  toInput: function () {
    if (this.inputNotSynced) {
      return
    }
    let value = toRadix(this.value, config.radix)
    this.inputForm.value = value
    if (this.inputForm.dataset.structName) {
      this.inputForm.value += ', ' + this.inputForm.dataset.structName
    }
    localStorage.setItem('bitfield-value', this.inputForm.value)
  },

  set: function (value, initiator) {
    this.value = value
    this.toInput()
    this.draw(initiator)
  },

  toggle: function (index, initiator) {
    this.set(this.value ^ (1 << index), initiator)
  },

  setField: function (value, index, width, initiator) {
    let newValue = this.value
    // zero field
    newValue &= ~(((1 << width) - 1) << index)
    // fill field
    newValue |= (value & ((1 << width) - 1)) << index
    this.set(newValue, initiator)
  },

  draw: function (initiator) {
    if (!this.width) {
      return
    }
    let value = initiator ? this.value : this.read()
    if (isNaN(value)) {
      return
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
          (fieldDataset.width > 1 ? '0x' : '') + extractField(
            value, fieldDataset.index, fieldDataset.width).toString(16)
      }

      const td_fieldEnum = tds_fieldEnum[i]
      if (td_fieldEnum) {
        const select_fieldEnum = td_fieldEnum.children[0]
        if (select_fieldEnum && select_fieldEnum !== initiator) {
          const fieldDataset = td_fieldEnum.dataset
          const fieldValue = extractField(
            value, fieldDataset.index, fieldDataset.width)
          select_fieldEnum.value = fieldValue
          if (select_fieldEnum.value === fieldValue) {
            select_fieldEnum.value = ''
          }
        }
      }
    }

    const tds_bitsValue = tr_bitsValue.children
    let valueBits = twosComplement(value, this.width)
    for (let i = 0; i < tds_bitsValue.length; i++) {
      tds_bitsValue[i].innerText = valueBits[i]
    }
  }
}

config.value.inputForm.addEventListener('input', function (event) {
  let [value, structName] = event.target.value.split(',').map(x => x.trim())
  if (!value) {
    event.target.style.backgroundColor = COLOR_WARNING
    config.value.inputNotSynced = true
    return
  }
  event.target.dataset.structName = structName || ''
  localStorage.setItem('bitfield-value', event.target.value)
  if (structName) {
    localSaved_struct.execute(structName)
  }
  config.value.draw()
})
const oldValue = localStorage.getItem('bitfield-value')
if (oldValue) {
  config.value.inputForm.value = oldValue
  config.value.draw()
}

tr_bitsValue.addEventListener('click', function (event) {
  if (event.target.dataset.index) {
    config.value.toggle(event.target.dataset.index)
  }
})


// radix & signedness
initRadixInput(
  document.querySelectorAll('input[type=radio][name="radix"]'),
  function (event) {
    config.radix = parseInt(event.target.value)
    localStorage.setItem('bitfield-radix', config.radix)
    if (config.value.inputNotSynced) {
      config.value.draw()  // try re-parse
    } else {
      config.value.toInput()
    }
  }, config.radix)
initRadixInput(
  document.querySelectorAll('input[type=radio][name="signedness"]'),
  function (event) {
    config.signed = event.target.value === 'signed'
    localStorage.setItem('bitfield-signedness', config.signed)
    config.value.toSpan()
  }, config.signed ? 'signed' : 'unsigned')


// format

class Field {
  constructor (name, width, index, color, enumTypes) {
    this.name = name
    this.index = index
    this.width = width
    this.color = color
    this.enumTypes = enumTypes
    this.enums = new Map
  }

  static fromString (str, regWidth) {
    let index
    let [name, width, color, enumTypes] = str.split(':').map(x => x.trim())

    if (!width) {
      width = 1
    } else if ('0'.charCodeAt(0) > width.charCodeAt(0) ||
               width.charCodeAt(0) > '9'.charCodeAt(0) ) {
      index = parseInt(width.slice(1))
      if (isNaN(index)) {
        return
      }
      width = 0
    } else {
      width = parseInt(width)
      if (isNaN(width)) {
        return
      }
      if (regWidth !== undefined) {
        index = regWidth - width
      }
    }
    return new Field(name, width, index, color,
                     enumTypes && enumTypes.split(',').map(x => x.trim()))
  }

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

  get isBit () {
    return this.width === 1
  }

  static compareFunc (self, other) {
    return other.index - self.index
  }

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

function parseFormat (element) {
  let format = element.value.replaceAll('\\\n','').trim()
  if (!format) {
    element.style.backgroundColor = ''
    return []
  }

  let width = 0
  let width_bits = 0
  const fields = []
  const bits = new Map
  const enums = new Map
  const anomEnum = new Map
  enums.set(null, anomEnum)

  let parseError = false
  while (true) {
    if (!format) {
      break
    }
    format = format.trimLeft()
    if (!format) {
      break
    }

    let token, tokenType, errmsg
    let line

    if (format[0] === '#') {
      let key, value
      [[key, value], format, errmsg] = wantGrammar(format, [
        ['#'], ['define'], [TOKEN_IDENTIFIER, true], [TOKEN_NUMERIC, true]
      ])
      if (errmsg) {
        parseError = true
        break
      }
      value = parseValue(value)
      if (isNaN(value)) {
        parseError = true
        break
      }
      anomEnum.set(key, value)
      [line, format] = splitOnce(format)
      continue
    }

    if (format.startsWith('typedef')) {
      let enumObj, enumType
      let namedEnum
      [enumObj, enumType, format] = parseEnum(format.slice('typedef'.length))
      if (!enumObj) {
        parseError = true
        break
      }
      if (enumType) {
        namedEnum = true
        enums.set(enumType, enumObj)
      }

      let nextFormat
      [enumType, nextFormat, tokenType] = nextToken(format)
      if (tokenType === TOKEN_IDENTIFIER) {
        namedEnum = true
        enums.set(enumType, enumObj)
        format = nextFormat
      }

      if (!namedEnum) {
        enumObj.forEach((value, key) => anomEnum.set(key, value))
      }

      format = exhaustRepeatTokens(format, ';')
      continue
    }

    if (format.startsWith('enum')) {
      let enumObj, enumType
      let namedEnum
      [enumObj, enumType, format] = parseEnum(format)
      if (!enumObj) {
        parseError = true
        break
      }
      if (enumType) {
        enums.set(enumType, enumObj)
      } else {
        enumObj.forEach((value, key) => anomEnum.set(key, value))
      }

      format = exhaustRepeatTokens(format, ';')
      continue
    }

    [line, format] = splitOnce(format)
    const field = Field.fromString(line)
    if (!field) {
      parseError = true
      break
    }
    if (!field.width) {
      if (field.index > width_bits) {
        width_bits = field.index
      }
      bits.set(field.index, field)
    } else {
      width += field.width
      fields.push(field)
    }
  }
  if (parseError) {
    element.style.backgroundColor = COLOR_ERROR
    return []
  }
  if (fields.length === 0) {
    element.style.backgroundColor = COLOR_WARNING
    return []
  }
  element.style.backgroundColor = ''

  width_bits++
  if (width_bits > width) {
    fields.unshift(new Field('', width_bits - width, width))
    width = width_bits
  }

  let currentIndex = width
  for (let i = 0; i < fields.length; i++) {
    fields[i].collectEnums(enums)
    currentIndex -= fields[i].width
    fields[i].index = currentIndex
  }

  return [width, fields, bits, enums]
}

const input_format = document.getElementById('bitfield-format')
const tr_bits = document.getElementById('bitfield-bits')
const tr_fields = document.getElementById('bitfield-fields')

function drawFormat () {
  [config.value.width, config.fields, config.bits, config.enums] =
    parseFormat(input_format)
  if (!config.value.width) {
    return
  }
  localStorage.setItem('bitfield-format', input_format.value)

  let tr_bitsValue_html = ''
  let tr_bits_html = ''
  for (let i = 0; i < config.value.width; i++) {
    // bits header
    tr_bits_html += '<th>' + (config.value.width - i - 1) + '</th>\n'

    // data, bits
    let index = config.value.width - i - 1
    tr_bitsValue_html += '<td '
    let field = config.bits.get(index)
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
  for (let i = 0; i < config.fields.length; i++) {
    let field = config.fields[i]

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
      if (isNaN(fieldValue)) {
        event.target.style.backgroundColor = COLOR_ERROR
        return
      }
      event.target.style.backgroundColor = ''

      const fieldDataset = event.target.parentElement.dataset
      if (fieldDataset.width > 0) {
        config.value.setField(fieldValue, fieldDataset.index,
                              fieldDataset.width, event.target)
      }
    }))

  // data, enums
  let tr_fieldsEnum_html = ''
  if (fieldsHaveEnums) {
    for (let i = 0; i < config.fields.length; i++) {
      let field = config.fields[i]
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

        let value = parseInt(event.target.value)
        if (isNaN(value)) {
          console.error(event.target,
                        'has option that do not has a valid value')
          return
        }

        let fieldDataset = event.target.parentElement.dataset
        if (fieldDataset.width > 0) {
          config.value.setField(value, fieldDataset.index,
                                fieldDataset.width, event.target)
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
