import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const load = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('admin users keeps its desktop table and provides a complete mobile card', async () => {
  const source = await load('../src/pages/AdminUserPage.jsx')

  assert.match(source, /admin-table-wrap admin-desktop-table/)
  assert.match(source, /className="admin-mobile-list"/)
  assert.match(source, /AdminUserCard/)
  assert.match(source, /user\.display_name/)
  assert.match(source, /user\.email/)
  assert.match(source, />角色</)
  assert.match(source, />最近登录</)
  assert.match(source, /停用账号/)
  assert.match(source, /恢复账号/)
})

test('governance keeps its desktop table and exposes mobile target details and actions', async () => {
  const source = await load('../src/pages/AdminGovernancePage.jsx')

  assert.match(source, /admin-table-wrap admin-desktop-table/)
  assert.match(source, /className="admin-mobile-list"/)
  assert.match(source, /GovernanceDemandCard/)
  assert.match(source, />治理目标</)
  assert.match(source, /发布时间/)
  assert.match(source, />操作原因</)
  assert.match(source, />暂无记录</)
  assert.match(source, /关闭需求/)
  assert.match(source, /恢复需求/)
})

test('admin mobile CSS replaces tables at 900px and prevents narrow-screen overflow', async () => {
  const css = await load('../src/styles/adminMobile.css')

  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /\.admin-operations-page \.admin-desktop-table\s*{\s*display: none;/)
  assert.match(css, /\.admin-operations-page \.admin-mobile-list\s*{[\s\S]*display: grid;/)
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(css, /overflow-x: clip/)
  assert.match(css, /overflow-wrap: anywhere/)
  assert.match(css, /@media \(max-width: 380px\)/)
})

test('all RC target widths use the card and non-overflow mobile rules', async () => {
  const targetWidths = [320, 360, 390, 430]
  const [adminCss, mobileCss] = await Promise.all([
    load('../src/styles/adminMobile.css'),
    load('../src/styles/mobile.css'),
  ])
  const tableCardBreakpoint = Number(adminCss.match(/@media \(max-width: (\d+)px\)/)?.[1])
  const globalOverflowBreakpoint = Number(mobileCss.match(/@media \(max-width: (\d+)px\)/)?.[1])

  for (const width of targetWidths) {
    assert.ok(width <= tableCardBreakpoint, `${width}px must use admin cards`)
    assert.ok(width <= globalOverflowBreakpoint, `${width}px must clip page overflow`)
  }
})

test('admin mobile critical navigation and operation controls meet 44px targets', async () => {
  const css = await load('../src/styles/adminMobile.css')

  assert.match(css, /\.admin-dashboard-page \.module-link[\s\S]*min-height: 44px;/)
  assert.match(css, /\.admin-certification-page \.compact-button[\s\S]*min-height: 44px;/)
  assert.match(css, /\.admin-operation-card__actions button\s*{[\s\S]*min-height: 44px;/)
})

test('existing demand and order dialogs remain bounded and touch operable on mobile', async () => {
  const [demandCss, orderCss] = await Promise.all([
    load('../src/styles/adminDemand.css'),
    load('../src/styles/order.css'),
  ])

  assert.match(demandCss, /max-height: 90vh/)
  assert.match(demandCss, /\.dialog-heading > button[\s\S]*min-height: 44px/)
  assert.match(demandCss, /\.dialog-actions button\s*{\s*min-height: 44px;/)
  assert.match(orderCss, /\.order-dialog\s*{[\s\S]*max-height: 90vh/)
  assert.match(orderCss, /\.order-dialog__close\s*{[\s\S]*min-height: 44px/)
  assert.match(orderCss, /\.order-dialog__actions button\s*{[\s\S]*min-height: 44px/)
})

test('admin certification and order pages retain non-overflowing mobile layouts', async () => {
  const [mobileCss, orderCss, certificationSource, orderSource] = await Promise.all([
    load('../src/styles/mobile.css'),
    load('../src/styles/order.css'),
    load('../src/pages/AdminCertificationPage.jsx'),
    load('../src/pages/OrderListPage.jsx'),
  ])

  assert.match(certificationSource, /admin-certification-page/)
  assert.match(mobileCss, /@media \(max-width: 768px\)[\s\S]*overflow-x: clip/)
  assert.match(mobileCss, /\.candidate-grid[\s\S]*minmax\(0, 1fr\)/)
  assert.match(orderSource, /ADMIN:[\s\S]*title: '订单管理'/)
  assert.match(orderCss, /@media \(max-width: 900px\)[\s\S]*\.order-grid,[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(orderCss, /\.order-card\s*{[\s\S]*min-width: 0/)
})
