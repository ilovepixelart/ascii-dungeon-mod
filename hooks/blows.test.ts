import { expect, mock, test } from 'claude-code/testing'

import { INSET, stripLeft } from './hud'

const PANE = { plugin: 'ascii-dungeon', component: 'Pane', requestId: 'dungeon', props: { title: 'Dungeon', isFocused: true, bodyColumns: 110, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } } as const

// A map the host will not take (a window over it, the pane resized) cuts a blow's frames short: what waits on the blow
// goes on as if it had played out.

test('a blow whose map is refused leaves the idle motion running once the window over it closes', { timeoutMs: 60000 }, async ($, on) => {
  const clock = mock.clock(on)
  let isMapUp = (): Promise<boolean> => Promise.resolve(true)
  let blits = 0
  on('ui.blit', async () => {
    blits += 1
    return { value: (await isMapUp()) ? {} : { deny: 'not mounted' } }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('tool.call', () => ({ result: { stdout: '', stderr: 'boom' } as never, isError: true }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  isMapUp = async () => (await ui.find({ type: 'Raster', key: 'map' })) !== undefined
  await $.tool.call({ tool: 'Edit', file_path: '/src/a.ts', old_string: 'a', new_string: 'b' })
  await clock.advance(3000)
  // The bag opened from the strip's portrait, a failing call's blow landing under it, then the bag closed.
  const portrait = { x: INSET + stripLeft(PANE.props.bodyColumns - 2 * INSET) + 5, y: Math.floor((INSET + 5) / 2) }
  await ui.pointer({ type: 'down', ...portrait, button: 'left', in: 'hud-clicks' })
  await ui.pointer({ type: 'up', ...portrait, button: 'left', in: 'hud-clicks' })
  expect(await ui.find({ type: 'Raster', key: 'bag' })).toBeDefined()
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.advance(2000)
  await ui.pointer({ type: 'down', x: 99, y: 3, button: 'left', in: 'bag-clicks' })
  await ui.pointer({ type: 'up', x: 99, y: 3, button: 'left', in: 'bag-clicks' })
  expect(await ui.find({ type: 'Raster', key: 'bag' })).toBeUndefined()
  blits = 0
  await clock.advance(30000)
  expect(blits).toBeGreaterThan(0)
  await ui.unmount()
})

test('a fall whose map is refused still opens the death window', { timeoutMs: 60000 }, async ($, on) => {
  const clock = mock.clock(on)
  on('ui.blit', () => ({ value: { deny: 'not mounted' } }))
  on('tool.call', () => ({ result: { stdout: '', stderr: 'boom' } as never, isError: true }))
  const said: string[] = []
  on('ui.toast', (_$, e) => {
    said.push(e.text)
    return { value: undefined }
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  for (let i = 0; i < 200 && !said.some(t => t.startsWith('Slain by')); i += 1) {
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await clock.advance(3000)
  }
  expect(said.some(t => t.startsWith('Slain by'))).toBe(true)
  await clock.advance(10000)
  expect(await ui.find({ type: 'Raster', key: 'death' })).toBeDefined()
  await ui.unmount()
})
