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
    static xsl = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:m="https://github.com/CIP-United/bitfield-visualization"
    exclude-result-prefixes="m">
  <xsl:output method="html" indent="yes" />

  <xsl:variable name="lowercase" select="'abcdefghijklmnopqrstuvwxyz'" />
  <xsl:variable name="uppercase" select="'ABCDEFGHIJKLMNOPQRSTUVWXYZ'" />

  <xsl:template name="m:binary">
    <xsl:param name="value" />
    <xsl:param name="width" select="1" />

    <xsl:if test="$value &gt; 0 or $width &gt; 0">
      <xsl:call-template name="m:binary">
        <xsl:with-param name="value" select="floor($value div 2)" />
        <xsl:with-param name="width" select="$width - 1" />
      </xsl:call-template>
      <xsl:value-of select="$value mod 2" />
    </xsl:if>
  </xsl:template>

  <xsl:template match="m:manual">
    <xsl:apply-templates select="m:page" />
  </xsl:template>

  <xsl:template match="m:page">
    <details>
      <xsl:apply-templates select="@*" />
      <xsl:if test="not(@id)">
        <xsl:attribute name="id">
          <xsl:choose>
            <xsl:when test="m:signature">
              <xsl:value-of select="translate(m:signature, ',= ', '')" />
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="count(preceding-sibling::m:page)" />
            </xsl:otherwise>
          </xsl:choose>
        </xsl:attribute>
      </xsl:if>
      <xsl:if test="m:tag">
        <xsl:attribute name="class">
          <xsl:value-of select="@class" />
          <xsl:for-each select="m:tag">
            <xsl:text> </xsl:text>
            <xsl:value-of select="node()" />
          </xsl:for-each>
        </xsl:attribute>
      </xsl:if>
      <xsl:attribute name="data-search">
        <xsl:value-of select="translate(m:signature, $uppercase, $lowercase)" />
        <xsl:if test="@id">
          <xsl:text> </xsl:text>
          <xsl:value-of select="translate(@id, $uppercase, $lowercase)" />
        </xsl:if>
        <xsl:if test="m:title">
          <xsl:text> </xsl:text>
          <xsl:value-of select="translate(m:title, $uppercase, $lowercase)" />
        </xsl:if>
        <xsl:if test="m:keywords">
          <xsl:text> </xsl:text>
          <xsl:value-of select="translate(m:keywords, $uppercase, $lowercase)" />
        </xsl:if>
      </xsl:attribute>

      <summary>
        <xsl:apply-templates select="m:title/@* | m:title/node()" />
        <xsl:if test="m:signature">
          <code class="manual-page-signature">
            <xsl:apply-templates select="m:signature/@* | m:signature/node()" />
          </code>
        </xsl:if>
      </summary>

      <article class="manual-page-content">
        <xsl:apply-templates select="m:content/@* | m:content/node()" />
      </article>
    </details>
  </xsl:template>

  <xsl:template match="m:section">
    <section>
      <xsl:apply-templates select="@* | node()" />
    </section>
  </xsl:template>

  <xsl:template match="m:section/m:heading">
    <h1>
      <xsl:apply-templates select="@* | node()" />
    </h1>
  </xsl:template>

  <xsl:template match="m:paragraph">
    <div class="paragraph">
      <xsl:apply-templates />
    </div>
  </xsl:template>

  <xsl:template match="m:struct-definition">
    <xsl:variable name="struct-length" select="sum(m:field-definition/m:width)" />

    <div class="scattered paragraph">
      <table class="struct no-default-style table-nonempty">
        <xsl:apply-templates select="@*" />

        <xsl:apply-templates select="caption" />
        <thead>
          <tr>
            <xsl:for-each select="m:field-definition">
              <xsl:variable name="field-index" select="sum(following-sibling::m:field-definition/m:width)" />

              <th>
                <xsl:apply-templates select="m:width/@*" />

                <xsl:choose>
                  <xsl:when test="m:width &lt;= 0">
                    <xsl:message terminate="yes">
                      Error: field width cannot be non-positive
                    </xsl:message>
                  </xsl:when>
                  <xsl:when test="m:width = 1">
                    <xsl:value-of select="$field-index" />
                  </xsl:when>
                  <xsl:otherwise>
                    <div class="scattered">
                      <div><xsl:value-of select="$field-index + m:width - 1" /></div>
                      <div><xsl:value-of select="$field-index" /></div>
                    </div>
                  </xsl:otherwise>
                </xsl:choose>
              </th>
            </xsl:for-each>
          </tr>
        </thead>
        <tbody>
          <tr class="struct-names">
            <xsl:for-each select="m:field-definition">
              <td>
                <xsl:apply-templates select="m:name/@*" />
                <xsl:attribute name="style">
                  <xsl:value-of select="m:name/@style" />
                  <xsl:text>width: </xsl:text>
                  <xsl:value-of select="m:width div $struct-length * 100" />
                  <xsl:text>%;</xsl:text>
                </xsl:attribute>

                <xsl:apply-templates select="m:name/node()" />
              </td>
            </xsl:for-each>
          </tr>
          <tr class="struct-bits">
            <xsl:for-each select="m:field-definition">
              <td>
                <xsl:apply-templates select="m:value/@*" />
                <xsl:attribute name="data-width">
                  <xsl:value-of select="m:width" />
                </xsl:attribute>

                <xsl:choose>
                  <xsl:when test="m:value &gt;= 0">
                    <xsl:call-template name="m:binary">
                      <xsl:with-param name="value" select="m:value" />
                      <xsl:with-param name="width" select="m:width" />
                    </xsl:call-template>
                  </xsl:when>
                  <xsl:otherwise>
                    <xsl:apply-templates select="m:value/node()" />
                  </xsl:otherwise>
                </xsl:choose>
              </td>
            </xsl:for-each>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <xsl:for-each select="m:field-definition">
              <th>
                <xsl:apply-templates select="m:width/@* | m:width/node()" />
              </th>
            </xsl:for-each>
          </tr>
        </tfoot>
      </table>
      <button type="button">
        <xsl:attribute name="data-struct">
          <xsl:text>./m:page[</xsl:text>
          <xsl:value-of select="count(ancestor::m:page/preceding-sibling::m:page) + 1" />
          <xsl:text>]//m:struct-definition</xsl:text>
        </xsl:attribute>
        <xsl:text>Use</xsl:text>
      </button>
    </div>
  </xsl:template>

  <xsl:template match="/ | @* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()" />
    </xsl:copy>
  </xsl:template>
