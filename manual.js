'use strict'

{
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
  function makeName (str) {
    return str.replace(/[,= ]/g, '')
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
   * @param {Element} node
   * @param {{[tagName: string]: string[]}} whitelist
   */
  function filterNode (node, whitelist) {
    const tagName = node.tagName.toLowerCase()

    if (!(tagName in whitelist)) {
      node.remove()
      return
    }

    const attrs = Array.from(node.attributes)
    for (let i = 0; i < attrs.length; i++) {
      const name = attrs[i].name
      if (!name.startsWith('data-') && !whitelist._.includes(name) &&
          !whitelist[tagName].includes(name)) {
        node.removeAttribute(name)
      }
    }

    const children = Array.from(node.children)
    for (let i = 0; i < children.length; i++) {
      filterNode(children[i], whitelist)
    }
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
   * @returns {boolean}
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
      return false
    } else {
      // about to open
      if (target.dataset.closing) {
        delete target.dataset.closing
      }
      target.style.height =
        target.firstElementChild.getBoundingClientRect().height +
        target.lastElementChild.getBoundingClientRect().height + 'px'
      return true
    }
  }


  class ManualViewer extends HTMLElement {
    static template = document.createElement('template')

    static {
      this.template.innerHTML = `<link rel="stylesheet" href="manual.css" />
<style class="manual-filter"></style>
<style class="manual-filter-search"></style>

<nav class="manual-side-panel">
  <div class="manual-categories"></div>
  <form class="manual-form">
    <label>Manual: <input type="file" name="file" /></label>
    <label>
      <input type="checkbox" name="trust" value="1" />
      Trust the file (Arbitrary code execution!!!)
    </label>
  </form>
  <button class="manual-collapse-all" type="button">Collapse all</button>
</nav>

<div class="manual-main-panel">
  <input class="manual-search" type="text" autocomplete="off"
    placeholder="Search title or keywords..." />

  <main class="manual-body"></main>
</div>`
    }

    /** @type {{[tagName: string]: string[]}} */
    static whitelist = {
      _: ['id', 'class', 'style'],
      a: ['target', 'href', 'title'],
      abbr: ['title'],
      address: [],
      area: ['shape', 'coords', 'href', 'alt'],
      article: [],
      aside: [],
      audio: [
        'autoplay',
        'controls',
        'crossorigin',
        'loop',
        'muted',
        'preload',
        'src',
      ],
      b: [],
      bdi: ['dir'],
      bdo: ['dir'],
      big: [],
      blockquote: ['cite'],
      br: [],
      button: ['type'],
      caption: [],
      center: [],
      cite: [],
      code: [],
      col: ['align', 'valign', 'span', 'width'],
      colgroup: ['align', 'valign', 'span', 'width'],
      dd: [],
      del: ['datetime'],
      details: ['open'],
      div: [],
      dl: [],
      dt: [],
      em: [],
      figcaption: [],
      figure: [],
      font: ['color', 'size', 'face'],
      footer: [],
      h1: [],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      header: [],
      hr: [],
      i: [],
      img: ['src', 'alt', 'title', 'width', 'height'],
      ins: ['datetime'],
      li: [],
      mark: [],
      nav: [],
      ol: [],
      p: [],
      pre: [],
      s: [],
      section: [],
      small: [],
      span: [],
      sub: [],
      summary: [],
      sup: [],
      strong: [],
      strike: [],
      table: ['width', 'border', 'align', 'valign'],
      tbody: ['align', 'valign'],
      td: ['width', 'rowspan', 'colspan', 'align', 'valign', 'title'],
      tfoot: ['align', 'valign'],
      th: ['width', 'rowspan', 'colspan', 'align', 'valign', 'title'],
      thead: ['align', 'valign'],
      tr: ['rowspan', 'align', 'valign'],
      tt: [],
      u: [],
      ul: [],
      video: [
        'autoplay',
        'controls',
        'crossorigin',
        'loop',
        'muted',
        'playsinline',
        'poster',
        'preload',
        'src',
        'height',
        'width',
      ],
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
          trusted: form.elements['trust']?.checked || undefined})
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
        this.#doSearch()
        this.dispatchEvent(new CustomEvent('paramchange', {detail: {
          type: 'search',
          value: event.target.value,
        }}))
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

        this.#doFilter()
        this.dispatchEvent(new CustomEvent('paramchange', {detail: {
          type: 'category',
          value: target.value,
          status: target.checked,
          name: target.name,
          exclusive: target.type === 'radio',
        }}))
      })

      // change category buttons
      categories.addEventListener('change', event => {
        /** @type {HTMLInputElement} */
        const target = event.target
        if (target.tagName !== 'INPUT') {
          return
        }

        this.#doFilter()
        this.dispatchEvent(new CustomEvent('paramchange', {detail: {
          type: 'category',
          value: target.value,
          status: target.checked,
          name: target.name,
          exclusive: target.type === 'radio',
        }}))
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
        /** @type {HTMLDetailsElement?} */
        const summary = event.target.closest('summary')
        if (summary === null) {
          return
        }
        const target = summary.parentElement
        if (target === null) {
          return
        }

        const open = detailAnimate(target)
        // keep it open to display the content
        if (target.open) {
          event.preventDefault()
        }
        this.dispatchEvent(new CustomEvent('paramchange', {detail: {
          type: 'page',
          value: target.id,
          status: open,
        }}))
      })

      // select struct format
      body.addEventListener('click', event => {
        /** @type {HTMLButtonElement?} */
        const target = event.target.closest('button')
        if (target === null || !target.dataset.struct) {
          return
        }
        this.dispatchEvent(new CustomEvent('choose', {
          detail: new DOMParser().parseFromString(
            target.dataset.struct.trim(), 'text/xml').firstElementChild
        }))
      }, {passive: true})

      // intercept page anchor
      body.addEventListener('click', event => {
        /** @type {HTMLAnchorElement?} */
        const target = event.target.closest('a')
        if (target === null) {
          return
        }
        const href = target.getAttribute('href')?.trim()
        if (!href || href[0] !== '#') {
          return
        }
        event.preventDefault()

        const anchor = this.#body.querySelector(href)
        if (anchor === null) {
          return
        }
        const page = anchor.closest('details')
        if (page === null) {
          return
        }

        if (!page.open) {
          page.open = true
          this.dispatchEvent(new CustomEvent('paramchange', {detail: {
            type: 'page',
            value: page.id,
            status: true,
          }}))
        }
        if (target.closest(href) === null) {
          anchor.scrollIntoView()
        }
      })
    }

    /** @type {HTMLStyleElement} */
    get #filter () {
      return this.root.querySelector('.manual-filter')
    }

    /** @type {HTMLStyleElement} */
    get #filterSearch () {
      return this.root.querySelector('.manual-filter-search')
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

    #doSearch (str = this.#search.value) {
      const s = str.toLowerCase().trim().replace(/\s+/g, ' ')
      this.#filterSearch.textContent = s &&
        '.manual-body > :not([data-search*="' + s +'"]) { display: none; }'
    }

    #doFilter () {
      /** @type {string[][]} */
      const sat = []

      const categories = this.#categories.children
      for (let i = 0; i < categories.length; i++) {
        /** @type {NodeListOf<HTMLInputElement>} */
        const inputs = categories[i].querySelectorAll('input:checked')
        if (inputs.length > 0) {
          /** @type {string[]} */
          const tags = new Array(inputs.length)
          for (let j = 0; j < inputs.length; j++) {
            tags[j] = inputs[j].value
          }
          sat.push(tags)
        }
      }

      this.#filter.textContent = sat.length === 0 ? '' :
        '.manual-body > :not(:is(' +
        sat.map(tags => '.' + tags.join(', .')).join('):is(') +
        ')) { display: none; }'
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
      if (!('placeholder' in search.dataset)) {
        search.dataset.placeholder = search.placeholder
      } else {
        search.placeholder = search.dataset.placeholder
      }
      search.value = ''

      this.#body.textContent = ''

      while (this.root.lastElementChild.tagName === 'STYLE' ||
             this.root.lastElementChild.tagName === 'LINK') {
        this.root.lastElementChild.remove()
      }
    }

    /**
     * @typedef ManualViewRenderOptions
     * @property {boolean | (node: Element) => void} [trusted]
     */

    /**
     * @param {Element} manual
     * @param {ManualViewRenderOptions} options
     * @param {string[]?} ignoredTopics
     */
    async render (manual, options = {}) {
      let manualObj = manual

      const xsls = manualObj.querySelectorAll(':scope > stylesheet')
      for (let i = 0; i < xsls.length; i++) {
        const xsltProcessor = new XSLTProcessor
        xsltProcessor.importStylesheet(xsls[0])
        const doc = xsltProcessor.transformToDocument(manualObj)
        if (!(doc instanceof XMLDocument)) {
          throw new Error('Output method of embedded XSL must be XML')
        }
        manualObj = doc.firstElementChild
        if (manualObj === null) {
          throw new Error('Invalid embedded XSL')
        }
      }

      // load styles
      const styleTags = document.createElement('style')
      this.root.appendChild(styleTags)

      const styleObjs = manualObj.querySelectorAll(':scope > style')
      for (let i = 0; i < styleObjs.length; i++) {
        const style = document.createElement('style')
        //style.textContent = !options.css ? styleObjs[i].textContent :
        //  filterCSS(styleObjs[i].textContent, options.css)
        style.textContent = styleObjs[i].textContent
        this.root.appendChild(style)
      }

      // load placeholder
      const placeholder = manualObj.querySelector(
        ':scope > placeholder')?.textContent?.trim()
      if (placeholder) {
        this.#search.placeholder = placeholder
      }

      /** categories **/
      const categories = this.#categories

      // load categories
      const categoryObjs = manualObj.querySelectorAll(':scope > category')
      for (let i = 0; i < categoryObjs.length; i++) {
        const categoryObj = categoryObjs[i]

        const categoryName = categoryObj.querySelector(
          ':scope > name')?.textContent?.trim()
        if (!categoryName) {
          console.warn('Category has no name')
          continue
        }
        const categoryTrimmedName = makeName(categoryName)
        if (categoryTrimmedName === '') {
          console.warn('Category name invalid')
          continue
        }

        const category = document.createElement('section')
        category.dataset.category = categoryTrimmedName

        const categoryHeading = document.createElement('h1')
        categoryHeading.textContent = categoryName
        category.appendChild(categoryHeading)

        const colored =
          categoryObj.querySelector(':scope > category-colored') !== null
        const inputType =
          categoryObj.querySelector(':scope > category-disjoint') !== null ?
            'radio' : 'checkbox'

        const tags = document.createElement('div')
        tags.className = 'manual-category'
        if (colored) {
          tags.className += ' manual-category-colored'
        }

        const tagObjs = categoryObj.querySelectorAll(':scope > tag-definition')
        for (let j = 0; j < tagObjs.length; j++) {
          const tagObj = tagObjs[j]

          const tagName = tagObj.querySelector(
            ':scope > name')?.textContent?.trim()
          if (!isCssName(tagName)) {
            console.warn(
              `Invalid tag name in category ${categoryName}: ${tagName}`)
            continue
          }

          const tag = document.createElement('label')
          tag.className = tagName
          tag.textContent = tagObj.querySelector(
            ':scope > description')?.textContent?.trim() || ''

          const input = document.createElement('input')
          input.type = inputType
          input.name = categoryTrimmedName
          input.value = tagName
          tag.prepend(input)

          tags.appendChild(tag)

          if (colored) {
            const tagColor = tagObj.querySelector(
              ':scope > color')?.textContent?.trim()
            if (tagColor?.includes(';')) {
              console.warn(
                `Invalid color in tag ${tagName} of category ${categoryName}: ${
                  tagColor}`)
            }
            const tagColorValid = !!tagColor && !tagColor?.includes(';')
            styleTags.sheet.insertRule(
              `:host {--tag-${tagName}: ${
                tagColorValid ? tagColor : str2color(tagName)};}`, 0)
            styleTags.sheet.insertRule(
              `.${tagName} {border-color: var(--tag-${tagName});}`,
              0)
          }
        }

        category.appendChild(tags)

        categories.appendChild(category)
      }

      // load links
      const linkObjs = manualObj.querySelectorAll(':scope > link')
      if (linkObjs.length > 0) {
        const links = document.createElement('menu')
        links.className = 'manual-links'
        for (let i = 0; i < linkObjs.length; i++) {
          const linkObj = linkObjs[i]
          const url = linkObj.querySelector(
            ':scope > url')?.textContent?.trim()
          if (!url) {
            continue
          }
          const title = linkObj.querySelector(
            ':scope > title')?.textContent?.trim()
          if (!title || !title.startsWith('http')) {
            continue
          }

          const link = document.createElement('li')
          const a = document.createElement('a')
          a.target = '_blank'
          a.href = url
          a.textContent = title
          link.appendChild(a)
          links.appendChild(link)
        }
        categories.appendChild(links)
      }

      // load body
      if (typeof manualXsl === 'undefined') {
        await require(['manual-xsl'])
      }
      const xsltProcessor = new XSLTProcessor
      xsltProcessor.importStylesheet(manualXsl)
      const result = xsltProcessor.transformToFragment(
        manualObj, document.implementation.createDocument('', ''))
      if (result === null) {
        throw new Error('Invalid XSL data')
      }

      if (options.trusted !== true) {
        for (let i = 0; i < result.children.length; i++) {
          if (options.trusted) {
            options.trusted(result.children[i])
          } else {
            filterNode(result.children[i], this.constructor.whitelist)
          }
        }
      }
      this.#body.appendChild(result)

      /** Hash **/
      if (location.hash.length > 1) {
        this.setParams()
      }
    }

    /**
     * @param {Promise<Element | string>} loader
     * @param {ManualViewRenderOptions} options
     * @returns {Element}
     */
    async load (loader, options = undefined) {
      this.clear()

      /** @type {HTMLElement} */
      const body = this.root.querySelector('.manual-body')
      body.textContent = 'Loading...'

      try {
        const raw = await loader

        let manual
        if (typeof raw === 'string') {
          manual = new DOMParser().parseFromString(
            raw.trim(), 'text/xml').firstElementChild
          if (manual === null) {
            throw new Error('empty manual')
          }
          const error = manual.querySelector('parsererror')
          if (error) {
            throw new Error(error.textContent)
          }
        } else if (!(raw instanceof Element)) {
          throw new Error('invalid manual type')
        } else {
          manual = raw
        }

        this.#body.textContent = ''
        await this.render(manual, options)

        return manual
      } catch (error) {
        body.textContent = 'Error: ' + error
        throw error
      }
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
          if (event.detail.value) {
            params.set('search', event.detail.value)
          } else {
            params.delete('search')
          }
          break
        case 'category':
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
