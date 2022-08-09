'use strict'

{
  function br (str) {
    return !str ? '' : !Array.isArray(str) ? str.replaceAll('\n', '<br />') :
      '<div class="paragraph">' + str.join('</div><div class="paragraph">') +
      '</div>'
  }


  /** @type {Object<string, Object>} */
  var ManualFormatter
  (ManualFormatter ??= {}).mips = {
    stylesheet: "mips.css",

    fieldDescription (desc, caption = '') {
      if (!Array.isArray(desc)) {
        return desc
      }

      const table = ['<table class="field-descriptions paragraph">']

      if (caption) {
        table.push('<caption>')
        table.push(caption)
        table.push('</caption>')
      }

      table.push(`<thead>
    <tr>
      <th colspan="2">Fields</th>
      <th rowspan="2">Description</th>
      <th rowspan="2">Read/Write</th>
      <th rowspan="2">Reset State</th>
      <th rowspan="2">Compliance</th>
    </tr>
    <tr>
      <th>Name</th>
      <th>Bits</th>
    </tr>
</thead>
<tbody>`)

      for (let i = 0; i < desc.length; i++) {
        const {name, bits, description, rw, reset, compliance, encodings} =
          desc[i]
        table.push('<tr><td>')
        table.push(br(name))
        table.push('</td><td>')
        table.push(br(bits))
        table.push('</td><td>')
        table.push(br(description))
        if (encodings) {
          table.push(`<table class="field-encodings paragraph">
  <thead>
    <tr>
      <th>Encoding</th>
      <th>Meaning</th>
    </tr>
  </thead>
  <tbody>`)
          for (let j = 0; j < encodings.length; j++) {
            const [encoding, meaning] = encodings[j]
            table.push('<tr><td>')
            table.push(br(encoding))
            table.push('</td><td>')
            table.push(br(meaning))
            table.push('</td></tr>')
          }
          table.push('</tbody></table>')
        }
        table.push('</td><td>')
        table.push(br(rw))
        table.push('</td><td>')
        table.push(br(reset))
        table.push('</td><td>')
        table.push(br(compliance))
        table.push('</td></tr>')
      }

      table.push('</tbody></table>')

      return table.join('')
    },

    fieldDescriptions (descs) {
      if (typeof descs !== 'object') {
        return descs
      }

      /** @type {string[]} */
      const tables = []
      for (const caption in descs) {
        if (descs.hasOwnProperty(caption)) {
          tables.push(ManualFormatter.mips.fieldDescription(
            descs[caption], caption[0] === '_' ? '' : caption))
        }
      }
      return tables.join('')
    },
  }
}
