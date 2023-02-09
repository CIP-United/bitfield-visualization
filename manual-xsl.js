'use strict'

var manualXsl = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:m="https://github.com/CIP-United/bitfield-visualization"
    exclude-result-prefixes="m">
  <xsl:output method="html" indent="yes" />

  <!--
  Copyright (c) 2001-2009, Evan Lenz
  All rights reserved.

  Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

      * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
      * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
      * Neither the name of Lenz Consulting Group nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

          THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

  Recent changes:

  2010-06-10: Added the $force-exclude-all-namespaces parameter
  2009-10-19: Added the $exclude-these-namespaces parameter
  2009-10-08: Added $att-value parameter and template name to template rule for attributes.

  -->

  <xsl:param name="use-empty-syntax" select="true()"/>
  <xsl:param name="exclude-unused-prefixes" select="true()"/>

  <xsl:param name="force-exclude-all-namespaces" select="false()"/>

  <!-- a node-set; each node's string-value
       will be interpreted as a namespace URI to be
       excluded from the serialization. -->
  <xsl:param name="namespaces-to-exclude" select="/.."/>
                                          <!-- initialized to empty node-set -->

  <xsl:param name="start-tag-start"     select="'&lt;'"/>
  <xsl:param name="start-tag-end"       select="'>'"/>
  <xsl:param name="empty-tag-end"       select="'/>'"/>
  <xsl:param name="end-tag-start"       select="'&lt;/'"/>
  <xsl:param name="end-tag-end"         select="'>'"/>
  <xsl:param name="space"               select="' '"/>
  <xsl:param name="ns-decl"             select="'xmlns'"/>
  <xsl:param name="colon"               select="':'"/>
  <xsl:param name="equals"              select="'='"/>
  <xsl:param name="attribute-delimiter" select="'&quot;'"/>
  <xsl:param name="comment-start"       select="'&lt;!--'"/>
  <xsl:param name="comment-end"         select="'-->'"/>
  <xsl:param name="pi-start"            select="'&lt;?'"/>
  <xsl:param name="pi-end"              select="'?>'"/>

  <xsl:template name="xml-to-string">
    <xsl:param name="node-set" select="."/>
    <xsl:apply-templates select="$node-set" mode="xml-to-string">
      <xsl:with-param name="depth" select="1"/>
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template match="/" name="xml-to-string-root-rule">
    <xsl:call-template name="xml-to-string"/>
  </xsl:template>

  <xsl:template match="/" mode="xml-to-string">
    <xsl:param name="depth"/>
    <xsl:apply-templates mode="xml-to-string">
      <xsl:with-param name="depth" select="$depth"/>
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template match="*" mode="xml-to-string">
    <xsl:param name="depth"/>
    <xsl:variable name="element" select="."/>
    <xsl:value-of select="$start-tag-start"/>
    <xsl:call-template name="element-name">
      <xsl:with-param name="text" select="name()"/>
    </xsl:call-template>
    <xsl:apply-templates select="@*" mode="xml-to-string"/>
    <xsl:if test="not($force-exclude-all-namespaces)">
      <xsl:for-each select="namespace::*">
        <xsl:call-template name="process-namespace-node">
          <xsl:with-param name="element" select="$element"/>
          <xsl:with-param name="depth" select="$depth"/>
        </xsl:call-template>
      </xsl:for-each>
    </xsl:if>
    <xsl:choose>
      <xsl:when test="node() or not($use-empty-syntax)">
        <xsl:value-of select="$start-tag-end"/>
        <xsl:apply-templates mode="xml-to-string">
          <xsl:with-param name="depth" select="$depth + 1"/>
        </xsl:apply-templates>
        <xsl:value-of select="$end-tag-start"/>
        <xsl:call-template name="element-name">
          <xsl:with-param name="text" select="name()"/>
        </xsl:call-template>
        <xsl:value-of select="$end-tag-end"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$empty-tag-end"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="process-namespace-node">
    <xsl:param name="element"/>
    <xsl:param name="depth"/>
    <xsl:variable name="declaredAbove">
      <xsl:call-template name="isDeclaredAbove">
        <xsl:with-param name="depth" select="$depth - 1"/>
        <xsl:with-param name="element" select="$element/.."/>
      </xsl:call-template>
    </xsl:variable>

    <xsl:variable name="is-used-on-this-element" select="($element    | $element/@*) [namespace-uri() = current()]"/>
    <xsl:variable name="is-used-on-a-descendant" select="($element//* | $element//@*)[namespace-uri() = current()]"/>
    <xsl:variable name="is-unused" select="not($is-used-on-this-element) and
                                           not($is-used-on-a-descendant)"/>
    <xsl:variable name="exclude-ns" select="($is-unused and $exclude-unused-prefixes) or
                                            (. = $namespaces-to-exclude)"/>

    <xsl:variable name="force-include" select="$is-used-on-this-element and (. = $namespaces-to-exclude)"/>

    <xsl:if test="(name() != 'xml') and ($force-include or (not($exclude-ns) and not(string($declaredAbove))))">
      <xsl:value-of select="$space"/>
      <xsl:value-of select="$ns-decl"/>
      <xsl:if test="name()">
        <xsl:value-of select="$colon"/>
        <xsl:call-template name="ns-prefix">
          <xsl:with-param name="text" select="name()"/>
        </xsl:call-template>
      </xsl:if>
      <xsl:value-of select="$equals"/>
      <xsl:value-of select="$attribute-delimiter"/>
      <xsl:call-template name="ns-uri">
        <xsl:with-param name="text" select="string(.)"/>
      </xsl:call-template>
      <xsl:value-of select="$attribute-delimiter"/>
    </xsl:if>
  </xsl:template>

  <xsl:template name="isDeclaredAbove">
    <xsl:param name="element"/>
    <xsl:param name="depth"/>
    <xsl:if test="$depth > 0">
      <xsl:choose>
        <xsl:when test="$element/namespace::*[name(.)=name(current()) and .=current()]">1</xsl:when>
        <xsl:when test="$element/namespace::*[name(.)=name(current())]"/>
        <xsl:otherwise>
          <xsl:call-template name="isDeclaredAbove">
            <xsl:with-param name="depth" select="$depth - 1"/>
            <xsl:with-param name="element" select="$element/.."/>
          </xsl:call-template>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:if>
  </xsl:template>

  <xsl:template match="@*" mode="xml-to-string" name="serialize-attribute">
    <xsl:param name="att-value" select="string(.)"/>
    <xsl:value-of select="$space"/>
    <xsl:call-template name="attribute-name">
      <xsl:with-param name="text" select="name()"/>
    </xsl:call-template>
    <xsl:value-of select="$equals"/>
    <xsl:value-of select="$attribute-delimiter"/>
    <xsl:call-template name="attribute-value">
      <xsl:with-param name="text" select="$att-value"/>
    </xsl:call-template>
    <xsl:value-of select="$attribute-delimiter"/>
  </xsl:template>

  <xsl:template match="comment()" mode="xml-to-string">
    <xsl:value-of select="$comment-start"/>
    <xsl:call-template name="comment-text">
      <xsl:with-param name="text" select="string(.)"/>
    </xsl:call-template>
    <xsl:value-of select="$comment-end"/>
  </xsl:template>

  <xsl:template match="processing-instruction()" mode="xml-to-string">
    <xsl:value-of select="$pi-start"/>
    <xsl:call-template name="pi-target">
      <xsl:with-param name="text" select="name()"/>
    </xsl:call-template>
    <xsl:value-of select="$space"/>
    <xsl:call-template name="pi-text">
      <xsl:with-param name="text" select="string(.)"/>
    </xsl:call-template>
    <xsl:value-of select="$pi-end"/>
  </xsl:template>

  <xsl:template match="text()" mode="xml-to-string">
    <xsl:call-template name="text-content">
      <xsl:with-param name="text" select="string(.)"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="element-name">
    <xsl:param name="text"/>
    <xsl:value-of select="$text"/>
  </xsl:template>

  <xsl:template name="attribute-name">
    <xsl:param name="text"/>
    <xsl:value-of select="$text"/>
  </xsl:template>

  <xsl:template name="attribute-value">
    <xsl:param name="text"/>
    <xsl:variable name="escaped-markup">
      <xsl:call-template name="escape-markup-characters">
        <xsl:with-param name="text" select="$text"/>
      </xsl:call-template>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$attribute-delimiter = &quot;'&quot;">
        <xsl:call-template name="replace-string">
          <xsl:with-param name="text" select="$escaped-markup"/>
          <xsl:with-param name="replace" select="&quot;'&quot;"/>
          <xsl:with-param name="with" select="'&amp;apos;'"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$attribute-delimiter = '&quot;'">
        <xsl:call-template name="replace-string">
          <xsl:with-param name="text" select="$escaped-markup"/>
          <xsl:with-param name="replace" select="'&quot;'"/>
          <xsl:with-param name="with" select="'&amp;quot;'"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="replace-string">
          <xsl:with-param name="text" select="$escaped-markup"/>
          <xsl:with-param name="replace" select="$attribute-delimiter"/>
          <xsl:with-param name="with" select="''"/>
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="ns-prefix">
    <xsl:param name="text"/>
    <xsl:value-of select="$text"/>
  </xsl:template>

  <xsl:template name="ns-uri">
    <xsl:param name="text"/>
    <xsl:call-template name="attribute-value">
      <xsl:with-param name="text" select="$text"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="text-content">
    <xsl:param name="text"/>
    <xsl:call-template name="escape-markup-characters">
      <xsl:with-param name="text" select="$text"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="pi-target">
    <xsl:param name="text"/>
    <xsl:value-of select="$text"/>
  </xsl:template>

  <xsl:template name="pi-text">
    <xsl:param name="text"/>
    <xsl:value-of select="$text"/>
  </xsl:template>

  <xsl:template name="comment-text">
    <xsl:param name="text"/>
    <xsl:value-of select="$text"/>
  </xsl:template>

  <xsl:template name="escape-markup-characters">
    <xsl:param name="text"/>
    <xsl:variable name="ampEscaped">
      <xsl:call-template name="replace-string">
        <xsl:with-param name="text" select="$text"/>
        <xsl:with-param name="replace" select="'&amp;'"/>
        <xsl:with-param name="with" select="'&amp;amp;'"/>
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="ltEscaped">
      <xsl:call-template name="replace-string">
        <xsl:with-param name="text" select="$ampEscaped"/>
        <xsl:with-param name="replace" select="'&lt;'"/>
        <xsl:with-param name="with" select="'&amp;lt;'"/>
      </xsl:call-template>
    </xsl:variable>
    <xsl:call-template name="replace-string">
      <xsl:with-param name="text" select="$ltEscaped"/>
      <xsl:with-param name="replace" select="']]>'"/>
      <xsl:with-param name="with" select="']]&amp;gt;'"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="replace-string">
    <xsl:param name="text"/>
    <xsl:param name="replace"/>
    <xsl:param name="with"/>
    <xsl:variable name="stringText" select="string($text)"/>
    <xsl:choose>
      <xsl:when test="contains($stringText,$replace)">
        <xsl:value-of select="substring-before($stringText,$replace)"/>
        <xsl:value-of select="$with"/>
        <xsl:call-template name="replace-string">
          <xsl:with-param name="text" select="substring-after($stringText,$replace)"/>
          <xsl:with-param name="replace" select="$replace"/>
          <xsl:with-param name="with" select="$with"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$stringText"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

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
          <xsl:apply-templates select="." mode="xml-to-string" />
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
