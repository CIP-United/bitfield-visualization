'use strict'

/**
 * @typedef ManualPageMetadata
 * @property {string} _title page title
 * @property {string} [_id] page ID
 * @property {string} [_signature] short description of the page
 * @property {string[]} [_tags] tags for the page
 * @property {string} [_keywords] additional search keywords
 */

/**
 * @typedef {ManualPageMetadata & {[sectionName: string]: string}} ManualPage
 */

/**
 * @typedef Manual
 * @property {ManualPage[]} body manual body
 * @property {{[categoryName: string]: [string, string, string?][]}} [categories] list of categories of tags
 * @property {string} [colored] category to be colored
 * @property {[string, string][]} [links] links to be shown at the bottom of categories
 * @property {string} [placeholder] search box placeholder
 * @property {string[]} [radios] categories to be shown as radios
 * @property {string} [style] CSS styles to be applied to the page
 * @property {{[formatterName: string]: string}} [formatters] format functions (in string)
 */

{
  /**
   * @type {{[ns: string]: {
   *  [formatter: string]: (str: any) => any,
   *  stylesheet?: string,
   * }}}
   */
  var ManualFormatter
  (ManualFormatter ??= {}).default = {
    escape (str) {
      return str.toString()
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
    },

    br (str) {
      return typeof str !== 'string' ? str : str.replaceAll('\n', '<br />')
    },

    split (str) {
      return typeof str !== 'string' ? str : str.split('\n')
    },

    code (str) {
      return '<code>' + str + '</code>'
    },

    p (str) {
      return !Array.isArray(str) ? str :
        '<div class="paragraph">' + str.join('</div><div class="paragraph">') +
        '</div>'
    },

    pre (str) {
      return '<pre>' + str + '</pre>'
    },

    /**
     * @param {[number, string, (string | number)?][]} struct
     * @param {string} caption
     * @returns {string}
     */
    struct (struct, caption = '') {
      if (!Array.isArray(struct)) {
        return struct
      }

      let length = 0
      /** @type {number[]} */
      const fieldIndexs = new Array(struct.length)
      for (let i = 0; i < struct.length; i++) {
        const [size, name] = struct[i]
        fieldIndexs[i] = length
        if (size <= 0) {
          console.warn(`Invalid size in struct member ${name}: ${size}`)
        } else {
          length += size
        }
      }

      const table = ['<div class="struct-controller paragraph"><table class="struct">']

      if (caption) {
        table.push('<caption>')
        table.push(caption)
        table.push('</caption>')
      }

      table.push('<thead><tr>')
      for (let i = 0; i < fieldIndexs.length; i++) {
        fieldIndexs[i] = length - fieldIndexs[i] - 1
        const [size] = struct[i]
        if (size <= 0) {
          continue
        }
        table.push('<th>')
        if (size === 1) {
          table.push(fieldIndexs[i].toString())
        } else {
          table.push('<div class="struct-index-range"><div>')
          table.push(fieldIndexs[i].toString())
          table.push('</div><div>')
          table.push((fieldIndexs[i] + 1 - size).toString())
          table.push('</div></div>')
        }
        table.push('</th>')
      }

      table.push('</tr></thead><tbody><tr class="struct-names">')
      for (let i = 0; i < struct.length; i++) {
        const [size, name] = struct[i]
        if (size <= 0) {
          continue
        }
        table.push('<td style="width: ')
        table.push((size / length * 100).toString())
        if (name[0] === '~') {
          table.push('%;" class="struct-name-overline">')
          table.push(name.slice(1))
        } else {
          table.push('%;">')
          table.push(name)
        }
        table.push('</td>')
      }

      table.push('</tr><tr class="struct-bits">')
      for (let i = 0; i < struct.length; i++) {
        const [size, name, value] = struct[i]
        if (size <= 0) {
          continue
        }
        table.push('<td')
        if (typeof value === 'number') {
          table.push(' title="')
          table.push(value.toString())
          table.push('">')
          table.push(value.toString(2).padStart(size, '0'))
        } else {
          table.push('>')
          table.push(value || '&nbsp;')
        }
        table.push('</td>')
      }

      table.push('</tr><tfoot><tr>')
      for (let i = 0; i < struct.length; i++) {
        const [size] = struct[i]
        if (size <= 0) {
          continue
        }
        table.push('<th>')
        table.push(size.toString())
        table.push('</th>')
      }

      table.push('</tr></tfoot></table><button type="button" data-struct="')
      table.push(ManualFormatter.default.escape(JSON.stringify(struct)))
      table.push('">Use</button></div>')

      return table.join('')
    },

    /**
     * @param {{[caption: string]: [number, string, (string | number)?][]}} structs
     * @returns {string}
     */
    structs (structs) {
      if (typeof structs !== 'object') {
        return structs
      }

      /** @type {string[]} */
      const tables = []
      for (const caption in structs) {
        if (structs.hasOwnProperty(caption)) {
          tables.push(ManualFormatter.default.struct(
            structs[caption], caption[0] === '_' ? '' : caption))
        }
      }
      return tables.join('')
    },
  }


  /**
   * @param {string} str
   * @returns {boolean}
   */
  function isCssName (str) {
    return /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(str)
  }


  /**
   * @param {string} str
   * @returns {string}
   */
  function property2title (str) {
    let title =
      str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1')
    return title.replaceAll('_', ' ')
  }


  /**
   * @param {string} str
   * @param {number} init
   * @returns {number}
   */
  function djb2 (str, init = 5381) {
    let h = init
    for (let i = 0; i < str.length; i++) {
      h += h << 5
      h ^= str.charCodeAt(i)
    }
    return h >>> 0
  }


  /**
   * @param {number} x
   * @param {number} xmin
   * @param {number} xmax
   * @param {number} ymin
   * @param {number} ymax
   * @returns {number}
   */
  function normalize (x, xmin, xmax, ymin = 0, ymax = 1) {
    return ymin + (x - xmin) / (xmax - xmin) * (ymax - ymin)
  }


  /**
   * @param {string} str
   * @returns {string}
   */
  function str2color (str) {
    const hash = djb2(str, djb2(str, djb2(str)))
    const x = normalize((hash >> 20) & 0x3ff, 0, 0x3ff)
    const y = normalize((hash >> 10) & 0x3ff, 0, 0x3ff)
    const z = normalize((hash >>  0) & 0x3ff, 0, 0x3ff)
    return typeof d3 !== 'undefined' ?
      d3.lab(x * 100, (y - 0.5) * 200, (z - 0.5) * 200).formatRgb() :
      `rgb(${(x * 255).toFixed()}, ${(y * 255).toFixed()}, ${(z * 255).toFixed()})`
  }


  /**
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  function versionCompare (a, b) {
    let x = a
    let y = b

    while (x && y) {
      const p = x.match(/^\d*/)[0]
      const q = y.match(/^\d*/)[0]
      if (p !== q) {
        return p === '' ? -1 : q === '' ? 1 : parseInt(p, 10) - parseInt(q, 10)
      }
      x = x.slice(p.length)
      y = y.slice(q.length)

      const s = x.match(/^\D*/)[0]
      const t = y.match(/^\D*/)[0]
      if (s !== t) {
        return s === '' ? -1 : t === '' ? 1 : s.localeCompare(t)
      }
      x = x.slice(s.length)
      y = y.slice(t.length)
    }

    return x === y ? 0 : !x ? -1 : 1
  }


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
   * Update URL search parameters, treating original value as comma-separated
   * set.
   * @param {URLSearchParams} params URL search parameters.
   * @param {string} key Key.
   * @param {any} value Value.
   * @param {boolean} remove If true, remove the value from the set.
   */
  function updateParamsSet (params, key, value, remove = false) {
    const origValue = params.get(key)
    /** @type {string} */
    const element = value.toString()

    if (!remove) {
      if (!origValue) {
        params.set(key, element)
        return
      }
      if (origValue === element) {
        return
      }
    }

    const array = origValue ? origValue.split(',').filter(x => x) : []

    if (remove) {
      const index = array.indexOf(element)
      if (index < 0) {
        return
      }
      array.splice(index, 1)
    } else {
      if (array.includes(element)) {
        return
      }
      array.push(element)
    }

    if (array.length) {
      params.set(key, array.sort(versionCompare))
    } else {
      params.delete(key)
    }
  }


  /**
   * @param {HTMLDetailsElement} target
   */
  function detailAnimate (target) {
    if (!target.dataset.animation) {
      // prepare animation
      if (!target.style.height) {
        const style = getComputedStyle(target)
        target.style.height = target.getBoundingClientRect().height -
          parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) -
          parseFloat(style.borderTopWidth) +
          parseFloat(style.borderBottomWidth) + 'px'
      }
      target.dataset.animation = '1'
      target.addEventListener(
        'transitionend', function ontransitionend (event) {
          /** @type {HTMLDetailsElement} */
          const target = event.target

          delete target.dataset.animation
          target.style.height = ''

          if (target.dataset.closing) {
            // do real close
            delete target.dataset.closing
            target.open = false
          }

          target.removeEventListener('transitionend', ontransitionend)
        }, {passive: true})
    }

    if (target.open && !target.dataset.closing) {
      // about to close
      target.dataset.closing = '1'
      target.style.height =
        target.firstElementChild.getBoundingClientRect().height + 'px'
    } else {
      // about to open
      if (target.dataset.closing) {
        delete target.dataset.closing
      }
      target.style.height =
        target.firstElementChild.getBoundingClientRect().height +
        target.lastElementChild.getBoundingClientRect().height + 'px'
    }
  }


  class ManualViewer extends HTMLElement {
    static template = document.createElement('template')

    static {
      this.template.innerHTML = `<link rel="stylesheet" href="manual.css" />
<style class="manual-filter"></style>

<nav class="manual-side-panel">
  <div class="manual-categories"></div>
  <form class="manual-form">
    <label>Manual: <input type="file" name="file" /></label>
    <label>
      <input type="checkbox" name="trust" value="1" />
      Trust the file (Arbitrary code execution!!!)
    </label>
  </form>
  <button class="manual-collapse-all" type="button">Close all</button>
</nav>

<div class="manual-main-panel">
  <input class="manual-search" type="text" autocomplete="off"
    placeholder="Search instructions or descriptions..." />

  <main class="manual-body"></main>
</div>`
    }

    static xssOptions = {
      /** @type {{[x: string]: string[]}} */
      whiteList: null,

      /**
       * @param {string} tag
       * @param {string} name
       * @param {string} value
       */
      onIgnoreTagAttr (tag, name, value) {
        if (name.startsWith('data-')) {
          return name + '="' + filterXSS.escapeAttrValue(value) + '"'
        }
      },
    }

    root = this.attachShadow({mode: 'open'})

    constructor () {
      super()

      this.root.appendChild(this.constructor.template.content.cloneNode(true))

      const form = this.#form
      form.addEventListener('change', async event => {
        /** @type {HTMLFormElement} */
        const form = event.target.form

        const reader = await readInputFile(form.elements['file'])
        if (!reader) {
          return
        }
        //项目经理要求这里运行缓慢，好让客户给钱优化，并得到速度明显提升
        //await sleep(Math.random() * 1000 + 1000)

        /** @type {HTMLElement} */
        this.load(reader.result, {
          xss: form.elements['trust']?.checked || undefined})
      }, {passive: true})

      /** @type {HTMLInputElement} */
      const inputTrust = form.elements['trust']
      inputTrust.addEventListener('click', function (event) {
        /** @type {HTMLInputElement} */
        const target = event.target

        if (!target.checked) {
          return
        }
        if (!confirm('Really trust the file???')) {
          event.preventDefault()
        }
      })

      this.#search.addEventListener('input', event => {
        this.dispatchEvent(new CustomEvent('paramchange', {detail: {
          type: 'search',
          value: event.target.value,
        }}))
        this.#doSearch()
      }, {passive: true})

      const categories = this.#categories

      // pre-unclick radio buttons
      categories.addEventListener('mousedown', function (event) {
        /** @type {HTMLInputElement} */
        const target = event.target.tagName === 'LABEL' ?
          event.target.firstElementChild : event.target

        if (target.checked &&
            target.tagName === 'INPUT' && target.type === 'radio') {
          target.dataset.wasChecked = '1'
        }
      }, {passive: true})

      // unclick radio buttons
      categories.addEventListener('click', event => {
        /** @type {HTMLInputElement} */
        const target = event.target.tagName === 'LABEL' ?
          event.target.firstElementChild : event.target
        if (!target.dataset.wasChecked ||
            target.tagName !== 'INPUT' || target.type !== 'radio') {
          return
        }

        delete target.dataset.wasChecked
        target.checked = false
        if (target !== event.target) {
          event.preventDefault()
        }

        this.dispatchEvent(new CustomEvent('paramchange', {detail: {
          type: 'category',
          value: target.value,
          status: target.checked,
          name: target.name,
          exclusive: target.type === 'radio',
        }}))

        this.#doFilter()
      })

      // change category buttons
      categories.addEventListener('change', event => {
        /** @type {HTMLInputElement} */
        const target = event.target
        if (target.tagName !== 'INPUT') {
          return
        }

        this.dispatchEvent(new CustomEvent('paramchange', {detail: {
          type: 'category',
          value: target.value,
          status: target.checked,
          name: target.name,
          exclusive: target.type === 'radio',
        }}))

        this.#doFilter()
      }, {passive: true})

      this.root.querySelector('.manual-collapse-all').addEventListener(
        'click', event => {
          this.collapseAll()

          this.dispatchEvent(new CustomEvent('paramchange', {detail: {
            type: 'page',
            value: null,
            status: false,
          }}))
        })

      const body = this.#body

      // details animation
      body.addEventListener('click', event => {
        /** @type {HTMLDetailsElement} */
        const target = event.target.closest('summary')?.parentElement
        if (!target) {
          return
        }

        detailAnimate(target)

        this.dispatchEvent(new CustomEvent('paramchange', {detail: {
          type: 'page',
          value: target.id,
          status: !target.dataset.closing,
        }}))

        // keep it open to display the content
        if (target.open) {
          event.preventDefault()
        }
      })

      body.addEventListener('click', event => {
        /** @type {HTMLButtonElement} */
        const target = event.target
        if (target.tagName !== 'BUTTON' || !target.dataset.struct) {
          return
        }
        this.dispatchEvent(new CustomEvent(
          'choose', {detail: JSON.parse(target.dataset.struct)}))
      }, {passive: true})

      body.addEventListener('click', event => {
        /** @type {HTMLAnchorElement} */
        const target = event.target
        if (target.tagName !== 'A') {
          return
        }
        const href = target.getAttribute('href')
        if (href === null || href[0] !== '#') {
          return
        }
        event.preventDefault()
        const page = this.#body.querySelector(href)
        if (page === null) {
          return
        }

        const inclusive = !!target.closest(href)
        if (!page.open) {
          page.open = true
          this.dispatchEvent(new CustomEvent('paramchange', {detail: {
            type: 'page',
            value: page.id,
            status: true,
          }}))
        }
        if (!inclusive) {
          page.scrollIntoView()
        }
      })
    }

    /** @type {HTMLStyleElement} */
    get #filter () {
      return this.root.querySelector('.manual-filter')
    }

    /** @type {HTMLElement} */
    get #categories () {
      return this.root.querySelector('.manual-categories')
    }

    /** @type {HTMLFormElement} */
    get #form () {
      return this.root.querySelector('.manual-form')
    }

    /** @type {HTMLInputElement} */
    get #search () {
      return this.root.querySelector('.manual-search')
    }

    /** @type {HTMLElement} */
    get #body () {
      return this.root.querySelector('.manual-body')
    }

    /** @type {NodeListOf<HTMLDialogElement>} */
    get pages () {
      return this.#body.children
    }

    get search () {
      return this.#search.value
    }

    set search (value) {
      this.#search.value = value
      this.#doSearch()
    }

    collapseAll () {
      /** @type {NodeListOf<HTMLDialogElement>} */
      const pages = this.#body.querySelectorAll('[open]')
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        page.open = false
        if (page.style.height) {
          page.style.height = ''
        }
      }
    }

    #doSearch (str = this.#search.value.toLowerCase()) {
      const pages = this.pages
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        page.hidden = str && !page.dataset.search.includes(str)
        if (page.open) {
          page.open = false
          if (page.style.height) {
            page.style.height = ''
          }
        }
      }
    }

    #doFilter () {
      this.collapseAll()

      /** @type {NodeListOf<HTMLInputElement>} */
      const inputs = this.#categories.querySelectorAll('input:checked')
      if (inputs.length === 0) {
        // no tag selected; show all
        this.#filter.textContent = ''
        return
      }

      /** @type {string[]} */
      const tags = []
      for (const input of inputs) {
        tags.push(input.value)
      }
      this.#filter.textContent =
        `.manual-body > :not(.${tags.join('.')}) {display: none;}`
    }

    setParams (params = new URLSearchParams(location.hash.slice(1))) {
      // sync search input
      const search = params.get('search') || ''
      if (this.search !== search) {
        this.search = search
      }

      // detect tag changes
      let tagChanged = false
      const categories = this.#categories
      for (let i = 0; i < categories.children.length; i++) {
        const category = categories.children[i]
        if (category.classList.contains('links')) {
          continue
        }
        // sync tag checkbox
        const selected = params.get(category.dataset.category)?.split(',') || []
        for (const input of category.querySelectorAll('input')) {
          const checked = selected.includes(input.value)
          if (input.checked !== checked) {
            tagChanged = true
            input.checked = checked
          }
        }
      }
      if (tagChanged) {
        this.#doFilter()
      }

      const expand = params.get('expand')
      if (expand) {
        this.collapseAll()
        const expandSet = new Set(expand.split(','))
        const pages = this.pages
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]
          if (expandSet.has(page.id)) {
            page.open = true
          }
        }
      }
    }

    clear () {
      this.#categories.textContent = ''

      const search = this.#search
      if (!search.dataset.placeholder) {
        search.dataset.placeholder = search.placeholder
      }
      search.placeholder = search.dataset.placeholder
      search.value = ''

      this.#body.textContent = ''

      while (this.root.lastElementChild.tagName === 'STYLE' ||
             this.root.lastElementChild.tagName === 'LINK') {
        this.root.lastElementChild.remove()
      }
    }

    /**
     * @typedef ManualViewRenderOptions
     * @property {string[]} [ignoredTopics]
     * @property {any} [xss]
     */

    /**
     * @param {Manual} manual
     * @param {ManualViewRenderOptions} options
     * @param {string[]?} ignoredTopics
     */
    async render (manual, options = {}) {
      const trusted = options.xss === true
      if (!trusted && typeof filterXSS === 'undefined') {
        await require(['xss'])
      }
      if (!trusted && !options.xss && !this.constructor.xssOptions.whiteList) {
        const whiteList = filterXSS.getDefaultWhiteList()
        whiteList.button = ['type']
        whiteList.td.push('title')
        for (const prop in whiteList) {
          whiteList[prop].push('class', 'style')
        }
        this.constructor.xssOptions.whiteList = whiteList
      }
      const xss = trusted ? null :
        new filterXSS.FilterXSS(options.xss ?? this.constructor.xssOptions)


      /** search **/
      const search = this.#search

      // load placeholder
      if (!search.dataset.placeholder) {
        search.dataset.placeholder = search.placeholder
      }
      search.placeholder = manual.placeholder || search.dataset.placeholder


      /** categories **/
      const categories = this.#categories

      // load style
      const styleColor = document.createElement('style')
      if (manual.style) {
        //styleColor.textContent =
        //  trusted ? manual.style : filterCSS(manual.style, options.xss?.css)
        styleColor.textContent = manual.style
      }
      this.root.appendChild(styleColor)

      // load categories
      for (const categoryName in manual.categories) {
        if (!isCssName(categoryName)) {
          console.warn(`Invalid category name: ${categoryName}`)
          continue
        }

        const category = document.createElement('section')
        category.dataset.category = categoryName

        const categoryHeading = document.createElement('h1')
        categoryHeading.textContent = property2title(categoryName)
        category.appendChild(categoryHeading)

        const colored = categoryName === manual.colored
        const inputType =
          manual.radios?.includes(categoryName) ? 'radio' : 'checkbox'

        const categoryTag = document.createElement('div')
        categoryTag.className = 'manual-category'
        if (colored) {
          categoryTag.className += ' manual-category-colored'
        }
        categoryTag.className += ' ' + categoryName
        for (const [tagName, tagDesc, tagColor] of
              manual.categories[categoryName]) {
          if (!isCssName(tagName)) {
            console.warn(
              `Invalid tag name in category ${categoryName}: ${tagName}`)
            continue
          }

          categoryTag.insertAdjacentHTML(
            'beforeend', `<label class="${tagName}">
  <input type="${inputType}" name="${categoryName}" value="${tagName}">
  ${trusted ? tagDesc : xss.process(tagDesc)}
</label>`)

          if (colored) {
            const tagColorValid =
              !tagColor || trusted || !tagColor?.includes(';')
            if (!tagColorValid) {
              console.warn(
                `Invalid color in tag ${tagName} of category ${categoryName}: ${
                  tagColor}`)
            }
            styleColor.sheet.insertRule(
              `:host {--tag-${tagName}: ${
                (tagColorValid && tagColor) || str2color(tagName)};}`, 0)
            styleColor.sheet.insertRule(
              `.${tagName} {border-color: var(--tag-${tagName});}`,
              0)
          }
        }
        category.appendChild(categoryTag)

        categories.appendChild(category)
      }

      // load links
      if (manual.links) {
        const links = document.createElement('menu')
        links.className = 'manual-links'
        for (const [url, title] of manual.links) {
          const html = `<li><a target="_blank" href="${url}">${title}</a></li>`
          links.insertAdjacentHTML(
            'beforeend', trusted ? html : xss.process(html))
        }
        categories.appendChild(links)
      }


      /** body **/
      const body = this.#body
      body.textContent = ''

      // load formatter
      /** @type {Set<string>} */
      const stylesheets = new Set
      /** @type {{[name: string]: (content: string, page: ManualPage) => string}} */
      const formatters = {}
      for (const name in manual.formatters) {
        const expr = manual.formatters[name]
        if (expr.startsWith('ManualFormatter.')) {
          const [_, ns, func] = expr.split('.')
          if (ns in ManualFormatter && func in ManualFormatter[ns]) {
            formatters[name] = ManualFormatter[ns][func]
            if (ManualFormatter[ns].stylesheet) {
              stylesheets.add(ManualFormatter[ns].stylesheet)
            }
          }
        } else if (trusted) {
          formatters[name] = Function(
            'ManualFormatter', "'use strict'; return " + expr)(ManualFormatter)
        }
      }
      const defaultFormatter = formatters._default
      const postFormatter = formatters._post

      // load custom styles
      stylesheets.forEach(stylesheet => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = stylesheet
        this.root.appendChild(link)
      })

      // load body
      for (let i = 0; i < manual.body.length; i++) {
        const pageObj = manual.body[i]

        const page = document.createElement('details')
        if (pageObj._tags && pageObj._tags.length > 0) {
          page.className = pageObj._tags.join(' ')
        }
        page.id = pageObj._id || (
          pageObj._signature ? pageObj._signature.replace(/[,= ]/g, '') : ''
        ) || i.toString()
        page.dataset.search = [
          pageObj._signature, pageObj._title, pageObj._keywords
        ].filter(x => x).join(' ').toLowerCase()

        const title = document.createElement('summary')
        title.innerHTML = trusted ?
          pageObj._title : xss.process(pageObj._title)
        if (pageObj._signature) {
          const signature = document.createElement('code')
          signature.className = 'manual-page-signature'
          signature.textContent = pageObj._signature
          title.appendChild(signature)
        }
        page.appendChild(title)

        const article = document.createElement('article')
        article.className = 'manual-page-content'
        for (const sectionName in pageObj) {
          if (sectionName[0] === '_' ||
              options.ignoredTopics?.includes(sectionName)) {
            continue
          }
          if (!isCssName(sectionName)) {
            console.warn(
              `Invalid topic name in page ${
                pageObj._signature || pageObj._title}: ${sectionName}`)
            continue
          }

          const section = document.createElement('section')

          const heading = document.createElement('h1')
          heading.textContent = property2title(sectionName) + ':'
          section.appendChild(heading)

          const content = document.createElement('div')
          content.className = sectionName

          const contentObj = pageObj[sectionName]
          const formatted =
            formatters[sectionName] ?
              formatters[sectionName](contentObj, pageObj) :
            defaultFormatter ? defaultFormatter(contentObj, pageObj) :
            contentObj
          const postFormatted =
            postFormatter ? postFormatter(formatted, pageObj) : formatted
          content.innerHTML =
            trusted ? postFormatted : xss.process(postFormatted)

          section.appendChild(content)

          article.appendChild(section)

          page.appendChild(article)
        }

        body.appendChild(page)
      }


      /** Hash **/

      if (location.hash.length > 1) {
        this.setParams()
      }
    }

    /**
     * @param {Promise<Manual | string>} loader
     * @param {ManualViewRenderOptions} options
     * @returns {Manual}
     */
    async load (loader, options = undefined) {
      this.clear()

      /** @type {HTMLElement} */
      const body = this.root.querySelector('.manual-body')
      body.textContent = 'Loading...'
      /** @type {Manual} */
      let manual
      try {
        manual = await loader
        if (typeof manual === 'string') {
          manual = JSON.parse(manual)
        }
        if (typeof manual !== 'object' || !manual.body) {
          throw new Error('Object does not look like a valid manual')
        }
      } catch (error) {
        body.textContent = 'Error: ' + error
        throw error
      }

      this.render(manual, options)

      return manual
    }
  }

  customElements.define('manual-viewer', ManualViewer)

  /** @type {ManualViewer} */
  const manual = document.querySelector('manual-viewer')
  let hashPrev = ''

  /**
   * @typedef {CustomEvent<{
   *  type: "search",
   *  value: string
   * } | {
   *  type: "category",
   *  value: string,
   *  status: boolean,
   *  name: string,
   *  exclusive: boolean
   * } | {
   *  type: "page",
   *  value: string?,
   *  status: boolean
   * }>} ManualViewerParamChangeEvent
   */

  manual.addEventListener('paramchange',
    (/** @type {ManualViewerParamChangeEvent} */ event) => {
      const params = new URLSearchParams(location.hash.slice(1))
      switch (event.detail.type) {
        case 'search':
          params.delete('expand')
          if (event.detail.value) {
            params.set('search', event.detail.value)
          } else {
            params.delete('search')
          }
          break
        case 'category':
          params.delete('expand')
          if (event.detail.exclusive) {
            if (event.detail.status) {
              params.set(event.detail.name, event.detail.value)
            } else {
              params.delete(event.detail.name)
            }
          } else {
            updateParamsSet(
              params, event.detail.name, event.detail.value,
              !event.detail.status)
          }
          break
        case 'page':
          if (event.detail.value === null) {
            params.delete('expand')
          } else {
            updateParamsSet(
              params, 'expand', event.detail.value, !event.detail.status)
          }
          break
      }

      const hash = params.toString().replaceAll('%2C', ',') || 'expand='
      hashPrev = hash

      location.replace('#' + hash)
      /*
      if (!hash) {
        history.replaceState(null, '', location.pathname)
      }
      */
    })

  window.addEventListener('hashchange', event => {
    const hash = location.hash.slice(1)
    if (hashPrev === hash) {
      return
    }
    hashPrev = hash
    manual.setParams(new URLSearchParams(hash))
  }, {passive: true})
}