</xsl:stylesheet>`, 'text/xml')
    static template = document.createElement('template')

    static {
      this.template.innerHTML = `<link rel="stylesheet" href="manual.css" />
<style class="manual-filter"></style>
<style class="manual-filter-search"></style>

<nav class="manual-side-panel">
  <div class="manual-categories"></div>
  <form class="manual-form manual-form-standalone">
    <label class="manual-form-on-preload">
      Manual: <select name="preload"></select>
    </label>
    <label class="manual-form-on-standalone">
      <span class="manual-form-off-preload">Manual:</span>
      <span class="manual-form-on-preload">Or load a file:</span>
      <input type="file" name="file" />
    </label>
    <label class="manual-form-on-ace">
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
    /**
     * list of preloaded data files / URLs
     * @type {[string, string][]}
     */
    #preload = []
    /**
     * the manual in use
     * @type {Element?}
     */
    #manual = null

    constructor () {
      super()

      this.root.appendChild(this.constructor.template.content.cloneNode(true))

      const form = this.#form
      form.addEventListener('change', event => {
        /** @type {HTMLFormElement} */
        const form = event.target.form
        /** @type {HTMLSelectElement} */
        const select = form.elements['preload']
        /** @type {HTMLInputElement} */
        const file = form.elements['file']

        switch (event.target) {
          case select:
            file.value = ''
            break
          case file:
            select.value = ''
            break
        }

        let loader
        if (select.value) {
          const entry = this.#preload[Number(select.value)]
          if (!entry) {
            return
          }
          const resource = entry[1]
          if (!resource) {
            return
          }
          loader = resource[0] === '<' ? resource :
            fetch(resource).then(response => response.text())
        } else if (file.value) {
          const reader = readInputFile(form.elements['file'])
          if (!reader) {
            return
          }
          loader = reader.then(reader => reader.result)
        } else {
          return
        }

        //项目经理要求这里运行缓慢，好让客户给钱优化，并得到速度明显提升
        //await sleep(Math.random() * 1000 + 1000)

        this.load(loader, {
          trusted: form.elements['trust']?.checked || undefined,
        })
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
        if (this.#manual === null) {
          throw new Error('struct was asked, but no manual data available')
        }

        const xpEvaluator = new XPathEvaluator()
        const struct = xpEvaluator.evaluate(
          target.dataset.struct, this.#manual,
          xpEvaluator.createNSResolver(this.#manual.ownerDocument),
          XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue
        if (struct === null) {
          throw new Error('XPath found nothing')
        }
        this.dispatchEvent(new CustomEvent('choose', {
          detail: struct,
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

    /**
     * if true, show control sidebar
     */
    get standalone () {
      return this.#form.classList.contains('manual-form-standalone')
    }

    set standalone (value) {
      this.#form.classList.toggle('manual-form-standalone', value)
    }

    /**
     * page entries
     * @type {NodeListOf<HTMLDialogElement>}
     */
    get pages () {
      return this.#body.children
    }

    /**
     * search text
     */
    get search () {
      return this.#search.value
    }

    set search (value) {
      this.#search.value = value
      this.#doSearch()
    }

    /**
     * list of preloaded data files / URLs
     */
    get preload () {
      return this.#preload
    }

    set preload (value) {
      this.#preload = value

      const form = this.#form
      form.classList.toggle('manual-form-preload', this.#preload.length > 0)

      /** @type {HTMLSelectElement} */
      const select = form.elements['preload']
      select.textContent = ''
      if (this.#preload.length > 0) {
        const option = document.createElement('option')
        option.textContent = 'Select one...'
        select.appendChild(option)
        for (let i = 0; i < this.#preload.length; i++) {
          const option = document.createElement('option')
          option.innerHTML = this.#preload[i][0]
          option.value = i
          select.appendChild(option)
        }
      }
    }

    /**
     * the manual in use
     */
    get manual () {
      return this.#manual
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
        /** @type {HTMLElement} */
        const category = categories.children[i]
        if (!category.dataset.category) {
          continue
        }
        // sync tag checkbox
        const selectedSet = new Set(
          params.get(category.dataset.category)?.split(','))
        for (const input of category.querySelectorAll('input')) {
          const checked = selectedSet.has(input.value)
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

      this.#manual = null
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
    render (manual, options = {}) {
      let manualObj = manual

      // apply custom xsls
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

      // apply final xsl
      const xsltProcessor = new XSLTProcessor
      xsltProcessor.importStylesheet(this.constructor.xsl)
      const bodyObj = xsltProcessor.transformToFragment(
        manualObj, document.implementation.createDocument('', ''))
      if (bodyObj === null) {
        throw new Error('Invalid XSL data')
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
      if (options.trusted !== true) {
        for (let i = 0; i < bodyObj.children.length; i++) {
          if (options.trusted) {
            options.trusted(bodyObj.children[i])
          } else {
            filterNode(bodyObj.children[i], this.constructor.whitelist)
          }
        }
      }
      this.#body.appendChild(bodyObj)

      /** Hash **/
      if (location.hash.length > 1) {
        this.setParams()
      }

      this.#manual = manualObj
    }

    /**
     * @param {Element | string | PromiseLike<Element | string>} loader
     * @param {ManualViewRenderOptions} options
     * @returns {Promise<Element>}
     */
    async load (loader, options = undefined) {
      this.clear()

      /** @type {HTMLElement} */
      const body = this.#body
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

        body.textContent = ''
        this.render(manual, options)

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
