'use strict'

{
  /**
   * @callback Define
   * @param {string | string[] | Function | any} id Module ID.
   * @param {string[] | Function | any} [dependencies] Module dependencies.
   * @param {Function | any} [factory] Module instantiater.
   * @return {Promise} Promise of module.
   */

  /**
   * @callback Require
   * @param {string | string[]} dependencies Required module ID(s).
   * @param {Function} [factory] Callback function.
   * @return {any | Promise} Module or promise.
   */


  /**
   * @extends {Map<string, Promise>}
   */
  class Loader extends Map {
    /**
     * defined modules
     * @type {Map<string, any>}
     */
    modules = new Map

    /**
     * loader options
     * @type {Object}
     */
    options

    constructor (options = {}) {
      super()
      this.options = options
    }

    /**
     * Resolve the absolute path from module ID, relative to current module.
     * @param {string} id Module ID.
     * @param {string} current Module ID to resolve relative ID from.
     * @return {string[]} Absolute path to the module.
     */
    static realpath (id, current = undefined) {
      const path = id.split('/')

      if (path[0] === '.' || path[0] === '..') {
        if (!current) {
          throw new Error(
            'require relative module while not providing current module id')
        }
        const pathId = path.slice()
        path.length = 0
        path.push(...current.split('/'))
        path.push('..')
        path.push(...pathId)
      }

      /** @type {string[]} */
      const pathReal = []
      for (let i = 0; i < path.length; i++) {
        switch (path[i]) {
          case '.':
            break
          case '..':
            if (pathReal.length === 0) {
              throw new Error('module path beyond top level')
            }
            pathReal.pop()
            break
          default:
            pathReal.push(path[i])
        }
      }
      return pathReal
    }

    /**
     * Resolve the absolute ID from module ID, relative to current module.
     * @param {string} id Module ID.
     * @param {string} current Module ID to resolve relative ID from.
     * @return {string} Normalized module ID.
     */
    static realid (id, current = undefined) {
      return Loader.realpath(id, current).join('/')
    }

    /**
     * Wait module to be available.
     * @param {string} id Module ID.
     * @param {string} current Module ID to resolve relative ID from.
     * @return {Promise} Promise of module.
     */
    wait (id) {
      const promise_ = this.get(id)
      if (promise_ !== undefined) {
        return promise_
      }

      let promiseResolve
      let promiseReject
      const promise = new Promise(function (resolve, reject) {
        promiseResolve = resolve
        promiseReject = reject
      })
      promise.resolve = promiseResolve
      promise.reject = promiseReject
      this.set(id, promise)
      return promise
    }

    /**
     * Get module(s).
     * @param {string | string[]} dependencies Required module ID(s).
     * @param {Function} factory Callback function.
     * @param {string} current Module ID to resolve relative ID from.
     * @return {any | Promise} Module or promise.
     */
    require (dependencies, factory = undefined, current = undefined) {
      if (typeof dependencies === 'string') {
        const module = this.get(Loader.realid(dependencies, current))
        if (!module) {
          throw new Error('module "' + dependencies + '" not found')
        }
        return module
      }

      /** @type {Promise[]} */
      const promises = new Array(dependencies.length)
      for (let i = 0; i < dependencies.length; i++) {
        switch (dependencies[i]) {
          case 'require':
          case 'exports':
          case 'module':
            throw new Error(
              'use of "' + dependencies[i] + '" in `require` is forbidden')
          default:
            promises[i] = this.wait(Loader.realid(dependencies[i], current))
        }
      }

      const promise = Promise.all(promises)
      return factory ? promise.then(values => factory(...values)) : promise
    }

    /**
     * Define a module.
     * @param {string?} id Module ID.
     * @param {string[]} dependencies Module dependencies.
     * @param {Function | any} factory Module instantiater.
     * @return {Promise} Promise of the module.
     */
    async _define (
        id = null, dependencies = ['require', 'exports', 'module'],
        factory = undefined) {
      if (factory === undefined) {
        throw new Error('factory not defined')
      }

      const path = typeof id === 'string' ? Loader.realpath(id) : null
      const id_ = path && path.join('/')
      switch (id_) {
        case 'require':
        case 'exports':
        case 'module':
          throw new Error('module id "' + id_ + '" invalid')
      }
      if (id_ !== null && this.modules.has(id_)) {
        throw new Error('module "' + id + '" redefined')
      }
      this.modules.set(id_, undefined)

      /**
       * @param {string | string[]} dependencies Required module ID(s).
       * @param {Function} factory Callback function.
       * @return {any | Promise} Module or promise.
       */
      const require = (dependencies, factory = undefined) =>
        this.require(dependencies, factory, id_)
      let exports = {}
      const module = {id: id_}

      const promises = new Array(dependencies.length)
      for (let i = 0; i < dependencies.length; i++) {
        const dep = Loader.realid(dependencies[i], id_)
        switch (dep) {
          case 'require':
            promises[i] = require
            break
          case 'exports':
            promises[i] = exports
            break
          case 'module':
            promises[i] = module
            break
          default:
            promises[i] = this.wait(dep)
        }
      }

      const modules = await Promise.all(promises)

      if (typeof factory !== 'function') {
        exports = factory
      } else {
        const exports_ = await factory(...modules)
        let empty = true
        for (const prop in exports) {
          if (exports.hasOwnProperty(prop)) {
            empty = false
            break
          }
        }
        if (empty) {
          exports = exports_
        }
      }

      if (module.exportToGlobal && path !== null) {
        let ns = globalThis
        for (let i = 0; i < path.length - 1; i++) {
          if (!(path[i] in ns)) {
            console.warn('use module "' + path.slice(0, i + 1).join('/') +
                          '" before define')
            ns[path[i]] = {}
          }
          ns = ns[path[i]]
        }
        ns[path[path.length - 1]] = exports
      }

      if (id_ !== null) {
        const promise = this.get(id_)
        if (promise !== undefined) {
          promise.resolve(exports)
        } else {
          this.set(id_, Promise.resolve(exports))
        }
        this.modules.set(id_, exports)
      }

      return exports
    }

    /**
     * Define a module.
     * @param {string | string[] | Function | any} id Module ID.
     * @param {string[] | Function | any} [dependencies] Module dependencies.
     * @param {Function | any} [factory] Module instantiater.
     * @return {Promise} Promise of the module.
     */
    define (id, dependencies = undefined, factory = undefined) {
      const id_ = typeof id === 'string' ? id : null
      /** @type {string[]} */
      const dependencies_ =
        Array.isArray(id) ? id :
        Array.isArray(dependencies) ? dependencies :
        ['require', 'exports', 'module']
      const factory_ =
        typeof id !== 'string' && !Array.isArray(id) ? id :
        !Array.isArray(dependencies) ? dependencies :
        factory
      return this._define(id_, dependencies_, factory_)
    }

    /**
     * Scan the existing `<script>` elements and define corresponding modules.
     */
    detect () {
      /** @type {NodeListOf<HTMLScriptElement>} */
      const scripts = document.querySelectorAll('script[data-module]')
      for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i]
        this._define(
          script.dataset.module || null,
          script.dataset.dependencies?.split(' ').filter(x => !!x) ?? [],
          function () {
            if (!('export' in script.dataset)) {
              return null
            }

            const varname = script.dataset.export
            if (varname in globalThis) {
              return globalThis[varname]
            }

            return new Promise(function (resolve, reject) {
              const onload = event => {
                const varname = script.dataset.export
                if (varname in globalThis) {
                  script.removeEventListener('load', onload)
                  window.removeEventListener('load', onload)
                  resolve(globalThis[varname])
                }
              }
              script.addEventListener('load', onload)
              window.addEventListener('load', onload)
            })
          })
      }
    }
  }


  /**
   * @param {string | string[] | Function | any} id Module ID.
   * @param {string[] | Function | any} [dependencies] Module dependencies.
   * @param {Function | any} [factory] Module instantiater.
   */
  function thumb (id, dependencies, factory) {
    if (typeof define === 'function') {
      define(id, dependencies, factory)
    } else {
      (((globalThis.require ??= {}).options ??= {}).defers ??= []).push(
        [id, dependencies, factory])
    }
  }


  /** @type {Loader} */
  var loader = new Loader(require?.options)
  /** @type {Define} */
  var define = loader.define.bind(loader)
  /** @type {Require} */
  var require = loader.require.bind(loader)
  require.options = loader.options
  require.config = function (options) {
    for (const prop in options) {
      if (options.hasOwnProperty(prop)) {
        this.options[prop] = options[prop]
      }
    }
  }

  loader.detect()

  // emit deferred defines
  if ('defers' in loader.options) {
    for (const args of loader.options.defers) {
      define(...args)
    }
    delete loader.options.defers
  }
}
