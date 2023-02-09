<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:m="https://github.com/CIP-United/bitfield-visualization"
    exclude-result-prefixes="m">
  <xsl:import href="xml-to-string.xsl" />

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
</xsl:stylesheet>
