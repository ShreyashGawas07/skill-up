import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement scrolling; App scrolls to top on route changes.
if (typeof window !== 'undefined') window.scrollTo = () => {}
