import { expect, test, type Page } from '@playwright/test'

/** Console messages that come from inside libraries and are not ours to fix. */
const KNOWN_LIBRARY_WARNINGS = [/THREE\.Clock: This module has been deprecated/]

function watchConsole(page: Page) {
  const problems: string[] = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return
    const text = msg.text()
    if (KNOWN_LIBRARY_WARNINGS.some((re) => re.test(text))) return
    problems.push(`[${msg.type()}] ${text}`)
  })
  page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`))
  return problems
}

/**
 * Scrolls so the given narrative step's top crosses the middle of the screen.
 * The chapter is a lazily loaded chunk, so wait for it to render first.
 */
async function scrollToStep(page: Page, step: string, into = 0.15) {
  await page.locator(`[data-step="${step}"]`).waitFor({ state: 'attached', timeout: 60_000 })
  await page.evaluate(
    ([id, f]) => {
      const el = document.querySelector<HTMLElement>(`[data-step="${id}"]`)!
      const top = el.getBoundingClientRect().top + window.scrollY
      window.scrollTo(0, top - window.innerHeight / 2 + el.offsetHeight * Number(f))
    },
    [step, into] as const,
  )
}

async function missionTime(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { rocketDebug: { sim: { live: { value: { t: number } } } } }).rocketDebug.sim.live.value.t)
}

test('the page loads cleanly and the rocket scene mounts', async ({ page }) => {
  const problems = watchConsole(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('NUMBERS')
  await expect(page.getByRole('img', { name: /Newton's cannonball/ })).toBeVisible()
  await scrollToStep(page, 'intro')
  await expect(page.locator('#rocket canvas')).toBeAttached()
  await page.waitForFunction(() => 'rocketDebug' in window)
  expect(problems).toEqual([])
})

test('scrolling drives mission time forward through the launch', async ({ page }) => {
  await page.goto('/')
  await scrollToStep(page, 'countdown', 0.2)
  await page.waitForFunction(() => 'rocketDebug' in window)
  await expect.poll(() => missionTime(page)).toBeLessThan(0)
  await scrollToStep(page, 'drag', 0.4)
  await expect.poll(() => missionTime(page), { timeout: 30_000 }).toBeGreaterThan(20)
  const tDrag = await missionTime(page)
  await scrollToStep(page, 'mass', 0.5)
  await expect.poll(() => missionTime(page), { timeout: 30_000 }).toBeGreaterThan(tDrag + 60)
})

test('lowering thrust below weight keeps the rocket on the pad', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'slider dragging is covered on desktop')
  await page.goto('/')
  await scrollToStep(page, 'liftoff', 0.3)
  await page.waitForFunction(() => 'rocketDebug' in window)
  const slider = page.getByRole('slider', { name: /Thrust/ }).first()
  await expect(slider).toBeVisible()
  // 3.0 MN against a ~4.1 MN weight: T/W below 1.
  await slider.fill('3000000')
  await expect(page.getByText(/T\/W 0\.7/).first()).toBeVisible()
  // The pad holds the rocket: the telemetry says so and altitude stays 0.
  await expect(page.getByText('Engines firing, held by the pad').first()).toBeVisible({ timeout: 30_000 })
  const altitude = await page.evaluate(() => (window as unknown as { rocketDebug: { sim: { live: { value: { altitude: number } } } } }).rocketDebug.sim.live.value.altitude)
  expect(altitude).toBe(0)
})

test('the flight lab launches and reports the outcome', async ({ page }) => {
  await page.goto('/')
  await scrollToStep(page, 'lab', 0.45)
  await page.waitForFunction(() => 'rocketDebug' in window)
  const outcome = page.getByTestId('flight-outcome')
  await expect(outcome).toContainText('Orbit reached')
  await page.getByRole('button', { name: 'Back to T−10' }).click()
  await expect.poll(() => missionTime(page)).toBeLessThan(-9)
  await page.getByRole('radio', { name: '100×' }).click()
  await page.getByRole('button', { name: 'Launch' }).click()
  await expect.poll(() => missionTime(page), { timeout: 30_000 }).toBeGreaterThan(0)

  // Switching guidance off changes the physics and the verdict.
  await page.getByRole('switch', { name: 'Guidance computer' }).click()
  await expect(outcome).not.toContainText('Orbit reached')
  await expect(outcome).toContainText(/Suborbital|Crash/)
})

test('the layout never scrolls sideways', async ({ page }) => {
  await page.goto('/')
  for (const step of ['intro', 'liftoff', 'turn', 'lab']) {
    await scrollToStep(page, step, 0.3)
    await page.waitForTimeout(500)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `horizontal overflow at ${step}`).toBeLessThanOrEqual(0)
  }
})

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test('the hero stays still and scrolling still flies the rocket', async ({ page }) => {
    const problems = watchConsole(page)
    await page.goto('/')
    await scrollToStep(page, 'drag', 0.4)
    await page.waitForFunction(() => 'rocketDebug' in window)
    await expect.poll(() => missionTime(page), { timeout: 30_000 }).toBeGreaterThan(20)
    // No scroll-scrubbed zoom: GSAP never touched the hero copy.
    await expect(page.locator('.hero-copy')).not.toHaveAttribute('style', /opacity/)
    expect(problems).toEqual([])
  })
})
